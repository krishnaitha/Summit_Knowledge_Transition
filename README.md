# Summit KT Portal

An enterprise knowledge-transfer portal built with Next.js 14, Supabase, and Groq. Admins upload KT documents and generate AI-powered readiness quizzes. Members chat with a RAG assistant grounded in those documents and complete a one-time assessment.

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 App Router + TypeScript |
| Database / Auth / Storage | Supabase (Postgres + pgvector + Storage + pg_cron) |
| AI Chat | Groq `llama-3.3-70b-versatile` |
| AI Quiz Generation | Groq `llama-3.1-8b-instant` |
| Embeddings | `@xenova/transformers` · `Xenova/all-MiniLM-L6-v2` (384-dim, runs locally) |
| Email | Resend |
| Styling | Tailwind CSS |
| Background Jobs | Standalone Node.js worker (`worker/index.mjs`) + `pg_cron` safety net |

---

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env.local
```

Open `.env.local` and fill in the values:

```env
# Supabase — from your project's Settings > API
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Groq — from console.groq.com
GROQ_API_KEY=gsk_...

# App
NEXT_PUBLIC_APP_NAME=Summit KT Portal
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Worker — set any random secret; must match on both the app server and worker process
WORKER_SECRET=your-random-secret-here
INTERNAL_APP_URL=http://localhost:3000

# Email (optional — quiz notifications are silently skipped if unset)
# RESEND_API_KEY=re_...
# RESEND_FROM_EMAIL=noreply@yourdomain.com
```

### 3. Run database migrations

Open the Supabase SQL editor for your project and run each migration file in order:

```
supabase/migrations/001_init.sql
supabase/migrations/002_quiz_window_resets.sql
supabase/migrations/010_processing_jobs.sql
```

### 4. Promote the first admin user

After signing up, run this in the Supabase SQL editor (replace the email):

```sql
UPDATE public.users SET role = 'admin' WHERE email = 'your@email.com';
```

### 5. Start the dev server

```bash
npm run dev
```

The app runs on [http://localhost:3000](http://localhost:3000).

### 6. Start the background worker (required for document processing and quiz generation)

In a **separate terminal**:

```bash
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
│   ├── (auth)/             Login, signup, password reset
│   ├── (member)/           Member pages (role-guarded)
│   └── api/                API routes (chat, documents, quiz, jobs)
├── components/             React components
│   ├── admin/              Admin-specific UI
│   ├── chat/               Chat interface
│   ├── quiz/               Quiz experience
│   └── ui/                 Shared primitives
├── lib/                    Server-side utilities
│   ├── documents/          File parsing and RAG pipeline
│   ├── groq/               Groq client and prompt builders
│   ├── quiz/               Scoring, assignment, shuffling
│   ├── rag/                Chunking, embeddings, retrieval
│   └── supabase/           Supabase client factories
├── worker/
│   └── index.mjs           Standalone background worker
├── supabase/migrations/    SQL migration files
└── docs/
    ├── ARCHITECTURE.md     Full system architecture
    └── WORKER_SETUP.md     Worker setup for dev and production
```

---

## How It Works

### Document Processing

Admins upload PDFs, DOCX, CSV, or TXT files. After uploading, clicking **Process** queues a background job. The worker downloads the file, extracts text, splits it into 500-word sliding-window chunks, generates 384-dimensional embeddings with a local transformer model, and stores them in Postgres with `pgvector`.

### AI Chat (RAG)

Member questions are embedded with the same model. A cosine-similarity search retrieves the top 5 most relevant document chunks. These are injected into a Groq system prompt that constrains the LLM to answer only from the provided context, preventing hallucination.

### Quiz Generation

Admins configure a category (functional / technical) and number of sets (1–5). This queues a background job. The worker selects up to 30 document chunks, splits them across sets, and calls Groq once per set to generate 10 scenario-based questions (MCQ + true/false). Results are inserted directly into the database and the UI updates automatically.

### Background Job Queue

Long-running tasks (document embedding, quiz generation) run in a separate worker process to avoid HTTP timeouts. Jobs are stored in a `processing_jobs` Postgres table. The worker polls `/api/jobs/worker` every second and claims jobs atomically using `FOR UPDATE SKIP LOCKED`. A `pg_cron` job resets any jobs stuck in `running` for more than 10 minutes.

See [docs/WORKER_SETUP.md](docs/WORKER_SETUP.md) for production deployment options.

---

## Documentation

- [Architecture](docs/ARCHITECTURE.md) — system design, data model, API surface, security
- [Worker Setup](docs/WORKER_SETUP.md) — background job worker for dev and production
