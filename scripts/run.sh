#!/usr/bin/env bash
# Run the API locally. Expects a reachable Postgres (DATABASE_URL) and that
# migrations have been applied (see scripts/migrate.sh). Falls back to .env.
set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -d node_modules ]; then
  echo "Installing dependencies..."
  npm ci
fi

echo "Starting API..."
npm run start
