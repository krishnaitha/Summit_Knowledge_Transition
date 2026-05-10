-- Add free-form category column to quiz_sets.
-- Backfill from set_name keywords for existing rows.
alter table quiz_sets add column if not exists category text not null default 'general';

update quiz_sets set category = 'functional' where lower(set_name) like '%functional%';
update quiz_sets set category = 'technical'  where lower(set_name) like '%technical%';
