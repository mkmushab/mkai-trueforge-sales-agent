#!/usr/bin/env bash
# Setup script for cloning/updating upstream open-source engines on a machine with internet access.
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
echo "[MK-AI] Setting up Phase 1 Open-Source Engines in $ROOT_DIR/engines ..."

# Verify local adapters and health checks
python3 "$ROOT_DIR/engines/engine_registry.py"
echo "[MK-AI] Phase 1 engine adapters verified. To start Docker-backed services (gosom Maps Scraper & Firecrawl), run:"
echo "  docker compose up -d"
