#!/usr/bin/env python3
"""
MCP & CLI Adapter for Mahanaicoach/google-maps-scraper-kit (wrapping gosom/google-maps-scraper on 127.0.0.1:8080).
Exposes:
- status()
- maps_leads_search(query, city, limit)
- job_status(job_id)
- download_csv(job_id, out_path)
Enforces Rule 3: Never returns invented leads when 127.0.0.1:8080 is unreachable unless MKAI_DEMO_MODE=1.
"""
import csv
import json
import os
import urllib.error
import urllib.parse
import urllib.request
from typing import Any, Dict, List, Optional


def is_demo_mode() -> bool:
    return os.environ.get("MKAI_DEMO_MODE", "0").strip().lower() in ("1", "true", "yes")


class GoogleMapsScraperAdapter:
    def __init__(self, base_url: Optional[str] = None) -> None:
        self.base_url = (base_url or os.environ.get("GOSOM_MAPS_API_URL", "http://127.0.0.1:8080")).rstrip("/")

    def status(self) -> Dict[str, Any]:
        req = urllib.request.Request(f"{self.base_url}/api/v1/jobs", method="GET")
        try:
            with urllib.request.urlopen(req, timeout=3) as resp:
                return {
                    "ok": True,
                    "engine": "Mahanaicoach/google-maps-scraper-kit (gosom/google-maps-scraper)",
                    "license": "MIT",
                    "status": "Connected",
                    "endpoint": self.base_url,
                    "http_status": resp.status,
                    "demo_mode": False,
                }
        except Exception as exc:
            return {
                "ok": False,
                "engine": "Mahanaicoach/google-maps-scraper-kit (gosom/google-maps-scraper)",
                "license": "MIT",
                "status": "DEMO" if is_demo_mode() else "Error",
                "endpoint": self.base_url,
                "demo_mode": is_demo_mode(),
                "error": f"gosom/google-maps-scraper REST service not reachable at {self.base_url}: {exc}",
                "hint": "Start the Docker service (`docker run -p 8080:8080 gosom/google-maps-scraper`) or set GOSOM_MAPS_API_URL in .env.",
            }

    def maps_leads_search(self, query: str, city: str, limit: int = 5) -> Dict[str, Any]:
        limit = max(1, min(int(limit), 50))
        payload = {
            "name": f"{query} in {city}",
            "keywords": [f"{query} {city}"],
            "lang": "en",
            "depth": 1,
            "max_results": limit,
        }
        req = urllib.request.Request(
            f"{self.base_url}/api/v1/jobs",
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read().decode("utf-8", errors="replace") or "{}")
                return {
                    "ok": True,
                    "demo_mode": False,
                    "engine": "google-maps-scraper-kit",
                    "query": query,
                    "city": city,
                    "limit": limit,
                    "job": data,
                }
        except Exception as exc:
            if is_demo_mode():
                return {
                    "ok": True,
                    "demo_mode": True,
                    "badge": "DEMO DATA",
                    "engine": "google-maps-scraper-kit",
                    "query": query,
                    "city": city,
                    "limit": limit,
                    "warning": "DEMO DATA — Returned only because MKAI_DEMO_MODE=1 is set.",
                    "leads": [
                        {
                            "title": f"[DEMO DATA] {query.title()} #{i+1} ({city})",
                            "city": city,
                            "website": "https://mkai.tech",
                            "evidence_url": "https://mkai.tech",
                            "email": "info@mkai.tech" if i % 2 == 0 else "no public email",
                            "demo_mode": True,
                        }
                        for i in range(limit)
                    ],
                }
            return {
                "ok": False,
                "demo_mode": False,
                "engine": "google-maps-scraper-kit",
                "query": query,
                "city": city,
                "limit": limit,
                "error": f"Maps Leads Scraper service at {self.base_url} is unreachable: {exc}",
                "hint": "Run `docker compose up -d google-maps-scraper` on port 8080. Zero fake leads returned (Rule 3).",
            }

    def job_status(self, job_id: str) -> Dict[str, Any]:
        req = urllib.request.Request(f"{self.base_url}/api/v1/jobs/{urllib.parse.quote(job_id)}", method="GET")
        try:
            with urllib.request.urlopen(req, timeout=5) as resp:
                return {"ok": True, "job_id": job_id, "data": json.loads(resp.read().decode("utf-8", errors="replace"))}
        except Exception as exc:
            return {
                "ok": False,
                "job_id": job_id,
                "error": f"Unable to fetch job_status for {job_id} from {self.base_url}: {exc}",
                "hint": "Ensure gosom/google-maps-scraper is running on 127.0.0.1:8080.",
            }

    def download_csv(self, job_id: str, out_path: str) -> Dict[str, Any]:
        req = urllib.request.Request(f"{self.base_url}/api/v1/jobs/{urllib.parse.quote(job_id)}/download", method="GET")
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                raw = resp.read()
                os.makedirs(os.path.dirname(os.path.abspath(out_path)), exist_ok=True)
                with open(out_path, "wb") as f:
                    f.write(raw)
                return {"ok": True, "job_id": job_id, "csv_path": os.path.abspath(out_path), "bytes": len(raw)}
        except Exception as exc:
            return {
                "ok": False,
                "job_id": job_id,
                "error": f"Unable to download CSV for job {job_id}: {exc}",
                "hint": "Ensure job has finished and 127.0.0.1:8080 is reachable.",
            }


if __name__ == "__main__":
    import argparse
    p = argparse.ArgumentParser()
    p.add_argument("--query", default="dental clinics")
    p.add_argument("--city", default="Dwarka, Delhi")
    p.add_argument("--limit", type=int, default=5)
    p.add_argument("--status", action="store_true")
    args = p.parse_args()
    adapter = GoogleMapsScraperAdapter()
    if args.status:
        print(json.dumps(adapter.status(), indent=2))
    else:
        print(json.dumps(adapter.maps_leads_search(args.query, args.city, args.limit), indent=2))
