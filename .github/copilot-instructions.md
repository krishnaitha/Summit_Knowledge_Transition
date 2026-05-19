- [x] Verify that the copilot-instructions.md file in the .github directory is created.
- [x] Clarify Project Requirements
- [x] Scaffold the Project
- [ ] Customize the Project
- [ ] Install Required Extensions
- [ ] Compile the Project
- [ ] Create and Run Task
- [ ] Launch the Project
- [ ] Ensure Documentation is Complete

- Work through each checklist item systematically.
- Keep communication concise and focused.
- Follow development best practices.

## TypeScript & ESLint — Non-Negotiable Rules

- **Never use `any`**. It is configured as an ESLint error. Use `unknown`, `Record<string, unknown>`, or proper typed interfaces instead.
- **Never use `as any`** to cast away type errors — fix the type properly.
- `JSON.parse()` returns `any` — always assign it to a typed variable immediately (e.g., `as Record<string, unknown>` or a specific interface).
- Narrow union types using type guards (`in`, `typeof`, `instanceof`) instead of unsafe casts.
- Every code change must pass **`npm run typecheck`** and **`npm run lint`** with zero errors.
- Do not insert `// eslint-disable-next-line` or `// @ts-ignore` comments to silence type or lint errors — fix the root cause.
