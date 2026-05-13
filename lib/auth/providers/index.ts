import { cognitoProviderDefinition } from "./cognito";
import { credentialsProviderDefinition } from "./credentials";
import type { AuthProviderDefinition } from "./types";

const registry: Readonly<Record<string, AuthProviderDefinition>> = {
  [cognitoProviderDefinition.id]: cognitoProviderDefinition,
  [credentialsProviderDefinition.id]: credentialsProviderDefinition,
};

export function getAuthProviderDefinition(): AuthProviderDefinition {
  const id = process.env.AUTH_PROVIDER ?? "credentials";
  const def = registry[id];

  if (!def) {
    throw new Error(
      `Unknown AUTH_PROVIDER "${id}". Registered providers: ${Object.keys(registry).join(", ")}`,
    );
  }

  return def;
}
