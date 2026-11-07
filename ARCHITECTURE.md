# MK-AI x TrueForge System Architecture (`ARCHITECTURE.md`)

## 1. High-Level TrueForge Self-Improving Agent Architecture

```
+---------------------------------------------------------------------------------------------------+
|                     TrueFoundry TrueForge Agent Harness (`@truefoundry/trueforge`)                |
|  - Local SQLite Mode (`npx @truefoundry/trueforge@latest` on `http://localhost:8790`)             |
|  - Hosted Mode (`docker-compose.trueforge.yml` with Postgres + Redis)                             |
|  - Declarative Harness Config (`trueforge.config.yaml`) & SDK (`trueforge/trueforge_sdk_runner.ts`)|
+-------------------------------------------------+-------------------------------------------------+
                                                  |
          +---------------------------------------+---------------------------------------+
          |                                       |                                       |
          v                                       v                                       v
+-------------------------------+   +-----------------------------------+   +-------------------------------+
|  PILLAR 1: Self-Improving     |   |  PILLAR 2: 4 Parallel Sales       |   |  PILLAR 3 & 4: MCP Server &   |
|  Skills (`SKILL.md`)          |   |  Subagents (`trueforge/subagents`)|   |  Isolated Sandbox Execution   |
|  - `SKILLs/mkai-sales-leads/` |   |  - [2.1] USA vs India PPP & GST   |   |  - `mkai_mcp_server.py` (38   |
|  - `skills/mkai-sales-leads/` |   |  - [2.4] BANT/MEDDIC 0-100 Scorer |   |    JSON-RPC 2.0 MCP tools)    |
|  - HMAC-SHA256 Signed         |   |  - [2.5] Harvey <75w Cold Email   |   |  - Sandbox Battlecards:       |
|  - Rewritten by               |   |  - [2.6] EspoCRM & OpenOutreach   |   |    `.xlsx`, `.pdf`, `.csv`    |
|    `self_improve.py`          |   |    3-Step LinkedIn+Gmail Cadence  |   |    + SHA-256 Digest Proofs    |
+---------------+---------------+   +-----------------+-----------------+   +---------------+---------------+
                |                                     |                                     |
                +-------------------------------------+-------------------------------------+
                                                      |
                                                      v
+---------------------------------------------------------------------------------------------------+
|                   Closed-Loop Evaluation & Autonomous Skill Rewriting (`run.py`)                  |
|  1. Fixed Benchmark Tasks (`tasks/fixed_tasks.json` — 10 USA $ USD & India INR B2B Sales Tasks)   |
|  2. Deterministic 100-Point Rubric Scorer (`scorer.py` — 6 Rubrics x 10 Tasks)                    |
|  3. Autonomous Skill Rewriter (`self_improve.py` — Diagnoses Rubric Failures & Rewrites SKILL.md) |
|  4. Verified Progression: Run 1 (`50.0/100`) -> Run 2 (`90.0/100`) -> Run 3 (`100.0/100`)         |
+---------------------------------------------------------------------------------------------------+
```

## 2. Core Modules

| File / Directory | Role in the TrueForge Self-Improving Agent Architecture |
| :--- | :--- |
| `trueforge.config.yaml` | Declarative TrueForge agent definition configuring the 3-tier model router (`gpt-oss-120b`, `deepseek-v3.2`, `gemma-4-31B-it`), MCP server, skills, 4 subagents, and sandbox. |
| `trueforge/connect_trueforge_live.py` | Connects to a live `npx @truefoundry/trueforge@latest` instance on `http://localhost:8790` (registers the agent, MCP server, and self-improved `SKILL.md` via HTTP API, and falls back cleanly when offline). |
| `trueforge/subagents.py` | Implements the 4 parallel Sales & Leads subagents whose execution rules are parsed directly from `SKILLs/mkai-sales-leads/SKILL.md`. |
| `tasks/fixed_tasks.json` | 10 fixed B2B Sales & Leads evaluation tasks testing BANT scoring, `<75w` cold emails, `"no public email"` anti-fabrication guardrails, `>20%` discount approval gates, and USA vs. India PPP + 18% GST (`HSN 998314`) math. |
| `scorer.py` | Deterministic 100-point rubric scorer that outputs `results/run_{1,2,3}_score.json` and structured failure diagnostic codes. |
| `self_improve.py` | Reads scorer failure diagnostic codes, rewrites `SKILLs/mkai-sales-leads/SKILL.md` (`v1.0.0-baseline` -> `v2.0.0-self-improved` -> `v3.0.0-self-optimized`), outputs unified `.patch` diffs, and re-signs `SKILLs/skills_manifest.sig.json`. |
| `run.py` / `run.sh` | One-command starter script that runs Run 1, Self-Improve Pass #1, Run 2, Self-Improve Pass #2, and Run 3, generating `results/SELF_IMPROVEMENT_REPORT.md`. |
| `mkai-backend/sales_powerhouse.py` | Flagship #1 Sales & Lead Qualification engine integrating `ethanplusai/harvey`, `kaymen99/AI-Sales-agent`, `latent-spaces/brag`, `eracle/OpenOutreach`, and `espocrm/espocrm`. |
| `mkai-backend/mkai_mcp_server.py` | Live Model Context Protocol (MCP) JSON-RPC 2.0 stdio server exposing 38 tools to TrueForge. |
