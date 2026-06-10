CREATE TABLE IF NOT EXISTS document_canonical_sources (
  document_id uuid PRIMARY KEY REFERENCES documents(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  canonical_content text NOT NULL,
  content_sha256 text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS document_canonical_sources_project_idx
  ON document_canonical_sources (project_id, updated_at DESC);

UPDATE document_chunks
SET
  embedding_model_id = COALESCE(NULLIF(embedding_model_id, ''), 'unknown-model'),
  embedding_model_revision = COALESCE(NULLIF(embedding_model_revision, ''), 'unversioned')
WHERE embedding_model_id IS NULL
   OR embedding_model_id = ''
   OR embedding_model_revision IS NULL
   OR embedding_model_revision = '';

ALTER TABLE document_chunks
  ALTER COLUMN embedding_model_id SET NOT NULL,
  ALTER COLUMN embedding_model_revision SET NOT NULL;

ALTER TABLE document_chunks
  DROP CONSTRAINT IF EXISTS document_chunks_embedding_model_id_nonempty;

ALTER TABLE document_chunks
  ADD CONSTRAINT document_chunks_embedding_model_id_nonempty
  CHECK (length(trim(embedding_model_id)) > 0);

ALTER TABLE document_chunks
  DROP CONSTRAINT IF EXISTS document_chunks_embedding_model_revision_nonempty;

ALTER TABLE document_chunks
  ADD CONSTRAINT document_chunks_embedding_model_revision_nonempty
  CHECK (length(trim(embedding_model_revision)) > 0);
