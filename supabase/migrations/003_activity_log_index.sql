-- Composite index for rate-limit queries in lib/rate-limit.ts
-- Covers: WHERE user_id = $1 AND action = $2 AND created_at >= $3
create index if not exists activity_log_rate_limit_idx
  on public.activity_log (user_id, action, created_at desc);
