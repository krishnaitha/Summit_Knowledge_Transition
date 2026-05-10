alter table public.documents
  add column if not exists pii_detections  integer  not null default 0,
  add column if not exists classification  text     not null default 'public',
  add column if not exists scan_flags      text[]   not null default '{}';

alter table public.documents
  drop constraint if exists documents_classification_check;

alter table public.documents
  add constraint documents_classification_check
  check (classification in ('public', 'internal', 'confidential'));
