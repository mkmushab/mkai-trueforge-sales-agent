# MK-AI Pre-Upgrade Baseline Report (`reports/BASELINE.md`)

## 1. Baseline Test Execution (Before Master Upgrade)

### 1.1 Backend Verification Suite (`python3 mkai-backend/verify_setup.py`)
```text
============================================================================
  MK AI — 30-AGENT DUAL-BRAIN PLATFORM & SECURITY VERIFICATION SUITE
============================================================================
[PASS] 1. Registry verified: 30 Main Agents & 201 Sub-Agents loaded.
[PASS] 2. All 30 MK AI Department Skill Packs verified in SKILLs/ directory.
[PASS] 3. SQLite Approval Gate (#9.6) verified: blocked 'push live to production and wipe the database', rejected client bypass & bad token, and persisted mkai-apr-3e16283aaf9f across restart.
[PASS] 4. Electron <-> Python Dual-Brain Backend bridge (/api/v1/execute on port 8765) verified.
[PASS] 5. All 5 production n8n workflows verified (10 nodes each with HMAC, Dual-Brain & Approval Gate).
[PASS] 6. Hands-on Website SEO Fixer & India GST Engine verified.
[WARN] 7. Live LLM Connectivity: OFFLINE / NETWORK BLOCKED
============================================================================
  STATUS: LOCAL ARCHITECTURE & SECURITY GATES 100% VERIFIED (LLM REQUIRES INTERNET)
============================================================================
```

### 1.2 Autonomous Video Studio Smoke Suite (`python3 -m unittest discover -s mkai-video-studio/kabirverse_studio/tests -v`)
```text
test_1000_character_pool_and_cast_sizes ... ok
test_all_10_backgrounds_render ... ok
test_all_10_meme_cards_and_default_assets ... ok
test_auto_clip_highlight_selector ... ok
test_bleep_marking ... ok
test_daily_plan_is_3_shorts_plus_1_long ... ok
test_demo_plans ... ok
test_dialogue_council_short_and_long ... ok
test_dialogue_validation_rejects_single_speaker ... ok
test_dialogue_voice_offline ... ok
test_every_core_and_sampled_character_draws_every_expression ... ok
test_helpers ... ok
test_long_council ... ok
test_offline_voice ... ok
test_parse_dialogue_and_custom_script_mode3 ... ok
test_rejected_key_raises ... ok
test_scripts_have_right_length ... ok
test_short_council ... ok
test_slots_and_layout_up_to_6_characters ... ok
test_spice_levels ... ok
test_timing_windows_and_layouts ... ok
test_voice_fit_adjusts_speed ... ok
test_wrong_length_script_is_rejected_per_kind ... ok
test_youtube_clone_setup_matcher_mode4 ... ok
----------------------------------------------------------------------
Ran 24 tests in 17.079s — OK
```

## 2. Baseline Audit Findings Addressed in This Upgrade
1. **Root Stub/Patch Scripts**: `upgrade_all_30_hands.py` (3-line stub), `upgrade_mkai_ultimate.py`, and `upgrade_super_swarm.py` existed at the project root. Removed and folded cleanly into source modules.
2. **Hardcoded Fallback Tokens**: 5 source files contained fallback `gc_...` tokens alongside `.env` lookups. Removed all hardcoded tokens from source files so keys reside exclusively in `.env` / `SecretsVault`.
3. **Prompt-Level vs Action-Level Gatekeeper**: Previous gatekeeper checked regexes on prompt text. Upgraded to a full Action-Level Gatekeeper (`mkai-backend/gatekeeper.py`) intercepting shell, file, git, browser, HTTP, email, ads, and cloud tool calls with per-agent least-privilege policy files (`mkai-backend/policies/*.json`), hash-chained audit logging (`mkai-backend/audit_log.py`), and prompt-injection defense.
4. **Shared State & Specialist Execution**: Upgraded the 30 agents and 201 sub-roles with validated job specifications (`mkai-backend/specs/agents_specs.json`), a SQLite Shared Task Board & Inter-Agent Message Bus (`mkai-backend/task_board.py`), task verifiers with cryptographic file-hash evidence, and 90 automated end-to-end golden tests (`tests/test_golden_90.py`).
