# NextElevate — Hackathon Pitch
## AI-Powered Knowledge Transfer Platform with Governance & MCP

---

## The Problem We're Solving

Every organisation faces a silent crisis during team transitions — offboarding, restructuring, project handoffs. Critical knowledge lives inside people's heads. When those people leave, the knowledge walks out with them.

Traditional KT (Knowledge Transfer) is broken:

- Documents sit in SharePoint folders nobody reads
- New team members spend weeks asking the same questions
- There is no way to verify whether knowledge was actually transferred
- Compliance teams have zero visibility into what the AI assistant said to employees

**NextElevate solves all of this.**

---

## What We Built

NextElevate is an **enterprise Knowledge Transfer platform** that combines document management, AI-powered chat, readiness assessment, and — most importantly — a **production-grade AI Governance & Safety layer** delivered through a **Model Context Protocol (MCP) architecture**.

It is not a chatbot. It is not a document repository. It is a complete KT lifecycle management system with responsible AI baked into every layer.

---

## The Core Experience

An admin uploads the KT documents for a project — architecture specs, runbooks, process guides, escalation paths. The system automatically parses every file, detects and redacts PII, classifies sensitivity, splits content into semantic chunks, and embeds them into a vector database.

A team member then opens the platform and asks: *"What is the escalation path when the payment gateway goes down at 2am?"*

The system embeds the question, searches hundreds of document chunks using cosine similarity, reranks the results by relevance, builds a grounded context window, and sends it to the LLM. The member gets a precise, cited answer — not a hallucination.

When the KT is complete, members take an AI-generated readiness quiz. The AI creates scenario-based questions directly from the uploaded documents — not generic trivia but real-world decision questions about the actual system. Admins see a readiness dashboard showing who passed, who failed, and what knowledge gaps remain.

---

## Why MCP Changes Everything

This is where NextElevate goes beyond a typical RAG chatbot.

We implemented the **Model Context Protocol (MCP)** — Anthropic's open standard for connecting AI systems to tools and data sources. Instead of hardcoding document processing and retrieval logic inside the application, we decomposed them into two standalone MCP servers.

### The Document Processor MCP Server

When a document is uploaded, the background worker does not process it directly. It calls our **Document Processor MCP Server** — a standalone Node.js process that exposes four tools over a stdio transport:

**parse_document** extracts clean text from PDF, DOCX, XLSX, CSV, and plain text files, returning structured metadata including page count and word count.

**redact_pii** scans the extracted text for personally identifiable information — email addresses, social security numbers, credit card numbers, phone numbers — and redacts them with confidence scores before the content is ever stored in the database.

**chunk_text** splits the document into overlapping semantic chunks, preferring sentence boundaries, with configurable chunk size and overlap. Each chunk includes a token estimate.

**scan_sensitivity** classifies the entire document as public, internal, confidential, or restricted based on keyword patterns — flagging documents that may need access controls before they are embedded and made searchable.

The beautiful part: if the MCP server fails for any reason, the system automatically falls back to the original direct processing pipeline. Users never see a failure. The MCP layer is an enhancement, not a dependency.

### The RAG Retrieval MCP Server

At chat time, the system does not call the database directly. It calls our **RAG Retrieval MCP Server**, which exposes four tools:

**embed_text** generates a 384-dimensional vector embedding using the same local transformer model (`Xenova/all-MiniLM-L6-v2`) that was used during document ingestion. Running locally means zero API cost, zero latency, and no dependency on external embedding services.

**search_chunks** performs cosine similarity search against the pgvector database, filtering by project and minimum similarity threshold. It returns the top K most semantically relevant document chunks.

**rerank_results** takes the retrieved chunks and applies keyword-based boosting on top of the similarity score. A chunk that both matches semantically and contains the exact keywords from the query ranks higher than one that only matches semantically.

**build_context** assembles the top chunks into a formatted context string with source citations, respecting a configurable token budget so we never overflow the LLM's context window.

Again: if the MCP server fails, the chat falls back instantly to the direct retrieval path. The user sees their answer. The admin sees a warning in the health dashboard.

### Why MCP Architecture Matters

MCP transforms document processing and RAG retrieval from embedded application logic into **reusable, auditable, swappable services**. Any other application in the organisation can call our Document Processor MCP server to get PII-redacted, sensitivity-classified, chunked content. Any application can call our RAG Retrieval MCP server to search the same knowledge base.

This is the architecture shift from "a chatbot that knows about our documents" to "an AI infrastructure platform that the entire organisation can build on."

---

## AI Governance — The Part Most Platforms Ignore

Building an AI assistant for enterprise use without governance is not a product. It is a liability.

We built a **six-pillar AI Governance & Safety system** that sits across the entire chat pipeline. Every pillar is non-blocking — governance never degrades the user experience — but every pillar is real, auditable, and admin-controllable.

### Pillar One: Content Filtering

Every message a user sends and every response the LLM produces passes through our content filter. Using local regex patterns — no external API, no latency — we detect PII in real time (emails, SSNs, credit cards, phone numbers), identify twelve known jailbreak and prompt injection patterns (role-play bypasses, DAN attacks, token counting exploits), and match against admin-configured keyword blocklists. Violations are classified by severity (low, medium, high) with confidence scores and logged asynchronously. The user's chat is never blocked — the violation is recorded for admin review.

### Pillar Two: Usage Quotas

Every user has a daily and monthly token budget and cost budget. When a user approaches or exceeds their quota, the system returns HTTP 429 — the only place in the entire governance stack where we deliberately block. This prevents any single user from consuming disproportionate LLM resources and gives admins hard cost controls. Quota usage resets automatically at midnight UTC for daily limits and on the first of each month for monthly limits.

### Pillar Three: Refusal Tracking

When the LLM decides it cannot or will not answer a question, we detect it. We monitor the `finish_reason` field in every LLM response and pattern-match the response text for safety disclaimers and refusal phrases — patterns that are specific to each provider (OpenAI, Anthropic, Groq, Mistral). Every detected refusal is categorised as unsafe content, policy violation, token limit exceeded, or unknown, and stored in the refusal log with the original query and timestamp. Admins can see exactly what users are asking that the AI refuses to answer — which is often more revealing than what it does answer.

### Pillar Four: Audit Logging

Every single LLM interaction is logged. User ID, project ID, session ID, model used, provider, input tokens, output tokens, estimated cost, latency, and status. The audit log writes asynchronously — it never adds latency to the user's experience. Admins can query by user, filter by status (success, refusal, quota exceeded, filtered), paginate through the full history, and export everything as CSV for compliance reporting. This is not optional telemetry. It is a complete interaction audit trail.

### Pillar Five: Model Behavior Constraints

Admins can configure governance policies that constrain how the LLM behaves — maximum tokens per response, temperature limits, top-p sampling controls, and custom system prompt injections. Policies can be global (applying to all projects and all models), project-specific, or model-specific. A five-minute in-memory cache reduces database load while keeping policy changes effective within seconds.

### Pillar Six: Admin Governance Controls

Everything above is surfaced in a dedicated Admin → AI Governance section with six views: an overview dashboard with 7-day KPI cards, a policy management page where admins can create and toggle policies with a live filter test tool, a quotas page with per-user usage bars and inline editing, a paginated audit log with CSV export, a refusal analytics page with a breakdown pie chart by reason, and a violation review workflow where admins can mark violations as reviewed, dismissed, or escalated.

---

## The Full System Architecture

NextElevate is built on Next.js 16 with the App Router, PostgreSQL with the pgvector extension, and a multi-provider LLM abstraction layer that supports Groq, OpenAI, Anthropic, Azure OpenAI, Mistral, Ollama, and GitHub Copilot. The active provider and model can be switched at runtime from the admin panel without a deployment.

Document embeddings are generated locally using `@xenova/transformers` with the `all-MiniLM-L6-v2` model. Local embeddings mean zero cost, zero external dependency, and deterministic results. We enforce embedding model consistency across each project — if you change the model, the system requires re-ingestion before retrieval will work, preventing silent similarity score degradation.

Long-running work — document processing, quiz generation, connector sync — runs through a Postgres-backed job queue. A separate worker process polls the queue every second and atomically claims jobs using `FOR UPDATE SKIP LOCKED`. No Redis, no RabbitMQ, no external message broker. Just PostgreSQL.

The platform connects to six external document sources — GitHub, OneDrive, Confluence, SharePoint, Jira, and Monday.com — synchronising content automatically on a configurable schedule. Each connector pulls documents, stores the canonical content, runs the full processing pipeline, and makes the content searchable in the AI chat.

---

## Who Uses It and How

A **Super Admin** sets up projects, configures connectors, manages users across the organisation, and monitors governance dashboards. They upload the KT documents, trigger AI quiz generation, and track which teams have completed their knowledge transfer.

A **Project Admin** manages their specific project — uploading documents, inviting team members, activating quiz sets, approving retake requests. They have full access to their project's analytics, document threads, and readiness metrics, but cannot see other projects.

A **Member** is the person receiving the knowledge transfer. They read documents, ask questions in the AI chat, and complete the readiness quiz. The quiz is not multiple-choice trivia — it is scenario-based: "The payment system receives a chargeback. What is the correct escalation path according to the runbook?" Members can bookmark AI answers, start discussion threads on document sections, and request quiz retakes from admins.

---

## What Makes This Hackathon-Worthy

Most teams in this hackathon will build a chatbot that calls an LLM API. Some will add a vector database. A few will add a nice UI.

We went further on three dimensions that matter for enterprise AI.

**First, MCP architecture.** We did not just use an LLM. We built a modular AI processing infrastructure using the Model Context Protocol. Document processing and retrieval are decoupled from the application, independently deployable, and reusable by any other system in the organisation. This is how production AI systems at scale should be built — not as monoliths.

**Second, real AI Governance.** The hackathon theme includes AI Governance as a topic because enterprises cannot adopt AI without controls. We did not add a compliance checkbox — we built six independently operable governance pillars that are non-blocking, fully auditable, and admin-controllable in real time. A CISO looking at this system would see exactly what they need: PII detection, usage quotas, refusal tracking, audit trails, and policy enforcement.

**Third, the full lifecycle.** We did not solve one problem. We solved the entire KT lifecycle: document ingestion, AI-powered Q&A, knowledge assessment, gap identification, connector sync, user management, and observability. A team that installs NextElevate on Monday can have their KT complete and assessed by Friday.

---

## The Technology Bet

We made three technology bets that we believe will define enterprise AI infrastructure over the next three years.

**MCP will become the standard interface for AI tools.** Just as REST became the standard for web APIs, MCP is positioned to become the standard for connecting AI systems to capabilities. By building our document processor and retrieval engine as MCP servers now, NextElevate is already compatible with any MCP client — including Claude, any future Anthropic tool, and any third party that adopts the protocol.

**Local embeddings will outcompete API embeddings for enterprise.** The cost, latency, and data sovereignty advantages of running embedding models locally are significant and growing. `all-MiniLM-L6-v2` at 384 dimensions delivers excellent retrieval quality at effectively zero cost. As models improve and hardware gets faster, local embedding will dominate enterprise RAG.

**Non-blocking governance is the only governance that ships.** Every governance framework that blocks the critical path gets disabled by engineers under deadline pressure. By making all governance operations async and fire-and-forget — except for the one hard block on quota exceeded — we built a system where governance is always on, always logging, and never in the way.

---

## One Sentence

NextElevate is the AI Knowledge Transfer platform that enterprises can actually trust — because it governs every LLM interaction with a six-pillar safety system, processes every document through an MCP-based pipeline that detects PII and classifies sensitivity, and generates AI quizzes that prove knowledge was actually transferred, not just uploaded.

---

*Built for the AI Governance & Guardrails Hackathon Track*
*Stack: Next.js 16 · PostgreSQL · pgvector · MCP · @xenova/transformers · Groq · Tailwind CSS*
