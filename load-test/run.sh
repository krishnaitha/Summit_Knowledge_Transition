#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# Summit KT Portal — k6 load test runner
#
# Requirements
#   brew install k6          (macOS)
#   choco install k6         (Windows)
#   apt install k6           (Ubuntu/Debian)
#
# All commands assume you are in the repo root.
# ──────────────────────────────────────────────────────────────────────────────

set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
TEST_PASSWORD="${TEST_PASSWORD:-TestPassword1!}"
USER_PREFIX="${USER_PREFIX:-loadtest+}"
USER_DOMAIN="${USER_DOMAIN:-example.com}"
PROJECT_ID="${PROJECT_ID:-}"          # Set this to a real project UUID

SCRIPT="load-test/summit.js"

# ── Commands ───────────────────────────────────────────────────────────────────

cmd="${1:-help}"

case "$cmd" in

  # ── Smoke: 5 VUs, 30 s — sanity check before a real run ───────────────────
  smoke)
    echo ">>> Smoke test (5 VUs / 30 s)"
    k6 run \
      --vus 5 --duration 30s \
      --env BASE_URL="$BASE_URL" \
      --env TEST_PASSWORD="$TEST_PASSWORD" \
      --env USER_PREFIX="$USER_PREFIX" \
      --env USER_DOMAIN="$USER_DOMAIN" \
      --env PROJECT_ID="$PROJECT_ID" \
      --env VU_COUNT=5 \
      --summary-trend-stats="avg,p(90),p(95),max" \
      "$SCRIPT"
    ;;

  # ── Chat only: 100 VUs, 3 min ─────────────────────────────────────────────
  chat)
    echo ">>> Chat load test (100 VUs / 3 min)"
    k6 run \
      --env BASE_URL="$BASE_URL" \
      --env TEST_PASSWORD="$TEST_PASSWORD" \
      --env USER_PREFIX="$USER_PREFIX" \
      --env USER_DOMAIN="$USER_DOMAIN" \
      --env PROJECT_ID="$PROJECT_ID" \
      --env VU_COUNT=100 \
      --env ENABLE_SEARCH=false \
      --summary-trend-stats="avg,p(90),p(95),p(99),max" \
      "$SCRIPT"
    ;;

  # ── Chat + Search: 70/30 split, 3 min ─────────────────────────────────────
  full)
    echo ">>> Full load test — chat (70 VUs) + search (30 VUs) / 3 min"
    k6 run \
      --env BASE_URL="$BASE_URL" \
      --env TEST_PASSWORD="$TEST_PASSWORD" \
      --env USER_PREFIX="$USER_PREFIX" \
      --env USER_DOMAIN="$USER_DOMAIN" \
      --env PROJECT_ID="$PROJECT_ID" \
      --env VU_COUNT=100 \
      --env ENABLE_SEARCH=true \
      --summary-trend-stats="avg,p(90),p(95),p(99),max" \
      "$SCRIPT"
    ;;

  # ── Soak: 50 VUs, 10 min — memory/leak detection ─────────────────────────
  soak)
    echo ">>> Soak test (50 VUs / 10 min)"
    k6 run \
      --env BASE_URL="$BASE_URL" \
      --env TEST_PASSWORD="$TEST_PASSWORD" \
      --env USER_PREFIX="$USER_PREFIX" \
      --env USER_DOMAIN="$USER_DOMAIN" \
      --env PROJECT_ID="$PROJECT_ID" \
      --env VU_COUNT=50 \
      --env ENABLE_SEARCH=false \
      --vus 50 --duration 10m \
      --summary-trend-stats="avg,p(90),p(95),p(99),max" \
      "$SCRIPT"
    ;;

  # ── Quick summary of last run (re-prints from output JSON) ────────────────
  summary)
    if [ -f load-test/results.json ]; then
      k6 inspect load-test/results.json 2>/dev/null || cat load-test/results.json | python3 -m json.tool
    else
      echo "No results.json found. Run with: bash load-test/run.sh chat 2>&1 | tee load-test/results.json"
    fi
    ;;

  help|*)
    cat <<'EOF'
Usage: bash load-test/run.sh <command>

Commands:
  smoke    5 VUs / 30 s — quick sanity check
  chat     100 VUs / 3 min — chat-only load test  (demo-ready)
  full     100 VUs / 3 min — chat (70) + search (30) split
  soak     50 VUs / 10 min — sustained load / memory leak detection
  summary  Print summary from last saved results.json

Override any variable inline:
  BASE_URL=https://staging.example.com PROJECT_ID=abc-123 bash load-test/run.sh chat

Save JSON output for CI or later inspection:
  bash load-test/run.sh chat 2>&1 | tee load-test/results.json

EOF
    ;;
esac

# ──────────────────────────────────────────────────────────────────────────────
# PRE-REQUISITE: Seed 100 test users into the database
#
# Run this SQL once against your Postgres instance before any load test.
# Adjust the password hash to match TEST_PASSWORD via:
#   node -e "const b=require('bcryptjs'); b.hash('TestPassword1!',12).then(console.log)"
#
# Then replace <BCRYPT_HASH> below with the output.
#
# INSERT INTO users (email, full_name, password_hash, role, auth_provider, is_active)
# SELECT
#   'loadtest+' || lpad(i::text, 3, '0') || '@example.com',
#   'Load Test User ' || i,
#   '<BCRYPT_HASH>',
#   'member',
#   'credentials',
#   true
# FROM generate_series(1, 100) AS s(i)
# ON CONFLICT (email) DO NOTHING;
#
# To add them all to a specific project (replace <PROJECT_UUID>):
#
# INSERT INTO project_members (project_id, user_id, role)
# SELECT '<PROJECT_UUID>', id, 'member'
# FROM users
# WHERE email LIKE 'loadtest+%@example.com'
# ON CONFLICT DO NOTHING;
#
# ──────────────────────────────────────────────────────────────────────────────
