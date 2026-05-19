create table if not exists document_connectors (
  id               uuid primary key default gen_random_uuid(),
  project_id       uuid not null references projects(id) on delete cascade,
  provider         text not null check (provider in ('confluence', 'sharepoint')),
  name             text not null,
  config           jsonb not null default '{}'::jsonb,
  created_by       uuid references users(id) on delete set null,
  is_active        boolean not null default true,
  last_synced_at   timestamptz,
  last_sync_status text not null default 'idle' check (last_sync_status in ('idle', 'running', 'success', 'failed')),
  last_sync_error  text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists document_connectors_project_created_at
  on document_connectors (project_id, created_at desc);

alter table documents
  add column if not exists source_connector_id uuid references document_connectors(id) on delete set null,
  add column if not exists source_provider text check (source_provider in ('confluence', 'sharepoint')),
  add column if not exists source_item_id text,
  add column if not exists source_url text,
  add column if not exists source_synced_at timestamptz;

create unique index if not exists documents_source_connector_item_unique
  on documents (source_connector_id, source_item_id)
  where source_connector_id is not null and source_item_id is not null;

alter table processing_jobs
  drop constraint if exists processing_jobs_type_check;

alter table processing_jobs
  add constraint processing_jobs_type_check
  check (type in ('document_process', 'quiz_generate', 'connector_sync'));