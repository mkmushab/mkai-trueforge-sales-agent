@echo off
echo ============================================================================
echo   MK-AI x TRUEFORGE - SELF-IMPROVING SALES AGENT + TRUEFORGE UI LAUNCHER
echo ============================================================================
echo [1/3] Running Self-Improving Sales Agent Benchmark (Run 1 -> Run 2 -> Run 3)...
python run.py

echo.
echo [2/3] Starting MK-AI Local OpenAI-Compatible Sales Router on http://127.0.0.1:8765/v1 ...
start "MK-AI Sales Router" cmd /c "python mkai-backend/server.py"

echo.
echo [3/3] Starting TrueForge Harness on http://localhost:8790 with Outbound Host Allowlist...
set OUTBOUND_URL_ALLOWED_HOSTS=["127.0.0.1","localhost","api.generalcompute.com"]
set OUTBOUND_URL_ALLOW_HTTP=true
set OUTBOUND_URL_ALLOW_PRIVATE_NETWORK=true
npx @truefoundry/trueforge@latest
