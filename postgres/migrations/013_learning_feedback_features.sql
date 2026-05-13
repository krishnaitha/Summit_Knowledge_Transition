alter table public.documents
  add column if not exists is_required boolean not null default false;

create table if not exists public.quiz_coaching_plans (
  id               uuid        primary key default gen_random_uuid(),
  attempt_id       uuid        not null unique references public.quiz_attempts(id) on delete cascade,
  user_id          uuid        not null references public.users(id) on delete cascade,
  project_id       uuid        not null references public.projects(id) on delete cascade,
  weak_sections    jsonb       not null default '[]',
  recommendations  jsonb       not null default '[]',
  created_at       timestamptz not null default now()
);

create table if not exists public.chat_answer_feedback (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references public.users(id) on delete cascade,
  project_id  uuid        not null references public.projects(id) on delete cascade,
  message_id  uuid        not null references public.chat_messages(id) on delete cascade,
  rating      text        not null check (rating in ('up', 'down')),
  reason_tag  text,
  comment     text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique(user_id, message_id)
);

create index if not exists documents_required_idx
  on public.documents (project_id, is_required);

create index if not exists coaching_project_user_idx
  on public.quiz_coaching_plans (project_id, user_id, created_at desc);

create index if not exists chat_feedback_project_rating_idx
  on public.chat_answer_feedback (project_id, rating, created_at desc);

alter table public.quiz_coaching_plans enable row level security;
alter table public.chat_answer_feedback enable row level security;

drop policy if exists "coaching member read" on public.quiz_coaching_plans;
create policy "coaching member read"
  on public.quiz_coaching_plans
  for select
  using (public.is_admin() or user_id = auth.uid());

drop policy if exists "coaching service write" on public.quiz_coaching_plans;
create policy "coaching service write"
  on public.quiz_coaching_plans
  for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "feedback member read" on public.chat_answer_feedback;
create policy "feedback member read"
  on public.chat_answer_feedback
  for select
  using (public.is_admin() or user_id = auth.uid());

drop policy if exists "feedback member write" on public.chat_answer_feedback;
create policy "feedback member write"
  on public.chat_answer_feedback
  for all
  using (public.is_admin() or user_id = auth.uid())
  with check (public.is_admin() or user_id = auth.uid());
