# Summit KT Portal

> **Enterprise Knowledge-Transfer Portal** — structured, AI-assisted onboarding and readiness assessments for engineering teams.

Summit KT Portal lets your organisation manage knowledge-transfer at scale. Admins publish KT documents, generate AI quizzes, and monitor team readiness. Members read documents, ask questions to a RAG-powered AI assistant, complete assessments, and track their own progress — all from a single web interface.

---

## Feature Highlights

| Feature | Description |
|---|---|
| **Multi-project workspace** | Unlimited projects, each with their own docs, members, quizzes and analytics |
| **Project-level admin role** | Promote members to project admin — they manage their project without super-admin access |
| **RAG AI chat** | Members ask questions; answers are grounded strictly in the uploaded KT documents |
| **AI quiz generation** | Groq LLM generates scenario-based MCQ + true/false sets from document chunks |
| **Quiz windows** | Enforce open/close dates per project; quiz auto-submits on window close |
| **Anti-cheat guard** | Tab-switch detection with configurable threshold; quiz auto-submits on violation |
| **Quiz retake requests** | Members submit a request; admins approve/reject with one click |
| **AI coaching plans** | Post-quiz coaching report generated per attempt, highlighting weak areas |
| **AI answer bookmarks** | Members save AI answers for later reference |
| **Admin announcements** | Project-scoped announcements shown on the member dashboard |
| **Document governance** | PII detection, document classification (public/internal/confidential), required-doc gating |
| **Background worker** | Async document processing and quiz generation — no HTTP timeouts |
| **Email flows** | Invite links, password reset, quiz window notifications via SendGrid |
| **CSV export** | Export user data from the admin Users table |

---

## Technology Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 App Router + TypeScript |
| Database | PostgreSQL 13+ with `pgvector` + `pgcrypto` |
| Auth | NextAuth.js v4 — email/password (bcrypt), JWT sessions, httpOnly cookies |
| Storage | Local filesystem (`public/uploads/`) or Cloudflare R2 (S3-compatible) |
| AI Chat | Groq `llama-3.3-70b-versatile` (default) or GitHub Models (`LLM_PROVIDER=copilot`) |
| AI Quiz Gen | Groq `llama-3.1-8b-instant` (default) or GitHub Models |
| Embeddings | `@xenova/transformers` · `Xenova/all-MiniLM-L6-v2` · 384-dim · runs locally in Node.js |
| Email | SendGrid (via `@sendgrid/mail`) |
| Styling | Tailwind CSS v3 |
| Background Jobs | Standalone Node.js worker (`worker/index.mjs`) |

---

## Quick Start

### 1. Prerequisites

| Requirement | Minimum version |
|---|---|
| Node.js | 18.x LTS |
| PostgreSQL | 13+ |
| npm | 9+ |

### 2. Install dependencies

```bash
npm install
```

### 3. Set up PostgreSQL

Create the database and run the full schema file:

```bash
createdb Summit_KT
psql -U postgres -d Summit_KT -f postgres/schema.sql
```

Enable required extensions (run once as a superuser):

```sql
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

Then apply all incremental migrations in order:

```bash
# Windows (PowerShell)
Get-ChildItem postgres/migrations/*.sql | Sort-Object Name | ForEach-Object {
  & "C:\Program Files\PostgreSQL\13\bin\psql.exe" "postgresql://postgres:yourpassword@localhost:5433/Summit_KT" -f $_.FullName
}
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
SENDGRID_FROM_NAME=Summit KT Portal

# ── Background worker ─────────────────────────────────────────────────────────
# Must be identical on both the app server and the worker process
WORKER_SECRET=your-random-secret-here
INTERNAL_APP_URL=http://localhost:3000

# ── Public app metadata ───────────────────────────────────────────────────────
NEXT_PUBLIC_APP_NAME=Summit KT Portal
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

| Command | Description |
|---|---|
| `npm run dev` | Start Next.js dev server (hot reload) |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run worker` | Start background job worker |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript type check |

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
│   │           ├── members/      Invite members, manage roles (member/admin)
│   │           ├── quiz/         Generate and manage quiz sets
│   │           └── analytics/    Per-project quiz and chat analytics (super-admin only)
│   ├── (member)/                 Member routes (role-guarded)
│   │   ├── dashboard/            Personalised dashboard with projects, bookmarks, activity
│   │   └── projects/[id]/
│   │       ├── page.tsx          Project overview + KT document list
│   │       ├── chat/             RAG AI chat interface
│   │       ├── quiz/             One-time readiness assessment
│   │       └── bookmarks/        Saved AI answers
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

| Role | Access |
|---|---|
| **Super Admin** | Full access to all pages: global dashboard, all projects, all users, analytics, user management |
| **Project Admin** | Access to their assigned project's admin pages only: documents, members, quiz. No global dashboard or Users page |
| **Member** | Access to assigned projects only: chat, quiz, documents, bookmarks |

Project admin access is stored per-row in `project_members.role`. A member can be admin of one project and a regular member of another.

---

## How It Works

### Authentication & Sessions

Users authenticate with email + bcrypt password. Sessions are JWT-based via NextAuth.js stored in an `httpOnly` cookie. Three invitation flows exist:

1. **Admin invite** — admin sends a token link; recipient sets a password on first visit
2. **Self-register** — anyone can register at `/register`; accounts are `member` role by default
3. **Password reset** — SendGrid email with a time-limited token link

The `is_active` flag controls login access. Admins can lock/unlock accounts from the Users table.

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

| Document | Description |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Full system architecture, data model, sequence diagrams, API surface, security model |
| [docs/USER_GUIDE.md](docs/USER_GUIDE.md) | Step-by-step guides for super admins, project admins, and members |
| [docs/WORKER_SETUP.md](docs/WORKER_SETUP.md) | Background worker setup for dev and production (PM2, systemd) |
| [docs/LLM_PROVIDER_SETUP.md](docs/LLM_PROVIDER_SETUP.md) | Configuring Groq and GitHub Models, troubleshooting |
| [docs/LOCAL_STORAGE.md](docs/LOCAL_STORAGE.md) | Local filesystem storage configuration |
| [docs/SELF_HOSTED_DEPLOYMENT.md](docs/SELF_HOSTED_DEPLOYMENT.md) | Full self-hosted production deployment guide |

---

## Security Notes

- All passwords are hashed with bcrypt (cost factor 12)
- JWT sessions stored in `httpOnly` cookies — not accessible to JavaScript
- All admin and member routes are server-side role-gated before rendering
- Project admin scope is enforced at the page and action level — project admins cannot cross project boundaries
- Rate limiting is applied to auth endpoints
- SSRF prevention on external URL inputs
- PII detection runs on every uploaded document before embedding

