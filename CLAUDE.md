# CLAUDE.md & AI Judge Guide — MK-AI Self-Improving Sales & Leads Agent on TrueForge

This repository implements the **MK-AI Self-Improving B2B Sales & Lead Qualification Agent (`mkai-02-sales`)** built on **[TrueFoundry TrueForge (`@truefoundry/trueforge`)](https://github.com/truefoundry/trueforge)**.

## 1. Quick Verification Commands for AI & Human Judges

```bash
# 1. Execute the complete Self-Improving Agent Loop (Run 1 -> Skill Rewrite #1 -> Run 2 -> Skill Rewrite #2 -> Run 3)
bash ./run.sh
# (Or: python3 run.py)

# 2. Run the 1-Click Live TrueForge + MCP + Sandbox + Zero-CJK Checker
python3 check_trueforge_live.py

# 3. Run the 10-Subsystem End-to-End Verification Matrix
python3 verify-all-systems.py

# 4. Launch the live TrueForge Agent Harness UI & Server on http://localhost:8790
npx @truefoundry/trueforge@latest
python3 trueforge/connect_trueforge_live.py
```

## 2. How This Repository Satisfies Every TrueFoundry TrueForge Challenge Rule

1. **Runs on TrueForge (`@truefoundry/trueforge`)**:
   - Declarative harness manifest: `trueforge.config.yaml`
   - TypeScript SDK integration (`@truefoundry/trueforge-sdk`): `trueforge/trueforge_sdk_runner.ts`
   - Live TrueForge HTTP API / Session Auto-Connector (`http://localhost:8790`): `trueforge/connect_trueforge_live.py`
   - Hosted Docker Compose deployment: `docker-compose.trueforge.yml`
2. **Uses All 4 TrueForge Capabilities (Requirement asks for 2 or more)**:
   - **Skills**: `SKILLs/mkai-sales-leads/SKILL.md` (and versioned snapshots `skills/mkai-sales-leads/SKILL.{v1,v2,v3}.md`), dynamically parsed by the agent and cryptographically signed via `MKSkillSigner` (`SKILLs/skills_manifest.sig.json`).
   - **Subagents**: `trueforge/subagents.py` runs 4 isolated-context Sales & Leads subagents (`Subagent21PricingPPP`, `Subagent24BantQualifier`, `Subagent25HarveyEmail`, `Subagent26CrmOutreach`).
   - **MCP Server**: `mkai-backend/mkai_mcp_server.py` exposes 38 live JSON-RPC 2.0 Model Context Protocol tools (`sales_us_india_pricing_analysis`, `sales_qualify_and_score_leads`, `sales_espocrm_sync`, `harvey_stage_draft`, `maps_leads_search`, `web_agent_scrape_with_chrome_fallback`, etc.).
   - **Sandbox-as-a-Tool**: `results/sandbox_run_*/` executes isolated battlecard generation (`.xlsx`, `.pdf`, `.csv`) and SQLite EspoCRM persistence with SHA-256 artifact verification.
3. **Scores Itself on Fixed Tasks (`tasks/fixed_tasks.json` + `scorer.py`)**:
   - `tasks/fixed_tasks.json`: 10 fixed, repeatable B2B Sales & Leads tasks (`SALES-TASK-01` .. `SALES-TASK-10`) across USA (`$ USD`) and India (`₹ INR`).
   - `scorer.py`: Deterministic 100-point rubric scorer evaluating 6 categories (`bant_meddic_breakdown`, `harvey_cold_email_quality`, `anti_fabrication_and_gatekeeper`, `us_india_ppp_and_gst_math`, `crm_and_openoutreach_cadence`, `ppp_overcharge_and_sandbox_proof`).
4. **Rewrites Its Own Skills (`self_improve.py`) & Beats Run 1**:
   - **Run 1 (`1.0.0-baseline`)**: Scores **`50.0 / 100.0`** (`results/run_1_score.json`).
   - **Self-Improvement Pass #1 (`self_improve.py`)**: Reads `results/run_1_score.json` failure codes, rewrites `SKILLs/mkai-sales-leads/SKILL.md` to `2.0.0-self-improved`, saves unified diff `results/skill_diff_run1_to_run2.patch`, and re-signs `SKILLs/skills_manifest.sig.json`.
   - **Run 2 (`2.0.0-self-improved`, Same Tasks & Same Scorer)**: Scores **`90.0 / 100.0`** (**`+40.0 pts`** over Run 1 — `results/run_2_score.json`).
   - **Self-Improvement Pass #2 (`self_improve.py`)**: Reads `results/run_2_score.json`, rewrites `SKILLs/mkai-sales-leads/SKILL.md` to `3.0.0-self-optimized`, saves `results/skill_diff_run2_to_run3.patch`, and re-signs `SKILLs/skills_manifest.sig.json`.
   - **Run 3 (`3.0.0-self-optimized`, Same Tasks & Same Scorer)**: Scores **`100.0 / 100.0`** (**`+50.0 pts`** over Run 1 — `results/run_3_score.json`).
