-- Persistent user memory

create table if not exists user_memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  project_id uuid references projects(id) on delete set null,
  memory_key text not null,
  memory_value text not null,
  tags text[] not null default '{}',
  confidence numeric(4,2) not null default 0.80,
  source text not null default 'explicit' check (source in ('explicit', 'manual')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_used_at timestamptz,
  unique(user_id, memory_key)
);

create table if not exists user_memory_pending_confirmations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  session_id uuid not null references chat_sessions(id) on delete cascade,
  project_id uuid references projects(id) on delete cascade,
  memory_key text not null,
  memory_value text not null,
  tags text[] not null default '{}',
  is_sensitive boolean not null default false,
  allows_sensitive_storage boolean not null default false,
  expires_at timestamptz not null default (now() + interval '10 minutes'),
  created_at timestamptz not null default now(),
  unique(user_id, session_id)
);

create index if not exists user_memories_user_project_updated_idx
  on user_memories (user_id, project_id, updated_at desc);

create index if not exists user_memory_pending_lookup_idx
  on user_memory_pending_confirmations (user_id, session_id, expires_at desc);
