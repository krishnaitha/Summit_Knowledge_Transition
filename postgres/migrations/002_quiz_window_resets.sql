-- Quiz window on projects
alter table public.projects add column if not exists quiz_open_at  timestamptz;
alter table public.projects add column if not exists quiz_close_at timestamptz;

-- Track admin resets with reason
create table if not exists public.quiz_resets (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users(id)    on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  reset_by   uuid references public.users(id),
  reason     text not null,
  reset_at   timestamptz not null default now()
);

-- Note: RLS/policies removed — this app uses server-side auth, not Supabase RLS.
