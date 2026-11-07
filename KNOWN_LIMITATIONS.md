# MK-AI Known Limitations (`KNOWN_LIMITATIONS.md`)

In accordance with Operating Rules #3 and #4 ("No fake completion" and "Honest labeling"), this document states clearly what is tested and verified in this environment versus what requires external credentials, network access, or host OS binaries:

## 1. Connector Status Matrix (`SANDBOX-TESTED` vs `LIVE-TESTED`)

| Connector ID | Target Platform / Software | Status | Notes |
| :--- | :--- | :--- | :--- |
| `vscode_editor` | Local Workspace Files & Diff Engine | `LIVE-TESTED` | Tested end-to-end on real files in `flagship_agents.py` and `run_capability_evals.py`. |
| `git_cli` | Local Git Init / Branch / Diff + Gated Push | `SANDBOX-TESTED` | Local operations + Gatekeeper `ASK` on `main` push/merge verified in `test_action_gate_e2e.mjs`. |
| `india_gst_compliance` | India GST (`CGST`/`SGST`/`IGST`, HSN/SAC, `GSTR-1` JSON) | `LIVE-TESTED` | Deterministic tax calculation and `GSTR-1` payload verified in `test_pipeline_90.py`. |
| `postman_openapi` | OpenAPI 3.1 Contract Validator | `LIVE-TESTED` | Verified in `DEV-EVAL-04` (`run_capability_evals.py`). |
| `github_api` | GitHub Pull Requests, Branches, Issues | `SANDBOX-TESTED` | Gatekeeper `ASK` and token handle injection verified; live GitHub REST calls require `GITHUB_TOKEN` and internet access. |
| `google_workspace` | Gmail Draft/Send, Calendar, Drive/Docs/Sheets | `SANDBOX-TESTED` | Draft (`AUTO`) vs external send (`ASK`) verified; live OAuth calls require user Google OAuth credentials. |
| `youtube_data_api` | YouTube Analytics & Gated Video Upload | `SANDBOX-TESTED` | Gated upload (`VID-EVAL-05`) verified; live uploads require YouTube OAuth token. |
| `search_console_ga4` | Google Search Console & GA4 Analytics | `SANDBOX-TESTED` | Read connector and schema verified in sandbox; live queries require Google OAuth token. |
| `ads_manager` | Meta Ads & Google Ads (with Daily Spend Cap) | `SANDBOX-TESTED` | Daily spend cap (`max_daily_spend_inr`) and `ASK` gate verified (`RW-11..14`); live mutations require Ads API tokens. |
| `messaging_bus` | Slack, Telegram, Discord, WhatsApp Cloud API | `SANDBOX-TESTED` | Outbound broadcast `ASK` gate verified; live delivery requires bot/webhook tokens. |
| `razorpay_shopify` | Razorpay Payment Links/Refunds & Shopify Orders | `SANDBOX-TESTED` | Refund/payout `ASK` gate verified; live API calls require merchant keys. |

## 2. Environment & Build Boundaries
1. **Air-Gapped Sandbox VM Network Boundary**:
   - Outbound internet access is disabled in the test VM (`registry.npmjs.org` and `api.generalcompute.com` are unreachable).
   - Consequently, live LLM calls to `api.generalcompute.com` return HTTP `502` offline, and `npm install` cannot download `node_modules` (`tsc`, `vite`, `vitest`, `eslint`, `electron-builder`) inside the air-gapped VM.
   - To verify the JavaScript/Electron security layer with real execution inside the VM, `src/main/security/actionGate.cjs` and `tests/test_action_gate_e2e.mjs` use Node.js built-in modules (`node:test`, `node:crypto`, `node:http`, `fetch`) and run directly via `node --test tests/test_action_gate_e2e.mjs` against the live Python Gatekeeper server.
2. **Desktop Computer Use OS Support**:
   - Built-in native desktop automation helper (`computerUseMcpServer.ts`) targets Windows (`process.platform === 'win32'`) and returns `null` cleanly on macOS/Linux while browser and workspace file/shell tools operate cross-platform across Windows, macOS, and Linux.
