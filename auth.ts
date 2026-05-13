import bcrypt from 'bcryptjs';
import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';

import sql from '@/lib/db';

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const email = credentials?.email;
        const password = credentials?.password;
        if (!email || !password) return null;

        const rows = await sql`
          SELECT id, email, full_name, role, password_hash
          FROM users
          WHERE email = ${email} AND is_active = true
          LIMIT 1
        `;

        const user = rows[0];
        if (!user || !user.password_hash) return null;

        const valid = await bcrypt.compare(password, user.password_hash as string);
        if (!valid) return null;

        await sql`UPDATE users SET last_login_at = now() WHERE id = ${user.id}`;

        return {
          id: user.id as string,
          email: user.email as string,
          name: user.full_name as string,
          role: user.role as string,
        };
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id?: string }).id = token.id as string;
        (session.user as { role?: string }).role = token.role as string;
      }
      return session;
    },
  },

  pages: {
    signIn: '/login',
  },

  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60,
  },
};
