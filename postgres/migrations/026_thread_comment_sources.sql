-- Store source document names for bot-generated thread replies
ALTER TABLE document_thread_comments
  ADD COLUMN IF NOT EXISTS sources jsonb NOT NULL DEFAULT '[]';
