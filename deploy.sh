#!/bin/bash
# deploy.sh — Manual deployment script.
# Pulls latest code, runs tests, builds client, migrates DB, and restarts.
#
# Usage:
#   ./deploy.sh            # Normal deploy (stops service during build)
#   ./deploy.sh --skip-tests  # Skip tests (emergency hotfix)

set -e

APP_DIR="/root/TripPlanner"
SERVICE_NAME="tripplanner"
SKIP_TESTS=false

if [ "${1:-}" = "--skip-tests" ]; then
  SKIP_TESTS=true
  echo "⚠ Skipping tests (--skip-tests flag)"
fi

cd "$APP_DIR"

echo "Stopping service..."
systemctl stop "$SERVICE_NAME" || true

# Backup production DB before pull (DB is gitignored, lives only on server)
DB_FILE="server/data/tripplanner.db"
if [ -f "$DB_FILE" ]; then
  cp "$DB_FILE" "$DB_FILE.deploy-backup"
  echo "Database backed up."
fi

# Remove DB from git tracking so pull doesn't conflict
# (needed for the transition from tracked → gitignored)
git rm --cached "$DB_FILE" 2>/dev/null || true

echo "Pulling latest code..."
git pull

# Restore production DB after pull
if [ -f "$DB_FILE.deploy-backup" ]; then
  mv "$DB_FILE.deploy-backup" "$DB_FILE"
  echo "Database restored."
fi

echo "Installing dependencies..."
npm install --prefix server
npm install --prefix client

# Run tests unless skipped
if [ "$SKIP_TESTS" = false ]; then
  echo "Running tests..."
  (cd server && npx vitest run) || { echo "Server tests FAILED. Aborting."; systemctl start "$SERVICE_NAME" || true; exit 1; }
  (cd client && npx vitest run) || { echo "Client tests FAILED. Aborting."; systemctl start "$SERVICE_NAME" || true; exit 1; }
  echo "All tests passed."
fi

echo "Building client..."
npm run build

echo "Running database migrations..."
cd server && node src/db/migrations/runner.js && cd ..

echo "Starting service..."
systemctl start "$SERVICE_NAME"

echo "Deploy complete! Status:"
systemctl status "$SERVICE_NAME" --no-pager
