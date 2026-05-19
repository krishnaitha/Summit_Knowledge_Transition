create table if not exists quiz_attempt_history (
  id                  uuid        primary key default gen_random_uuid(),
  original_attempt_id uuid,
  user_id             uuid        not null references users(id) on delete cascade,
  project_id          uuid        not null references projects(id) on delete cascade,
  quiz_set_id         uuid        references quiz_sets(id) on delete set null,
  score               integer,
  total_marks         integer,
  percentage          numeric(5,2),
  passed              boolean,
  submitted_at        timestamptz,
  reset_at            timestamptz not null default now(),
  reset_by            uuid        references users(id) on delete set null,
  reset_reason        text        not null default 'Reset by admin'
);

create index if not exists quiz_attempt_history_user_project_reset_idx
  on quiz_attempt_history (user_id, project_id, reset_at desc);
