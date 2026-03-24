@echo off
title DIETER Local Launcher
set "ROOT=%~dp0"
set "STUDIO=%ROOT%dieter-local-studio"
set "UI=%ROOT%mureka-clone"
set "PY=%STUDIO%\.venv\Scripts\python.exe"

echo.
echo === DIETER Local ===
echo Project: %ROOT%
echo.

if not exist "%STUDIO%\app\main.py" (
  echo ERROR: dieter-local-studio not found beside this file.
  pause
  exit /b 1
)
if not exist "%UI%\package.json" (
  echo ERROR: mureka-clone not found beside this file.
  pause
  exit /b 1
)

echo [1/3] Setting up Python (wait if installing packages^)...
cd /d "%STUDIO%"
if not exist "%PY%" (
  where py >nul 2>&1 && py -3 -m venv .venv
)
if not exist "%PY%" python -m venv .venv
if not exist "%PY%" (
  echo Install Python 3.11+ from python.org — enable "Add to PATH".
  pause
  exit /b 1
)
"%PY%" -m pip install -q -r requirements.txt
if errorlevel 1 "%PY%" -m pip install -r requirements.txt

echo [2/3] Starting API in new window...
start "DIETER-API" "%STUDIO%\_RUN_API_HERE.bat"

timeout /t 4 /nobreak >nul

echo [3/3] Starting web UI in new window...
start "DIETER-UI" "%UI%\_RUN_UI_HERE.bat"

timeout /t 10 /nobreak >nul
start "" "http://127.0.0.1:5173/"
start "" "http://127.0.0.1:8890/api/local/health"

echo.
echo Two windows should have opened. Browser tabs too.
echo Site: Local tab -^> Ping local API
echo.
pause
