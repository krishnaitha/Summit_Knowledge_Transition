import "server-only";

export type AuthProvider = "cognito" | "credentials";

const provider = (process.env.AUTH_PROVIDER ?? "credentials") as AuthProvider;

export const authFeatures = {
  provider,
  hasCredentials: provider === "credentials",
  hasRegistration: provider === "credentials",
  hasForgotPassword: provider === "credentials",
  hasInviteFlow: provider === "credentials",
} as const;

export type AuthFeatures = typeof authFeatures;
