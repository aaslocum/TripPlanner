#!/bin/bash
set -e

APP_DIR="/root/TripPlanner"
SERVICE_NAME="tripplanner"

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
npm install --prefix server --omit=dev
npm install --prefix client

echo "Building client..."
npm run build

echo "Running database migrations..."
cd server && node src/db/migrations/runner.js && cd ..

echo "Starting service..."
systemctl start "$SERVICE_NAME"

echo "Deploy complete! Status:"
systemctl status "$SERVICE_NAME" --no-pager
