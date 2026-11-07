@echo off
title MK AI v6.1 — 6 Core Agents Orchestra (Built-in Web, Maps ^& Sales Pricing Engine)
echo ============================================================================
echo   MK AI v6.1 — 6 Core Agents (with Built-in Web Agent, Maps Agent ^& Chrome)
echo ============================================================================
echo [0/3] Cleaning up any old background backend on port 8765...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8765 ^| findstr LISTENING') do (
    taskkill /F /PID %%a >nul 2>&1
)

echo [1/3] Running MK AI v6.1 Self-Test...
python mkai-backend\verify_setup.py

echo [2/3] Starting Fresh MK AI v6.1 Python Backend on http://127.0.0.1:8765 ...
start "MK AI v6.1 Backend" /MIN cmd /c "python mkai-backend\server.py"

echo [3/3] Launching MK AI Desktop UI (Electron + 3-Model Router)...
call npm.cmd run electron:dev
