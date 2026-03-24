@echo off
cd /d "%~dp0"
if not exist "node_modules" call npm install
echo Web UI: http://127.0.0.1:5173
npm run dev -- --host 127.0.0.1 --port 5173
pause
