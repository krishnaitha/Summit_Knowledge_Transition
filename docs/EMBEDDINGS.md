# Embeddings Architecture and Operations

This document is the source of truth for the embeddings layer used by RAG chat, connector ingestion, and document processing.

## 1. Overview

The system uses a two-stage safety pattern:

1. Stage 1 stores canonical processed text per document.
2. Stage 2 generates chunks and vectors from canonical text only.

This prevents drift between source text and vectors, and supports deterministic re-index after embedding model changes.

## 2. Current Model Configuration

- Embedding library: `@xenova/transformers`
- Embedding model: `Xenova/all-MiniLM-L6-v2`
- Embedding dimensions: `384`
- Required runtime pins:
  - `EMBEDDING_MODEL_ID`
  - `EMBEDDING_MODEL_REVISION`

Both values must be non-empty. Missing revision fails fast.

## 3. Two-Stage Ingestion Flow

### Stage 1: Canonical source persistence

During document processing:

- File content is parsed and cleaned.
- PII redaction and classification happen before storage.
- Canonical content is stored in `document_canonical_sources`.
- Canonical content hash (`sha256`) is stored for traceability.

### Stage 2: Embedding index generation

From canonical content only:

- Text is chunked.
- Embeddings are generated per chunk.
- Existing chunks for the document are replaced.
- New rows are inserted into `document_chunks` with model metadata:
  - `embedding_model_id`
  - `embedding_model_revision`

## 4. Query-Time Consistency Enforcement

Before vector retrieval, the system checks that stored chunk metadata matches the active embedding model+revision for the project.

If mismatch is detected:

1. Existing project vectors are purged.
2. Re-index jobs are queued from canonical sources (`sourceMode = canonical`).
3. Retrieval throws a clear error indicating re-index was queued.

This avoids serving stale or semantically incompatible vectors.

## 5. Worker Reindex Behavior

`document_process` jobs support `sourceMode`:

- `sourceMode = canonical`: read canonical content from `document_canonical_sources`.
- Fallback: if canonical is missing, parse from file storage.

This ensures automated recovery after mismatch and supports manual reprocessing.

## 6. Database Model

### `document_canonical_sources`

- `document_id` (PK, FK -> `documents.id`)
- `project_id` (FK -> `projects.id`)
- `canonical_content` (text)
- `content_sha256` (text)
- `created_at`, `updated_at`

Index:

- `document_canonical_sources_project_idx (project_id, updated_at desc)`

### `document_chunks` (embedding-related fields)

- `embedding vector(384)`
- `embedding_model_id text not null`
- `embedding_model_revision text not null`

Constraints:

- non-empty `embedding_model_id`
- non-empty `embedding_model_revision`

## 7. Migrations

Primary migration for the two-stage safety rollout:

- `postgres/migrations/037_embedding_two_stage_safety.sql`

What it does:

1. Creates `document_canonical_sources`.
2. Backfills missing chunk model metadata.
3. Enforces NOT NULL and non-empty checks on model fields.

## 8. Operational Runbook

### Change embedding model or revision

1. Update `EMBEDDING_MODEL_ID` and `EMBEDDING_MODEL_REVISION`.
2. Restart app and worker.
3. On first mismatched query, auto purge + reindex queue will trigger.
4. Monitor `processing_jobs` until queued `document_process` jobs complete.

### Verify runtime pins

- Confirm env values loaded by both app and worker.
- Ensure revision points to a valid model artifact revision.

### Troubleshooting common errors

- `EMBEDDING_MODEL_REVISION must be pinned...`
  - Set non-empty `EMBEDDING_MODEL_REVISION` in runtime env.

- `Could not locate file ... /resolve/<revision>/tokenizer.json`
  - Revision is invalid for the selected model; use a real model commit SHA.

- Retrieval mismatch error mentioning expected vs found model
  - This is expected guard behavior. Wait for reindex jobs to finish, then retry.

## 9. Implementation References

- Canonical + embedding generation: `lib/documents/process.ts`
- Embedding model pin enforcement: `lib/rag/embeddings.ts`
- Retrieval consistency + auto-reindex queue: `lib/rag/retrieval.ts`
- Worker canonical-source processing: `app/api/jobs/worker/route.ts`
- Schema baseline: `postgres/schema.sql`
- Migration: `postgres/migrations/037_embedding_two_stage_safety.sql`
