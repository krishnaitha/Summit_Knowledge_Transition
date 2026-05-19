import CognitoProvider from 'next-auth/providers/cognito';

import { buildOidcCallbacks } from './oidc-callbacks';
import type { AuthProviderDefinition } from './types';

export const cognitoProviderDefinition: AuthProviderDefinition = {
  id: 'cognito',

  providers: [
    CognitoProvider({
      clientId: process.env.COGNITO_CLIENT_ID!,
      clientSecret: process.env.COGNITO_CLIENT_SECRET!,
      issuer: process.env.COGNITO_ISSUER!,
      checks: ['nonce'],
    }),
  ],

  callbacks: buildOidcCallbacks('cognito'),
};
