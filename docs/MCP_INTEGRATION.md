# MCP Integration Guide

NextElevate uses the **Model Context Protocol (MCP)** to modularize AI processing into standalone, reusable servers. Two MCP servers are implemented and integrated into the platform.

## Architecture Overview

```
┌────────────────────────────────────────────────────────────┐
│                   NextElevate Application                   │
│                                                            │
│  Document Upload → Worker Job → MCP Phase 1               │
│  Chat Message   → Chat API  → MCP Phase 2                 │
└────────────┬──────────────────────────┬───────────────────┘
             │ stdio (auto-spawned)      │ stdio (auto-spawned)
             ▼                          ▼
┌────────────────────┐    ┌────────────────────────────────┐
│ Document Processor │    │      RAG Retrieval Server      │
│   MCP Server       │    │         MCP Server             │
│                    │    │                                │
│ parse_document     │    │ embed_text                     │
│ redact_pii         │    │ search_chunks                  │
│ chunk_text         │    │ rerank_results                 │
│ scan_sensitivity   │    │ build_context                  │
└────────────────────┘    └────────────────────────────────┘
```

## MCP Servers

### Phase 1: Document Processor (`mcp-servers/document-processor/`)

Handles all document processing steps when a document is uploaded.

**Tools:**

| Tool | Description | Input | Output |
|------|-------------|-------|--------|
| `parse_document` | Extract text from files | `mimeType`, `fileBase64` | `text`, `pages`, `wordCount` |
| `redact_pii` | Detect and redact PII | `text`, `patternTypes?` | `redacted_text`, `violations` |
| `chunk_text` | Split text for RAG | `text`, `chunkSize?`, `overlapSize?` | `chunks`, `total_chunks` |
| `scan_sensitivity` | Classify document | `text` | `level`, `confidence`, `indicators` |

**Supported document formats:** PDF, DOCX, XLSX, CSV, TXT

**PII types detected:** Email, SSN, Credit Card, Phone Number

**Sensitivity levels:** `public` → `internal` → `confidential` → `restricted`

**Integration point:** `app/api/jobs/worker/route.ts` → `processDocumentJob()`

**Client:** `lib/mcp/document-processor-client.ts`

**Enable:** Set `MCP_DOCUMENT_PROCESSOR_ENABLED=true` in `.env.local`

---

### Phase 2: RAG Retrieval (`mcp-servers/rag-retrieval/`)

Handles semantic search and context building at chat time.

**Tools:**

| Tool | Description | Input | Output |
|------|-------------|-------|--------|
| `embed_text` | Generate 384-dim vector | `text` | `embedding[]`, `dimensions` |
| `search_chunks` | Cosine similarity search | `query`, `projectId`, `topK?` | `chunks[]`, `total_found` |
| `rerank_results` | Keyword-boosted reranking | `query`, `chunks[]` | `reranked_chunks[]` |
| `build_context` | Format LLM context | `chunks[]`, `maxTokens?` | `context`, `sources[]` |

**Embedding model:** Same as NextElevate — `Xenova/all-MiniLM-L6-v2` (384 dimensions)

**Database:** Uses pgvector cosine similarity on `document_chunks.embedding`

**Integration point:** `app/api/chat/route.ts` — replaces `retrieveRelevantChunks()`

**Client:** `lib/mcp/rag-retrieval-client.ts`

**Enable:** Set `MCP_RAG_RETRIEVAL_ENABLED=true` in `.env.local`

---

## How MCP Servers Are Started

Both servers use **stdio transport** and are **auto-spawned** by the client — no separate process is needed:

```typescript
// lib/mcp/document-processor-client.ts
const transport = new StdioClientTransport({
  command: 'node',
  args: ['mcp-servers/document-processor/dist/server.js'],
});
await client.connect(transport);
```

The client spawns the server as a child process and communicates via stdin/stdout. All logging from the server goes to stderr and appears in the Next.js dev server terminal.

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MCP_DOCUMENT_PROCESSOR_ENABLED` | `false` | Enable MCP document processing |
| `MCP_RAG_RETRIEVAL_ENABLED` | `false` | Enable MCP RAG retrieval |
| `EMBEDDING_MODEL_ID` | `Xenova/all-MiniLM-L6-v2` | Embedding model (passed to RAG server) |
| `DATABASE_URL` | — | Passed to RAG server for pgvector search |

---

## Build & Setup

### Document Processor

```bash
cd mcp-servers/document-processor
npm install
npm run build
```

### RAG Retrieval

```bash
cd mcp-servers/rag-retrieval
npm install
npm run build
```

Both servers are built independently. The `dist/` output is committed to git so the servers run without a build step in production.

---

## Document Processing Flow (Phase 1)

```
1. User uploads document
2. API creates document record + queues background job
3. Worker picks up job → processDocumentJob()
4. [MCP] scan_sensitivity  → classify document level
5. [MCP] redact_pii        → remove PII from text
6. [MCP] chunk_text        → split into overlapping chunks
7. Store chunks in document_chunks table
8. Update documents.classification, pii_detections, chunk_count
9. Fallback: if MCP fails, uses lib/documents/process.ts
```

## Chat RAG Flow (Phase 2)

```
1. User sends chat message
2. Chat API route receives message
3. [MCP] search_chunks     → embed query + cosine similarity search
4. [MCP] rerank_results    → keyword-boosted reranking
5. Top 5 chunks passed to LLM as context
6. LLM generates answer grounded in retrieved chunks
7. Fallback: if MCP fails, uses lib/rag/retrieval.ts
```

---

## Logs to Watch

### Document Processing (dev server terminal)

```
[worker] Processing document {id} with MCP server
[document-processor] ✅ MCP Server ready on stdio
[mcp-client] Connected to document-processor MCP server
[tools/call] Calling tool: scan_sensitivity
[tools/call] scan_sensitivity: confidential
[tools/call] Calling tool: redact_pii
[tools/call] redact_pii found 0 violations
[tools/call] Calling tool: chunk_text
[tools/call] chunk_text created 7 chunks
[worker] Document {id} processed with MCP: 7 chunks
```

### RAG Retrieval (dev server terminal)

```
[rag-retrieval] ✅ RAG Retrieval MCP Server ready on stdio
[rag-mcp-client] Connected to RAG Retrieval MCP server
[rag-retrieval] Calling tool: search_chunks
[rag-retrieval] Found 8 chunks for query: "..."
[rag-retrieval] Calling tool: rerank_results
[rag-retrieval] Reranked 8 chunks
[chat] RAG via MCP: 5 chunks retrieved
```

---

## Fallback Behavior

Both MCP integrations have automatic fallbacks:

- **Document Processor:** Falls back to `lib/documents/process.ts` if MCP throws
- **RAG Retrieval:** Falls back to `lib/rag/retrieval.ts` if MCP throws

This means **chat and document upload always work** even if MCP servers fail to start.

---

## Extending MCP

To add a new tool to an existing server:

1. Add the tool definition to the `TOOLS` array in `src/server.ts`
2. Add the handler in `server.setRequestHandler(CallToolRequestSchema, ...)`
3. Add a corresponding function in `lib/mcp/*-client.ts`
4. Run `npm run build` in the server directory

To add a new MCP server:

1. Create `mcp-servers/<name>/` with the same structure
2. Create `lib/mcp/<name>-client.ts` using `StdioClientTransport`
3. Add env var `MCP_<NAME>_ENABLED` to control activation
4. Integrate at the appropriate point in the pipeline

---

## Phase 3 (Planned): Governance MCP Server

Expose the AI governance system as a standalone MCP server:

- `filter_content` — PII + jailbreak detection
- `check_quota` — Per-user token/cost quota enforcement
- `log_audit` — Async audit logging
- `detect_refusal` — LLM refusal categorization

This will allow any external application to plug into NextElevate's governance engine via MCP.
