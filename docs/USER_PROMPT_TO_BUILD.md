# What I Want to Build — NextElevate

I want to build an internal knowledge transfer platform for enterprise teams. The core problem I'm solving is this: when someone leaves a team or a project gets handed off, all the critical knowledge — how things work, what the escalation paths are, where the edge cases are — lives in people's heads and gets lost. I want a system where that knowledge gets captured in documents, made searchable through AI, and verified through assessments so we can actually prove that knowledge was transferred.

---

## Users and Roles

There are three kinds of users in my system.

The first is a super admin — this is the platform administrator who can see and manage everything. They create projects, manage users across the whole organisation, upload documents, generate quizzes, and have access to all the governance and analytics dashboards. Think of them as the IT admin or the KT programme manager.

The second is a project admin — this person only manages their own project. They can upload documents to their project, invite team members, set up and activate quizzes, and see how their members are progressing. They can't see other projects or other teams' data.

The third is a regular member — this is the person receiving the knowledge transfer. They can read documents, ask questions to an AI assistant that knows the content of those documents, and take a readiness quiz to prove they've absorbed the knowledge. They can bookmark useful AI answers and request a quiz retake from their admin if they failed.

---

## Projects and Documents

The core unit of the system is a project. Each project represents a knowledge transfer — a team handoff, a system being transferred, a process being documented. A project has a name, a description, a pass threshold for the quiz, and optional quiz open/close windows.

Inside each project there are documents. Admins upload documents in any format — PDF, Word documents, Excel spreadsheets, CSV files, plain text files, and PowerPoint. When a document is uploaded, the system should automatically process it in the background. Processing means extracting all the text from the file, detecting and redacting any personally identifiable information like email addresses or phone numbers or social security numbers before storing it, splitting the text into overlapping chunks that are sized appropriately for AI retrieval, generating vector embeddings for each chunk using a local AI model, and storing everything in a database that supports vector search.

I also want the system to classify each document's sensitivity level — whether it's public, internal, confidential, or restricted — based on the content.

The document list should show each file's name, type, number of chunks created, and upload date. Admins should be able to mark certain documents as required reading.

---

## AI Chat

This is the core member-facing feature. Each project has a chat interface where members can ask questions in plain English about anything in the KT documents. The AI should not make things up — it should only answer based on what's in the documents. If the answer isn't in the documents, it should say so clearly rather than guessing.

When a member asks a question, the system should embed the question, search the document chunks for the most semantically relevant passages, rank the results, build a context window from the best matches, and send that context along with the question to a large language model. The response should be streamed back to the member in real time.

Each AI answer should show which documents and sections it pulled from, so the member can click through to read the original source. Members should be able to bookmark answers they want to come back to later.

The chat should remember the conversation history within a session. It should also support a user memory feature — if a member says "remember that I prefer step-by-step explanations," the system should store that preference and apply it to future responses in that project.

I want the response style to be configurable — members should be able to switch between a default style, a concise style, a step-by-step style, and a bullet list style depending on what works best for them.

---

## AI Quiz System

After reading the documents and using the chat, members should prove their readiness by taking a quiz. The quiz questions should be generated automatically by AI from the actual document content — not generic questions, but scenario-based questions that test whether someone can apply the knowledge in real situations.

I want two quiz categories: functional and technical. Functional questions should test business process knowledge — things like "A stakeholder requests an exception to the approval process. What is the correct escalation path?" Technical questions should test system knowledge — things like "The service returns a 503. What is the most likely root cause based on the architecture documentation?"

Questions should be a mix of multiple choice (four options) and true/false. The harder questions should be worth more marks. At least 40 percent of questions should be at the analysis level, not just recall.

Members get one attempt per project. If they fail, they can request a retake which an admin approves or rejects. Admins can also manually reset attempts. After submitting, members should see their score, which questions they got wrong, explanations for the correct answers, and an AI-generated coaching plan that identifies their weak areas and recommends what to study.

---

## External Document Connectors

I don't want admins to manually upload everything. The system should connect to external sources and pull documents automatically. I want connectors for GitHub repositories, Microsoft OneDrive, Atlassian Confluence, Microsoft SharePoint, Jira, and Monday.com.

Each connector should be configurable with the right credentials and settings, and should sync automatically on a schedule — pulling new documents, updating changed ones, and flagging removed ones. The sync status should be visible to admins. All documents coming from connectors go through the same processing pipeline as manually uploaded files.

---

## MCP-Based Processing Architecture

This is something I want to build properly from an architecture standpoint. Instead of hardcoding the document processing and retrieval logic directly into the application, I want to implement it using the Model Context Protocol — MCP — which is an open standard for connecting AI systems to tools and data.

Specifically I want two MCP servers.

The first is a Document Processor MCP server. When a document gets processed, the application should call this standalone server rather than doing the work inline. The server should expose tools for parsing documents to extract text, redacting PII from that text, chunking the text into overlapping segments, and scanning for sensitivity classification. The server should run as a separate Node.js process that communicates with the main application over stdio. If the MCP server is unavailable, the application should fall back to doing the processing directly without failing the user.

The second is a RAG Retrieval MCP server. When a member sends a chat message, instead of hitting the database directly, the application should call this server to handle the retrieval. The server should expose tools for embedding text into vectors using the local model, searching the vector database for the most similar chunks, reranking the results by combining semantic similarity with keyword matching, and building a formatted context string from the top results with source citations. Same fallback principle — if the server is down, retrieval should continue using the direct path.

I want these MCP servers to be separate from the main application so they can be reused by other systems. The whole point is that any other application in the organisation could call our document processor to get PII-redacted content, or call our retrieval server to search our knowledge base.

---

## AI Governance and Safety

This is the part I care most about getting right. I want a full governance layer across every LLM interaction, and I want it to be non-blocking — safety checks should never slow down or interrupt the user experience except in one very specific case.

I want six pillars of governance.

The first is content filtering. Every message a user sends and every response the AI produces should be scanned for PII, jailbreak attempts, and blocked keywords. The system should detect emails, phone numbers, credit card numbers, and social security numbers in real time using local pattern matching — no external API call. It should recognise common jailbreak patterns like role-play bypass attempts and DAN prompts. Admins should be able to add custom blocked keywords per project. Violations should be logged with severity levels and confidence scores. This check should never block the user — it just logs and lets admins review.

The second is usage quotas. Every user should have a daily token limit and a monthly token limit, plus a daily cost limit and monthly cost limit. These should be configurable per user per project by admins. When a user exceeds their quota, the system should return a 429 error — this is the only governance check that actually blocks the user. The quota usage should reset automatically on schedule. Admins should be able to see per-user quota usage with progress bars and reset quotas manually.

The third is refusal tracking. When the AI refuses to answer something — because of a safety policy or content restrictions — I want to know about it. The system should detect refusals by checking the finish reason from the LLM and pattern matching the response text. Every refusal should be categorised by reason and logged with the original query. Admins should see a breakdown of refusals over time so they can identify whether users are hitting policy limits or whether the AI is being overly restrictive.

The fourth is audit logging. Every single LLM interaction — every chat message, every quiz generation — should be logged to a permanent audit table. The log should capture who sent the message, which project it was in, which model and provider was used, how many tokens were consumed, what it cost, how long it took, and whether it succeeded or was refused or filtered. This log should be queryable by admins, filterable by status and user, paginated, and exportable as CSV.

The fifth is model behaviour constraints. Admins should be able to create governance policies that control how the LLM behaves — setting maximum response length, controlling temperature, constraining the sampling parameters, and injecting additional safety instructions into the system prompt. These policies can be set globally for the whole platform, per project, or per model. Changes should take effect within a few seconds, not requiring a deployment.

The sixth is a governance admin interface. I want a dedicated section in the admin panel — call it AI Governance — with six views: an overview dashboard showing key metrics for the last seven days, a policy management page where admins can create and toggle policies and test content filters live, a quotas page with per-user usage and editing, a paginated audit log with export, a refusals analytics view with a breakdown chart, and a violations review page where admins can mark violations as reviewed, dismissed, or escalated.

---

## LLM Provider Flexibility

I don't want to be locked into one LLM provider. The system should support Groq, OpenAI, Anthropic, Azure OpenAI, Mistral, Ollama for local models, and GitHub Copilot. The active provider and model should be switchable from the admin panel at runtime without any code changes or deployment. The system should read the configured provider from the database first and fall back to environment variables if nothing is configured.

I want two separate LLM configurations — one for chat and one for quiz generation — because quiz generation is a batch process that can use a different model or API key with different rate limits.

---

## Embeddings

For document and query embeddings I want to use a local model rather than an external embedding API. Specifically I want to use the all-MiniLM-L6-v2 model from HuggingFace via the @xenova/transformers library, which generates 384-dimensional vectors and runs entirely in the Node.js process. No embedding API calls, no cost per embedding, no data leaving the server.

One important constraint: once a project's documents have been embedded with a particular model and version, all future queries must use the same model. If the embedding model is changed, the existing chunks for that project need to be re-embedded. The system should enforce this and surface a clear error rather than silently returning bad results.

---

## Background Processing

Document processing, quiz generation, and connector sync all take too long to run during an HTTP request. I want a background job queue backed by PostgreSQL — no Redis, no external message broker, just the same database. A separate worker process should poll the queue every second, atomically claim one job at a time using database locking so multiple workers can't double-process, execute the job, and mark it as done or failed. The frontend should poll the job status every few seconds and update the UI when processing completes.

Jobs that get stuck running for more than ten minutes should automatically be reset to pending and retried.

---

## Threads and Discussion

I want document discussion threads — a way for members to ask questions directly on a specific document or section, and for the AI to respond in the thread. Admins should be able to see all open threads across projects, triage them, and mark them as resolved. The AI's reply to a thread should be generated as a background job so it doesn't block the user.

---

## Analytics and Observability

For each project I want an analytics dashboard showing retrieval hit rates over time, average similarity scores, refusal rates, hallucination flags, and slow request counts. For the system overall I want a health page showing recent application errors, error counts by category, and system-wide metrics.

Every chat interaction should produce a trace record capturing retrieval latency, generation latency, total latency, the number of chunks retrieved, similarity scores, whether the answer was cached, whether the AI refused, and whether a possible hallucination was detected. These traces power the analytics dashboards.

---

## Tech Stack Preferences

For the framework I want Next.js with the App Router and React Server Components. TypeScript throughout with strict mode — no use of the `any` type anywhere. Tailwind CSS for styling. PostgreSQL for everything — main data, job queue, vector search via the pgvector extension. The postgres.js library for database queries, no ORM. NextAuth.js for authentication with support for credentials login, AWS Cognito, and OIDC providers like Keycloak.

For file storage I want Cloudflare R2 in production with a local filesystem fallback for development. For email I want SendGrid for transactional email — invites and password resets.

The code quality bar should be high — ESLint with the rule that any use of the `any` type is a build error. Prettier for formatting. Pre-commit hooks to enforce both before anything gets committed.

---

## Design and UX

The UI should feel clean and professional — a dark navy sidebar on admin pages, light content area, clear typography. The admin experience should be information-dense but not cluttered. The member experience should be calm and focused — reading documents and chatting with AI should feel like a focused learning environment, not a busy dashboard.

The chat interface should render AI responses in full markdown — tables, code blocks, bullet lists, numbered steps — because a lot of the answers will reference technical documentation. Responses should stream in real time so members see the answer building rather than waiting for a complete response.

The document upload experience should support drag-and-drop with a queue that shows each file's progress — uploading, processing, embedded, ready. Members should never need to manually refresh to see when processing is complete.

On mobile the admin sidebar should collapse into a hamburger menu. The member experience should be fully usable on a phone.

---

## What Success Looks Like

An admin sets up a project on Monday morning. They upload twenty documents — runbooks, architecture diagrams, process guides, escalation trees. By Monday afternoon, members can ask any question about those documents and get a grounded, cited answer in under five seconds. By Friday, all members have completed the readiness quiz. The admin looks at the dashboard and knows exactly who passed, who failed, what questions people got wrong, and what gaps remain. The governance dashboard shows every interaction that happened, every refusal, every quota warning. The CISO can export the full audit log for compliance review.

That is what I want to build.
