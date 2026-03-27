#!/usr/bin/env bash
# Start FastAPI + tRPC + Vite (mureka-clone) on macOS / Linux.
# Usage: chmod +x mureka-clone/dev-stack.sh && ./mureka-clone/dev-stack.sh
# Or from mureka-clone: ./dev-stack.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKEND="$ROOT/dieter-backend"
TRPC="$BACKEND/dieter-trpc"
APP="$SCRIPT_DIR"

API_PORT="${DIETER_API_PORT:-8787}"
TRPC_PORT="${DIETER_TRPC_PORT:-8790}"

export DIETER_FASTAPI_BASE="${DIETER_FASTAPI_BASE:-http://127.0.0.1:$API_PORT}"
export DIETER_TRPC_PORT="$TRPC_PORT"

API_PID=""
TRPC_PID=""

cleanup() {
  echo ""
  echo "Stopping background services…"
  if [[ -n "$TRPC_PID" ]] && kill -0 "$TRPC_PID" 2>/dev/null; then
    kill "$TRPC_PID" 2>/dev/null || true
  fi
  if [[ -n "$API_PID" ]] && kill -0 "$API_PID" 2>/dev/null; then
    kill "$API_PID" 2>/dev/null || true
  fi
  # uvicorn --reload leaves a child; tsx watch too
  pkill -f "[u]vicorn app.main:app" 2>/dev/null || true
  pkill -f "[t]sx watch src/server.ts" 2>/dev/null || true
}

trap cleanup EXIT INT TERM

command -v python3 >/dev/null 2>&1 || { echo "Need python3"; exit 1; }
command -v node >/dev/null 2>&1 || { echo "Need Node.js (LTS)"; exit 1; }

echo "==> 1/3 FastAPI :$API_PORT"
cd "$BACKEND"
if [[ ! -d .venv ]]; then
  python3 -m venv .venv
fi
# shellcheck source=/dev/null
source .venv/bin/activate
python3 -m pip install -q -r requirements.txt
python3 -m uvicorn app.main:app --reload --port "$API_PORT" &
API_PID=$!

echo "Waiting for API…"
for _ in {1..40}; do
  if curl -fsS "http://127.0.0.1:$API_PORT/api/health" >/dev/null 2>&1; then
    break
  fi
  sleep 0.25
done

echo "==> 2/3 tRPC :$TRPC_PORT -> $DIETER_FASTAPI_BASE"
cd "$TRPC"
npm install --silent
npm run dev &
TRPC_PID=$!

echo "Waiting for tRPC…"
for _ in {1..50}; do
  if curl -fsS "http://127.0.0.1:$TRPC_PORT/health" >/dev/null 2>&1; then
    break
  fi
  sleep 0.2
done

echo "==> 3/3 Vite (mureka-clone) :5173 — proxies /trpc, /api, /voices"
mkdir -p "$BACKEND/voices/man" "$BACKEND/voices/woman"
cd "$APP"
if [[ ! -d node_modules ]]; then
  npm install
fi
echo ""
echo "Open http://127.0.0.1:5173  —  API keys modal: Mureka + optional OpenAI"
echo "Ctrl+C stops Vite and shuts down API + tRPC."
echo ""

npm run dev
