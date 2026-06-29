# NextElevate — Complete System Build Prompt

> Use this document as a comprehensive prompt to recreate the entire NextElevate platform from scratch. Each section is self-contained and can be handed to an AI coding assistant or development team as-is.

---

## Table of Contents

1. [Product Vision & Purpose](#1-product-vision--purpose)
2. [Tech Stack & Tooling](#2-tech-stack--tooling)
3. [Project Structure & File Layout](#3-project-structure--file-layout)
4. [Database Schema Design](#4-database-schema-design)
5. [Authentication System](#5-authentication-system)
6. [Role-Based Access Control](#6-role-based-access-control)
7. [Document Ingestion Pipeline](#7-document-ingestion-pipeline)
8. [RAG AI Chat Pipeline](#8-rag-ai-chat-pipeline)
9. [Quiz Generation & Assessment](#9-quiz-generation--assessment)
10. [Background Job Queue](#10-background-job-queue)
11. [External Document Connectors](#11-external-document-connectors)
12. [MCP Processing Pipeline](#12-mcp-processing-pipeline)
13. [AI Governance & Safety System](#13-ai-governance--safety-system)
14. [Admin UI Design](#14-admin-ui-design)
15. [Member UI Design](#15-member-ui-design)
16. [API Routes](#16-api-routes)
17. [LLM Provider Abstraction](#17-llm-provider-abstraction)
18. [File Storage](#18-file-storage)
19. [Observability & Health](#19-observability--health)
20. [Security Model](#20-security-model)
21. [Deployment & Environment](#21-deployment--environment)
22. [Design System & UI Conventions](#22-design-system--ui-conventions)

---

## 1. Product Vision & Purpose

Build **NextElevate** (also called Summit KT Portal) — a multi-role, multi-project **Knowledge Transfer (KT) platform** for enterprise teams undergoing structured transitions.

### Core Value Proposition

When teams hand off knowledge (project transitions, offboarding, restructuring), critical context lives in people's heads. NextElevate solves this by:

1. Centralising KT documents per project
2. Letting members chat with an AI grounded in those documents
3. Assessing readiness via AI-generated quizzes
4. Giving admins full visibility into completion, gaps, and engagement

### User Roles

| Role | Access | Typical Tasks |
|------|--------|---------------|
| **Super Admin** | All projects, all users | Create projects, upload docs, generate quizzes, manage users |
| **Project Admin** | Assigned project only | Upload docs, invite members, manage quiz sets |
| **Member** | Assigned projects | Read docs, chat with AI assistant, take readiness quiz |

### Key Workflows

- Admin uploads KT documents → system parses, redacts PII, chunks, embeds, stores
- Member opens chat → types question → AI retrieves relevant doc chunks → grounded answer
- Admin generates quiz → AI creates scenario-based questions from doc content
- Member takes quiz → system scores and shows gaps → admin views readiness dashboard
- Admin exports transcripts → system converts to structured KT documents

---

## 2. Tech Stack & Tooling

### Core Framework
- **Next.js 16** (App Router, React Server Components, Server Actions)
- **TypeScript** (strict mode, no `any`)
- **Tailwind CSS** with custom design tokens
- **Turbopack** for fast dev builds

### Backend & Database
- **PostgreSQL 13+** with:
  - `pgvector` extension — vector similarity search for RAG
  - `pgcrypto` extension — UUID generation
- **`postgres` npm package** — tagged-template SQL client (no ORM)
- Raw SQL only — no Prisma, no Drizzle, no Sequelize

### AI / LLM
- **Multi-provider LLM abstraction** — Groq (default), OpenAI, Anthropic, Azure OpenAI, Mistral, Ollama, GitHub Copilot
- **@xenova/transformers** — local embedding model (`Xenova/all-MiniLM-L6-v2`, 384-dim vectors)
- **@modelcontextprotocol/sdk** — MCP servers for document processing and RAG retrieval

### Authentication
- **NextAuth.js v4** — pluggable providers: credentials, AWS Cognito, OIDC (Keycloak)
- **bcrypt** — password hashing (cost factor 12)
- JWT sessions stored in `httpOnly` cookies

### Email
- **SendGrid** — transactional email for invites and password resets
- Fallback: console log in development

### File Storage
- **Cloudflare R2** (production) — S3-compatible object storage
- **Local filesystem** (development) — `public/uploads/`

### UI Components
- Custom component library (`components/ui/`) — Button, Card, Badge, Dialog, Tabs, etc.
- **Lucide React** for icons
- **Recharts** for analytics charts
- **react-markdown** + **remark-gfm** for rendering AI responses

### Testing
- **Vitest** for unit tests
- **Playwright** for e2e tests

### Code Quality
- **ESLint** — `@typescript-eslint/no-explicit-any: error` (no `any` allowed)
- **Prettier** — consistent formatting
- **lint-staged** — pre-commit hooks

---

## 3. Project Structure & File Layout

```
nextelevate/
├── app/
│   ├── (admin)/admin/          # Admin-only pages (requireAdmin guard)
│   │   ├── dashboard/
│   │   ├── users/
│   │   ├── projects/[id]/
│   │   ├── governance/         # AI governance pages
│   │   │   ├── page.tsx        # Overview dashboard
│   │   │   ├── policies/
│   │   │   ├── quotas/
│   │   │   ├── audit-logs/
│   │   │   ├── refusals/
│   │   │   └── violations/
│   │   └── health/             # System health
│   ├── (member)/               # Member-only pages (requireMember guard)
│   │   ├── dashboard/
│   │   └── projects/[id]/
│   │       ├── page.tsx
│   │       ├── chat/
│   │       └── quiz/
│   ├── api/
│   │   ├── auth/[...nextauth]/
│   │   ├── chat/               # Streaming RAG chat
│   │   ├── documents/
│   │   │   ├── upload/
│   │   │   ├── process/
│   │   │   └── view/
│   │   ├── jobs/
│   │   │   ├── [id]/           # Job status polling
│   │   │   └── worker/         # Worker endpoint
│   │   └── users/
│   │       └── lookup/         # Email-to-UUID lookup
│   └── actions/                # Server Actions
│       ├── governance.ts
│       ├── document-mcp.ts
│       └── cleanup.ts
├── components/
│   ├── ui/                     # Design system primitives
│   ├── admin/
│   │   ├── governance/         # Governance dialogs
│   │   └── document-upload-panel.tsx
│   ├── chat/
│   │   └── chat-interface.tsx
│   └── layout/
│       ├── admin-sidebar.tsx
│       └── member-sidebar.tsx
├── lib/
│   ├── auth.ts                 # requireAdmin, requireMember, requireProjectAdmin
│   ├── data.ts                 # All SQL queries
│   ├── db.ts                   # postgres client singleton
│   ├── env.ts                  # Environment variable validation
│   ├── llm/                    # LLM provider abstraction
│   │   ├── index.ts            # createChatCompletion, createQuizCompletion
│   │   └── runtime-config.ts   # DB-backed runtime config
│   ├── rag/
│   │   ├── chunking.ts
│   │   ├── embeddings.ts
│   │   └── retrieval.ts
│   ├── documents/
│   │   ├── parse.ts            # PDF, DOCX, XLSX, CSV extraction
│   │   ├── pii.ts              # PII redaction
│   │   ├── process.ts          # Chunk + embed + store
│   │   └── connectors.ts       # External connector sync
│   ├── safety/                 # AI Governance
│   │   ├── content-filters.ts
│   │   ├── quota-manager.ts
│   │   ├── audit-logger.ts
│   │   ├── refusal-detector.ts
│   │   └── governance-config.ts
│   ├── mcp/                    # MCP clients
│   │   ├── document-processor-client.ts
│   │   └── rag-retrieval-client.ts
│   ├── storage/
│   │   ├── r2.ts
│   │   └── local.ts
│   ├── memory.ts               # User memory extraction
│   ├── memory-store.ts         # User memory DB operations
│   ├── observability.ts        # Error logging, RAG traces
│   └── types/
│       └── database.ts         # All DB record types
├── mcp-servers/
│   ├── document-processor/     # MCP Phase 1
│   │   └── src/
│   │       ├── server.ts
│   │       └── utils/
│   │           ├── parser.ts
│   │           ├── pii.ts
│   │           ├── chunking.ts
│   │           └── sensitivity.ts
│   └── rag-retrieval/          # MCP Phase 2
│       └── src/
│           ├── server.ts
│           └── utils/
│               ├── embeddings.ts
│               ├── retrieval.ts
│               └── context.ts
├── postgres/
│   ├── schema.sql              # Full baseline schema
│   └── migrations/             # Incremental migrations (001–039)
├── worker/
│   └── index.mjs               # Background worker process
├── docs/
└── public/
```

---

## 4. Database Schema Design

### Requirements
- PostgreSQL 13+ with `pgvector` and `pgcrypto` extensions
- No ORM — all queries use `postgres` tagged templates
- All IDs are `uuid` with `gen_random_uuid()`
- All timestamps are `timestamptz`

### Core Tables

#### `users`
```sql
id            uuid PRIMARY KEY DEFAULT gen_random_uuid()
email         text NOT NULL
full_name     text
role          text NOT NULL DEFAULT 'member' -- 'admin' | 'member'
password_hash text          -- null for SSO users
auth_provider text NOT NULL DEFAULT 'credentials'
is_active     boolean NOT NULL DEFAULT true
created_at    timestamptz NOT NULL DEFAULT now()
last_login_at timestamptz
UNIQUE (email, auth_provider)
```

#### `projects`
```sql
id             uuid PRIMARY KEY
name           text NOT NULL
description    text
created_by     uuid REFERENCES users(id)
is_active      boolean NOT NULL DEFAULT true
pass_threshold integer NOT NULL DEFAULT 60
quiz_open_at   timestamptz
quiz_close_at  timestamptz
```

#### `project_members`
```sql
id          uuid PRIMARY KEY
project_id  uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE
user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE
role        text NOT NULL DEFAULT 'member' -- 'member' | 'admin'
assigned_at timestamptz NOT NULL DEFAULT now()
UNIQUE (project_id, user_id)
```

#### `documents`
```sql
id                  uuid PRIMARY KEY
project_id          uuid NOT NULL REFERENCES projects(id)
file_name           text NOT NULL
file_url            text NOT NULL
file_type           text NOT NULL
uploaded_by         uuid REFERENCES users(id)
uploaded_at         timestamptz NOT NULL DEFAULT now()
chunk_count         integer NOT NULL DEFAULT 0
pii_detections      integer NOT NULL DEFAULT 0
classification      text NOT NULL DEFAULT 'public'
  CHECK (classification IN ('public', 'internal', 'confidential'))
is_required         boolean NOT NULL DEFAULT false
scan_flags          text[] NOT NULL DEFAULT '{}'
source_connector_id uuid REFERENCES document_connectors(id)
source_provider     text
source_item_id      text
source_url          text
```

#### `document_chunks`
```sql
id                       uuid PRIMARY KEY
document_id              uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE
project_id               uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE
content                  text NOT NULL
search_vector            tsvector              -- full-text search
embedding                vector(384)           -- pgvector embedding
embedding_model_id       text NOT NULL         -- e.g. 'Xenova/all-MiniLM-L6-v2'
embedding_model_revision text NOT NULL
chunk_index              integer NOT NULL
created_at               timestamptz NOT NULL DEFAULT now()
```

#### `document_canonical_sources`
```sql
document_id       uuid PRIMARY KEY REFERENCES documents(id)
project_id        uuid NOT NULL REFERENCES projects(id)
canonical_content text NOT NULL    -- original text before PII redaction
content_sha256    text NOT NULL    -- dedup hash
```

#### `chat_sessions`
```sql
id              uuid PRIMARY KEY
user_id         uuid NOT NULL REFERENCES users(id)
project_id      uuid NOT NULL REFERENCES projects(id)
title           text
message_count   integer NOT NULL DEFAULT 0
last_message_at timestamptz
```

#### `chat_messages`
```sql
id         uuid PRIMARY KEY
session_id uuid NOT NULL REFERENCES chat_sessions(id)
role       text NOT NULL -- 'user' | 'assistant'
content    text NOT NULL
sources    jsonb         -- array of { document_name, document_id, similarity }
created_at timestamptz NOT NULL DEFAULT now()
```

#### `quiz_sets`
```sql
id         uuid PRIMARY KEY
project_id uuid NOT NULL REFERENCES projects(id)
set_name   text NOT NULL
set_number integer NOT NULL
is_active  boolean NOT NULL DEFAULT true
category   text NOT NULL DEFAULT 'general' -- 'functional' | 'technical'
UNIQUE (project_id, set_number)
```

#### `quiz_questions`
```sql
id             uuid PRIMARY KEY
quiz_set_id    uuid NOT NULL REFERENCES quiz_sets(id)
question_text  text NOT NULL
question_type  text NOT NULL DEFAULT 'mcq' -- 'mcq' | 'true_false'
option_a       text NOT NULL
option_b       text NOT NULL
option_c       text NOT NULL
option_d       text NOT NULL
correct_option text NOT NULL -- 'A' | 'B' | 'C' | 'D'
explanation    text
marks          integer NOT NULL DEFAULT 1
```

#### `quiz_attempts`
```sql
id                 uuid PRIMARY KEY
user_id            uuid NOT NULL REFERENCES users(id)
project_id         uuid NOT NULL REFERENCES projects(id)
quiz_set_id        uuid NOT NULL REFERENCES quiz_sets(id)
assigned_questions jsonb NOT NULL
answers_given      jsonb
score              integer
total_marks        integer
percentage         numeric(5,2)
passed             boolean
status             text NOT NULL DEFAULT 'in_progress' -- 'in_progress' | 'submitted'
```

#### `processing_jobs`
```sql
id           uuid PRIMARY KEY
type         text NOT NULL
  CHECK (type IN ('document_process', 'quiz_generate', 'connector_sync', 'bot_thread_reply'))
status       text NOT NULL DEFAULT 'pending'
  CHECK (status IN ('pending', 'running', 'done', 'failed'))
payload      jsonb NOT NULL DEFAULT '{}'
result       jsonb
error        text
created_at   timestamptz NOT NULL DEFAULT now()
started_at   timestamptz
completed_at timestamptz
```

#### `document_connectors`
```sql
id                uuid PRIMARY KEY
project_id        uuid NOT NULL REFERENCES projects(id)
provider          text NOT NULL
  CHECK (provider IN ('confluence', 'sharepoint', 'jira', 'monday', 'onedrive', 'github'))
name              text NOT NULL
config            jsonb NOT NULL DEFAULT '{}'
is_active         boolean NOT NULL DEFAULT true
auto_sync_enabled boolean NOT NULL DEFAULT true
last_synced_at    timestamptz
last_sync_status  text NOT NULL DEFAULT 'idle'
```

#### `rag_traces`
```sql
id                     uuid PRIMARY KEY
project_id             uuid REFERENCES projects(id)
user_id                uuid REFERENCES users(id)
session_id             uuid REFERENCES chat_sessions(id)
query_text             text NOT NULL
chunks_retrieved       integer NOT NULL DEFAULT 0
max_similarity         numeric(6,4)
avg_similarity         numeric(6,4)
retrieval_hit          boolean NOT NULL DEFAULT false
retrieval_ms           integer
model_used             text
prompt_tokens          integer
completion_tokens      integer
total_ms               integer
answer_refused         boolean NOT NULL DEFAULT false
possible_hallucination boolean NOT NULL DEFAULT false
is_slow                boolean GENERATED ALWAYS AS (total_ms > 8000) STORED
```

### AI Governance Tables

```sql
-- Governance policies (global or project-scoped)
governance_policies (
  id uuid PK, project_id uuid (nullable), policy_type text, config jsonb,
  enabled boolean, created_by uuid, created_at, updated_at,
  UNIQUE (project_id, policy_type)
)

-- Per-user quotas
user_quotas (
  id uuid PK, user_id uuid, project_id uuid, quota_period text,
  tokens_limit integer, tokens_used integer,
  cost_limit numeric, cost_used numeric, reset_at timestamptz,
  UNIQUE (user_id, project_id, quota_period)
)

-- LLM interaction audit log
llm_interaction_audit_log (
  id uuid PK, project_id uuid, user_id uuid, session_id uuid,
  interaction_type text, request_content text, response_content text,
  model_used text, provider text, cost_estimate numeric, status text,
  prompt_tokens integer, completion_tokens integer, total_tokens integer
)

-- LLM refusal log
refusal_log (
  id uuid PK, project_id uuid, user_id uuid, audit_log_id uuid,
  refusal_reason text, user_query text, llm_refusal_text text, metadata jsonb
)

-- Content filter violations
content_filter_violations (
  id uuid PK, project_id uuid, user_id uuid,
  filter_type text, violation_severity text, detected_content text,
  status text DEFAULT 'pending', reviewed_by uuid, reviewed_at timestamptz
)
```

### Key PostgreSQL Functions

```sql
-- Atomic job claiming (FOR UPDATE SKIP LOCKED)
create function claim_next_pending_job() returns setof processing_jobs

-- Vector similarity search
create function match_document_chunks(
  query_embedding vector(384), filter_project_id uuid, match_count int
) returns table (id uuid, content text, document_id uuid, document_name text, similarity float)

-- Governance KPI summary
create function get_governance_summary(filter_project_id uuid, days_back int)
returns table (total_interactions bigint, refusals_count bigint, ...)
```

---

## 5. Authentication System

### Multi-Provider Architecture

The active provider is set via `AUTH_PROVIDER` environment variable.

**Credentials Provider (`credentials`):**
- Email + password login
- bcrypt password verification
- Supports password reset via SendGrid email

**AWS Cognito Provider (`cognito`):**
- OIDC-compliant Cognito User Pool
- Requires `COGNITO_CLIENT_ID`, `COGNITO_CLIENT_SECRET`, `COGNITO_ISSUER`

**OIDC Provider (`oidc`):**
- Any OIDC-compliant IdP (Keycloak, Auth0, Okta)
- Requires `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`, `OIDC_ISSUER`

### Session Design
- NextAuth JWT strategy — stateless sessions
- JWT stored in `httpOnly`, `Secure`, `SameSite=Lax` cookie
- Session includes: `userId`, `role`, `email`, `name`

### Auth Guards in `lib/auth.ts`
```typescript
requireAdmin()              // Super admin only → redirects to /dashboard if not
requireMember()             // Member only → redirects to /admin/dashboard if admin
requireProjectAdmin(id)     // Global admin OR project-level admin for this project
requireAnyAdmin()           // Global admin OR any project admin
```

### Invite Flow
1. Admin creates invite token (linked to email + optional project)
2. SendGrid sends invite email with token URL
3. User clicks link → register page pre-filled → creates account + joins project

### Password Reset Flow
1. User requests reset → token stored in `password_reset_tokens` table
2. SendGrid sends reset email with token URL (expires in 1 hour)
3. User sets new password → token deleted

---

## 6. Role-Based Access Control

### Two-Level Role System

**Level 1 — Global role** (on `users` table):
- `admin` — can access all projects, all admin pages
- `member` — can only access assigned projects

**Level 2 — Project role** (on `project_members` table):
- `admin` — can manage this specific project (upload docs, manage members)
- `member` — read-only access to project

### Access Matrix

| Action | Super Admin | Project Admin | Member |
|--------|-------------|---------------|--------|
| Create/delete projects | ✅ | ❌ | ❌ |
| Manage all users | ✅ | ❌ | ❌ |
| Upload documents | ✅ | ✅ (own project) | ❌ |
| Generate quizzes | ✅ | ✅ (own project) | ❌ |
| View analytics | ✅ (all) | ✅ (own project) | ❌ |
| Chat with AI | ✅ | ✅ | ✅ |
| Take quiz | ❌ | ❌ | ✅ |
| View documents | ✅ | ✅ | ✅ (assigned) |
| View AI governance | ✅ | ❌ | ❌ |

### Route Groups
- `app/(admin)/admin/` — guarded by `requireAdmin()` or `requireAnyAdmin()`
- `app/(member)/` — guarded by `requireMember()`

---

## 7. Document Ingestion Pipeline

### Upload Flow

```
1. Admin selects files (PDF, DOCX, XLSX, PPTX, TXT, CSV)
2. Browser → POST /api/documents/upload
   - validateOrigin() (CSRF protection)
   - validateUploadedFile() (MIME + size check)
   - Store file in R2 or local filesystem
   - INSERT into documents table (chunk_count = 0)
3. Browser → POST /api/documents/process
   - INSERT into processing_jobs (type = 'document_process')
   - Fire-and-forget trigger to /api/jobs/worker
4. Browser polls GET /api/jobs/[id] every 3 seconds
5. Background worker picks up job → processes document
6. Browser shows progress → updates to "Ready" when done
```

### Document Processing (Worker)

```
1. Download file from storage
2. Extract text based on file type:
   - PDF → pdf-parse
   - DOCX → mammoth / custom XML extraction
   - XLSX → xlsx library → CSV conversion
   - CSV → papaparse
   - TXT → direct read
3. Store canonical content (original text) in document_canonical_sources
4. Redact PII from text (email, SSN, credit card, phone patterns)
5. Split into overlapping chunks (1000 chars, 100 char overlap, sentence boundaries)
6. Embed each chunk with @xenova/transformers (all-MiniLM-L6-v2)
7. Store chunks in document_chunks with embedding vector
8. Update document.chunk_count
```

### MCP-Enhanced Processing (when `MCP_DOCUMENT_PROCESSOR_ENABLED=true`)

The worker calls the Document Processor MCP server instead:
1. `scan_sensitivity` → classify as public/internal/confidential/restricted
2. `redact_pii` → remove PII with confidence scores
3. `chunk_text` → overlapping sentence-aware chunks
4. Store chunks in `document_chunks`
5. Update `documents.classification`, `pii_detections`, `chunk_count`
6. Falls back to direct processing if MCP server fails

### Embedding Model Consistency

- Each project's chunks must use the same embedding model
- `embedding_model_id` and `embedding_model_revision` stored per chunk
- If model changes: all existing chunks for that project must be re-embedded
- `retrieveRelevantChunks()` asserts model consistency before search

---

## 8. RAG AI Chat Pipeline

### Chat Request Flow

```
POST /api/chat
├── validateOrigin()
├── requireAuthenticatedUser()
├── checkRateLimit() → 429 if exceeded
├── getUserMemories() → relevant past context
├── retrieveRelevantChunks(projectId, message)
│   ├── embed query with @xenova/transformers
│   └── SELECT from document_chunks ORDER BY embedding <=> query_embedding
│       (cosine similarity, pgvector)
├── Confidence gate: if max_similarity < 0.2 → return NOT_FOUND_MSG
├── Build context string from top chunks
├── Build system prompt (KT persona + context + user memories)
├── createChatCompletion(messages, streaming=true)
│   └── Provider: Groq | OpenAI | Anthropic | etc.
├── Stream response to browser via ReadableStream
├── [Async, fire-and-forget]:
│   ├── saveMessage() → insert into chat_messages with sources
│   ├── writeRagTrace() → observability log
│   ├── extractMemoryIntent() → detect "remember X" phrases
│   ├── detectLlmRefusal() → check if model refused
│   ├── queueAuditLog() → governance audit
│   └── filterOutputContent() → output safety check
└── Return streamed response
```

### Context Building

- Retrieve top 5 chunks by cosine similarity
- Filter by `min_similarity = 0.2` (below = "no relevant docs")
- Format: `[Source: filename]\n{chunk_content}`
- Include user memories relevant to the query
- Include last 20 chat messages as history

### Response Streaming

- Use `ReadableStream` with `TextEncoder`
- Stream tokens as they arrive from LLM provider
- Final chunk includes `[DONE]` signal with sources array
- Frontend reads stream, renders markdown progressively

### MCP-Enhanced Retrieval (when `MCP_RAG_RETRIEVAL_ENABLED=true`)

1. `search_chunks(query, projectId, topK=8)` → embed + cosine search
2. `rerank_results(query, chunks)` → keyword-boosted reranking
3. Top 5 chunks used as LLM context
4. Falls back to direct `retrieveRelevantChunks()` if MCP fails

### User Memory System

- Detect "remember X" phrases in user messages
- Store key-value memories in `user_memories` per user per project
- Retrieve relevant memories (top 5 by semantic relevance) for each chat
- Confirmation flow: ask user to confirm before storing sensitive memories

---

## 9. Quiz Generation & Assessment

### Generation Flow

```
Admin clicks "Generate Quiz"
→ POST /api/quiz/generate
→ INSERT into processing_jobs (type = 'quiz_generate', payload = { projectId, category, numSets })
→ Worker picks up job:
  1. SELECT content FROM document_chunks WHERE project_id = ? LIMIT 30
  2. Shuffle chunks, split into N groups (one per set)
  3. For each group:
     a. Build system prompt (functional or technical category)
     b. Build user prompt with 300-char excerpts
     c. Call createQuizCompletion() → JSON with 10 questions
     d. Parse and validate questions
     e. INSERT into quiz_sets + quiz_questions
```

### Question Format

```json
{
  "question_text": "A stakeholder requests X — what is the correct process?",
  "question_type": "mcq",
  "option_a": "...",
  "option_b": "...",
  "option_c": "...",
  "option_d": "...",
  "correct_option": "A",
  "explanation": "Because...",
  "marks": 2
}
```

- `mcq` questions: 4 options, `marks` = 2 or 3
- `true_false` questions: option_a="True", option_b="False", `marks` = 1
- At least 40% of questions must be `marks=3` (analysis-level)
- At least 70% must be `mcq` type

### Assessment Flow

1. Member clicks "Start Quiz"
2. System assigns 15 random questions from active quiz sets
3. Member answers each question
4. On submit: calculate score, percentage, passed/failed
5. System generates AI coaching plan for weak areas
6. One attempt per project per user (can be reset by admin)
7. Admin views readiness dashboard with pass/fail breakdown

### Quiz Categories

- **Functional** — business workflows, process ownership, escalation paths, SLAs
- **Technical** — system architecture, APIs, data models, failure modes

---

## 10. Background Job Queue

### Design Principles

- Postgres-backed queue (no Redis, no RabbitMQ)
- Worker is a **separate Node.js process** (`worker/index.mjs`)
- Atomic job claiming via `FOR UPDATE SKIP LOCKED` prevents double-processing
- Fire-and-forget trigger from API routes
- Worker polls every 1000ms

### Worker Process (`worker/index.mjs`)

```javascript
// Polls POST /api/jobs/worker every 1000ms
// The worker route atomically claims the next pending job
// Processes: document_process | quiz_generate | connector_sync | bot_thread_reply
// On success: marks job as 'done' with result JSON
// On failure: marks job as 'failed' with error stack
// Stuck jobs (running > 10 min) are automatically reset to 'pending'
```

### Job Types

| Type | Triggered By | What It Does |
|------|-------------|--------------|
| `document_process` | Document upload | Parse → chunk → embed → store |
| `quiz_generate` | Admin action | LLM generates quiz questions from chunks |
| `connector_sync` | Schedule/manual | Pull documents from external connector |
| `bot_thread_reply` | Document thread | AI replies to discussion thread question |

### Production Without Long-Running Process

On Vercel/serverless: use Supabase `pg_cron` to call `POST /api/jobs/worker` on a schedule. The worker route handles one job per invocation.

---

## 11. External Document Connectors

### Supported Providers

| Provider | Auth Method | What It Syncs |
|----------|-------------|---------------|
| **GitHub** | Personal Access Token | `.md`, `.txt`, `.pdf` files from repo |
| **OneDrive** | OAuth2 (client credentials) | Files from specified folder |
| **Confluence** | API token | Pages from specified space |
| **SharePoint** | OAuth2 | Files from document library |
| **Jira** | API token | Issue descriptions and comments |
| **Monday.com** | API token | Board items and updates |

### Sync Flow

1. Admin configures connector (provider + credentials + config)
2. System stores encrypted config in `document_connectors.config` jsonb
3. Auto-sync runs every 24 hours (configurable via `CONNECTOR_AUTO_SYNC_INTERVAL_HOURS`)
4. Sync compares `source_item_id` to detect new/updated/deleted items
5. New items: download content → canonical source → process as document
6. Documents linked to connector via `source_connector_id`

### GitHub Connector (Direct, No Worker)

GitHub connector processes files synchronously during sync (no background job needed) because GitHub API returns content directly. All other connectors use the job queue.

---

## 12. MCP Processing Pipeline

### Overview

NextElevate uses **Model Context Protocol (MCP)** to run AI processing in standalone servers. Both servers use **stdio transport** and are **auto-spawned** by the Next.js app as child processes.

### Phase 1: Document Processor MCP (`mcp-servers/document-processor/`)

**Enable:** `MCP_DOCUMENT_PROCESSOR_ENABLED=true`

**Tools:**

| Tool | Input | Output |
|------|-------|--------|
| `parse_document` | `mimeType`, `fileBase64` | `text`, `pages`, `wordCount` |
| `redact_pii` | `text`, `patternTypes?` | `redacted_text`, `violations[]` |
| `chunk_text` | `text`, `chunkSize?`, `overlapSize?` | `chunks[]`, `total_chunks` |
| `scan_sensitivity` | `text` | `level`, `confidence`, `indicators[]` |

**Sensitivity levels:** `public` → `internal` → `confidential` → `restricted`
**PII types:** email, SSN, credit card, phone number

### Phase 2: RAG Retrieval MCP (`mcp-servers/rag-retrieval/`)

**Enable:** `MCP_RAG_RETRIEVAL_ENABLED=true`

**Tools:**

| Tool | Input | Output |
|------|-------|--------|
| `embed_text` | `text` | `embedding[]` (384-dim) |
| `search_chunks` | `query`, `projectId`, `topK?` | `chunks[]`, `total_found` |
| `rerank_results` | `query`, `chunks[]` | `reranked_chunks[]` |
| `build_context` | `chunks[]`, `maxTokens?` | `context`, `sources[]` |

### Client Pattern

```typescript
// lib/mcp/document-processor-client.ts
const transport = new StdioClientTransport({
  command: 'node',
  args: ['mcp-servers/document-processor/dist/server.js'],
});
const client = new Client({ name: 'nextelevate', version: '1.0.0' });
await client.connect(transport);
```

### Fallback Strategy

Both MCP integrations silently fall back to the existing direct implementation if the server fails — chat and document processing always work.

---

## 13. AI Governance & Safety System

### Design Principle

**All operations are non-blocking** — governance failures never interrupt chat flow. Only quota checks block (HTTP 429). Everything else is async fire-and-forget.

### Six Pillars

#### 1. Content Filtering (`lib/safety/content-filters.ts`)

```typescript
filterContent(text: string, policy: FilterPolicy): {
  blocked: boolean;
  severity: 'low' | 'medium' | 'high';
  violations: ContentViolation[];
}
```

- **PII Detection:** email regex, SSN `\d{3}-\d{2}-\d{4}`, credit cards 13-19 digits, US phone patterns
- **Jailbreak Detection:** 12 patterns covering role-play, DAN, token counting, bypass attempts
- **Custom Keywords:** admin-configurable blocked keywords and regex patterns
- **Confidence Scoring:** 0–100 per violation
- Applied to both input (user message) and output (LLM response)

#### 2. Usage Quotas (`lib/safety/quota-manager.ts`)

```typescript
checkQuotaAllowed(userId, projectId, estimatedTokens): Promise<{ allowed: boolean; reason? }>
consumeQuota(userId, projectId, inputTokens, outputTokens, cost): Promise<void>
```

- Daily and monthly limits per user per project
- Token estimation: `~4 chars = 1 token`
- Cost estimation by provider (Groq: $0.05/1M input, OpenAI: $5/1M, Anthropic: $3/1M)
- Returns HTTP 429 when exceeded — only blocking governance operation

#### 3. Refusal Tracking (`lib/safety/refusal-detector.ts`)

- Monitors `finish_reason` from LLM response
- Pattern-matches response text for safety disclaimers
- Categories: `unsafe_content`, `policy_violation`, `token_limit`, `context_length`, `unknown`
- Logs to `refusal_log` table async

#### 4. Audit Logging (`lib/safety/audit-logger.ts`)

- Logs every LLM interaction to `llm_interaction_audit_log`
- Non-blocking: `queueAuditLog()` writes directly to DB async
- Captures: user, project, session, model, provider, tokens, cost, latency, status
- Admin can export as CSV for compliance

#### 5. Model Behavior Constraints (`lib/safety/governance-config.ts`)

- Per-policy config: `max_tokens`, `temperature`, `top_p`, `system_prompt_override`
- Types: `global_default`, `project_default`, `model_specific`
- 5-minute in-memory TTL cache reduces DB queries

#### 6. Admin Governance Controls

**Server Actions (`app/actions/governance.ts`):**
```typescript
fetchGovernancePolicies(projectId)
updateGovernancePolicy(projectId, policyType, config, enabled)
removeGovernancePolicy(projectId, policyType)
fetchUserQuotas(projectId)
updateUserQuota(userId, projectId, period, tokensLimit, costLimit)
fetchAuditLogs(projectId, filters?)
fetchRefusalsWithBreakdown(projectId, days?)
fetchContentViolations(projectId, options?)
bulkDismissViolations(projectId, severity)
```

### Integration in Chat Route

```
1. checkQuotaAllowed()         ← BLOCKING: 429 if exceeded
2. filterContent(input)        ← async, fire-and-forget
3. LLM call
4. detectLlmRefusal()         ← async
5. filterContent(output)       ← sync regex <10ms
6. queueAuditLog()            ← async, fire-and-forget
```

---

## 14. Admin UI Design

### Layout

- Left sidebar (collapsible on mobile)
- Sidebar sections: Dashboard, Products, AI Document Generator, Search Docs, Threads, System Health, Model Switcher, AI Governance, Users
- Top navbar: breadcrumb, user avatar, logout

### Admin Sidebar Navigation

```
Dashboard          → /admin/dashboard
Products           → /admin/projects (list all projects as "Products")
AI Document Gen    → /admin/ai-document-generator
Search Docs        → /admin/search
Threads            → /admin/threads (with unread badge)
System Health      → /admin/health
Model Switcher     → /admin/model-switcher
AI Governance      → /admin/governance
Users              → /admin/users
```

### Project Detail Page (`/admin/projects/[id]`)

Split into tabs:
- **Overview** — stats cards (documents, members, quiz sets, pass threshold)
- **Members** — table with role management
- **Analytics** — RAG trace charts, quiz performance
- **Quest** (Quiz) — quiz sets, generate button, activate/deactivate
- **Documents & Connectors** — upload panel, document list, connector setup

### Document Upload Panel (`components/admin/document-upload-panel.tsx`)

- Drag-and-drop zone + file picker
- Accepted: PDF, DOCX, XLSX, PPTX, TXT, CSV
- Queue display: pending → uploading → processing → done/error
- Real-time status polling every 3 seconds
- Shows spinner during processing, checkmark when ready
- `router.refresh()` when job completes to update document list

### Governance UI (`/admin/governance/*`)

- **Overview** — 7-day KPI cards: total interactions, refusals, violations, quota exceeded
- **Policies** — list with toggle enable/disable, filter test tool, JSON config viewer
- **Quotas** — per-user table with progress bars, inline edit, reset button
- **Audit Logs** — paginated (50/page), filter by status/user, CSV export
- **Refusals** — pie chart by reason, time period selector, recent refusals stream
- **Violations** — severity-coded cards, bulk dismiss, individual review/escalate

---

## 15. Member UI Design

### Layout

- Top navbar with project switcher
- No persistent sidebar (clean reading UX)

### Dashboard (`/dashboard`)

- Grid of project cards
- Each card: project name, description, member count, quiz status, pass threshold
- "Active" badge for open quiz windows

### Project Page (`/projects/[id]`)

- Tabs: Documents, Chat, Quiz

### Chat Interface (`/projects/[id]/chat`)

- Message thread (assistant messages with markdown rendering)
- Source tags below each answer (linked to document chunks)
- Session list in sidebar (past conversations)
- Bookmark button on each AI message
- Response style selector: Default, Concise, Step-by-step, Bullet list
- Memory confirmation prompt when AI detects "remember X"

### Quiz Experience (`/projects/[id]/quiz`)

- One question at a time with progress indicator
- MCQ: four option buttons
- True/False: two option buttons
- Submit when all answered
- Results page: score, percentage, pass/fail, per-question breakdown
- AI coaching plan for wrong answers

---

## 16. API Routes

### Document Routes
- `POST /api/documents/upload` — upload file to storage, create DB record
- `POST /api/documents/process` — queue document processing job
- `GET /api/documents/view?documentId=` — get signed/gated file URL

### Chat Routes
- `GET /api/chat?sessionId=` — fetch message history
- `POST /api/chat` — streaming RAG chat (Server-Sent Events)

### Job Routes
- `GET /api/jobs/[id]` — poll job status
- `POST /api/jobs/worker` — worker endpoint (authenticated by `WORKER_SECRET`)

### User Routes
- `GET /api/users/lookup?email=` — resolve email → user UUID (admin only)

### Quiz Routes
- `POST /api/quiz/generate` — queue quiz generation job
- `GET /api/quiz/[setId]` — get questions for a quiz set
- `POST /api/quiz/[attemptId]/submit` — submit answers

### Auth Routes (NextAuth)
- `POST /api/auth/[...nextauth]` — NextAuth handler
- `POST /api/auth/register` — self-registration (rate-limited)
- `POST /api/auth/forgot-password` — send reset email
- `POST /api/auth/reset-password` — apply new password

---

## 17. LLM Provider Abstraction

### Interface (`lib/llm/index.ts`)

```typescript
createChatCompletion(params: {
  messages: { role: string; content: string }[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}): Promise<LLMResponse>

createQuizCompletion(params: {
  messages: { role: string; content: string }[];
  response_format: { type: 'json_object' };
  temperature?: number;
  max_tokens?: number;
}): Promise<LLMResponse>
```

### Supported Providers

| Provider | Env Key | Default Model |
|----------|---------|---------------|
| `groq` | `GROQ_API_KEY` | `llama-3.3-70b-versatile` |
| `openai` | `OPENAI_API_KEY` | `gpt-4o` |
| `azure-openai` | `AZURE_OPENAI_API_KEY` | configured |
| `anthropic` | `ANTHROPIC_API_KEY` | `claude-sonnet-4-6` |
| `mistral` | `MISTRAL_API_KEY` | `mistral-large-latest` |
| `ollama` | — | `llama3` (local) |
| `copilot` | `COPILOT_PROXY_TOKEN` | `openai/gpt-4.1-mini` |

### Runtime Configuration

Provider and model can be changed at runtime via:
1. Admin → Model Switcher UI → stores in `app_settings` table
2. `getLlmRuntimeConfig()` reads DB first, falls back to env vars
3. Cache invalidated when admin saves new config

### Two Separate LLM Configs

- **Chat LLM** — `LLM_PROVIDER` + `GROQ_API_KEY` — for member chat
- **Quiz LLM** — `LLM_PROVIDER_QUIZ` + `GROQ_API_KEY_QUIZ` — for quiz generation (different rate limit)

---

## 18. File Storage

### Local Storage (`lib/storage/local.ts`)

- Development default
- Stores files at `public/uploads/{projectId}/{filename}`
- Served directly by Next.js static file handler

### Cloudflare R2 (`lib/storage/r2.ts`)

- Production default when `R2_ACCOUNT_ID` + `R2_BUCKET_NAME` are set
- Compatible with AWS S3 SDK
- Files stored at `{projectId}/{timestamp}-{filename}`
- Signed URLs for access (not public)

### File Validation (`lib/security.ts`)

```typescript
validateUploadedFile(file: File): Promise<string | null>
```

- Allowed types: PDF, DOCX, XLSX, PPTX, TXT, CSV
- Max file size: 50MB
- MIME type verification

---

## 19. Observability & Health

### Application Error Logging (`lib/observability.ts`)

```typescript
logApplicationError({
  source: 'worker' | 'api' | 'rag' | ...,
  category: string,
  message: string,
  stack?: string,
  metadata?: Record<string, unknown>
})
```

Writes to `app_error_events` table. Visible in Admin → System Health.

### RAG Trace Logging

Every chat request writes to `rag_traces`:
- Query text, chunks retrieved, max/avg similarity
- Retrieval latency, generation latency, total latency
- Model used, token counts
- Flags: `retrieval_hit`, `answer_refused`, `possible_hallucination`, `is_slow`

### System Health Page (`/admin/health`)

- Recent error events with source, category, message, timestamp
- Error count per category (last 24h)
- RAG trace analytics panel with charts

### Analytics Page (`/admin/projects/[id]/analytics`)

- Retrieval hit rate over time
- Average similarity scores
- Refusal and hallucination flags
- Slow request tracking (>8 seconds)

---

## 20. Security Model

| Concern | Mitigation |
|---------|-----------|
| Password storage | bcrypt, cost factor 12 |
| Session tokens | JWT in `httpOnly` + `Secure` + `SameSite=Lax` cookie |
| Route protection | Server-side role guards on every page before data fetch |
| CSRF | NextAuth CSRF token on all forms + `validateOrigin()` in API routes |
| SQL injection | `postgres.js` tagged templates (parameterised by default) |
| File uploads | MIME type + extension allowlist, 50MB size limit |
| PII in documents | Regex scan before embedding, redacted text stored |
| Rate limiting | In-memory rate limiter on auth endpoints |
| Worker authentication | `WORKER_SECRET` header validated on every worker request |
| Project isolation | `requireProjectAdmin(projectId)` checks both global role and membership |
| Document access | `userHasProjectAccess()` checked before returning signed URLs |
| LLM safety | Content filtering on input and output (async, non-blocking) |
| Quota enforcement | Token/cost limits enforced per user per project (blocking on exceed) |

---

## 21. Deployment & Environment

### Required Environment Variables

```bash
# Database
DATABASE_URL=postgresql://user:password@host:5432/nextelevate

# Authentication
NEXTAUTH_SECRET=your-secret-key
NEXTAUTH_URL=https://your-domain.com
AUTH_PROVIDER=credentials  # credentials | cognito | oidc

# LLM
LLM_PROVIDER=groq
GROQ_API_KEY=gsk_...
GROQ_API_KEY_QUIZ=gsk_...  # optional separate key for quiz generation

# Worker
WORKER_SECRET=your-worker-secret
INTERNAL_APP_URL=https://your-domain.com

# Embedding
EMBEDDING_MODEL_ID=Xenova/all-MiniLM-L6-v2
EMBEDDING_MODEL_REVISION=main

# Storage (optional — defaults to local)
R2_ACCOUNT_ID=...
R2_BUCKET_NAME=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...

# Email (optional)
SENDGRID_API_KEY=SG...
EMAIL_FROM=noreply@your-domain.com

# MCP (optional)
MCP_DOCUMENT_PROCESSOR_ENABLED=true
MCP_RAG_RETRIEVAL_ENABLED=true

# Governance (optional)
GOVERNANCE_ENABLED=true
AUDIT_LOGGING_ENABLED=true
CONTENT_FILTER_ENABLED=true
QUOTA_ENFORCEMENT_ENABLED=true
```

### Development Setup

```bash
# Terminal 1: Next.js dev server
npm run dev

# Terminal 2: Background worker
$env:INTERNAL_APP_URL="http://localhost:3000"
$env:WORKER_SECRET="dev-secret"
npm run worker

# Database migrations
npm run db:migrate

# MCP server builds
cd mcp-servers/document-processor && npm install && npm run build
cd mcp-servers/rag-retrieval && npm install && npm run build
```

### Production (Single Server with PM2)

```javascript
// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'nextelevate',
      script: 'node_modules/.bin/next',
      args: 'start',
      instances: 2,
      env: { NODE_ENV: 'production', PORT: 3000 }
    },
    {
      name: 'nextelevate-worker',
      script: 'worker/index.mjs',
      instances: 1,
      env: { INTERNAL_APP_URL: 'http://localhost:3000', WORKER_SECRET: '...' }
    }
  ]
}
```

### Database Setup

```sql
-- Run once in psql
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Apply baseline schema
\i postgres/schema.sql

-- Then apply all migrations
npm run db:migrate

-- Promote first user to admin
UPDATE users SET role = 'admin' WHERE email = 'your-admin@company.com';
```

---

## 22. Design System & UI Conventions

### Color Palette

```css
/* Brand */
--brand-50: #eff6ff;
--brand-500: #3b82f6;
--brand-600: #2563eb;

/* Accent */
--accent-50: #f0fdf4;
--accent-400: #4ade80;
--accent-600: #16a34a;

/* Neutral */
--slate-50 through --slate-950
```

### Typography

- Font: Geist Sans (heading), Geist Mono (code)
- Body: `text-slate-700`, `text-sm`
- Headings: `text-slate-950`, `font-semibold`

### Component Conventions

```typescript
// Button variants
<Button variant="primary">   // Blue fill
<Button variant="secondary"> // Grey fill
<Button variant="ghost">     // Transparent
<Button variant="danger">    // Red fill
<Button size="sm" | "md" | "lg">

// Cards
<Card><CardHeader><CardTitle>
<CardContent>

// Status badges
<Badge variant="success">  // Green
<Badge variant="warning">  // Yellow
<Badge variant="error">    // Red
<Badge variant="neutral">  // Grey
```

### Routing Conventions

- `app/(admin)/admin/[section]/page.tsx` — admin pages
- `app/(member)/projects/[id]/[section]/page.tsx` — member pages
- Use `generateMetadata()` for page titles
- Breadcrumb pattern: `Products > Project Name > Section`

### Data Fetching Conventions

- **Server Components** — fetch directly in page component using `lib/data.ts`
- **Client Components** — use Server Actions from `app/actions/`
- **No API calls from Server Components** — use direct `sql` queries
- **Client mutations** — always via Server Actions (never fetch from client to internal APIs)

### Error Handling

- Auth errors → redirect (handled by `requireXxx()` functions)
- Data errors → `null` returns with fallback UI
- Background errors → logged to `app_error_events`, never thrown to UI
- Worker errors → job marked `failed`, visible in job status polling

---

## Appendix: Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| No ORM | Full control over queries, pgvector operations, and performance |
| Local embeddings | No API cost, no latency, works offline, consistent across environments |
| Postgres job queue | No external dependencies (Redis, RabbitMQ), simpler ops |
| Non-blocking governance | LLM safety checks never degrade user experience |
| MCP stdio transport | Auto-spawned child processes, no separate deployment needed |
| Two-level RBAC | Simple global role + flexible project-level overrides |
| Embedding model consistency | Prevents silent similarity score degradation on model changes |
| Canonical content storage | Original text preserved before PII redaction for audit purposes |
| Server Actions for mutations | CSRF protection built-in, no API route needed for form submissions |
| JWT sessions | Stateless, scales horizontally, no session store needed |
