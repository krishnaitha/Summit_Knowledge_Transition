create table if not exists document_threads (
  id          uuid        primary key default gen_random_uuid(),
  project_id  uuid        not null references projects(id) on delete cascade,
  document_id uuid        not null references documents(id) on delete cascade,
  created_by  uuid        references users(id) on delete set null,
  title       text        not null,
  page_number integer,
  status      text        not null default 'open' check (status in ('open', 'resolved')),
  resolved_by uuid        references users(id) on delete set null,
  resolved_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint document_threads_page_number_check
    check (page_number is null or page_number > 0)
);

create table if not exists document_thread_comments (
  id         uuid        primary key default gen_random_uuid(),
  thread_id  uuid        not null references document_threads(id) on delete cascade,
  author_id  uuid        references users(id) on delete set null,
  body       text        not null,
  is_answer  boolean     not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists document_threads_document_status_updated_idx
  on document_threads (document_id, status, updated_at desc);

create index if not exists document_threads_project_updated_idx
  on document_threads (project_id, updated_at desc);

create index if not exists document_thread_comments_thread_created_idx
  on document_thread_comments (thread_id, created_at asc);
