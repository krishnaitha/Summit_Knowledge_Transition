export const appEnv = {
  appName: process.env.NEXT_PUBLIC_APP_NAME ?? "Summit KT Portal",
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  databaseUrl: process.env.DATABASE_URL,
  r2AccountId: process.env.R2_ACCOUNT_ID,
  r2BucketName: process.env.R2_BUCKET_NAME,
  groqApiKey: process.env.GROQ_API_KEY,
  groqQuizApiKey: process.env.GROQ_API_KEY_QUIZ,
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

export function assertEnv(name: keyof typeof appEnv) {
  const value = appEnv[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}
