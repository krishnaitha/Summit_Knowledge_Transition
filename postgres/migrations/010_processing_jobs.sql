-- pg_cron is optional: used only to reset stuck jobs.
-- Jobs are triggered by the standalone worker process (worker/index.mjs).
do $$ begin
  create extension if not exists pg_cron;
exception when others then
  raise notice 'pg_cron not available — skipping extension install';
end $$;

-- Background job queue table
create table if not exists processing_jobs (
  id            uuid primary key default gen_random_uuid(),
  type          text not null check (type in ('document_process', 'quiz_generate', 'connector_sync')),
  status        text not null default 'pending'
                  check (status in ('pending', 'running', 'done', 'failed')),
  payload       jsonb not null default '{}',
  result        jsonb,
  error         text,
  created_at    timestamptz not null default now(),
  started_at    timestamptz,
  completed_at  timestamptz
);

create index if not exists processing_jobs_status_created_at
  on processing_jobs (status, created_at);

-- Atomically claim the next pending job using FOR UPDATE SKIP LOCKED
-- Returns the claimed row (status already set to 'running') or nothing.
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

-- pg_cron: reset jobs that have been stuck in 'running' for > 10 minutes
-- (handles crashed or timed-out worker invocations)
-- Wrapped in a DO block so it is skipped gracefully if pg_cron is not installed.
do $$ begin
  perform cron.schedule(
    'reset-stuck-jobs',
    '* * * * *',
    $cron$
      update processing_jobs
      set    status     = 'pending',
             started_at = null
      where  status     = 'running'
        and  started_at < now() - interval '10 minutes';
    $cron$
  );
exception when others then
  raise notice 'pg_cron not available — skipping stuck-job reset schedule';
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Job triggering — standalone worker process (NOT pg_net)
--
-- Run the worker alongside your Next.js app:
--
--   INTERNAL_APP_URL=http://localhost:3000 \
--   WORKER_SECRET=your-secret \
--   npm run worker
--
-- The worker polls POST /api/jobs/worker every 5 s (configurable via
-- WORKER_POLL_MS).  When a job is processed it immediately re-polls to drain
-- the queue before sleeping again.
--
-- The pg_cron stuck-job reset above handles any jobs left in 'running' if
-- the worker crashes mid-job.
-- ─────────────────────────────────────────────────────────────────────────────
