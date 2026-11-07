# MK-AI Setup, Run & Verification Guide (`SETUP.md`)

## 1. Prerequisites
- **Python**: Python 3.10+ (standard library only required for core backend, Gatekeeper, Audit Log, TaskBoard, Output Engine, and all verification suites)
- **Node.js** (for Electron Desktop UI): Node.js 20+ or 22+ and npm 10+

## 2. Environment Configuration
1. Copy `.env.example` to `.env` (or inspect the included `.env` in the root and `mkai-backend/.env`).
2. Configure your model router keys in `.env`:
   ```env
   MK_BASE_URL=https://api.generalcompute.com/v1
   MK_MAIN_API_KEY=your_main_key_here
   MK_HEAVY_API_KEY=your_heavy_key_here
   MK_FAST_API_KEY=your_fast_key_here
   MK_APPROVAL_SECRET=your_hmac_approval_secret
   ```

## 3. Running the Verification & Test Suites
Run all four verification suites from the project root:

```bash
# 1. Source Code Secret Scanner (verifies 0 hardcoded API keys in source files)
python3 scripts/secret_scanner.py

# 2. Master Upgrade Test Suite (9 Acceptance Criteria + 90 Golden Tasks across all 30 Agents)
python3 mkai-backend/tests/test_golden_90.py

# 3. Dual-Brain Backend & Security Gate Setup Verifier
python3 mkai-backend/verify_setup.py --offline-only

# 4. Flagship Video Studio (KabirVerse) 24-Test Smoke Suite
PYTHONPATH=./mkai-video-studio python3 -m unittest discover -s mkai-video-studio/kabirverse_studio/tests -v
```

## 4. Starting the Unified Dual-Brain Backend Server
```bash
python3 mkai-backend/server.py
```
The server listens on `http://127.0.0.1:8765` and exposes:
- `GET http://127.0.0.1:8765/health` — System status, pending approvals count, and SHA-256 audit chain status
- `GET http://127.0.0.1:8765/api/v1/agents` — Full 30-Agent & 201-Sub-Agent registry + TaskBoard success-rate metrics
- `GET http://127.0.0.1:8765/api/v1/audit/verify` — Verifies the cryptographic SHA-256 audit log chain
- `GET http://127.0.0.1:8765/api/v1/taskboard/metrics` — Per-agent task completion and verifier pass rates
- `POST http://127.0.0.1:8765/api/v1/flagship/marketing` — Runs the Flagship #1 Marketing Agent end-to-end flow
- `POST http://127.0.0.1:8765/api/v1/flagship/developer` — Runs the Flagship #2 Developer Agent end-to-end flow
- `POST http://127.0.0.1:8765/api/v1/workflows/launch-website` — Runs the 5-Department `"Launch a small website"` handoff

## 5. Starting the Electron Desktop App
```bash
npm install
npm run electron:dev
```
On Windows PowerShell:
```powershell
.\start-mkai.bat
```
