#!/usr/bin/env python3
"""
MK AI v6 — Model Context Protocol (MCP) JSON-RPC 2.0 Stdio Server (`mkai-backend/mkai_mcp_server.py`)
Exposes the complete live MCP tool list across the 8-Agent Orchestra (6 Core Business Agents + Web Agent + Maps Agent),
34 Open-Source GitHub Repositories, Real Gmail & LinkedIn Connectors, and Automatic Laptop Chrome Fallback.
"""
import json
import os
import sys
import tempfile

_HERE = os.path.dirname(os.path.abspath(__file__))
if _HERE not in sys.path:
    sys.path.insert(0, _HERE)

from crew_orchestrator import MKAIOrchestrator
from mcp_connectors import MKMcpConnectorHub
from n8n_bridge import MKN8nBridge
from open_source_engines import MKFinanceGSTEngine, MKWebsiteSEOEngine

ORCHESTRATOR = MKAIOrchestrator()
CONNECTOR_HUB = MKMcpConnectorHub(gatekeeper=ORCHESTRATOR.gatekeeper)
N8N = MKN8nBridge()

TOOLS = [
    {
        "name": "mkai_list_agents",
        "description": "List all 8 MK AI v6 Orchestra Agents (6 Core Business Agents + Web Agent + Maps Agent) and their 44 specialized Sub-Agents with 3-model tiers (gptoss120B, Deepseek V3.2, gemma 31B).",
        "inputSchema": {"type": "object", "properties": {}},
    },
    {
        "name": "mkai_run_full_orchestra",
        "description": "Run all 8 MK-AI Agents as a synchronized Orchestra (Maps Agent -> Web Agent -> Research -> Sales USA/India Pricing & BANT -> Marketing -> AI CEO -> Fundraising & Support).",
        "inputSchema": {
            "type": "object",
            "properties": {
                "product_name": {"type": "string"},
                "target_niche": {"type": "string"},
                "target_cities": {"type": "string"},
                "competitor_urls": {"type": "array", "items": {"type": "string"}},
            },
            "required": ["product_name"],
        },
    },
    {
        "name": "sales_us_india_pricing_analysis",
        "description": "Flagship Sales Agent (#2.1): Analyze competitor pricing in USA ($ USD) vs. India (₹ INR), compute PPP disparity, 18% India GST vs US sales tax, and export .xlsx, .pdf, and .csv battlecards.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "product_name": {"type": "string"},
                "category": {"type": "string"},
                "competitor_urls": {"type": "array", "items": {"type": "string"}},
                "usd_to_inr_rate": {"type": "number"},
                "india_ppp_factor": {"type": "number"},
            },
            "required": ["product_name"],
        },
    },
    {
        "name": "sales_qualify_and_score_leads",
        "description": "Flagship Sales Agent (#2.3 & #2.4): Score leads 0-100 via kaymen99/AI-Sales-agent (BANT/MEDDIC), persist in EspoCRM, and stage <75w Harvey cold emails + OpenOutreach LinkedIn sequences.",
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
        "description": "Flagship Sales Agent (#2.6): Read or upsert Leads, Accounts, and Dual-Currency (USD/INR) Opportunities in EspoCRM pipeline.",
        "inputSchema": {
            "type": "object",
            "properties": {"action": {"type": "string"}, "lead": {"type": "object"}},
        },
    },
    {
        "name": "gmail_connect_and_send",
        "description": "Real Gmail Connector: Create draft (AUTO), send email via smtp.gmail.com:587 (ASK Gatekeeper), or open Gmail compose in Laptop Chrome.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "to": {"type": "string"},
                "subject": {"type": "string"},
                "body": {"type": "string"},
                "send_immediately": {"type": "boolean"},
                "open_in_chrome": {"type": "boolean"},
            },
            "required": ["to", "subject", "body"],
        },
    },
    {
        "name": "linkedin_connect_and_outreach",
        "description": "Real LinkedIn Connector (eracle/OpenOutreach + Laptop Chrome Profile): Open LinkedIn search/profile in Laptop Chrome or stage personalized connection note.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "query_or_url": {"type": "string"},
                "open_in_chrome": {"type": "boolean"},
            },
            "required": ["query_or_url"],
        },
    },
    {
        "name": "web_agent_scrape_with_chrome_fallback",
        "description": "Web Agent (#7): Scrape URL via Firecrawl + Scrapling; if blocked, CAPTCHA, or Login wall is detected (or force_laptop_chrome=true), automatically opens real Laptop Chrome (Port 9222) for a full live check.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "url": {"type": "string"},
                "force_laptop_chrome": {"type": "boolean"},
            },
            "required": ["url"],
        },
    },
    {
        "name": "mkai_delegate_subagent",
        "description": "Delegate a specialized task to any of MK AI's 8 Focused Agents or 44 Sub-Agents.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "task": {"type": "string"},
                "agent_id": {"type": "string"},
                "subagent_code": {"type": "string"},
                "approved": {"type": "boolean"},
            },
            "required": ["task"],
        },
    },
    {
        "name": "mkai_seo_website_autofix",
        "description": "Audit a local website codebase, generate robots.txt and sitemap.xml, and fix missing HTML title/meta/OpenGraph/JSON-LD tags.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "project_dir": {"type": "string"},
                "site_url": {"type": "string"},
                "brand_name": {"type": "string"},
                "description": {"type": "string"},
                "apply_changes": {"type": "boolean"},
            },
            "required": ["project_dir"],
        },
    },
    {
        "name": "mkai_calculate_gst_and_profit",
        "description": "Calculate India GST (CGST/SGST/IGST), taxable value, net profit, and net margin for orders.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "selling_price": {"type": "number"},
                "cogs": {"type": "number"},
                "gst_rate_percent": {"type": "number"},
                "ad_spend_per_order": {"type": "number"},
                "shipping_cost": {"type": "number"},
            },
            "required": ["selling_price", "cogs"],
        },
    },
    {
        "name": "mkai_trigger_n8n_workflow",
        "description": "Trigger an automated n8n workflow webhook from MK AI.",
        "inputSchema": {
            "type": "object",
            "properties": {"workflow": {"type": "string"}, "data": {"type": "object"}},
            "required": ["workflow"],
        },
    },
    {
        "name": "maps_leads_search",
        "description": "Search local business leads via MAPS AGENT (mahanaicoach/google-maps-scraper-kit + gosom + omkarcloud + webAutomationLover).",
        "inputSchema": {
            "type": "object",
            "properties": {"query": {"type": "string"}, "city": {"type": "string"}, "limit": {"type": "integer"}},
            "required": ["query", "city"],
        },
    },
    {
        "name": "maps_job_status",
        "description": "Check job status on gosom/google-maps-scraper REST API.",
        "inputSchema": {"type": "object", "properties": {"job_id": {"type": "string"}}, "required": ["job_id"]},
    },
    {
        "name": "maps_download_csv",
        "description": "Download completed lead CSV from gosom/google-maps-scraper REST API.",
        "inputSchema": {"type": "object", "properties": {"job_id": {"type": "string"}, "out_path": {"type": "string"}}, "required": ["job_id", "out_path"]},
    },
    {
        "name": "harvey_status",
        "description": "Check ethanplusai/harvey sales agent bridge status, outbox count, and approval mode.",
        "inputSchema": {"type": "object", "properties": {}},
    },
    {
        "name": "harvey_outbox",
        "description": "List staged outbound sales email drafts waiting for human approval in Harvey bridge.",
        "inputSchema": {"type": "object", "properties": {}},
    },
    {
        "name": "harvey_replies",
        "description": "List prospect replies received in Harvey bridge.",
        "inputSchema": {"type": "object", "properties": {}},
    },
    {
        "name": "harvey_stage_draft",
        "description": "Stage a personalized outreach draft (<75 words, with evidence URL) in Harvey approval queue (never sends automatically).",
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
            "required": ["draft_id", "company", "website", "evidence_url", "contact_email", "subject", "body"],
        },
    },
    {
        "name": "firecrawl_scrape",
        "description": "Scrape a public web page into clean Markdown/JSON via Firecrawl MCP service.",
        "inputSchema": {"type": "object", "properties": {"url": {"type": "string"}}, "required": ["url"]},
    },
    {
        "name": "firecrawl_map",
        "description": "Map URLs and site structure of a domain via Firecrawl MCP service.",
        "inputSchema": {"type": "object", "properties": {"url": {"type": "string"}, "limit": {"type": "integer"}}, "required": ["url"]},
    },
    {
        "name": "agent_reach_doctor",
        "description": "Run Agent-Reach doctor health check across web, RSS, GitHub, YouTube, and Reddit channels.",
        "inputSchema": {"type": "object", "properties": {}},
    },
    {
        "name": "agent_reach_query",
        "description": "Run an allow-listed read-only subcommand (web, rss, github, youtube, reddit) via Agent-Reach.",
        "inputSchema": {
            "type": "object",
            "properties": {"subcommand": {"type": "string"}, "target": {"type": "string"}},
            "required": ["subcommand", "target"],
        },
    },
    {
        "name": "archify_generate_diagram",
        "description": "Generate an interactive draggable HTML diagram using tt-a1i/archify.",
        "inputSchema": {
            "type": "object",
            "properties": {"title": {"type": "string"}, "nodes": {"type": "string"}, "edges": {"type": "string"}, "out_path": {"type": "string"}},
            "required": ["title", "nodes", "edges"],
        },
    },
    {
        "name": "launch_video",
        "description": "Generate a 15-25s personalized sales/launch video (.mp4) + storyboard plan via latent-spaces/brag.",
        "inputSchema": {
            "type": "object",
            "properties": {"project_name": {"type": "string"}, "tagline": {"type": "string"}, "output_dir": {"type": "string"}, "duration_sec": {"type": "integer"}},
            "required": ["project_name", "tagline"],
        },
    },
    {
        "name": "video_generate",
        "description": "Generate a short video from topic, aspect ratio, and voice.",
        "inputSchema": {
            "type": "object",
            "properties": {"topic": {"type": "string"}, "aspect": {"type": "string"}, "voice": {"type": "string"}, "output_dir": {"type": "string"}},
            "required": ["topic"],
        },
    },
    {
        "name": "tinyfish_leads",
        "description": "Run TinyFish Web Agent Lead Hunter with credit guard (--limit <= 10).",
        "inputSchema": {
            "type": "object",
            "properties": {"query": {"type": "string"}, "location": {"type": "string"}, "limit": {"type": "integer"}, "dry_run": {"type": "boolean"}},
            "required": ["query"],
        },
    },
    {
        "name": "tinyfish_competitors",
        "description": "Run TinyFish Web Agent Competitor Watch on target competitor URLs.",
        "inputSchema": {
            "type": "object",
            "properties": {"urls": {"type": "string"}, "limit": {"type": "integer"}, "dry_run": {"type": "boolean"}},
            "required": ["urls"],
        },
    },
    {
        "name": "tinyfish_content",
        "description": "Run TinyFish Web Agent Content Scout for topical research and hook analysis.",
        "inputSchema": {
            "type": "object",
            "properties": {"topic": {"type": "string"}, "limit": {"type": "integer"}, "dry_run": {"type": "boolean"}},
            "required": ["topic"],
        },
    },
    {
        "name": "tinyfish_radar",
        "description": "Run TinyFish Opportunity Radar.",
        "inputSchema": {
            "type": "object",
            "properties": {"query": {"type": "string"}, "limit": {"type": "integer"}, "dry_run": {"type": "boolean"}},
            "required": ["query"],
        },
    },
    {
        "name": "linkedin_assisted_search",
        "description": "Read-only assisted search on LinkedIn in user's visible browser session.",
        "inputSchema": {
            "type": "object",
            "properties": {"query": {"type": "string"}, "max_pages": {"type": "integer"}},
            "required": ["query"],
        },
    },
    {
        "name": "browser_navigate_extract",
        "description": "Navigate headed Playwright browser (persistent profile ~/.mkai/browser-profile) with domain allow-list, page cap, and step screenshot.",
        "inputSchema": {
            "type": "object",
            "properties": {"url": {"type": "string"}, "allowed_domains": {"type": "array", "items": {"type": "string"}}},
            "required": ["url"],
        },
    },
    {
        "name": "browser_control",
        "description": "Control the live headed browser session: pause, resume, take_over, stop, or reset.",
        "inputSchema": {"type": "object", "properties": {"action": {"type": "string"}}, "required": ["action"]},
    },
    {
        "name": "devtools_inspect_page",
        "description": "Inspect page console errors, HTTP status, and DOM title via Chrome DevTools / Browser MCP.",
        "inputSchema": {"type": "object", "properties": {"url": {"type": "string"}}, "required": ["url"]},
    },
    {
        "name": "workspace_create_draft",
        "description": "Create an email draft in Gmail / Google Workspace / local outbox (AUTO).",
        "inputSchema": {
            "type": "object",
            "properties": {"to": {"type": "string"}, "subject": {"type": "string"}, "body": {"type": "string"}},
            "required": ["to", "subject", "body"],
        },
    },
    {
        "name": "workspace_send_email",
        "description": "Send an external email via Gmail (always gated by Gatekeeper ASK approval).",
        "inputSchema": {
            "type": "object",
            "properties": {"to": {"type": "string"}, "subject": {"type": "string"}, "body": {"type": "string"}},
            "required": ["to", "subject", "body"],
        },
    },
    {
        "name": "fs_read_file",
        "description": "Read a file inside the workspace sandbox.",
        "inputSchema": {"type": "object", "properties": {"path": {"type": "string"}}, "required": ["path"]},
    },
    {
        "name": "fs_write_file",
        "description": "Write a deliverable or source file inside the workspace sandbox.",
        "inputSchema": {"type": "object", "properties": {"path": {"type": "string"}, "content": {"type": "string"}}, "required": ["path", "content"]},
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
                "Capabilities": {"tools": {}},
                "serverInfo": {"name": "mkai-v6-orchestra-mcp", "version": "6.0.0"},
            },
        }
    if method == "tools/list":
        return {"jsonrpc": "2.0", "id": req_id, "result": {"tools": TOOLS}}
    if method == "tools/call":
        name = params.get("name")
        args = params.get("arguments", {}) or {}
        if name in ("mkai_list_agents", "mkai_list_30_agents"):
            out = ORCHESTRATOR.list_all_agents()
        elif name == "mkai_run_full_orchestra":
            out = ORCHESTRATOR.run_full_orchestra_mission(
                product_name=args.get("product_name", "MK AI Revenue OS"),
                target_niche=args.get("target_niche", "B2B SaaS & Clinics"),
                target_cities=args.get("target_cities", "Austin TX (USA) & Delhi NCR (India)"),
                competitor_urls=args.get("competitor_urls"),
                harvey_bridge=CONNECTOR_HUB.engines.harvey,
            )
        elif name == "sales_us_india_pricing_analysis":
            out_dir = tempfile.mkdtemp(prefix="mkai_pricing_")
            out = ORCHESTRATOR.sales_powerhouse.analyze_us_india_competitor_pricing(
                product_name=args.get("product_name", "MK AI Autonomous Sales Suite"),
                category=args.get("category", "AI Sales SDR & CRM"),
                competitor_urls=args.get("competitor_urls"),
                usd_to_inr_rate=float(args.get("usd_to_inr_rate", 84.50)),
                india_ppp_factor=float(args.get("india_ppp_factor", 0.38)),
                output_dir=out_dir,
            )
        elif name == "sales_qualify_and_score_leads":
            out = ORCHESTRATOR.sales_powerhouse.qualify_leads_and_stage_outreach(
                leads_input=args.get("leads", []),
                harvey_bridge=CONNECTOR_HUB.engines.harvey,
                target_offer=args.get("target_offer", "MK AI Revenue OS"),
            )
        elif name == "sales_espocrm_sync":
            if args.get("action") == "upsert" and isinstance(args.get("lead"), dict):
                out = ORCHESTRATOR.crm.upsert_lead(args["lead"])
            else:
                out = ORCHESTRATOR.crm.get_pipeline_summary()
        elif name == "gmail_connect_and_send":
            if args.get("open_in_chrome"):
                out = ORCHESTRATOR.connectors.open_gmail_in_laptop_chrome(
                    compose_to=args.get("to", ""),
                    subject=args.get("subject", ""),
                    body=args.get("body", ""),
                )
            else:
                out = ORCHESTRATOR.connectors.email_action(
                    agent_id="mkai-02-sales",
                    to_address=args.get("to", ""),
                    subject=args.get("subject", ""),
                    body=args.get("body", ""),
                    send_immediately=bool(args.get("send_immediately", False)),
                )
        elif name == "linkedin_connect_and_outreach":
            out = ORCHESTRATOR.connectors.open_linkedin_in_laptop_chrome(
                query_or_url=args.get("query_or_url", ""),
            )
        elif name == "web_agent_scrape_with_chrome_fallback":
            out = ORCHESTRATOR.web_agent.scrape_url_adaptive(
                url=args.get("url", ""),
                allow_foreground_popup=True,
                force_laptop_chrome=bool(args.get("force_laptop_chrome", False)),
            )
        elif name == "mkai_delegate_subagent":
            out = ORCHESTRATOR.execute_task(
                task_prompt=args.get("task", ""),
                agent_id=args.get("agent_id"),
                subagent_code=args.get("subagent_code"),
                approved=bool(args.get("approved", False)),
            )
        elif name == "mkai_seo_website_autofix":
            out = MKWebsiteSEOEngine.audit_and_prepare_fixes(
                project_dir=args.get("project_dir", "."),
                site_url=args.get("site_url", "https://mkai.tech"),
                brand_name=args.get("brand_name", "MK AI"),
                default_description=args.get("description", "Optimized by MK AI"),
                apply_changes=bool(args.get("apply_changes", False)),
            )
        elif name == "mkai_calculate_gst_and_profit":
            out = MKFinanceGSTEngine.calculate_gst_and_margin(
                selling_price=float(args.get("selling_price", 1000)),
                cogs=float(args.get("cogs", 400)),
                gst_rate_percent=float(args.get("gst_rate_percent", 18)),
                ad_spend_per_order=float(args.get("ad_spend_per_order", 0)),
                shipping_cost=float(args.get("shipping_cost", 0)),
            )
        elif name == "mkai_trigger_n8n_workflow":
            out = N8N.trigger_workflow(args.get("workflow", "default"), args.get("data", {}))
        elif name == "maps_leads_search":
            out = CONNECTOR_HUB.engines.maps_leads.maps_leads_search(
                query=args.get("query", ""),
                city=args.get("city", ""),
                limit=int(args.get("limit", 5)),
            )
        elif name == "maps_job_status":
            out = CONNECTOR_HUB.engines.maps_leads.job_status(args.get("job_id", ""))
        elif name == "maps_download_csv":
            out = CONNECTOR_HUB.engines.maps_leads.download_csv(args.get("job_id", ""), args.get("out_path", "leads.csv"))
        elif name == "harvey_status":
            out = CONNECTOR_HUB.engines.harvey.status()
        elif name == "harvey_outbox":
            out = CONNECTOR_HUB.engines.harvey.list_outbox()
        elif name == "harvey_replies":
            out = CONNECTOR_HUB.engines.harvey.list_replies()
        elif name == "harvey_stage_draft":
            out = CONNECTOR_HUB.engines.harvey.stage_outreach_draft(
                draft_id=args.get("draft_id", "draft-1"),
                company=args.get("company", ""),
                website=args.get("website", ""),
                evidence_url=args.get("evidence_url", ""),
                contact_email=args.get("contact_email", ""),
                subject=args.get("subject", ""),
                body=args.get("body", ""),
            )
        elif name == "firecrawl_scrape":
            out = CONNECTOR_HUB.engines.firecrawl.scrape(args.get("url", ""))
        elif name == "firecrawl_map":
            out = CONNECTOR_HUB.engines.firecrawl.scrape(args.get("url", ""), formats=["links"])
        elif name == "agent_reach_doctor":
            out = CONNECTOR_HUB.engines.agent_reach.doctor()
        elif name == "agent_reach_query":
            out = CONNECTOR_HUB.engines.agent_reach.run_subcommand(args.get("subcommand", "doctor"), args.get("target", ""))
        elif name == "archify_generate_diagram":
            out_path = args.get("out_path") or os.path.join(tempfile.gettempdir(), "archify-diagram.html")
            out = CONNECTOR_HUB.engines.run_archify(
                title=args.get("title", "Architecture Diagram"),
                nodes=args.get("nodes", "Client,API,DB"),
                edges=args.get("edges", "Client->API,API->DB"),
                out_path=out_path,
            )
        elif name == "launch_video":
            out_dir = args.get("output_dir") or tempfile.mkdtemp(prefix="mkai_video_")
            out = CONNECTOR_HUB.engines.video_studio.launch_video(
                project_name=args.get("project_name", "MK-AI"),
                tagline=args.get("tagline", "Autonomous Multi-Agent Platform"),
                output_dir=out_dir,
                duration_sec=int(args.get("duration_sec", 20)),
            )
        elif name == "video_generate":
            out_dir = args.get("output_dir") or tempfile.mkdtemp(prefix="mkai_mpt_")
            out = CONNECTOR_HUB.engines.video_studio.video_generate(
                topic=args.get("topic", "MK-AI Launch"),
                aspect=args.get("aspect", "9:16"),
                voice=args.get("voice", "en-US-Standard"),
                output_dir=out_dir,
            )
        elif name in ("tinyfish_leads", "tinyfish_competitors", "tinyfish_content", "tinyfish_radar"):
            squad_cmd = name.replace("tinyfish_", "")
            q = args.get("query") or args.get("topic") or args.get("urls") or ""
            out = CONNECTOR_HUB.engines.tinyfish_squad.execute_squad_mission(
                squad_agent=squad_cmd,
                query=q,
                limit=int(args.get("limit", 2)),
                dry_run=bool(args.get("dry_run", False)),
            )
        elif name == "linkedin_assisted_search":
            out = CONNECTOR_HUB.linkedin_assisted_search(
                query=args.get("query", ""),
                max_pages=int(args.get("max_pages", 2)),
            )
        elif name == "browser_navigate_extract":
            out = CONNECTOR_HUB.browser.navigate_and_extract(
                url=args.get("url", ""),
                allowed_domains=args.get("allowed_domains"),
            )
        elif name == "browser_control":
            out = CONNECTOR_HUB.browser.control(action=args.get("action", "pause"))
        elif name == "devtools_inspect_page":
            out = CONNECTOR_HUB.browser.navigate_and_extract(url=args.get("url", ""))
        elif name == "workspace_create_draft":
            out = ORCHESTRATOR.connectors.email_action(
                agent_id="mkai-02-sales",
                to_address=args.get("to", ""),
                subject=args.get("subject", ""),
                body=args.get("body", ""),
                send_immediately=False,
            )
        elif name == "workspace_send_email":
            out = ORCHESTRATOR.connectors.email_action(
                agent_id="mkai-02-sales",
                to_address=args.get("to", ""),
                subject=args.get("subject", ""),
                body=args.get("body", ""),
                send_immediately=True,
            )
        else:
            out = {"ok": False, "error": f"Unknown or unconfigured tool: {name}"}

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
                resp = handle_rpc(msg)
                sys.stdout.write(json.dumps(resp) + "\n")
                sys.stdout.flush()
        except Exception as exc:
            sys.stderr.write(f"[mkai_mcp_server] error: {exc}\n")


if __name__ == "__main__":
    main()
