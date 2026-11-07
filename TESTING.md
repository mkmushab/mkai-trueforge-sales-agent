# MK-AI Testing & Evaluation Architecture (`TESTING.md`)

MK-AI separates verification into **five distinct test layers** so pipeline plumbing is never confused with agent capability or adversarial security.

## 1. Pipeline Tests (`mkai-backend/tests/test_pipeline_90.py`)
- **What it proves**: The 30-agent registry, policy loader, `MKGatekeeper`, `MKAuditLogger`, `MKSharedTaskBoard`, `MKOutputEngine`, and `MKVerifierEngine` plumbing works across all 30 departments (`30 x 3 = 90` pipeline tasks).
- **What it does NOT claim**: It does not claim open-ended LLM reasoning; it verifies deterministic routing, artifact generation (`PDF`, `PPTX`, `DOCX`, `XLSX`), SHA-256 evidence recording, and hash-chained audit logging with zero test backdoors.
- **Command**:
  ```bash
  python3 mkai-backend/tests/test_pipeline_90.py
  ```

## 2. Capability & Failure-Injection Evals (`mkai-backend/evals/run_capability_evals.py`)
- **What it proves**: Agents solve realistic domain tasks through the `MKAgentExecutionLoop` (`Plan -> Act -> Observe -> Verify -> Critic -> Report`) and pass **hidden outcome rubrics** (checking actual HTML tags/diffs, CSV row/channel distributions, SQL injection neutralization, unit test execution exit codes, 50–75 word multi-speaker dialogue constraints, RIFF/WAVE PCM headers, and visual PDF margin bounds) rather than mere file existence:
  - **15 Flagship Capability Evals**: 5 for Marketing (`MKT-EVAL-01..05`), 5 for Developer (`DEV-EVAL-01..05`), 5 for Video (`VID-EVAL-01..05`).
  - **27 Department Capability Evals**: 1 per remaining department (`DEPT-EVAL-03..30`).
  - **5 Failure-Injection Evals (`FAIL-EVAL-01..05`)**:
    1. Transient tool timeout recovery on retry #2
    2. Website DOM layout change recovery via accessibility tree (`role` + `label`)
    3. Login wall / 2FA challenge detection (pauses and asks Boss; never guesses credentials)
    4. CAPTCHA challenge detection (refuses bypass, pauses and asks Boss)
    5. Persistent API 503 bounded retry halt + duplicate-step infinite-loop detector
- **Real Metrics Persistence**: Stores every run's pass/fail, rubric score, retries, token estimate, cost estimate, and latency in SQLite (`capability_eval_runs`) so dashboards query real runs.
- **Command**:
  ```bash
  python3 mkai-backend/evals/run_capability_evals.py
  ```

## 3. Adversarial Red-Team Security Suite (`mkai-backend/tests/test_redteam_100.py`)
- **What it proves**: Tests `MKGatekeeper` against **115 adversarial attack vectors** across 8 categories (shell AST/pipes/subshells, file path traversal/symlinks/UNC/`.env`, SSRF loopback/cloud metadata/RFC1918/hex-IP, browser high-consequence buttons/password fields/CAPTCHA evasion, reworded destructive/deploy/spend-cap actions, Base64/Hex/URL/Unicode-homoglyph obfuscation, indirect prompt injection/delimiter breakout, and single-use action-bound approval replay/cross-action hijack) plus **10 Gap A `"Golden Task #1"` bypass variants**.
- **Current Block Rate**: **100.0% (`115/115` adversarial cases + `10/10` Gap A variants blocked)**.
- **Command**:
  ```bash
  python3 mkai-backend/tests/test_redteam_100.py
  ```

## 4. Electron ActionGate End-to-End & Code-Scan Suite (`tests/test_action_gate_e2e.mjs`)
- **What it proves**:
  - **Static Code Scan**: Every tool-execution path in `src/main/` (`openclawApprovalController.ts`, `openclawRuntimeAdapter.ts`, `mcpBridgeServer.ts`, `computerUseMcpServer.ts`, `lobsterBrowserMcpServer.ts`, `mcpRuntime.ts`, `imCoworkHandler.ts`, `imScheduledTaskHandler.ts`) imports and registers with `src/main/security/actionGate`.
  - **Live E2E Fake-Tool-Executor Test**: Spawns `mkai-backend/server.py`, connects `ActionGate` over loopback with `X-MKAI-Gate-Secret`, and proves:
    - Safe `AUTO` actions execute
    - `DENY` actions never execute
    - `ASK` actions pause and surface an approval card (`approve_once`, `approve_task`, `reject`)
    - Approval for Action X **cannot** authorize Action Y (`Action mismatch blocked`)
    - Approved Action X executes **exactly once** and blocks replay on a second attempt
    - Rejected actions never execute
    - Kill switch immediately halts execution
    - Unreachable backend **fails closed (`DENY`)**
- **Command**:
  ```bash
  node --test tests/test_action_gate_e2e.mjs
  ```

## 5. Source Secret Scan, Skill Signature Verification & Video Studio Smoke Tests
```bash
python3 scripts/secret_scanner.py
python3 mkai-backend/skill_signer.py
PYTHONPATH=./mkai-video-studio python3 -m unittest discover -s mkai-video-studio/kabirverse_studio/tests -v
```
