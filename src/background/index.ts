/// <reference types="chrome" />

// Define types for message handlers
interface MessageSender {
  tab?: chrome.tabs.Tab;
  frameId?: number;
  id?: string;
  url?: string;
  tlsChannelId?: string;
}

type ResponseCallback = (response?: any) => void;

// Background script to handle the extension icon click
chrome.action.onClicked.addListener((tab: chrome.tabs.Tab) => {
  // Open the side panel with appropriate window handling
  if (tab && tab.id !== undefined) {
    // In MV3, chrome.sidePanel.open() in different browsers may require different parameters
    // Try with just tabId first, which works in many cases
    try {
      chrome.sidePanel.open({ tabId: tab.id } as chrome.sidePanel.OpenOptions)
        .catch(err => {
          console.error("Error opening side panel with tabId only:", err);
          
          // If that fails, try with the current window ID
          chrome.windows.getCurrent().then(window => {
            if (window && window.id !== undefined) {
              chrome.sidePanel.open({ 
                tabId: tab.id,
                windowId: window.id 
              }).catch(e => console.error("Error opening side panel with windowId:", e));
            }
          });
        });
    } catch (e) {
      console.error("Exception opening side panel:", e);
    }
  }
}); 

// Add permissions for tab capture
chrome.runtime.onInstalled.addListener(() => {
  console.log('ClipChat - Powered by Groq extension installed');
});

// Keep track of which tabs have content scripts ready
const contentScriptReadyTabs = new Set<number>();

// Keep track of pending screenshot requests
const pendingRequests = new Map<string, ResponseCallback>();

// Handle messages from content script and sidepanel
chrome.runtime.onMessage.addListener((message: any, sender: MessageSender, sendResponse: ResponseCallback) => {
  console.log("Background received message:", message.action, "from:", sender.tab ? `tab ${sender.tab.id}` : "extension");
  
  // Track when content scripts report they are ready
  if (message.action === 'contentScriptReady' && sender.tab && sender.tab.id !== undefined) {
    console.log(`Content script ready in tab ${sender.tab.id}`);
    contentScriptReadyTabs.add(sender.tab.id);
    sendResponse({success: true});
    return true;
  }
  
  // Handle tab capture request
  if (message.action === 'captureTab') {
    chrome.tabs.captureVisibleTab(chrome.windows.WINDOW_ID_CURRENT, {format: 'png'}, function(dataUrl) {
      sendResponse({dataUrl: dataUrl});
    });
    return true; // Keep the message channel open for the async response
  }
  
  // Handle selection complete message from content script
  if (message.action === 'selectionComplete' && sender.tab) {
    console.log("Received selection area from content script:", message.area);
    
    // Note: We won't try to send a response back to the content script
    // as it may cause the "message port closed" error
    
    const tabId = sender.tab.id;
    if (tabId === undefined) {
      console.error("Tab ID is undefined");
      return false; // No async response needed
    }
    
    // Prepare tab by ensuring UI is hidden, then capture
    prepareThenCapture(tabId, sender.tab.windowId, message.area);
    
    // No async response needed, the content script will clean up on its own
    return false;
  }
  
  // Handle screenshot region selection initiation from sidepanel
  if (message.action === 'initiateScreenshot') {
    console.log("Initiating screenshot from sidepanel");
    
    // Get the active tab
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (!tabs || tabs.length === 0) {
        const error = "No active tab found";
        console.error(error);
        sendResponse({success: false, error});
        return;
      }
      
      const activeTab = tabs[0];
      const tabId = activeTab.id;
      
      if (tabId === undefined) {
        const error = "Active tab has no ID";
        console.error(error);
        sendResponse({success: false, error});
        return;
      }
      
      // Store the sendResponse callback for later use
      const requestId = Date.now().toString();
      pendingRequests.set(requestId, sendResponse);
      
      console.log(`Starting screenshot process for tab ${tabId} with requestId ${requestId}`);
      
      // Ensure the tab is fully loaded before proceeding
      chrome.tabs.get(tabId, (tab) => {
        if (chrome.runtime.lastError) {
          handleError(requestId, `Error getting tab: ${chrome.runtime.lastError.message}`);
          return;
        }
        
        if (tab.status !== 'complete') {
          handleError(requestId, `Tab is not fully loaded (status: ${tab.status})`);
          return;
        }
        
        // Start selection directly since content script is already injected via manifest
        startSelection(tabId, requestId);
      });
    });
    
    return true; // Keep message channel open for async response
  }
  
  // Handle capture and crop request from content script
  if (message.action === 'captureAndCropTab') {
    console.log("Capturing and cropping tab with area:", message.area);
    
    // If we have a preloaded image from the content script, use it directly
    if (message.preloadedImage) {
      console.log("Using preloaded image from content script");
      
      // Forward the image data directly
      chrome.runtime.sendMessage({
        action: 'screenshotCaptured',
        imageData: message.preloadedImage,
        cropArea: message.area,
        prompt: message.prompt
      }, function(response) {
        if (chrome.runtime.lastError) {
          console.error("Error sending preloaded screenshot to sidepanel:", chrome.runtime.lastError);
          sendResponse({success: false, error: chrome.runtime.lastError.message});
        } else {
          console.log("Preloaded screenshot sent to sidepanel");
          sendResponse({success: true});
        }
      });
      
      return true; // Keep message channel open for async response
    }
    
    // Otherwise capture a new screenshot
    chrome.tabs.captureVisibleTab(chrome.windows.WINDOW_ID_CURRENT, {format: 'png'}, function(dataUrl) {
      if (chrome.runtime.lastError) {
        console.error("Error capturing tab:", chrome.runtime.lastError);
        sendResponse({success: false, error: chrome.runtime.lastError.message});
        return;
      }
      
      // Send the image data, crop area, and prompt back to the sidepanel
      chrome.runtime.sendMessage({
        action: 'screenshotCaptured',
        imageData: dataUrl,
        cropArea: message.area,
        prompt: message.prompt
      }, function(response) {
        if (chrome.runtime.lastError) {
          console.error("Error sending screenshot to sidepanel:", chrome.runtime.lastError);
          sendResponse({success: false, error: chrome.runtime.lastError.message});
        } else {
          console.log("Screenshot sent to sidepanel:", response);
          sendResponse({success: true});
        }
      });
    });
    return true; // Keep message channel open for async response
  }
  
  // Handle new data transfer method using localStorage
  if (message.action === 'screenshotDataReady' && message.transferId && sender.tab && sender.tab.id !== undefined) {
    console.log(`Background received screenshotDataReady with ID: ${message.transferId} from tab ${sender.tab.id}`);
    
    // Execute script in the content script context to retrieve the data
    chrome.scripting.executeScript({
      target: { tabId: sender.tab.id },
      func: (transferId: string) => {
        // Get data from localStorage
        try {
          const dataStr = localStorage.getItem(transferId);
          if (!dataStr) return null;
          
          const data = JSON.parse(dataStr);
          // Clean up localStorage
          localStorage.removeItem(transferId);
          return data;
        } catch (e) {
          console.error('Error retrieving data from localStorage:', e);
          return null;
        }
      },
      args: [message.transferId]
    }).then(results => {
      if (!results || !results[0] || !results[0].result) {
        console.error('Error retrieving screenshot data from localStorage');
        sendResponse({ success: false, error: 'Failed to retrieve screenshot data' });
        return;
      }
      
      const screenshotData = results[0].result as {
        imageData: string;
        cropArea: any;
        prompt?: string;
      };
      
      // Forward to sidepanel
      chrome.runtime.sendMessage({
        action: 'screenshotCaptured',
        imageData: screenshotData.imageData,
        cropArea: screenshotData.cropArea,
        prompt: screenshotData.prompt || ""
      }).then(response => {
        console.log('Screenshot data forwarded to sidepanel successfully');
        sendResponse({ success: true });
      }).catch(error => {
        console.error('Error forwarding screenshot data to sidepanel:', error);
        sendResponse({ success: false, error: error instanceof Error ? error.message : String(error) });
      });
    }).catch(err => {
      console.error('Error executing script to retrieve data:', err);
      sendResponse({ success: false, error: err instanceof Error ? err.message : String(err) });
    });
    
    return true; // Keep message channel open for async response
  }
  
  // Forward screenshot from content script to sidepanel
  if (message.action === 'screenshotCaptured') {
    console.log("Received screenshot capture for forwarding");
    
    // Always try to forward this message to the sidepanel, regardless of source
    try {
      // This needs to be forwarded to the sidepanel, regardless of source
      // Try to send it with minimal information loss
      chrome.runtime.sendMessage({
        action: 'screenshotCaptured',
        imageData: message.imageData,
        cropArea: message.cropArea,
        prompt: message.prompt || ""
      }).then(response => {
        console.log("Screenshot forwarded to sidepanel:", response);
        sendResponse({success: true});
      }).catch(error => {
        console.error("Error forwarding screenshot:", error);
        sendResponse({success: false, error: error instanceof Error ? error.message : String(error)});
      });
    } catch (e) {
      console.error("Exception forwarding screenshot:", e);
      sendResponse({success: false, error: e instanceof Error ? e.message : String(e)});
    }
    
    return true; // Keep message channel open for async response
  }

  // Ensure we return false for any unhandled messages
  return false;
});

// Start the selection process
function startSelection(tabId: number, requestId: string) {
  console.log(`Starting selection in tab ${tabId} for request ${requestId}`);
  
  chrome.tabs.sendMessage(tabId, {action: 'startSelection'}, response => {
    if (chrome.runtime.lastError || !response || !response.success) {
      const errorMsg = chrome.runtime.lastError 
        ? chrome.runtime.lastError.message 
        : 'Content script did not respond correctly';
      
      console.error(`Error starting selection in tab ${tabId}: ${errorMsg}`);
      handleError(requestId, errorMsg);
    } else {
      console.log(`Selection successfully started in tab ${tabId}`);
      handleSuccess(requestId);
    }
  });
}

// Handle errors and respond to the original request
function handleError(requestId: string, errorMessage: string | undefined) {
  const errorMsg = errorMessage || "Unknown error";
  console.error(`Error (${requestId}): ${errorMsg}`);
  
  const sendResponse = pendingRequests.get(requestId);
  if (sendResponse) {
    sendResponse({success: false, error: errorMsg});
    pendingRequests.delete(requestId);
  }
}

// Handle successful operations and respond to the original request
function handleSuccess(requestId: string) {
  const sendResponse = pendingRequests.get(requestId);
  if (sendResponse) {
    sendResponse({success: true});
    pendingRequests.delete(requestId);
  }
}

// Clean up the contentScriptReadyTabs set when tabs are closed
chrome.tabs.onRemoved.addListener((tabId) => {
  if (contentScriptReadyTabs.has(tabId)) {
    contentScriptReadyTabs.delete(tabId);
    console.log(`Tab ${tabId} closed, removing from ready tabs`);
  }
});

// Clean up when extension is updated or reloaded
chrome.runtime.onStartup.addListener(() => {
  contentScriptReadyTabs.clear();
  pendingRequests.clear();
});

// Interface for the selection area
interface SelectionArea {
  x: number;
  y: number;
  width: number;
  height: number;
  dpr: number;
  [key: string]: any; // For any additional properties
}

// Utility function to crop an image based on selection coordinates
function cropImage(dataUrl: string, area: SelectionArea): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const img = new Image();
      
      // Set a timeout in case the image loading hangs
      const imageLoadTimeout = setTimeout(() => {
        reject(new Error("Image loading timeout"));
      }, 5000);
      
      img.onload = function() {
        clearTimeout(imageLoadTimeout);
        
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          if (!ctx) {
            reject(new Error("Could not get canvas context"));
            return;
          }
          
          // Apply device pixel ratio for accurate cropping
          const dpr = area.dpr || 1;
          
          // Ensure dimensions are valid
          if (area.width <= 0 || area.height <= 0) {
            reject(new Error("Invalid selection dimensions"));
            return;
          }
          
          // Calculate pixel values
          const pixelX = Math.round(area.x * dpr);
          const pixelY = Math.round(area.y * dpr);
          const pixelWidth = Math.round(area.width * dpr);
          const pixelHeight = Math.round(area.height * dpr);
          
          // Ensure we're not exceeding the image dimensions
          if (pixelX + pixelWidth > img.width || pixelY + pixelHeight > img.height) {
            console.warn("Selection exceeds image bounds, adjusting...");
            // Adjust the crop area to fit within the image
            const adjustedWidth = Math.min(pixelWidth, img.width - pixelX);
            const adjustedHeight = Math.min(pixelHeight, img.height - pixelY);
            
            if (adjustedWidth <= 0 || adjustedHeight <= 0) {
              reject(new Error("Selection area is outside image bounds"));
              return;
            }
            
            canvas.width = adjustedWidth;
            canvas.height = adjustedHeight;
            
            ctx.drawImage(
              img,
              pixelX, pixelY, adjustedWidth, adjustedHeight,
              0, 0, adjustedWidth, adjustedHeight
            );
          } else {
            // Normal case - crop as requested
            canvas.width = pixelWidth;
            canvas.height = pixelHeight;
            
            ctx.drawImage(
              img,
              pixelX, pixelY, pixelWidth, pixelHeight,
              0, 0, pixelWidth, pixelHeight
            );
          }
          
          // Get data URL with reduced quality to minimize size
          resolve(canvas.toDataURL('image/jpeg', 0.9));
        } catch (error) {
          console.error("Error cropping image:", error);
          reject(error);
        }
      };
      
      img.onerror = function(error) {
        clearTimeout(imageLoadTimeout);
        console.error("Error loading image for cropping:", error);
        reject(new Error("Failed to load image for cropping"));
      };
      
      // Start loading the image
      img.src = dataUrl;
      
    } catch (error) {
      console.error("Exception in cropImage:", error);
      reject(error);
    }
  });
}

// Function to prepare the tab for screenshot and then capture it
function prepareThenCapture(tabId: number, windowId: number | undefined, area: SelectionArea): void {
  // First send message to ensure UI is completely hidden
  chrome.tabs.sendMessage(tabId, { action: 'prepareForScreenshot' }, (response) => {
    // Short delay to ensure UI elements are fully hidden
    setTimeout(() => {
      // Capture the entire visible tab
      try {
        chrome.tabs.captureVisibleTab(
          windowId || chrome.windows.WINDOW_ID_CURRENT, 
          {format: 'png'}
        ).then(dataUrl => {
          console.log("Tab captured successfully, cropping based on selection");
          
          // Crop the image using our utility function
          cropImage(dataUrl, area)
            .then(croppedImage => {
              // Send the cropped image to sidepanel
              console.log("Cropped image successfully, sending to sidepanel...");
              chrome.runtime.sendMessage({
                action: 'screenshotCaptured',
                imageData: croppedImage,
                cropArea: area,
                selectionMode: true
              }).then(() => {
                console.log("Cropped screenshot sent to sidepanel successfully");
              }).catch(error => {
                console.error("Error sending cropped screenshot to sidepanel:", error);
                // Try alternative method if first attempt fails
                console.log("Trying alternative method to send screenshot...");
                chrome.runtime.sendMessage({
                  action: 'screenshotCaptured',
                  imageData: croppedImage,
                  cropArea: area
                }).catch(err => console.error("Alternative method also failed:", err));
              });
            })
            .catch(error => {
              console.error("Error during image cropping:", error);
              // If cropping fails, send the full screenshot with crop coordinates
              chrome.runtime.sendMessage({
                action: 'screenshotCaptured',
                imageData: dataUrl,
                cropArea: area,
                selectionMode: true,
                cropError: true
              }).catch(error => console.error("Error sending screenshot with crop coordinates:", error));
            });
        }).catch(error => {
          console.error("Error capturing tab:", error);
        });
      } catch (error) {
        console.error("Exception during tab capture:", error);
      }
    }, 50); // Small delay to ensure UI is fully hidden
  });
}