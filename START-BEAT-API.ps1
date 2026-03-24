# Start FastAPI beat detection on http://localhost:8000
# Requires: Python 3.10+, FFmpeg on PATH for mp3/m4a
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Backend = Join-Path $Root 'backend'
$VenvPy = Join-Path $Backend '.venv\Scripts\python.exe'
$VenvPip = Join-Path $Backend '.venv\Scripts\pip.exe'

if (-not (Test-Path (Join-Path $Backend 'main.py'))) {
  Write-Host "ERROR: backend\main.py not found under $Root" -ForegroundColor Red
  Read-Host "Press Enter to close"
  exit 1
}
if (-not (Test-Path (Join-Path $Root 'local-audio\beat_detect.py'))) {
  Write-Host "WARN: local-audio\beat_detect.py missing — API imports may fail." -ForegroundColor Yellow
}

Set-Location $Backend
Write-Host ">>> $Backend" -ForegroundColor Cyan

if (-not (Test-Path $VenvPy)) {
  Write-Host "Creating .venv and installing deps (first run can take a few minutes)..." -ForegroundColor Yellow
  python -m venv .venv
  if (-not (Test-Path $VenvPy)) {
    Write-Host "ERROR: Could not create venv. Install Python 3.10+ and ensure 'python' is on PATH." -ForegroundColor Red
    Read-Host "Press Enter to close"
    exit 1
  }
  & $VenvPip install -q -r requirements.txt
  if ($LASTEXITCODE -ne 0) {
    & $VenvPip install -r requirements.txt
  }
}

Write-Host ""
Write-Host "Beat API:   http://localhost:8000" -ForegroundColor Green
Write-Host "Swagger UI: http://localhost:8000/docs" -ForegroundColor Green
Write-Host "Health:     http://localhost:8000/health" -ForegroundColor Green
Write-Host ""
Write-Host "React: set VITE_API_BASE=http://localhost:8000 in platform-ui\.env.local" -ForegroundColor DarkGray
Write-Host ""

& $VenvPy -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
