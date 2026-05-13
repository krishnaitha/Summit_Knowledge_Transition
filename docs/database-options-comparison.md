t# Database & Backend Platform Options — Comparison

> Created: May 2026 | Context: Summit KT Portal (Next.js 14 + Supabase)

---

## App Requirements

The Summit KT Portal needs all four of these from its data layer:

| # | Requirement | Why |
|---|---|---|
| 1 | **Relational SQL** | Projects → members → attempts → questions (all relational) |
| 2 | **Vector search** | RAG/chat — 384-dim embeddings stored per document chunk |
| 3 | **Auth** | Invite users, session cookies, JWT, role-based access |
| 4 | **File storage** | Document uploads (PDF, DOCX, TXT) |

---

## Full-Platform Alternatives (Supabase-like)

### Supabase ✅ (Current)
- **Database**: Postgres (full SQL, JSONB, pgvector, RLS, triggers)
- **Auth**: Built-in — email/password, magic link, OAuth, invite by email, JWT
- **Storage**: S3-backed buckets with signed URLs
- **Vector search**: pgvector extension (built-in, free)
- **Realtime**: WebSocket subscriptions
- **Open source**: Yes — self-hostable via Docker
- **Free tier**: 500MB DB, 1GB storage, 50K auth users, 2 projects
- **Paid**: $25/mo (Pro)
- **Strengths**: All-in-one, RLS at DB level, pgvector, great DX
- **Weaknesses**: No DB branching, projects pause on free after 1 week inactivity

---

### Firebase (Google)
- **Database**: Firestore (NoSQL document DB) + optional Realtime DB
- **Auth**: Excellent — 10+ providers, battle-tested
- **Storage**: Firebase Storage (Google Cloud Storage backed)
- **Vector search**: ❌ No native support — needs separate service
- **Realtime**: Best-in-class
- **Open source**: ❌ Proprietary
- **Free tier**: Generous (Spark plan)
- **Paid**: Pay-as-you-go (can get expensive at scale)
- **Strengths**: Mature, massive ecosystem, excellent auth
- **Weaknesses**: NoSQL only (bad for relational data), no pgvector, high vendor lock-in
- **Verdict for this app**: ❌ NoSQL kills it — all data is relational; no vector search

---

### Appwrite
- **Database**: Custom document DB (no raw SQL)
- **Auth**: Excellent — email, OAuth, magic link, teams, API keys
- **Storage**: Built-in buckets
- **Vector search**: ❌ Not supported
- **Realtime**: Yes
- **Open source**: ✅ — self-hostable (Docker, 1 command)
- **Free tier**: Generous (cloud)
- **Paid**: $15/mo
- **Strengths**: Closest open-source Supabase alternative, great auth, lower price
- **Weaknesses**: No raw SQL, no pgvector — RAG feature would need rework
- **Verdict for this app**: ⚠️ Partial fit — auth/storage OK, but no SQL or vector search

---

### PocketBase
- **Database**: SQLite (not Postgres)
- **Auth**: Built-in (email, OAuth)
- **Storage**: Built-in file storage
- **Vector search**: ❌ Not supported
- **Realtime**: Yes
- **Open source**: ✅ — single binary, self-hosted only
- **Free tier**: N/A (you pay for VPS ~$5–10/mo)
- **Paid**: Free (open source)
- **Strengths**: Zero vendor cost, single binary deployment, simple admin UI
- **Weaknesses**: SQLite single-node (bad concurrency at scale), no pgvector
- **Verdict for this app**: ❌ SQLite limits + no vector search

---

### Xata
- **Database**: Serverless Postgres
- **Auth**: ❌ None — bring your own
- **Storage**: ❌ None — bring your own
- **Vector search**: ✅ Built-in (similar to pgvector)
- **Full-text search**: Excellent (Elasticsearch-backed)
- **DB Branching**: ✅ Yes
- **Open source**: ❌ Partially
- **Free tier**: Yes
- **Paid**: $20/mo
- **Strengths**: Great search, DB branching, serverless
- **Weaknesses**: No auth, no storage — same gap as Neon
- **Verdict for this app**: ❌ Missing auth and storage

---

## Database-Only Options

### Neon (Serverless Postgres)
- **Database**: Postgres (serverless, autosuspend, scale-to-zero)
- **Auth**: ❌ None
- **Storage**: ❌ None
- **Vector search**: ✅ pgvector (same as Supabase)
- **DB Branching**: ✅ Git-like branches — create/merge/discard
- **Autosuspend**: ✅ Pauses after inactivity, wakes in ~500ms
- **Connection**: HTTP-based driver — ideal for serverless/Vercel
- **Open source**: Partial (storage engine closed)
- **Free tier**: 0.5GB, 1 project, autosuspend
- **Paid**: $19/mo (Launch)
- **IP allowlisting**: ✅ All plans (Supabase requires Pro)
- **Strengths**: Best Postgres for serverless, DB branching, no connection pool exhaustion
- **Weaknesses**: Postgres only — no auth, no storage, no realtime
- **Verdict for this app**: ❌ Needs Clerk (auth) + Cloudflare R2 (storage) added separately

---

### MySQL / MariaDB
- **Database**: Relational SQL (MySQL dialect)
- **Auth**: ❌ None
- **Storage**: ❌ None
- **Vector search**: ❌ MySQL 9.0+ preview only — not production-ready
- **JSONB**: ❌ Basic JSON support only — no indexing/querying like Postgres jsonb
- **Extensions**: Very limited
- **Managed hosting**: PlanetScale (discontinued free tier), Railway, AWS RDS, self-host
- **Strengths**: Widely known, lots of hosting options, battle-tested
- **Weaknesses**: No vector search, weak JSON, no auth/storage
- **Verdict for this app**: ❌ Breaks on vector search (RAG) and JSONB queries

---

### MongoDB (Atlas)
- **Database**: Document DB (NoSQL — BSON/JSON)
- **Auth**: ❌ None (Atlas App Services extra cost)
- **Storage**: GridFS (not production-grade for files)
- **Vector search**: ✅ Atlas Vector Search — cloud only, paid
- **Schema**: Flexible/schemaless
- **Joins**: `$lookup` — slow and limited vs SQL JOINs
- **Free tier**: Atlas 512MB (M0 cluster)
- **Paid**: Pay-as-you-go (gets expensive)
- **Strengths**: Flexible schema, good for unstructured data, large ecosystem
- **Weaknesses**: NoSQL (wrong model for relational data), vector search requires paid Atlas, no auth/storage
- **Verdict for this app**: ❌ Wrong data model entirely

---

### SQLite
- **Database**: File-based SQL
- **Auth**: ❌ None
- **Storage**: ❌ None
- **Vector search**: ✅ `sqlite-vec` (new, limited)
- **Concurrency**: Single writer — bad for multi-user web apps
- **Scale**: Single file, single server
- **Strengths**: Zero cost, zero setup, embedded
- **Weaknesses**: Not suitable for concurrent multi-user web apps
- **Verdict for this app**: ❌ Not suitable

---

### DynamoDB (AWS)
- **Database**: Key-value / document (NoSQL)
- **Auth**: ❌ AWS Cognito (separate, complex)
- **Storage**: ❌ S3 (separate)
- **Vector search**: ❌ Need OpenSearch separately
- **Joins**: ❌ Not supported
- **Pricing**: Pay per read/write unit — unpredictable
- **Strengths**: Infinite scale, AWS native, single-digit ms latency
- **Weaknesses**: NoSQL, complex pricing, no joins, steep learning curve
- **Verdict for this app**: ❌ Wrong model, overkill, expensive

---

### PostgreSQL (Self-hosted)
- **Database**: Full Postgres — everything Supabase uses
- **Auth**: ❌ None — add NextAuth/Clerk separately
- **Storage**: ❌ None — add S3/Cloudflare R2 separately
- **Vector search**: ✅ pgvector (manual install)
- **Connection pooling**: Manual (PgBouncer setup)
- **Backups**: Manual setup
- **Cost**: VPS ~$5–20/mo
- **Strengths**: Full control, no vendor lock-in, identical to Supabase's DB
- **Weaknesses**: You manage everything — updates, backups, SSL, pooling
- **Verdict for this app**: ✅ Technical match, but trades managed convenience for control

---

## Head-to-Head Summary

| | Supabase | Firebase | Appwrite | PocketBase | Xata | Neon | MySQL | MongoDB | Self-hosted PG |
|---|---|---|---|---|---|---|---|---|---|
| **SQL / Relational** | ✅ | ❌ | ❌ | ✅ SQLite | ✅ | ✅ | ✅ | ❌ | ✅ |
| **JSONB queries** | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ⚠️ | ✅ | ✅ |
| **Vector search** | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | 💰 Paid | ✅ manual |
| **Auth built-in** | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Storage built-in** | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Open source** | ✅ | ❌ | ✅ | ✅ | ❌ | Partial | ✅ | ✅ | ✅ |
| **Self-hostable** | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ | ✅ |
| **DB branching** | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Free tier** | ✅ | ✅ | ✅ | N/A | ✅ | ✅ | ⚠️ | ✅ | ❌ |
| **Good for this app** | ✅ | ❌ | ⚠️ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

---

## Security Comparison

| Aspect | Supabase | Neon | Firebase | MySQL | MongoDB |
|---|---|---|---|---|---|
| **Row-level security** | ✅ Built-in GUI + SQL | SQL only | Document rules | ❌ | Document-level |
| **JWT auth integration** | ✅ `auth.uid()` in RLS | Manual | ✅ Built-in | ❌ | ❌ |
| **Encryption at rest** | AES-256 | AES-256 | AES-256 | Depends on host | AES-256 |
| **SSL/TLS** | Enforced | Enforced | Enforced | Depends | Enforced |
| **IP allowlisting** | Pro plan only | All plans ✅ | ❌ | Depends on host | Atlas Pro |
| **SOC 2** | Type 2 ✅ | Type 2 ✅ | Yes | Depends | Atlas ✅ |
| **GDPR** | ✅ | ✅ | ✅ | Depends | ✅ |
| **Audit logs** | Auth events only | Query history (paid) | Limited | Manual | Atlas only |

---

## If You Had to Migrate Away from Supabase

The only realistic migration path that preserves all features:

```
Neon           → replaces Postgres DB (near-zero code changes)
Clerk          → replaces Supabase Auth (~1–2 days)
Cloudflare R2  → replaces Supabase Storage (~1 day)
```

Total effort: ~3–4 days. Cost: similar or slightly higher (~$30–40/mo vs $25/mo).

---

## Recommendation

**Stay on Supabase** for this app. The combination of Postgres + pgvector + Auth + Storage in one platform is unique. Every alternative either drops SQL, vector search, auth, or storage — all four of which the Summit KT Portal actively uses.

The only scenario to reconsider: if the team needs **DB branching** for safe migrations (→ move to Neon + Clerk + R2), or needs to self-host everything for compliance (→ self-hosted Postgres + NextAuth + MinIO).
