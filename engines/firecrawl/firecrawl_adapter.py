#!/usr/bin/env python3
"""
Firecrawl External Service Adapter (MIT client wrapper; zero AGPL source copied).
Supports:
- status()
- firecrawl_scrape(url, formats=["markdown"])
- firecrawl_map(url, limit=20)
"""
import json
import os
import urllib.error
import urllib.request
from typing import Any, Dict, List, Optional


def is_demo_mode() -> bool:
    return os.environ.get("MKAI_DEMO_MODE", "0").strip().lower() in ("1", "true", "yes")


class FirecrawlServiceAdapter:
    def __init__(self) -> None:
        self.api_url = os.environ.get("FIRECRAWL_API_URL", "https://api.firecrawl.dev").rstrip("/")
        self.api_key = os.environ.get("FIRECRAWL_API_KEY", "").strip()

    def _has_auth_or_self_hosted(self) -> bool:
        if "127.0.0.1" in self.api_url or "localhost" in self.api_url:
            return True
        if not self.api_key:
            return False
        low = self.api_key.lower()
        return len(self.api_key) >= 10 and "placeholder" not in low and "your_" not in low

    def status(self) -> Dict[str, Any]:
        if not self._has_auth_or_self_hosted():
            return {
                "ok": False,
                "engine": "firecrawl/firecrawl (via MCP / REST)",
                "license": "AGPL-3.0 service (zero source copied) / MIT MCP client",
                "status": "DEMO" if is_demo_mode() else "Needs auth",
                "api_url": self.api_url,
                "demo_mode": is_demo_mode(),
                "error": "FIRECRAWL_API_KEY is not configured and FIRECRAWL_API_URL is not pointing to a local self-hosted instance.",
                "hint": "Set FIRECRAWL_API_KEY in .env or point FIRECRAWL_API_URL to http://127.0.0.1:3002.",
            }
        req = urllib.request.Request(f"{self.api_url}/v1/health", method="GET")
        try:
            with urllib.request.urlopen(req, timeout=4) as resp:
                return {
                    "ok": True,
                    "engine": "firecrawl/firecrawl",
                    "status": "Connected",
                    "api_url": self.api_url,
                    "http_status": resp.status,
                    "demo_mode": False,
                }
        except Exception as exc:
            return {
                "ok": False,
                "engine": "firecrawl/firecrawl",
                "status": "Error",
                "api_url": self.api_url,
                "demo_mode": False,
                "error": f"Firecrawl endpoint {self.api_url} unreachable: {exc}",
                "hint": "Verify network connectivity or start self-hosted Firecrawl container.",
            }

    def scrape(self, url: str, formats: Optional[List[str]] = None) -> Dict[str, Any]:
        if not self._has_auth_or_self_hosted():
            if is_demo_mode():
                return {
                    "ok": True,
                    "demo_mode": True,
                    "badge": "DEMO DATA",
                    "url": url,
                    "markdown": f"# [DEMO DATA] Scraped Markdown for {url}\n\nGenerated because MKAI_DEMO_MODE=1 is enabled.",
                }
            return {
                "ok": False,
                "demo_mode": False,
                "url": url,
                "error": "Firecrawl cannot scrape without FIRECRAWL_API_KEY or a self-hosted FIRECRAWL_API_URL.",
                "hint": "Set FIRECRAWL_API_KEY in .env or start a local Firecrawl service.",
            }
        headers = {"Content-Type": "application/json", "User-Agent": "MK-AI-Firecrawl-Client/1.0"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        req = urllib.request.Request(
            f"{self.api_url}/v1/scrape",
            data=json.dumps({"url": url, "formats": formats or ["markdown"]}).encode("utf-8"),
            headers=headers,
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                return {"ok": True, "demo_mode": False, "url": url, "data": json.loads(resp.read().decode("utf-8", errors="replace"))}
        except Exception as exc:
            return {
                "ok": False,
                "demo_mode": False,
                "url": url,
                "error": f"Firecrawl scrape failed for {url}: {exc}",
                "hint": "Check Firecrawl service health and network access.",
            }


if __name__ == "__main__":
    import sys
    fc = FirecrawlServiceAdapter()
    if len(sys.argv) > 1 and sys.argv[1].startswith("http"):
        print(json.dumps(fc.scrape(sys.argv[1]), indent=2))
    else:
        print(json.dumps(fc.status(), indent=2))
