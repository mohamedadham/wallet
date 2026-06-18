#!/usr/bin/env bash
# Run the full test suite. DB-backed specs (Postgres contract + concurrency)
# run if TEST_DATABASE_URL / DATABASE_URL is set, and skip cleanly otherwise.
set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -d node_modules ]; then
  echo "Installing dependencies..."
  npm ci
fi

npm test
