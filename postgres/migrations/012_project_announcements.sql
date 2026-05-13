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

alter table public.project_announcements enable row level security;

drop policy if exists "project announcements member read" on public.project_announcements;
create policy "project announcements member read"
  on public.project_announcements
  for select
  using (
    public.is_admin()
    or exists (
      select 1
      from public.project_members pm
      where pm.project_id = project_announcements.project_id
        and pm.user_id = auth.uid()
    )
  );

drop policy if exists "project announcements admin write" on public.project_announcements;
create policy "project announcements admin write"
  on public.project_announcements
  for all
  using (public.is_admin())
  with check (public.is_admin());
