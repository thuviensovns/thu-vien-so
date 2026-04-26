#!/bin/bash
# ~/update.sh — Pull deploy branch + restart Node.js app on Vietnix cPanel.
#
# Triggered by:
#   1. GitHub Actions workflow .github/workflows/deploy-vietnix.yml (auto)
#   2. Manual: bash ~/update.sh from cPanel Terminal
#
# Setup once on Vietnix:
#   1. Clone repo: cd ~ && git clone -b deploy https://github.com/thuviensovns/thu-vien-so.git
#   2. Copy this file: cp ~/thu-vien-so/scripts/update-vietnix.sh ~/update.sh
#   3. Make it executable: chmod +x ~/update.sh
#   4. Adjust APP_DIR / RESTART_FILE below to match your cPanel Node.js App setup.

set -e

# --- Configuration ---
# Path to the cloned repo on Vietnix (matches "Application root" in cPanel Node.js App).
APP_DIR="$HOME/thu-vien-so"

# cPanel Node.js Selector restarts the app when this file's mtime changes.
# Path is automatically created by Setup Node.js App; check yours under
# ~/nodevenv/<app>/<node-version>/restart.txt or ~/<app>/tmp/restart.txt.
RESTART_FILE="$APP_DIR/tmp/restart.txt"

echo "=== [$(date '+%F %T')] Vietnix update starting ==="

# --- 1. Pull latest deploy branch ---
echo "→ Pulling latest deploy branch..."
cd "$APP_DIR"
git fetch origin deploy
git reset --hard origin/deploy

# --- 2. Install production dependencies ---
# Vietnix shared hosting usually has npm but not pnpm. Use npm with the
# generated package-lock if pnpm is unavailable.
echo "→ Installing dependencies..."
if command -v pnpm >/dev/null 2>&1; then
  pnpm install --prod --frozen-lockfile
else
  npm install --omit=dev --no-audit --no-fund
fi

# --- 3. Touch restart file so Node.js Selector reloads the app ---
echo "→ Restarting Node.js app..."
mkdir -p "$(dirname "$RESTART_FILE")"
touch "$RESTART_FILE"

echo "=== [$(date '+%F %T')] Vietnix update DONE ==="
