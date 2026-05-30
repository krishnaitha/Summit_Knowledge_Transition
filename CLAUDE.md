# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev          # Next.js dev server on port 3000
npm run build        # Production build
npm run lint         # ESLint
npm run typecheck    # tsc --noEmit (no output, errors only)
npm run test         # Vitest (single run)
npm run test:watch   # Vitest watch mode
npm run worker       # Background job worker (separate process, required for document processing and quiz generation)
npm run db:migrate   # Run pending Postgres migrations via node-pg-migrate
npm run format       # Prettier on app/, components/, lib/, worker/
```

### Running a single test file

```bash
npx vitest run path/to/file.test.ts
```

### Worker development setup

Two terminals are required for full local development:

```powershell
# Terminal 1
npm run dev

# Terminal 2
$env:INTERNAL_APP_URL="http://localhost:3000"; $env:WORKER_SECRET="your-secret"; npm run worker
```

### Database migrations

```bash
npm run db:migrate   # applies all pending migrations in postgres/migrations/
```

The full baseline schema (without migrations) is at `postgres/schema.sql`. It requires `pgvector` and `pgcrypto` extensions.

## Architecture

### App structure

Next.js 16 App Router with two authenticated route groups:

- `app/(admin)/admin/` — admin users only; guarded by `requireAdmin()` in each page
- `app/(member)/` — member users; guarded by `requireMember()`
- `app/api/` — API routes; auth checked per-route
- `app/actions/` — Server Actions (called from client components)

### Authentication

`next-auth` v4 with pluggable providers in `lib/auth/providers/`. The active provider is set via `AUTH_PROVIDER` env var (`credentials`, `cognito`, or `oidc`). Auth guards live in `lib/auth.ts`:

- `requireAdmin()` — redirects to `/dashboard` if not global admin
- `requireMember()` — redirects to `/admin/dashboard` if user is admin
- `requireProjectAdmin(projectId)` — allows both global admins and project-level admins
- `requireAnyAdmin()` — allows global admin OR any project-level admin

Two-level role system: global `role` on `users` table (`admin`/`member`), plus optional project-level `role` on `project_members` (`admin`/`member`).

### Data access

All SQL queries are in `lib/data.ts` using the `postgres` tagged-template client from `lib/db.ts`. There is no ORM. Query directly with `` sql`SELECT ...` `` and pass typed generics for the return shape. The `lib/types/database.ts` file defines all DB record types.

### LLM provider abstraction

All LLM calls go through `lib/llm/index.ts` (`createChatCompletion` / `createQuizCompletion`). Supported providers: `groq` (default), `openai`, `azure-openai`, `anthropic`, `mistral`, `ollama`, `copilot`. Provider and model are configured by:

1. Env vars in `lib/env.ts` (compile-time defaults)
2. `app_settings` table rows `llm_config` and `llm_secrets` (runtime overrides via Admin → Model Switcher)

`getLlmRuntimeConfig()` and `getLlmRuntimeSecrets()` in `lib/llm/runtime-config.ts` always read DB first, falling back to env defaults.

### RAG pipeline

Document ingestion flow (triggered as a background job):

1. `lib/documents/parse.ts` — extract text from PDF, DOCX, XLSX, CSV, etc.
2. `lib/documents/pii.ts` — redact PII patterns before storing
3. `lib/documents/scan.ts` — classify document sensitivity
4. `lib/rag/chunking.ts` — split into overlapping chunks
5. `lib/rag/embeddings.ts` — embed via `@xenova/transformers` (local, `Xenova/all-MiniLM-L6-v2` by default)
6. Chunks + embeddings stored in `document_chunks` with `embedding_model_id` and `embedding_model_revision`

Query flow at chat time:

1. `lib/rag/retrieval.ts` → `retrieveRelevantChunks()` — asserts embedding model consistency first, then cosine similarity via `match_document_chunks()` Postgres function
2. Embedding model mismatch across a project's chunks throws, requiring re-ingestion

If the active embedding model changes, all existing chunks for affected projects must be re-processed.

### Background job queue

Long-running work (document processing, quiz generation, connector sync, bot thread replies) uses a Postgres-backed job queue:

- Jobs are inserted into `processing_jobs` by API routes
- `worker/index.mjs` polls `POST /api/jobs/worker` every second
- The worker route atomically claims one job (`claim_next_pending_job()` SQL function)
- Job types: `document_process`, `quiz_generate`, `connector_sync`, `bot_thread_reply`
- Frontend polls `GET /api/jobs/[id]` every 3 seconds for status

The worker is a **separate Node.js process** (`npm run worker`), not a Next.js route that auto-runs. In production without a long-running process (e.g. Vercel), use Supabase `pg_cron` to trigger the route on a schedule (see `docs/WORKER_SETUP.md`).

### File storage

`lib/storage/r2.ts` — Cloudflare R2 (production). `lib/storage/local.ts` — local filesystem fallback. Configured by `R2_ACCOUNT_ID` and `R2_BUCKET_NAME` env vars.

### Key environment variables

| Variable             | Purpose                                                                |
| -------------------- | ---------------------------------------------------------------------- |
| `DATABASE_URL`       | Postgres connection string (required at runtime)                       |
| `NEXTAUTH_SECRET`    | NextAuth signing secret                                                |
| `LLM_PROVIDER`       | Active LLM provider (default: `groq`)                                  |
| `GROQ_API_KEY`       | Groq API key (chat); `GROQ_API_KEY_QUIZ` for quiz generation           |
| `WORKER_SECRET`      | Shared secret between app and worker process                           |
| `INTERNAL_APP_URL`   | URL the worker uses to reach the app                                   |
| `EMBEDDING_MODEL_ID` | Hugging Face model for embeddings (default: `Xenova/all-MiniLM-L6-v2`) |
| `AUTH_PROVIDER`      | Auth provider: `credentials`, `cognito`, or `oidc`                     |

See `lib/env.ts` for the full list and all defaults.

### Observability

`lib/observability.ts` — `logApplicationError()` writes to `app_error_events` table. RAG traces (latency, similarity scores, refusals, possible hallucinations) are written to `rag_traces`. The Admin → System Health page surfaces both. The `rag_traces` table powers the Admin → Analytics observability panel.
