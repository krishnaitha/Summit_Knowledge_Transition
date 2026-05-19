alter table document_chunks
  add column if not exists search_vector tsvector;

create or replace function document_chunks_search_vector_update()
returns trigger as $$
begin
  new.search_vector := to_tsvector('english', coalesce(new.content, ''));
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_document_chunks_search_vector_update on document_chunks;

create trigger trg_document_chunks_search_vector_update
before insert or update of content on document_chunks
for each row execute function document_chunks_search_vector_update();

update document_chunks
set search_vector = to_tsvector('english', coalesce(content, ''))
where search_vector is null;

create index if not exists document_chunks_search_vector_idx
  on document_chunks using gin (search_vector);
