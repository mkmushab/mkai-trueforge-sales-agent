#!/usr/bin/env bash
cd "$(dirname "$0")" && source .venv/bin/activate && python scheduler_24x7.py --now --kind long "$@"
