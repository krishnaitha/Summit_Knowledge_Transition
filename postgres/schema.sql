-- =============================================================================
-- Summit KT Portal — PostgreSQL Schema (standalone, no Supabase)
-- Generated from migrations 001–011
--
-- Prerequisites (run once in psql as superuser):
--   CREATE EXTENSION IF NOT EXISTS vector;
--   CREATE EXTENSION IF NOT EXISTS pgcrypto;
--
-- Run this file:
--   psql -U postgres -d summit_kt -f postgres/schema.sql
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
create extension if not exists vector;
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Enum types
-- ---------------------------------------------------------------------------
do $$ begin
  create type user_role as enum ('admin', 'member');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type chat_role as enum ('user', 'assistant');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type quiz_option as enum ('A', 'B', 'C', 'D');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type quiz_attempt_status as enum ('in_progress', 'submitted');
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- Users (standalone — no auth.users reference)
create table if not exists users (
  id            uuid        primary key default gen_random_uuid(),
  email         text        not null unique,
  full_name     text,
  role          user_role   not null default 'member',
  password_hash text,                     -- bcrypt hash; null for Cognito/SSO users
  auth_provider text        not null default 'credentials', -- 'credentials' | 'cognito'
  created_at    timestamptz not null default now(),
  last_login_at timestamptz,
  is_active     boolean     not null default true
);

-- Invite tokens (replaces Supabase auth invite flow)
create table if not exists invite_tokens (
  id         uuid        primary key default gen_random_uuid(),
  email      text        not null,
  token      text        not null unique,
  role       user_role   not null default 'member',
  project_id uuid,                         -- optional: auto-assign to project on accept
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

-- Projects
create table if not exists projects (
  id             uuid        primary key default gen_random_uuid(),
  name           text        not null,
  description    text,
  created_by     uuid        references users(id),
  created_at     timestamptz not null default now(),
  is_active      boolean     not null default true,
  pass_threshold integer     not null default 60,
  -- 002: quiz window
  quiz_open_at   timestamptz,
  quiz_close_at  timestamptz
);

-- Project members
create table if not exists project_members (
  id         uuid        primary key default gen_random_uuid(),
  project_id uuid        not null references projects(id) on delete cascade,
  user_id    uuid        not null references users(id) on delete cascade,
  role       text        not null default 'member' check (role in ('member', 'admin')),
  assigned_at timestamptz not null default now(),
  unique(project_id, user_id)
);

-- Project announcements
create table if not exists project_announcements (
  id         uuid        primary key default gen_random_uuid(),
  project_id uuid        not null references projects(id) on delete cascade,
  title      text        not null,
  message    text        not null,
  sent_by    uuid        references users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Documents
create table if not exists documents (
  id             uuid        primary key default gen_random_uuid(),
  project_id     uuid        not null references projects(id) on delete cascade,
  file_name      text        not null,
  file_url       text        not null,
  file_type      text        not null,
  uploaded_by    uuid        references users(id),
  uploaded_at    timestamptz not null default now(),
  chunk_count    integer     not null default 0,
  -- 004: governance
  pii_detections integer     not null default 0,
  classification text        not null default 'public',
  is_required    boolean     not null default false,
  scan_flags     text[]      not null default '{}',
  constraint documents_classification_check
    check (classification in ('public', 'internal', 'confidential'))
);

-- Per-attempt coaching generated after submission
create table if not exists quiz_coaching_plans (
  id               uuid        primary key default gen_random_uuid(),
  attempt_id       uuid        not null unique references quiz_attempts(id) on delete cascade,
  user_id          uuid        not null references users(id) on delete cascade,
  project_id       uuid        not null references projects(id) on delete cascade,
  weak_sections    jsonb       not null default '[]',
  recommendations  jsonb       not null default '[]',
  created_at       timestamptz not null default now()
);

-- Member feedback on AI answers
create table if not exists chat_answer_feedback (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references users(id) on delete cascade,
  project_id  uuid        not null references projects(id) on delete cascade,
  message_id  uuid        not null references chat_messages(id) on delete cascade,
  rating      text        not null check (rating in ('up', 'down')),
  reason_tag  text,
  comment     text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique(user_id, message_id)
);

-- Document chunks (vector embeddings)
create table if not exists document_chunks (
  id          uuid        primary key default gen_random_uuid(),
  document_id uuid        not null references documents(id) on delete cascade,
  project_id  uuid        not null references projects(id) on delete cascade,
  content     text        not null,
  embedding   vector(384),
  chunk_index integer     not null,
  created_at  timestamptz not null default now()
);

-- Chat sessions
create table if not exists chat_sessions (
  id              uuid        primary key default gen_random_uuid(),
  user_id         uuid        not null references users(id) on delete cascade,
  project_id      uuid        not null references projects(id) on delete cascade,
  started_at      timestamptz not null default now(),
  message_count   integer     not null default 0,
  last_message_at timestamptz default now()
);

-- Chat messages
create table if not exists chat_messages (
  id         uuid        primary key default gen_random_uuid(),
  session_id uuid        not null references chat_sessions(id) on delete cascade,
  role       chat_role   not null,
  content    text        not null,
  sources    jsonb,
  created_at timestamptz not null default now()
);

-- Chat bookmarks (006)
create table if not exists chat_bookmarks (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references users(id) on delete cascade,
  project_id uuid        not null references projects(id) on delete cascade,
  message_id uuid        not null references chat_messages(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(user_id, message_id)
);

-- Quiz sets
create table if not exists quiz_sets (
  id         uuid        primary key default gen_random_uuid(),
  project_id uuid        not null references projects(id) on delete cascade,
  set_name   text        not null,
  set_number integer     not null,
  is_active  boolean     not null default true,
  created_at timestamptz not null default now(),
  -- 007: category
  category   text        not null default 'general',
  unique(project_id, set_number)
);

-- Quiz questions
create table if not exists quiz_questions (
  id             uuid        primary key default gen_random_uuid(),
  quiz_set_id    uuid        not null references quiz_sets(id) on delete cascade,
  question_text  text        not null,
  option_a       text        not null,
  option_b       text        not null,
  option_c       text        not null,
  option_d       text        not null,
  correct_option quiz_option not null,
  explanation    text,
  marks          integer     not null default 1,
  -- 009: question type
  question_type  text        not null default 'mcq'
);

-- Quiz attempts
create table if not exists quiz_attempts (
  id                  uuid                 primary key default gen_random_uuid(),
  user_id             uuid                 not null references users(id) on delete cascade,
  project_id          uuid                 not null references projects(id) on delete cascade,
  quiz_set_id         uuid                 not null references quiz_sets(id) on delete cascade,
  assigned_questions  jsonb                not null,
  answers_given       jsonb,
  score               integer,
  total_marks         integer,
  percentage          numeric(5,2),
  passed              boolean,
  started_at          timestamptz          not null default now(),
  submitted_at        timestamptz,
  status              quiz_attempt_status  not null default 'in_progress',
  -- 008: partial retake
  carried_sections    jsonb
);

-- Quiz resets (002)
create table if not exists quiz_resets (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references users(id) on delete cascade,
  project_id uuid        not null references projects(id) on delete cascade,
  reset_by   uuid        references users(id),
  reason     text        not null,
  reset_at   timestamptz not null default now()
);

-- Activity log
create table if not exists activity_log (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        references users(id) on delete set null,
  project_id uuid        references projects(id) on delete set null,
  action     text        not null,
  metadata   jsonb,
  created_at timestamptz not null default now()
);

-- Background processing jobs (010)
create table if not exists processing_jobs (
  id           uuid        primary key default gen_random_uuid(),
  type         text        not null check (type in ('document_process', 'quiz_generate')),
  status       text        not null default 'pending'
                             check (status in ('pending', 'running', 'done', 'failed')),
  payload      jsonb       not null default '{}',
  result       jsonb,
  error        text,
  created_at   timestamptz not null default now(),
  started_at   timestamptz,
  completed_at timestamptz
);

-- RAG observability traces (011)
create table if not exists rag_traces (
  id                     uuid        primary key default gen_random_uuid(),
  created_at             timestamptz not null default now(),
  project_id             uuid        references projects(id) on delete set null,
  user_id                uuid        references users(id) on delete set null,
  session_id             uuid        references chat_sessions(id) on delete set null,
  message_id             uuid        references chat_messages(id) on delete set null,
  query_text             text        not null,
  chunks_retrieved       integer     not null default 0,
  max_similarity         numeric(6,4),
  avg_similarity         numeric(6,4),
  retrieval_hit          boolean     not null default false,
  retrieval_ms           integer,
  model_used             text,
  prompt_tokens          integer,
  completion_tokens      integer,
  total_tokens           integer,
  generation_ms          integer,
  total_ms               integer,
  answer_cached          boolean     not null default false,
  answer_refused         boolean     not null default false,
  possible_hallucination boolean     not null default false,
  is_slow                boolean     not null generated always as (total_ms > 8000) stored
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

-- One submitted attempt per user per project
create unique index if not exists quiz_attempts_one_per_user_project_submitted
  on quiz_attempts (user_id, project_id)
  where status = 'submitted';

-- Chat bookmarks lookup
create index if not exists chat_bookmarks_user_project_idx
  on chat_bookmarks(user_id, project_id);

-- Rate-limit queries (lib/rate-limit.ts)
create index if not exists activity_log_rate_limit_idx
  on activity_log (user_id, action, created_at desc);

create index if not exists project_announcements_project_created_idx
  on project_announcements (project_id, created_at desc);

create index if not exists documents_required_idx
  on documents (project_id, is_required);

create index if not exists coaching_project_user_idx
  on quiz_coaching_plans (project_id, user_id, created_at desc);

create index if not exists chat_feedback_project_rating_idx
  on chat_answer_feedback (project_id, rating, created_at desc);

-- Processing jobs by status
create index if not exists processing_jobs_status_created_at
  on processing_jobs (status, created_at);

-- RAG trace analytics
create index if not exists rag_traces_project_created
  on rag_traces (project_id, created_at desc);

create index if not exists rag_traces_refused
  on rag_traces (project_id, created_at desc)
  where answer_refused = true;

create index if not exists rag_traces_hallucination
  on rag_traces (project_id, created_at desc)
  where possible_hallucination = true;

create index if not exists rag_traces_slow
  on rag_traces (project_id, created_at desc)
  where is_slow = true;

-- ---------------------------------------------------------------------------
-- Functions
-- ---------------------------------------------------------------------------

-- Vector similarity search for RAG
create or replace function match_document_chunks(
  query_embedding vector(384),
  filter_project_id uuid,
  match_count int default 5
)
returns table (
  id            uuid,
  content       text,
  document_id   uuid,
  document_name text,
  similarity    float
)
language sql as $$
  select
    dc.id,
    dc.content,
    dc.document_id,
    d.file_name as document_name,
    1 - (dc.embedding <=> query_embedding) as similarity
  from document_chunks dc
  join documents d on d.id = dc.document_id
  where dc.project_id = filter_project_id
  order by dc.embedding <=> query_embedding
  limit match_count;
$$;

-- Atomically claim the next pending job (FOR UPDATE SKIP LOCKED)
create or replace function claim_next_pending_job()
returns setof processing_jobs as $$
  update processing_jobs
  set    status     = 'running',
         started_at = now()
  where  id = (
    select id
    from   processing_jobs
    where  status = 'pending'
    order  by created_at
    limit  1
    for update skip locked
  )
  returning *;
$$ language sql;

-- Aggregate KPI summary for observability panel
create or replace function get_rag_trace_summary(filter_project_id uuid)
returns table (
  total_requests      bigint,
  hit_count           bigint,
  refused_count       bigint,
  hallucination_count bigint,
  slow_count          bigint,
  avg_similarity      numeric
)
language sql stable as $$
  select
    count(*)                                              as total_requests,
    count(*) filter (where retrieval_hit = true)          as hit_count,
    count(*) filter (where answer_refused = true)         as refused_count,
    count(*) filter (where possible_hallucination = true) as hallucination_count,
    count(*) filter (where is_slow = true)                as slow_count,
    round(avg(max_similarity)::numeric, 4)                as avg_similarity
  from rag_traces
  where project_id = filter_project_id;
$$;

-- ---------------------------------------------------------------------------
-- Seed data
-- ---------------------------------------------------------------------------
-- After creating your first admin user via the app or direct INSERT,
-- run this to promote them:
--
--   UPDATE users SET role = 'admin' WHERE email = 'your-admin@company.com';
-- ---------------------------------------------------------------------------
