# Phase 0 Report — Safety, Cleanup & Honest Baseline

## 1. Phase 0 Plan (12 Lines) & Files Touched
1. Read `CLAUDE.md`, `AGENTS.md`, `ARCHITECTURE.md`, `KNOWN_LIMITATIONS.md`, `SECURITY.md`, and `README_TINYFISH_INTEGRATION.md`.
2. Scrub all hardcoded secrets from `.env.example`, delete committed `.env` files (`.env`, `mkai-backend/.env`), and scrub all 21 `pages/*.jsx` files (`docs/mkai-web-pages/`).
3. Upgrade `scripts/secret_scanner.py` and add executable `scripts/secret_scan` wired into `.husky/pre-commit`, `.github/workflows/ci.yml`, and `.github/workflows/security.yml`.
4. Disable fake deterministic fallbacks in `mkai-backend/tinyfish_bridge.py`, `mkai-backend/omni_orchestra.py`, `mkai-backend/crew_orchestrator.py`, and `src/main/libs/agentEngine/openclawRuntimeAdapter.ts`.
5. Enforce structured error responses `{ ok: false, error, hint }` when a service or API key is unreachable.
6. Gate all demo data strictly behind `MKAI_DEMO_MODE=1` and render a visible `DEMO DATA (MKAI_DEMO_MODE=1)` badge (`src/renderer/components/common/DemoDataBadge.tsx`).
7. Separate "Models" from "Services": filter non-LLM services out of `src/renderer/store/slices/modelSlice.ts` and `src/main/sqliteStore.ts`, and move TinyFish to `src/renderer/data/mcpRegistry.json` (`https://agent.tinyfish.ai/mcp`, HTTP transport).
8. Create `verify-all-systems.py` and update `README.md` and `mkai-backend/verify_setup.py` to replace marketing superlatives with a real `LIVE-TESTED` / `SANDBOX-TESTED` / `NOT-TESTED` status matrix.

## 2. Files That Contained Exposed Keys (File Names Only — Zero Values Printed)
All plain-text keys found in the uploaded repository and archives were removed or replaced with placeholders (`YOUR_API_KEY_PLACEHOLDER` / `your_*_key_here`). Rotate all keys that previously appeared in these files:
- `.env` (deleted from repository working tree; `.gitignore` enforced)
- `.env.example` (scrubbed; replaced with placeholders only)
- `mkai-backend/.env` (deleted from repository working tree)
- `uploaded:.env` (user-uploaded `.env` containing `MK_MAIN_API_KEY`, `MK_HEAVY_API_KEY`, `MK_FAST_API_KEY`, `TINYFISH_API_KEY`)
- `README_TINYFISH_INTEGRATION.md` (created clean with placeholder-only documentation)
- `pages/AuraTransform.jsx` (scrubbed in `docs/mkai-web-pages/AuraTransform.jsx`)
- `pages/BurnoutPredictor.jsx` (scrubbed in `docs/mkai-web-pages/BurnoutPredictor.jsx`)
- `pages/Chat.jsx` (scrubbed in `docs/mkai-web-pages/Chat.jsx`)
- `pages/DataStructurer.jsx` (scrubbed in `docs/mkai-web-pages/DataStructurer.jsx`)
- `pages/Entrepreneur Hub.jsx` (scrubbed in `docs/mkai-web-pages/Entrepreneur Hub.jsx`)
- `pages/Grammar.jsx` (scrubbed in `docs/mkai-web-pages/Grammar.jsx`)
- `pages/Image.jsx` (scrubbed in `docs/mkai-web-pages/Image.jsx`)
- `pages/KaushalAI.jsx` (scrubbed in `docs/mkai-web-pages/KaushalAI.jsx`)
- `pages/Margdarshak.jsx` (scrubbed in `docs/mkai-web-pages/Margdarshak.jsx`)
- `pages/Meeting.jsx` (scrubbed in `docs/mkai-web-pages/Meeting.jsx`)
- `pages/PDF.jsx` (scrubbed in `docs/mkai-web-pages/PDF.jsx`)
- `pages/PPT.jsx` (scrubbed in `docs/mkai-web-pages/PPT.jsx`)
- `pages/Prompt.jsx` (scrubbed in `docs/mkai-web-pages/Prompt.jsx`)
- `pages/Resume.jsx` (scrubbed in `docs/mkai-web-pages/Resume.jsx`)
- `pages/RiskPredictor.jsx` (scrubbed in `docs/mkai-web-pages/RiskPredictor.jsx`)
- `pages/SchemeFinder.jsx` (scrubbed in `docs/mkai-web-pages/SchemeFinder.jsx`)
- `pages/Search.jsx` (scrubbed in `docs/mkai-web-pages/Search.jsx`)
- `pages/Social.jsx` (scrubbed in `docs/mkai-web-pages/Social.jsx`)
- `pages/Study.jsx` (scrubbed in `docs/mkai-web-pages/Study.jsx`)
- `pages/WebScraping.jsx` (scrubbed in `docs/mkai-web-pages/WebScraping.jsx`)
- `pages/YouTube.jsx` (scrubbed in `docs/mkai-web-pages/YouTube.jsx`)

## 3. Done (Files Added / Modified)
- `.env.example` — Replaced exposed API keys with safe placeholders and added `TINYFISH_*` and `MKAI_DEMO_MODE=0` settings.
- `scripts/secret_scanner.py` & `scripts/secret_scan` — Expanded regex coverage (`gc_*`, `sk-*`, `gsk_*`, `cohere_*`, `AQ.*`, `AIza*`, `ghp_*`, `github_pat_*`, `sk-ant-*`, `fc-*`, `tvly-*`, `AKIA*`, `xox*`, PEM private keys) across `.md`, `.env.example`, `.jsx`, `.ts`, `.tsx`, `.py`, `.json`, `.yml`, `.sh`.
- `.husky/pre-commit`, `.github/workflows/ci.yml`, `.github/workflows/security.yml` — Wired `./scripts/secret_scan` into pre-commit and CI.
- `README_TINYFISH_INTEGRATION.md` — Documented TinyFish HTTP MCP connector (`https://agent.tinyfish.ai/mcp`) with zero plain-text keys.
- `mkai-backend/tinyfish_bridge.py` & `mkai-backend/omni_orchestra.py` — Implemented zero-fake-fallback adapters returning `{ ok: false, error, hint }` when unreachable or unauthenticated, and gating demo data strictly behind `MKAI_DEMO_MODE=1`.
- `mkai-backend/crew_orchestrator.py` & `mkai-backend/server.py` — Added structured error responses and exposed `demo_mode` / `badge` on `/health`.
- `src/main/libs/agentEngine/openclawRuntimeAdapter.ts` — Disabled automatic fake template generation on LLM failure and gated demo sub-agent files behind `MKAI_DEMO_MODE=1`.
- `src/renderer/components/common/DemoDataBadge.tsx` & `src/renderer/components/cowork/CoworkView.tsx` — Added visible `DEMO DATA (MKAI_DEMO_MODE=1)` badge and structured service error alert banner.
- `src/renderer/store/slices/modelSlice.ts`, `src/main/sqliteStore.ts`, `src/renderer/data/mcpRegistry.json` — Separated Models from Services (`isNonLlmServiceEntry`), purged TinyFish from Model Picker, and registered TinyFish under Connectors (`transportType: "http"`, `url: "https://agent.tinyfish.ai/mcp"`).
- `verify-all-systems.py`, `mkai-backend/verify_setup.py`, `README.md`, `package.json` — Added real status matrix generator (`LIVE-TESTED` / `SANDBOX-TESTED` / `NOT-TESTED`).
- `docs/mkai-web-pages/*.jsx` — Stored the 28 secret-scrubbed `mkai.tech` reference pages (including `PDF.jsx`, `PPT.jsx`, `WebScraping.jsx`, `Search.jsx`).

## 4. Status Matrix (`verify-all-systems.py`)

| Feature / Subsystem | Status | Proof / Verification Output |
| :--- | :--- | :--- |
| Secret Scanner (`scripts/secret_scan`) | `SANDBOX-TESTED` | `scripts/secret_scan` exited 0 (0 hardcoded secrets across repo) |
| Gatekeeper, 30-Agent Registry & SHA-256 Audit Chain | `SANDBOX-TESTED` | 30 departments & 201 sub-agents loaded; Gatekeeper blocked destructive prompt & forged token; SHA-256 audit chain verified (5 entries) |
| Electron ActionGate E2E (`tests/test_action_gate_e2e.mjs`) | `SANDBOX-TESTED` | `node --test tests/test_action_gate_e2e.mjs` passed (2/2 suites, fail-closed + replay blocked) |
| No Fake Fallbacks (`tinyfish_bridge.py`, `omni_orchestra.py`) | `SANDBOX-TESTED` | `tinyfish_bridge.py` and `omni_orchestra.py` returned `{ok: False, error, hint}` with 0 invented leads when keys/services are absent |
| Model Picker vs. Services Separation (TinyFish -> Connectors) | `SANDBOX-TESTED` | `ModelSelector`/`modelSlice` filters non-LLM services; TinyFish registered as HTTP MCP connector in `mcpRegistry.json` |
| Local SEO HTML Patcher & India GST Engine | `SANDBOX-TESTED` | Local HTML SEO patcher + India GST calculator (CGST/SGST/IGST) verified on real files |
| HMAC-SHA256 Skill Pack Signatures (59 skills) | `SANDBOX-TESTED` | Verified 59 signed skill packs in `SKILLs/skills_manifest.sig.json` |
| Live LLM Multi-Model Router (`api.generalcompute.com`) | `NOT-TESTED` | Outbound network disabled in air-gapped sandbox VM (`<urlopen error [Errno -3] Temporary failure in name resolution>`) |
| TinyFish Live Web-Agent MCP (`agent.tinyfish.ai`) | `NOT-TESTED` | `TINYFISH_API_KEY` not configured in repo `.env` and outbound network disabled in sandbox VM |
| Electron Full Bundler (`npm ci && npm run build`) | `NOT-TESTED` | `node_modules` not present in archive and outbound npm registry is unreachable in air-gapped VM |
| Phase 1 Open-Source Engines (`harvey`, `firecrawl`, `gosom`, `agent-reach`, `archify`) | `NOT-TESTED` | Scheduled for Phase 1 engine layer installation |
