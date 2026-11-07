#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
echo "Next: put your NEW keys in .env, then: bash doctor_unix.sh  and  bash run_once_unix.sh"
