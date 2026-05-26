ALTER TABLE document_chunks
  ADD COLUMN IF NOT EXISTS embedding_model_id text,
  ADD COLUMN IF NOT EXISTS embedding_model_revision text;

UPDATE document_chunks
SET
  embedding_model_id = 'Xenova/all-MiniLM-L6-v2',
  embedding_model_revision = NULL
WHERE embedding IS NOT NULL
  AND (embedding_model_id IS NULL OR embedding_model_id = '');
