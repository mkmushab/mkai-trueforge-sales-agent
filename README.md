# MK-AI TrueForge — Self-Improving B2B Sales & Lead Qualification Agent (`mkai-02-sales`)

**MK-AI TrueForge** is a self-improving B2B Revenue, Sales & Lead Qualification Agent built on [**TrueFoundry TrueForge (`@truefoundry/trueforge`)**](https://github.com/truefoundry/trueforge) — the open-source agent harness that turns LLMs into production-grade agents with **Skills**, **Subagents**, **MCP Servers**, and **Sandbox-as-a-Tool**.

Built for a real, repeatable B2B revenue operation, the agent qualifies inbound and outbound prospects across **USA (`$ USD`)** and **India (`₹ INR`)**, calculates Purchasing Power Parity (PPP) and **18% India GST (`HSN 998314`)** commercial quotes, stages **`<75-word` signal-driven cold emails** via [Harvey (`ethanplusai/harvey`)](https://github.com/ethanplusai/harvey), enforces strict anti-fabrication guardrails on missing emails, and syncs 3-step LinkedIn + Gmail cadences ([OpenOutreach (`eracle/OpenOutreach`)](https://github.com/eracle/OpenOutreach)) into [EspoCRM (`espocrm/espocrm`)](https://github.com/espocrm/espocrm).

Most importantly, **the agent scores itself on a fixed 10-task benchmark (`tasks/fixed_tasks.json`) using a deterministic 100-point rubric scorer (`scorer.py`), diagnoses its own rubric deductions, rewrites its own `SKILL.md` (`self_improve.py`), re-signs its cryptographic skill manifest, and jumps from `50.0 / 100` on Run 1 to `90.0 / 100` on Run 2 (`+40.0 pts`) and `100.0 / 100` on Run 3 (`+50.0 pts`) on the exact same tasks and scorer.**

## 1. TrueFoundry TrueForge Challenge Verification Checklist ("DONE WHEN")

| Challenge Requirement | Status | Implementation & Verification Proof in This Repo | 
| ----- | ----- | ----- | 
| **1. Public Repo Running on TrueForge** | **VERIFIED** | Configured via `trueforge.config.yaml`, `trueforge/trueforge_sdk_runner.ts` (`@truefoundry/trueforge-sdk`), `docker-compose.trueforge.yml`, and `npx @truefoundry/trueforge@latest` (`http://localhost:8790`). | 
| **2. Uses 2+ of Skills, Subagents, MCP & Sandbox** | **ALL 4 USED** | Uses **all 4 TrueForge capabilities**: (1) Git-backed self-rewriting **Skills** (`SKILLs/mkai-sales-leads/SKILL.md`), (2) 4 parallel **Subagents** (`trueforge/subagents.py`), (3) JSON-RPC 2.0 **MCP Server** (`mkai-backend/mkai_mcp_server.py` with 36 tools), and (4) **Sandbox** execution (`results/sandbox_run_*/` generating verified `.xlsx`, `.pdf`, `.csv` battlecards with SHA-256 digests). | 
| **3. Repeatable Real Job & Fixed Tasks** | **VERIFIED** | `tasks/fixed_tasks.json` defines 10 fixed, repeatable B2B Sales & Leads tasks (`SALES-TASK-01` .. `SALES-TASK-10`) spanning USA (`$ USD`) & India (`₹ INR`) SaaS, healthcare, logistics, fintech, and manufacturing leads. | 
| **4. Run 1 Score on Fixed Tasks** | **VERIFIED (`50.0 / 100`)** | `scorer.py` evaluates Run 1 (`1.0.0-baseline` `SKILL.md`) across 6 deterministic rubrics and writes `results/run_1_score.json` (**`50.0 / 100.0`**). | 
| **5. Rewrites Its Own Skills (`SKILL.md`)** | **VERIFIED** | `self_improve.py` inspects `results/run_1_score.json` failure codes, rewrites `SKILLs/mkai-sales-leads/SKILL.md` (`v1.0.0-baseline` -> `v2.0.0-self-improved` -> `v3.0.0-self-optimized`), writes unified diffs (`results/skill_diff_run1_to_run2.patch`, `results/skill_diff_run2_to_run3.patch`), and re-signs `SKILLs/skills_manifest.sig.json` with HMAC-SHA256. | 
| **6. Later Run Beats Run 1 (Same Tasks & Scorer)** | **VERIFIED (`90.0` & `100.0 / 100`)** | Evaluated by the exact same `scorer.py` on the exact same `tasks/fixed_tasks.json`: **Run 2 scores `90.0 / 100` (`+40.0 pts` vs. Run 1)** and **Run 3 scores `100.0 / 100` (`+50.0 pts` vs. Run 1)**. | 

## 2. One-Command Quickstart (Judge Reproduction in <15 Seconds)

```
# 1. Clone the repository
git clone https://github.com/mkmushab/mkai-trueforge-sales-agent.git
cd mkai-trueforge-sales-agent

# 2. Run the starter script (Executes Run 1 -> Skill Rewrite #1 -> Run 2 -> Skill Rewrite #2 -> Run 3)
bash ./run.sh
# (Or equivalently: python3 run.py)

# 3. Run the full 9-subsystem verification matrix (Secret scan, MCP linter, HMAC skill signatures, E2E + TrueForge loop)
python3 verify-all-systems.py

```

### Optional: Launch with Live TrueForge UI & Server (`localhost:8790`)

```
# Option A: 1-Click TrueForge Launcher (Starts Self-Improving Loop + npx @truefoundry/trueforge@latest on localhost:8790)
# On Windows:
start-trueforge.bat
# On Mac/Linux:
bash ./start-trueforge.sh

# Option B: Connect directly to a running npx @truefoundry/trueforge@latest instance (http://localhost:8790)
npx @truefoundry/trueforge@latest
python3 trueforge/connect_trueforge_live.py

# Option C: Run TrueForge + MK-AI Sales Agent via Docker Compose
docker compose -f docker-compose.trueforge.yml up --build

```

## 3. Score Progression: Run 1 vs. Run 2 vs. Run 3 (`results/SELF_IMPROVEMENT_REPORT.md`)

All three runs execute on the **exact same 10 fixed tasks** (`tasks/fixed_tasks.json`) and are graded by the **exact same deterministic scorer** (`scorer.py`):

| Run | Active `SKILL.md` Version | Total Score (`/ 100`) | Gain vs. Run 1 | BANT 5-Pillar (`/ 20`) | Harvey `<75w` Email (`/ 20`) | Anti-Fab & Gatekeeper (`/ 20`) | US/India PPP & 18% GST (`/ 20`) | EspoCRM & 3-Step Cadence (`/ 10`) | PPP Overcharge & Sandbox (`/ 10`) | 
| ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | 
| **Run 1 (Baseline)** | `1.0.0-baseline` | **50.0 / 100** | — | 10.0 / 20 | 6.0 / 20 | 16.0 / 20 | 8.0 / 20 | 10.0 / 10 | 0.0 / 10 | 
| **Run 2 (After Skill Rewrite #1)** | `2.0.0-self-improved` | **90.0 / 100** | **+40.0 pts** | 20.0 / 20 | 20.0 / 20 | 20.0 / 20 | 20.0 / 20 | 10.0 / 10 | 0.0 / 10 | 
| **Run 3 (After Skill Rewrite #2)** | `3.0.0-self-optimized` | **100.0 / 100** | **+50.0 pts** | 20.0 / 20 | 20.0 / 20 | 20.0 / 20 | 20.0 / 20 | 10.0 / 10 | 10.0 / 10 | 

### Per-Task Breakdown Across the 10 Fixed Tasks (`tasks/fixed_tasks.json`)

| Task ID | Task Title | Market | Run 1 (`v1.0`) | Run 2 (`v2.0`) | Run 3 (`v3.0`) | Improvement (`Run 3 - Run 1`) | 
| ----- | ----- | ----- | ----- | ----- | ----- | ----- | 
| `SALES-TASK-01` | US Series-A SaaS Outbound Qualification & `<75w` Signal Cold Email | USA (`$ USD`) | 5.55 / 10 | 9.0 / 10 | **10.0 / 10** | **+4.45** | 
| `SALES-TASK-02` | India Multi-City Dental Chain PPP Pricing & 18% GST Commercial Quote | India (`₹ INR`) | 5.55 / 10 | 9.0 / 10 | **10.0 / 10** | **+4.45** | 
| `SALES-TASK-03` | No-Public-Email Guardrail & LinkedIn/Maps Fallback Routing | India (`₹ INR`) | 3.80 / 10 | 9.0 / 10 | **10.0 / 10** | **+6.20** | 
| `SALES-TASK-04` | Enterprise FinTech Deal Desk & Unapproved 45% Discount Gatekeeper Trap | USA (`$ USD`) | 4.55 / 10 | 9.0 / 10 | **10.0 / 10** | **+5.45** | 
| `SALES-TASK-05` | Bengaluru B2B AI Logistics Lead Qualification & Zoho CRM Feature Wedge | India (`₹ INR`) | 5.55 / 10 | 9.0 / 10 | **10.0 / 10** | **+4.45** | 
| `SALES-TASK-06` | US Healthcare Staffing Agency Multi-Touch OpenOutreach Sequence | USA (`$ USD`) | 5.55 / 10 | 9.0 / 10 | **10.0 / 10** | **+4.45** | 
| `SALES-TASK-07` | Hyderabad SaaS Exporter Dual-Currency (USD + INR GST) Deal Structuring | India (`₹ INR`) | 5.55 / 10 | 9.0 / 10 | **10.0 / 10** | **+4.45** | 
| `SALES-TASK-08` | Unverified Email & Missing Phone Cold Lead Nurture Classification | USA (`$ USD`) | 3.80 / 10 | 9.0 / 10 | **10.0 / 10** | **+6.20** | 
| `SALES-TASK-09` | New York B2B LegalTech Outbound & Competitor Lock-In Objection Battlecard | USA (`$ USD`) | 4.55 / 10 | 9.0 / 10 | **10.0 / 10** | **+5.45** | 
| `SALES-TASK-10` | Pune Manufacturing ERP Integrator Maps Lead & Regional PPP Battlecard | India (`₹ INR`) | 5.55 / 10 | 9.0 / 10 | **10.0 / 10** | **+4.45** | 

## 4. How the Self-Improvement Loop Works (`scorer.py` -> `self_improve.py` -> `SKILL.md`)

1. **Run 1 (`1.0.0-baseline` — `50.0 / 100`)**:

   * The agent starts with `skills/mkai-sales-leads/SKILL.v1.md`, which has uncalibrated baseline defaults (`max_cold_email_words: 110`, `require_5_pillar_bant_breakdown: false`, `enforce_no_public_email_guardrail: false`, `include_india_gst_hsn_998314: false`, `gatekeeper_discount_approval_max_pct: 50.0`).

   * `scorer.py` detects 6 systematic failure patterns across the 10 fixed tasks:

     * `[R1_BANT_5_PILLARS]`: Missing explicit 5-pillar sub-scores (`budget`, `authority`, `need`, `timeline`, `urgency`).

     * `[R2_WORD_COUNT_OVER_75]`: Cold emails are 79–84 words (violating Harvey's `<75-word` signal email rule).

     * `[R2_EMAIL_ON_NO_EMAIL]` & `[R3_FABRICATED_EMAIL]`: On `SALES-TASK-03` and `SALES-TASK-08` (where `contact_email` is `"no public email"`), the baseline agent guesses `info@domain` instead of suppressing email and routing to LinkedIn + Phone outreach.

     * `[R3_MISSING_APPROVAL_GATE]`: On `SALES-TASK-04` (45% discount) and `SALES-TASK-09` (25% discount), the agent auto-stages quotes instead of triggering the TrueForge Human Checkpoint (`waiting_for_human_approval`).

     * `[R4_MISSING_GST_HSN_998314]`: India quotes omit `18% GST` (`₹539.82`) and `HSN 998314` Input Tax Credit metadata.

2. **Self-Improvement Pass 1 (`self_improve.py` — `1.0.0-baseline` -> `2.0.0-self-improved`)**:

   * `self_improve.py` reads `results/run_1_score.json`, maps each failure diagnostic code to concrete rule patches, rewrites `SKILLs/mkai-sales-leads/SKILL.md` (and `skills/mkai-sales-leads/SKILL.md`), exports the unified diff to `results/skill_diff_run1_to_run2.patch`, and re-signs `SKILLs/skills_manifest.sig.json` via `MKSkillSigner`.

   * **Run 2 Score**: **`90.0 / 100`** (`+40.0 pts`).

3. **Self-Improvement Pass 2 (`self_improve.py` — `2.0.0-self-improved` -> `3.0.0-self-optimized`)**:

   * `self_improve.py` inspects the remaining diagnostic in `results/run_2_score.json` (`[R6_MISSING_PPP_OVERCHARGE_AND_WEDGE]`), rewrites `SKILL.md` to compute the exact PPP overcharge ratio (`india_overcharge_vs_ppp_x`), competitor contract buyout wedge, and Sandbox SHA-256 battlecard proof (`sandbox_artifact_sha256`), and exports `results/skill_diff_run2_to_run3.patch`.

   * **Run 3 Score**: **`100.0 / 100`** (`+50.0 pts` vs. Run 1).

## 5. How All 4 TrueForge Capabilities Are Used

1. **Skills (`SKILLs/mkai-sales-leads/SKILL.md` & `skills/mkai-sales-leads/SKILL.{v1,v2,v3}.md`)**:

   * Structured 8-section `SKILL.md` instruction packs loaded on demand by the harness, cryptographically signed in `SKILLs/skills_manifest.sig.json`, and self-modified by `self_improve.py`.

2. **Subagents (`trueforge/subagents.py` & `mkai-backend/crew_orchestrator.py`)**:

   * **`subagent-2-1-ppp-pricing`**: USA (`$ USD`) vs. India (`₹ INR`) PPP (`0.38x`) + `18% GST (HSN 998314)` pricing & competitor overcharge strategist.

   * **`subagent-2-4-bant-qualifier`**: Deterministic 5-pillar BANT/MEDDIC lead qualifier (`0–100`) and SQL/MQL tier classifier.

   * **`subagent-2-5-harvey-email`**: `<75-word` signal cold email composer with verified website evidence citation and `"no public email"` anti-fabrication guardrail.

   * **`subagent-2-6-crm-outreach`**: Dual-currency (`$ USD` / `₹ INR`) EspoCRM pipeline manager and 3-step OpenOutreach LinkedIn + Gmail sequence builder.

3. **MCP Server (`mkai-backend/mkai_mcp_server.py`)**:

   * Standards-compliant JSON-RPC 2.0 Model Context Protocol stdio server exposing 36 live tools including `sales_us_india_pricing_analysis`, `sales_qualify_and_score_leads`, `sales_espocrm_sync`, `harvey_stage_draft`, `maps_leads_search`, and `web_agent_scrape_with_chrome_fallback`.

4. **Sandbox-as-a-Tool (`results/sandbox_run_*/` & `mkai-backend/agent_loop.py`)**:

   * Provisioned on demand to generate and verify multi-format competitor pricing battlecards (`us_india_competitor_pricing_battlecard.xlsx`, `sales_competitor_battlecard_report.pdf`, `competitor_pricing_us_vs_india.csv`) and SQLite CRM pipelines (`espocrm_run_*.db`) with SHA-256 integrity digests.

## 6. Key Repository Files for Judges

* `trueforge.config.yaml` — TrueForge Agent Harness declarative configuration (Models, Skills, 4 Subagents, MCP Server, Sandbox).

* `run.sh` / `run.py` — Starter-compatible one-command runner executing Run 1 -> Skill Rewrite #1 -> Run 2 -> Skill Rewrite #2 -> Run 3.

* `scorer.py` — Deterministic 100-point rubric scorer across the 10 fixed tasks.

* `self_improve.py` — Autonomous skill-rewriting engine that diagnoses scorer failures, updates `SKILL.md`, exports `.patch` diffs, and re-signs `SKILLs/skills_manifest.sig.json`.

* `tasks/fixed_tasks.json` — The 10 fixed USA (`$ USD`) & India (`₹ INR`) B2B Sales & Leads benchmark tasks.

* `trueforge/subagents.py` — The 4 parallel TrueForge Sales & Leads subagents + MCP & Sandbox execution engine.

* `trueforge/trueforge_sdk_runner.ts` — TypeScript integration with `@truefoundry/trueforge-sdk`.

* `results/run_1_score.json`, `results/run_2_score.json`, `results/run_3_score.json` — Verified scorecards showing `50.0` -> `90.0` -> `100.0`.

* `results/skill_diff_run1_to_run2.patch` & `results/skill_diff_run2_to_run3.patch` — Unified diffs of the agent rewriting its own `SKILL.md`.

* `results/SELF_IMPROVEMENT_REPORT.md` — Full comparative evaluation report.

* `mkai-backend/sales_powerhouse.py` & `mkai-backend/mkai_mcp_server.py` — Core Sales & Leads backend and MCP server.

* `verify-all-systems.py` — Comprehensive 9-subsystem verification suite.

## 7. Multi-Model Router (`mkai-backend/router.py`)

Supports any OpenAI-compatible provider or TrueFoundry AI Gateway out of the box via 3 model tiers:

1. **`MAIN` (`gpt-oss-120b`)**: Flagship Harvey `<75w` Cold Emails & OpenOutreach Multi-Channel Sequences.

2. **`HEAVY` (`deepseek-v3.2`)**: USA vs. India Competitor Pricing Math, PPP/GST Calculation & Skill Self-Reflection.

3. **`FAST` (`gemma-4-31B-it`)**: High-Speed BANT/MEDDIC Lead Scoring, Maps/Web Extraction & EspoCRM Sync.

## 8. License

Released under the MIT License (`LICENSE`). Built on [TrueFoundry TrueForge (`https://github.com/truefoundry/trueforge`)](https://github.com/truefoundry/trueforge).