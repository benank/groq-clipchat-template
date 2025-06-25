<script lang="ts">
  import { onMount } from 'svelte';
  import { settings, saveSettings as saveSettingsToStore } from '../stores/settings';

  // Settings state bound to the store
  let apiKey = $state("");
  let selectedModel = $state("meta-llama/llama-4-19b-16e-instruct");
  let systemPrompt = $state("");
  let isSaved = $state(false);
  
  // AI model options - limited to Llama4, Maverick and Scout as requested
  const aiModels = [
    { value: "meta-llama/llama-4-scout-17b-16e-instruct", label: "Llama 4 Scout" },
    { value: "meta-llama/llama-4-maverick-17b-128e-instruct", label: "Llama 4 Maverick" }
  ];

  function saveSettings() {
    // Save to store which handles localStorage persistence
    saveSettingsToStore({
      apiKey,
      selectedModel,
      systemPrompt
    });
    
    isSaved = true;
    setTimeout(() => {
      isSaved = false;
    }, 2000);
  }

  onMount(() => {
    // Subscribe to the settings store
    const unsubscribe = settings.subscribe(value => {
      apiKey = value.apiKey;
      selectedModel = value.selectedModel;
      systemPrompt = value.systemPrompt;
    });

    // Return the unsubscribe function for cleanup
    return () => {
      unsubscribe();
    };
  });
</script>

<div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6 overflow-y-auto max-h-[calc(100vh-85px)]">
  <div class="space-y-6">
    <!-- Logo Section - Centered -->
    <div class="border-b pb-6 dark:border-gray-700 flex flex-col items-center">
      <div class="flex flex-col items-center gap-2 mb-2">
        <img src="/icons/clipchat_icon_256.png" alt="ClipChat Logo" class="w-16 h-16" />
        <h3 class="text-lg font-medium text-logo-purple dark:text-logo-purple">ClipChat</h3>
      </div>
      <p class="text-sm text-gray-500 dark:text-gray-400 text-center">Llama4 Multi-Modal • MIT Licensed • Powered by Groq</p>
    </div>
    
    <!-- API Key -->
    <div class="border-b pb-6 dark:border-gray-700">
      <h3 class="text-md font-medium mb-3 text-gray-700 dark:text-gray-300">API Configuration</h3>
      <div class="space-y-4">
        <div>
          <label for="api-key" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">API Key</label>
          <input 
            type="password" 
            id="api-key"
            class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-logo-purple focus:border-logo-purple dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            placeholder="Enter your API key"
            bind:value={apiKey}
          />
          <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Your API key will be stored securely</p>
        </div>
        
        <!-- AI Model Selection -->
        <div>
          <label for="ai-model" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">AI Model</label>
          <select 
            id="ai-model"
            class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-logo-purple focus:border-logo-purple dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            bind:value={selectedModel}
          >
            {#each aiModels as model}
              <option value={model.value}>{model.label}</option>
            {/each}
          </select>
          <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Select which AI model to use for chat</p>
        </div>
      </div>
    </div>
    
    <!-- System Prompt -->
    <div>
      <h3 class="text-md font-medium mb-3 text-gray-700 dark:text-gray-300">Advanced Settings</h3>
      <div>
        <label for="system-prompt" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">System Prompt</label>
        <textarea 
          id="system-prompt"
          rows="4"
          class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-logo-purple focus:border-logo-purple dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          placeholder="Add additional instructions for the AI..."
          bind:value={systemPrompt}
        ></textarea>
        <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Custom instructions that will be included with every chat</p>
      </div>
    </div>
    
    <!-- Save Button -->
    <div class="flex justify-end mt-6">
      <button 
        class="relative px-4 py-2 bg-logo-purple text-white rounded-md hover:bg-logo-purple/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-logo-purple transition dark:bg-logo-purple dark:hover:bg-logo-purple/90"
        onclick={saveSettings}
      >
        {#if isSaved}
          <span class="flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
            </svg>
            Saved!
          </span>
        {:else}
          Save Settings
        {/if}
      </button>
    </div>
  </div>
</div> 