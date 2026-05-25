import 'server-only';

import sql from '@/lib/db';
import { appEnv } from '@/lib/env';

export type LlmProvider =
  | 'groq'
  | 'copilot'
  | 'openai'
  | 'azure-openai'
  | 'anthropic'
  | 'mistral'
  | 'ollama';

export interface LlmRuntimeConfig {
  provider: LlmProvider;
  copilotModel: string;
  groqChatModel: string;
  groqQuizModel: string;
  openAiModel: string;
  azureOpenAiDeployment: string;
  anthropicModel: string;
  mistralModel: string;
  ollamaModel: string;
}

export interface LlmRuntimeSecrets {
  groqApiKey: string;
  groqQuizApiKey: string;
  copilotProxyToken: string;
  copilotBaseUrl: string;
  openAiApiKey: string;
  openAiBaseUrl: string;
  azureOpenAiApiKey: string;
  azureOpenAiEndpoint: string;
  azureOpenAiApiVersion: string;
  anthropicApiKey: string;
  anthropicBaseUrl: string;
  mistralApiKey: string;
  mistralBaseUrl: string;
  ollamaBaseUrl: string;
}

export interface MaskedLlmRuntimeSecrets {
  groqApiKeyMasked: string;
  groqQuizApiKeyMasked: string;
  copilotProxyTokenMasked: string;
  copilotBaseUrl: string;
  openAiApiKeyMasked: string;
  openAiBaseUrl: string;
  azureOpenAiApiKeyMasked: string;
  azureOpenAiEndpoint: string;
  azureOpenAiApiVersion: string;
  anthropicApiKeyMasked: string;
  anthropicBaseUrl: string;
  mistralApiKeyMasked: string;
  mistralBaseUrl: string;
  ollamaBaseUrl: string;
}

const DEFAULT_CONFIG: LlmRuntimeConfig = {
  provider: appEnv.llmProvider,
  copilotModel: appEnv.copilotModel,
  groqChatModel: 'llama-3.3-70b-versatile',
  groqQuizModel: 'llama-3.1-8b-instant',
  openAiModel: appEnv.openAiModel,
  azureOpenAiDeployment: appEnv.azureOpenAiDeployment ?? '',
  anthropicModel: appEnv.anthropicModel,
  mistralModel: appEnv.mistralModel,
  ollamaModel: appEnv.ollamaModel,
};

const DEFAULT_SECRETS: LlmRuntimeSecrets = {
  groqApiKey: appEnv.groqApiKey ?? '',
  groqQuizApiKey: appEnv.groqQuizApiKey ?? '',
  copilotProxyToken: appEnv.copilotProxyToken ?? '',
  copilotBaseUrl: appEnv.copilotBaseUrl,
  openAiApiKey: appEnv.openAiApiKey ?? '',
  openAiBaseUrl: appEnv.openAiBaseUrl,
  azureOpenAiApiKey: appEnv.azureOpenAiApiKey ?? '',
  azureOpenAiEndpoint: appEnv.azureOpenAiEndpoint ?? '',
  azureOpenAiApiVersion: appEnv.azureOpenAiApiVersion,
  anthropicApiKey: appEnv.anthropicApiKey ?? '',
  anthropicBaseUrl: appEnv.anthropicBaseUrl,
  mistralApiKey: appEnv.mistralApiKey ?? '',
  mistralBaseUrl: appEnv.mistralBaseUrl,
  ollamaBaseUrl: appEnv.ollamaBaseUrl,
};

function normalizeProvider(value: unknown): LlmProvider {
  if (value === 'copilot') return 'copilot';
  if (value === 'openai') return 'openai';
  if (value === 'azure-openai') return 'azure-openai';
  if (value === 'anthropic') return 'anthropic';
  if (value === 'mistral') return 'mistral';
  if (value === 'ollama') return 'ollama';
  return 'groq';
}

function normalizeModel(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function normalizeSecret(value: unknown, fallback = ''): string {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function maskSecret(secret: string): string {
  if (!secret) return 'Not set';
  if (secret.length <= 6) return '*'.repeat(secret.length);
  return `${secret.slice(0, 3)}${'*'.repeat(Math.max(4, secret.length - 6))}${secret.slice(-3)}`;
}

export async function getLlmRuntimeConfig(): Promise<LlmRuntimeConfig> {
  try {
    const rows = await sql<{ value: unknown }[]>`
      SELECT value
      FROM app_settings
      WHERE key = 'llm_config'
      LIMIT 1
    `;

    const raw = rows[0]?.value;
    if (!raw || typeof raw !== 'object') {
      return DEFAULT_CONFIG;
    }

    const record = raw as Record<string, unknown>;

    return {
      provider: normalizeProvider(record.provider),
      copilotModel: normalizeModel(record.copilotModel, DEFAULT_CONFIG.copilotModel),
      groqChatModel: normalizeModel(record.groqChatModel, DEFAULT_CONFIG.groqChatModel),
      groqQuizModel: normalizeModel(record.groqQuizModel, DEFAULT_CONFIG.groqQuizModel),
      openAiModel: normalizeModel(record.openAiModel, DEFAULT_CONFIG.openAiModel),
      azureOpenAiDeployment: normalizeModel(
        record.azureOpenAiDeployment,
        DEFAULT_CONFIG.azureOpenAiDeployment,
      ),
      anthropicModel: normalizeModel(record.anthropicModel, DEFAULT_CONFIG.anthropicModel),
      mistralModel: normalizeModel(record.mistralModel, DEFAULT_CONFIG.mistralModel),
      ollamaModel: normalizeModel(record.ollamaModel, DEFAULT_CONFIG.ollamaModel),
    };
  } catch {
    // If table is not migrated yet, fall back to env defaults.
    return DEFAULT_CONFIG;
  }
}

export async function getLlmRuntimeSecrets(): Promise<LlmRuntimeSecrets> {
  try {
    const rows = await sql<{ value: unknown }[]>`
      SELECT value
      FROM app_settings
      WHERE key = 'llm_secrets'
      LIMIT 1
    `;

    const raw = rows[0]?.value;
    if (!raw || typeof raw !== 'object') {
      return DEFAULT_SECRETS;
    }

    const record = raw as Record<string, unknown>;

    return {
      groqApiKey: normalizeSecret(record.groqApiKey, DEFAULT_SECRETS.groqApiKey),
      groqQuizApiKey: normalizeSecret(record.groqQuizApiKey, DEFAULT_SECRETS.groqQuizApiKey),
      copilotProxyToken: normalizeSecret(
        record.copilotProxyToken,
        DEFAULT_SECRETS.copilotProxyToken,
      ),
      copilotBaseUrl: normalizeSecret(record.copilotBaseUrl, DEFAULT_SECRETS.copilotBaseUrl),
      openAiApiKey: normalizeSecret(record.openAiApiKey, DEFAULT_SECRETS.openAiApiKey),
      openAiBaseUrl: normalizeSecret(record.openAiBaseUrl, DEFAULT_SECRETS.openAiBaseUrl),
      azureOpenAiApiKey: normalizeSecret(
        record.azureOpenAiApiKey,
        DEFAULT_SECRETS.azureOpenAiApiKey,
      ),
      azureOpenAiEndpoint: normalizeSecret(
        record.azureOpenAiEndpoint,
        DEFAULT_SECRETS.azureOpenAiEndpoint,
      ),
      azureOpenAiApiVersion: normalizeSecret(
        record.azureOpenAiApiVersion,
        DEFAULT_SECRETS.azureOpenAiApiVersion,
      ),
      anthropicApiKey: normalizeSecret(record.anthropicApiKey, DEFAULT_SECRETS.anthropicApiKey),
      anthropicBaseUrl: normalizeSecret(record.anthropicBaseUrl, DEFAULT_SECRETS.anthropicBaseUrl),
      mistralApiKey: normalizeSecret(record.mistralApiKey, DEFAULT_SECRETS.mistralApiKey),
      mistralBaseUrl: normalizeSecret(record.mistralBaseUrl, DEFAULT_SECRETS.mistralBaseUrl),
      ollamaBaseUrl: normalizeSecret(record.ollamaBaseUrl, DEFAULT_SECRETS.ollamaBaseUrl),
    };
  } catch {
    return DEFAULT_SECRETS;
  }
}

export async function getMaskedLlmRuntimeSecrets(): Promise<MaskedLlmRuntimeSecrets> {
  const secrets = await getLlmRuntimeSecrets();

  return {
    groqApiKeyMasked: maskSecret(secrets.groqApiKey),
    groqQuizApiKeyMasked: maskSecret(secrets.groqQuizApiKey),
    copilotProxyTokenMasked: maskSecret(secrets.copilotProxyToken),
    copilotBaseUrl: secrets.copilotBaseUrl,
    openAiApiKeyMasked: maskSecret(secrets.openAiApiKey),
    openAiBaseUrl: secrets.openAiBaseUrl,
    azureOpenAiApiKeyMasked: maskSecret(secrets.azureOpenAiApiKey),
    azureOpenAiEndpoint: secrets.azureOpenAiEndpoint,
    azureOpenAiApiVersion: secrets.azureOpenAiApiVersion,
    anthropicApiKeyMasked: maskSecret(secrets.anthropicApiKey),
    anthropicBaseUrl: secrets.anthropicBaseUrl,
    mistralApiKeyMasked: maskSecret(secrets.mistralApiKey),
    mistralBaseUrl: secrets.mistralBaseUrl,
    ollamaBaseUrl: secrets.ollamaBaseUrl,
  };
}
