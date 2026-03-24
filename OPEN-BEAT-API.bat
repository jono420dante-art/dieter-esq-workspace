@echo off
title DIETER Beat API (FastAPI)
cd /d "%~dp0"
echo.
echo === Beat API (port 8000) ===
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0START-BEAT-API.ps1"
if errorlevel 1 pause
