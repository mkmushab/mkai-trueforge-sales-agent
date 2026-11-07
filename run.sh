#!/usr/bin/env bash
set -euo pipefail

# TrueForge Self-Improving Sales & Leads Agent — Starter Run Script (run.sh)
# Runs Run 1 (Baseline SKILL.md) -> Self-Improvement Skill Rewrite -> Run 2 -> Self-Improvement Pass 2 -> Run 3
# Uses the exact same fixed tasks (tasks/fixed_tasks.json) and deterministic scorer (scorer.py).

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

python3 run.py
