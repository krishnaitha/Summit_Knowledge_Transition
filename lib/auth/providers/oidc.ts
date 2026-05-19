import KeycloakProvider from 'next-auth/providers/keycloak';

import { buildOidcCallbacks } from './oidc-callbacks';
import type { AuthProviderDefinition } from './types';

// Generic OIDC / OAuth2 provider.
// Reuses next-auth's Keycloak provider internally — it is a plain OIDC provider
// and works with any standards-compliant IdP (Okta, Azure AD, Auth0, Ping, Dex, etc.).
// Set AUTH_PROVIDER=oidc and supply the OIDC_* environment variables.

const providerId = process.env.OIDC_PROVIDER_ID ?? 'oidc';

// Accepted values mirror next-auth's OAuthConfig.checks type.
type OAuthCheck = 'pkce' | 'state' | 'nonce' | 'none';
const VALID_CHECKS = new Set<string>(['pkce', 'state', 'nonce', 'none']);

function parseChecks(raw: string | undefined): OAuthCheck[] | undefined {
  if (!raw) return undefined;
  const parsed = raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => VALID_CHECKS.has(s)) as OAuthCheck[];
  return parsed.length > 0 ? parsed : undefined;
}

export const oidcProviderDefinition: AuthProviderDefinition = {
  id: 'oidc',

  providers: [
    KeycloakProvider({
      id: providerId,
      name: process.env.OIDC_DISPLAY_NAME ?? 'OIDC',
      clientId: process.env.OIDC_CLIENT_ID!,
      clientSecret: process.env.OIDC_CLIENT_SECRET!,
      issuer: process.env.OIDC_ISSUER!,
      // Default: pkce,state (set by KeycloakProvider). Override via OIDC_CHECKS.
      // Example: OIDC_CHECKS=nonce  — for IdPs that do not support PKCE.
      ...(parseChecks(process.env.OIDC_CHECKS) && {
        checks: parseChecks(process.env.OIDC_CHECKS),
      }),
    }),
  ],

  callbacks: buildOidcCallbacks(providerId),
};
