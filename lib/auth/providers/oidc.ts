import KeycloakProvider from 'next-auth/providers/keycloak';

import { buildOidcCallbacks } from './oidc-callbacks';
import type { AuthProviderDefinition } from './types';

// Generic OIDC / OAuth2 provider.
// Reuses next-auth's Keycloak provider internally — it is a plain OIDC provider
// and works with any standards-compliant IdP (Okta, Azure AD, Auth0, Ping, Dex, etc.).
// Set AUTH_PROVIDER=oidc and supply the OIDC_* environment variables.

const providerId = process.env.OIDC_PROVIDER_ID ?? 'oidc';

export const oidcProviderDefinition: AuthProviderDefinition = {
  id: 'oidc',

  providers: [
    KeycloakProvider({
      id: providerId,
      name: process.env.OIDC_DISPLAY_NAME ?? 'OIDC',
      clientId: process.env.OIDC_CLIENT_ID!,
      clientSecret: process.env.OIDC_CLIENT_SECRET!,
      issuer: process.env.OIDC_ISSUER!,
    }),
  ],

  callbacks: buildOidcCallbacks(providerId),
};
