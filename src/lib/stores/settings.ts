import { writable, get } from 'svelte/store';

// Define types for settings
interface Settings {
  apiKey: string;
  selectedModel: string;
  systemPrompt: string;
}

// Default model
const DEFAULT_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";

// Initialize settings from localStorage or use defaults
const initialSettings: Settings = {
  apiKey: typeof localStorage !== 'undefined' ? localStorage.getItem('clipchat_api_key') || '' : '',
  selectedModel: typeof localStorage !== 'undefined' ? localStorage.getItem('clipchat_model') || DEFAULT_MODEL : DEFAULT_MODEL,
  systemPrompt: typeof localStorage !== 'undefined' ? localStorage.getItem('clipchat_system_prompt') || '' : '',
};

// Create a writable store
export const settings = writable<Settings>(initialSettings);

// Function to save settings
export function saveSettings(newSettings: Settings): void {
  // Update the store
  settings.set(newSettings);
  
  // Persist to localStorage
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('clipchat_api_key', newSettings.apiKey);
    localStorage.setItem('clipchat_model', newSettings.selectedModel);
    localStorage.setItem('clipchat_system_prompt', newSettings.systemPrompt);
  }
}

// Function to update individual settings
export function updateSetting<K extends keyof Settings>(key: K, value: Settings[K]): void {
  settings.update(current => {
    const updated = { ...current, [key]: value };
    
    // Persist to localStorage
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(`clipchat_${key}`, value as string);
    }
    
    return updated;
  });
}

// Helper to get current settings synchronously
export function getCurrentSettings(): Settings {
  return get(settings);
} 