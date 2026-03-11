#!/bin/bash
# ci-poll.sh — Polls the remote repository for changes.
# When new commits are found: pulls, runs tests, and on success
# triggers a full deploy (build + migrate + reload).
#
# Designed to run via systemd timer or cron on the production server.
# All output goes to stdout/stderr for journalctl visibility.
#
# Usage:
#   ./ci-poll.sh              # Poll default branch (main)
#   ./ci-poll.sh production   # Poll a specific branch

set -euo pipefail

APP_DIR="/root/TripPlanner"
SERVICE_NAME="tripplanner"
BRANCH="${1:-main}"
LOCK_FILE="/tmp/tripplanner-ci.lock"
LOG_PREFIX="[ci-poll]"

log()  { echo "$LOG_PREFIX $(date '+%Y-%m-%d %H:%M:%S') $*"; }
fail() { log "ERROR: $*" >&2; exit 1; }

# ── Guard: prevent overlapping runs ────────────────────────────────────────
if [ -f "$LOCK_FILE" ]; then
  LOCK_PID=$(cat "$LOCK_FILE" 2>/dev/null || true)
  if [ -n "$LOCK_PID" ] && kill -0 "$LOCK_PID" 2>/dev/null; then
    log "Another CI run is in progress (PID $LOCK_PID). Skipping."
    exit 0
  fi
  log "Stale lock file found. Removing."
  rm -f "$LOCK_FILE"
fi
echo $$ > "$LOCK_FILE"
trap 'rm -f "$LOCK_FILE"' EXIT

# ── Check for remote changes ──────────────────────────────────────────────
cd "$APP_DIR"

log "Fetching origin/$BRANCH..."
git fetch origin "$BRANCH" 2>&1 || fail "git fetch failed"

LOCAL_SHA=$(git rev-parse HEAD)
REMOTE_SHA=$(git rev-parse "origin/$BRANCH")

if [ "$LOCAL_SHA" = "$REMOTE_SHA" ]; then
  log "Already up to date ($LOCAL_SHA). Nothing to do."
  exit 0
fi

log "New commits detected: $LOCAL_SHA → $REMOTE_SHA"
log "$(git log --oneline "$LOCAL_SHA..$REMOTE_SHA")"

# ── Pull new code ─────────────────────────────────────────────────────────
# Back up production DB (gitignored, lives only on server)
DB_FILE="server/data/tripplanner.db"
if [ -f "$DB_FILE" ]; then
  cp "$DB_FILE" "$DB_FILE.ci-backup"
  log "Database backed up."
fi

git rm --cached "$DB_FILE" 2>/dev/null || true

log "Pulling origin/$BRANCH..."
git pull origin "$BRANCH" 2>&1 || fail "git pull failed"

# Restore production DB after pull
if [ -f "$DB_FILE.ci-backup" ]; then
  mv "$DB_FILE.ci-backup" "$DB_FILE"
  log "Database restored."
fi

# ── Install dependencies ──────────────────────────────────────────────────
log "Installing dependencies..."
npm install --prefix server 2>&1 || fail "server npm install failed"
npm install --prefix client 2>&1 || fail "client npm install failed"

# ── Run tests ─────────────────────────────────────────────────────────────
log "Running server tests..."
if ! (cd server && npx vitest run 2>&1); then
  fail "Server tests FAILED. Aborting deploy. The server remains on the previous version."
fi

log "Running client tests..."
if ! (cd client && npx vitest run 2>&1); then
  fail "Client tests FAILED. Aborting deploy. The server remains on the previous version."
fi

log "All tests passed."

# ── Build & deploy ────────────────────────────────────────────────────────
log "Building client..."
npm run build 2>&1 || fail "Client build failed"

log "Running database migrations..."
(cd server && node src/db/migrations/runner.js 2>&1) || fail "Migrations failed"

log "Reloading service..."
systemctl restart "$SERVICE_NAME" 2>&1 || fail "systemctl restart failed"

# Give the server a moment to start, then verify it's healthy
sleep 2
if systemctl is-active --quiet "$SERVICE_NAME"; then
  log "Deploy successful! Service is running."
  log "Deployed commit: $(git rev-parse --short HEAD)"
else
  log "WARNING: Service failed to start after deploy!"
  systemctl status "$SERVICE_NAME" --no-pager >&2 || true
  exit 1
fi
