# Start FastAPI + tRPC + Vite (mureka-clone) for local testing with real tRPC.
# Run from repo root:  pwsh -File mureka-clone/dev-stack.ps1
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$Backend = Join-Path $Root "dieter-backend"
$Trpc = Join-Path $Backend "dieter-trpc"
$Here = $PSScriptRoot

Write-Host "1) FastAPI :8787"
Start-Process powershell -ArgumentList "-NoExit", "-Command", @"
  cd `"$Backend`"
  if (!(Test-Path .venv)) { python -m venv .venv }
  .\.venv\Scripts\Activate.ps1
  pip install -r requirements.txt -q
  `$env:DIETER_FASTAPI_BASE = 'http://127.0.0.1:8787'
  uvicorn app.main:app --reload --port 8787
"@

Start-Sleep -Seconds 2

Write-Host "2) tRPC :8790 -> FastAPI"
Start-Process powershell -ArgumentList "-NoExit", "-Command", @"
  cd `"$Trpc`"
  npm install -q
  `$env:DIETER_FASTAPI_BASE = 'http://127.0.0.1:8787'
  `$env:DIETER_TRPC_PORT = '8790'
  npm run dev
"@

Start-Sleep -Seconds 2

Write-Host "3) Vite (mureka-clone) :5173 — proxies /trpc and /api"
Set-Location $Here
if (!(Test-Path "node_modules")) { npm install }
npm run dev
