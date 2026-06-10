export const appEnv = {
  appName: process.env.NEXT_PUBLIC_APP_NAME ?? 'Summit KT Portal',
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
  /** Display name for the AI bot. Set NEXT_PUBLIC_BOT_NAME to override; defaults to "<appName> AI". */
  botName:
    process.env.NEXT_PUBLIC_BOT_NAME ??
    `${process.env.NEXT_PUBLIC_APP_NAME ?? 'Summit KT Portal'} AI`,
  databaseUrl: process.env.DATABASE_URL,
  nextauthSecret: process.env.NEXTAUTH_SECRET,
  authProvider: process.env.AUTH_PROVIDER ?? 'credentials',
  r2AccountId: process.env.R2_ACCOUNT_ID,
  r2BucketName: process.env.R2_BUCKET_NAME,
  // LLM Provider selection
  llmProvider: (process.env.LLM_PROVIDER ?? 'groq') as
    | 'groq'
    | 'copilot'
    | 'openai'
    | 'azure-openai'
    | 'anthropic'
    | 'mistral'
    | 'ollama',
  // Groq configuration
  groqApiKey: process.env.GROQ_API_KEY,
  groqQuizApiKey: process.env.GROQ_API_KEY_QUIZ,
  // Copilot proxy configuration
  copilotProxyToken: process.env.COPILOT_PROXY_TOKEN,
  copilotBaseUrl:
    process.env.COPILOT_BASE_URL ?? 'https://models.github.ai/inference/chat/completions',
  copilotModel: process.env.COPILOT_MODEL ?? 'google/gemini-3.5-flash',
  // OpenAI configuration
  openAiApiKey: process.env.OPENAI_API_KEY,
  openAiBaseUrl: process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1/chat/completions',
  openAiModel: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
  // Azure OpenAI configuration
  azureOpenAiApiKey: process.env.AZURE_OPENAI_API_KEY,
  azureOpenAiEndpoint: process.env.AZURE_OPENAI_ENDPOINT,
  azureOpenAiDeployment: process.env.AZURE_OPENAI_DEPLOYMENT,
  azureOpenAiApiVersion: process.env.AZURE_OPENAI_API_VERSION ?? '2024-10-21',
  // Anthropic configuration
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  anthropicBaseUrl: process.env.ANTHROPIC_BASE_URL ?? 'https://api.anthropic.com/v1/messages',
  anthropicModel: process.env.ANTHROPIC_MODEL ?? 'claude-3-5-sonnet-latest',
  // Mistral configuration
  mistralApiKey: process.env.MISTRAL_API_KEY,
  mistralBaseUrl: process.env.MISTRAL_BASE_URL ?? 'https://api.mistral.ai/v1/chat/completions',
  mistralModel: process.env.MISTRAL_MODEL ?? 'mistral-small-latest',
  // Ollama configuration (local, keyless by default)
  ollamaBaseUrl: process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434/api/chat',
  ollamaModel: process.env.OLLAMA_MODEL ?? 'llama3.1:8b',
  // Embeddings configuration
  embeddingModelId: process.env.EMBEDDING_MODEL_ID ?? 'Xenova/all-MiniLM-L6-v2',
  embeddingModelRevision: process.env.EMBEDDING_MODEL_REVISION ?? '',
};

export function isDatabaseConfigured() {
  return Boolean(appEnv.databaseUrl);
}

export function isR2Configured() {
  return Boolean(appEnv.r2AccountId && appEnv.r2BucketName);
}

export function isGroqConfigured() {
  return Boolean(appEnv.groqApiKey);
}

export function isCopilotProxyConfigured() {
  return Boolean(appEnv.copilotProxyToken);
}

export function isOpenAiConfigured() {
  return Boolean(appEnv.openAiApiKey);
}

export function isAzureOpenAiConfigured() {
  return Boolean(
    appEnv.azureOpenAiApiKey && appEnv.azureOpenAiEndpoint && appEnv.azureOpenAiDeployment,
  );
}

export function isAnthropicConfigured() {
  return Boolean(appEnv.anthropicApiKey);
}

export function isMistralConfigured() {
  return Boolean(appEnv.mistralApiKey);
}

export function isOllamaConfigured() {
  return Boolean(appEnv.ollamaBaseUrl);
}

export function isLlmConfigured() {
  if (appEnv.llmProvider === 'copilot') return isCopilotProxyConfigured();
  if (appEnv.llmProvider === 'openai') return isOpenAiConfigured();
  if (appEnv.llmProvider === 'azure-openai') return isAzureOpenAiConfigured();
  if (appEnv.llmProvider === 'anthropic') return isAnthropicConfigured();
  if (appEnv.llmProvider === 'mistral') return isMistralConfigured();
  if (appEnv.llmProvider === 'ollama') return isOllamaConfigured();

  if (appEnv.llmProvider === 'groq') {
    return isGroqConfigured();
  }

  return false;
}

export function assertEnv(name: keyof typeof appEnv) {
  const value = appEnv[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}
