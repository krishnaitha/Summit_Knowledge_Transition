alter table documents
  add column if not exists is_required boolean not null default false;

create table if not exists quiz_coaching_plans (
  id               uuid        primary key default gen_random_uuid(),
  attempt_id       uuid        not null unique references quiz_attempts(id) on delete cascade,
  user_id          uuid        not null references users(id) on delete cascade,
  project_id       uuid        not null references projects(id) on delete cascade,
  weak_sections    jsonb       not null default '[]',
  recommendations  jsonb       not null default '[]',
  created_at       timestamptz not null default now()
);

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

create index if not exists documents_required_idx
  on documents (project_id, is_required);

create index if not exists coaching_project_user_idx
  on quiz_coaching_plans (project_id, user_id, created_at desc);

create index if not exists chat_feedback_project_rating_idx
  on chat_answer_feedback (project_id, rating, created_at desc);
