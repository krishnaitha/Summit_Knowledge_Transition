# NexTElevate

> **Enterprise Knowledge-Transfer Portal** — structured, AI-assisted onboarding and readiness assessments for engineering teams.

NexTElevate lets your organisation manage knowledge-transfer at scale. Admins publish KT documents, generate AI Quests, and monitor team readiness. Members read documents, ask questions to a RAG-powered AI assistant, complete assessments, and track their own progress — all from a single web interface.

---

## Feature Highlights

| Feature                          | Description                                                                                |
| -------------------------------- | ------------------------------------------------------------------------------------------ |
| **Multi-project workspace**      | Unlimited projects, each with their own docs, members, quizzes and analytics               |
| **Project-level admin role**     | Promote members to project admin — they manage their project without super-admin access    |
| **RAG AI chat**                  | Members ask questions; answers are grounded strictly in the uploaded KT documents          |
| **AI quiz generation**           | Groq LLM generates scenario-based MCQ + true/false sets from document chunks               |
| **Quiz windows**                 | Enforce open/close dates per project; quiz auto-submits on window close                    |
| **Anti-cheat guard**             | Tab-switch detection with configurable threshold; quiz auto-submits on violation           |
| **Quiz retake requests**         | Members submit a request; admins approve/reject with one click                             |
| **AI coaching plans**            | Post-quiz coaching report generated per attempt, highlighting weak areas                   |
| **AI answer bookmarks**          | Members save AI answers for later reference                                                |
| **Admin announcements**          | Project-scoped announcements shown on the member dashboard                                 |
| **Interactive study mode**       | Post-quiz weak-area guide with chunk-level references and direct document links            |
| **AI flashcards + SRS**          | Project flashcards generated from chunks with spaced-repetition scheduling                 |
| **Document discussion threads**  | Member/admin threaded discussions on document pages with open/resolved states              |
| **Open-thread triage**           | Dedicated member/admin Open Threads pages, filters, and navbar/sidebar badges              |
| **Document full-text search**    | Fast chunk search with snippet previews across member and admin project views              |
| **External document connectors** | Pull knowledge from Confluence and SharePoint into project documents (with demo fixtures)  |
| **AI document generator**        | Super Admins and Project Admins can turn transcripts into polished Markdown/TXT documents  |
| **Attempt history retention**    | Admin resets archive prior submitted scores so latest and previous attempts stay visible   |
| **Document governance**          | PII detection, document classification (public/internal/confidential), required-doc gating |
| **Background worker**            | Async document processing and quiz generation — no HTTP timeouts                           |
| **Email flows**                  | Invite links, password reset, quiz window notifications via SendGrid                       |
| **CSV export**                   | Export user data from the admin Users table                                                |

### Recent Updates (May 2026)

- Added Confluence and SharePoint connectors for project knowledge ingestion
- Added AI Document Generator screen at `/admin/generate-document`
- Enabled AI Document Generator for both Super Admin and Project Admin roles
- Updated admin/member UI naming from "Projects" to "Products" in primary navigation and headings
- Widened and centered app shell containers for improved visual balance on large screens

Quiz reset policy:

- Up to 5 admin resets per member per project
- Prior submitted attempts are archived and shown as previous attempts

---

## Technology Stack

| Layer           | Technology                                                                             |
| --------------- | -------------------------------------------------------------------------------------- |
| Framework       | Next.js 16 App Router + TypeScript                                                     |
| Database        | PostgreSQL 13+ with `pgvector` + `pgcrypto`                                            |
| Auth            | NextAuth.js v4 — email/password (bcrypt), JWT sessions, httpOnly cookies               |
| Storage         | Local filesystem (`public/uploads/`) or Cloudflare R2 (S3-compatible)                  |
| AI Chat         | Groq `llama-3.3-70b-versatile` (default) or GitHub Models (`LLM_PROVIDER=copilot`)     |
| AI Quiz Gen     | Groq `llama-3.1-8b-instant` (default) or GitHub Models                                 |
| Embeddings      | `@xenova/transformers` · `Xenova/all-MiniLM-L6-v2` · 384-dim · runs locally in Node.js |
| Email           | SendGrid (via `@sendgrid/mail`)                                                        |
| Styling         | Tailwind CSS v4                                                                        |
| Background Jobs | Standalone Node.js worker (`worker/index.mjs`)                                         |

---

## Quick Start

### 1. Prerequisites

| Requirement | Minimum version |
| ----------- | --------------- |
| Node.js     | 22.x LTS        |
| PostgreSQL  | 13+             |
| npm         | 9+              |

### 2. Install dependencies

```bash
npm install
```

### 3. Set up PostgreSQL

Create the database, then run all migrations with a single command:

```bash
createdb Summit_KT
npm run db:migrate
```

This uses [node-pg-migrate](https://github.com/salsita/node-pg-migrate) to apply all SQL files in `postgres/migrations/` in order. It reads `DATABASE_URL` from `.env.local` automatically. Migrations are tracked in a `pgmigrations` table — re-running is safe and only applies new files.

To add a future migration, create a numbered SQL file:

```bash
# Example: postgres/migrations/018_my_change.sql
```

### 4. Configure environment variables

Copy the example file and fill in the required values:

```bash
cp .env.example .env.local
```

Full environment variable reference:

```env
# ── Database ──────────────────────────────────────────────────────────────────
DATABASE_URL=postgresql://postgres:yourpassword@localhost:5432/Summit_KT

# ── NextAuth.js ───────────────────────────────────────────────────────────────
NEXTAUTH_URL=http://localhost:3000
# Generate with: openssl rand -base64 32
NEXTAUTH_SECRET=your-secret-here

# ── Auth provider ─────────────────────────────────────────────────────────────
# 'credentials' (default) — email + password, self-registration, invite flow, password reset
# 'cognito'               — AWS Cognito OIDC; users auto-provisioned on first login
# 'keycloak'              — Keycloak OIDC; users auto-provisioned on first login
# 'oidc'                  — Generic OIDC / OAuth2 (Okta, Azure AD, Auth0, Ping, Dex, etc.)
AUTH_PROVIDER=credentials

# AWS Cognito — required only when AUTH_PROVIDER=cognito
# COGNITO_CLIENT_ID=your-cognito-app-client-id
# COGNITO_CLIENT_SECRET=your-cognito-app-client-secret
# COGNITO_ISSUER=https://cognito-idp.<region>.amazonaws.com/<user-pool-id>

# Keycloak — required only when AUTH_PROVIDER=keycloak
# KEYCLOAK_CLIENT_ID=your-keycloak-client-id
# KEYCLOAK_CLIENT_SECRET=your-keycloak-client-secret
# KEYCLOAK_ISSUER=https://your-keycloak-server/realms/your-realm

# Generic OIDC — required only when AUTH_PROVIDER=oidc
# OIDC_CLIENT_ID=your-client-id
# OIDC_CLIENT_SECRET=your-client-secret
# OIDC_ISSUER=https://your-idp.example.com
# OIDC_DISPLAY_NAME=OIDC       # Login button label (default: OIDC)
# OIDC_PROVIDER_ID=oidc        # Internal provider slug stored in DB (default: oidc)

# ── AI Provider (choose one) ──────────────────────────────────────────────────
# Option A: Groq (default) — https://console.groq.com
GROQ_API_KEY=gsk_...

# Option B: GitHub Models
# LLM_PROVIDER=copilot
# COPILOT_PROXY_TOKEN=your_token_here
# COPILOT_BASE_URL=https://models.github.ai/inference/chat/completions
# COPILOT_MODEL=openai/gpt-4.1-mini

# ── Storage (choose one) ──────────────────────────────────────────────────────
# Option A: Local filesystem (default — files saved to public/uploads/)
STORAGE_PROVIDER=local

# Option B: Cloudflare R2
# STORAGE_PROVIDER=r2
# R2_ACCOUNT_ID=your-account-id
# R2_ACCESS_KEY_ID=your-access-key
# R2_SECRET_ACCESS_KEY=your-secret-key
# R2_BUCKET_NAME=summit-documents

# ── Email (SendGrid) ──────────────────────────────────────────────────────────
# Required for invite links, password reset, and quiz window notifications
SENDGRID_API_KEY=SG.your-key-here
SENDGRID_FROM_EMAIL=noreply@yourdomain.com
SENDGRID_FROM_NAME=NexTElevate

# ── Background worker ─────────────────────────────────────────────────────────
# Must be identical on both the app server and the worker process
WORKER_SECRET=your-random-secret-here
INTERNAL_APP_URL=http://localhost:3000

# ── Public app metadata ───────────────────────────────────────────────────────
NEXT_PUBLIC_APP_NAME=NexTElevate
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 5. Create the first admin user

Register via `/register`, then promote the account to admin:

```sql
UPDATE users SET role = 'admin' WHERE email = 'your@email.com';
```

### 6. Start the dev server

```bash
npm run dev
```

The app runs at [http://localhost:3000](http://localhost:3000).

### 7. Start the background worker

The worker is required for document processing (embedding) and quiz generation. Open a **separate terminal**:

```powershell
# PowerShell
$env:INTERNAL_APP_URL="http://localhost:3000"; $env:WORKER_SECRET="your-secret"; npm run worker
```

```bash
# bash / zsh
INTERNAL_APP_URL=http://localhost:3000 WORKER_SECRET=your-secret npm run worker
```

Expected output:

```
[worker] Started — polling http://localhost:3000/api/jobs/worker every 1000ms
```

See [docs/WORKER_SETUP.md](docs/WORKER_SETUP.md) for production deployment options including PM2 and systemd.

---

## Scripts

| Command              | Description                                      |
| -------------------- | ------------------------------------------------ |
| `npm run dev`        | Start Next.js dev server (hot reload)            |
| `npm run build`      | Production build                                 |
| `npm run start`      | Start production server                          |
| `npm run worker`     | Start background job worker                      |
| `npm run db:migrate` | Apply pending DB migrations (reads `.env.local`) |
| `npm run lint`       | ESLint                                           |
| `npm run typecheck`  | TypeScript type check                            |

---

## Docker Setup

The quickest way to run the full stack (PostgreSQL + pgvector, Next.js app, background worker) locally is with Docker Compose.

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (or Docker Engine + Compose plugin)

### 1. Create `.env.local`

The compose file reads secrets from `.env.local`. At minimum you need:

```env
# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=replace-with-openssl-rand-base64-32

# AI provider (choose one)
GROQ_API_KEY=gsk_...
# LLM_PROVIDER=copilot
# COPILOT_PROXY_TOKEN=...
# COPILOT_BASE_URL=https://models.github.ai/inference/chat/completions
# COPILOT_MODEL=openai/gpt-4.1-mini

# Storage
STORAGE_PROVIDER=local

# Worker auth
WORKER_SECRET=replace-with-a-random-string

# Public
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_NAME=NexTElevate
```

> `DATABASE_URL` and `DATABASE_SSL` are injected by the compose file — do **not** add them to `.env.local`.

### 2. Build and start

```bash
docker compose up --build
```

This starts four services:

| Service   | Description                                                    | Port       |
| --------- | -------------------------------------------------------------- | ---------- |
| `db`      | PostgreSQL 17 + pgvector                                       | (internal) |
| `migrate` | Runs all pending DB migrations via node-pg-migrate, then exits | (internal) |
| `app`     | Next.js 16 production server                                   | `3000`     |
| `worker`  | Background job processor (document embedding + quiz gen)       | (internal) |

`app` and `worker` only start after `migrate` exits successfully. Migrations are applied from `postgres/migrations/` in numeric order (`001_init.sql` → `017_quiz_retake_requests.sql`) and tracked in a `pgmigrations` table — safe to re-run at any time.

To run migrations manually against the local DB (outside Docker):

```bash
npm run db:migrate
```

### 3. Create the first admin user

Once the app is running, register an account at [http://localhost:3000/register](http://localhost:3000/register), then promote it to admin:

```bash
docker compose exec db psql -U postgres -d summitkt -c \
  "UPDATE users SET role = 'admin' WHERE email = 'your@email.com';"
```

### 4. Stopping and resetting

```bash
# Stop without removing data
docker compose down

# Stop and wipe all data (DB volume + uploads)
docker compose down -v
```

---

## Deployment

The app ships as three Docker images built from a single `Dockerfile` using multi-stage targets.

| Image target | What it runs                                                  | When it runs            |
| ------------ | ------------------------------------------------------------- | ----------------------- |
| `migrate`    | `node-pg-migrate up` — applies pending migrations, then exits | Once before each deploy |
| `runner`     | `node server.js` — Next.js app                                | Long-running service    |
| `worker`     | `node worker/index.mjs` — background job processor            | Long-running service    |

### 1. Build and push images

```bash
# Replace with your registry (ECR, ACR, Docker Hub, etc.)
REGISTRY=your-registry/summit
TAG=v1

docker build --target migrate -t $REGISTRY-migrate:$TAG .
docker build --target runner  -t $REGISTRY-app:$TAG .
docker build --target worker  -t $REGISTRY-worker:$TAG .

docker push $REGISTRY-migrate:$TAG
docker push $REGISTRY-app:$TAG
docker push $REGISTRY-worker:$TAG
```

### 2. Run migrations before each deploy

Run the migrate image as a one-off task against your production database **before** rolling out updated app/worker containers:

```bash
docker run --rm \
  -e DATABASE_URL=postgresql://<user>:<pass>@<host>:5432/<db> \
  $REGISTRY-migrate:$TAG
```

On **AWS ECS**: create a one-off ECS Task using the migrate image. Run it to completion before updating the app/worker ECS Services.

On **Azure Container Apps**: create a Container App Job using the migrate image. Trigger it before deploying the app/worker Container Apps.

### 3. Deploy app and worker

Both are stateless long-running containers. Deploy them with the environment variables below. They do **not** need to talk to each other directly — the worker polls the app's internal API.

### 4. Production environment variables

Set these on both the `app` and `worker` containers:

```env
# Database (managed PostgreSQL — RDS, Azure Database, etc.)
DATABASE_URL=postgresql://<user>:<pass>@<host>:5432/<db>
DATABASE_SSL=require

# NextAuth
NEXTAUTH_URL=https://your-app-domain.com
NEXTAUTH_SECRET=<openssl rand -base64 32>

# Auth provider — AWS Cognito OIDC
AUTH_PROVIDER=cognito
COGNITO_CLIENT_ID=<your-cognito-app-client-id>
COGNITO_CLIENT_SECRET=<your-cognito-app-client-secret>
COGNITO_ISSUER=https://cognito-idp.<region>.amazonaws.com/<user-pool-id>

# AI — GitHub Copilot proxy
LLM_PROVIDER=copilot
COPILOT_PROXY_TOKEN=<your-copilot-proxy-token>
COPILOT_BASE_URL=https://api.githubcopilot.com/chat/completions  # default, override if needed
COPILOT_MODEL=openai/gpt-5-mini                                  # default model

# File storage
STORAGE_PROVIDER=local

# Worker
WORKER_SECRET=<random secret>
INTERNAL_APP_URL=http://<app-internal-hostname>:3000

# App
NEXT_PUBLIC_APP_NAME=Summit KT Portal
NEXT_PUBLIC_APP_URL=https://your-app-domain.com
```

> **File storage:** `STORAGE_PROVIDER=local` writes uploads to the container filesystem — suitable for single-instance deployments where the container has a persistent volume. For multi-replica or ephemeral containers, switch to `STORAGE_PROVIDER=r2` (Cloudflare R2 / S3-compatible). The `lib/storage/r2.ts` driver is already implemented; add `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, and `R2_BUCKET_NAME` when enabling it.

---

## Project Structure

```
summit-kt-portal/
├── app/                          Next.js App Router pages and API routes
│   ├── (admin)/                  Super-admin and project-admin routes (role-guarded)
│   │   └── admin/
│   │       ├── dashboard/        Global stats, activity feed, retake request alert
│   │       ├── projects/         Project list with per-project badges
│   │       └── projects/[id]/
│   │           ├── page.tsx      Project overview, announcements, retake requests
│   │           ├── documents/    Upload, process, and manage KT documents
│   │           │   └── [documentId]/threads/ Document thread collaboration
│   │           ├── members/      Invite members, manage roles (member/admin)
│   │           ├── quiz/         Generate and manage quiz sets
│   │           └── analytics/    Per-project quiz and chat analytics (super-admin only)
│   │       └── threads/          Open-thread triage queue with filters
│   ├── (member)/                 Member routes (role-guarded)
│   │   ├── dashboard/            Personalised dashboard with projects, bookmarks, activity
│   │   └── projects/[id]/
│   │       ├── page.tsx          Project overview + KT document list
│   │       ├── documents/[documentId]/threads/ Document thread discussion board
│   │       ├── chat/             RAG AI chat interface
│   │       ├── quiz/             One-time readiness assessment
│   │       ├── study/            Interactive weak-area study mode
│   │       ├── flashcards/       AI-generated flashcards with SRS review
│   │       └── bookmarks/        Saved AI answers
│   │   └── threads/              Open-thread queue with filters
│   ├── (auth)/
│   │   └── login/                Login page
│   ├── forgot-password/          Password reset request
│   ├── register/                 Self-registration
│   ├── auth/
│   │   ├── accept-invite/        Accept admin invite with token
│   │   └── reset-password/       Set new password via token link
│   └── api/
│       ├── auth/[...nextauth]/   NextAuth.js handler
│       ├── auth/register/        POST self-registration
│       ├── auth/forgot-password/ POST send reset email
│       ├── auth/reset-password/  POST apply new password
│       ├── chat/                 GET session history | POST streaming RAG chat
│       ├── documents/
│       │   ├── upload/           POST upload file to storage
│       │   ├── process/          POST queue document_process job
│       │   └── view/             GET signed download/view URL
│       ├── quiz/                 GET questions | POST save answers
│       ├── bookmarks/            GET list | POST toggle bookmark
│       ├── jobs/worker/          POST worker polling endpoint (WORKER_SECRET protected)
│       └── admin/                Admin-only management endpoints
├── components/
│   ├── admin/                    Admin UI components (tables, panels, drawers, modals)
│   ├── auth/                     Login, register, forgot/reset password forms
│   ├── chat/                     Chat interface, message bubbles, source tags, bookmark button
│   ├── layout/                   Sidebars, navbar, project cards
│   ├── quiz/                     Quiz experience, result summary, retake button
│   └── ui/                       Shared primitives (Button, Card, Badge, Modal, Table…)
├── lib/
│   ├── auth.ts                   NextAuth config, session helpers, role guards
│   ├── data.ts                   All database query functions
│   ├── db.ts                     postgres.js tagged-template SQL client
│   ├── email.ts                  SendGrid email helpers
│   ├── env.ts                    Validated environment variable access
│   ├── rate-limit.ts             In-memory rate limiter
│   ├── security.ts               Input sanitisation, SSRF prevention
│   ├── documents/                File parsing (PDF, DOCX, CSV, TXT), PII detection, processing
│   ├── groq/                     Groq client, chat + quiz prompt builders, streaming
│   ├── llm/                      LLM provider abstraction (Groq / GitHub Models)
│   ├── quiz/                     Scoring, assignment, question shuffling
│   ├── rag/                      Chunking, embeddings (@xenova), vector retrieval
│   ├── storage/                  Local filesystem and Cloudflare R2 storage adapters
│   └── types/database.ts         Shared TypeScript interfaces for DB entities
├── worker/
│   └── index.mjs                 Standalone background job processor
├── postgres/
│   ├── schema.sql                Full DB schema (single-file bootstrap)
│   └── migrations/               Incremental migration SQL files (001–012+)
├── public/uploads/               Local document storage (gitignored)
└── docs/
    ├── ARCHITECTURE.md           Detailed system architecture + diagrams
    ├── USER_GUIDE.md             Step-by-step guide for admins and members
    ├── WORKER_SETUP.md           Worker setup for dev and production
    ├── LLM_PROVIDER_SETUP.md     Groq and GitHub Models configuration
    └── LOCAL_STORAGE.md          Local filesystem storage configuration
```

---

## Roles and Access Control

| Role              | Access                                                                                                           |
| ----------------- | ---------------------------------------------------------------------------------------------------------------- |
| **Super Admin**   | Full access to all pages: global dashboard, all projects, all users, analytics, user management                  |
| **Project Admin** | Access to their assigned project's admin pages only: documents, members, quiz. No global dashboard or Users page |
| **Member**        | Access to assigned projects only: chat, quiz, documents, bookmarks                                               |

Project admin access is stored per-row in `project_members.role`. A member can be admin of one project and a regular member of another.

---

## How It Works

### Authentication & Sessions

The active auth strategy is controlled by the `AUTH_PROVIDER` environment variable (defaults to `credentials`).

| `AUTH_PROVIDER` | Strategy                | User provisioning               |
| --------------- | ----------------------- | ------------------------------- |
| `credentials`   | Email + bcrypt password | Self-register or admin invite   |
| `cognito`       | AWS Cognito OIDC        | Auto-provisioned on first login |

Sessions are JWT-based via NextAuth.js stored in an `httpOnly` cookie. With `credentials`, three flows exist:

1. **Admin invite** — admin sends a token link; recipient sets a password on first visit
2. **Self-register** — anyone can register at `/register`; accounts are `member` role by default
3. **Password reset** — SendGrid email with a time-limited token link

When `AUTH_PROVIDER=cognito`, the `/register`, `/forgot-password`, invite, and reset API routes return `404` — Cognito manages the full identity lifecycle. The login page auto-redirects to the Cognito hosted UI.

The `is_active` flag controls login access regardless of provider. Admins can lock/unlock accounts from the Users table.

### Document Processing Pipeline

1. Admin uploads a file (PDF, DOCX, CSV, TXT) via the admin project page
2. File is stored in local filesystem or Cloudflare R2
3. Admin clicks **Process** → a `document_process` job is queued in `processing_jobs`
4. The worker picks up the job, downloads the file, extracts text, and:
   - Detects PII (email, phone, SSN patterns)
   - Classifies content
   - Splits into 500-word overlapping chunks
   - Generates 384-dim embeddings via `Xenova/all-MiniLM-L6-v2`
   - Stores chunks + embeddings in `document_chunks` with `pgvector`

### RAG AI Chat

1. Member types a question in the chat interface
2. Question is embedded with the same model
3. Cosine similarity search returns the top-5 most relevant document chunks from the project
4. Chunks + question are sent to the LLM with a strict grounding prompt
5. The LLM streams back a response citing only the provided context
6. Sources are displayed below the answer; members can bookmark answers

### Quiz Generation

1. Admin selects category (functional/technical), number of sets (1–5), questions per set
2. A `quiz_generate` job is queued
3. The worker selects up to 30 document chunks from the project
4. Groq generates 10 scenario-based questions per set (MCQ A–D + true/false)
5. Questions are inserted into `quiz_questions` linked to a `quiz_set`
6. Questions are randomly shuffled on delivery per-member

### Quiz Delivery and Anti-Cheat

- Members have one attempt per project quiz (unless reset by admin)
- Quiz windows (open/close dates) restrict when the quiz can be taken
- Tab-switch detection: 3+ consecutive tab-switch events trigger an auto-submit
- Auto-submit flags the attempt and sends a re-enable request notification to admins

### Background Job Queue

The worker polls `POST /api/jobs/worker` every second. Jobs are claimed with `FOR UPDATE SKIP LOCKED` to prevent duplicate processing across multiple worker instances. Jobs stuck in `running` for more than 10 minutes are automatically reset to `pending`.

---

## Documentation

| Document                                                         | Description                                                                          |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)                     | Full system architecture, data model, sequence diagrams, API surface, security model |
| [docs/USER_GUIDE.md](docs/USER_GUIDE.md)                         | Step-by-step guides for super admins, project admins, and members                    |
| [docs/WORKER_SETUP.md](docs/WORKER_SETUP.md)                     | Background worker setup for dev and production (PM2, systemd)                        |
| [docs/LLM_PROVIDER_SETUP.md](docs/LLM_PROVIDER_SETUP.md)         | Configuring Groq and GitHub Models, troubleshooting                                  |
| [docs/LOCAL_STORAGE.md](docs/LOCAL_STORAGE.md)                   | Local filesystem storage configuration                                               |
| [docs/SELF_HOSTED_DEPLOYMENT.md](docs/SELF_HOSTED_DEPLOYMENT.md) | Full self-hosted production deployment guide                                         |

---

## Security Notes

- All passwords are hashed with bcrypt (cost factor 12)
- JWT sessions stored in `httpOnly` cookies — not accessible to JavaScript
- All admin and member routes are server-side role-gated before rendering
- Project admin scope is enforced at the page and action level — project admins cannot cross project boundaries
- Rate limiting is applied to auth endpoints
- SSRF prevention on external URL inputs
- PII detection runs on every uploaded document before embedding
