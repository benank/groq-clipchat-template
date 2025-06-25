import { Groq } from 'groq-sdk';
import { getCurrentSettings } from '../stores/settings';

// Define types compatible with Groq SDK
export type Role = 'user' | 'assistant' | 'system';

export interface TextContent {
  type: 'text';
  text: string;
}

export interface ImageContent {
  type: 'image_url';
  image_url: {
    url: string;
  };
}

export type MessageContent = TextContent | ImageContent;

export interface Message {
  role: Role;
  content: string | MessageContent[];
}

// Response type
export interface ChatResponse {
  content: string;
  error?: string;
}

/**
 * Creates a Groq client instance with the current API key
 */
function createGroqClient(): Groq {
  const { apiKey } = getCurrentSettings();
  
  if (!apiKey) {
    throw new Error('No API key provided. Please set your Groq API key in Settings.');
  }
  
  return new Groq({
    apiKey,
    dangerouslyAllowBrowser: true,
  });
}

/**
 * Send a chat completion request to Groq API
 */
export async function sendChatRequest(messages: Message[]): Promise<ChatResponse> {
  try {
    const { selectedModel, systemPrompt } = getCurrentSettings();
    
    // Create a new instance of Groq with the current API key
    const groq = createGroqClient();
    
    // Add system prompt if provided
    const allMessages = [...messages];
    if (systemPrompt && systemPrompt.trim() !== '') {
      allMessages.unshift({
        role: 'system',
        content: systemPrompt
      });
    }
    
    // Send the request - cast the messages to any to bypass type checking
    // The Groq SDK types don't perfectly match our Message type
    const chatCompletion = await groq.chat.completions.create({
      messages: allMessages as any,
      model: selectedModel,
      temperature: 0.7,
      max_completion_tokens: 1024,
      top_p: 1,
      stream: false
    });
    
    return {
      content: chatCompletion.choices[0].message.content || ''
    };
  } catch (error) {
    console.error('Error communicating with Groq API:', error);
    return {
      content: '',
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
} 