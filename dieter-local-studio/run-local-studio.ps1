# DIETER Local Studio API — port 8890
Set-Location $PSScriptRoot
if (-not (Test-Path .\.venv\Scripts\Activate.ps1)) {
  python -m venv .venv
  .\.venv\Scripts\Activate.ps1
  pip install -r requirements.txt
} else {
  .\.venv\Scripts\Activate.ps1
}
Write-Host "Starting Local Studio on http://127.0.0.1:8890 ..."
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8890
