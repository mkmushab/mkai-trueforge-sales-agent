# MK-AI Round 2 — Baseline Verification Report (`reports/BASELINE_ROUND2.md`)

Recorded prior to Round 2 code changes per Section 1 of the Round 2 prompt.

## 1. Secret Scanner (`python3 scripts/secret_scanner.py`)
```text
========================================================================
  MK-AI SOURCE CODE SECRET SCANNER
========================================================================
[PASS] 0 hardcoded secrets detected across all source files.
```

## 2. Round 1 Golden Suite (`python3 mkai-backend/tests/test_golden_90.py`)
```text
test_01_secret_scanner_zero_leaks (__main__.TestMKAIMasterUpgrade.test_01_secret_scanner_zero_leaks) ... ok
test_02_specs_and_policies_for_all_30_agents (__main__.TestMKAIMasterUpgrade.test_02_specs_and_policies_for_all_30_agents) ... ok
test_03_gatekeeper_blocks_reworded_destructive_and_forged_approval (__main__.TestMKAIMasterUpgrade.test_03_gatekeeper_blocks_reworded_destructive_and_forged_approval) ... ok
test_04_prompt_injection_defense (__main__.TestMKAIMasterUpgrade.test_04_prompt_injection_defense) ... ok
test_05_hash_chained_audit_log_and_tamper_detection (__main__.TestMKAIMasterUpgrade.test_05_hash_chained_audit_log_and_tamper_detection) ... ok
test_06_multi_agent_launch_small_website_handoff (__main__.TestMKAIMasterUpgrade.test_06_multi_agent_launch_small_website_handoff) ... ok
test_07_flagship_marketing_agent_end_to_end (__main__.TestMKAIMasterUpgrade.test_07_flagship_marketing_agent_end_to_end) ... ok
test_08_flagship_developer_agent_end_to_end (__main__.TestMKAIMasterUpgrade.test_08_flagship_developer_agent_end_to_end) ... ok
test_08b_connectors_gst_vault_and_self_learning_guard (__main__.TestMKAIMasterUpgrade.test_08b_connectors_gst_vault_and_self_learning_guard) ... ok
test_09_all_90_golden_tasks_across_30_agents (__main__.TestMKAIMasterUpgrade.test_09_all_90_golden_tasks_across_30_agents) ... ok

----------------------------------------------------------------------
Ran 10 tests in 2.585s

OK
```

## 3. Backend Setup Verifier (`python3 mkai-backend/verify_setup.py --offline-only`)
```text
============================================================================
  MK AI — 30-AGENT DUAL-BRAIN PLATFORM & SECURITY VERIFICATION SUITE
============================================================================
[PASS] 1. Registry verified: 30 Main Agents & 201 Sub-Agents loaded.
[PASS] 2. All 30 MK AI Department Skill Packs verified in SKILLs/ directory.
[PASS] 3. SQLite Approval Gate (#9.6) verified: blocked 'push live to production and wipe the database', rejected client bypass & bad token, and persisted mkai-apr-1ddab30acbdc across restart.
[PASS] 4. Electron <-> Python Dual-Brain Backend bridge (/api/v1/execute on port 8765) verified.
[PASS] 5. All 5 production n8n workflows verified (10 nodes each with HMAC, Dual-Brain & Approval Gate).
[PASS] 6. Hands-on Website SEO Fixer & India GST Engine verified.
[WARN] 7. Live LLM Connectivity: OFFLINE / NETWORK BLOCKED (Upstream LLM Unreachable (gemma-4-31B-it): <urlopen error [Errno -3] Temporary failure in name resolution>)
============================================================================
  STATUS: LOCAL ARCHITECTURE & SECURITY GATES 100% VERIFIED (LLM REQUIRES INTERNET)
============================================================================
```

## 4. Video Studio Smoke Suite (`kabirverse_studio/tests/test_smoke.py`)
```text
Ran 24 tests in 14.719s

OK
```

## 5. Electron App Baseline (`npm install`, `tsc`, `lint`, `vitest`, `build`)
- **Environment Inspection**:
  - Node.js version: `v18.20.4` (`npm 9.2.0`)
  - `node_modules/` is omitted from the project zip archive, and outbound network access is disabled inside the sandbox VM (`registry.npmjs.org` unreachable), so `npm install` cannot fetch remote npm packages (`typescript`, `vite`, `vitest`, `eslint`, `electron-builder`):
    ```text
    > mkai@1.0.0 compile:electron
    > tsc --project electron-tsconfig.json
    sh: 1: tsc: not found
    ```
- **Pre-Existing Issues Identified for Round 2 Fix**:
  1. **Gap A**: `mkai-backend/crew_orchestrator.py` line 255 blanks `task_prompt` when `task_prompt.startswith("Golden Task #")`.
  2. **Gap B**: Electron tool execution paths (`openclawRuntimeAdapter.ts`, `openclawApprovalController.ts`, `src/main/computerUse/*`, `lobsterBrowserMcpServer.ts`, `src/main/mcp/*`) do not pass through a single fail-closed `ActionGate` bound to exact action hashes.
  3. **Gap C**: `gatekeeper.py` relies primarily on regex over prompts rather than structured shell AST/token parsing, canonical path resolution, browser domain/selector/button analysis, and SSRF IP-range blocking.
  4. **Gap D**: `test_golden_90.py` tests file-generation plumbing rather than LLM-driven capability evals and failure-injection recovery.
  5. **Gap E**: ~60 external URLs in `src/` and `package.json` were replaced with `http://127.0.0.1:8765` during Round 1 URL scrubbing, and unused Chinese IM/provider entries (`qwen`, `moonshot`, `qianfan`, `stepfun`, `zai`, `xiaomi`, `dingtalk`, `feishu`, `wecom`, `qq`, `weixin`) remain enabled by default.
