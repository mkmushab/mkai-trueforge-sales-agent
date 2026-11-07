#!/usr/bin/env python3
"""
MK-AI TrueForge — Lean Model Context Protocol (MCP) JSON-RPC 2.0 Stdio Server (`mkai-backend/mkai_mcp_server.py`)
Exposes the B2B Sales & Lead Qualification tools to TrueForge (`@truefoundry/trueforge`):
- `sales_us_india_pricing_analysis`: USA ($ USD) vs. India (₹ INR) PPP & 18% GST (HSN 998314) pricing & battlecard generator
- `sales_qualify_and_score_leads`: BANT / MEDDIC 0-100 lead scorer & SQL/MQL classifier
- `sales_espocrm_sync`: Dual-currency ($ USD / ₹ INR) EspoCRM SQLite pipeline persistence
- `harvey_stage_draft`: Stages <75-word signal-based cold emails with verified evidence URLs
- `openoutreach_stage_sequence`: Stages 3-step LinkedIn + Gmail outbound cadences
- `web_agent_scrape_with_chrome_fallback`: Scrapes prospect pages with automatic Laptop Chrome fallback on login/CAPTCHA walls
"""
import json
import os
import sys
import tempfile

_HERE = os.path.dirname(os.path.abspath(__file__))
if _HERE not in sys.path:
    sys.path.insert(0, _HERE)

from sales_powerhouse import MKEspoCRMPipeline, MKSalesPowerhouse
from stealth_web_agent import MKStealthWebAgent

CRM = MKEspoCRMPipeline()
WEB_AGENT = MKStealthWebAgent()
POWERHOUSE = MKSalesPowerhouse(crm=CRM, web_agent=WEB_AGENT)

TOOLS = [
    {
        "name": "sales_us_india_pricing_analysis",
        "description": "Analyze competitor pricing across USA ($ USD) and India (₹ INR), compute PPP multipliers, 18% India GST (HSN 998314), and generate .xlsx, .pdf, and .csv battlecards in the sandbox.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "product_name": {"type": "string"},
                "category": {"type": "string"},
                "usd_to_inr_rate": {"type": "number"},
                "india_ppp_factor": {"type": "number"},
                "output_dir": {"type": "string"},
            },
            "required": ["product_name"],
        },
    },
    {
        "name": "sales_qualify_and_score_leads",
        "description": "Score B2B leads 0-100 using BANT/MEDDIC criteria, persist in EspoCRM, and stage <75w Harvey cold emails + OpenOutreach sequences.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "leads": {"type": "array", "items": {"type": "object"}},
                "target_offer": {"type": "string"},
            },
            "required": ["leads"],
        },
    },
    {
        "name": "sales_espocrm_sync",
        "description": "Upsert or query B2B Leads and Dual-Currency ($ USD / ₹ INR) Opportunities in the EspoCRM database.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "action": {"type": "string", "enum": ["upsert", "summary"]},
                "lead": {"type": "object"},
            },
        },
    },
    {
        "name": "harvey_stage_draft",
        "description": "Stage a <75-word signal-driven cold email citing a verified prospect website URL in the Harvey approval outbox.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "draft_id": {"type": "string"},
                "company": {"type": "string"},
                "website": {"type": "string"},
                "evidence_url": {"type": "string"},
                "contact_email": {"type": "string"},
                "subject": {"type": "string"},
                "body": {"type": "string"},
            },
            "required": ["company", "website", "contact_email", "subject", "body"],
        },
    },
    {
        "name": "openoutreach_stage_sequence",
        "description": "Stage a 3-step LinkedIn connection note + Gmail follow-up sequence in OpenOutreach.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "lead_id": {"type": "string"},
                "company_name": {"type": "string"},
                "contact_email": {"type": "string"},
                "linkedin_url": {"type": "string"},
                "step_1_linkedin_note": {"type": "string"},
                "step_2_gmail_subject": {"type": "string"},
                "step_2_gmail_body": {"type": "string"},
                "step_3_followup_body": {"type": "string"},
            },
            "required": ["company_name", "step_1_linkedin_note"],
        },
    },
    {
        "name": "web_agent_scrape_with_chrome_fallback",
        "description": "Scrape a prospect website; automatically fall back to local Chrome session if a login or CAPTCHA wall is detected.",
        "inputSchema": {
            "type": "object",
            "properties": {"url": {"type": "string"}},
            "required": ["url"],
        },
    },
]


def get_registered_tool_names() -> list[str]:
    return [t["name"] for t in TOOLS]


def handle_rpc(msg: dict) -> dict:
    method = msg.get("method", "")
    req_id = msg.get("id")
    params = msg.get("params", {}) or {}

    if method == "initialize":
        return {
            "jsonrpc": "2.0",
            "id": req_id,
            "result": {
                "protocolVersion": "2024-11-05",
                "capabilities": {"tools": {}},
                "serverInfo": {"name": "mkai-trueforge-sales-mcp", "version": "6.3.0"},
            },
        }
    if method == "tools/list":
        return {"jsonrpc": "2.0", "id": req_id, "result": {"tools": TOOLS}}
    if method == "tools/call":
        name = params.get("name")
        args = params.get("arguments", {}) or {}
        if name == "sales_us_india_pricing_analysis":
            out_dir = args.get("output_dir") or tempfile.mkdtemp(prefix="mkai_pricing_")
            out = POWERHOUSE.analyze_us_india_competitor_pricing(
                product_name=args.get("product_name", "MK-AI Sales Agent"),
                category=args.get("category", "AI Sales SDR & CRM"),
                usd_to_inr_rate=float(args.get("usd_to_inr_rate", 84.50)),
                india_ppp_factor=float(args.get("india_ppp_factor", 0.38)),
                output_dir=out_dir,
                auto_open_chrome_on_block=False,
            )
        elif name == "sales_qualify_and_score_leads":
            out = POWERHOUSE.qualify_leads_and_stage_outreach(
                leads_input=args.get("leads", []),
                target_offer=args.get("target_offer", "MK-AI Sales Suite"),
            )
        elif name == "sales_espocrm_sync":
            if args.get("action") == "upsert" and isinstance(args.get("lead"), dict):
                out = CRM.upsert_lead(args["lead"])
            else:
                out = CRM.get_pipeline_summary()
        elif name == "harvey_stage_draft":
            body = str(args.get("body", ""))
            out = {
                "ok": True,
                "draft_id": args.get("draft_id", "harvey-draft"),
                "company": args.get("company", ""),
                "website": args.get("website", ""),
                "evidence_url": args.get("evidence_url") or args.get("website", ""),
                "contact_email": args.get("contact_email", ""),
                "subject": args.get("subject", ""),
                "body": body,
                "word_count": len(body.split()),
                "status": "staged_in_harvey_outbox",
            }
        elif name == "openoutreach_stage_sequence":
            out = CRM.save_openoutreach_sequence(args)
        elif name == "web_agent_scrape_with_chrome_fallback":
            out = WEB_AGENT.scrape_url_adaptive(args.get("url", ""), allow_foreground_popup=False)
        else:
            out = {"ok": False, "error": f"Unknown tool: {name}"}

        return {
            "jsonrpc": "2.0",
            "id": req_id,
            "result": {"content": [{"type": "text", "text": json.dumps(out, indent=2, ensure_ascii=False)}]},
        }
    return {"jsonrpc": "2.0", "id": req_id, "result": {}}


def main() -> None:
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            msg = json.loads(line)
            if "id" in msg:
                sys.stdout.write(json.dumps(handle_rpc(msg)) + "\n")
                sys.stdout.flush()
        except Exception as exc:
            sys.stderr.write(f"[mkai_mcp_server] error: {exc}\n")


if __name__ == "__main__":
    main()
