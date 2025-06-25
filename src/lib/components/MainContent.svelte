<script lang="ts">
  import { onMount } from 'svelte';
  import { settings } from '../stores/settings';
  import { sendChatRequest, type Message } from '../services/groq';

  // Define content part types
  type TextContent = {
    type: 'text';
    text: string;
  };
  
  type ImageContent = {
    type: 'image_url';
    image_url: {
      url: string;
    };
  };
  
  type ContentPart = TextContent | ImageContent;

  // Chrome extension API type declarations
  interface ChromeRuntime {
    sendMessage: (message: any, callback?: (response: any) => void) => void;
    onMessage: {
      addListener: (callback: (message: any, sender: any, sendResponse: any) => boolean | void) => void;
    };
    lastError?: {
      message: string;
    };
  }
  
  interface ChromeTabs {
    query: (queryInfo: {active: boolean, currentWindow: boolean}, callback: (tabs: any[]) => void) => void;
    captureVisibleTab: (windowId: number | null, options: {format: string}, callback: (dataUrl: string) => void) => void;
    sendMessage: (tabId: number, message: any, callback?: (response: any) => void) => void;
  }
  
  interface ChromeScripting {
    executeScript: (details: {target: {tabId: number}, files?: string[], func?: Function, args?: any[]}) => Promise<any[]>;
  }
  
  interface Chrome {
    runtime: ChromeRuntime;
    tabs: ChromeTabs;
    scripting: ChromeScripting;
  }
  
  // Type declaration for global chrome variable
  const chrome = (window as any).chrome as Chrome;
  
  // Crop area type
  interface CropArea {
    x: number;
    y: number;
    width: number;
    height: number;
    dpr: number;
    pageUrl?: string;
    pageDomain?: string;
  }

  let message = $state("");
  let messages = $state<Message[]>([]);
  
  let chatContainer: HTMLDivElement | null = null;
  let isNewChat = $state(false);
  let isHoveringNewChat = $state(false);
  let isLoading = $state(false);
  let errorMessage = $state("");
  let attachedImage = $state<string | null>(null);
  let isHoveringAttachedImage = $state(false);
  let cropAreaInfo = $state<CropArea | null>(null);

  async function sendMessage() {
    if (message.trim() || attachedImage) {
      // Check if API key is available
      if (!$settings.apiKey) {
        errorMessage = "Please set your API key in Settings first";
        return;
      }

      // Handle image + text message
      if (attachedImage && cropAreaInfo) {
        sendMessageWithImage(message || "What's in this image?", attachedImage);
        attachedImage = null;
        cropAreaInfo = null;
        message = "";
        return;
      }

      // Handle text-only message
      const userMessage: Message = {
        role: 'user',
        content: message.trim()
      };
      
      messages = [...messages, userMessage];
      message = "";
      isLoading = true;
      errorMessage = "";
      
      try {
        // Send message to Groq API
        const messagesForAPI = messages.filter(msg => msg.role === 'user' || msg.role === 'assistant');
        const response = await sendChatRequest(messagesForAPI);
        
        if (response.error) {
          errorMessage = response.error;
          return;
        }
        
        // Add AI response to the chat
        const aiResponse: Message = {
          role: 'assistant',
          content: response.content
        };
        
        messages = [...messages, aiResponse];
      } catch (error) {
        console.error('Error sending message:', error);
        errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      } finally {
        isLoading = false;
      }
    }
  }
  
  function startNewChat() {
    messages = [];
    isNewChat = true;
    errorMessage = "";
    attachedImage = null;
    cropAreaInfo = null;
  }
  
  // Direct screenshot function that takes the entire tab screenshot without prompt
  function directCaptureScreenshot() {
    chrome.tabs.query({active: true, currentWindow: true}, async function(tabs) {
      if (!tabs || tabs.length === 0) {
        errorMessage = "No active tab found";
        return;
      }
      
      const activeTab = tabs[0];
      
      // Check if the tab is a restricted URL (chrome://, edge://, etc.)
      if (activeTab.url.startsWith('chrome://') || 
          activeTab.url.startsWith('edge://') || 
          activeTab.url.startsWith('brave://') || 
          activeTab.url.startsWith('about:') ||
          activeTab.url.startsWith('chrome-extension://')) {
        errorMessage = "Cannot capture screenshots of browser pages. Please navigate to a website first.";
        return;
      }
      
      try {
        // Execute a function directly in the tab context
        const results = await chrome.scripting.executeScript({
          target: {tabId: activeTab.id},
          func: () => {
            return {
              width: window.innerWidth,
              height: window.innerHeight,
              dpr: window.devicePixelRatio || 1,
              url: window.location.href
            };
          }
        });
        
        if (!results || results.length === 0) {
          errorMessage = "Could not get tab dimensions";
          return;
        }
        
        const dimensions = results[0].result;
        
        // Now capture the full tab
        chrome.tabs.captureVisibleTab(null, {format: 'png'}, function(dataUrl) {
          if (chrome.runtime.lastError) {
            errorMessage = `Screenshot error: ${chrome.runtime.lastError.message}`;
            return;
          }
          
          // Store the screenshot and crop info without displaying a prompt
          const fullCropArea = {
            x: 0,
            y: 0,
            width: dimensions.width,
            height: dimensions.height,
            dpr: dimensions.dpr,
            pageUrl: dimensions.url
          };
          
          // Process the cropped image and attach it to the message input
          cropImage(dataUrl, fullCropArea).then(croppedImage => {
            attachedImage = croppedImage;
            cropAreaInfo = fullCropArea;
          }).catch(error => {
            console.error('Error processing screenshot:', error);
            errorMessage = `Screenshot processing error: ${error instanceof Error ? error.message : String(error)}`;
          });
        });
      } catch (err) {
        if (err instanceof Error && err.message.includes("Cannot access contents of the page")) {
          errorMessage = "Cannot capture screenshots of this page due to security restrictions. Please try a different website.";
        } else {
          errorMessage = `Screenshot error: ${err instanceof Error ? err.message : String(err)}`;
        }
        console.error("Error in direct screenshot:", err);
      }
    });
  }
  
  // Function to capture a selected region using the content script
  function captureSelectedRegion() {
    chrome.tabs.query({active: true, currentWindow: true}, async function(tabs) {
      if (!tabs || tabs.length === 0) {
        errorMessage = "No active tab found";
        return;
      }
      
      const activeTab = tabs[0];
      
      // Check if the tab is a restricted URL (chrome://, edge://, etc.)
      if (activeTab.url.startsWith('chrome://') || 
          activeTab.url.startsWith('edge://') || 
          activeTab.url.startsWith('brave://') || 
          activeTab.url.startsWith('about:') ||
          activeTab.url.startsWith('chrome-extension://')) {
        errorMessage = "Cannot capture screenshots of browser pages. Please navigate to a website first.";
        return;
      }
      
      try {
        // First, ensure we have proper access to the tab by executing a simple script
        await chrome.scripting.executeScript({
          target: {tabId: activeTab.id},
          func: () => {
            return { status: "OK" };
          }
        });
        
        // First capture the full screenshot, which we'll pass to the content script
        chrome.tabs.captureVisibleTab(null, {format: 'png'}, function(dataUrl) {
          if (chrome.runtime.lastError) {
            errorMessage = `Screenshot error: ${chrome.runtime.lastError.message}`;
            return;
          }
          
          // Function to send the selection UI message with retry logic
          const showSelectionUI = (retryCount = 2) => {
            console.log(`Attempting to show selection UI (attempts left: ${retryCount})`);
            
            // Now directly inject and communicate with the content script
            chrome.scripting.executeScript({
              target: {tabId: activeTab.id},
              files: ['content-script.js']
            }).then(() => {
              // Give a small delay to ensure content script is loaded
              setTimeout(() => {
                // Send the screenshot to the content script for selection
                chrome.tabs.sendMessage(activeTab.id, {
                  action: 'showSelectionUIWithScreenshot',
                  screenshot: dataUrl
                }, (response) => {
                  if (chrome.runtime.lastError || !response || !response.success) {
                    const error = chrome.runtime.lastError 
                      ? chrome.runtime.lastError.message 
                      : 'Failed to show selection UI';
                    
                    console.error(`Error showing selection UI (attempt ${3-retryCount}/3):`, error);
                    
                    if (retryCount > 0) {
                      // Try again with a longer delay
                      setTimeout(() => showSelectionUI(retryCount - 1), 500);
                    } else {
                      // All retries failed
                      errorMessage = `Region selection failed: ${error}`;
                    }
                  } else {
                    console.log('Selection UI shown successfully');
                  }
                });
              }, 300);
            }).catch(err => {
              console.error("Error injecting content script:", err);
              
              if (retryCount > 0) {
                // Try again with a longer delay
                setTimeout(() => showSelectionUI(retryCount - 1), 500);
              } else {
                errorMessage = `Region selection failed: ${err.message}`;
              }
            });
          };
          
          // Start the process with initial retry count
          showSelectionUI();
        });
      } catch (err) {
        errorMessage = `Region selection error: ${err instanceof Error ? err.message : String(err)}`;
        console.error("Error initiating region selection:", err);
      }
    });
  }
  
  // Listen for screenshotCaptured message from the background script
  chrome.runtime.onMessage.addListener((msgEvent: {action: string, imageData?: string, cropArea?: CropArea, prompt?: string}, 
                                       sender: any, 
                                       sendResponse: (response: {success: boolean}) => void) => {
    if (msgEvent.action === 'screenshotCaptured') {
      console.log('Screenshot captured, processing');
      
      // Process the captured screenshot
      if (msgEvent.imageData && msgEvent.cropArea) {
        // Instead of processing with a prompt, just attach it to the input
        cropImage(msgEvent.imageData, msgEvent.cropArea).then(croppedImage => {
          attachedImage = croppedImage;
          cropAreaInfo = msgEvent.cropArea || null;
          
          // If a prompt was provided with the screenshot, put it in the message input
          if (msgEvent.prompt) {
            // Set the message input field with the prompt that came with the screenshot
            message = msgEvent.prompt;
          }
          
          // Ensure the UI is updated
          setTimeout(() => {
            console.log('Screenshot attached, ready for chat');
          }, 100);
        }).catch(error => {
          console.error('Error processing screenshot:', error);
          errorMessage = `Screenshot processing error: ${error instanceof Error ? error.message : String(error)}`;
        });
      } else {
        console.error('Screenshot data missing required fields:', msgEvent);
        errorMessage = "Screenshot data incomplete";
      }
      
      // Send response back
      sendResponse({ success: true });
      return true;
    }
    
    return false; // Let other handlers process unhandled messages
  });
  
  function removeAttachedImage() {
    attachedImage = null;
    cropAreaInfo = null;
  }
  
  function handleAttachedImageMouseEnter() {
    isHoveringAttachedImage = true;
  }
  
  function handleAttachedImageMouseLeave() {
    isHoveringAttachedImage = false;
  }
  
  // Helper function to crop an image
  function cropImage(imageUrl: string, cropArea: CropArea): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        const img = new Image();
        
        img.onload = function() {
          try {
            console.log('Image loaded, dimensions:', img.width, 'x', img.height);
            console.log('Crop area:', cropArea);
            
            const canvas = document.createElement('canvas');
            // Get device pixel ratio, defaulting to 1 if not provided
            const dpr = cropArea.dpr || window.devicePixelRatio || 1;
            console.log('Using device pixel ratio:', dpr);
            
            // Set canvas size to the crop dimensions
            canvas.width = cropArea.width;
            canvas.height = cropArea.height;
            
            const ctx = canvas.getContext('2d');
            
            // Draw only the selected portion of the image
            // Apply DPR to correctly scale crop coordinates
            ctx?.drawImage(
              img,
              cropArea.x * dpr,             // Source X adjusted for DPR
              cropArea.y * dpr,             // Source Y adjusted for DPR
              cropArea.width * dpr,         // Source width adjusted for DPR
              cropArea.height * dpr,        // Source height adjusted for DPR
              0, 0,                         // Destination X, Y (0,0 for the canvas)
              cropArea.width,               // Destination width
              cropArea.height               // Destination height
            );
            
            const croppedImageUrl = canvas.toDataURL('image/png');
            resolve(croppedImageUrl);
          } catch (err) {
            console.error('Error drawing image on canvas:', err);
            reject(err);
          }
        };
        
        img.onerror = function(err) {
          console.error('Error loading image for cropping:', err);
          reject(new Error('Failed to load image for cropping'));
        };
        
        img.src = imageUrl;
      } catch (error) {
        console.error('Error in cropImage:', error);
        reject(error);
      }
    });
  }
  
  // Send a message with an image
  async function sendMessageWithImage(promptText: string, imageData: string) {
    // Check if API key is available
    if (!$settings.apiKey) {
      errorMessage = "Please set your API key in Settings first";
      return;
    }
    
    if (!promptText || !promptText.trim()) {
      // Use a default prompt if none provided
      promptText = "What's in this image?";
    }
    
    // Add the screenshot and query as a message
    const userMessage: Message = {
      role: 'user',
      content: [
        {
          type: 'text',
          text: promptText
        },
        {
          type: 'image_url',
          image_url: {
            url: imageData
          }
        }
      ] as ContentPart[]
    };
    
    messages = [...messages, userMessage];
    isLoading = true;
    errorMessage = "";
    
    // Process the message with the image
    try {
      // Send message to Groq API
      const messagesForAPI = messages.filter(msg => msg.role === 'user' || msg.role === 'assistant');
      const response = await sendChatRequest(messagesForAPI);
      
      if (response.error) {
        errorMessage = response.error;
        return;
      }
      
      // Add AI response to the chat
      const aiResponse: Message = {
        role: 'assistant',
        content: response.content
      };
      
      messages = [...messages, aiResponse];
    } catch (error) {
      console.error('Error sending message with image:', error);
      errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    } finally {
      isLoading = false;
    }
  }

  function handleMouseEnter() {
    isHoveringNewChat = true;
  }

  function handleMouseLeave() {
    isHoveringNewChat = false;
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      sendMessage();
    }
  }

  onMount(() => {
    scrollToBottom();
  });
  
  function scrollToBottom() {
    if (chatContainer && chatContainer.scrollHeight) {
      setTimeout(() => {
        if (chatContainer) {
          chatContainer.scrollTop = chatContainer.scrollHeight;
        }
      }, 0);
    }
  }
  
  $effect(() => {
    // Auto-scroll when messages change
    if (messages.length) scrollToBottom();
  });
</script>

<div class="flex flex-col h-full">
  <!-- Chat Messages Container - Full height, relative positioning -->
  <div class="bg-white dark:bg-gray-800 rounded-lg shadow flex-1 flex flex-col relative h-full">
    <!-- New Chat Button - Semi-transparent, becomes opaque on hover -->
    <div 
      class="absolute top-3 left-3 z-10"
      onmouseenter={handleMouseEnter}
      onmouseleave={handleMouseLeave}
      role="region"
      aria-label="New chat controls"
    >
      <button 
        class="bg-logo-purple dark:bg-logo-purple text-white p-2 rounded-full hover:bg-logo-purple hover:shadow-lg transition-all duration-200"
        style="opacity: {isHoveringNewChat ? '1' : '0.7'};"
        onclick={startNewChat}
        title="New Chat"
        aria-label="Start a new chat"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" />
        </svg>
      </button>
      <div 
        class="absolute left-full ml-2 top-1/2 -translate-y-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap transition-opacity duration-200"
        style="opacity: {isHoveringNewChat ? '1' : '0'};"
      >
        New Chat
      </div>
    </div>
    
    <!-- Scrollable Message Area with proper height calculation -->
    <div 
      class="flex-1 overflow-y-auto p-4 pb-20" 
      bind:this={chatContainer}
      style="max-height: calc(100% - 60px);"
    >
      {#if messages.length === 0}
        <div class="flex items-center justify-center h-full">
          <div class="text-center text-gray-500 dark:text-gray-400">
            <p>Start a new conversation</p>
            <p class="text-sm mt-2">Your messages will appear here</p>
          </div>
        </div>
      {:else}
        {#each messages as msg}
          <div class="mb-4 flex {msg.role === 'user' ? 'justify-end' : 'justify-start'}">
            <div class="{msg.role === 'user' ? 'bg-logo-purple dark:bg-logo-purple text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white'} rounded-xl p-3 max-w-[80%] break-words">
              {#if typeof msg.content === 'string'}
                {msg.content}
              {:else}
                {#each msg.content as contentPart}
                  {#if contentPart.type === 'text'}
                    <div>{contentPart.text}</div>
                  {:else if contentPart.type === 'image_url'}
                    <div class="mt-2">
                      <img src={contentPart.image_url.url} alt="Screenshot" class="rounded-lg max-w-full max-h-64" />
                    </div>
                  {/if}
                {/each}
              {/if}
            </div>
          </div>
        {/each}
        
        {#if isLoading}
          <div class="flex justify-start mb-4">
            <div class="bg-gray-100 dark:bg-gray-700 rounded-xl p-3 flex items-center gap-2">
              <div class="flex gap-1">
                <div class="w-2 h-2 bg-logo-purple dark:bg-logo-purple rounded-full animate-bounce" style="animation-delay: 0ms"></div>
                <div class="w-2 h-2 bg-logo-purple dark:bg-logo-purple rounded-full animate-bounce" style="animation-delay: 200ms"></div>
                <div class="w-2 h-2 bg-logo-purple dark:bg-logo-purple rounded-full animate-bounce" style="animation-delay: 400ms"></div>
              </div>
              <span class="text-sm text-gray-600 dark:text-gray-300"></span>
            </div>
          </div>
        {/if}
        
        {#if errorMessage}
          <div class="flex justify-center mb-4">
            <div class="bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 rounded-xl p-3 max-w-[80%] break-words">
              <p class="text-sm font-medium">Error: {errorMessage}</p>
            </div>
          </div>
        {/if}
      {/if}
    </div>
    
    <!-- Fixed Chat Input - Fixed positioning to ensure visibility -->
    <div class="absolute bottom-0 left-0 right-0 p-3 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 shadow-md z-10">
      <!-- Attached Image Preview -->
      {#if attachedImage}
        <div 
          class="relative mb-2 inline-block"
          onmouseenter={handleAttachedImageMouseEnter}
          onmouseleave={handleAttachedImageMouseLeave}
        >
          <div class="relative bg-gray-200 dark:bg-gray-700 rounded-lg p-1 inline-flex items-center">
            <img src={attachedImage} alt="Attached screenshot" class="h-16 rounded-lg object-contain" />
            
            <!-- Remove button -->
            <button 
              class="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center shadow-md transition-opacity duration-200"
              style="opacity: {isHoveringAttachedImage ? '1' : '0.7'};"
              onclick={removeAttachedImage}
              aria-label="Remove attached image"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
              </svg>
            </button>
            
            <span class="ml-1 text-xs text-gray-600 dark:text-gray-300">Type your question about this image</span>
          </div>
        </div>
      {/if}
      
      <div class="flex gap-2 items-center">
        <input 
          type="text" 
          class="flex-1 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          placeholder={attachedImage ? "Ask about this image..." : "Type your message..."}
          bind:value={message}
          onkeydown={handleKeyDown}
          disabled={isLoading}
        />
        
        <!-- Region Selection Button -->
        <button 
          class="bg-white dark:bg-gray-700 text-logo-purple dark:text-logo-purple p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-600 transition border border-logo-purple dark:border-logo-purple"
          onclick={captureSelectedRegion}
          title="Select a region to screenshot"
          aria-label="Select a region of the screen for your question"
          disabled={isLoading || attachedImage !== null}
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v12a1 1 0 01-1 1H4a1 1 0 01-1-1V3zm2 2v8h10V5H5z" clip-rule="evenodd" />
            <path d="M7 7h6v6H7V7z" />
          </svg>
        </button>
        
        <!-- Screenshot Button -->
        <button 
          class="bg-white dark:bg-gray-700 text-logo-purple dark:text-logo-purple p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-600 transition border border-logo-purple dark:border-logo-purple"
          onclick={directCaptureScreenshot}
          title="Take a screenshot"
          aria-label="Take a screenshot for your question"
          disabled={isLoading || attachedImage !== null}
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M4 5a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V7a2 2 0 00-2-2h-1.586a1 1 0 01-.707-.293l-1.121-1.121A2 2 0 0011.172 3H8.828a2 2 0 00-1.414.586L6.293 4.707A1 1 0 015.586 5H4zm6 9a3 3 0 100-6 3 3 0 000 6z" clip-rule="evenodd" />
          </svg>
        </button>
        
        <!-- Send Button -->
        <button 
          class="bg-logo-purple dark:bg-logo-purple text-white p-2 rounded-full hover:bg-logo-purple/90 dark:hover:bg-logo-purple/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
          onclick={sendMessage}
          disabled={(message.trim() === "" && !attachedImage) || isLoading}
          aria-label="Send message"
        >
          {#if isLoading}
            <svg class="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          {:else}
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
            </svg>
          {/if}
        </button>
      </div>
    </div>
  </div>
</div>
