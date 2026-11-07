#!/usr/bin/env bash
set -e
echo "=========================================================="
echo "  Starting MK AI v6.1 — 6 Core Agents Orchestra"
echo "=========================================================="

# 0. Kill any stale backend process on port 8765
fuser -k 8765/tcp 2>/dev/null || true

# 1. Start MK AI Dual-Brain Python Backend in background
python3 mkai-backend/server.py &
BACKEND_PID=$!
echo "[MK AI v6.1] Backend started (PID: $BACKEND_PID) on http://127.0.0.1:8765"

# 2. Launch MK AI Electron Desktop Application
trap "kill $BACKEND_PID 2>/dev/null || true" EXIT
npm run electron:dev
