export const appEnv = {
  appName: process.env.NEXT_PUBLIC_APP_NAME ?? 'Summit KT Portal',
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  groqApiKey: process.env.GROQ_API_KEY,
  groqQuizApiKey: process.env.GROQ_API_KEY_QUIZ,
};

export function isSupabaseConfigured() {
  return Boolean(appEnv.supabaseUrl && appEnv.supabaseAnonKey);
}

export function isSupabaseAdminConfigured() {
  return Boolean(isSupabaseConfigured() && appEnv.supabaseServiceRoleKey);
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