import type { NextAuthOptions } from "next-auth";

import { getAuthProviderDefinition } from "@/lib/auth/providers";

const def = getAuthProviderDefinition();

export const authOptions: NextAuthOptions = {
  providers: def.providers,
  callbacks: def.callbacks,
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
  },
};
