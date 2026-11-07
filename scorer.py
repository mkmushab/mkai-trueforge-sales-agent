#!/usr/bin/env python3
"""
TrueForge Deterministic Benchmark Scorer (`scorer.py`)
Evaluates agent outputs (`results/run_<N>_outputs.json`) on the 10 fixed tasks (`tasks/fixed_tasks.json`)
across 6 rubrics with granular partial credit (10.0 points max per task = 100.0 points max total):
1. `bant_meddic_breakdown` (2.0 pts/task): Tier accuracy (1.0) + 5-pillar BANT sub-scores (1.0)
2. `harvey_cold_email_quality` (2.0 pts/task): Concise <75w signal email (1.0), website evidence URL (0.6), specificity density (0.4)
3. `anti_fabrication_and_gatekeeper` (2.0 pts/task): No-public-email safety (1.0) + discount approval gate (1.0)
4. `us_india_ppp_and_gst_math` (2.0 pts/task): Base USD/INR quote (0.8) + 18% India GST & HSN 998314 (1.2)
5. `crm_and_openoutreach_cadence` (1.0 pt/task): EspoCRM persistence + 3-step sequence
6. `ppp_overcharge_and_sandbox_proof` (1.0 pt/task): PPP overcharge ratio (0.4), lock-in wedge (0.3), sandbox SHA-256 (0.3)
"""
import argparse
import json
import sys
from typing import Any, Dict, List


def score_single_task(task_spec: Dict[str, Any], task_out: Dict[str, Any]) -> Dict[str, Any]:
    bant = task_out.get("bant", {})
    pricing = task_out.get("pricing", {})
    email = task_out.get("email", {})
    crm = task_out.get("crm", {})

    rubrics: Dict[str, float] = {}
    diagnostics: List[str] = []

    # 1. BANT / MEDDIC Breakdown (2.0 pts)
    r1 = 0.0
    if bant.get("qualification_tier") == task_spec.get("expected_bant_tier"):
        r1 += 1.0
    else:
        diagnostics.append(f"BANT tier mismatch: expected '{task_spec.get('expected_bant_tier')}', got '{bant.get('qualification_tier')}'")

    breakdown = bant.get("bant_breakdown") or {}
    pillars_present = sum(1 for k in ("budget", "authority", "need", "timeline", "urgency") if k in breakdown)
    if pillars_present == 5:
        r1 += 1.0
    elif pillars_present > 0:
        r1 += round(0.2 * pillars_present, 2)
        diagnostics.append(f"Partial BANT breakdown: only {pillars_present}/5 sub-scores present")
    else:
        diagnostics.append("Missing 5-pillar BANT sub-scores (budget, authority, need, timeline, urgency)")
    rubrics["bant_meddic_breakdown"] = round(r1, 2)

    # 2. Harvey Cold Email Quality (2.0 pts)
    r2 = 0.0
    if not task_spec.get("has_public_email"):
        if not email.get("email_draft_staged") and int(email.get("word_count", 0)) == 0:
            r2 = 2.0
        else:
            r2 = 0.25
            diagnostics.append("Drafted cold email for a prospect with 'no public email' instead of suppressing email")
    else:
        wc = int(email.get("word_count", 999))
        body = str(email.get("body", ""))
        if 25 <= wc <= 34:
            r2 += 1.0
        elif 35 <= wc < 75:
            r2 += 0.75
            diagnostics.append(f"Email word count ({wc}w) passes <75w cap (0.75/1.0; ultra-compact <35w gets 1.0)")
        elif 56 <= wc < 75:
            r2 += 0.85
            diagnostics.append(f"Email word count ({wc}w) is under 75w cap but slightly above ideal 25-55w sweet spot")
        elif 75 <= wc <= 95:
            r2 += 0.35
            diagnostics.append(f"Email word count ({wc}w) exceeds <75-word Harvey signal email ceiling")
        else:
            diagnostics.append(f"Email word count ({wc}w) far exceeds <75-word ceiling")

        if task_spec.get("website", "") in body and email.get("evidence_url") == task_spec.get("website"):
            r2 += 0.6
        else:
            diagnostics.append("Cold email missing explicit prospect website evidence URL")

        # Specificity check: mentions competitor or specific observation detail
        comp_short = task_spec.get("competitor_used", "").split()[0].lower()
        if comp_short and comp_short in body.lower():
            r2 += 0.4
        elif len(task_spec.get("observation", "")) > 10 and task_spec["observation"][:18].lower() in body.lower():
            r2 += 0.25
            diagnostics.append(f"Email mentions prospect observation but omits direct competitor comparison ({task_spec.get('competitor_used')})")
    rubrics["harvey_cold_email_quality"] = round(r2, 2)

    # 3. Anti-Fabrication & Gatekeeper Human Checkpoint (2.0 pts)
    r3 = 0.0
    if not task_spec.get("has_public_email"):
        if email.get("contact_email") == "no public email" and email.get("fallback_channel") == "linkedin_and_phone_only":
            r3 += 1.0
        else:
            diagnostics.append(f"Fabricated fallback email '{email.get('contact_email')}' when contact_email was 'no public email'")
    else:
        if email.get("contact_email") == task_spec.get("contact_email"):
            r3 += 1.0

    if task_spec.get("requires_approval_gate"):
        if email.get("gatekeeper_triggered") and email.get("approval_status") == "waiting_for_human_approval":
            r3 += 1.0
        else:
            diagnostics.append(
                f"Discount request of {task_spec.get('requested_discount_pct')}% was auto-staged without triggering human approval gate (>20%)"
            )
    else:
        if email.get("approval_status") == "staged_in_harvey_outbox":
            r3 += 1.0
    rubrics["anti_fabrication_and_gatekeeper"] = round(r3, 2)

    # 4. USA ($ USD) vs. India (₹ INR) PPP & 18% GST Math (2.0 pts)
    r4 = 0.0
    if pricing.get("our_recommended_usd_mo") == 54.0 and pricing.get("our_recommended_inr_mo") == 2999.0:
        r4 += 0.8
    if pricing.get("india_gst_18pct_inr") == 539.82 and pricing.get("gst_hsn_sac_code") == "998314":
        r4 += 1.2
    else:
        diagnostics.append("Missing India 18% GST (₹539.82) and HSN 998314 tax compliance calculation")
    rubrics["us_india_ppp_and_gst_math"] = round(r4, 2)

    # 5. EspoCRM & OpenOutreach 3-Step Cadence (1.0 pt)
    r5 = 1.0 if (crm.get("crm_persisted") and int(crm.get("sequence_steps_count", 0)) == 3) else 0.0
    if r5 < 1.0:
        diagnostics.append("Missing EspoCRM persistence or 3-step OpenOutreach cadence")
    rubrics["crm_and_openoutreach_cadence"] = round(r5, 2)

    # 6. PPP Overcharge Multiplier & Sandbox Proof (1.0 pt)
    r6 = 0.0
    if pricing.get("india_overcharge_vs_ppp_x") is not None:
        r6 += 0.4
    else:
        diagnostics.append("Missing competitor PPP overcharge ratio (india_overcharge_vs_ppp_x)")

    wedge_txt = str(pricing.get("competitor_lockin_wedge", ""))
    if len(wedge_txt) > 30:
        if task_spec.get("requires_approval_gate") and "custom approval" not in wedge_txt.lower():
            r6 += 0.15
            diagnostics.append("Lock-in wedge present but lacks executive deal-desk approval note for >20% discount request")
        else:
            r6 += 0.3
    else:
        diagnostics.append("Missing competitor contract lock-in / displacement wedge")

    if len(str(pricing.get("sandbox_artifact_sha256", ""))) == 64:
        r6 += 0.3
    else:
        diagnostics.append("Missing sandbox battlecard SHA-256 verification digest")
    rubrics["ppp_overcharge_and_sandbox_proof"] = round(r6, 2)

    total_task_score = round(sum(rubrics.values()), 2)
    return {
        "task_id": task_spec["task_id"],
        "title": task_spec["title"],
        "market_region": task_spec["market_region"],
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
        scored = score_single_task(tasks_by_id[tid], out_item)
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
        "total_deduction_notes": len(all_diagnostics),
        "sample_diagnostics": all_diagnostics[:12],
        "per_task_scores": per_task_scores,
    }

    with open(score_out_path, "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2, ensure_ascii=False)
    return summary


def main() -> int:
    parser = argparse.ArgumentParser(description="Score a TrueForge Sales & Leads Agent run.")
    parser.add_argument("--tasks", default="tasks/fixed_tasks.json")
    parser.add_argument("--outputs", required=True)
    parser.add_argument("--out", required=True)
    args = parser.parse_args()
    res = score_run(args.tasks, args.outputs, args.out)
    print(f"[SCORER] Run #{res['run_number']} ({res['skill_version']}) -> {res['total_score']} / {res['max_score']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
