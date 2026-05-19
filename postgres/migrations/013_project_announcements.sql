create table if not exists public.project_announcements (
  id         uuid        primary key default gen_random_uuid(),
  project_id uuid        not null references public.projects(id) on delete cascade,
  title      text        not null,
  message    text        not null,
  sent_by    uuid        references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists project_announcements_project_created_idx
  on public.project_announcements (project_id, created_at desc);

-- Note: RLS/policies removed — this app uses server-side auth, not Supabase RLS.
