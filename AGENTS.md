<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

<!-- BEGIN:typescript-agent-rules -->

# TypeScript & ESLint Rules — Strictly Enforced

## No `any`

- **Never use `any`** — it is an ESLint error (`@typescript-eslint/no-explicit-any: error`).
- Use `unknown` when the type is truly unknown, then narrow with type guards.
- Use `Record<string, unknown>` for untyped object shapes.
- Use proper generic types or interfaces instead of reaching for `any`.
- Casting with `as any` is also forbidden.

## Type Safety

- Always provide explicit types for function parameters that cannot be inferred.
- Narrow union types with `in`, `typeof`, or `instanceof` — do not cast to silence errors.
- `JSON.parse()` returns `any` — always cast the result to a known type immediately.

## ESLint Compliance

- All generated code must pass `npm run lint` without errors or warnings.
- All generated code must pass `npm run typecheck` without errors.
- Do not add `// eslint-disable` comments unless absolutely unavoidable, and never to suppress `no-explicit-any`.
<!-- END:typescript-agent-rules -->
