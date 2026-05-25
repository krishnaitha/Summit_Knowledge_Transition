import 'server-only';

import type {
  CompletionCreateParams,
  ChatCompletion as GroqChatCompletion,
} from 'groq-sdk/resources/chat/completions';

import {
  createGroqChatCompletion as groqCreate,
  createGroqQuizCompletion as groqQuizCreate,
} from '@/lib/groq/chat';
import { createAnthropicChatCompletion } from '@/lib/llm/anthropic';
import { createCopilotChatCompletion } from '@/lib/llm/copilot';
import {
  createAzureOpenAiChatCompletion,
  createOllamaChatCompletion,
  createOpenAiChatCompletion,
} from '@/lib/llm/openai';
import { getLlmRuntimeConfig, getLlmRuntimeSecrets } from '@/lib/llm/runtime-config';

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
  const runtime = await getLlmRuntimeConfig();
  const provider = runtime.provider;
  const secrets = await getLlmRuntimeSecrets();

  const providerConfigured =
    provider === 'copilot'
      ? Boolean(secrets.copilotProxyToken)
      : provider === 'openai'
        ? Boolean(secrets.openAiApiKey)
        : provider === 'azure-openai'
          ? Boolean(
              secrets.azureOpenAiApiKey &&
              secrets.azureOpenAiEndpoint &&
              runtime.azureOpenAiDeployment,
            )
          : provider === 'anthropic'
            ? Boolean(secrets.anthropicApiKey)
            : provider === 'mistral'
              ? Boolean(secrets.mistralApiKey)
              : provider === 'ollama'
                ? Boolean(secrets.ollamaBaseUrl && runtime.ollamaModel)
                : Boolean(secrets.groqApiKey);

  if (!providerConfigured) {
    throw new Error(`${provider} is not configured. Add credentials in Admin > Model Switcher.`);
  }

  if (provider === 'copilot') {
    return await createCopilotChatCompletion(
      {
        ...args,
        model: runtime.copilotModel,
      },
      onStatus,
    );
  }

  if (provider === 'openai') {
    return await createOpenAiChatCompletion(
      {
        ...args,
        model: runtime.openAiModel,
        apiKey: secrets.openAiApiKey,
        baseUrl: secrets.openAiBaseUrl,
      },
      onStatus,
    );
  }

  if (provider === 'azure-openai') {
    return await createAzureOpenAiChatCompletion(
      {
        ...args,
        deployment: runtime.azureOpenAiDeployment,
        apiKey: secrets.azureOpenAiApiKey,
        endpoint: secrets.azureOpenAiEndpoint,
        apiVersion: secrets.azureOpenAiApiVersion,
      },
      onStatus,
    );
  }

  if (provider === 'anthropic') {
    return await createAnthropicChatCompletion(
      {
        ...args,
        model: runtime.anthropicModel,
        apiKey: secrets.anthropicApiKey,
        baseUrl: secrets.anthropicBaseUrl,
      },
      onStatus,
    );
  }

  if (provider === 'mistral') {
    return await createOpenAiChatCompletion(
      {
        ...args,
        model: runtime.mistralModel,
        apiKey: secrets.mistralApiKey,
        baseUrl: secrets.mistralBaseUrl,
      },
      onStatus,
    );
  }

  if (provider === 'ollama') {
    return await createOllamaChatCompletion(
      {
        ...args,
        model: runtime.ollamaModel,
        baseUrl: secrets.ollamaBaseUrl,
      },
      onStatus,
    );
  }

  // Default to Groq
  // Convert our unified format to Groq format
  const groqArgs = {
    messages: args.messages,
    temperature: args.temperature,
    max_tokens: args.max_tokens,
    top_p: args.top_p,
  };

  const groqResponse = (await groqCreate(
    groqArgs,
    onStatus,
    runtime.groqChatModel,
  )) as GroqChatCompletion;

  // Normalize response to unified format
  return {
    choices: groqResponse.choices.map((choice) => ({
      message: {
        content: choice.message.content ?? '',
        role: choice.message.role,
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
  response_format?:
    | CompletionCreateParams.ResponseFormatText
    | CompletionCreateParams.ResponseFormatJsonSchema
    | CompletionCreateParams.ResponseFormatJsonObject
    | null;
}): Promise<UnifiedChatCompletion> {
  const runtime = await getLlmRuntimeConfig();
  const provider = runtime.provider;
  const secrets = await getLlmRuntimeSecrets();
  const providerConfigured =
    provider === 'copilot'
      ? Boolean(secrets.copilotProxyToken)
      : provider === 'openai'
        ? Boolean(secrets.openAiApiKey)
        : provider === 'azure-openai'
          ? Boolean(
              secrets.azureOpenAiApiKey &&
              secrets.azureOpenAiEndpoint &&
              runtime.azureOpenAiDeployment,
            )
          : provider === 'anthropic'
            ? Boolean(secrets.anthropicApiKey)
            : provider === 'mistral'
              ? Boolean(secrets.mistralApiKey)
              : provider === 'ollama'
                ? Boolean(secrets.ollamaBaseUrl && runtime.ollamaModel)
                : Boolean(secrets.groqApiKey);

  if (!providerConfigured) {
    throw new Error(`${provider} is not configured for quiz generation.`);
  }

  if (provider === 'copilot') {
    // Copilot proxy - use regular completion for quiz generation
    return await createCopilotChatCompletion({
      messages: args.messages,
      temperature: args.temperature,
      max_tokens: args.max_tokens,
      top_p: args.top_p,
      model: runtime.copilotModel,
    });
  }

  if (provider === 'openai') {
    return await createOpenAiChatCompletion(
      {
        messages: args.messages,
        temperature: args.temperature,
        max_tokens: args.max_tokens,
        top_p: args.top_p,
        model: runtime.openAiModel,
        apiKey: secrets.openAiApiKey,
        baseUrl: secrets.openAiBaseUrl,
      },
      undefined,
    );
  }

  if (provider === 'azure-openai') {
    return await createAzureOpenAiChatCompletion(
      {
        messages: args.messages,
        temperature: args.temperature,
        max_tokens: args.max_tokens,
        top_p: args.top_p,
        deployment: runtime.azureOpenAiDeployment,
        apiKey: secrets.azureOpenAiApiKey,
        endpoint: secrets.azureOpenAiEndpoint,
        apiVersion: secrets.azureOpenAiApiVersion,
      },
      undefined,
    );
  }

  if (provider === 'anthropic') {
    return await createAnthropicChatCompletion(
      {
        messages: args.messages,
        temperature: args.temperature,
        max_tokens: args.max_tokens,
        top_p: args.top_p,
        model: runtime.anthropicModel,
        apiKey: secrets.anthropicApiKey,
        baseUrl: secrets.anthropicBaseUrl,
      },
      undefined,
    );
  }

  if (provider === 'mistral') {
    return await createOpenAiChatCompletion(
      {
        messages: args.messages,
        temperature: args.temperature,
        max_tokens: args.max_tokens,
        top_p: args.top_p,
        model: runtime.mistralModel,
        apiKey: secrets.mistralApiKey,
        baseUrl: secrets.mistralBaseUrl,
      },
      undefined,
    );
  }

  if (provider === 'ollama') {
    return await createOllamaChatCompletion(
      {
        messages: args.messages,
        temperature: args.temperature,
        max_tokens: args.max_tokens,
        top_p: args.top_p,
        model: runtime.ollamaModel,
        baseUrl: secrets.ollamaBaseUrl,
      },
      undefined,
    );
  }

  // Default to Groq - use quiz-optimized client
  const groqResponse = (await groqQuizCreate(args, runtime.groqQuizModel)) as GroqChatCompletion;

  // Normalize response to unified format
  return {
    choices: groqResponse.choices.map((choice) => ({
      message: {
        content: choice.message.content ?? '',
        role: choice.message.role,
      },
      finish_reason: choice.finish_reason,
    })),
    usage: groqResponse.usage,
  };
}

/**
 * Get the current LLM provider name
 */
export async function getCurrentLlmProvider(): Promise<string> {
  const runtime = await getLlmRuntimeConfig();
  if (runtime.provider === 'copilot') return 'Copilot Proxy';
  if (runtime.provider === 'openai') return 'OpenAI';
  if (runtime.provider === 'azure-openai') return 'Azure OpenAI';
  if (runtime.provider === 'anthropic') return 'Anthropic';
  if (runtime.provider === 'mistral') return 'Mistral';
  if (runtime.provider === 'ollama') return 'Ollama';
  return 'Groq';
}

/**
 * Check if LLM is properly configured
 */
export async function isLlmReady(): Promise<boolean> {
  const runtime = await getLlmRuntimeConfig();
  const secrets = await getLlmRuntimeSecrets();
  if (runtime.provider === 'copilot') return Boolean(secrets.copilotProxyToken);
  if (runtime.provider === 'openai') return Boolean(secrets.openAiApiKey);
  if (runtime.provider === 'azure-openai') {
    return Boolean(
      secrets.azureOpenAiApiKey && secrets.azureOpenAiEndpoint && runtime.azureOpenAiDeployment,
    );
  }
  if (runtime.provider === 'anthropic') return Boolean(secrets.anthropicApiKey);
  if (runtime.provider === 'mistral') return Boolean(secrets.mistralApiKey);
  if (runtime.provider === 'ollama') return Boolean(secrets.ollamaBaseUrl && runtime.ollamaModel);
  return Boolean(secrets.groqApiKey);
}
