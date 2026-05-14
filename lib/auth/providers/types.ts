import type { NextAuthOptions } from "next-auth";

export interface AuthProviderDefinition {
  readonly id: string;
  readonly providers: NextAuthOptions["providers"];
  readonly callbacks: NonNullable<NextAuthOptions["callbacks"]>;
}
