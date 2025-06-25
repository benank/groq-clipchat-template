// Variables for selection box
let startX: number, startY: number, endX: number, endY: number;
let isSelecting = false;
let selectionBox: HTMLDivElement | null = null;
let overlay: HTMLDivElement | null = null;
let preloadedScreenshot: string | null = null;

// Flag to track if we've already sent the ready message
let readyMessageSent = false;

// Initialize on load
console.log("Content script loaded and ready");

// Selection area interface
interface SelectionArea {
  x: number;
  y: number;
  width: number;
  height: number;
  dpr: number;
  pageUrl: string;
  pageDomain: string;
  timestamp: number;
}

// Message interfaces
interface ReadyMessage {
  action: 'contentScriptReady';
}

interface SelectionCompleteMessage {
  action: 'selectionComplete';
  area: SelectionArea;
}

interface IncomingMessage {
  action: string;
  screenshot?: string;
}

// Signal to the background script that the content script is ready
function sendReadyMessage(): void {
  if (readyMessageSent) return;
  
  readyMessageSent = true;
  chrome.runtime.sendMessage({ action: 'contentScriptReady' } as ReadyMessage, (response) => {
    console.log("Content script initialization message sent");
  });
}

// Send the ready message immediately
sendReadyMessage();

// Also send it after a slight delay to ensure it happens after full initialization
setTimeout(sendReadyMessage, 100);

// Create the UI for region selection
function createSelectionUI(): void {
  // Create transparent overlay
  overlay = document.createElement('div');
  overlay.style.position = 'fixed';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.width = '100vw';
  overlay.style.height = '100vh';
  overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.3)';
  overlay.style.zIndex = '999999';
  overlay.style.cursor = 'crosshair';
  
  // Create selection box (initially not displayed)
  selectionBox = document.createElement('div');
  selectionBox.style.position = 'fixed';
  selectionBox.style.border = '2px dashed #fff';
  selectionBox.style.backgroundColor = 'rgba(148, 0, 211, 0.2)'; // Using logo-purple color
  selectionBox.style.zIndex = '1000000';
  selectionBox.style.display = 'none';
  
  // Add instructions text
  const instructions = document.createElement('div');
  instructions.textContent = 'Click and drag to select a region. Press ESC to cancel.';
  instructions.style.position = 'fixed';
  instructions.style.top = '10px';
  instructions.style.left = '50%';
  instructions.style.transform = 'translateX(-50%)';
  instructions.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
  instructions.style.color = 'white';
  instructions.style.padding = '8px 12px';
  instructions.style.borderRadius = '4px';
  instructions.style.zIndex = '1000001';
  instructions.style.fontFamily = 'Arial, sans-serif';
  
  // Add elements to the DOM
  document.body.appendChild(overlay);
  document.body.appendChild(selectionBox);
  document.body.appendChild(instructions);
  
  // Add event listeners
  overlay.addEventListener('mousedown', handleMouseDown);
  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);
  document.addEventListener('keydown', handleKeyDown);
}

// Mouse down handler - start selection
function handleMouseDown(e: MouseEvent): void {
  isSelecting = true;
  startX = e.clientX;
  startY = e.clientY;
  
  if (selectionBox) {
    selectionBox.style.left = startX + 'px';
    selectionBox.style.top = startY + 'px';
    selectionBox.style.width = '0';
    selectionBox.style.height = '0';
    selectionBox.style.display = 'block';
  }
}

// Mouse move handler - update selection box
function handleMouseMove(e: MouseEvent): void {
  if (!isSelecting || !selectionBox) return;
  
  endX = e.clientX;
  endY = e.clientY;
  
  // Calculate dimensions and position
  const width = Math.abs(endX - startX);
  const height = Math.abs(endY - startY);
  const left = Math.min(startX, endX);
  const top = Math.min(startY, endY);
  
  // Update selection box
  selectionBox.style.left = left + 'px';
  selectionBox.style.top = top + 'px';
  selectionBox.style.width = width + 'px';
  selectionBox.style.height = height + 'px';
}

// Mouse up handler - complete selection
function handleMouseUp(e: MouseEvent): void {
  if (!isSelecting) return;
  isSelecting = false;
  
  endX = e.clientX;
  endY = e.clientY;
  
  // Calculate the final dimensions
  const width = Math.abs(endX - startX);
  const height = Math.abs(endY - startY);
  
  // If selection is too small, ignore
  if (width < 10 || height < 10) {
    cleanupSelectionUI();
    return;
  }
  
  // Create selection area data
  const selectionArea: SelectionArea = {
    x: Math.min(startX, endX),
    y: Math.min(startY, endY),
    width: width,
    height: height,
    dpr: window.devicePixelRatio || 1,
    // Add page information
    pageUrl: window.location.href,
    pageDomain: window.location.hostname,
    timestamp: Date.now()
  };
  
  console.log("Selection complete, area:", selectionArea);
  
  // Hide UI immediately
  if (overlay) overlay.style.display = 'none';
  if (selectionBox) selectionBox.style.display = 'none';
  
  // Always clean up the UI after a short delay, regardless of messaging outcome
  setTimeout(cleanupSelectionUI, 500);
  
  // Send the selection area to the background script
  // We're not waiting for response as we've already scheduled cleanup
  try {
    chrome.runtime.sendMessage({
      action: 'selectionComplete',
      area: selectionArea
    }).catch(error => {
      console.error("Error sending selection data:", error);
    });
    console.log("Selection data sent to background script");
  } catch (error) {
    console.error("Exception sending selection data:", error);
    // UI cleanup is already scheduled via setTimeout
  }
}

// Handle key press (ESC to cancel)
function handleKeyDown(e: KeyboardEvent): void {
  if (e.key === 'Escape') {
    cleanupSelectionUI();
  }
}

// Clean up the selection UI
function cleanupSelectionUI(): void {
  // Clear the preloaded screenshot
  preloadedScreenshot = null;
  
  // Remove elements with proper cleanup
  if (overlay) {
    // First hide before removing to prevent visual artifacts during transitions
    overlay.style.opacity = '0';
    overlay.style.display = 'none';
    document.body.removeChild(overlay);
    overlay = null;
  }

  if (selectionBox) {
    selectionBox.style.opacity = '0';
    selectionBox.style.display = 'none';
    document.body.removeChild(selectionBox);
    selectionBox = null;
  }
  
  // Find and remove any other instruction elements
  const instructions = document.querySelector('div[style*="z-index: 1000001"]');
  if (instructions) {
    instructions.remove();
  }
  
  // Find and remove any other elements that might have been added
  document.querySelectorAll('div[style*="z-index: 99999"]').forEach(el => el.remove());
  
  // Remove event listeners
  document.removeEventListener('mousemove', handleMouseMove);
  document.removeEventListener('mouseup', handleMouseUp);
  document.removeEventListener('keydown', handleKeyDown);
  
  // Reset variables
  isSelecting = false;
}

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((message: IncomingMessage, sender, sendResponse) => {
  console.log("Content script received message:", message.action);
  
  // Respond to ping to verify the content script is running
  if (message.action === 'ping') {
    console.log("Received ping, responding");
    sendResponse({ success: true });
    return true; // Keep channel open for async response
  }
  
  // Start selection UI with or without a preloaded screenshot
  if (message.action === 'startSelection' || message.action === 'showSelectionUIWithScreenshot') {
    try {
      console.log("Starting selection UI");
      
      // If we got a screenshot, store it (not used for capture, just for future reference)
      if (message.screenshot) {
        console.log("Received screenshot reference (not used for capture)");
        preloadedScreenshot = message.screenshot;
      }
      
      // Make sure we clean up any existing UI first (in case of repeated attempts)
      cleanupSelectionUI();
      
      // Create selection UI
      createSelectionUI();
      
      sendResponse({ success: true });
    } catch (error) {
      console.error("Error creating selection UI:", error instanceof Error ? error.message : String(error));
      sendResponse({ success: false, error: error instanceof Error ? error.message : String(error) });
    }
    return false; // No async response needed
  }
  
  // Handle prepare for screenshot (hide UI elements)
  if (message.action === 'prepareForScreenshot') {
    console.log("Preparing for screenshot by hiding UI elements");
    
    // Completely hide selection UI elements for clean screenshot
    if (overlay) {
      overlay.style.opacity = '0';
      overlay.style.display = 'none';
      overlay.style.visibility = 'hidden';
    }
    
    if (selectionBox) {
      selectionBox.style.opacity = '0';
      selectionBox.style.display = 'none';
      selectionBox.style.visibility = 'hidden';
    }
    
    // Also hide any instruction or other related elements
    const instructions = document.querySelector('div[style*="z-index: 1000001"]');
    if (instructions) {
      (instructions as HTMLElement).style.display = 'none';
      (instructions as HTMLElement).style.visibility = 'hidden';
    }
    
    sendResponse({ success: true });
    return false;
  }
  
  // Always return false for non-async responses
  return false;
});
