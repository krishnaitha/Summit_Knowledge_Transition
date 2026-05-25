import 'server-only';

import { sleep } from '@/lib/utils';

const REQUEST_TIMEOUT = 120_000;

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface AnthropicTextBlock {
  type?: string;
  text?: unknown;
}

interface AnthropicResponse {
  content?: AnthropicTextBlock[];
  stop_reason?: string;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
  };
}

function isRateLimitError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return message.includes('429') || message.includes('rate limit');
}

function splitSystemAndMessages(messages: ChatMessage[]) {
  const systemParts: string[] = [];
  const converted: Array<{ role: 'user' | 'assistant'; content: string }> = [];

  for (const message of messages) {
    if (message.role === 'system') {
      systemParts.push(message.content);
      continue;
    }

    converted.push({
      role: message.role,
      content: message.content,
    });
  }

  return {
    system: systemParts.join('\n\n').trim(),
    messages: converted,
  };
}

async function withRetry<T>(
  task: () => Promise<T>,
  onStatus?: (message: string) => void,
): Promise<T> {
  let attempts = 0;

  while (attempts < 3) {
    try {
      return await task();
    } catch (error) {
      attempts += 1;
      if (attempts >= 3) throw error;

      if (isRateLimitError(error)) {
        onStatus?.('Anthropic is busy, retrying in 60 seconds...');
        await sleep(60_000);
      } else {
        await sleep(500 * 2 ** attempts);
      }
    }
  }

  throw new Error('Anthropic request failed after retries');
}

export async function createAnthropicChatCompletion(
  args: {
    messages: ChatMessage[];
    temperature?: number;
    max_tokens?: number;
    top_p?: number;
    model: string;
    apiKey: string;
    baseUrl: string;
  },
  onStatus?: (message: string) => void,
) {
  if (!args.apiKey) {
    throw new Error('Anthropic is not configured. Add ANTHROPIC_API_KEY to continue.');
  }

  const normalizedUrl = args.baseUrl.trim() || 'https://api.anthropic.com/v1/messages';
  const { system, messages } = splitSystemAndMessages(args.messages);

  const responseText = await withRetry(async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    try {
      const response = await fetch(normalizedUrl, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'x-api-key': args.apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: args.model,
          max_tokens: args.max_tokens ?? 2000,
          temperature: args.temperature ?? 0.7,
          top_p: args.top_p ?? 1,
          ...(system ? { system } : {}),
          messages,
        }),
      });

      const payload = await response.text();

      if (!response.ok) {
        throw new Error(`${response.status}: ${payload || 'Unknown error'}`);
      }

      return payload;
    } finally {
      clearTimeout(timeout);
    }
  }, onStatus);

  const data = JSON.parse(responseText) as AnthropicResponse;
  const content = (data.content ?? [])
    .filter((block) => block.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text as string)
    .join('');

  const promptTokens = data.usage?.input_tokens ?? 0;
  const completionTokens = data.usage?.output_tokens ?? 0;

  return {
    choices: [
      {
        message: {
          role: 'assistant' as const,
          content,
        },
        finish_reason: data.stop_reason ?? 'stop',
      },
    ],
    usage: {
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: promptTokens + completionTokens,
    },
  };
}
