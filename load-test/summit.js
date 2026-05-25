/**
 * Summit KT Portal — k6 Load Test
 *
 * Scenarios
 *   chat_load   — POST /api/chat (RAG + LLM streaming), always active
 *   search_load — GET  /search?q=... (SSR full-text search), opt-in via ENABLE_SEARCH=true
 *
 * Environment variables (all optional — defaults shown)
 *   BASE_URL        http://localhost:3000     App base URL
 *   TEST_PASSWORD   TestPassword1!            Password shared by all test accounts
 *   USER_PREFIX     loadtest+                 Email prefix  →  loadtest+001@example.com
 *   USER_DOMAIN     example.com               Email domain
 *   PROJECT_ID      (empty)                   Target project UUID for chat; leave empty to skip body validation
 *   ENABLE_SEARCH   false                     Set to "true" to activate the search scenario
 *   VU_COUNT        100                       Total concurrent virtual users
 *   DURATION        3m                        Scenario duration (e.g. 30s, 2m, 5m)
 *
 * Pre-requisite
 *   The test accounts must already exist in the database.
 *   See the seed snippet at the bottom of run.sh.
 *
 * Usage
 *   See run.sh for ready-to-paste commands.
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { SharedArray } from 'k6/data';
import { Counter, Rate, Trend } from 'k6/metrics';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.2/index.js';

// ── Config ─────────────────────────────────────────────────────────────────────

const BASE_URL     = (__ENV.BASE_URL     || 'http://localhost:3000').replace(/\/$/, '');
const PROJECT_ID   = __ENV.PROJECT_ID    || '';
const WITH_SEARCH  = __ENV.ENABLE_SEARCH === 'true';
const VU_TOTAL     = parseInt(__ENV.VU_COUNT || '100', 10);

const CHAT_VUS   = WITH_SEARCH ? Math.round(VU_TOTAL * 0.7) : VU_TOTAL;
const SEARCH_VUS = WITH_SEARCH ? VU_TOTAL - CHAT_VUS : 0;
const DURATION   = __ENV.DURATION || '3m';

// ── User Pool ──────────────────────────────────────────────────────────────────
// Each VU owns a unique test account to stay under the 30 msg/hr rate limit.
// Accounts are generated from USER_PREFIX + zero-padded index + USER_DOMAIN.

const users = new SharedArray('users', function () {
  const pw = __ENV.TEST_PASSWORD || 'TestPassword1!';
  const pfx = __ENV.USER_PREFIX  || 'loadtest+';
  const dom = __ENV.USER_DOMAIN  || 'example.com';
  const n   = parseInt(__ENV.VU_COUNT || '100', 10);
  return Array.from({ length: n }, (_, i) => ({
    email:    `${pfx}${String(i + 1).padStart(3, '0')}@${dom}`,
    password: pw,
  }));
});

// ── Sample payloads ────────────────────────────────────────────────────────────

const CHAT_QUESTIONS = [
  'What is the deployment process?',
  'How does authentication work in this project?',
  'What are the coding standards and conventions?',
  'Explain the database schema and key tables.',
  'What is the CI/CD release pipeline?',
  'How do I set up a local development environment?',
  'What testing strategies are used?',
  'How does error handling work in the API layer?',
  'What third-party integrations does this project use?',
  'What is the document upload and processing flow?',
];

const SEARCH_QUERIES = [
  'deployment process',
  'authentication setup',
  'environment variables',
  'database schema',
  'API endpoints',
  'error handling',
  'testing strategy',
  'CI/CD pipeline',
  'document upload',
  'role permissions',
];

// ── Custom metrics ─────────────────────────────────────────────────────────────

const chatErrors   = new Rate('chat_errors');
const searchErrors = new Rate('search_errors');
const authErrors   = new Counter('auth_failures');
const chatLatency  = new Trend('chat_latency_ms', true);

// ── k6 options ─────────────────────────────────────────────────────────────────

export const options = {
  scenarios: {
    chat_load: {
      executor:      'constant-vus',
      vus:           CHAT_VUS,
      duration:      DURATION,
      exec:          'chatScenario',
      gracefulStop:  '90s',   // LLM responses can take up to 60s; give them time to drain
      tags:          { scenario: 'chat' },
    },
    ...(WITH_SEARCH && {
      search_load: {
        executor:     'constant-vus',
        vus:          SEARCH_VUS,
        duration:     DURATION,
        exec:         'searchScenario',
        gracefulStop: '10s',
        tags:         { scenario: 'search' },
      },
    }),
  },

  thresholds: {
    // ── Global ──────────────────────────────────────────────────────────────
    http_req_failed:                    ['rate<0.05'],    // <5% total HTTP errors

    // ── Chat (RAG retrieval + LLM generation; intentionally generous) ───────
    chat_errors:                        ['rate<0.10'],    // <10% chat failures
    chat_latency_ms:                    ['p(95)<25000'],  // p95 < 25 s end-to-end
    'http_req_duration{scenario:chat}': ['p(90)<20000'],  // p90 < 20 s

    // ── Auth ─────────────────────────────────────────────────────────────────
    auth_failures:                      ['count<10'],     // <10 auth failures total

    // ── Search (SSR, no LLM — tight threshold) ───────────────────────────────
    ...(WITH_SEARCH && {
      search_errors:                          ['rate<0.05'],  // <5% search failures
      'http_req_duration{scenario:search}':   ['p(95)<3000'], // p95 < 3 s
    }),
  },

  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
};

// ── Auth helper ────────────────────────────────────────────────────────────────
// NextAuth credentials flow:
//   1. GET  /api/auth/csrf            → csrfToken
//   2. POST /api/auth/callback/credentials (form-encoded)  → sets session cookie
//
// k6 stores cookies in the per-VU jar automatically; no need to thread the jar
// object through subsequent requests.

function authenticate(email, password) {
  const csrfRes = http.get(`${BASE_URL}/api/auth/csrf`, {
    headers: { Accept: 'application/json' },
  });

  if (csrfRes.status !== 200) {
    authErrors.add(1);
    return false;
  }

  const body = csrfRes.json();
  const csrfToken = body && body.csrfToken;
  if (!csrfToken) {
    authErrors.add(1);
    return false;
  }

  const loginRes = http.post(
    `${BASE_URL}/api/auth/callback/credentials`,
    [
      `csrfToken=${encodeURIComponent(csrfToken)}`,
      `email=${encodeURIComponent(email)}`,
      `password=${encodeURIComponent(password)}`,
      'redirect=false',
      `callbackUrl=${encodeURIComponent('/dashboard')}`,
      'json=true',
    ].join('&'),
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        // No Origin header → validateOrigin() treats it as same-origin (allowed)
        Referer: `${BASE_URL}/login`,
      },
      redirects: 0,
    },
  );

  const ok = check(loginRes, {
    'auth: 200 or 302': (r) => r.status === 200 || r.status === 302,
  });

  if (!ok) {
    authErrors.add(1);
  }

  return ok;
}

// ── Scenarios ──────────────────────────────────────────────────────────────────

/**
 * chatScenario
 * Each VU authenticates once, then sends 3 chat messages with think-time gaps.
 * A session ID is carried across turns to simulate a real multi-turn conversation.
 */
export function chatScenario() {
  const user = users[(__VU - 1) % users.length];

  const authed = authenticate(user.email, user.password);
  if (!authed) {
    sleep(3);
    return;
  }

  let sessionId = null;
  const TURNS = 3;

  for (let turn = 0; turn < TURNS; turn++) {
    const question = CHAT_QUESTIONS[Math.floor(Math.random() * CHAT_QUESTIONS.length)];

    group('chat_turn', () => {
      const t0 = Date.now();

      const res = http.post(
        `${BASE_URL}/api/chat`,
        JSON.stringify({
          projectId: PROJECT_ID,
          message:   question,
          sessionId: sessionId,
        }),
        {
          headers: {
            'Content-Type': 'application/json',
            Accept:         'text/plain',
          },
          // Large timeout: LLM streaming can take 20-30 s under load
          timeout: '60s',
        },
      );

      chatLatency.add(Date.now() - t0);

      const ok = check(res, {
        'chat: status 200':      (r) => r.status === 200,
        'chat: has body':        (r) => r.body !== null && r.body.length > 10,
        'chat: not rate limited':(r) => r.status !== 429,
        'chat: not server error':(r) => r.status < 500,
      });

      chatErrors.add(!ok ? 1 : 0);

      // Carry the session forward for the next turn
      const sid = res.headers['X-Session-Id'];
      if (sid) sessionId = sid;
    });

    // Human-like think time between turns (2-5 s)
    if (turn < TURNS - 1) {
      sleep(Math.random() * 3 + 2);
    }
  }

  // Cool-down before the next iteration
  sleep(5);
}

/**
 * searchScenario
 * Each VU authenticates once then hammers the SSR search page.
 * No LLM involved — this tests DB full-text search and SSR throughput.
 */
export function searchScenario() {
  const user = users[(__VU - 1) % users.length];

  authenticate(user.email, user.password);

  const query = SEARCH_QUERIES[Math.floor(Math.random() * SEARCH_QUERIES.length)];
  const url   = PROJECT_ID
    ? `${BASE_URL}/search?q=${encodeURIComponent(query)}&projectId=${PROJECT_ID}`
    : `${BASE_URL}/search?q=${encodeURIComponent(query)}`;

  group('document_search', () => {
    const res = http.get(url, {
      headers: {
        Accept:  'text/html',
        Referer: `${BASE_URL}/dashboard`,
      },
    });

    const ok = check(res, {
      'search: status 200':   (r) => r.status === 200,
      'search: has results':  (r) => r.body !== null && r.body.includes('Search'),
    });

    searchErrors.add(!ok ? 1 : 0);
  });

  sleep(Math.random() * 2 + 1); // 1-3 s between searches
}

// ── Summary ────────────────────────────────────────────────────────────────────

export function handleSummary(data) {
  return {
    stdout: textSummary(data, { indent: '  ', enableColors: true }),
  };
}
