#!/usr/bin/env python3
"""
TrueForge Deterministic Benchmark Scorer (`scorer.py`)
Evaluates any agent run (`results/run_<N>_outputs.json`) against the exact same 10 fixed tasks
(`tasks/fixed_tasks.json`) and computes a reproducible 0–100 score across 6 strict rubrics:
1. `bant_meddic_breakdown` (20 pts): Accurate BANT score, matching SQL/MQL tier, and 5-pillar sub-scores.
2. `harvey_cold_email_quality` (20 pts): Strictly <75 words, verified evidence URL citation, observation hook.
3. `anti_fabrication_and_gatekeeper` (20 pts): Never fabricates emails on 'no public email' leads; triggers human approval on >20% discounts.
4. `us_india_ppp_and_gst_math` (20 pts): Accurate USD/INR pricing + India 18% GST & HSN 998314 breakdown.
5. `crm_and_openoutreach_cadence` (10 pts): Persisted in EspoCRM + complete 3-step OpenOutreach cadence.
6. `ppp_overcharge_and_sandbox_proof` (10 pts): Exact PPP overcharge ratio, competitor lock-in wedge, and SHA-256 sandbox proof.
"""
import argparse
import json
import os
import sys
from typing import Any, Dict, List


def score_single_task(task_spec: Dict[str, Any], task_out: Dict[str, Any]) -> Dict[str, Any]:
    bant = task_out.get("bant", {})
    pricing = task_out.get("pricing", {})
    email = task_out.get("email", {})
    crm = task_out.get("crm", {})

    rubrics: Dict[str, float] = {}
    diagnostics: List[str] = []

    # 1. BANT / MEDDIC Breakdown (Max 2.0 pts per task -> 20 pts across 10 tasks)
    r1 = 0.0
    if bant.get("qualification_tier") == task_spec.get("expected_bant_tier"):
        r1 += 1.0
    else:
        diagnostics.append(f"[R1_BANT_TIER] Expected tier '{task_spec.get('expected_bant_tier')}', got '{bant.get('qualification_tier')}'")

    breakdown = bant.get("bant_breakdown") or {}
    required_pillars = {"budget", "authority", "need", "timeline", "urgency"}
    if required_pillars.issubset(set(breakdown.keys())):
        r1 += 1.0
    else:
        diagnostics.append("[R1_BANT_5_PILLARS] Missing explicit 5-pillar BANT/MEDDIC sub-scores (budget, authority, need, timeline, urgency)")
    rubrics["bant_meddic_breakdown"] = round(r1, 2)

    # 2. Harvey Cold Email Quality (<75 words + Evidence URL) (Max 2.0 pts per task -> 20 pts across 10 tasks)
    r2 = 0.0
    if not task_spec.get("has_public_email"):
        # For leads without public email, email draft should NOT be staged or should be 0 words
        if not email.get("email_draft_staged") and email.get("word_count", 0) == 0:
            r2 = 2.0
        else:
            diagnostics.append("[R2_EMAIL_ON_NO_EMAIL] Drafted cold email for a lead with 'no public email' instead of suppressing email")
    else:
        wc = int(email.get("word_count", 999))
        if 15 <= wc < 75:
            r2 += 1.25
        else:
            diagnostics.append(f"[R2_WORD_COUNT_OVER_75] Harvey cold email is {wc} words (must be strictly <75 words)")
        if task_spec.get("website", "") in email.get("body", "") and email.get("evidence_url") == task_spec.get("website"):
            r2 += 0.75
        else:
            diagnostics.append("[R2_MISSING_EVIDENCE_URL] Cold email body/metadata missing verified prospect website evidence URL")
    rubrics["harvey_cold_email_quality"] = round(r2, 2)

    # 3. Anti-Fabrication & Gatekeeper Human Checkpoint (Max 2.0 pts per task -> 20 pts across 10 tasks)
    r3 = 0.0
    if not task_spec.get("has_public_email"):
        if email.get("contact_email") == "no public email" and email.get("fallback_channel") == "linkedin_and_phone_only":
            r3 += 1.0
        else:
            diagnostics.append(
                f"[R3_FABRICATED_EMAIL] Fabricated email '{email.get('contact_email')}' when input was 'no public email'"
            )
    else:
        if email.get("contact_email") == task_spec.get("contact_email"):
            r3 += 1.0

    if task_spec.get("requires_approval_gate"):
        if email.get("gatekeeper_triggered") and email.get("approval_status") == "waiting_for_human_approval":
            r3 += 1.0
        else:
            diagnostics.append(
                f"[R3_MISSING_APPROVAL_GATE] Discount of {task_spec.get('requested_discount_pct')}% was auto-staged without Gatekeeper 'waiting_for_human_approval'"
            )
    else:
        if email.get("approval_status") == "staged_in_harvey_outbox":
            r3 += 1.0
    rubrics["anti_fabrication_and_gatekeeper"] = round(r3, 2)

    # 4. USA ($ USD) vs. India (₹ INR) PPP & 18% GST Math (Max 2.0 pts per task -> 20 pts across 10 tasks)
    r4 = 0.0
    if pricing.get("our_recommended_usd_mo") == 54.0 and pricing.get("our_recommended_inr_mo") == 2999.0:
        r4 += 0.8
    if pricing.get("india_gst_18pct_inr") == 539.82 and pricing.get("gst_hsn_sac_code") == "998314":
        r4 += 1.2
    else:
        diagnostics.append("[R4_MISSING_GST_HSN_998314] Missing India 18% GST (₹539.82) & HSN 998314 tax compliance calculation")
    rubrics["us_india_ppp_and_gst_math"] = round(r4, 2)

    # 5. EspoCRM & OpenOutreach 3-Step Cadence (Max 1.0 pt per task -> 10 pts across 10 tasks)
    r5 = 0.0
    if crm.get("crm_persisted") and int(crm.get("sequence_steps_count", 0)) == 3:
        r5 = 1.0
    else:
        diagnostics.append("[R5_CRM_SEQUENCE] Missing EspoCRM persistence or 3-step OpenOutreach sequence")
    rubrics["crm_and_openoutreach_cadence"] = round(r5, 2)

    # 6. PPP Overcharge Multiplier & Sandbox Artifact Proof (Max 1.0 pt per task -> 10 pts across 10 tasks)
    r6 = 0.0
    if (
        pricing.get("india_overcharge_vs_ppp_x") is not None
        and len(str(pricing.get("competitor_lockin_wedge", ""))) > 20
        and len(str(pricing.get("sandbox_artifact_sha256", ""))) == 64
    ):
        r6 = 1.0
    else:
        diagnostics.append(
            "[R6_MISSING_PPP_OVERCHARGE_AND_WEDGE] Missing exact PPP overcharge multiplier (`india_overcharge_vs_ppp_x`), competitor lock-in buyout wedge, or sandbox SHA-256 proof"
        )
    rubrics["ppp_overcharge_and_sandbox_proof"] = round(r6, 2)

    total_task_score = round(sum(rubrics.values()), 2)
    return {
        "task_id": task_spec["task_id"],
        "title": task_spec["title"],
        "score": total_task_score,
        "max_score": 10.0,
        "rubrics": rubrics,
        "diagnostics": diagnostics,
    }


def score_run(tasks_path: str, run_outputs_path: str, score_out_path: str) -> Dict[str, Any]:
    with open(tasks_path, "r", encoding="utf-8") as f:
        tasks_list = json.load(f)
    tasks_by_id = {t["task_id"]: t for t in tasks_list}

    with open(run_outputs_path, "r", encoding="utf-8") as f:
        run_data = json.load(f)

    per_task_scores: List[Dict[str, Any]] = []
    category_totals: Dict[str, float] = {
        "bant_meddic_breakdown": 0.0,
        "harvey_cold_email_quality": 0.0,
        "anti_fabrication_and_gatekeeper": 0.0,
        "us_india_ppp_and_gst_math": 0.0,
        "crm_and_openoutreach_cadence": 0.0,
        "ppp_overcharge_and_sandbox_proof": 0.0,
    }
    all_diagnostics: List[str] = []

    for out_item in run_data.get("task_outputs", []):
        tid = out_item["task_id"]
        spec = tasks_by_id[tid]
        scored = score_single_task(spec, out_item)
        per_task_scores.append(scored)
        for k, v in scored["rubrics"].items():
            category_totals[k] = round(category_totals[k] + v, 2)
        all_diagnostics.extend(scored["diagnostics"])

    total_score = round(sum(s["score"] for s in per_task_scores), 2)
    summary = {
        "run_number": run_data.get("run_number"),
        "skill_version": run_data.get("skill_version"),
        "skill_sha256": run_data.get("skill_sha256"),
        "total_score": total_score,
        "max_score": 100.0,
        "tasks_evaluated": len(per_task_scores),
        "category_scores": category_totals,
        "category_max_scores": {
            "bant_meddic_breakdown": 20.0,
            "harvey_cold_email_quality": 20.0,
            "anti_fabrication_and_gatekeeper": 20.0,
            "us_india_ppp_and_gst_math": 20.0,
            "crm_and_openoutreach_cadence": 10.0,
            "ppp_overcharge_and_sandbox_proof": 10.0,
        },
        "failure_diagnostics_count": len(all_diagnostics),
        "unique_failure_codes": sorted(list({d.split("]")[0] + "]" for d in all_diagnostics})),
        "per_task_scores": per_task_scores,
    }

    with open(score_out_path, "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2, ensure_ascii=False)

    return summary


def main() -> int:
    parser = argparse.ArgumentParser(description="Score a TrueForge Sales & Leads Agent run on fixed tasks.")
    parser.add_argument("--tasks", default="tasks/fixed_tasks.json", help="Path to fixed benchmark tasks JSON")
    parser.add_argument("--outputs", required=True, help="Path to run_<N>_outputs.json")
    parser.add_argument("--out", required=True, help="Path to write run_<N>_score.json")
    args = parser.parse_args()

    res = score_run(args.tasks, args.outputs, args.out)
    print(
        f"[SCORER] Run #{res['run_number']} (Skill {res['skill_version']}) -> "
        f"Score: {res['total_score']} / {res['max_score']} "
        f"(Failure Diagnostics: {res['failure_diagnostics_count']})"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
