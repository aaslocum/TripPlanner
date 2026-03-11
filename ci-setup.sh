#!/bin/bash
# ci-setup.sh — Install the CI polling timer on the production server.
#
# This copies the systemd units into place and enables the timer.
# Run once after cloning the repo on the server.
#
# Usage:
#   sudo ./ci-setup.sh           # Install and enable
#   sudo ./ci-setup.sh --remove  # Disable and remove

set -euo pipefail

APP_DIR="/root/TripPlanner"
SERVICE_FILE="tripplanner-ci.service"
TIMER_FILE="tripplanner-ci.timer"
SYSTEMD_DIR="/etc/systemd/system"

if [ "${1:-}" = "--remove" ]; then
  echo "Disabling and removing CI timer..."
  systemctl stop "$TIMER_FILE" 2>/dev/null || true
  systemctl disable "$TIMER_FILE" 2>/dev/null || true
  rm -f "$SYSTEMD_DIR/$SERVICE_FILE" "$SYSTEMD_DIR/$TIMER_FILE"
  systemctl daemon-reload
  echo "CI timer removed."
  exit 0
fi

echo "Installing CI polling timer..."

# Make the poll script executable
chmod +x "$APP_DIR/ci-poll.sh"
chmod +x "$APP_DIR/deploy.sh"

# Copy systemd units
cp "$APP_DIR/$SERVICE_FILE" "$SYSTEMD_DIR/"
cp "$APP_DIR/$TIMER_FILE" "$SYSTEMD_DIR/"

# Reload systemd, enable and start the timer
systemctl daemon-reload
systemctl enable "$TIMER_FILE"
systemctl start "$TIMER_FILE"

echo ""
echo "CI timer installed and running."
echo "  Polling interval: every 2 minutes"
echo "  Branch: main"
echo ""
echo "Useful commands:"
echo "  systemctl status tripplanner-ci.timer   # Timer status + next run"
echo "  systemctl list-timers tripplanner-ci*    # Timer schedule"
echo "  journalctl -u tripplanner-ci -f          # Follow CI logs"
echo "  journalctl -u tripplanner-ci --since '1 hour ago'  # Recent logs"
echo "  sudo ./ci-setup.sh --remove              # Uninstall"
