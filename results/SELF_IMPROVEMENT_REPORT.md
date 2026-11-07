# TrueForge Self-Improving Sales & Leads Agent — Evaluation & Skill Rewrite Report

- **Harness**: [TrueFoundry TrueForge (`@truefoundry/trueforge`)](https://github.com/truefoundry/trueforge)
- **Agent**: `mkai-02-sales` (MK-AI Autonomous B2B Sales & Lead Qualification Agent)
- **Fixed Benchmark Suite**: `tasks/fixed_tasks.json` (10 Fixed USA `$ USD` & India `₹ INR` B2B Sales Tasks)
- **Deterministic Scorer**: `scorer.py` (6 Rubrics, 100.0 Points Max)
- **TrueForge Capabilities Active**: **All 4** (`Skills` + `Subagents` + `MCP Server` + `Sandbox`)

## 1. Score Progression Across Runs (Same Fixed Tasks & Same Scorer)

| Run | Active `SKILL.md` Version | Total Score (`/ 100`) | Gain vs. Run 1 | BANT 5-Pillar (`/ 20`) | Harvey `<75w` Email (`/ 20`) | Anti-Fab & Gatekeeper (`/ 20`) | US/India PPP & 18% GST (`/ 20`) | EspoCRM & 3-Step Cadence (`/ 10`) | PPP Overcharge & Sandbox (`/ 10`) |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Run 1 (Baseline)** | `1.0.0-baseline` | **50.0 / 100** | — | 10.0 | 6.0 | 16.0 | 8.0 | 10.0 | 0.0 |
| **Run 2 (Self-Improved)** | `2.0.0-self-improved` | **90.0 / 100** | **+40.0 pts** | 20.0 | 20.0 | 20.0 | 20.0 | 10.0 | 0.0 |
| **Run 3 (Self-Optimized)** | `3.0.0-self-optimized` | **100.0 / 100** | **+50.0 pts** | 20.0 | 20.0 | 20.0 | 20.0 | 10.0 | 10.0 |

## 2. Per-Task Score Progression (`SALES-TASK-01` .. `SALES-TASK-10`)

| Task ID | Task Title | Market | Run 1 (`v1.0`) | Run 2 (`v2.0`) | Run 3 (`v3.0`) | Delta (`Run 3 - Run 1`) |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| `SALES-TASK-01` | US Series-A SaaS Outbound Qualification & <75w Signal Cold Email | USA | 5.55 / 10 | 9.0 / 10 | **10.0 / 10** | **+4.45** |
| `SALES-TASK-02` | India Multi-City Dental Chain PPP Pricing & 18% GST Commercial Quote | India | 5.55 / 10 | 9.0 / 10 | **10.0 / 10** | **+4.45** |
| `SALES-TASK-03` | No-Public-Email Guardrail & LinkedIn/Maps Fallback Routing | India | 3.8 / 10 | 9.0 / 10 | **10.0 / 10** | **+6.2** |
| `SALES-TASK-04` | Enterprise FinTech Deal Desk & Unapproved 45% Discount Gatekeeper Trap | USA | 4.55 / 10 | 9.0 / 10 | **10.0 / 10** | **+5.45** |
| `SALES-TASK-05` | Bengaluru B2B AI Logistics Lead Qualification & Zoho CRM Feature Wedge | India | 5.55 / 10 | 9.0 / 10 | **10.0 / 10** | **+4.45** |
| `SALES-TASK-06` | US Healthcare Staffing Agency Multi-Touch OpenOutreach Sequence | USA | 5.55 / 10 | 9.0 / 10 | **10.0 / 10** | **+4.45** |
| `SALES-TASK-07` | Hyderabad SaaS Exporter Dual-Currency (USD + INR GST) Deal Structuring | India | 5.55 / 10 | 9.0 / 10 | **10.0 / 10** | **+4.45** |
| `SALES-TASK-08` | Unverified Email & Missing Phone Cold Lead Nurture Classification | USA | 3.8 / 10 | 9.0 / 10 | **10.0 / 10** | **+6.2** |
| `SALES-TASK-09` | New York B2B LegalTech Outbound & Competitor Lock-In Objection Battlecard | USA | 4.55 / 10 | 9.0 / 10 | **10.0 / 10** | **+5.45** |
| `SALES-TASK-10` | Pune Manufacturing ERP Integrator Maps Lead & Regional PPP Battlecard | India | 5.55 / 10 | 9.0 / 10 | **10.0 / 10** | **+4.45** |

## 3. Autonomous Skill Rewrites Performed by `self_improve.py`

### Pass 1 (`1.0.0-baseline` -> `2.0.0-self-improved`)
- **Diff Artifact**: `results/skill_diff_run1_to_run2.patch`
- Diagnosed `[R1_BANT_5_PILLARS]` in Run 1 (Score 50.0/100): Rewrote Subagent 2.4 instructions to output explicit 5-pillar BANT/MEDDIC sub-scores (`budget`, `authority`, `need`, `timeline`, `urgency`).
- Diagnosed `[R2_WORD_COUNT_OVER_75]`: Tightened Subagent 2.5 Harvey cold email word ceiling from 110 words down to 68 words (`<75w` hard cap) with mandatory prospect `website` evidence URL.
- Diagnosed `[R3_FABRICATED_EMAIL]`: Enabled strict `'no public email'` anti-fabrication guardrail — prohibited guessing `info@` addresses and routed missing-email leads to `'linkedin_and_phone_only'`.
- Diagnosed `[R3_MISSING_APPROVAL_GATE]`: Lowered Gatekeeper commercial discount approval threshold from 50% to 20% (`waiting_for_human_approval`).
- Diagnosed `[R4_MISSING_GST_HSN_998314]`: Added mandatory India 18% GST (`₹539.82`) and `HSN 998314` B2B Input Tax Credit calculation to Subagent 2.1.

### Pass 2 (`2.0.0-self-improved` -> `3.0.0-self-optimized`)
- **Diff Artifact**: `results/skill_diff_run2_to_run3.patch`
- Diagnosed `[R6_MISSING_PPP_OVERCHARGE_AND_WEDGE]` in Run 2 (Score 90.0/100): Added exact PPP overcharge ratio (`india_overcharge_vs_ppp_x`), competitor contract lock-in buyout battlecard wedge, and Sandbox SHA-256 verification digest.
