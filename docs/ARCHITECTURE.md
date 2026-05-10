# Summit KT Portal — Architecture & Feature Analysis

> **Version:** 0.1.0
> **Stack:** Next.js 14 · Supabase · Groq · @xenova/transformers · Resend · Tailwind CSS
> **Purpose:** Enterprise knowledge-transfer portal for structured team transitions

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [High-Level Architecture](#2-high-level-architecture)
3. [Application Layer Structure](#3-application-layer-structure)
4. [Data Architecture](#4-data-architecture)
5. [Core Feature Flows](#5-core-feature-flows)
   - 5.1 Authentication & Authorization
   - 5.2 Document Ingestion (RAG Pipeline)
   - 5.3 AI-Grounded Chat
   - 5.4 Quiz Generation & Delivery
   - 5.5 Background Job Queue
6. [Component Hierarchy](#6-component-hierarchy)
7. [API Surface](#7-api-surface)
8. [Security Model](#8-security-model)
9. [Known Gaps](#9-known-gaps)
10. [Good-to-Have Features](#10-good-to-have-features)

---

## 1. System Overview

Summit KT Portal is a **multi-role, project-scoped knowledge-transfer platform**. It enables admins to upload KT documents, generate AI quizzes, and monitor member readiness. Members interact with a RAG-powered chatbot and complete a one-time readiness assessment.

```
┌─────────────────────────────────────────────────────────────────┐
│                        SUMMIT KT PORTAL                         │
│                                                                 │
│   ADMIN                          MEMBER                         │
│   ─────                          ──────                         │
│   • Create & manage projects     • View assigned projects       │
│   • Upload & process KT docs     • Chat with AI assistant       │
│   • Generate AI quizzes          • Take one-time readiness quiz │
│   • Invite team members          • Review quiz results          │
│   • View analytics & activity    • Access KT documents          │
│   • Reset quiz attempts                                         │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. High-Level Architecture

```
  Browser / Client
  ┌─────────────────────────────────────────────────────┐
  │  Next.js 14 App Router (React Server Components)    │
  │  ┌──────────────┐  ┌──────────────┐                 │
  │  │  Admin Pages │  │ Member Pages │                 │
  │  └──────────────┘  └──────────────┘                 │
  │         │                  │                        │
  │         └────────┬─────────┘                        │
  │                  │ Server Actions / API Routes       │
  └──────────────────┼──────────────────────────────────┘
                     │
        ┌────────────┼────────────────────┐
        │            │                    │
        ▼            ▼                    ▼
  ┌──────────┐ ┌──────────────┐  ┌──────────────────┐
  │ Supabase │ │  Groq Cloud  │  │ Resend (Email)   │
  │          │ │              │  │                  │
  │ • Auth   │ │ Chat:        │  │ Quiz submission  │
  │ • Postgres│ │ llama-3.3-  │  │ notifications    │
  │ • Storage│ │ 70b-versatile│  │                  │
  │ • pgvector│ │              │  └──────────────────┘
  │ • pg_cron│ │ Quiz gen:    │
  └──────────┘ │ llama-3.1-  │
               │ 8b-instant  │
               └──────────────┘

  Embeddings (local, server-side)
  ┌──────────────────────────────────────┐
  │  @xenova/transformers                │
  │  Model: Xenova/all-MiniLM-L6-v2     │
  │  Dimensions: 384                     │
  │  Runs in Node.js on the server       │
  └──────────────────────────────────────┘

  Background Worker (standalone process)
  ┌──────────────────────────────────────┐
  │  worker/index.mjs                    │
  │  Polls POST /api/jobs/worker @ 1 s  │
  │  Processes document_process and      │
  │  quiz_generate jobs from queue       │
  └──────────────────────────────────────┘
```

---

## 3. Application Layer Structure

```
summit-kt-portal/
│
├── app/                              ← Next.js App Router
│   ├── (auth)/                       ← Public auth routes
│   │   ├── login/
│   │   ├── signup/
│   │   ├── forgot-password/
│   │   └── reset-password/
│   │
│   ├── (admin)/                      ← Role-guarded admin routes
│   │   └── admin/
│   │       ├── dashboard/            ← Global stats + activity feed
│   │       ├── projects/             ← Project list
│   │       └── projects/[id]/
│   │           ├── page.tsx          ← Project overview
│   │           ├── documents/        ← Upload & process KT docs
│   │           ├── members/          ← Invite & manage members
│   │           ├── chat/             ← Admin can preview chatbot
│   │           ├── quiz/             ← Generate & manage quiz sets
│   │           └── analytics/        ← Per-project analytics
│   │
│   ├── (member)/                     ← Role-guarded member routes
│   │   ├── dashboard/                ← Assigned projects list
│   │   └── projects/[id]/
│   │       ├── page.tsx              ← Project overview
│   │       ├── chat/                 ← RAG chat interface
│   │       └── quiz/                 ← One-time quiz
│   │
│   ├── api/
│   │   ├── chat/                     ← GET history | POST streaming chat
│   │   ├── documents/
│   │   │   ├── upload/               ← POST upload to Supabase Storage
│   │   │   ├── process/              ← POST queue document_process job
│   │   │   └── view/                 ← GET signed URL for doc preview
│   │   ├── quiz/
│   │   │   ├── generate/             ← POST queue quiz_generate job
│   │   │   ├── start/                ← POST begin quiz attempt
│   │   │   └── submit/               ← POST submit answers + score
│   │   ├── jobs/
│   │   │   ├── worker/               ← POST claim + execute next pending job
│   │   │   └── [id]/                 ← GET job status for polling
│   │   └── admin/
│   │       ├── analytics/            ← GET project analytics
│   │       └── invite/               ← POST invite member by email
│   │
│   └── auth/callback/                ← Supabase OAuth callback
│
├── components/
│   ├── admin/                        ← Admin-only UI components
│   ├── auth/                         ← Auth form components
│   ├── chat/                         ← Chat interface components
│   ├── layout/                       ← Sidebars, navbar, project card
│   ├── quiz/                         ← Quiz experience components
│   └── ui/                           ← Base UI primitives (shadcn-style)
│
├── lib/
│   ├── auth.ts                       ← Session helpers, role guards
│   ├── data.ts                       ← All DB query functions
│   ├── email.ts                      ← Resend email templates
│   ├── env.ts                        ← Env var validation
│   ├── rate-limit.ts                 ← Activity-log-based rate limiting
│   ├── utils.ts                      ← Formatting utilities
│   ├── documents/
│   │   ├── parse.ts                  ← PDF / DOCX / CSV text extraction
│   │   ├── process.ts                ← Chunk + embed + upsert pipeline
│   │   └── upload.ts                 ← Supabase Storage upload helper
│   ├── groq/
│   │   ├── chat.ts                   ← Groq client, retry, model selection
│   │   └── streaming.ts              ← Stream token consumer
│   ├── rag/
│   │   ├── chunking.ts               ← Sliding-window text chunker
│   │   ├── embeddings.ts             ← @xenova transformer pipeline
│   │   └── retrieval.ts              ← pgvector similarity search
│   ├── quiz/
│   │   ├── assignment.ts             ← Quiz question assignment logic
│   │   ├── scoring.ts                ← Score calculation
│   │   └── shuffle.ts                ← Question/option shuffling
│   ├── supabase/
│   │   ├── client.ts                 ← Browser Supabase client
│   │   ├── server.ts                 ← Server Supabase clients
│   │   └── middleware.ts             ← Session refresh middleware
│   └── types/
│       └── database.ts               ← Shared TypeScript types
│
├── worker/
│   └── index.mjs                     ← Standalone background worker process
│
├── supabase/migrations/
│   ├── 001_init.sql                  ← Full schema + RLS + functions
│   ├── 002_quiz_window_resets.sql    ← Quiz scheduling + reset table
│   └── 010_processing_jobs.sql       ← Background job queue table + pg_cron
│
└── middleware.ts                     ← Global session middleware
```

---

## 4. Data Architecture

### Entity-Relationship Diagram

```
  auth.users (Supabase managed)
       │
       │ trigger: handle_new_user()
       ▼
  public.users
  ┌──────────────────────────────┐
  │ id (PK, FK → auth.users)    │
  │ email                        │
  │ full_name                    │
  │ role: admin | member         │
  │ is_active                    │
  │ last_login_at                │
  │ created_at                   │
  └──────┬───────────────────────┘
         │                    │
         │ created_by         │ user_id
         ▼                    ▼
  public.projects       public.project_members
  ┌───────────────┐     ┌───────────────────────┐
  │ id (PK)       │◄────│ project_id (FK)        │
  │ name          │     │ user_id (FK)           │
  │ description   │     │ assigned_at            │
  │ is_active     │     └───────────────────────┘
  │ pass_threshold│
  │ quiz_open_at  │
  │ quiz_close_at │
  │ created_by    │
  └───┬───────────┘
      │
      ├──────────────────────────────────────────┐
      │                                          │
      ▼                                          ▼
  public.documents                         public.chat_sessions
  ┌────────────────────────┐               ┌──────────────────────┐
  │ id (PK)                │               │ id (PK)              │
  │ project_id (FK)        │               │ user_id (FK)         │
  │ file_name              │               │ project_id (FK)      │
  │ file_url               │               │ started_at           │
  │ file_type              │               │ message_count        │
  │ chunk_count            │               │ last_message_at      │
  │ uploaded_by (FK)       │               └──────────┬───────────┘
  └────────┬───────────────┘                          │
           │                                          ▼
           ▼                                  public.chat_messages
  public.document_chunks                     ┌──────────────────────┐
  ┌────────────────────────┐                 │ id (PK)              │
  │ id (PK)                │                 │ session_id (FK)      │
  │ document_id (FK)       │                 │ role: user|assistant │
  │ project_id (FK)        │                 │ content              │
  │ content                │                 │ sources (JSONB)      │
  │ embedding: vector(384) │                 │ created_at           │
  │ chunk_index            │                 └──────────────────────┘
  └────────────────────────┘

      │ (project_id)
      ▼
  public.quiz_sets
  ┌────────────────────────┐
  │ id (PK)                │
  │ project_id (FK)        │
  │ set_name               │
  │ set_number             │
  │ category               │  ← 'functional' | 'technical'
  │ is_active              │
  └────────┬───────────────┘
           │
           ▼
  public.quiz_questions
  ┌────────────────────────────┐
  │ id (PK)                    │
  │ quiz_set_id (FK)           │
  │ question_text              │
  │ question_type: mcq|true_false │
  │ option_a/b/c/d             │
  │ correct_option: A|B|C|D   │
  │ explanation                │
  │ marks: 1 | 2 | 3          │
  └────────────────────────────┘

  public.quiz_attempts
  ┌────────────────────────────────┐
  │ id (PK)                        │
  │ user_id (FK)                   │
  │ project_id (FK)                │
  │ quiz_set_id (FK)               │
  │ assigned_questions (JSONB)     │
  │ answers_given (JSONB)          │
  │ score / total_marks / %        │
  │ passed                         │
  │ status: in_progress|submitted  │
  │ started_at / submitted_at      │
  └────────────────────────────────┘

  public.quiz_resets
  ┌────────────────────────┐
  │ id (PK)                │
  │ user_id (FK)           │
  │ project_id (FK)        │
  │ reset_by (FK → users)  │
  │ reason                 │
  │ reset_at               │
  └────────────────────────┘

  public.processing_jobs                    ← Background job queue
  ┌──────────────────────────────────────┐
  │ id (PK, uuid)                        │
  │ type: document_process|quiz_generate │
  │ status: pending|running|done|failed  │
  │ payload (JSONB)                      │
  │ result (JSONB)                       │
  │ error (text)                         │
  │ created_at / started_at / completed_at│
  └──────────────────────────────────────┘

  public.activity_log
  ┌────────────────────────┐
  │ id (PK)                │
  │ user_id (FK)           │
  │ project_id (FK)        │
  │ action                 │
  │ metadata (JSONB)       │
  │ created_at             │
  └────────────────────────┘
```

### Row Level Security Summary

| Table | Member Access | Admin Access |
|---|---|---|
| users | Own row only | Full |
| projects | Assigned projects only | Full |
| project_members | Own memberships | Full |
| documents | Assigned project docs | Full |
| document_chunks | Assigned project chunks | Full |
| chat_sessions | Own sessions | Full |
| chat_messages | Own session messages | Full |
| quiz_sets | Assigned projects | Full |
| quiz_questions | Assigned projects | Full |
| quiz_attempts | Own attempts | Full |
| quiz_resets | — | Full |
| processing_jobs | — | Service role only |
| activity_log | Own actions | Full |

---

## 5. Core Feature Flows

### 5.1 Authentication & Authorization

```
  User visits protected route
          │
          ▼
  middleware.ts
  updateSession() ← refreshes Supabase session cookie
          │
          ▼
  lib/supabase/middleware.ts
  ┌────────────────────────────────────────────────┐
  │ Public routes?  → pass through                 │
  │ /admin/* ?      → require role = 'admin'       │
  │ /dashboard/* ?  → require role = 'member'      │
  │ No session?     → redirect → /login            │
  │ Wrong role?     → redirect → correct dashboard │
  └────────────────────────────────────────────────┘
          │
          ▼
  Page Server Component
  requireAdmin() | requireMember()  ← lib/auth.ts
  Returns { user, profile } or redirects
```

### 5.2 Document Ingestion Pipeline (RAG)

```
  Admin uploads file
          │
          ▼
  POST /api/documents/upload
  ┌──────────────────────────────────────────┐
  │ 1. Validate file type (PDF/DOCX/CSV/TXT) │
  │ 2. Upload to Supabase Storage            │
  │ 3. Insert record in documents table      │
  └──────────────────────────────────────────┘
          │
          ▼
  Admin clicks "Process" button
          │
          ▼
  POST /api/documents/process
  ┌──────────────────────────────────────────────────────┐
  │ 1. Auth + admin check                                │
  │ 2. INSERT processing_jobs                            │
  │    { type: 'document_process',                       │
  │      payload: { documentId, projectId } }            │
  │ 3. Return { jobId } immediately (< 100 ms)           │
  └──────────────────────────────────────────────────────┘
          │
          │  Frontend polls GET /api/jobs/[id] every 3 s
          │
          ▼
  Background worker picks up job (within 1 s)
  POST /api/jobs/worker (internal)
  ┌──────────────────────────────────────────────────────┐
  │ 1. Download file from Supabase Storage               │
  │ 2. Extract text                                      │
  │    ├── PDF    → pdf-parse                            │
  │    ├── DOCX   → mammoth                              │
  │    ├── CSV    → csv-parse                            │
  │    └── TXT    → raw buffer                           │
  │ 3. Chunk text (sliding window)                       │
  │    ├── chunk_size = 500 tokens (words)               │
  │    └── overlap = 50 tokens                           │
  │ 4. For each chunk:                                   │
  │    ├── embedText() via @xenova/all-MiniLM-L6-v2     │
  │    └── Upsert into document_chunks (vector 384)      │
  │ 5. Update documents.chunk_count                      │
  │ 6. Mark job status = 'done', result = { chunkCount } │
  └──────────────────────────────────────────────────────┘
          │
          ▼
  Frontend poll detects status='done' → shows "Ready"
```

### 5.3 AI-Grounded Chat (RAG)

```
  Member types a question
          │
          ▼
  POST /api/chat
  ┌──────────────────────────────────────────────────────────────┐
  │ 1. Auth check + rate limit (30 msg / hour)                   │
  │ 2. Project access check                                      │
  │ 3. embedText(question) → 384-dim vector                      │
  │ 4. match_document_chunks() pgvector cosine similarity        │
  │    └── Returns top-5 chunks for the project                  │
  │ 5. Build system prompt                                       │
  │    "Answer ONLY from this context: [chunks]"                 │
  │ 6. Check in-memory answer cache (projectId + message key)    │
  │    ├── Cache HIT  → return cached response immediately       │
  │    └── Cache MISS → call Groq                                │
  │ 7. Groq streaming completion                                 │
  │    ├── Primary: llama-3.3-70b-versatile                      │
  │    └── Fallback: llama-3.1-8b-instant (on rate limit/error)  │
  │ 8. Stream tokens to client via ReadableStream                │
  │ 9. Persist user + assistant messages in chat_messages        │
  │ 10. Log activity                                             │
  └──────────────────────────────────────────────────────────────┘
          │
          ▼
  Client receives streamed tokens
  Sources displayed as tags below response
```

### 5.4 Quiz Generation & Delivery

```
  ┌─────────────────────────────────────────────────┐
  │           ADMIN: QUIZ GENERATION                │
  │                                                 │
  │  Configure: category (functional|technical)     │
  │             numSets (1–5)                       │
  │                                                 │
  │  POST /api/quiz/generate                        │
  │  1. Auth + admin check                          │
  │  2. Fail-fast: verify document chunks exist     │
  │  3. INSERT processing_jobs                      │
  │     { type: 'quiz_generate',                    │
  │       payload: { projectId, category, numSets }}│
  │  4. Return { jobId } immediately                │
  │                                                 │
  │  Background worker picks up job within 1 s:     │
  │  1. Fetch up to 30 document_chunks              │
  │  2. Shuffle chunks (diversity)                  │
  │  3. Split into N groups (one per set)           │
  │  4. For each set (sleep 3 s between sets):      │
  │     ├── Build context (chunks × 300 chars max)  │
  │     ├── Call Groq llama-3.1-8b-instant          │
  │     │   (131K TPM — handles multi-set jobs)     │
  │     ├── Parse JSON response (10 questions/set)  │
  │     └── Insert quiz_set + quiz_questions        │
  │  5. Mark job done, result = { createdSets, ... }│
  │                                                 │
  │  Frontend polls → shows success banner          │
  └─────────────────────────────────────────────────┘

  ┌─────────────────────────────────────────────────┐
  │          MEMBER: QUIZ EXPERIENCE                │
  │                                                 │
  │  POST /api/quiz/start                           │
  │  1. Check quiz window (open_at / close_at)      │
  │  2. Check no submitted attempt exists           │
  │  3. Assign questions from active quiz_set       │
  │     ├── Functional set  → N questions           │
  │     ├── Technical set   → N questions           │
  │     └── Shuffle options (Fisher-Yates)          │
  │  4. Create quiz_attempt (status=in_progress)    │
  │                                                 │
  │  Member answers questions one-by-one            │
  │                                                 │
  │  POST /api/quiz/submit                          │
  │  1. Validate attempt ownership + status         │
  │  2. Calculate score (correct × marks)           │
  │  3. Compute percentage, passed (≥ threshold%)   │
  │  4. Update attempt (status=submitted)           │
  │  5. Send email notification via Resend          │
  │  6. Log activity                                │
  └─────────────────────────────────────────────────┘
```

### 5.5 Background Job Queue

```
  Admin action (process doc / generate quiz)
          │
          ▼
  API route inserts row into processing_jobs
  { status: 'pending', type, payload }
          │
          │  Returns jobId to client immediately
          │
          ▼
  Standalone worker (worker/index.mjs)
  polls POST /api/jobs/worker every 1 second
          │
          ▼
  /api/jobs/worker
  ┌──────────────────────────────────────────────┐
  │ 1. Auth: x-worker-secret header check        │
  │ 2. claim_next_pending_job() RPC              │
  │    SELECT ... FOR UPDATE SKIP LOCKED         │
  │    → atomically sets status='running'        │
  │ 3. Route by job.type:                        │
  │    document_process → processDocumentJob()   │
  │    quiz_generate    → processQuizGenerateJob()│
  │ 4. On success: status='done', result=...     │
  │    On failure: status='failed', error=...    │
  └──────────────────────────────────────────────┘
          │
          ▼
  Frontend polls GET /api/jobs/[id] every 3 s
  until status = 'done' | 'failed'

  Safety net (pg_cron, every 1 minute):
  ┌─────────────────────────────────────────────┐
  │ Reset jobs stuck in 'running' > 10 minutes  │
  │ back to 'pending' for retry                 │
  └─────────────────────────────────────────────┘
```

---

## 6. Component Hierarchy

```
app/layout.tsx
└── (role-specific layout)
    ├── AdminLayout
    │   ├── AdminSidebar / AdminMobileSidebar
    │   │   ├── Project navigation links
    │   │   └── LogoutButton
    │   └── [page content]
    │       ├── AdminDashboardPage
    │       │   ├── StatsCard ×5
    │       │   └── ActivityFeed
    │       ├── AdminProjectsPage
    │       │   └── ProjectCard ×N
    │       └── AdminProjectDetailPage
    │           ├── DocumentUploadPanel
    │           │   └── (upload → job queue → poll → done)
    │           ├── MembersPage
    │           │   └── InviteForm
    │           ├── QuizPage
    │           │   ├── QuizGenerator (queue + poll job)
    │           │   ├── QuizWindowForm (schedule)
    │           │   ├── QuizSetsPanel (list sets)
    │           │   └── QuizResultsCard (per-member)
    │           ├── AnalyticsPage
    │           │   └── AnalyticsTable ×3
    │           └── ChatPage
    │               └── ChatInterface
    │                   ├── MessageBubble ×N
    │                   └── SourceTag ×N
    │
    └── MemberLayout
        ├── MemberSidebar / MemberMobileSidebar
        └── [page content]
            ├── MemberDashboardPage
            │   └── ProjectCard ×N
            ├── MemberProjectDetailPage
            │   └── SetupPanel / overview
            ├── ChatPage
            │   └── ChatInterface
            └── QuizPage
                └── QuizExperience
                    ├── QuizCard (pre-start)
                    ├── QuestionView ×N
                    └── ResultSummary
```

---

## 7. API Surface

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/chat?sessionId=` | Member/Admin | Load chat history for a session |
| POST | `/api/chat` | Member/Admin | Send message, get streaming response |
| POST | `/api/documents/upload` | Admin | Upload file to Supabase Storage |
| POST | `/api/documents/process` | Admin | Queue document_process job; returns `{ jobId }` |
| GET | `/api/documents/view?documentId=` | Member/Admin | Get signed URL for document preview |
| POST | `/api/quiz/generate` | Admin | Queue quiz_generate job; returns `{ jobId }` |
| POST | `/api/quiz/start` | Member | Begin quiz attempt |
| POST | `/api/quiz/submit` | Member | Submit answers and receive score |
| POST | `/api/jobs/worker` | Worker secret | Claim and execute next pending job |
| GET | `/api/jobs/[id]` | Authenticated | Poll job status (`pending/running/done/failed`) |
| GET | `/api/admin/analytics?projectId=` | Admin | Per-project chatbot + quiz + login analytics |
| POST | `/api/admin/invite` | Admin | Invite member by email (Supabase invite) |
| GET | `/auth/callback` | Public | Supabase OAuth/magic-link callback |

---

## 8. Security Model

```
  ┌────────────────────────────────────────────────────┐
  │                 SECURITY LAYERS                    │
  │                                                    │
  │  1. Supabase Auth (JWT)                            │
  │     └── Session cookie refreshed on every request  │
  │                                                    │
  │  2. Middleware Route Guards                        │
  │     ├── /admin/* → role must be 'admin'            │
  │     └── /dashboard,/projects → role = 'member'     │
  │                                                    │
  │  3. API Route Auth Checks                          │
  │     ├── getCurrentUserContext() on every request   │
  │     ├── getProfileById() to verify role            │
  │     └── userHasProjectAccess() for member APIs     │
  │                                                    │
  │  4. Postgres Row Level Security (RLS)              │
  │     ├── is_admin() SQL function                    │
  │     ├── is_project_member(project_id) function     │
  │     └── Policies on all tables                     │
  │                                                    │
  │  5. Rate Limiting                                  │
  │     └── 30 chat messages / hour / user             │
  │         (enforced via activity_log count query)    │
  │                                                    │
  │  6. Service Role Client                            │
  │     └── Used server-side only (bypasses RLS)       │
  │         never exposed to browser                   │
  │                                                    │
  │  7. Worker Route Authentication                    │
  │     └── x-worker-secret header must match          │
  │         WORKER_SECRET env var when set             │
  └────────────────────────────────────────────────────┘
```

---

## 9. Known Gaps

| # | Area | Gap | Impact |
|---|---|---|---|
| 1 | **Answer Cache** | In-memory `Map` is per-process and lost on restart; shared cache (Redis/KV) not implemented | Cache is useless in multi-instance deployments |
| 2 | **Embedding Cold Start** | `@xenova/transformers` model downloads on first request (~80MB); no warmup or persistent cache | First chat per cold start can take 30–60s |
| 3 | **Quiz Anti-Cheating** | Tab-switch/window-blur detection is absent; copy-paste prevention not enforced | Quiz integrity not guaranteed |
| 4 | **Email Configuration** | `RESEND_API_KEY` and `RESEND_FROM_EMAIL` are absent from `.env.example`; email silently skipped if unset | Admin never receives quiz notifications |
| 5 | **Admin Creation** | No seeding mechanism or UI flow to promote the first user to admin | Manual DB update required after first signup |
| 6 | **Document Deletion** | No API or UI to delete documents or reprocess after re-upload | Stale/incorrect chunks accumulate |
| 7 | **Quiz Set Deletion** | No ability to delete a generated quiz set or individual questions | Bad AI output cannot be removed |
| 8 | **Pagination** | All data fetches are unbounded | Performance degrades at scale |
| 9 | **File Validation** | No server-side MIME type check beyond extension | Malicious files can be uploaded |
| 10 | **File Size Limit** | No size cap on upload endpoint | Storage exhaustion possible |

---

## 10. Good-to-Have Features

### 10.1 Knowledge & Learning

| Feature | Description |
|---|---|
| **Conversation history** | Multi-session history panel; members can resume previous chats |
| **Chat bookmarks** | Members can save important AI answers for later reference |
| **Knowledge gap reports** | Analyse questions with no matching chunks (low-similarity results) |
| **Document versioning** | Track revisions; re-process on update; keep old chunks for history |

### 10.2 Quiz & Assessment

| Feature | Description |
|---|---|
| **Timed quiz mode** | Configurable per-question or total time limits with countdown |
| **Manual question editing** | Admin can edit/delete individual AI-generated questions |
| **Multiple quiz categories** | Support categories beyond functional/technical |
| **Partial quiz retake** | Retake only failed sections rather than full reset |
| **Certificate of completion** | Auto-generate PDF certificate when a member passes |

### 10.3 Analytics & Reporting

| Feature | Description |
|---|---|
| **Exportable reports** | CSV/PDF export of quiz results and chatbot usage |
| **Per-question analytics** | Track which questions are most frequently wrong |
| **Completion dashboard** | Visual progress bars per project |
| **Score trend over resets** | Chart score improvement across multiple attempts |

### 10.4 Infrastructure

| Feature | Description |
|---|---|
| **Shared embedding cache** | Replace in-process singleton with persistent cache or external API |
| **Test suite** | Unit tests for scoring, chunking, shuffling; integration tests for routes |
| **SSO / SAML integration** | Enterprise SSO via Supabase Auth providers (Okta, Azure AD) |
