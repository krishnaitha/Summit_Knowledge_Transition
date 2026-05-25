import 'server-only';

import { sleep } from '@/lib/utils';

const REQUEST_TIMEOUT = 120_000;

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface OpenAiLikeResponse {
  choices?: Array<{
    message?: {
      content?: unknown;
      role?: string;
    };
    finish_reason?: string;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

function normalizeContent(content: unknown): string {
  if (typeof content === 'string') return content;

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part;
        if (part && typeof part === 'object') {
          const record = part as Record<string, unknown>;
          if (typeof record.text === 'string') return record.text;
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
  const msg = error.message.toLowerCase();
  return msg.includes('429') || msg.includes('rate limit');
}

async function postJson(
  url: string,
  headers: Record<string, string>,
  body: Record<string, unknown>,
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  try {
    const response = await fetch(url, {
      method: 'POST',
      signal: controller.signal,
      headers,
      body: JSON.stringify(body),
    });

    const payloadText = await response.text();

    if (!response.ok) {
      throw new Error(`${response.status}: ${payloadText || 'Unknown error'}`);
    }

    return payloadText;
  } finally {
    clearTimeout(timeout);
  }
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
        onStatus?.('Provider is busy, retrying in 60 seconds...');
        await sleep(60_000);
      } else {
        await sleep(500 * 2 ** attempts);
      }
    }
  }

  throw new Error('Provider request failed after retries');
}

export async function createOpenAiChatCompletion(
  args: {
    messages: ChatMessage[];
    temperature?: number;
    max_tokens?: number;
    top_p?: number;
    model: string;
    apiKey?: string;
    baseUrl: string;
  },
  onStatus?: (message: string) => void,
) {
  const payload = await withRetry(
    () =>
      postJson(
        args.baseUrl,
        args.apiKey
          ? {
              Authorization: `Bearer ${args.apiKey}`,
              'Content-Type': 'application/json',
            }
          : {
              'Content-Type': 'application/json',
            },
        {
          model: args.model,
          messages: args.messages,
          temperature: args.temperature ?? 0.7,
          max_tokens: args.max_tokens ?? 2000,
          top_p: args.top_p ?? 1,
        },
      ),
    onStatus,
  );

  const data = JSON.parse(payload) as OpenAiLikeResponse;
  const choice = data.choices?.[0];

  return {
    choices: [
      {
        message: {
          role: (choice?.message?.role ?? 'assistant') as 'assistant',
          content: normalizeContent(choice?.message?.content),
        },
        finish_reason: choice?.finish_reason ?? 'stop',
      },
    ],
    usage: {
      prompt_tokens: data.usage?.prompt_tokens ?? 0,
      completion_tokens: data.usage?.completion_tokens ?? 0,
      total_tokens: data.usage?.total_tokens ?? 0,
    },
  };
}

interface OllamaChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface OllamaChatResponse {
  message?: {
    content?: unknown;
  };
  done_reason?: string;
  prompt_eval_count?: number;
  eval_count?: number;
}

export async function createOllamaChatCompletion(
  args: {
    messages: OllamaChatMessage[];
    temperature?: number;
    max_tokens?: number;
    top_p?: number;
    model: string;
    baseUrl: string;
  },
  onStatus?: (message: string) => void,
) {
  const endpoint = (args.baseUrl.trim() || 'http://localhost:11434/api/chat').replace(/\/$/, '');

  const payload = await withRetry(
    () =>
      postJson(
        endpoint,
        {
          'Content-Type': 'application/json',
        },
        {
          model: args.model,
          messages: args.messages,
          stream: false,
          options: {
            temperature: args.temperature ?? 0.7,
            num_predict: args.max_tokens ?? 1024,
            top_p: args.top_p ?? 1,
          },
        },
      ),
    onStatus,
  );

  const data = JSON.parse(payload) as OllamaChatResponse;
  const promptTokens = data.prompt_eval_count ?? 0;
  const completionTokens = data.eval_count ?? 0;

  return {
    choices: [
      {
        message: {
          role: 'assistant' as const,
          content: normalizeContent(data.message?.content),
        },
        finish_reason: data.done_reason ?? 'stop',
      },
    ],
    usage: {
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: promptTokens + completionTokens,
    },
  };
}

export async function createAzureOpenAiChatCompletion(
  args: {
    messages: ChatMessage[];
    temperature?: number;
    max_tokens?: number;
    top_p?: number;
    deployment: string;
    apiKey: string;
    endpoint: string;
    apiVersion: string;
  },
  onStatus?: (message: string) => void,
) {
  if (!args.apiKey || !args.endpoint || !args.deployment) {
    throw new Error(
      'Azure OpenAI is not configured. Add AZURE_OPENAI_API_KEY, AZURE_OPENAI_ENDPOINT, and deployment.',
    );
  }

  const baseEndpoint = args.endpoint.replace(/\/$/, '');
  const url = `${baseEndpoint}/openai/deployments/${encodeURIComponent(args.deployment)}/chat/completions?api-version=${encodeURIComponent(args.apiVersion)}`;

  const payload = await withRetry(
    () =>
      postJson(
        url,
        {
          'api-key': args.apiKey,
          'Content-Type': 'application/json',
        },
        {
          messages: args.messages,
          temperature: args.temperature ?? 0.7,
          max_tokens: args.max_tokens ?? 2000,
          top_p: args.top_p ?? 1,
        },
      ),
    onStatus,
  );

  const data = JSON.parse(payload) as OpenAiLikeResponse;
  const choice = data.choices?.[0];

  return {
    choices: [
      {
        message: {
          role: (choice?.message?.role ?? 'assistant') as 'assistant',
          content: normalizeContent(choice?.message?.content),
        },
        finish_reason: choice?.finish_reason ?? 'stop',
      },
    ],
    usage: {
      prompt_tokens: data.usage?.prompt_tokens ?? 0,
      completion_tokens: data.usage?.completion_tokens ?? 0,
      total_tokens: data.usage?.total_tokens ?? 0,
    },
  };
}
