#!/usr/bin/env bash
set -euo pipefail
echo "============================================================================"
echo "  MK-AI x TRUEFORGE - SELF-IMPROVING SALES AGENT + TRUEFORGE UI LAUNCHER"
echo "============================================================================"
python3 run.py
python3 mkai-backend/server.py &
export OUTBOUND_URL_ALLOWED_HOSTS='["127.0.0.1","localhost","api.generalcompute.com"]'
export OUTBOUND_URL_ALLOW_HTTP=true
export OUTBOUND_URL_ALLOW_PRIVATE_NETWORK=true
npx @truefoundry/trueforge@latest
