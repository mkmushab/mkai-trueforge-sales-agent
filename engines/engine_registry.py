#!/usr/bin/env python3
"""
MK-AI v6 — Unified Open-Source Engine Registry (`engines/engine_registry.py`)
Exposes `status_all()` across all 34 integrated GitHub repositories for the 8-Agent Orchestra:
1) Marketing & Campaign Agent:
   - shalintripathi/saas-marketing-agents
   - adaptico/adaptico-os
   - marketingtoolslist/awesome-marketing
   - cgallic/kai-cmo-harness
2) Sales & Lead Qualification Agent (Flagship #1):
   - ethanplusai/harvey
   - kaymen99/AI-Sales-agent
   - latent-spaces/brag
   - eracle/OpenOutreach
   - espocrm/espocrm
3) Research & Market Intelligence Agent:
   - vikas-kashyap97/Market-Intelligence-Agent
   - fleixweb/superleads
   - S313S/owli-market-research
   - hemantdpatil/Predictive-Marketing-Analytics
4) Business Strategy / AI CEO Agent:
   - marsxhq/manifesto
   - Repugrid/sovereign-suite
   - sujalmanpara/orion-ceo-agent
   - unpod-ai/unpod
5) Fundraising & Investor Relations Agent:
   - howieyoung/ir-kit
   - captableinc/captable
   - civicrm/civicrm-core
   - tjboudreaux/cc-skills-vc-fundraising
   - MrZilinXiao/Auto-Make-Money
   - evalyze-ai/awesome-startup-fundraising
6) Customer Support Agent:
   - cporter202/agentic-ai-starters
   - huabeitech/agent-desk
   - Mintplex-Labs/anythingllm-embed
   - helpin-ai/helpin
   - Bhavik-Jikadara/ai-customer-service-agent
7) WEB AGENT:
   - firecrawl/firecrawl
   - browser-use/browser-use
   - D4Vinci/Scrapling
   - Kappaemme-git/codex-first-customer-finder-skill
   - tinyfish-io/tinyfish-web-agent-integrations
8) MAPS AGENT:
   - mahanaicoach/google-maps-scraper-kit
   - gosom/google-maps-scraper
   - omkarcloud/google-maps-scraper
   - webAutomationLover/google-map-scraper
"""
import importlib.util
import json
import os
import subprocess
import sys
from typing import Any, Dict

_HERE = os.path.dirname(os.path.abspath(__file__))
for sub in ("harvey", "google-maps-scraper-kit", "firecrawl", "agent-reach", "brag", "ruflo", "tinyfish-squad"):
    p = os.path.join(_HERE, sub)
    if p not in sys.path:
        sys.path.insert(0, p)

from agent_reach_adapter import AgentReachAdapter
from firecrawl_adapter import FirecrawlServiceAdapter
from harvey_bridge import HarveyBridgeAdapter
from maps_leads_adapter import GoogleMapsScraperAdapter
from ruflo_adapter import RufloSwarmAdapter
from tinyfish_squad.cli import TinyFishSquadRunner
from video_studio_adapter import VideoStudioEngineAdapter


def _load_extra_adapter(folder: str):
    path = os.path.join(_HERE, folder, "adapter.py")
    if not os.path.isfile(path):
        return None
    spec = importlib.util.spec_from_file_location(f"mkai_engine_{folder.replace('-', '_')}", path)
    mod = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(mod)
    return mod.EngineAdapter()


USER_34_REPO_SLUGS = [
    # 1. Marketing
    "saas-marketing-agents", "adaptico-os", "awesome-marketing", "kai-cmo-harness",
    # 2. Sales (Flagship)
    "harvey", "ai-sales-agent", "brag", "openoutreach", "espocrm",
    # 3. Research
    "market-intelligence-agent", "superleads", "owli-market-research", "predictive-marketing-analytics",
    # 4. AI CEO
    "manifesto", "sovereign-suite", "orion-ceo-agent", "unpod",
    # 5. Fundraising
    "ir-kit", "captable", "civicrm-core", "cc-skills-vc-fundraising", "auto-make-money", "awesome-startup-fundraising",
    # 6. Customer Support
    "agentic-ai-starters", "agent-desk", "anythingllm-embed", "helpin", "ai-customer-service-agent",
    # 7. Web Agent
    "firecrawl", "browser-use", "scrapling", "codex-first-customer-finder-skill", "tinyfish-web-agent-integrations",
    # 8. Maps Agent
    "google-maps-scraper-kit", "google-maps-scraper", "google-map-scraper",
]


class MKEngineRegistry:
    def __init__(self) -> None:
        self.harvey = HarveyBridgeAdapter()
        self.maps_leads = GoogleMapsScraperAdapter()
        self.firecrawl = FirecrawlServiceAdapter()
        self.agent_reach = AgentReachAdapter()
        self.video_studio = VideoStudioEngineAdapter()
        self.ruflo = RufloSwarmAdapter()
        self.tinyfish_squad = TinyFishSquadRunner()
        self.archify_bin = os.path.join(_HERE, "archify", "bin", "archify.mjs")
        self.ecc = _load_extra_adapter("ecc")
        self.gstack = _load_extra_adapter("gstack")
        self.agency_agents = _load_extra_adapter("agency-agents")
        self.wshobson_agents = _load_extra_adapter("wshobson-agents")
        self.knowledge_work_plugins = _load_extra_adapter("knowledge-work-plugins")
        self.agent_skills = _load_extra_adapter("agent-skills")
        self.claude_quickstarts = _load_extra_adapter("claude-quickstarts")
        self.v6_adapters: Dict[str, Any] = {}
        for slug in USER_34_REPO_SLUGS:
            ad = _load_extra_adapter(slug)
            if ad is not None:
                self.v6_adapters[slug] = ad

    def archify_status(self) -> Dict[str, Any]:
        if not os.path.isfile(self.archify_bin):
            return {"ok": False, "engine": "tt-a1i/archify", "error": "archify.mjs missing"}
        res = subprocess.run(["node", self.archify_bin, "--health"], capture_output=True, text=True, timeout=10)
        if res.returncode == 0:
            return json.loads(res.stdout.strip())
        return {"ok": False, "engine": "tt-a1i/archify", "error": res.stderr.strip()}

    def run_archify(self, title: str, nodes: str, edges: str, out_path: str) -> Dict[str, Any]:
        res = subprocess.run(
            ["node", self.archify_bin, "--title", title, "--nodes", nodes, "--edges", edges, "--out", out_path],
            capture_output=True,
            text=True,
            timeout=15,
        )
        if res.returncode == 0:
            return json.loads(res.stdout.strip())
        return {"ok": False, "engine": "tt-a1i/archify", "error": res.stderr.strip()}

    def status_all(self) -> Dict[str, Dict[str, Any]]:
        base = {
            "harvey": self.harvey.status(),
            "google-maps-scraper-kit": self.maps_leads.status(),
            "firecrawl": self.firecrawl.status(),
            "agent-reach": self.agent_reach.status(),
            "brag_and_moneyprinter": self.video_studio.status(),
            "archify": self.archify_status(),
            "ruflo": self.ruflo.status(),
            "tinyfish-squad": self.tinyfish_squad.status(),
        }
        for slug, ad in self.v6_adapters.items():
            if slug not in base:
                base[slug] = ad.status()
        return base


if __name__ == "__main__":
    reg = MKEngineRegistry()
    print(json.dumps(reg.status_all(), indent=2))
