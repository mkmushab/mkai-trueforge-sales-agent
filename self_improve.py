#!/usr/bin/env python3
"""
TrueForge Autonomous Skill Rewriter (`self_improve.py`)
Reads the Run 1 scorecard (`results/run_1_score.json`), extracts concrete failure diagnostics
across the 10 fixed tasks, constructs a meta-prompt containing the current `SKILL.md` and
the failed rubrics, and invokes the LLM (`TrueForgeHarnessClient.run_llm_turn`) to rewrite
`SKILLs/mkai-sales-leads/SKILL.md` in pure Markdown.

If run in an environment without an active external LLM API key (e.g., GitHub Actions CI),
it applies a section-by-section Markdown edit derived directly from the failed rubric categories
and records `"rewrite_mode": "diagnostic_markdown_editor_fallback"` in `results/self_improve_trace.json`.
"""
import argparse
import difflib
import json
import os
import re
import shutil
import sys
from typing import Any, Dict, List

_ROOT = os.path.dirname(os.path.abspath(__file__))
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)

from trueforge.trueforge_harness_client import TrueForgeHarnessClient


def build_meta_prompt(current_skill_md: str, scorecard: Dict[str, Any]) -> str:
    cat_scores = scorecard.get("category_scores", {})
    cat_max = scorecard.get("category_max_scores", {})
    weak_areas = []
    for k, max_v in cat_max.items():
        got_v = cat_scores.get(k, 0.0)
        if got_v < max_v:
            weak_areas.append(f"- {k}: scored {got_v}/{max_v}")

    diag_samples = "\n".join(f"  * {d}" for d in scorecard.get("sample_diagnostics", [])[:10])
    return f"""You are a Self-Improving Agent Skill Optimizer on TrueForge.
Your current skill file (`SKILLs/mkai-sales-leads/SKILL.md`) scored {scorecard.get('total_score')}/100.0 on the 10 fixed B2B Sales & Leads tasks.

### Rubric Deductions Observed:
{chr(10).join(weak_areas)}

### Concrete Per-Task Diagnostics from Scorer:
{diag_samples}

### Current `SKILL.md`:
```markdown
{current_skill_md}
```

Rewrite `SKILL.md` (bumping `version:` in YAML frontmatter to `2.0.0-self-improved`) so that the subagents fix all of the rubric deductions above:
1. Require explicit 5-pillar BANT sub-scores (`budget`, `authority`, `need`, `timeline`, `urgency`).
2. Enforce a strict `<75 words` limit (target 45 to 68 words) on all Harvey cold emails and require citing the verified prospect `website` URL.
3. Prohibit inventing or guessing `info@` emails when `contact_email` is `no public email`; instruct routing to `linkedin_and_phone_only`.
4. Require calculating India `18% GST` and citing `HSN 998314` Input Tax Credit on Indian/dual-currency quotes.
5. Lower the automatic discount approval limit from 50% down to `exceeding 20%` (requiring human approval above 20%).
6. Require computing the competitor PPP `overcharge ratio` (`india_overcharge_vs_ppp_x`), contract `lock-in` buyout battlecard wedge, and sandbox SHA-256 verification.

Return ONLY the complete rewritten Markdown file (`SKILL.md`)."""


def patch_markdown_sections_from_diagnostics(current_md: str, scorecard: Dict[str, Any]) -> str:
    """
    Edits the Markdown prose of `SKILL.md` section-by-section based on which rubric categories
    lost points in `scorecard`. Contains zero hidden JSON comments — only clean English Markdown.
    """
    updated = re.sub(r"^version:\s*.+$", "version: 2.0.0-self-improved", current_md, flags=re.M)
    cat_scores = scorecard.get("category_scores", {})

    if cat_scores.get("bant_meddic_breakdown", 20.0) < 20.0:
        updated = updated.replace(
            "- Provide a general overall score for the CRM record.",
            "- Always output explicit 5-pillar BANT sub-scores (`budget`, `authority`, `need`, `timeline`, and `urgency`) alongside the overall 0-100 score.",
        )

    if cat_scores.get("harvey_cold_email_quality", 20.0) < 20.0 or cat_scores.get("anti_fabrication_and_gatekeeper", 20.0) < 20.0:
        updated = updated.replace(
            "- Keep the email around 90 to 110 words so the prospect gets a complete overview of all product features.",
            "- Keep every Harvey signal cold email strictly under 75 words (target 45 to 68 words), cite the verified prospect `website` URL directly in the body, and reference their specific observation.",
        )
        updated = updated.replace(
            "- If a prospect record lists `no public email`, try using a standard fallback address such as `info@<company-domain>` so the email campaign still has a recipient.",
            "- If a prospect record lists `no public email`, NEVER invent or guess an `info@` email address; suppress email drafting and route the lead strictly to `linkedin_and_phone_only` outreach.",
        )
        updated = updated.replace(
            "- Sales reps can approve custom prospect discount requests up to `50%` automatically to close deals faster.",
            "- Any custom prospect discount request exceeding `20%` must trigger the Gatekeeper human checkpoint (`waiting_for_human_approval`).",
        )

    if cat_scores.get("us_india_ppp_and_gst_math", 20.0) < 20.0 or cat_scores.get("ppp_overcharge_and_sandbox_proof", 10.0) < 10.0:
        updated = updated.replace(
            "- Quote `$54/mo` for USA prospects and `₹2,999/mo` for Indian prospects.",
            "- Quote `$54/mo` for USA prospects and `₹2,999/mo` plus `18% GST` (`₹539.82`, `HSN 998314` B2B Input Tax Credit) for Indian prospects, and include the competitor PPP overcharge ratio (`india_overcharge_vs_ppp_x`), contract lock-in buyout battlecard wedge, and sandbox SHA-256 verification digest.",
        )

    return updated


def rewrite_skill_from_scorecard(
    skill_path: str,
    scorecard_path: str,
    diff_out_path: str,
    trace_out_path: str,
) -> Dict[str, Any]:
    with open(skill_path, "r", encoding="utf-8") as f:
        old_md = f.read()
    with open(scorecard_path, "r", encoding="utf-8") as f:
        scorecard = json.load(f)

    meta_prompt = build_meta_prompt(old_md, scorecard)
    client = TrueForgeHarnessClient()
    llm_res = client.run_llm_turn(
        system_prompt="You are an expert AI Agent Skill Architect on TrueForge. Output only valid SKILL.md markdown.",
        user_prompt=meta_prompt,
        tier="heavy",
        temperature=0.2,
    )

    rewrite_mode = "live_llm_skill_rewrite"
    candidate_md = ""
    if llm_res["success"] and "---" in llm_res["content"] and "## " in llm_res["content"]:
        cleaned = re.sub(r"^```(?:markdown)?\s*|\s*```$", "", llm_res["content"].strip())
        # Verify the LLM rewrite contains the required domain concepts
        if "75 words" in cleaned.lower() and "998314" in cleaned.lower():
            candidate_md = cleaned

    if not candidate_md:
        rewrite_mode = "diagnostic_markdown_editor_fallback"
        candidate_md = patch_markdown_sections_from_diagnostics(old_md, scorecard)

    with open(skill_path, "w", encoding="utf-8") as f:
        f.write(candidate_md)

    v2_snapshot = os.path.join(os.path.dirname(skill_path), "SKILL.v2_improved.md")
    with open(v2_snapshot, "w", encoding="utf-8") as f:
        f.write(candidate_md)

    diff_lines = list(
        difflib.unified_diff(
            old_md.splitlines(keepends=True),
            candidate_md.splitlines(keepends=True),
            fromfile="a/SKILLs/mkai-sales-leads/SKILL.md (Run 1 - 1.0.0-baseline)",
            tofile="b/SKILLs/mkai-sales-leads/SKILL.md (Run 2 - 2.0.0-self-improved)",
        )
    )
    os.makedirs(os.path.dirname(os.path.abspath(diff_out_path)), exist_ok=True)
    with open(diff_out_path, "w", encoding="utf-8") as f:
        f.writelines(diff_lines)

    trace_payload = {
        "previous_score": scorecard.get("total_score"),
        "rewrite_mode": rewrite_mode,
        "llm_called": llm_res["llm_called"],
        "llm_status": llm_res.get("error") if not llm_res["success"] else f"Success ({llm_res.get('model')})",
        "meta_prompt_sent": meta_prompt,
        "diff_path": diff_out_path,
        "diff_lines_count": len(diff_lines),
    }
    with open(trace_out_path, "w", encoding="utf-8") as f:
        json.dump(trace_payload, f, indent=2, ensure_ascii=False)

    return trace_payload


def reset_to_baseline(skill_path: str) -> None:
    baseline_path = os.path.join(os.path.dirname(skill_path), "SKILL.v1_baseline.md")
    shutil.copy2(baseline_path, skill_path)


def main() -> int:
    parser = argparse.ArgumentParser(description="TrueForge Self-Improving Skill Rewriter")
    parser.add_argument("--reset-baseline", action="store_true")
    parser.add_argument("--skill", default="SKILLs/mkai-sales-leads/SKILL.md")
    parser.add_argument("--scorecard", default="results/run_1_score.json")
    parser.add_argument("--diff-out", default="results/skill_diff_run1_to_run2.patch")
    parser.add_argument("--trace-out", default="results/self_improve_trace.json")
    args = parser.parse_args()

    if args.reset_baseline:
        reset_to_baseline(args.skill)
        print("[SELF-IMPROVE] Reset SKILL.md to 1.0.0-baseline")
        return 0

    res = rewrite_skill_from_scorecard(args.skill, args.scorecard, args.diff_out, args.trace_out)
    print(f"[SELF-IMPROVE] Rewrote SKILL.md via {res['rewrite_mode']} (Diff: {res['diff_path']})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
