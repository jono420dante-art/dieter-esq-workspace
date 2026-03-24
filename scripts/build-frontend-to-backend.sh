#!/usr/bin/env bash
# Build UI and copy to dieter-backend/static (uses Node — same as npm run build:backend).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
node "$ROOT/scripts/build-frontend-to-backend.mjs"
