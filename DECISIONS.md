# MK-AI Architectural & Security Decisions (`DECISIONS.md`)

## Round 2 Decisions
1. **Elimination of All Prompt-Prefix Special Cases (Gap A)**:
   - Removed the Round 1 `task_prompt.startswith("Golden Task #")` conditional in `mkai-backend/crew_orchestrator.py`.
   - Replaced coarse bare-word regexes (which previously flagged the noun `"budget"` in benign planning descriptions) with action-verb + structural parameter analysis in `mkai-backend/gatekeeper.py`, allowing all 90 pipeline tasks to pass through the real Gatekeeper with their full, unmodified prompts.
2. **Dual TypeScript + CommonJS Electron ActionGate (`src/main/security/actionGate.ts` & `actionGate.cjs`) (Gap B)**:
   - Created `src/main/security/actionGate.ts` for the TypeScript/Vite build and `src/main/security/actionGate.cjs` so Node.js (`node --test tests/test_action_gate_e2e.mjs`) can execute real end-to-end IPC tests against the live Python `server.py` even in environments without `node_modules`.
   - Aligned canonical JSON serialization (`separators=(",", ":")`, `sort_keys=True`) between Python and Node.js so both compute identical SHA-256 `action_hash` digests.
3. **Single-Use Action-Bound Approvals (`consume_approval`) (Gap B & C)**:
   - Added `action_hash`, `scope_mode`, and `consumed_at` columns to the SQLite `approvals` table.
   - Bound `approval_token = HMAC_SHA256(secret, approval_id + ":" + action_hash)`.
   - Consuming an approval verifies both the HMAC token and `action_hash` equality and atomically transitions `status` from `'approved'` to `'consumed'`, blocking both replay and cross-action parameter tampering.
4. **Multi-Layer Decoding & Homoglyph Normalization Before Classification (Gap C)**:
   - Added NFKC normalization, a Cyrillic/Greek homoglyph translation table, zero-width character stripping, and automatic Base64, Hex, and URL decoding across all concatenated parameters so encoded or split attacks cannot bypass `DENY` or `ASK` rules.
5. **Separation of Pipeline Tests vs. Capability Evals (Gap D)**:
   - Renamed `test_golden_90.py` to `mkai-backend/tests/test_pipeline_90.py` (retaining a backwards-compatible runner in `test_golden_90.py`) and built `mkai-backend/evals/run_capability_evals.py` with 42 rubric-graded capability evals and 5 failure-injection recovery evals backed by `mkai-backend/agent_loop.py` and stored in SQLite (`capability_eval_runs`).
6. **URL Restoration & Opt-In-Only Telemetry (Gap E)**:
   - Restored legitimate public URLs (`https://mkai.tech`, GitHub release URLs, Telegram/Discord developer docs) across `package.json` and `src/`, reserving `http://127.0.0.1:8765` strictly for local MK-AI backend API calls, and set `YoudaoAnalyzer: ''` so zero telemetry is sent.
