-- Allow document_threads to represent knowledge-gap discussions (no document yet)
ALTER TABLE document_threads ALTER COLUMN document_id DROP NOT NULL;

-- 'document' = normal per-document thread; 'knowledge_gap' = raised from a gap in the knowledge base
ALTER TABLE document_threads
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'document'
    CHECK (source IN ('document', 'knowledge_gap'));

-- Original unanswered query that triggered this thread (set for knowledge_gap threads)
ALTER TABLE document_threads
  ADD COLUMN IF NOT EXISTS gap_query text;
