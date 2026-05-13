#!/usr/bin/env node
/**
 * Standalone background worker — polls /api/jobs/worker on a fixed interval.
 *
 * Environment variables (all optional with sensible defaults):
 *   INTERNAL_APP_URL   Base URL of the running Next.js app  (default: http://localhost:3000)
 *   WORKER_SECRET      Must match WORKER_SECRET on the app server  (default: unset)
 *   WORKER_POLL_MS     Milliseconds between idle polls  (default: 1000)
 *
 * Usage:
 *   node worker/index.mjs
 *   # or, via npm script:
 *   npm run worker
 */

const APP_URL = (process.env.INTERNAL_APP_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const SECRET = process.env.WORKER_SECRET ?? '';
const POLL_MS = Math.max(1000, Number(process.env.WORKER_POLL_MS) || 1000);
const WORKER_URL = `${APP_URL}/api/jobs/worker`;

const headers = {
  'Content-Type': 'application/json',
  ...(SECRET ? { 'x-worker-secret': SECRET } : {}),
};

let running = true;

process.on('SIGINT', () => {
  console.log('\n[worker] Shutting down…');
  running = false;
});
process.on('SIGTERM', () => {
  console.log('\n[worker] Shutting down…');
  running = false;
});

/** Simple sleep — does NOT add extra process signal listeners. */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function poll() {
  try {
    const res = await fetch(WORKER_URL, { method: 'POST', headers, body: '{}' });

    if (res.status === 403) {
      console.error('[worker] Forbidden — check WORKER_SECRET matches the app server. Exiting.');
      process.exit(1);
    }

    if (!res.ok) {
      console.warn(`[worker] HTTP ${res.status} from worker route — will retry.`);
      return false;
    }

    const data = await res.json();

    if (data.processed) {
      console.log(`[worker] Processed job ${data.jobId}`);
      return true; // signal: re-poll immediately to drain the queue
    }

    return false; // no pending jobs
  } catch (err) {
    console.warn(`[worker] Fetch error: ${err.message} — will retry.`);
    return false;
  }
}

async function loop() {
  console.log(`[worker] Started — polling ${WORKER_URL} every ${POLL_MS}ms`);
  if (!SECRET) {
    console.warn(
      '[worker] WORKER_SECRET is not set — requests will be rejected if the app requires it.',
    );
  }

  while (running) {
    const didProcess = await poll();

    if (!running) break;

    if (!didProcess) {
      // No job available — wait before next poll
      await sleep(POLL_MS);
    }
    // If didProcess=true: immediately loop again to drain the queue
  }

  console.log('[worker] Stopped.');
}

loop().catch((err) => {
  console.error('[worker] Fatal error:', err);
  process.exit(1);
});
