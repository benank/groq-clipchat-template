import { writable, get } from 'svelte/store';

type Theme = 'light' | 'dark';

// Initialize theme from localStorage or default to light
const storedTheme = typeof localStorage !== 'undefined' 
  ? localStorage.getItem('clipchat-theme') as Theme || 'light'
  : 'light';

export const theme = writable<Theme>(storedTheme);

// Apply the theme to both data-theme and the HTML class for Tailwind dark mode
export function initializeTheme(): void {
  const currentTheme = get(theme);
  
  // Apply to data-theme element for daisyUI
  const root = document.querySelector('div[data-theme]');
  if (root) {
    root.setAttribute('data-theme', currentTheme);
  }
  
  // Apply to HTML for Tailwind dark mode
  if (currentTheme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}

export function toggleTheme(): void {
  theme.update(current => {
    const newTheme: Theme = current === 'light' ? 'dark' : 'light';
    
    // Save to localStorage
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('clipchat-theme', newTheme);
    }
    
    // Apply to data-theme element for daisyUI
    const root = document.querySelector('div[data-theme]');
    if (root) {
      root.setAttribute('data-theme', newTheme);
    }
    
    // Apply to HTML for Tailwind dark mode
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    
    return newTheme;
  });
}