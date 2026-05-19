import type { NextAuthOptions } from 'next-auth';

import sql from '@/lib/db';

type Callbacks = NonNullable<NextAuthOptions['callbacks']>;

/**
 * Shared callback logic for all OIDC-based providers (Cognito, generic OIDC).
 *
 * - signIn: upserts the user row per (email, auth_provider) pair, rejects if inactive
 * - jwt:    stamps token.id from the DB on first sign-in
 * - session: surfaces token.id onto session.user
 *
 * The same email can exist across multiple providers — each (email, auth_provider)
 * pair is a distinct identity row.
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

        const rows = await sql<{ is_active: boolean | null }[]>`
          INSERT INTO users (email, full_name, role, is_active, auth_provider)
          VALUES (${email}, ${fullName}, 'member', true, ${providerId})
          ON CONFLICT (email, auth_provider) DO UPDATE SET
            full_name = COALESCE(users.full_name, EXCLUDED.full_name)
          RETURNING is_active
        `;

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
            WHERE email = ${email} AND auth_provider = ${providerId}
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
