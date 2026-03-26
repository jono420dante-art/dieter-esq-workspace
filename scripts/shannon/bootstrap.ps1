# Windows convenience wrapper — prefer: npm run shannon:bootstrap
$ErrorActionPreference = 'Stop'
$Root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
Push-Location $Root
try {
  node scripts/shannon/bootstrap.mjs
} finally {
  Pop-Location
}
