-- Add bot_thread_reply job type to processing_jobs
ALTER TABLE processing_jobs
  DROP CONSTRAINT IF EXISTS processing_jobs_type_check;

ALTER TABLE processing_jobs
  ADD CONSTRAINT processing_jobs_type_check
  CHECK (type IN ('document_process', 'quiz_generate', 'connector_sync', 'bot_thread_reply'));

-- Add is_bot flag to document_thread_comments so bot replies are
-- distinguishable even when the deleted-user fallback sets author_id to NULL
ALTER TABLE document_thread_comments
  ADD COLUMN IF NOT EXISTS is_bot boolean NOT NULL DEFAULT false;
