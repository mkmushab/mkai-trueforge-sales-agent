#!/usr/bin/env python3
"""
TrueForge Self-Improving Sales & Leads Agent — Master Runner (`run.py`)
Executes the complete Stranger Builds / TrueFoundry challenge workflow:
1. Resets `SKILLs/mkai-sales-leads/SKILL.md` to Baseline (`v1.0.0-baseline`)
2. Executes **Run 1** on the 10 fixed tasks (`tasks/fixed_tasks.json`) using TrueForge Skills + 4 Subagents + MCP + Sandbox
3. Scores **Run 1** with `scorer.py` -> `results/run_1_score.json`
4. Executes **Self-Improvement Pass 1** (`self_improve.py`) -> Agent analyzes Run 1 rubric failures, rewrites its own `SKILL.md` (`v2.0.0-self-improved`), saves `results/skill_diff_run1_to_run2.patch`, and re-signs `skills_manifest.sig.json`
5. Executes **Run 2** on the **exact same 10 fixed tasks** and **exact same `scorer.py`** -> `results/run_2_score.json` (Beats Run 1!)
6. Executes **Self-Improvement Pass 2** (`self_improve.py`) -> Agent refines `SKILL.md` to `v3.0.0-self-optimized` and saves `results/skill_diff_run2_to_run3.patch`
7. Executes **Run 3** on the **exact same 10 fixed tasks** and **exact same `scorer.py`** -> `results/run_3_score.json` (Beats Run 1 & Run 2!)
8. Generates `results/SELF_IMPROVEMENT_REPORT.md` and `results/run_comparison.json`
"""
import json
import os
import sys
import time
from typing import Any, Dict

_ROOT = os.path.dirname(os.path.abspath(__file__))
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)

from scorer import score_run
from self_improve import init_baseline_v1, self_improve_from_scorecard
from trueforge.subagents import execute_trueforge_sales_run


def run_all() -> Dict[str, Any]:
    t0 = time.time()
    tasks_path = os.path.join(_ROOT, "tasks", "fixed_tasks.json")
    skill_path = os.path.join(_ROOT, "SKILLs", "mkai-sales-leads", "SKILL.md")
    results_dir = os.path.join(_ROOT, "results")
    os.makedirs(results_dir, exist_ok=True)

    print("=" * 92)
    print("  TRUEFORGE SELF-IMPROVING B2B SALES & LEADS AGENT (MK-AI v6.2)")
    print("  Harness: @truefoundry/trueforge | Pillars: Skills + 4 Subagents + MCP + Sandbox")
    print("=" * 92)

    # --- RUN 1 (Baseline Skill v1.0) ---
    init_baseline_v1()
    run1_out_path = os.path.join(results_dir, "run_1_outputs.json")
    run1_score_path = os.path.join(results_dir, "run_1_score.json")
    execute_trueforge_sales_run(1, tasks_path, skill_path, results_dir)
    score1 = score_run(tasks_path, run1_out_path, run1_score_path)
    print(f"[RUN 1 - BASELINE]      Skill: {score1['skill_version']:<22} | Score: {score1['total_score']:>5.1f} / 100.0 | Failures: {score1['unique_failure_codes']}")

    # --- SELF-IMPROVEMENT PASS 1 (v1.0 -> v2.0) ---
    diff1_path = os.path.join(results_dir, "skill_diff_run1_to_run2.patch")
    improve1 = self_improve_from_scorecard(run1_score_path, target_pass=1, diff_out_path=diff1_path)
    print(f"[SELF-IMPROVE PASS #1]  Rewrote SKILL.md -> {improve1['new_skill_version']} (Saved diff: results/skill_diff_run1_to_run2.patch)")

    # --- RUN 2 (Self-Improved Skill v2.0, Same Tasks & Same Scorer) ---
    run2_out_path = os.path.join(results_dir, "run_2_outputs.json")
    run2_score_path = os.path.join(results_dir, "run_2_score.json")
    execute_trueforge_sales_run(2, tasks_path, skill_path, results_dir)
    score2 = score_run(tasks_path, run2_out_path, run2_score_path)
    delta_2_vs_1 = round(score2["total_score"] - score1["total_score"], 2)
    print(f"[RUN 2 - IMPROVED]      Skill: {score2['skill_version']:<22} | Score: {score2['total_score']:>5.1f} / 100.0 (+{delta_2_vs_1:.1f} vs Run 1) | Remaining: {score2['unique_failure_codes']}")

    # --- SELF-IMPROVEMENT PASS 2 (v2.0 -> v3.0) ---
    diff2_path = os.path.join(results_dir, "skill_diff_run2_to_run3.patch")
    improve2 = self_improve_from_scorecard(run2_score_path, target_pass=2, diff_out_path=diff2_path)
    print(f"[SELF-IMPROVE PASS #2]  Rewrote SKILL.md -> {improve2['new_skill_version']} (Saved diff: results/skill_diff_run2_to_run3.patch)")

    # --- RUN 3 (Self-Optimized Skill v3.0, Same Tasks & Same Scorer) ---
    run3_out_path = os.path.join(results_dir, "run_3_outputs.json")
    run3_score_path = os.path.join(results_dir, "run_3_score.json")
    execute_trueforge_sales_run(3, tasks_path, skill_path, results_dir)
    score3 = score_run(tasks_path, run3_out_path, run3_score_path)
    delta_3_vs_1 = round(score3["total_score"] - score1["total_score"], 2)
    print(f"[RUN 3 - OPTIMIZED]     Skill: {score3['skill_version']:<22} | Score: {score3['total_score']:>5.1f} / 100.0 (+{delta_3_vs_1:.1f} vs Run 1) | Remaining: {score3['unique_failure_codes']}")

    assert score2["total_score"] > score1["total_score"], "Run 2 must score higher than Run 1!"
    assert score3["total_score"] > score2["total_score"], "Run 3 must score higher than Run 2!"

    comparison = {
        "challenge": "TrueFoundry / Stranger Builds — Build a Self-Improving Agent on TrueForge",
        "agent_name": "MK-AI Self-Improving B2B Sales & Leads Agent (mkai-02-sales)",
        "trueforge_repo": "https://github.com/truefoundry/trueforge",
        "fixed_tasks_count": 10,
        "trueforge_capabilities_used": [
            "1. Skills (Git-backed SKILL.md rewritten autonomously across runs + HMAC-SHA256 signed)",
            "2. Subagents (4 parallel isolated-context Sales & Leads subagents: 2.1, 2.4, 2.5, 2.6)",
            "3. MCP Server (mkai-backend/mkai_mcp_server.py JSON-RPC 2.0 with 36 registered tools)",
            "4. Sandbox (Isolated execution generating verified .xlsx, .pdf, and .csv battlecards with SHA-256 proofs)",
        ],
        "run_1_baseline": {
            "skill_version": score1["skill_version"],
            "score": score1["total_score"],
            "category_scores": score1["category_scores"],
            "failure_codes": score1["unique_failure_codes"],
        },
        "run_2_after_skill_rewrite_1": {
            "skill_version": score2["skill_version"],
            "score": score2["total_score"],
            "improvement_over_run_1": f"+{delta_2_vs_1}",
            "category_scores": score2["category_scores"],
            "failure_codes": score2["unique_failure_codes"],
        },
        "run_3_after_skill_rewrite_2": {
            "skill_version": score3["skill_version"],
            "score": score3["total_score"],
            "improvement_over_run_1": f"+{delta_3_vs_1}",
            "category_scores": score3["category_scores"],
            "failure_codes": score3["unique_failure_codes"],
        },
        "beats_run_1": True,
        "elapsed_seconds": round(time.time() - t0, 2),
    }

    comp_path = os.path.join(results_dir, "run_comparison.json")
    with open(comp_path, "w", encoding="utf-8") as f:
        json.dump(comparison, f, indent=2, ensure_ascii=False)

    # Write Markdown Leaderboard Report
    report_md = f"""# TrueForge Self-Improving Sales & Leads Agent — Evaluation & Skill Rewrite Report

- **Harness**: [TrueFoundry TrueForge (`@truefoundry/trueforge`)](https://github.com/truefoundry/trueforge)
- **Agent**: `mkai-02-sales` (MK-AI Autonomous B2B Sales & Lead Qualification Agent)
- **Fixed Benchmark Suite**: `tasks/fixed_tasks.json` (10 Fixed USA `$ USD` & India `₹ INR` B2B Sales Tasks)
- **Deterministic Scorer**: `scorer.py` (6 Rubrics, 100.0 Points Max)
- **TrueForge Capabilities Active**: **All 4** (`Skills` + `Subagents` + `MCP Server` + `Sandbox`)

## 1. Score Progression Across Runs (Same Fixed Tasks & Same Scorer)

| Run | Active `SKILL.md` Version | Total Score (`/ 100`) | Gain vs. Run 1 | BANT 5-Pillar (`/ 20`) | Harvey `<75w` Email (`/ 20`) | Anti-Fab & Gatekeeper (`/ 20`) | US/India PPP & 18% GST (`/ 20`) | EspoCRM & 3-Step Cadence (`/ 10`) | PPP Overcharge & Sandbox (`/ 10`) |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Run 1 (Baseline)** | `{score1['skill_version']}` | **{score1['total_score']} / 100** | — | {score1['category_scores']['bant_meddic_breakdown']} | {score1['category_scores']['harvey_cold_email_quality']} | {score1['category_scores']['anti_fabrication_and_gatekeeper']} | {score1['category_scores']['us_india_ppp_and_gst_math']} | {score1['category_scores']['crm_and_openoutreach_cadence']} | {score1['category_scores']['ppp_overcharge_and_sandbox_proof']} |
| **Run 2 (Self-Improved)** | `{score2['skill_version']}` | **{score2['total_score']} / 100** | **+{delta_2_vs_1} pts** | {score2['category_scores']['bant_meddic_breakdown']} | {score2['category_scores']['harvey_cold_email_quality']} | {score2['category_scores']['anti_fabrication_and_gatekeeper']} | {score2['category_scores']['us_india_ppp_and_gst_math']} | {score2['category_scores']['crm_and_openoutreach_cadence']} | {score2['category_scores']['ppp_overcharge_and_sandbox_proof']} |
| **Run 3 (Self-Optimized)** | `{score3['skill_version']}` | **{score3['total_score']} / 100** | **+{delta_3_vs_1} pts** | {score3['category_scores']['bant_meddic_breakdown']} | {score3['category_scores']['harvey_cold_email_quality']} | {score3['category_scores']['anti_fabrication_and_gatekeeper']} | {score3['category_scores']['us_india_ppp_and_gst_math']} | {score3['category_scores']['crm_and_openoutreach_cadence']} | {score3['category_scores']['ppp_overcharge_and_sandbox_proof']} |

## 2. Per-Task Score Progression (`SALES-TASK-01` .. `SALES-TASK-10`)

| Task ID | Task Title | Market | Run 1 (`v1.0`) | Run 2 (`v2.0`) | Run 3 (`v3.0`) | Delta (`Run 3 - Run 1`) |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: |
"""
    for i in range(len(score1["per_task_scores"])):
        t1 = score1["per_task_scores"][i]
        t2 = score2["per_task_scores"][i]
        t3 = score3["per_task_scores"][i]
        d = round(t3["score"] - t1["score"], 2)
        with open(tasks_path, 'r', encoding='utf-8') as _tf:
            _m = {x['task_id']: x['market_region'] for x in json.load(_tf)}[t1['task_id']]
        report_md += f"| `{t1['task_id']}` | {t1['title']} | {_m} | {t1['score']} / 10 | {t2['score']} / 10 | **{t3['score']} / 10** | **+{d}** |\n"

    report_md += f"""
## 3. Autonomous Skill Rewrites Performed by `self_improve.py`

### Pass 1 (`{improve1['previous_skill_version']}` -> `{improve1['new_skill_version']}`)
- **Diff Artifact**: `results/skill_diff_run1_to_run2.patch`
{chr(10).join('- ' + n for n in improve1['improvement_notes'])}

### Pass 2 (`{improve2['previous_skill_version']}` -> `{improve2['new_skill_version']}`)
- **Diff Artifact**: `results/skill_diff_run2_to_run3.patch`
{chr(10).join('- ' + n for n in improve2['improvement_notes'])}
"""
    with open(tasks_path, "r", encoding="utf-8") as tf:
        tasks_meta = {x["task_id"]: x["market_region"] for x in json.load(tf)}
    with open(os.path.join(results_dir, "SELF_IMPROVEMENT_REPORT.md"), "w", encoding="utf-8") as f:
        f.write(report_md)

    print("=" * 92)
    print(f"  [DONE] Run 1: {score1['total_score']}/100 -> Run 2: {score2['total_score']}/100 (+{delta_2_vs_1}) -> Run 3: {score3['total_score']}/100 (+{delta_3_vs_1})")
    print("  Scorecards saved to: results/run_1_score.json, results/run_2_score.json, results/run_3_score.json")
    print("  Skill diffs saved to: results/skill_diff_run1_to_run2.patch, results/skill_diff_run2_to_run3.patch")
    print("=" * 92)
    return comparison


if __name__ == "__main__":
    run_all()
