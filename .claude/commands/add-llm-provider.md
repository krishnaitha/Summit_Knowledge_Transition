Add a new LLM provider to this project.

## Architecture

All LLM calls go through `lib/llm/index.ts` via `createChatCompletion` and `createQuizCompletion`. Each provider is a function in `lib/llm/<provider>.ts` that accepts `{ messages, model, apiKey, baseUrl, ... }` and returns a normalized response shape. Provider selection and config loading is in `lib/llm/runtime-config.ts`.

## Steps

1. **Understand the target provider** from `$ARGUMENTS` (name, API endpoint, auth scheme).

2. **Read existing provider implementations** (`lib/llm/anthropic.ts`, `lib/llm/openai.ts`) to understand the expected interface:
   - Input: `ChatMessage[]` (role: `'user' | 'assistant' | 'system'`), plus `model`, `apiKey`, `baseUrl`, `temperature`, `max_tokens`, `top_p`.
   - Output: `{ choices: [{ message: { role, content }, finish_reason }], usage: { prompt_tokens, completion_tokens, total_tokens } }`.

3. **Create `lib/llm/<provider>.ts`**:
   - Follow the same pattern: define a typed request/response interface, implement the fetch call, return the normalized shape.
   - Handle rate-limit retry if the provider returns 429s (see `lib/llm/anthropic.ts`).
   - Never use `any`. Narrow all `unknown` API responses explicitly.
   - Add `import 'server-only'` at the top.

4. **Wire it up in `lib/llm/index.ts`**:
   - Add the new provider to the `switch` that dispatches `createChatCompletion` and `createQuizCompletion`.
   - Add the new provider name to the union type for `LlmProvider`.

5. **Add env vars in `lib/env.ts`**:
   - Add `<PROVIDER>_API_KEY` and `<PROVIDER>_BASE_URL` with appropriate defaults.
   - Follow the existing pattern for optional keys.

6. **Update `lib/llm/runtime-config.ts`**:
   - Add the new provider's key and base URL to `getLlmRuntimeSecrets()` and `getLlmRuntimeConfig()`.

7. **Update the Admin model switcher** (`components/admin/model-switcher-form.tsx`) to include the new provider in the dropdown if it has a UI selector.

8. Run `npm run typecheck` and `npm run lint` and fix any issues before reporting done.

Provider to add: $ARGUMENTS
