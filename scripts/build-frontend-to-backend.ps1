# Build UI and copy to dieter-backend/static (no PowerShell execution-policy issues — uses Node).
$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot
node (Join-Path $RepoRoot "scripts\build-frontend-to-backend.mjs")
