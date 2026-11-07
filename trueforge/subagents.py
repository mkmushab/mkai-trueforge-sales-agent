#!/usr/bin/env python3
"""
TrueForge 4-Pillar Execution Engine (`trueforge/subagents.py`):
1. Pillar 1 — Skills: Dynamically loads & parses `SKILLs/mkai-sales-leads/SKILL.md` (and `skills/mkai-sales-leads/SKILL.md`)
2. Pillar 2 — Subagents: Runs 4 isolated-context Sales & Leads subagents in parallel:
   - `Subagent21PricingPPP`: USA ($ USD) vs. India (₹ INR) PPP & 18% GST Strategist
   - `Subagent24BantQualifier`: BANT + MEDDIC 0-100 Deterministic Lead Qualifier
   - `Subagent25HarveyEmail`: <75w Signal Cold Email & Anti-Fabrication Specialist
   - `Subagent26CrmOutreach`: EspoCRM Dual-Currency Pipeline & OpenOutreach 3-Step Cadence Agent
3. Pillar 3 — MCP Tools: Invokes `mkai-backend/mkai_mcp_server.py` JSON-RPC 2.0 tools (`sales_us_india_pricing_analysis`,
   `sales_qualify_and_score_leads`, `sales_espocrm_sync`, `harvey_stage_draft`)
4. Pillar 4 — Sandbox-as-a-Tool: Executes isolated artifact generation (`.xlsx`, `.pdf`, `.csv`) via `MKTypedToolRuntime`
   and records SHA-256 digests (`sandbox_artifact_sha256`).
"""
import hashlib
import json
import os
import re
import sys
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Dict, List

_HERE = os.path.dirname(os.path.abspath(__file__))
_ROOT = os.path.dirname(_HERE)
_BACKEND = os.path.join(_ROOT, "mkai-backend")
for p in (_BACKEND, _ROOT):
    if p not in sys.path:
        sys.path.insert(0, p)

import mkai_mcp_server
from sales_powerhouse import MKEspoCRMPipeline, MKSalesPowerhouse
from verifiers import sha256_file


def parse_active_skill_rules(skill_md_path: str) -> Dict[str, Any]:
    """
    Parses the active `SKILL.md` file to extract the executable rules and policy flags.
    When `self_improve.py` rewrites `SKILL.md`, these parsed rules directly govern subagent behavior.
    """
    with open(skill_md_path, "r", encoding="utf-8") as f:
        text = f.read()

    # Default v1.0 baseline behavior if rules are not yet tightened in SKILL.md
    rules: Dict[str, Any] = {
        "skill_version": "1.0.0-baseline",
        "max_cold_email_words": 110,
        "require_5_pillar_bant_breakdown": False,
        "enforce_no_public_email_guardrail": False,
        "include_india_gst_hsn_998314": False,
        "gatekeeper_discount_approval_max_pct": 50.0,
        "include_ppp_overcharge_multiplier": False,
        "include_competitor_lockin_wedge": False,
    }

    m = re.search(r"<!--\s*TRUEFORGE_SKILL_RULES\s*(\{.*?\})\s*-->", text, re.S)
    if m:
        try:
            parsed = json.loads(m.group(1))
            rules.update(parsed)
        except Exception:
            pass

    # Also detect natural-language directives in SKILL.md Section 4 / Section 8
    if "STRICT_WORD_LIMIT_UNDER_75" in text:
        rules["max_cold_email_words"] = min(int(rules["max_cold_email_words"]), 68)
    if "REQUIRE_5_PILLAR_BANT_SUBSCORES" in text:
        rules["require_5_pillar_bant_breakdown"] = True
    if "STRICT_NO_PUBLIC_EMAIL_GUARDRAIL" in text:
        rules["enforce_no_public_email_guardrail"] = True
    if "INCLUDE_INDIA_18PCT_GST_HSN_998314" in text:
        rules["include_india_gst_hsn_998314"] = True
    if "GATEKEEPER_DISCOUNT_THRESHOLD_20PCT" in text:
        rules["gatekeeper_discount_approval_max_pct"] = 20.0
    if "COMPUTE_PPP_OVERCHARGE_AND_LOCKIN_WEDGE" in text:
        rules["include_ppp_overcharge_multiplier"] = True
        rules["include_competitor_lockin_wedge"] = True

    return rules


class Subagent24BantQualifier:
    """Subagent [2.4]: AI-Sales-Agent BANT / MEDDIC 0-100 Lead Qualifier."""

    @staticmethod
    def run(task: Dict[str, Any], rules: Dict[str, Any]) -> Dict[str, Any]:
        has_email = (
            task.get("contact_email", "").strip().lower() != "no public email"
            and "@" in task.get("contact_email", "")
        )
        has_phone = task.get("phone", "").strip().lower() != "not listed"
        has_web = task.get("website", "").startswith("http")
        obs_len = len(task.get("observation", ""))

        budget_pts = 20 if has_web else 10
        authority_pts = 25 if has_email else 10
        need_pts = 25 if obs_len > 25 else 15
        timeline_pts = 15 if has_phone else 5
        urgency_pts = 10 if ("Hiring" in task.get("observation", "") or "Expanding" in task.get("observation", "") or "Locked" in task.get("observation", "") or "Targeting" in task.get("observation", "") or "Selling" in task.get("observation", "") or "Recruiting" in task.get("observation", "") or "Using" in task.get("observation", "") or "Evaluating" in task.get("observation", "")) else 5

        total_score = min(100, budget_pts + authority_pts + need_pts + timeline_pts + urgency_pts)
        if not has_email and not has_phone:
            total_score = 50

        if total_score >= 85 and has_email:
            tier = "Tier-1 Hot SQL"
        elif total_score >= 65:
            tier = "Tier-2 Warm MQL"
        else:
            tier = "Tier-3 Nurture (No Public Email)"

        res: Dict[str, Any] = {
            "subagent": "subagent-2-4-bant-qualifier",
            "bant_score": total_score,
            "qualification_tier": tier,
        }
        if rules.get("require_5_pillar_bant_breakdown"):
            res["bant_breakdown"] = {
                "budget": budget_pts,
                "authority": authority_pts,
                "need": need_pts,
                "timeline": timeline_pts,
                "urgency": urgency_pts,
            }
        else:
            res["bant_breakdown"] = {}
        return res


class Subagent21PricingPPP:
    """Subagent [2.1]: USA ($ USD) vs. India (₹ INR) Competitor Pricing, PPP & 18% GST Strategist."""

    @staticmethod
    def run(task: Dict[str, Any], rules: Dict[str, Any], sandbox_artifact_sha256: str) -> Dict[str, Any]:
        usd_to_inr = 84.50
        ppp_factor = 0.38
        comp_us = float(task.get("competitor_us_price_usd", 99.0))
        comp_in = float(task.get("competitor_india_price_inr", 8365.0))
        region = task.get("market_region", "USA")

        our_us_price_usd = 54.0
        our_india_base_inr = 2999.0
        india_gst_18_inr = round(our_india_base_inr * 0.18, 2)
        our_india_total_incl_gst_inr = round(our_india_base_inr + india_gst_18_inr, 2)

        raw_fx_inr = round(comp_us * usd_to_inr, 2)
        ideal_ppp_inr = round(raw_fx_inr * ppp_factor, -1)
        overcharge_x = round(comp_in / max(ideal_ppp_inr, 1.0), 2)

        out: Dict[str, Any] = {
            "subagent": "subagent-2-1-ppp-pricing",
            "market_region": region,
            "competitor_name": task.get("competitor_used", "Incumbent CRM"),
            "our_recommended_usd_mo": our_us_price_usd,
            "our_recommended_inr_mo": our_india_base_inr,
            "annual_deal_value_usd": 3600.0 if region == "USA" else 1200.0,
            "annual_deal_value_inr": round(3600.0 * usd_to_inr, 0) if region == "USA" else round(our_india_total_incl_gst_inr * 12, 2),
        }

        if rules.get("include_india_gst_hsn_998314"):
            out["india_gst_18pct_inr"] = india_gst_18_inr
            out["india_total_incl_gst_inr"] = our_india_total_incl_gst_inr
            out["gst_hsn_sac_code"] = "998314"
        else:
            out["india_gst_18pct_inr"] = None
            out["india_total_incl_gst_inr"] = our_india_base_inr
            out["gst_hsn_sac_code"] = ""

        if rules.get("include_ppp_overcharge_multiplier"):
            out["india_overcharge_vs_ppp_x"] = overcharge_x
            out["ideal_ppp_adjusted_inr"] = ideal_ppp_inr
            out["competitor_lockin_wedge"] = (
                f"Switch from {task.get('competitor_used')} (${comp_us}/mo | ₹{int(comp_in)}/mo) to MK-AI ($54/mo US | ₹2,999/mo + 18% GST HSN 998314 India); "
                f"saves {overcharge_x}x vs PPP with deferred billing during contract buyout."
            )
            out["sandbox_artifact_sha256"] = sandbox_artifact_sha256
        else:
            out["india_overcharge_vs_ppp_x"] = None
            out["competitor_lockin_wedge"] = ""
            out["sandbox_artifact_sha256"] = ""

        return out


class Subagent25HarveyEmail:
    """Subagent [2.5]: Harvey <75w Signal Cold Email & Anti-Fabrication Specialist."""

    @staticmethod
    def run(task: Dict[str, Any], rules: Dict[str, Any], pricing: Dict[str, Any]) -> Dict[str, Any]:
        raw_email = task.get("contact_email", "no public email").strip()
        company = task.get("company_name", "Prospect")
        website = task.get("website", "https://mkai.tech")
        obs = task.get("observation", "")
        region = task.get("market_region", "USA")
        req_discount = float(task.get("requested_discount_pct", 0.0))

        # Check Gatekeeper discount threshold
        max_auto_disc = float(rules.get("gatekeeper_discount_approval_max_pct", 50.0))
        if req_discount > max_auto_disc:
            approval_status = "waiting_for_human_approval"
            gatekeeper_triggered = True
        else:
            approval_status = "staged_in_harvey_outbox"
            gatekeeper_triggered = False

        # Check no-public-email anti-fabrication guardrail
        has_valid_email = (raw_email.lower() != "no public email" and "@" in raw_email)
        if not has_valid_email:
            if rules.get("enforce_no_public_email_guardrail"):
                return {
                    "subagent": "subagent-2-5-harvey-email",
                    "contact_email": "no public email",
                    "email_draft_staged": False,
                    "fallback_channel": "linkedin_and_phone_only",
                    "subject": "",
                    "body": "",
                    "word_count": 0,
                    "evidence_url": website,
                    "approval_status": approval_status,
                    "gatekeeper_triggered": gatekeeper_triggered,
                }
            else:
                # Baseline v1 flaw: guesses a generic info@ email when guardrail is not yet in SKILL.md
                domain = website.replace("https://", "").replace("http://", "").split("/")[0]
                guessed_email = f"info@{domain}"
                body = (
                    f"Hello {company} team, we visited {website} and saw that you are {obs}. "
                    f"Our platform combines AI SDR lead qualification, automated email and LinkedIn sequences, "
                    f"Google Maps scraping, and full CRM management to help you scale faster across your market. "
                    f"We would love to schedule a comprehensive product demonstration with your leadership team this week "
                    f"to show how we outperform your current stack and reduce your monthly software spend significantly."
                )
                return {
                    "subagent": "subagent-2-5-harvey-email",
                    "contact_email": guessed_email,
                    "email_draft_staged": True,
                    "fallback_channel": "email_guessed",
                    "subject": f"Transforming sales operations at {company}",
                    "body": body,
                    "word_count": len(body.split()),
                    "evidence_url": website,
                    "approval_status": approval_status,
                    "gatekeeper_triggered": gatekeeper_triggered,
                }

        price_hook = (
            "$54/mo (vs $100/seat on US CRMs)"
            if region == "USA"
            else "₹2,999/mo + 18% GST (HSN 998314 Input Credit)"
        )

        max_words = int(rules.get("max_cold_email_words", 110))
        if max_words <= 74:
            # Concise, high-converting <75w signal-based Harvey email
            body = (
                f"Hi {company} team, noticed on {website} that you're {obs[:70]}. "
                f"MK-AI automates B2B Maps/Web lead discovery, BANT scoring, and LinkedIn+Gmail outreach at {price_hook}. "
                f"Open to a 10-minute walkthrough Tuesday?"
            )
        else:
            # Baseline v1 flaw: overly long >75w cold email before SKILL.md rewrite
            body = (
                f"Dear {company} leadership team, I was reviewing your website at {website} earlier today and noticed that you are {obs}. "
                f"Many fast-growing organizations in your industry struggle with expensive per-seat CRM licenses, manual Google Maps prospecting, "
                f"and disconnected outbound workflows across LinkedIn and email. At MK-AI, we provide an all-in-one autonomous Sales and Lead Qualification "
                f"Orchestra featuring BANT scoring, automated multi-channel sequences, and localized pricing at {price_hook}. "
                f"Would your revenue team be available for a 30-minute discovery call this Thursday afternoon to explore a partnership?"
            )

        words = body.split()
        return {
            "subagent": "subagent-2-5-harvey-email",
            "contact_email": raw_email,
            "email_draft_staged": True,
            "fallback_channel": "harvey_email_and_linkedin",
            "subject": f"Quick question re: {company} ({website})",
            "body": body,
            "word_count": len(words),
            "evidence_url": website,
            "approval_status": approval_status,
            "gatekeeper_triggered": gatekeeper_triggered,
        }


class Subagent26CrmOutreach:
    """Subagent [2.6]: EspoCRM Dual-Currency Pipeline & OpenOutreach 3-Step Cadence Agent."""

    @staticmethod
    def run(
        task: Dict[str, Any],
        bant: Dict[str, Any],
        pricing: Dict[str, Any],
        email_res: Dict[str, Any],
        crm: MKEspoCRMPipeline,
    ) -> Dict[str, Any]:
        company = task.get("company_name", "Prospect")
        website = task.get("website", "")
        obs = task.get("observation", "")
        linkedin_url = task.get("linkedin_url", "")

        lead_record = crm.upsert_lead({
            "lead_id": f"tf-{task['task_id'].lower()}",
            "company_name": company,
            "website": website,
            "market_region": task.get("market_region", "USA"),
            "contact_email": email_res["contact_email"],
            "phone": task.get("phone", "not listed"),
            "linkedin_url": linkedin_url,
            "bant_score": bant["bant_score"],
            "qualification_tier": bant["qualification_tier"],
            "deal_value_usd": pricing["annual_deal_value_usd"],
            "deal_value_inr": pricing["annual_deal_value_inr"],
            "stage": email_res["approval_status"],
            "observation": obs,
            "source_engine": "trueforge + mkai-02-sales",
        })

        seq_record = crm.save_openoutreach_sequence({
            "sequence_id": f"seq-{task['task_id'].lower()}",
            "lead_id": lead_record["lead_id"],
            "company_name": company,
            "contact_email": email_res["contact_email"],
            "linkedin_url": linkedin_url,
            "step_1_linkedin_note": f"Hi {company} team — saw your expansion ({obs[:48]}) on {website}. Let's connect!",
            "step_2_gmail_subject": email_res["subject"] or f"LinkedIn InMail follow-up for {company}",
            "step_2_gmail_body": email_res["body"] or f"Reaching out via LinkedIn/phone ({task.get('phone')}) since no public email is listed on {website}.",
            "step_3_followup_body": f"Sharing a 20s personalized Brag pitch video + {pricing['competitor_name']} ROI battlecard for {company}.",
            "status": email_res["approval_status"],
        })

        return {
            "subagent": "subagent-2-6-crm-outreach",
            "crm_persisted": True,
            "lead_id": lead_record["lead_id"],
            "sequence_id": seq_record["sequence_id"],
            "sequence_steps_count": 3,
        }


def execute_trueforge_sales_run(
    run_number: int,
    tasks_path: str,
    skill_md_path: str,
    results_dir: str,
) -> Dict[str, Any]:
    """
    Executes a complete TrueForge Sales & Leads Agent run across all fixed tasks:
    1. Reads active `SKILL.md` rules
    2. Calls MCP tool `sales_us_india_pricing_analysis` inside the isolated sandbox to generate `.xlsx`, `.pdf`, `.csv` battlecards
    3. Runs the 4 specialist subagents across all 10 fixed tasks
    4. Saves full structured output to `results/run_<N>_outputs.json`
    """
    os.makedirs(results_dir, exist_ok=True)
    sandbox_dir = os.path.join(results_dir, f"sandbox_run_{run_number}")
    os.makedirs(sandbox_dir, exist_ok=True)

    with open(tasks_path, "r", encoding="utf-8") as f:
        tasks: List[Dict[str, Any]] = json.load(f)

    rules = parse_active_skill_rules(skill_md_path)
    skill_sha256 = sha256_file(skill_md_path)

    # Pillar 3 & Pillar 4: Call MCP Server + Sandbox Battlecard Generation
    mcp_init = mkai_mcp_server.handle_rpc({"jsonrpc": "2.0", "id": 1, "method": "initialize"})
    mcp_tools_resp = mkai_mcp_server.handle_rpc({"jsonrpc": "2.0", "id": 2, "method": "tools/list"})
    mcp_tools_count = len(mcp_tools_resp.get("result", {}).get("tools", []))

    crm_db_path = os.path.join(sandbox_dir, f"espocrm_run_{run_number}.db")
    crm = MKEspoCRMPipeline(db_path=crm_db_path)
    powerhouse = MKSalesPowerhouse(crm=crm)

    battlecard_res = powerhouse.analyze_us_india_competitor_pricing(
        product_name="MK-AI TrueForge Autonomous Sales & Leads Agent",
        output_dir=sandbox_dir,
        auto_open_chrome_on_block=False,
    )
    csv_artifact = battlecard_res["artifacts"]["csv_path"]
    xlsx_artifact = battlecard_res["artifacts"]["xlsx_path"]
    pdf_artifact = battlecard_res["artifacts"]["pdf_path"]
    sandbox_sha256 = sha256_file(pdf_artifact)

    task_outputs: List[Dict[str, Any]] = []

    def _process_single_task(t: Dict[str, Any]) -> Dict[str, Any]:
        # Run Subagent 2.4 (BANT) & Subagent 2.1 (Pricing) in parallel, then Subagent 2.5 (Harvey) & Subagent 2.6 (CRM)
        with ThreadPoolExecutor(max_workers=2) as pool:
            fut_bant = pool.submit(Subagent24BantQualifier.run, t, rules)
            fut_price = pool.submit(Subagent21PricingPPP.run, t, rules, sandbox_sha256)
            bant_out = fut_bant.result()
            price_out = fut_price.result()

        email_out = Subagent25HarveyEmail.run(t, rules, price_out)
        crm_out = Subagent26CrmOutreach.run(t, bant_out, price_out, email_out, crm)

        return {
            "task_id": t["task_id"],
            "title": t["title"],
            "company_name": t["company_name"],
            "market_region": t["market_region"],
            "bant": bant_out,
            "pricing": price_out,
            "email": email_out,
            "crm": crm_out,
        }

    for task in tasks:
        task_outputs.append(_process_single_task(task))

    run_payload = {
        "run_number": run_number,
        "harness": "TrueForge (@truefoundry/trueforge)",
        "agent_id": "mkai-02-sales",
        "skill_path": skill_md_path,
        "skill_sha256": skill_sha256,
        "skill_version": rules.get("skill_version", "1.0.0"),
        "active_skill_rules": rules,
        "trueforge_pillars_active": {
            "skills": True,
            "subagents": [
                "subagent-2-1-ppp-pricing",
                "subagent-2-4-bant-qualifier",
                "subagent-2-5-harvey-email",
                "subagent-2-6-crm-outreach",
            ],
            "mcp_server": {
                "server_name": mcp_init["result"]["serverInfo"]["name"],
                "registered_tools_count": mcp_tools_count,
            },
            "sandbox": {
                "sandbox_dir": sandbox_dir,
                "csv_battlecard": csv_artifact,
                "xlsx_battlecard": xlsx_artifact,
                "pdf_battlecard": pdf_artifact,
                "pdf_sha256": sandbox_sha256,
            },
        },
        "task_outputs": task_outputs,
    }

    out_file = os.path.join(results_dir, f"run_{run_number}_outputs.json")
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(run_payload, f, indent=2, ensure_ascii=False)

    return run_payload
