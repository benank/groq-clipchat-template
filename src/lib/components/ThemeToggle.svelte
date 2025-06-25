<script lang="ts">
  import { theme, toggleTheme } from "../stores/theme";
</script>

<button class="p-1 rounded-md hover:bg-gray-100" onclick={toggleTheme}>
  {#if $theme === "light"}
    <svg
      xmlns="http://www.w3.org/2000/svg"
      class="h-5 w-5 text-gray-500"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
        d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
      />
    </svg>
  {:else}
    <svg
      xmlns="http://www.w3.org/2000/svg"
      class="h-5 w-5 text-gray-500"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
        d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707"
      />
    </svg>
  {/if}
</button>
