#!/usr/bin/env python3
"""
CLI & Library entry point for `engines/tinyfish-squad/`.
Supports:
  python3 -m tinyfish_squad.cli status
  python3 -m tinyfish_squad.cli leads --query "dental clinics" --location "Dwarka, Delhi" --limit 2 [--dry-run]
  python3 -m tinyfish_squad.cli competitors --urls "https://example.com" --limit 2 [--dry-run]
  python3 -m tinyfish_squad.cli content --topic "AI Agents" --limit 2 [--dry-run]
  python3 -m tinyfish_squad.cli radar --query "electronics internship Delhi NCR" --limit 2 [--dry-run]
"""
import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.request
from typing import Any, Dict, List


def is_demo_mode() -> bool:
    return os.environ.get("MKAI_DEMO_MODE", "0").strip().lower() in ("1", "true", "yes")


class TinyFishSquadRunner:
    MAX_CREDIT_GUARD_LIMIT = 10

    def __init__(self) -> None:
        self.api_key = os.environ.get("TINYFISH_API_KEY", "").strip()
        self.base_url = os.environ.get("TINYFISH_BASE_URL", "https://agent.tinyfish.ai").rstrip("/")
        self.search_url = os.environ.get("TINYFISH_SEARCH_URL", "https://api.search.tinyfish.io").rstrip("/")
        self.fetch_url = os.environ.get("TINYFISH_FETCH_URL", "https://api.fetch.tinyfish.io").rstrip("/")
        self.mcp_url = os.environ.get("TINYFISH_MCP_URL", "https://agent.tinyfish.ai/mcp").rstrip("/")
        self.default_limit = min(int(os.environ.get("MK_TINYFISH_LIMIT", "2")), self.MAX_CREDIT_GUARD_LIMIT)
        self.timeout_sec = int(os.environ.get("MK_TINYFISH_TIMEOUT", "30"))

    def has_valid_key(self) -> bool:
        if not self.api_key:
            return False
        low = self.api_key.lower()
        return len(self.api_key) >= 12 and "placeholder" not in low and "your_" not in low

    def status(self) -> Dict[str, Any]:
        if not self.has_valid_key():
            return {
                "ok": False,
                "engine": "tinyfish-squad",
                "status": "DEMO" if is_demo_mode() else "Needs auth",
                "demo_mode": is_demo_mode(),
                "credit_guard_max_limit": self.MAX_CREDIT_GUARD_LIMIT,
                "agents": ["lead_hunter", "competitor_watch", "content_scout", "opportunity_radar"],
                "error": "TINYFISH_API_KEY not configured in environment.",
                "hint": "Set TINYFISH_API_KEY in .env to run live TinyFish web agents, or pass --dry-run to inspect the execution plan.",
            }
        req = urllib.request.Request(
            f"{self.base_url}/v1/health",
            headers={"Authorization": f"Bearer {self.api_key}", "User-Agent": "tinyfish-squad/1.0"},
            method="GET",
        )
        try:
            with urllib.request.urlopen(req, timeout=8) as resp:
                return {
                    "ok": True,
                    "engine": "tinyfish-squad",
                    "status": "Connected",
                    "http_status": resp.status,
                    "demo_mode": False,
                    "credit_guard_max_limit": self.MAX_CREDIT_GUARD_LIMIT,
                    "agents": ["lead_hunter", "competitor_watch", "content_scout", "opportunity_radar"],
                }
        except Exception as exc:
            return {
                "ok": False,
                "engine": "tinyfish-squad",
                "status": "Error",
                "demo_mode": False,
                "credit_guard_max_limit": self.MAX_CREDIT_GUARD_LIMIT,
                "agents": ["lead_hunter", "competitor_watch", "content_scout", "opportunity_radar"],
                "error": f"TinyFish endpoint unreachable ({self.base_url}): {exc}",
                "hint": "Check internet access and TINYFISH_API_KEY, or run with --dry-run.",
            }

    def execute_squad_mission(
        self,
        squad_agent: str,
        query: str,
        limit: int = 2,
        dry_run: bool = False,
        extra_params: Dict[str, Any] = None,
    ) -> Dict[str, Any]:
        capped_limit = max(1, min(int(limit), self.MAX_CREDIT_GUARD_LIMIT))
        plan = {
            "squad_agent": squad_agent,
            "query": query,
            "requested_limit": limit,
            "enforced_credit_limit": capped_limit,
            "max_retries": 2,
            "endpoints": {
                "search": self.search_url,
                "fetch": self.fetch_url,
                "agent": f"{self.base_url}/v1/agent/run",
            },
            "extra_params": extra_params or {},
        }
        if dry_run:
            return {
                "ok": True,
                "dry_run": True,
                "demo_mode": False,
                "engine": "tinyfish-squad",
                "plan": plan,
                "items": [],
                "message": f"Dry-run validated for {squad_agent} (credit guard capped at {capped_limit} pages).",
            }

        if not self.has_valid_key():
            if is_demo_mode():
                return {
                    "ok": True,
                    "dry_run": False,
                    "demo_mode": True,
                    "badge": "DEMO DATA",
                    "engine": "tinyfish-squad",
                    "plan": plan,
                    "items": [
                        {
                            "title": f"[DEMO DATA] {squad_agent} sample item #{i + 1} for '{query}'",
                            "url": "https://mkai.tech",
                            "evidence_url": "https://mkai.tech",
                            "demo_mode": True,
                        }
                        for i in range(capped_limit)
                    ],
                }
            return {
                "ok": False,
                "dry_run": False,
                "demo_mode": False,
                "engine": "tinyfish-squad",
                "plan": plan,
                "error": "TINYFISH_API_KEY is missing or placeholder; refusing to invent fake results (Rule 3).",
                "hint": "Set TINYFISH_API_KEY in .env, use --dry-run to verify mission parameters, or set MKAI_DEMO_MODE=1.",
            }

        last_err = ""
        for attempt in range(1, 3):
            req = urllib.request.Request(
                f"{self.base_url}/v1/agent/run",
                data=json.dumps({"agent": squad_agent, "goal": query, "limit": capped_limit, **(extra_params or {})}).encode("utf-8"),
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {self.api_key}",
                    "User-Agent": "tinyfish-squad/1.0",
                },
                method="POST",
            )
            try:
                with urllib.request.urlopen(req, timeout=self.timeout_sec) as resp:
                    data = json.loads(resp.read().decode("utf-8", errors="replace") or "{}")
                    return {
                        "ok": True,
                        "dry_run": False,
                        "demo_mode": False,
                        "engine": "tinyfish-squad",
                        "attempt": attempt,
                        "plan": plan,
                        "items": data.get("items", []),
                        "raw": data,
                    }
            except Exception as exc:
                last_err = str(exc)
                time.sleep(0.2 * attempt)

        return {
            "ok": False,
            "dry_run": False,
            "demo_mode": False,
            "engine": "tinyfish-squad",
            "plan": plan,
            "error": f"TinyFish Squad '{squad_agent}' failed after 2 retries: {last_err}",
            "hint": "Verify network access to https://agent.tinyfish.ai and TINYFISH_API_KEY validity. Zero fake results returned.",
        }


def main() -> int:
    parser = argparse.ArgumentParser(prog="tinyfish-squad", description="TinyFish 4-Agent Web Squad CLI")
    sub = parser.add_subparsers(dest="cmd", required=True)

    sub.add_parser("status", help="Check TinyFish Squad health and credit guard configuration")

    for cmd_name, desc in [
        ("leads", "Lead Hunter: discover and qualify B2B/local leads"),
        ("competitors", "Competitor Watch: monitor competitor pricing and pages"),
        ("content", "Content Scout: research high-signal articles and hooks"),
        ("radar", "Opportunity Radar: find internships, hackathons, and grants"),
    ]:
        p = sub.add_parser(cmd_name, help=desc)
        p.add_argument("--query", default="B2B leads", help="Search query or mission goal")
        p.add_argument("--location", default="", help="Optional city/region filter")
        p.add_argument("--urls", default="", help="Optional comma-separated target URLs")
        p.add_argument("--limit", type=int, default=2, help="Max items/pages (credit guard cap: 10)")
        p.add_argument("--dry-run", action="store_true", help="Validate mission plan and credit guards without spending API credits")

    args = parser.parse_args()
    runner = TinyFishSquadRunner()

    if args.cmd == "status":
        res = runner.status()
        print(json.dumps(res, indent=2))
        return 0 if res.get("ok") else 1

    res = runner.execute_squad_mission(
        squad_agent=args.cmd,
        query=args.query,
        limit=args.limit,
        dry_run=args.dry_run,
        extra_params={"location": args.location, "urls": [u.strip() for u in args.urls.split(",") if u.strip()]},
    )
    print(json.dumps(res, indent=2))
    return 0 if res.get("ok") else 1


if __name__ == "__main__":
    sys.exit(main())
