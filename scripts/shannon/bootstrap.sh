#!/usr/bin/env bash
# Unix convenience wrapper — prefer: npm run shannon:bootstrap
set -euo pipefail
cd "$(dirname "$0")/../.."
exec node scripts/shannon/bootstrap.mjs
