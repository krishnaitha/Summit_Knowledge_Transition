import 'server-only';

export type AuthProvider = 'cognito' | 'credentials' | 'oidc';

const provider = (process.env.AUTH_PROVIDER ?? 'credentials') as AuthProvider;

export const authFeatures = {
  provider,
  oidcProviderId: process.env.OIDC_PROVIDER_ID ?? 'oidc',
  hasCredentials: provider === 'credentials',
  hasRegistration: provider === 'credentials',
  hasForgotPassword: provider === 'credentials',
  hasInviteFlow: provider === 'credentials',
} as const;

export type AuthFeatures = typeof authFeatures;
