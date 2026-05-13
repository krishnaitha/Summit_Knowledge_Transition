create table if not exists project_announcements (
  id         uuid        primary key default gen_random_uuid(),
  project_id uuid        not null references projects(id) on delete cascade,
  title      text        not null,
  message    text        not null,
  sent_by    uuid        references users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists project_announcements_project_created_idx
  on project_announcements (project_id, created_at desc);
