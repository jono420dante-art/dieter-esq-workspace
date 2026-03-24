#!/usr/bin/env bash
# One-command dev stack for Mac (FastAPI + tRPC + mureka-clone Vite).
# From repo root:
#   chmod +x serve-mac.sh mureka-clone/dev-stack.sh
#   ./serve-mac.sh

set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec "$ROOT_DIR/mureka-clone/dev-stack.sh"
