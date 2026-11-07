#!/usr/bin/env python3
"""
MK-AI — Omni Orchestra Engine Adapter (`mkai-backend/omni_orchestra.py`)
Enforces Rule 3 (No fake data, ever) & Rule 5 (Open-source respect):
- Does NOT impersonate upstream open-source engines (e.g., Harvey, Firecrawl, gosom/google-maps-scraper, Agent-Reach) with local deterministic CSV/JSON generators.
- Checks real engine availability and returns `{ "ok": False, "error": ..., "hint": ... }` when an upstream engine is not installed or unreachable.
- Allows demo responses ONLY when `MKAI_DEMO_MODE=1` is explicitly enabled, tagging all demo outputs with `"demo_mode": True` and `"badge": "DEMO DATA"`.
"""
import os
import shutil
import urllib.request
from typing import Any, Dict, Optional

from tinyfish_bridge import MKTinyFishBridge, is_demo_mode_enabled


class MKOmniOrchestra:
    """Honest adapter layer over external open-source engines without fake deterministic fallbacks."""

    def __init__(self) -> None:
        self.tinyfish = MKTinyFishBridge()
        self.engines_root = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "engines")

    def check_engine_status(self, engine_name: str) -> Dict[str, Any]:
        engine_dir = os.path.join(self.engines_root, engine_name)
        exists = os.path.isdir(engine_dir)
        if engine_name == "tinyfish":
            return self.tinyfish.status()
        if not exists:
            return {
                "ok": False,
                "engine": engine_name,
                "status": "NOT-INSTALLED",
                "demo_mode": is_demo_mode_enabled(),
                "error": f"Upstream engine '{engine_name}' is not installed under engines/{engine_name}/.",
                "hint": f"Install '{engine_name}' in Phase 1 under engines/{engine_name}/ or connect its MCP server.",
            }
        return {
            "ok": True,
            "engine": engine_name,
            "status": "INSTALLED",
            "path": engine_dir,
            "demo_mode": is_demo_mode_enabled(),
        }

    def run_engine_task(self, engine_name: str, task_params: Dict[str, Any]) -> Dict[str, Any]:
        status = self.check_engine_status(engine_name)
        if not status.get("ok"):
            if is_demo_mode_enabled():
                return {
                    "ok": True,
                    "demo_mode": True,
                    "badge": "DEMO DATA",
                    "engine": engine_name,
                    "warning": f"DEMO DATA — Upstream engine '{engine_name}' is not live; returning explicit demo placeholder because MKAI_DEMO_MODE=1.",
                    "items": [],
                }
            return {
                "ok": False,
                "demo_mode": False,
                "engine": engine_name,
                "error": status.get("error", f"Engine '{engine_name}' unavailable."),
                "hint": status.get("hint", "Start the required upstream service or MCP server before running this task."),
            }
        return {
            "ok": True,
            "demo_mode": False,
            "engine": engine_name,
            "status": "ready",
            "params": task_params,
        }
