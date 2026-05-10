# Background Worker Setup

Summit KT Portal uses a background job queue for two long-running operations:

- **Document processing** — text extraction, chunking, and embedding (can take 30–120 s for large files)
- **Quiz generation** — multiple Groq API calls with inter-set delays (can take 30–90 s for 3–5 sets)

These run in a separate worker process so HTTP routes return instantly and never hit serverless timeouts.

---

## How It Works

```
Admin clicks "Process" or "Generate"
        │
        ▼
API route inserts a row into processing_jobs (status = 'pending')
Returns { jobId } to the client in < 100 ms
        │
        ▼
Standalone worker (worker/index.mjs)
polls POST /api/jobs/worker every 1 second
        │
        ▼
/api/jobs/worker claims one pending job atomically
(SELECT … FOR UPDATE SKIP LOCKED)
Executes the job, marks it done or failed
        │
        ▼
Frontend polls GET /api/jobs/[id] every 3 seconds
until status = 'done' | 'failed'
```

**Safety net:** `pg_cron` runs every minute inside Supabase and resets any job that has been stuck in `running` for more than 10 minutes back to `pending`, so it gets retried automatically.

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `WORKER_SECRET` | Yes (in prod) | Shared secret between the app and worker. Set it on both. |
| `INTERNAL_APP_URL` | Yes | Base URL the worker uses to reach the app (`http://localhost:3000` locally). |
| `WORKER_POLL_MS` | No | Poll interval in milliseconds. Default: `1000`. Minimum: `1000`. |

---

## Development

You need **two terminals** running side-by-side:

**Terminal 1 — Next.js dev server:**
```bash
npm run dev
```

**Terminal 2 — Background worker:**

```powershell
# PowerShell
$env:INTERNAL_APP_URL="http://localhost:3000"
$env:WORKER_SECRET="your-secret-from-env-local"
npm run worker
```

```bash
# bash / zsh / Git Bash
INTERNAL_APP_URL=http://localhost:3000 WORKER_SECRET=your-secret npm run worker
```

Expected output:
```
[worker] Started — polling http://localhost:3000/api/jobs/worker every 1000ms
```

When a job is picked up:
```
[worker] Processed job 31a2680d-9dd3-41c5-9420-fc98a4888307
```

### Tips for Development

- Keep the worker terminal visible alongside the browser — it shows real-time job progress.
- If you restart the Next.js server, the worker reconnects automatically (it retries on fetch errors).
- If you stop the worker mid-job, the job stays in `running`. It will auto-reset after 10 minutes via pg_cron, or you can reset manually:

```sql
UPDATE processing_jobs
SET status = 'pending', started_at = NULL
WHERE status = 'running';
```

- To inspect job history:

```sql
SELECT id, type, status, error, created_at, completed_at
FROM processing_jobs
ORDER BY created_at DESC
LIMIT 20;
```

- To clear all non-done jobs and start fresh:

```sql
DELETE FROM processing_jobs WHERE status IN ('pending', 'running', 'failed');
```

---

## Production

In production you have two options depending on your hosting platform.

---

### Option A — Long-running process (VPS / Docker / Railway / Render)

Run the worker as a persistent background service alongside your Next.js app.

**Environment variables to set on the worker service:**

```env
INTERNAL_APP_URL=https://your-app.com
WORKER_SECRET=your-production-secret
WORKER_POLL_MS=2000
```

> `WORKER_POLL_MS=2000` is recommended in production to reduce unnecessary HTTP traffic when the queue is idle.

**Docker Compose example:**

```yaml
services:
  app:
    build: .
    command: node server.js   # or: npm run start
    environment:
      - WORKER_SECRET=your-secret
      # ... other vars

  worker:
    build: .
    command: node worker/index.mjs
    environment:
      - INTERNAL_APP_URL=http://app:3000
      - WORKER_SECRET=your-secret
    depends_on:
      - app
    restart: unless-stopped
```

**Railway / Render — add a second service** pointing to the same repo with the start command:
```
node worker/index.mjs
```

---

### Option B — pg_cron trigger (Vercel / serverless — no persistent process)

If your platform doesn't support long-running processes (e.g. Vercel), use Supabase's `pg_cron` extension to trigger the worker route on a schedule directly from the database.

**Prerequisites:** `pg_net` extension must be enabled in your Supabase project (Dashboard → Database → Extensions → pg_net).

**Run this once in the Supabase SQL editor** (substitute your actual values):

```sql
-- Enable pg_net if not already enabled
create extension if not exists pg_net;

-- Schedule: call /api/jobs/worker every minute
select cron.schedule(
  'process-pending-jobs',
  '* * * * *',
  format(
    $q$
      select net.http_post(
        url      := '%s/api/jobs/worker',
        headers  := '{"Content-Type":"application/json","x-worker-secret":"%s"}'::jsonb,
        body     := '{}'::jsonb
      )
    $q$,
    'https://your-app.vercel.app',   -- ← replace with your actual URL
    'your-production-secret'          -- ← replace with your WORKER_SECRET
  )
);
```

This triggers the worker route from inside the database every minute. The route processes one job per call, so if multiple jobs are queued, they drain on subsequent ticks (each tick within the same minute processes one more job).

**To verify the cron job was created:**
```sql
SELECT jobid, jobname, schedule, command FROM cron.job;
```

**To remove it:**
```sql
SELECT cron.unschedule('process-pending-jobs');
```

---

### Choosing Between Options

| | Option A (Long-running) | Option B (pg_cron) |
|---|---|---|
| **Best for** | VPS, Docker, Railway, Render | Vercel, serverless |
| **Job pickup latency** | ~1–2 seconds | Up to 60 seconds |
| **Multiple jobs** | Drains queue immediately | One per minute tick |
| **Cost** | Extra service instance | Free (uses Supabase) |
| **Complexity** | Requires second process | One SQL statement |

For most deployments on Vercel with low job volume (a few document processes and quiz generations per day), Option B is sufficient. For high-throughput scenarios, use Option A.

---

## Monitoring

### Check job status in Supabase

```sql
-- Summary by status
SELECT status, count(*) FROM processing_jobs GROUP BY status;

-- Recent jobs with errors
SELECT id, type, status, error, created_at, completed_at
FROM processing_jobs
WHERE status = 'failed'
ORDER BY created_at DESC;

-- Jobs currently running (should clear quickly)
SELECT id, type, started_at, now() - started_at AS running_for
FROM processing_jobs
WHERE status = 'running';
```

### pg_cron job history (Option B)

```sql
SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 20;
```

---

## Groq Rate Limits

Quiz generation uses `llama-3.1-8b-instant` (131,000 tokens/minute on the free tier). Each set generation uses approximately 5,000–6,000 tokens (input context + response). You can safely generate up to 5 sets in a single job without hitting rate limits.

The chat interface uses `llama-3.3-70b-versatile` (6,000 tokens/minute on the free tier). If you hit rate limits during chat, the client automatically retries with the fallback model (`llama-3.1-8b-instant`) after a 60-second wait.

If you need higher throughput, upgrade to a Groq paid plan.
