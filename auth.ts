import sql from "@/lib/db";
import type { UserProfile } from "@/lib/types/database";
import type { NextAuthOptions } from "next-auth";
import CognitoProvider from "next-auth/providers/cognito";

export const authOptions: NextAuthOptions = {
  providers: [
    CognitoProvider({
      clientId: process.env.COGNITO_CLIENT_ID!,
      clientSecret: process.env.COGNITO_CLIENT_SECRET!,
      issuer: process.env.COGNITO_ISSUER!,
      // Cognito federating to Microsoft (OIDC) includes a nonce in the returned
      // ID token. Adding "nonce" to checks makes NextAuth send a nonce in the
      // authorization request so Cognito echoes it back correctly.
      checks: ["nonce"],
    }),
  ],

  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === "cognito") {
        const email =
          user.email ?? (profile as { email?: string } | undefined)?.email;
        if (!email) return false;

        const fullName =
          (profile as { name?: string } | undefined)?.name ?? null;

        // Auto-provision first-time org employees; preserve any existing full_name set by admin.
        // RETURNING is_active acts as an app-level kill switch — an admin can set is_active = false
        // in the DB to block a specific user without touching their Cognito account.
        const rows = await sql<Pick<UserProfile, "is_active">[]>`
          INSERT INTO users (email, full_name, role, is_active)
          VALUES (${email}, ${fullName}, 'member', true)
          ON CONFLICT (email) DO UPDATE SET
            full_name = COALESCE(users.full_name, EXCLUDED.full_name)
          RETURNING is_active
        `;

        return rows[0]?.is_active === true;
      }
      return true;
    },

    async jwt({ token, user, account, profile }) {
      // Only runs on initial OAuth sign-in (when account is present).
      // signIn callback has already upserted the row, so this is guaranteed to hit.
      if (account?.provider === "cognito") {
        const email =
          user?.email ?? (profile as { email?: string } | undefined)?.email;

        if (email) {
          const rows = await sql<Pick<UserProfile, "id">[]>`
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
  },

  pages: {
    signIn: "/login",
  },

  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
  },
};
