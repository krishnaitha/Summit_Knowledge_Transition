-- 011_observability.sql
-- RAG trace table: one row per chat POST request.
-- Written fire-and-forget after stream completes; never blocks user response.

create table if not exists public.rag_traces (
  id                     uuid        primary key default gen_random_uuid(),
  created_at             timestamptz not null default now(),

  -- Request context
  project_id             uuid        references public.projects(id) on delete set null,
  user_id                uuid        references public.users(id)    on delete set null,
  session_id             uuid        references public.chat_sessions(id) on delete set null,
  message_id             uuid        references public.chat_messages(id) on delete set null,
  query_text             text        not null,

  -- Retrieval metrics
  chunks_retrieved       integer     not null default 0,
  max_similarity         numeric(6,4),
  avg_similarity         numeric(6,4),
  retrieval_hit          boolean     not null default false,
  retrieval_ms           integer,

  -- Generation metrics
  model_used             text,
  prompt_tokens          integer,
  completion_tokens      integer,
  total_tokens           integer,
  generation_ms          integer,

  -- End-to-end
  total_ms               integer,

  -- Derived signal flags
  answer_cached          boolean     not null default false,
  answer_refused         boolean     not null default false,
  possible_hallucination boolean     not null default false,
  is_slow                boolean     not null generated always as (total_ms > 8000) stored
);

-- Primary analytics query support
create index if not exists rag_traces_project_created
  on public.rag_traces (project_id, created_at desc);

-- Partial indexes for boolean flag queries
create index if not exists rag_traces_refused
  on public.rag_traces (project_id, created_at desc)
  where answer_refused = true;

create index if not exists rag_traces_hallucination
  on public.rag_traces (project_id, created_at desc)
  where possible_hallucination = true;

create index if not exists rag_traces_slow
  on public.rag_traces (project_id, created_at desc)
  where is_slow = true;

-- RLS: service role bypasses automatically. Admins can SELECT.
alter table public.rag_traces enable row level security;

drop policy if exists "rag traces admin read" on public.rag_traces;
create policy "rag traces admin read"
  on public.rag_traces
  for select
  using (public.is_admin());

-- Aggregate summary function: single table scan for all KPI counts.
-- Called by getObservabilityMetrics() in lib/data.ts.
create or replace function public.get_rag_trace_summary(filter_project_id uuid)
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
  from public.rag_traces
  where project_id = filter_project_id;
$$;
