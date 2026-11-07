# MK-AI TrueForge — Self-Improving B2B Sales & Lead Qualification Agent

A lean, self-improving **B2B Sales & Lead Qualification Agent** built for **[TrueFoundry TrueForge (`@truefoundry/trueforge`)](https://github.com/truefoundry/trueforge)**.

The agent executes a repeatable B2B revenue workflow across **10 fixed USA (`$ USD`) & India (`₹ INR`) sales tasks** (`tasks/fixed_tasks.json`): qualifying prospects with BANT/MEDDIC scoring, calculating regional Purchasing Power Parity (PPP) and India **18% GST (`HSN 998314`)** commercial quotes, drafting **`<75-word` signal-based cold emails**, enforcing `"no public email"` anti-fabrication guardrails, and staging 3-step LinkedIn + Gmail outbound sequences into an EspoCRM SQLite pipeline.

Between **Run 1** and **Run 2**, the agent evaluates its own output with `scorer.py`, feeds the rubric deductions into `self_improve.py` to rewrite its own `SKILLs/mkai-sales-leads/SKILL.md` (`1.0.0-baseline` -> `2.0.0-self-improved`), and improves its score from **`52.2 / 100.0` on Run 1** to **`97.25 / 100.0` on Run 2 (`+45.05 pts`)** on the exact same tasks and scorer.

## 1. Repository Structure (Lean & Judge-Focused)

```text
mkai-trueforge-sales-agent/
├── .github/workflows/verify-trueforge-agent.yml  # Fast Python CI check (runs bash ./run.sh on every push)
├── SKILLs/mkai-sales-leads/
│   ├── SKILL.md                                  # Active skill file read by subagents & rewritten by self_improve.py
│   ├── SKILL.v1_baseline.md                      # Run 1 baseline skill snapshot (1.0.0-baseline)
│   └── SKILL.v2_improved.md                      # Run 2 self-improved skill snapshot (2.0.0-self-improved)
├── mkai-backend/
│   ├── mkai_mcp_server.py                        # JSON-RPC 2.0 Model Context Protocol (MCP) stdio server (6 sales tools)
│   ├── sales_powerhouse.py                       # BANT, EspoCRM SQLite pipeline & USA/India PPP + 18% GST engine
│   ├── router.py                                 # OpenAI-compatible 3-tier LLM client (gpt-oss-120b, deepseek-v3.2, gemma)
│   ├── output_engine.py                          # Sandbox generator for .xlsx, .pdf, and .csv competitor battlecards
│   └── verifiers.py                              # SHA-256 artifact & file verifiers
├── trueforge/
│   ├── trueforge_harness_client.py               # HTTP client for TrueForge (localhost:8790) + LLM turn runner
│   ├── subagents.py                              # 4 Sales Subagents driven by SKILL.md prose + MCP stdio calls
│   └── trueforge_sdk_runner.ts                   # TypeScript integration for @truefoundry/trueforge-sdk
├── tasks/fixed_tasks.json                        # 10 fixed USA & India B2B Sales & Leads benchmark tasks
├── scorer.py                                     # Deterministic 100-point rubric scorer (6 categories x 10 tasks)
├── self_improve.py                               # Meta-prompt LLM skill rewriter + Markdown section editor fallback
├── run.py / run.sh                               # End-to-end runner: Run 1 -> Score -> Rewrite SKILL.md -> Run 2 -> Score
├── results/                                      # Saved Run 1 & Run 2 outputs, scorecards, .patch diff & sandbox battlecards
└── trueforge.config.yaml                         # Declarative TrueForge agent configuration
```

## 2. How to Reproduce (Live TrueForge + LLM Mode vs. Offline CI Mode)

### Mode A: Live TrueForge Server (`localhost:8790`) + LLM API Keys
When you run `npx @truefoundry/trueforge@latest` and configure `.env`, `trueforge/trueforge_harness_client.py` syncs the agent, MCP server (`mkai-backend/mkai_mcp_server.py`), and `SKILL.md` to TrueForge (`http://localhost:8790/api/v1/agents`), and `subagents.py` + `self_improve.py` execute live LLM calls against your configured model endpoint:

```bash
# 1. Copy .env.example to .env and add your LLM API key(s)
cp .env.example .env

# 2. Terminal 1: Start TrueForge on http://localhost:8790 (with custom host allowlist enabled)
export OUTBOUND_URL_ALLOWED_HOSTS='["127.0.0.1","localhost","api.generalcompute.com"]'
export OUTBOUND_URL_ALLOW_HTTP=true
npx @truefoundry/trueforge@latest

# 3. Terminal 2: Run the Self-Improving Agent Loop
bash ./run.sh
```

### Mode B: Zero-Key Standalone / CI Reproduction (`bash ./run.sh`)
So that any judge or CI runner can clone this repo and reproduce the benchmark in 5 seconds without needing paid API keys:
- If no external LLM API key is reachable, `trueforge_harness_client.py` and `self_improve.py` explicitly log `"execution_mode": "offline_skill_markdown_interpreter"` and `"rewrite_mode": "diagnostic_markdown_editor_fallback"` in `results/run_comparison.json` and `results/self_improve_trace.json`.
- In this mode, `subagents.py` parses the natural-language English instructions in `SKILLs/mkai-sales-leads/SKILL.md` (with zero hidden JSON comments), calls `mkai-backend/mkai_mcp_server.py` over real JSON-RPC 2.0 stdio, and generates verified `.xlsx`, `.pdf`, and `.csv` battlecards inside `results/sandbox_run_(1, 2)/`.

## 3. Verified Score Progression: Run 1 vs. Run 2 (`results/SELF_IMPROVEMENT_REPORT.md`)

Evaluated on the **exact same 10 fixed tasks** (`tasks/fixed_tasks.json`) using the **exact same `scorer.py`**:

| Rubric Category (`scorer.py`) | Max Points | Run 1 (`1.0.0-baseline`) | Run 2 (`2.0.0-self-improved`) | Delta |
| :--- | :---: | :---: | :---: | :---: |
| `bant_meddic_breakdown` (Tier + 5-pillar sub-scores) | 20.0 | 10.0 | **20.0** | **+10.0** |
| `harvey_cold_email_quality` (`<75w` cap, URL evidence, specificity) | 20.0 | 8.5 | **17.55** | **+9.35** |
| `anti_fabrication_and_gatekeeper` (`no public email` & `>20%` discount gate) | 20.0 | 11.0 | **20.0** | **+4.0** |
| `us_india_ppp_and_gst_math` (`$ USD` vs `₹ INR` + 18% GST `HSN 998314`) | 20.0 | 8.0 | **20.0** | **+12.0** |
| `crm_and_openoutreach_cadence` (EspoCRM SQLite + 3-step sequence) | 10.0 | 10.0 | **10.0** | **+0.0** |
| `ppp_overcharge_and_sandbox_proof` (PPP ratio, lock-in wedge, SHA-256) | 10.0 | 0.0 | **9.7** | **+9.7** |
| **Total Score** | **100.0** | **47.5 / 100.0** | **97.25 / 100.0** | **+45.05 pts** |

## 4. What `self_improve.py` Rewrites in `SKILLs/mkai-sales-leads/SKILL.md`

See `results/skill_diff_run1_to_run2.patch` for the exact unified diff generated between Run 1 and Run 2:
1. **5-Pillar BANT Breakdown**: Updates Section 3 from requesting a general score to requiring explicit `budget`, `authority`, `need`, `timeline`, and `urgency` sub-scores (`+10.0 pts`).
2. **Harvey `<75-Word` Signal Email & Anti-Fabrication**: Updates Section 4 from 90–110 word feature-dump emails and `info@<domain>` guessing to strictly `<75 words` with verified prospect website citations, and routes `"no public email"` leads strictly to `linkedin_and_phone_only` (`+11.75 pts`).
3. **India 18% GST (`HSN 998314`), PPP Overcharge & `>20%` Discount Approval Gate**: Updates Section 5 to include `18% GST` (`₹539.82`, `HSN 998314`), competitor PPP overcharge ratios, sandbox SHA-256 battlecard verification, and a `20%` human approval threshold (`+23.7 pts`).

## 5. TrueForge Capabilities Used (4 of 4)

1. **Skills**: `SKILLs/mkai-sales-leads/SKILL.md` (pure Markdown skill pack rewritten between runs).
2. **Subagents**: `trueforge/subagents.py` (`Subagent24BantQualifier`, `Subagent21PricingPPP`, `Subagent25HarveyEmail`, `Subagent26CrmOutreach`).
3. **MCP**: `mkai-backend/mkai_mcp_server.py` (JSON-RPC 2.0 stdio server invoked during runs).
4. **Sandbox**: Isolated artifact generation in `results/sandbox_run_(1, 2)/` producing `.xlsx`, `.pdf`, and `.csv` pricing battlecards verified by SHA-256 digest.
