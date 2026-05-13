-- Chat bookmarks: members can save assistant messages for later reference
create table if not exists chat_bookmarks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  project_id  uuid not null references projects(id) on delete cascade,
  message_id  uuid not null references chat_messages(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique(user_id, message_id)
);

create index if not exists chat_bookmarks_user_project_idx on chat_bookmarks(user_id, project_id);
