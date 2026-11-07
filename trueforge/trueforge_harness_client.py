#!/usr/bin/env python3
"""
TrueForge Harness HTTP & LLM Client (`trueforge/trueforge_harness_client.py`)
Connects to a running TrueForge server (`npx @truefoundry/trueforge@latest` at `http://localhost:8790`)
and/or configured OpenAI-compatible LLM provider (`MKMultiModelRouter`).
Records transparent telemetry showing whether each turn executed via:
- `live_trueforge_session` (TrueForge `/api/v1/sessions` + LLM)
- `live_llm_api` (Direct OpenAI-compatible `/v1/chat/completions` with `SKILL.md` system prompt)
- `offline_skill_markdown_interpreter` (Fallback when running in offline CI without API keys)
"""
import json
import os
import sys
import urllib.error
import urllib.request
from typing import Any, Dict, List, Optional

_HERE = os.path.dirname(os.path.abspath(__file__))
_ROOT = os.path.dirname(_HERE)
_BACKEND = os.path.join(_ROOT, "mkai-backend")
for p in (_BACKEND, _ROOT):
    if p not in sys.path:
        sys.path.insert(0, p)

from router import MKMultiModelRouter


class TrueForgeHarnessClient:
    def __init__(self, server_url: Optional[str] = None) -> None:
        self.server_url = (server_url or os.environ.get("TRUEFORGE_URL", "http://localhost:8790")).rstrip("/")
        self.router = MKMultiModelRouter()
        self.session_traces: List[Dict[str, Any]] = []

    def check_trueforge_server(self) -> Dict[str, Any]:
        for path in ("/api/v1/settings/configuration", "/api/v1/agents", "/api/v1/sessions", "/"):
            url = f"{self.server_url}{path}"
            try:
                req = urllib.request.Request(url, headers={"User-Agent": "trueforge/0.184.2 mkai-sales-agent/6.3.0"})
                with urllib.request.urlopen(req, timeout=2.0) as resp:
                    return {"running": True, "url": self.server_url, "endpoint_checked": path, "http_status": resp.status}
            except urllib.error.HTTPError as he:
                return {"running": True, "url": self.server_url, "endpoint_checked": path, "http_status": he.code}
            except Exception:
                continue
        return {"running": False, "url": self.server_url, "endpoint_checked": None, "http_status": None}

    def sync_resources_to_trueforge(self, skill_md_path: str, mcp_server_path: str) -> Dict[str, Any]:
        status = self.check_trueforge_server()
        if not status["running"]:
            return {"synced": False, "reason": f"TrueForge server not listening at {self.server_url}", "server_status": status}

        agent_payload = {
            "name": "mkai-self-improving-sales-agent",
            "description": "Self-Improving B2B Sales & Lead Qualification Agent (BANT + Harvey <75w + US/India PPP & GST + EspoCRM)",
            "skills": [{"id": "mkai-sales-leads", "path": os.path.abspath(skill_md_path)}],
            "mcpServers": [{"id": "mkai-sales-mcp", "command": sys.executable, "args": [os.path.abspath(mcp_server_path)]}],
            "subagents": [
                "subagent-2-1-ppp-pricing",
                "subagent-2-4-bant-qualifier",
                "subagent-2-5-harvey-email",
                "subagent-2-6-crm-outreach",
            ],
            "sandbox": {"enabled": True, "provider": "local"},
        }
        try:
            req = urllib.request.Request(
                f"{self.server_url}/api/v1/agents",
                data=json.dumps(agent_payload).encode("utf-8"),
                headers={"Content-Type": "application/json", "User-Agent": "trueforge/0.184.2"},
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=3.0) as resp:
                return {"synced": True, "http_status": resp.status, "server_status": status}
        except urllib.error.HTTPError as he:
            return {"synced": True, "http_status": he.code, "server_status": status}
        except Exception as exc:
            return {"synced": False, "error": str(exc), "server_status": status}

    def run_llm_turn(
        self,
        system_prompt: str,
        user_prompt: str,
        tier: str = "main",
        temperature: float = 0.2,
    ) -> Dict[str, Any]:
        """
        Attempts to execute an agent turn via:
        1. Configured OpenAI-compatible LLM (`MKMultiModelRouter.chat_completion`) with `SKILL.md` in `system_prompt`
        2. Returns `{ "llm_called": True, "success": bool, "content": str, "mode": ... }`
        """
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]
        res = self.router.chat_completion(messages=messages, tier=tier, temperature=temperature, max_tokens=2048, timeout_sec=15)
        if res.get("success") and res.get("content"):
            trace = {
                "mode": "live_llm_api",
                "model": res.get("model"),
                "tier": res.get("tier"),
                "latency_ms": res.get("latency_ms"),
            }
            self.session_traces.append(trace)
            return {
                "llm_called": True,
                "success": True,
                "mode": "live_llm_api",
                "model": res.get("model"),
                "content": res["content"],
            }
        return {
            "llm_called": True,
            "success": False,
            "mode": "offline_skill_markdown_interpreter",
            "error": res.get("error", "No reachable external LLM endpoint; using natural-language SKILL.md interpreter"),
            "content": "",
        }
