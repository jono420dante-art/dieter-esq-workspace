# DIETER PRO Platform — Local Server
# Run: .\serve.ps1

$port = 5500
$root = $PSScriptRoot

Write-Host ""
Write-Host "  ╔══════════════════════════════════════╗" -ForegroundColor Magenta
Write-Host "  ║     DIETER PRO — PLATFORM SERVER     ║" -ForegroundColor Magenta
Write-Host "  ╚══════════════════════════════════════╝" -ForegroundColor Magenta
Write-Host ""

# Try npx serve first (best option)
$npxAvailable = Get-Command npx -ErrorAction SilentlyContinue
if ($npxAvailable) {
    Write-Host "  Starting with npx serve..." -ForegroundColor Cyan
    Write-Host "  Open: http://localhost:$port" -ForegroundColor Green
    Write-Host ""
    Start-Process "http://localhost:$port"
    npx serve -s "$root" -l $port --cors --no-clipboard
    exit
}

# Try Python
$pythonCmd = $null
if (Get-Command python3 -ErrorAction SilentlyContinue) { $pythonCmd = "python3" }
elseif (Get-Command python -ErrorAction SilentlyContinue) { $pythonCmd = "python" }
elseif (Get-Command py -ErrorAction SilentlyContinue) { $pythonCmd = "py" }

if ($pythonCmd) {
    Write-Host "  Starting with Python HTTP server..." -ForegroundColor Cyan
    Write-Host "  Open: http://localhost:$port" -ForegroundColor Green
    Write-Host ""
    Start-Process "http://localhost:$port"
    & $pythonCmd -m http.server $port --directory "$root"
    exit
}

# Fallback: PowerShell HTTP listener
Write-Host "  Starting PowerShell HTTP server..." -ForegroundColor Cyan
Write-Host "  Open: http://localhost:$port" -ForegroundColor Green
Write-Host "  Press Ctrl+C to stop" -ForegroundColor Yellow
Write-Host ""

$mimeTypes = @{
    '.html' = 'text/html'
    '.css'  = 'text/css'
    '.js'   = 'application/javascript'
    '.json' = 'application/json'
    '.png'  = 'image/png'
    '.jpg'  = 'image/jpeg'
    '.svg'  = 'image/svg+xml'
    '.ico'  = 'image/x-icon'
    '.woff' = 'font/woff'
    '.woff2'= 'font/woff2'
    '.mp3'  = 'audio/mpeg'
    '.wav'  = 'audio/wav'
    '.ogg'  = 'audio/ogg'
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")
$listener.Start()
Start-Process "http://localhost:$port"

try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        $path = $request.Url.LocalPath
        if ($path -eq '/') { $path = '/index.html' }
        $filePath = Join-Path $root ($path -replace '/', '\')

        if (Test-Path $filePath -PathType Leaf) {
            $ext = [System.IO.Path]::GetExtension($filePath)
            $mime = $mimeTypes[$ext]
            if (-not $mime) { $mime = 'application/octet-stream' }
            $response.ContentType = "$mime; charset=utf-8"
            $response.Headers.Add("Access-Control-Allow-Origin", "*")
            $bytes = [System.IO.File]::ReadAllBytes($filePath)
            $response.ContentLength64 = $bytes.Length
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
        } else {
            # SPA fallback
            $indexPath = Join-Path $root 'index.html'
            $response.ContentType = 'text/html; charset=utf-8'
            $bytes = [System.IO.File]::ReadAllBytes($indexPath)
            $response.ContentLength64 = $bytes.Length
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
        }
        $response.Close()
    }
} finally {
    $listener.Stop()
}
