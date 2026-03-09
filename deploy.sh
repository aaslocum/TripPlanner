#!/bin/bash
set -e

APP_DIR="/root/TripPlanner"
SERVICE_NAME="tripplanner"

cd "$APP_DIR"

echo "Stopping service..."
systemctl stop "$SERVICE_NAME" || true

echo "Pulling latest code..."
git pull

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
