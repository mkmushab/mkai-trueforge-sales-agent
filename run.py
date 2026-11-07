#!/usr/bin/env python3
"""
TrueForge Self-Improving B2B Sales & Leads Agent — Runner (`run.py`)
Workflow:
1. Resets `SKILLs/mkai-sales-leads/SKILL.md` to `SKILL.v1_baseline.md` (`1.0.0-baseline`).
2. Executes **Run 1** on the 10 fixed tasks (`tasks/fixed_tasks.json`) using TrueForge Skills, 4 Subagents, MCP Server (`mkai_mcp_server.py`), and Sandbox battlecard generation.
3. Scores **Run 1** using `scorer.py` -> `results/run_1_score.json`.
4. Runs `self_improve.py` -> Analyzes Run 1 rubric deductions and rewrites `SKILLs/mkai-sales-leads/SKILL.md` (`2.0.0-self-improved`), saving the unified diff in `results/skill_diff_run1_to_run2.patch` and the rewrite trace in `results/self_improve_trace.json`.
5. Executes **Run 2** on the **exact same 10 fixed tasks** (`tasks/fixed_tasks.json`) and scores with the **exact same `scorer.py`** -> `results/run_2_score.json`.
6. Writes `results/run_comparison.json` and `results/SELF_IMPROVEMENT_REPORT.md`.
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
from self_improve import reset_to_baseline, rewrite_skill_from_scorecard
from trueforge.subagents import execute_trueforge_sales_run


def main() -> int:
    t0 = time.time()
    tasks_path = os.path.join(_ROOT, "tasks", "fixed_tasks.json")
    skill_path = os.path.join(_ROOT, "SKILLs", "mkai-sales-leads", "SKILL.md")
    results_dir = os.path.join(_ROOT, "results")
    os.makedirs(results_dir, exist_ok=True)

    print("=" * 88)
    print("  TRUEFORGE SELF-IMPROVING B2B SALES & LEADS AGENT")
    print("  Capabilities: Skills (SKILL.md) + 4 Subagents + MCP Server + Sandbox")
    print("=" * 88)

    # 1. Run 1 (Baseline Skill v1.0)
    reset_to_baseline(skill_path)
    run1_out = execute_trueforge_sales_run(1, tasks_path, skill_path, results_dir)
    run1_score_path = os.path.join(results_dir, "run_1_score.json")
    score1 = score_run(tasks_path, os.path.join(results_dir, "run_1_outputs.json"), run1_score_path)
    print(f"[RUN 1 - BASELINE]   Skill: {score1['skill_version']:<20} | Score: {score1['total_score']:>5.2f} / 100.00 | Deductions: {score1['total_deduction_notes']}")

    # 2. Self-Improve Skill Rewrite (v1.0 -> v2.0)
    diff_path = os.path.join(results_dir, "skill_diff_run1_to_run2.patch")
    trace_path = os.path.join(results_dir, "self_improve_trace.json")
    rewrite_trace = rewrite_skill_from_scorecard(skill_path, run1_score_path, diff_path, trace_path)
    print(f"[SKILL REWRITE]      Mode:  {rewrite_trace['rewrite_mode']} | Diff: results/skill_diff_run1_to_run2.patch")

    # 3. Run 2 (Rewritten Skill v2.0, Same 10 Fixed Tasks & Same Scorer)
    run2_out = execute_trueforge_sales_run(2, tasks_path, skill_path, results_dir)
    run2_score_path = os.path.join(results_dir, "run_2_score.json")
    score2 = score_run(tasks_path, os.path.join(results_dir, "run_2_outputs.json"), run2_score_path)
    delta = round(score2["total_score"] - score1["total_score"], 2)
    sign = "+" if delta >= 0 else ""
    print(f"[RUN 2 - IMPROVED]   Skill: {score2['skill_version']:<20} | Score: {score2['total_score']:>5.2f} / 100.00 ({sign}{delta:.2f} vs Run 1) | Deductions: {score2['total_deduction_notes']}")

    comparison: Dict[str, Any] = {
        "agent": "mkai-self-improving-sales-agent",
        "trueforge_server_status": run2_out.get("trueforge_connection"),
        "skill_rewrite_mode": rewrite_trace["rewrite_mode"],
        "fixed_tasks_count": score1["tasks_evaluated"],
        "run_1": {
            "skill_version": score1["skill_version"],
            "skill_sha256": score1["skill_sha256"],
            "total_score": score1["total_score"],
            "category_scores": score1["category_scores"],
            "deduction_count": score1["total_deduction_notes"],
        },
        "run_2": {
            "skill_version": score2["skill_version"],
            "skill_sha256": score2["skill_sha256"],
            "total_score": score2["total_score"],
            "category_scores": score2["category_scores"],
            "deduction_count": score2["total_deduction_notes"],
        },
        "score_delta": delta,
        "run_2_beats_run_1": score2["total_score"] > score1["total_score"],
        "elapsed_seconds": round(time.time() - t0, 2),
    }

    with open(os.path.join(results_dir, "run_comparison.json"), "w", encoding="utf-8") as f:
        json.dump(comparison, f, indent=2, ensure_ascii=False)

    # Write clean Markdown report
    report_lines = [
        "# Self-Improving Sales & Leads Agent — Run 1 vs. Run 2 Evaluation Report",
        "",
        f"- **TrueForge Connection**: `{json.dumps(run2_out.get('trueforge_connection', {}).get('server_status', {}))}`",
        f"- **Skill Rewrite Mode**: `{rewrite_trace['rewrite_mode']}` (`results/self_improve_trace.json`)",
        f"- **Skill Diff Artifact**: `results/skill_diff_run1_to_run2.patch`",
        "",
        "## 1. Rubric Category Breakdown (`scorer.py`)",
        "",
        "| Rubric Category | Max Points | Run 1 (`1.0.0-baseline`) | Run 2 (`2.0.0-self-improved`) | Delta |",
        "| :--- | :---: | :---: | :---: | :---: |",
    ]
    for cat, max_pts in score1["category_max_scores"].items():
        c1 = score1["category_scores"][cat]
        c2 = score2["category_scores"][cat]
        cd = round(c2 - c1, 2)
        csign = "+" if cd >= 0 else ""
        report_lines.append(f"| `{cat}` | {max_pts} | {c1} | **{c2}** | **{csign}{cd}** |")
    report_lines.append(
        f"| **Total Score** | **100.0** | **{score1['total_score']} / 100.0** | **{score2['total_score']} / 100.0** | **{sign}{delta} pts** |"
    )

    report_lines.extend([
        "",
        "## 2. Per-Task Breakdown Across the 10 Fixed Tasks (`tasks/fixed_tasks.json`)",
        "",
        "| Task ID | Task Title | Market | Run 1 (`v1`) | Run 2 (`v2`) | Delta |",
        "| :--- | :--- | :---: | :---: | :---: | :---: |",
    ])
    for t1, t2 in zip(score1["per_task_scores"], score2["per_task_scores"]):
        td = round(t2["score"] - t1["score"], 2)
        tsign = "+" if td >= 0 else ""
        report_lines.append(
            f"| `{t1['task_id']}` | {t1['title']} | {t1['market_region']} | {t1['score']} / 10 | **{t2['score']} / 10** | **{tsign}{td}** |"
        )

    with open(os.path.join(results_dir, "SELF_IMPROVEMENT_REPORT.md"), "w", encoding="utf-8") as f:
        f.write("\n".join(report_lines) + "\n")

    print("=" * 88)
    print(f"  [SUMMARY] Run 1: {score1['total_score']} / 100.0 -> Run 2: {score2['total_score']} / 100.0 ({sign}{delta} pts)")
    print("  Artifacts written to results/run_1_score.json, results/run_2_score.json, results/skill_diff_run1_to_run2.patch")
    print("=" * 88)
    return 0


if __name__ == "__main__":
    sys.exit(main())
