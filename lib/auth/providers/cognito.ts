import CognitoProvider from "next-auth/providers/cognito";

import sql from "@/lib/db";

import type { AuthProviderDefinition } from "./types";

export const cognitoProviderDefinition: AuthProviderDefinition = {
  id: "cognito",

  providers: [
    CognitoProvider({
      clientId: process.env.COGNITO_CLIENT_ID!,
      clientSecret: process.env.COGNITO_CLIENT_SECRET!,
      issuer: process.env.COGNITO_ISSUER!,
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

        const rows = await sql<
          { is_active: boolean | null; auth_provider: string | null }[]
        >`
          INSERT INTO users (email, full_name, role, is_active, auth_provider)
          VALUES (${email}, ${fullName}, 'member', true, 'cognito')
          ON CONFLICT (email) DO UPDATE SET
            full_name = COALESCE(users.full_name, EXCLUDED.full_name)
          RETURNING is_active, auth_provider
        `;

        if (rows[0]?.auth_provider !== "cognito") return false;
        return rows[0]?.is_active === true;
      }
      return true;
    },

    async jwt({ token, user, account, profile }) {
      if (account?.provider === "cognito") {
        const email =
          user?.email ?? (profile as { email?: string } | undefined)?.email;

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
  },
};
