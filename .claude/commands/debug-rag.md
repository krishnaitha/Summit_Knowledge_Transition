Diagnose RAG pipeline issues in this project.

## What to check

Work through the following areas in order and report findings for each:

### 1. Embedding model consistency

- Read `lib/rag/embeddings.ts` to find the active embedding model ID and revision.
- Check `lib/env.ts` for `EMBEDDING_MODEL_ID` and `EMBEDDING_MODEL_REVISION` defaults.
- Query the DB: look for `document_chunks` rows where `embedding_model_id` or `embedding_model_revision` differ from the current active model. If any exist, those chunks will cause `retrieveRelevantChunks()` to throw — they need re-ingestion.
- Check `lib/rag/retrieval.ts` to confirm the assertion logic.

### 2. Chunk coverage

- Check whether the affected project has any `document_chunks` rows at all.
- Check `processing_jobs` for documents stuck in `pending` or `failed` state.
- Look for recent `app_error_events` rows with `source` like `rag` or `document`.

### 3. Retrieval thresholds

- In `app/api/chat/route.ts`, note `NO_MATCH_THRESHOLD` (0.2) and `HALLUCINATION_THRESHOLD` (0.35).
- Check `rag_traces` for recent rows: look at `similarity_score`, `refusal`, and `possible_hallucination` columns to understand whether the retrieval is returning low-quality matches.

### 4. Worker health

- Check `processing_jobs` for any jobs that are `in_progress` but old (stuck worker).
- Remind the user that the worker is a separate process (`npm run worker`) and must be running for document processing.

### 5. Summary

After checking the above, provide a prioritized list of likely causes and the specific action to fix each one (e.g., "re-ingest documents for project X", "restart worker", "lower similarity threshold").

Project or symptoms to investigate: $ARGUMENTS
