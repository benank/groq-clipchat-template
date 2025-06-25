<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  
  let { isActive = false } = $props();
  
  let startX = 0;
  let startY = 0;
  let endX = 0;
  let endY = 0;
  let isDragging = $state(false);
  let showInput = $state(false);
  let query = $state('');
  let fullScreenshot = $state<string | null>(null);
  
  const dispatch = createEventDispatcher();
  
  function handleMouseDown(event: MouseEvent) {
    if (!isActive) return;
    
    isDragging = true;
    startX = event.clientX;
    startY = event.clientY;
    endX = event.clientX;
    endY = event.clientY;
  }
  
  function handleMouseMove(event: MouseEvent) {
    if (!isDragging) return;
    
    endX = event.clientX;
    endY = event.clientY;
  }
  
  function handleMouseUp() {
    if (!isDragging) return;
    
    isDragging = false;
    
    // Only show input if selection has size
    const width = Math.abs(endX - startX);
    const height = Math.abs(endY - startY);
    
    if (width > 10 && height > 10) {
      showInput = true;
    } else {
      cancel();
    }
  }
  
  function cancel() {
    isDragging = false;
    showInput = false;
    fullScreenshot = null;
    dispatch('cancel');
  }
  
  function captureAndProcessScreenshot() {
    const minX = Math.min(startX, endX);
    const minY = Math.min(startY, endY);
    const width = Math.abs(endX - startX);
    const height = Math.abs(endY - startY);
    
    if (width < 10 || height < 10) return cancel();
    
    if (fullScreenshot) {
      cropScreenshot(fullScreenshot, minX, minY, width, height);
    } else {
      // Get screenshot via the background script
      captureTabScreenshot(minX, minY, width, height);
    }
  }
  
  async function captureTabScreenshot(minX: number, minY: number, width: number, height: number) {
    try {
      // Use chrome.runtime.sendMessage to send a message to the background script
      // @ts-ignore - Chrome API is not recognized by TypeScript
      const chrome = (window as any).chrome;
      if (!chrome || !chrome.runtime) {
        console.error('Chrome runtime not available');
        cancel();
        return;
      }
      
      chrome.runtime.sendMessage(
        { action: 'captureTab' },
        (response: { dataUrl: string }) => {
          if (chrome.runtime.lastError) {
            console.error('Error capturing screenshot:', chrome.runtime.lastError);
            cancel();
            return;
          }
          
          if (response && response.dataUrl) {
            cropScreenshot(response.dataUrl, minX, minY, width, height);
          } else {
            console.error('No screenshot data received');
            cancel();
          }
        }
      );
    } catch (err) {
      console.error('Error with screenshot capture:', err);
      cancel();
    }
  }
  
  function cropScreenshot(dataUrl: string, minX: number, minY: number, width: number, height: number) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = function() {
      canvas.width = width;
      canvas.height = height;
      ctx?.drawImage(img, minX, minY, width, height, 0, 0, width, height);
      
      const croppedImageData = canvas.toDataURL('image/png');
      dispatch('capture', { image: croppedImageData, query });
      
      // Reset state
      showInput = false;
      query = '';
      fullScreenshot = null;
    };
    
    img.src = dataUrl;
  }
  
  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      cancel();
    } else if (event.key === 'Enter' && query.trim()) {
      captureAndProcessScreenshot();
    }
  }

  onMount(() => {
    if (isActive) {
      // When activated, immediately try to get a screenshot of the full page
      try {
        // @ts-ignore - Chrome API is not recognized by TypeScript
        const chrome = (window as any).chrome;
        if (chrome && chrome.runtime) {
          chrome.runtime.sendMessage(
            { action: 'captureTab' },
            (response: { dataUrl: string }) => {
              if (response && response.dataUrl) {
                fullScreenshot = response.dataUrl;
              }
            }
          );
        }
      } catch (err) {
        console.error('Error getting full screenshot:', err);
      }
    }
    
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  });
</script>

{#if isActive}
  <div 
    class="fixed inset-0 bg-black bg-opacity-30 z-50 cursor-crosshair"
    on:mousedown={handleMouseDown}
    on:mousemove={handleMouseMove}
    on:mouseup={handleMouseUp}
  >
    {#if isDragging}
      <div 
        class="absolute border-2 border-logo-purple bg-logo-purple bg-opacity-20"
        style="
          left: {Math.min(startX, endX)}px;
          top: {Math.min(startY, endY)}px;
          width: {Math.abs(endX - startX)}px;
          height: {Math.abs(endY - startY)}px;
        "
      ></div>
    {/if}
    
    {#if showInput}
      <div 
        class="fixed bg-white dark:bg-gray-800 rounded-full shadow-lg px-4 py-2 flex items-center"
        style="
          left: {Math.min(startX, endX) + Math.abs(endX - startX) / 2}px;
          top: {Math.max(startY, endY) + 20}px;
          transform: translateX(-50%);
        "
      >
        <input
          type="text"
          class="bg-transparent border-none outline-none flex-1 min-w-[300px]"
          placeholder="Ask about this screenshot..."
          bind:value={query}
          autofocus
        />
        <button 
          class="ml-2 bg-logo-purple text-white px-3 py-1 rounded-full text-sm font-medium"
          on:click={captureAndProcessScreenshot}
          disabled={!query.trim()}
        >
          Send
        </button>
        <button 
          class="ml-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          on:click={cancel}
        >
          Cancel
        </button>
      </div>
    {/if}
  </div>
{/if} 