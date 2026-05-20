-- Track which KB document was generated from a knowledge-gap thread capture.
alter table document_threads
  add column if not exists kb_document_id uuid references documents(id) on delete set null;
