import 'server-only';

import { appEnv } from '@/lib/env';
import { getLlmRuntimeSecrets } from '@/lib/llm/runtime-config';
import { sleep } from '@/lib/utils';

/**
 * Copilot Proxy LLM provider
 * Uses GitHub Copilot proxy with a token for chat completions
 */

const REQUEST_TIMEOUT = 120_000; // 2 minutes

interface CopilotMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface CopilotChatRequest {
  model?: string;
  messages: CopilotMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  stream?: boolean;
}

interface CopilotChatResponse {
  choices: Array<{
    message: {
      content: unknown;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

function normalizeCopilotContent(content: unknown): string {
  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part;
        if (part && typeof part === 'object') {
          const record = part as Record<string, unknown>;
          if (typeof record.text === 'string') return record.text;
          if (record.type === 'text' && typeof record.content === 'string') return record.content;
        }
        return '';
      })
      .join('');
  }

  if (content && typeof content === 'object') {
    const record = content as Record<string, unknown>;
    if (typeof record.text === 'string') return record.text;
    if (typeof record.content === 'string') return record.content;
  }

  return '';
}

function isRateLimitError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.message.includes('429') || error.message.toLowerCase().includes('rate limit');
}

/**
 * Create a chat completion using Copilot Proxy
 */
export async function createCopilotChatCompletion(
  args: {
    messages: CopilotMessage[];
    temperature?: number;
    max_tokens?: number;
    top_p?: number;
    model?: string;
  },
  onStatus?: (message: string) => void,
) {
  const secrets = await getLlmRuntimeSecrets();
  const token = secrets.copilotProxyToken;
  const baseUrl = secrets.copilotBaseUrl || appEnv.copilotBaseUrl;

  if (!token) {
    throw new Error('Copilot proxy token is not configured. Add COPILOT_PROXY_TOKEN to continue.');
  }

  let attempts = 0;
  const maxAttempts = 3;

  while (attempts < maxAttempts) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

      const response = await fetch(baseUrl, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
        body: JSON.stringify({
          model: args.model ?? appEnv.copilotModel,
          messages: args.messages,
          temperature: args.temperature ?? 0.7,
          max_tokens: args.max_tokens ?? 2000,
          top_p: args.top_p ?? 1,
        } as CopilotChatRequest),
      });
      clearTimeout(timeout);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');

        if (response.status === 429) {
          // Rate limited
          attempts += 1;
          if (attempts < maxAttempts) {
            onStatus?.('Copilot proxy is busy, retrying in 60 seconds…');
            await sleep(60_000);
            continue;
          }
        } else if (response.status === 401 || response.status === 403) {
          throw new Error(`Copilot proxy authentication failed: ${errorText}`);
        }

        if (response.status === 404) {
          throw new Error(
            `Copilot endpoint not found (404). Check COPILOT_BASE_URL and token scope (models:read). ` +
              `Current URL: ${baseUrl}. Response: ${errorText}`,
          );
        }

        throw new Error(`Copilot proxy error (${response.status}): ${errorText}`);
      }

      const data = (await response.json()) as CopilotChatResponse;

      if (!data.choices || data.choices.length === 0) {
        throw new Error('No response from Copilot proxy');
      }

      return {
        choices: data.choices.map((choice) => ({
          message: {
            role: 'assistant' as const,
            content: normalizeCopilotContent(choice.message.content),
          },
          finish_reason: choice.finish_reason,
        })),
        usage: data.usage,
      };
    } catch (error) {
      attempts += 1;

      if (attempts >= maxAttempts) {
        throw error;
      }

      if (isRateLimitError(error)) {
        onStatus?.('Copilot proxy rate limited, retrying in 60 seconds…');
        await sleep(60_000);
      } else {
        // Exponential backoff for other errors
        await sleep(500 * Math.pow(2, attempts - 1));
      }
    }
  }

  throw new Error('Copilot proxy request failed after all retries');
}

/**
 * Stream chat completion from Copilot Proxy
 * Note: Currently Copilot proxy may not support streaming like OpenAI
 * This is a placeholder for future streaming support
 */
export async function* streamCopilotChatCompletion(
  args: {
    messages: CopilotMessage[];
    temperature?: number;
    max_tokens?: number;
  },
  onStatus?: (message: string) => void,
) {
  // For now, get the full completion and yield it
  const result = await createCopilotChatCompletion(args, onStatus);

  for (const choice of result.choices) {
    yield choice.message.content;
  }
}
