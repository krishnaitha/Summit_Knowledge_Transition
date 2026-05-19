import KeycloakProvider from 'next-auth/providers/keycloak';

import { buildOidcCallbacks } from './oidc-callbacks';
import type { AuthProviderDefinition } from './types';

export const keycloakProviderDefinition: AuthProviderDefinition = {
  id: 'keycloak',

  providers: [
    KeycloakProvider({
      clientId: process.env.KEYCLOAK_CLIENT_ID!,
      clientSecret: process.env.KEYCLOAK_CLIENT_SECRET!,
      issuer: process.env.KEYCLOAK_ISSUER!,
    }),
  ],

  callbacks: buildOidcCallbacks('keycloak'),
};
