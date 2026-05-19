create table if not exists flashcards (
  id              uuid        primary key default gen_random_uuid(),
  project_id      uuid        not null references projects(id) on delete cascade,
  source_chunk_id uuid        references document_chunks(id) on delete set null,
  question        text        not null,
  answer          text        not null,
  difficulty      text        not null default 'medium' check (difficulty in ('easy', 'medium', 'hard')),
  created_by      uuid        references users(id) on delete set null,
  created_at      timestamptz not null default now()
);

create table if not exists flashcard_progress (
  id               uuid        primary key default gen_random_uuid(),
  user_id          uuid        not null references users(id) on delete cascade,
  flashcard_id     uuid        not null references flashcards(id) on delete cascade,
  interval_days    integer     not null default 1,
  ease_factor      numeric(4,2) not null default 2.50,
  repetitions      integer     not null default 0,
  due_at           timestamptz not null default now(),
  last_reviewed_at timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique(user_id, flashcard_id)
);

create index if not exists flashcards_project_created_idx
  on flashcards (project_id, created_at desc);

create index if not exists flashcards_project_chunk_idx
  on flashcards (project_id, source_chunk_id);

create index if not exists flashcard_progress_user_due_idx
  on flashcard_progress (user_id, due_at asc);
