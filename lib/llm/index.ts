import 'server-only';

import { appEnv, isLlmConfigured } from '@/lib/env';
import {
  createGroqChatCompletion as groqCreate,
  createGroqQuizCompletion as groqQuizCreate,
} from '@/lib/groq/chat';
import { createCopilotChatCompletion } from '@/lib/llm/copilot';

/**
 * Unified LLM provider abstraction
 * Routes to Groq or Copilot proxy based on LLM_PROVIDER env var
 */

export interface UnifiedChatCompletion {
  choices: Array<{
    message: {
      content: string;
      role: string;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Create a chat completion using the configured LLM provider
 */
export async function createChatCompletion(
  args: {
    messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
    temperature?: number;
    max_tokens?: number;
    top_p?: number;
  },
  onStatus?: (message: string) => void,
): Promise<UnifiedChatCompletion> {
  if (!isLlmConfigured()) {
    const provider = appEnv.llmProvider;
    throw new Error(
      `${provider === 'copilot' ? 'Copilot proxy' : 'Groq'} is not configured. ` +
        `Add required environment variables and set LLM_PROVIDER="${provider}".`,
    );
  }

  if (appEnv.llmProvider === 'copilot') {
    return await createCopilotChatCompletion(args, onStatus);
  }

  // Default to Groq
  // Convert our unified format to Groq format
  const groqArgs = {
    messages: args.messages,
    temperature: args.temperature,
    max_tokens: args.max_tokens,
    top_p: args.top_p,
  };

  const groqResponse = (await groqCreate(groqArgs, onStatus)) as any;

  // Normalize response to unified format
  return {
    choices: groqResponse.choices.map((choice: any) => ({
      message: {
        content: choice.message?.content || '',
        role: choice.message?.role || 'assistant',
      },
      finish_reason: choice.finish_reason,
    })),
    usage: groqResponse.usage,
  };
}

/**
 * Create a quiz completion (used during quiz generation)
 * This is optimized for quiz generation tasks
 */
export async function createQuizCompletion(args: {
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  response_format?: { type: 'json_object' };
}): Promise<UnifiedChatCompletion> {
  if (!isLlmConfigured()) {
    const provider = appEnv.llmProvider;
    throw new Error(
      `${provider === 'copilot' ? 'Copilot proxy' : 'Groq'} is not configured for quiz generation.`,
    );
  }

  if (appEnv.llmProvider === 'copilot') {
    // Copilot proxy - use regular completion for quiz generation
    const { response_format: _rf, ...copilotArgs } = args;
    return await createCopilotChatCompletion(copilotArgs);
  }

  // Default to Groq - use quiz-optimized client
  const groqResponse = (await groqQuizCreate(args)) as any;

  // Normalize response to unified format
  return {
    choices: groqResponse.choices.map((choice: any) => ({
      message: {
        content: choice.message?.content || '',
        role: choice.message?.role || 'assistant',
      },
      finish_reason: choice.finish_reason,
    })),
    usage: groqResponse.usage,
  };
}

/**
 * Get the current LLM provider name
 */
export function getCurrentLlmProvider(): string {
  return appEnv.llmProvider === 'copilot' ? 'Copilot Proxy' : 'Groq';
}

/**
 * Check if LLM is properly configured
 */
export function isLlmReady(): boolean {
  return isLlmConfigured();
}
