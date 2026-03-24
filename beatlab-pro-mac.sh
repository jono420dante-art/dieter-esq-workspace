#!/usr/bin/env bash
# MacBook Air → local “Suno-style” stack (FastAPI + Vite, no tRPC).
#
# Fixes vs a naive script:
#   - App module is app.main:app (not main:app).
#   - Frontend lives in mureka-clone/ (not frontend/).
#   - Default API port 8787 matches mureka-clone/vite.config.js proxy (/api → 8787).
#   - DistroKid has no dashboard URL in this API; prep is POST /api/pipeline/upload-distrokid-prep.
#
# Usage (repo root):
#   chmod +x beatlab-pro-mac.sh && ./beatlab-pro-mac.sh
#
# Full stack with tRPC + same ports: ./serve-mac.sh  (runs mureka-clone/dev-stack.sh)

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND="$ROOT/dieter-backend"
FRONTEND="$ROOT/mureka-clone"

API_PORT="${DIETER_API_PORT:-8787}"
API_PID=""

cleanup() {
  echo ""
  echo "Stopping API…"
  if [[ -n "$API_PID" ]] && kill -0 "$API_PID" 2>/dev/null; then
    kill "$API_PID" 2>/dev/null || true
  fi
  pkill -f "[u]vicorn app.main:app.*--port $API_PORT" 2>/dev/null || true
}

trap cleanup EXIT INT TERM

command -v python3 >/dev/null 2>&1 || { echo "Need python3"; exit 1; }
command -v node >/dev/null 2>&1 || { echo "Need Node.js (LTS)"; exit 1; }

echo "==> Backend (FastAPI) :$API_PORT"
cd "$BACKEND"
if [[ ! -d .venv ]]; then
  python3 -m venv .venv
fi
# shellcheck source=/dev/null
source .venv/bin/activate
python3 -m pip install -q -r requirements.txt
python3 -m uvicorn app.main:app --reload --host 0.0.0.0 --port "$API_PORT" &
API_PID=$!

echo "Waiting for /api/health…"
for _ in {1..40}; do
  if curl -fsS "http://127.0.0.1:$API_PORT/api/health" >/dev/null 2>&1; then
    break
  fi
  sleep 0.25
done

echo "==> Frontend (Vite) :5173 — proxies /api → $API_PORT"
cd "$FRONTEND"
if [[ ! -d node_modules ]]; then
  npm install
fi

echo ""
echo "Beat Lab + Beat Lab Pro UI:  http://127.0.0.1:5173  (Beat lab mode)"
echo "API health:                   http://127.0.0.1:$API_PORT/api/health"
echo "Generate master (POST):       /api/pipeline/generate-master"
echo "DistroKid prep (POST):        /api/pipeline/upload-distrokid-prep  (no browser GET page)"
echo ""
echo "If you use API_PORT=8000, set Vite proxy target in mureka-clone/vite.config.js to match."
echo "Ctrl+C stops Vite and tears down the API."
echo ""

npm run dev
