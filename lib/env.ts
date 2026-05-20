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
  llmProvider: (process.env.LLM_PROVIDER ?? 'groq') as 'groq' | 'copilot',
  // Groq configuration
  groqApiKey: process.env.GROQ_API_KEY,
  groqQuizApiKey: process.env.GROQ_API_KEY_QUIZ,
  // Copilot proxy configuration
  copilotProxyToken: process.env.COPILOT_PROXY_TOKEN,
  copilotBaseUrl:
    process.env.COPILOT_BASE_URL ?? 'https://models.github.ai/inference/chat/completions',
  copilotModel: process.env.COPILOT_MODEL ?? 'openai/gpt-4.1-mini',
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

export function isLlmConfigured() {
  if (appEnv.llmProvider === 'copilot') {
    return isCopilotProxyConfigured();
  }
  return isGroqConfigured();
}

export function assertEnv(name: keyof typeof appEnv) {
  const value = appEnv[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}
