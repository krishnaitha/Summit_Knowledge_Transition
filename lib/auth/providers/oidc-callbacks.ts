import type { NextAuthOptions } from 'next-auth';

import sql from '@/lib/db';

type Callbacks = NonNullable<NextAuthOptions['callbacks']>;

/**
 * Shared callback logic for all OIDC-based providers (Cognito, Keycloak, generic OIDC).
 *
 * - signIn: upserts the user row, rejects if inactive or auth_provider mismatch
 * - jwt:    stamps token.id from the DB on first sign-in
 * - session: surfaces token.id onto session.user
 *
 * Pass `overrides` to replace any individual callback for provider-specific behaviour.
 */
export function buildOidcCallbacks(providerId: string, overrides?: Partial<Callbacks>): Callbacks {
  return {
    async signIn({ user, account, profile }) {
      if (account?.provider === providerId) {
        const email = user.email ?? (profile as { email?: string } | undefined)?.email;
        if (!email) return false;

        const fullName = (profile as { name?: string } | undefined)?.name ?? null;

        const rows = await sql<{ is_active: boolean | null; auth_provider: string | null }[]>`
          INSERT INTO users (email, full_name, role, is_active, auth_provider)
          VALUES (${email}, ${fullName}, 'member', true, ${providerId})
          ON CONFLICT (email) DO UPDATE SET
            full_name = COALESCE(users.full_name, EXCLUDED.full_name)
          RETURNING is_active, auth_provider
        `;

        if (rows[0]?.auth_provider !== providerId) return false;
        return rows[0]?.is_active === true;
      }
      return true;
    },

    async jwt({ token, user, account, profile }) {
      if (account?.provider === providerId) {
        const email = user?.email ?? (profile as { email?: string } | undefined)?.email;

        if (email) {
          const rows = await sql<{ id: string }[]>`
            UPDATE users SET last_login_at = now()
            WHERE email = ${email}
            RETURNING id
          `;
          if (rows[0]) token.id = rows[0].id;
        }
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        (session.user as { id?: string }).id = token.id as string;
      }
      return session;
    },

    ...overrides,
  };
}
