create extension if not exists vector;
create extension if not exists pgcrypto;

do $$ begin
  create type user_role as enum ('admin', 'member');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type chat_role as enum ('user', 'assistant');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type quiz_option as enum ('A', 'B', 'C', 'D');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type quiz_attempt_status as enum ('in_progress', 'submitted');
exception when duplicate_object then null;
end $$;

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text,
  role user_role not null default 'member',
  created_at timestamptz not null default now(),
  last_login_at timestamptz,
  is_active boolean not null default true
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  created_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  is_active boolean not null default true,
  pass_threshold integer not null default 60
);

create table if not exists public.project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  unique(project_id, user_id)
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  file_name text not null,
  file_url text not null,
  file_type text not null,
  uploaded_by uuid references public.users(id),
  uploaded_at timestamptz not null default now(),
  chunk_count integer not null default 0
);

create table if not exists public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  content text not null,
  embedding vector(384),
  chunk_index integer not null,
  created_at timestamptz not null default now()
);

create table if not exists public.chat_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  started_at timestamptz not null default now(),
  message_count integer not null default 0,
  last_message_at timestamptz default now()
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.chat_sessions(id) on delete cascade,
  role chat_role not null,
  content text not null,
  sources jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.quiz_sets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  set_name text not null,
  set_number integer not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(project_id, set_number)
);

create table if not exists public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  quiz_set_id uuid not null references public.quiz_sets(id) on delete cascade,
  question_text text not null,
  option_a text not null,
  option_b text not null,
  option_c text not null,
  option_d text not null,
  correct_option quiz_option not null,
  explanation text,
  marks integer not null default 1
);

create table if not exists public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  quiz_set_id uuid not null references public.quiz_sets(id) on delete cascade,
  assigned_questions jsonb not null,
  answers_given jsonb,
  score integer,
  total_marks integer,
  percentage numeric(5,2),
  passed boolean,
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  status quiz_attempt_status not null default 'in_progress'
);

create unique index if not exists quiz_attempts_one_per_user_project_submitted
  on public.quiz_attempts (user_id, project_id)
  where status = 'submitted';

create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  action text not null,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.match_document_chunks(
  query_embedding vector(384),
  filter_project_id uuid,
  match_count int default 5
)
returns table (
  id uuid,
  content text,
  document_id uuid,
  document_name text,
  similarity float
)
language sql
as $$
  select
    dc.id,
    dc.content,
    dc.document_id,
    d.file_name as document_name,
    1 - (dc.embedding <=> query_embedding) as similarity
  from public.document_chunks dc
  join public.documents d on d.id = dc.document_id
  where dc.project_id = filter_project_id
  order by dc.embedding <=> query_embedding
  limit match_count;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, full_name, role)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', null),
    'member'
  )
  on conflict (id) do update
  set email = excluded.email,
      full_name = coalesce(excluded.full_name, public.users.full_name);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

alter table public.users enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.documents enable row level security;
alter table public.document_chunks enable row level security;
alter table public.chat_sessions enable row level security;
alter table public.chat_messages enable row level security;
alter table public.quiz_sets enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.activity_log enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from public.users where id = auth.uid() and role = 'admin' and is_active = true
  );
$$;

create or replace function public.is_project_member(project uuid)
returns boolean
language sql
stable
as $$
  select public.is_admin() or exists (
    select 1 from public.project_members pm where pm.project_id = project and pm.user_id = auth.uid()
  );
$$;

drop policy if exists "users self read" on public.users;
create policy "users self read" on public.users for select using (id = auth.uid() or public.is_admin());

drop policy if exists "users self update" on public.users;
create policy "users self update" on public.users for update using (id = auth.uid() or public.is_admin()) with check (id = auth.uid() or public.is_admin());

drop policy if exists "projects member read" on public.projects;
create policy "projects member read" on public.projects for select using (public.is_project_member(id));

drop policy if exists "project members read" on public.project_members;
create policy "project members read" on public.project_members for select using (public.is_project_member(project_id));

drop policy if exists "documents member read" on public.documents;
create policy "documents member read" on public.documents for select using (public.is_project_member(project_id));

drop policy if exists "chunks member read" on public.document_chunks;
create policy "chunks member read" on public.document_chunks for select using (public.is_project_member(project_id));

drop policy if exists "chat sessions own" on public.chat_sessions;
create policy "chat sessions own" on public.chat_sessions for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists "chat messages own" on public.chat_messages;
create policy "chat messages own" on public.chat_messages for select using (
  exists (
    select 1 from public.chat_sessions cs where cs.id = session_id and (cs.user_id = auth.uid() or public.is_admin())
  )
);

drop policy if exists "quiz sets member read" on public.quiz_sets;
create policy "quiz sets member read" on public.quiz_sets for select using (public.is_project_member(project_id));

drop policy if exists "quiz questions member read" on public.quiz_questions;
create policy "quiz questions member read" on public.quiz_questions for select using (
  exists (
    select 1 from public.quiz_sets qs where qs.id = quiz_set_id and public.is_project_member(qs.project_id)
  )
);

drop policy if exists "quiz attempts own" on public.quiz_attempts;
create policy "quiz attempts own" on public.quiz_attempts for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists "activity own or admin" on public.activity_log;
create policy "activity own or admin" on public.activity_log for select using (user_id = auth.uid() or public.is_admin());

create policy "admin all users" on public.users for all using (public.is_admin()) with check (public.is_admin());
create policy "admin all projects" on public.projects for all using (public.is_admin()) with check (public.is_admin());
create policy "admin all project_members" on public.project_members for all using (public.is_admin()) with check (public.is_admin());
create policy "admin all documents" on public.documents for all using (public.is_admin()) with check (public.is_admin());
create policy "admin all document_chunks" on public.document_chunks for all using (public.is_admin()) with check (public.is_admin());
create policy "admin all chat_sessions" on public.chat_sessions for all using (public.is_admin()) with check (public.is_admin());
create policy "admin all chat_messages" on public.chat_messages for all using (public.is_admin()) with check (public.is_admin());
create policy "admin all quiz_sets" on public.quiz_sets for all using (public.is_admin()) with check (public.is_admin());
create policy "admin all quiz_questions" on public.quiz_questions for all using (public.is_admin()) with check (public.is_admin());
create policy "admin all quiz_attempts" on public.quiz_attempts for all using (public.is_admin()) with check (public.is_admin());
create policy "admin all activity_log" on public.activity_log for all using (public.is_admin()) with check (public.is_admin());