@echo off
cd /d "%~dp0"
if not exist ".venv\Scripts\python.exe" (
  echo Run OPEN-DIETER-LOCAL.bat from the parent folder first, or: python -m venv .venv
  pause
  exit /b 1
)
echo Local Studio API: http://127.0.0.1:8890
".venv\Scripts\python.exe" -m uvicorn app.main:app --host 127.0.0.1 --port 8890
pause
