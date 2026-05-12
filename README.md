# Summit KT Portal

An enterprise knowledge-transfer portal built with Next.js 14, PostgreSQL, NextAuth.js, Cloudflare R2, and Groq. Admins upload KT documents and generate AI-powered readiness quizzes. Members chat with a RAG assistant grounded in those documents and complete a one-time assessment.

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 App Router + TypeScript |
| Database | PostgreSQL (local) with pgvector + pgcrypto |
| Auth | NextAuth.js v4 — credentials (email + bcrypt password), JWT sessions |
| Storage | Cloudflare R2 (S3-compatible object storage) |
| AI Chat | Groq `llama-3.3-70b-versatile` |
| AI Quiz Generation | Groq `llama-3.1-8b-instant` |
| Embeddings | `@xenova/transformers` · `Xenova/all-MiniLM-L6-v2` (384-dim, runs locally) |
| Email | Resend |
| Styling | Tailwind CSS |
| Background Jobs | Standalone Node.js worker (`worker/index.mjs`) |

---

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Set up PostgreSQL

Install PostgreSQL locally if not already installed, then create the database and run the schema:

```bash
createdb Summit_KT
psql -U postgres -d Summit_KT -f postgres/schema.sql
```

Enable required extensions (run once in psql or pgAdmin):

```sql
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

### 3. Configure environment variables

```bash
cp .env.example .env.local
```

Open `.env.local` and fill in the values:

```env
# PostgreSQL
DATABASE_URL=postgresql://postgres:yourpassword@localhost:5432/Summit_KT

# NextAuth.js
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<run: openssl rand -base64 32>

# Cloudflare R2
R2_ACCOUNT_ID=your-account-id
R2_ACCESS_KEY_ID=your-access-key
R2_SECRET_ACCESS_KEY=your-secret-key
R2_BUCKET_NAME=summit-documents

# Groq — from console.groq.com
GROQ_API_KEY=gsk_...

# App
NEXT_PUBLIC_APP_NAME=Summit KT Portal
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Worker — set any random secret; must match on both the app server and worker process
WORKER_SECRET=your-random-secret-here
INTERNAL_APP_URL=http://localhost:3000

# Email (optional — password reset and quiz notifications require this)
# RESEND_API_KEY=re_...
# RESEND_FROM_EMAIL=noreply@yourdomain.com
```

### 4. Run incremental migrations

After setting up the base schema, apply additional migration files in pgAdmin or psql:

```
postgres/migrations/add_password_reset_tokens.sql
postgres/migrations/add_quiz_retake_requests.sql
```

### 5. Create the first admin user

Sign up via `/register`, then promote the account to admin in psql or pgAdmin:

```sql
UPDATE users SET role = 'admin' WHERE email = 'your@email.com';
```

### 6. Start the dev server

```bash
npm run dev
```

The app runs on [http://localhost:3000](http://localhost:3000).

### 7. Start the background worker (required for document processing and quiz generation)

In a **separate terminal**:

```powershell
# PowerShell
$env:INTERNAL_APP_URL="http://localhost:3000"; $env:WORKER_SECRET="your-secret"; npm run worker

# bash / zsh
INTERNAL_APP_URL=http://localhost:3000 WORKER_SECRET=your-secret npm run worker
```

You should see:
```
[worker] Started — polling http://localhost:3000/api/jobs/worker every 1000ms
```

Keep this terminal open while developing. See [docs/WORKER_SETUP.md](docs/WORKER_SETUP.md) for full dev and production setup.

---

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start Next.js dev server on port 3000 |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run worker` | Start background job worker |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript type check |

---

## Project Structure

```
summit-kt-portal/
├── app/                    Next.js App Router pages and API routes
│   ├── (admin)/            Admin-only pages (role-guarded)
│   ├── (member)/           Member pages (role-guarded)
│   ├── forgot-password/    Password reset request page
│   ├── register/           Self-registration page
│   ├── login/              Login page
│   ├── auth/               Accept invite + reset password pages
│   └── api/                API routes (chat, documents, quiz, jobs, auth)
├── components/             React components
│   ├── admin/              Admin-specific UI
│   ├── auth/               Login, register, forgot/reset password forms
│   ├── chat/               Chat interface
│   ├── quiz/               Quiz experience + retake request button
│   └── ui/                 Shared primitives
├── lib/                    Server-side utilities
│   ├── auth.ts             NextAuth session helpers, role guards
│   ├── data.ts             All DB query functions
│   ├── db.ts               postgres.js client (tagged template SQL)
│   ├── storage/r2.ts       Cloudflare R2 S3 client
│   ├── documents/          File parsing and RAG pipeline
│   ├── groq/               Groq client and prompt builders
│   ├── quiz/               Scoring, assignment, shuffling
│   └── rag/                Chunking, embeddings, retrieval
├── worker/
│   └── index.mjs           Standalone background worker
├── postgres/
│   ├── schema.sql          Full DB schema (run once to bootstrap)
│   └── migrations/         Incremental migration SQL files
└── docs/
    ├── ARCHITECTURE.md     Full system architecture
    └── WORKER_SETUP.md     Worker setup for dev and production
```

---

## How It Works

### Authentication

Users log in with email and password. Passwords are hashed with bcrypt. Sessions are JWT-based via NextAuth.js and stored in an httpOnly cookie. Admins can invite members via a secure token email link. Members can also self-register at `/register` and reset their password via the forgot-password flow.

### Document Processing

Admins upload PDFs, DOCX, CSV, or TXT files to Cloudflare R2. After uploading, clicking **Process** queues a background job. The worker downloads the file from R2, extracts text, splits it into 500-word sliding-window chunks, generates 384-dimensional embeddings with a local transformer model, and stores them in Postgres with `pgvector`.

### AI Chat (RAG)

Member questions are embedded with the same model. A cosine-similarity search retrieves the top 5 most relevant document chunks. These are injected into a Groq system prompt that constrains the LLM to answer only from the provided context, preventing hallucination.

### Quiz Generation

Admins configure a category (functional / technical) and number of sets (1–5). This queues a background job. The worker selects up to 30 document chunks, splits them across sets, and calls Groq once per set to generate 10 scenario-based questions (MCQ + true/false). Results are inserted directly into the database and the UI updates automatically.

### Quiz Re-enable Requests

If a member's quiz is auto-submitted (e.g. due to a tab switch detected by the anti-cheat guard), they can submit a re-enable request with an optional reason. Admins see pending requests as a stat card on the admin dashboard and as an amber badge on the affected project card. Approving a request deletes the auto-submitted attempt so the member can retake the quiz from scratch.

### Background Job Queue

Long-running tasks (document embedding, quiz generation) run in a separate worker process to avoid HTTP timeouts. Jobs are stored in a `processing_jobs` Postgres table. The worker polls `/api/jobs/worker` every second and claims jobs atomically using `FOR UPDATE SKIP LOCKED`. At the start of each poll cycle the worker resets any jobs stuck in `running` for more than 10 minutes back to `pending` for automatic retry.

See [docs/WORKER_SETUP.md](docs/WORKER_SETUP.md) for production deployment options.

---

## Documentation

- [Architecture](docs/ARCHITECTURE.md) — system design, data model, API surface, security
- [Worker Setup](docs/WORKER_SETUP.md) — background job worker for dev and production
