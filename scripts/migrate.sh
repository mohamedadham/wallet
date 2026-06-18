#!/usr/bin/env bash
# Apply database migrations. Requires DATABASE_URL (directly or via .env).
set -euo pipefail
cd "$(dirname "$0")/.."

npm run migration:run
