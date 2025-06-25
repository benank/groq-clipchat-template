<script lang="ts">
  import { onMount } from "svelte";
  import { theme, initializeTheme } from "./lib/stores/theme";
  import ThemeToggle from "./lib/components/ThemeToggle.svelte";
  import MainContent from "./lib/components/MainContent.svelte";
  import Settings from "./lib/components/Settings.svelte";

  onMount(() => {
    initializeTheme();
  });

  let activeTab = $state("Chat");
  
  function setTabToChat() {
    activeTab = "Chat";
  }
  
  function setTabToSettings() {
    activeTab = "Settings";
  }
</script>

<div class="h-screen bg-[#f5f1ff] dark:bg-gray-900 flex flex-col" data-theme={$theme}>
  <!-- Top Navigation Bar -->
  <header class="px-4 py-2 bg-white dark:bg-gray-800 shadow-sm">
    <div class="flex items-center">
      <div class="flex items-center gap-1">
        <img src="/icons/clipchat_icon_256.png" alt="ClipChat Logo" class="w-5 h-5" />
        <span class="text-base font-medium text-logo-purple dark:text-logo-purple">ClipChat</span>
      </div>
      <nav class="ml-6">
        <ul class="flex gap-6">
          <li>
            <button 
              class="px-2 py-1 text-sm {activeTab === 'Chat' ? 'border-b-2 border-logo-purple text-logo-purple dark:border-logo-purple dark:text-logo-purple' : 'text-gray-500 dark:text-gray-400'}"
              onclick={setTabToChat}
            >
              Chat
            </button>
          </li>
          <li>
            <button 
              class="px-2 py-1 text-sm {activeTab === 'Settings' ? 'border-b-2 border-logo-purple text-logo-purple dark:border-logo-purple dark:text-logo-purple' : 'text-gray-500 dark:text-gray-400'}"
              onclick={setTabToSettings}
            >
              Settings
            </button>
          </li>
        </ul>
      </nav>
      <div class="ml-auto">
        <ThemeToggle />
      </div>
    </div>
  </header>

  <!-- Main Content -->
  <main class="flex-1 p-0 overflow-hidden">
    <div style="display: {activeTab === 'Chat' ? 'block' : 'none'}; height: 100%;">
      <MainContent />
    </div>
    <div style="display: {activeTab === 'Settings' ? 'block' : 'none'}; height: 100%;">
      <Settings />
    </div>
  </main>

  <!-- Footer -->
  <footer class="py-1 text-center bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
    <img 
      src={$theme === 'dark' ? '/icons/groqlabs_logo-white-oran.png' : '/icons/groqlabs_logo.png'} 
      alt="GroqLabs Logo" 
      class="h-5 mx-auto" 
    />
  </footer>
</div>
