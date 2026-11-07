#!/usr/bin/env python3
"""
MK-AI — TinyFish Web Agent & Search/Fetch Bridge (`mkai-backend/tinyfish_bridge.py`)
Enforces Rule 3 (No fake data, ever):
- Never returns invented leads, prices, or deterministic fallback results when the API fails or is unreachable.
- Returns structured `{ "ok": False, "error": ..., "hint": ... }` whenever `TINYFISH_API_KEY` is missing or the service is unreachable.
- Demo records are returned ONLY when `MKAI_DEMO_MODE=1` is explicitly set in the environment, and every response carries `"demo_mode": True` and `"badge": "DEMO DATA"`.
"""
import json
import os
import time
import urllib.error
import urllib.request
from typing import Any, Dict, List, Optional


def is_demo_mode_enabled() -> bool:
    return os.environ.get("MKAI_DEMO_MODE", "0").strip() in ("1", "true", "TRUE", "yes")


class MKTinyFishBridge:
    def __init__(self) -> None:
        self.api_key = os.environ.get("TINYFISH_API_KEY", "").strip()
        self.base_url = os.environ.get("TINYFISH_BASE_URL", "https://agent.tinyfish.ai").rstrip("/")
        self.search_url = os.environ.get("TINYFISH_SEARCH_URL", "https://api.search.tinyfish.io").rstrip("/")
        self.fetch_url = os.environ.get("TINYFISH_FETCH_URL", "https://api.fetch.tinyfish.io").rstrip("/")
        self.mcp_url = os.environ.get("TINYFISH_MCP_URL", "https://agent.tinyfish.ai/mcp").rstrip("/")
        self.limit = int(os.environ.get("MK_TINYFISH_LIMIT", "2"))
        self.timeout_sec = int(os.environ.get("MK_TINYFISH_TIMEOUT", "30"))

    def _has_real_key(self) -> bool:
        if not self.api_key:
            return False
        lower = self.api_key.lower()
        if "placeholder" in lower or "your_" in lower or lower in ("none", "null", "changeme"):
            return False
        return len(self.api_key) >= 12

    def status(self) -> Dict[str, Any]:
        demo = is_demo_mode_enabled()
        if not self._has_real_key():
            if demo:
                return {
                    "ok": True,
                    "status": "DEMO",
                    "demo_mode": True,
                    "badge": "DEMO DATA",
                    "mcp_url": self.mcp_url,
                    "hint": "Running in explicit MKAI_DEMO_MODE=1. Set TINYFISH_API_KEY for live web-agent calls.",
                }
            return {
                "ok": False,
                "status": "Needs auth",
                "demo_mode": False,
                "mcp_url": self.mcp_url,
                "error": "TINYFISH_API_KEY is not configured in environment.",
                "hint": "Set TINYFISH_API_KEY in .env (obtainable from https://agent.tinyfish.ai) or enable MKAI_DEMO_MODE=1 for demo mode.",
            }

        req = urllib.request.Request(
            f"{self.base_url}/v1/health",
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "User-Agent": "MK-AI-TinyFish-Bridge/1.0",
            },
            method="GET",
        )
        t0 = time.time()
        try:
            with urllib.request.urlopen(req, timeout=8) as resp:
                return {
                    "ok": True,
                    "status": "Connected",
                    "demo_mode": False,
                    "http_status": resp.status,
                    "latency_ms": int((time.time() - t0) * 1000),
                    "mcp_url": self.mcp_url,
                }
        except Exception as exc:
            return {
                "ok": False,
                "status": "Error",
                "demo_mode": False,
                "mcp_url": self.mcp_url,
                "error": f"TinyFish service unreachable at {self.base_url}: {exc}",
                "hint": "Check internet connectivity, firewall rules, and TINYFISH_API_KEY validity. Offline deterministic fallbacks are disabled per Rule 3.",
            }

    def run_web_agent(self, goal: str, url: Optional[str] = None, limit: Optional[int] = None) -> Dict[str, Any]:
        max_pages = limit if limit is not None else self.limit
        if not self._has_real_key():
            if is_demo_mode_enabled():
                return {
                    "ok": True,
                    "demo_mode": True,
                    "badge": "DEMO DATA",
                    "warning": "DEMO DATA — Generated because MKAI_DEMO_MODE=1 is enabled.",
                    "goal": goal,
                    "target_url": url,
                    "items": [
                        {
                            "title": "[DEMO DATA] Sample Web Agent Observation",
                            "url": url or "https://mkai.tech",
                            "summary": f"Demo observation for goal: {goal}",
                            "demo_mode": True,
                        }
                    ],
                }
            return {
                "ok": False,
                "demo_mode": False,
                "error": "TINYFISH_API_KEY is missing or placeholder.",
                "hint": "Configure a valid TINYFISH_API_KEY in .env to run TinyFish web agents, or explicitly set MKAI_DEMO_MODE=1.",
            }

        payload = {
            "goal": goal,
            "url": url,
            "max_steps": max_pages,
        }
        req = urllib.request.Request(
            f"{self.base_url}/v1/agent/run",
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self.api_key}",
                "User-Agent": "MK-AI-TinyFish-Bridge/1.0",
            },
            method="POST",
        )
        t0 = time.time()
        try:
            with urllib.request.urlopen(req, timeout=self.timeout_sec) as resp:
                raw = resp.read().decode("utf-8", errors="replace")
                data = json.loads(raw) if raw else {}
                return {
                    "ok": True,
                    "demo_mode": False,
                    "latency_ms": int((time.time() - t0) * 1000),
                    "data": data,
                }
        except urllib.error.HTTPError as he:
            err_body = he.read().decode("utf-8", errors="replace") if he.fp else str(he)
            return {
                "ok": False,
                "demo_mode": False,
                "http_status": int(he.code) if he.code else 502,
                "error": f"TinyFish HTTP {he.code}: {err_body[:300]}",
                "hint": "Verify TINYFISH_API_KEY credits and endpoint URL in .env. Fake fallback data is disabled.",
            }
        except Exception as exc:
            return {
                "ok": False,
                "demo_mode": False,
                "error": f"TinyFish API request failed: {exc}",
                "hint": "Ensure internet access to https://agent.tinyfish.ai is available. Offline deterministic fallbacks are disabled.",
            }
