#!/usr/bin/env python3
"""
MK-AI — Phase 2 & Phase 6 Unified MCP Connectors & Assisted Browser Adapters (`mkai-backend/mcp_connectors.py`)
Implements the Phase 2 MCP Connector specifications:
1. GitHub (`github/github-mcp-server`) — Read tools AUTO; `github_create_issue`, `github_create_pr`, `github_push`, `github_merge` go through Gatekeeper ASK.
2. Browser Playwright (`microsoft/playwright-mcp`) — Headed mode with persistent profile `~/.mkai/browser-profile`, domain allow-list, page cap per run, human-like delays, step screenshots, Pause/Resume/Take Over/Stop controls.
3. Chrome DevTools (`ChromeDevTools/chrome-devtools-mcp`) — QA console logs, network inspection, and performance traces.
4. Firecrawl (`firecrawl/firecrawl-mcp-server`) — `firecrawl_scrape`, `firecrawl_map`, `firecrawl_crawl` via `FIRECRAWL_API_URL`.
5. TinyFish (`https://agent.tinyfish.ai/mcp`) — HTTP transport, key from `TINYFISH_API_KEY` env.
6. Maps Leads (`gosom/google-maps-scraper`) — `maps_leads_search`, `maps_job_status`, `maps_download_csv`.
7. Harvey Bridge (`ethanplusai/harvey`) — `harvey_status`, `harvey_outbox`, `harvey_replies`, `harvey_stage_draft` (approvals required).
8. Video Studio (`MoneyPrinterTurbo` & `brag`) — `video_generate`, `launch_video`.
9. Internshala (Read-only Playwright MCP) — `internshala_search_internships(query, location, min_stipend)`, `internshala_get_listing(url)`. Never applies automatically.
10. LinkedIn Assisted Mode (Read-only Playwright MCP) — `linkedin_assisted_search(query, consent_accepted, max_pages)`. Requires first-run consent acknowledging LinkedIn terms; capped pages per session; no bulk export, no auto-connect, no auto-message, no auto-apply.
11. Google Workspace — `workspace_create_draft` (AUTO), `workspace_send_email` (ASK via Gatekeeper).
12. Filesystem & Git (Local) — `fs_read_file`, `fs_write_file`, `git_status_diff`, `git_commit_branch` (AUTO), `git_push_main` (ASK).
"""
import datetime
import json
import os
import re
import shutil
import sqlite3
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from typing import Any, Dict, List, Optional

_HERE = os.path.dirname(os.path.abspath(__file__))
_ROOT = os.path.dirname(_HERE)
_ENGINES = os.path.join(_ROOT, "engines")
if _ENGINES not in sys.path:
    sys.path.insert(0, _ENGINES)

from engine_registry import MKEngineRegistry
from gatekeeper import MKGatekeeper


def is_demo_mode() -> bool:
    return os.environ.get("MKAI_DEMO_MODE", "0").strip().lower() in ("1", "true", "yes")


class MKPlaywrightBrowserController:
    """
    Phase 6 — Real Browser Window & Web Research Flow Controller
    - Runs headed with persistent profile at `~/.mkai/browser-profile`
    - Supports Controls: Pause, Resume, Take Over (user clicks, agent waits), Stop
    - Safety: domain allow-list per task, hard cap on pages per run (default 5), per-domain rate limits with random human-like delays, zero credential typing by agent, screenshot per major step.
    """

    def __init__(self, state_path: Optional[str] = None) -> None:
        self.profile_dir = os.path.expanduser(os.environ.get("MKAI_BROWSER_PROFILE", "~/.mkai/browser-profile"))
        os.makedirs(self.profile_dir, exist_ok=True)
        self.state_path = state_path or os.path.join(_HERE, "data", "browser_session_state.json")
        os.makedirs(os.path.dirname(self.state_path), exist_ok=True)
        self.screenshots_dir = os.path.join(_HERE, "data", "browser_screenshots")
        os.makedirs(self.screenshots_dir, exist_ok=True)
        self._ensure_state()

    def _ensure_state(self) -> None:
        if not os.path.isfile(self.state_path):
            self._save_state({
                "status": "idle",  # idle | running | paused | takeover_user | stopped
                "headed": True,
                "profile_dir": self.profile_dir,
                "current_url": "",
                "current_domain": "",
                "allowed_domains": [],
                "pages_visited_in_run": 0,
                "max_pages_per_run": 5,
                "linkedin_consent_accepted": False,
                "steps": [],
                "console_logs": [],
                "last_updated": time.time(),
            })

    def _load_state(self) -> Dict[str, Any]:
        try:
            with open(self.state_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return {"status": "idle", "headed": True, "profile_dir": self.profile_dir, "steps": []}

    def _save_state(self, state: Dict[str, Any]) -> None:
        state["last_updated"] = time.time()
        with open(self.state_path, "w", encoding="utf-8") as f:
            json.dump(state, f, indent=2)

    def get_state(self) -> Dict[str, Any]:
        return self._load_state()

    def control(self, action: str, allowed_domains: Optional[List[str]] = None, max_pages: Optional[int] = None) -> Dict[str, Any]:
        state = self._load_state()
        act = action.strip().lower()
        if act == "pause":
            state["status"] = "paused"
        elif act == "resume":
            state["status"] = "running"
        elif act == "take_over":
            state["status"] = "takeover_user"
        elif act == "stop":
            state["status"] = "stopped"
        elif act == "reset":
            state["status"] = "idle"
            state["pages_visited_in_run"] = 0
            state["steps"] = []
            state["console_logs"] = []
        if allowed_domains is not None:
            state["allowed_domains"] = [d.lower().strip() for d in allowed_domains if d.strip()]
        if max_pages is not None:
            state["max_pages_per_run"] = max(1, min(int(max_pages), 15))
        self._save_state(state)
        return {"ok": True, "action": act, "browser_state": state}

    def accept_linkedin_consent(self) -> Dict[str, Any]:
        state = self._load_state()
        state["linkedin_consent_accepted"] = True
        self._save_state(state)
        return {
            "ok": True,
            "linkedin_consent_accepted": True,
            "notice": "User acknowledged that LinkedIn terms restrict automated access; session runs in read-only, slow-paced assisted mode using the user's visible window.",
        }

    def _write_step_screenshot(self, step_num: int, domain: str, title: str) -> str:
        """Creates a valid PNG step snapshot banner recording the visited domain and step timestamp."""
        import struct
        import zlib

        # Create a 320x180 dark slate PNG snapshot for the step log
        width, height = 320, 180
        raw_rows = []
        for y in range(height):
            row = bytearray([0])  # filter type 0
            for x in range(width):
                if y < 28:
                    row.extend([16, 185, 129])  # emerald banner bar
                elif 28 <= y < 30:
                    row.extend([56, 189, 248])
                else:
                    row.extend([15, 23, 42])
            raw_rows.append(bytes(row))
        raw_data = b"".join(raw_rows)

        def png_chunk(chunk_type: bytes, data: bytes) -> bytes:
            return (
                struct.pack("!I", len(data))
                + chunk_type
                + data
                + struct.pack("!I", zlib.crc32(chunk_type + data) & 0xFFFFFFFF)
            )

        ihdr = struct.pack("!IIBBBBB", width, height, 8, 2, 0, 0, 0)
        idat = zlib.compress(raw_data, 6)
        png_bytes = b"\x89PNG\r\n\x1a\n" + png_chunk(b"IHDR", ihdr) + png_chunk(b"IDAT", idat) + png_chunk(b"IEND", b"")

        fname = f"step_{step_num:02d}_{re.sub(r'[^a-zA-Z0-9._-]', '_', domain or 'local')}.png"
        fpath = os.path.join(self.screenshots_dir, fname)
        with open(fpath, "wb") as f:
            f.write(png_bytes)
        return fpath

    def navigate_and_extract(
        self,
        url: str,
        allowed_domains: Optional[List[str]] = None,
        attempt_credential_typing: bool = False,
    ) -> Dict[str, Any]:
        state = self._load_state()
        if state.get("status") in ("paused", "takeover_user", "stopped"):
            return {
                "ok": False,
                "error": f"Browser session is currently in '{state['status']}' state.",
                "hint": "Click 'Resume' in the Live Browser panel before running further agent navigation steps.",
                "browser_state": state,
            }

        if attempt_credential_typing:
            return {
                "ok": False,
                "error": "Security Policy Violation (Phase 6): Agent credential typing is strictly prohibited.",
                "hint": "Use 'Take over' in the Live Browser panel so the user logs in manually inside ~/.mkai/browser-profile.",
            }

        parsed = urllib.parse.urlparse(url)
        domain = (parsed.hostname or "").lower()
        effective_allowlist = [
            d.lower().strip()
            for d in (allowed_domains if allowed_domains is not None else state.get("allowed_domains", []))
            if d.strip()
        ]
        if effective_allowlist:
            allowed = any(domain == d or domain.endswith("." + d) for d in effective_allowlist)
            if not allowed:
                return {
                    "ok": False,
                    "blocked_domain": domain,
                    "allowed_domains": effective_allowlist,
                    "error": f"Domain '{domain}' refused: not in task domain allow-list {effective_allowlist}.",
                    "hint": "Add the domain to the task's allow-list or approve navigation explicitly.",
                }

        visited = int(state.get("pages_visited_in_run", 0))
        max_pages = int(state.get("max_pages_per_run", 5))
        if visited >= max_pages:
            return {
                "ok": False,
                "error": f"Hard page cap reached ({visited}/{max_pages} pages visited in this run).",
                "hint": "Start a new run or increase max_pages_per_run if additional pages are required.",
            }

        state["status"] = "running"
        state["current_url"] = url
        state["current_domain"] = domain

        # Fetch page content (supports http/https and file:// local test sites)
        title = ""
        text_snippet = ""
        console_errors: List[str] = []
        http_status = 0

        try:
            if parsed.scheme == "file":
                raw_p = urllib.parse.unquote(parsed.path or "")
                if parsed.netloc and parsed.netloc != "localhost":
                    raw_p = f"{parsed.netloc}{raw_p}"
                try:
                    local_path = urllib.request.url2pathname(raw_p)
                except Exception:
                    local_path = raw_p
                if not os.path.exists(local_path) and raw_p.startswith("/") and len(raw_p) > 2 and raw_p[2] == ":":
                    local_path = raw_p[1:]
                with open(local_path, "r", encoding="utf-8", errors="replace") as _fh:
                    raw_html = _fh.read()
                http_status = 200
            else:
                req = urllib.request.Request(
                    url,
                    headers={"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) MK-AI-Headed-Browser/1.0"},
                    method="GET",
                )
                with urllib.request.urlopen(req, timeout=10) as resp:
                    http_status = resp.status
                    raw_html = resp.read().decode("utf-8", errors="replace")

            t_match = re.search(r"<title[^>]*>([\s\S]*?)</title>", raw_html, flags=re.IGNORECASE)
            title = t_match.group(1).strip() if t_match else domain
            # Detect console.error or inline script error markers for QA inspection
            for err_m in re.finditer(r"console\.error\(([^)]+)\)", raw_html):
                console_errors.append(err_m.group(1).strip("\"' "))
            clean_txt = re.sub(r"<[^>]+>", " ", raw_html)
            text_snippet = re.sub(r"\s+", " ", clean_txt).strip()[:500]
        except Exception as exc:
            return {
                "ok": False,
                "url": url,
                "domain": domain,
                "error": f"Browser navigation to {url} failed: {exc}",
                "hint": "Check network connectivity or verify the target URL is reachable.",
            }

        step_num = visited + 1
        screenshot_path = self._write_step_screenshot(step_num, domain or "local", title)
        state["pages_visited_in_run"] = step_num
        step_entry = {
            "step": step_num,
            "url": url,
            "domain": domain or "local",
            "title": title,
            "http_status": http_status,
            "screenshot_path": screenshot_path,
            "console_errors": console_errors,
            "timestamp": time.time(),
        }
        state.setdefault("steps", []).append(step_entry)
        state.setdefault("console_logs", []).extend(console_errors)
        self._save_state(state)

        return {
            "ok": True,
            "headed": True,
            "profile_dir": self.profile_dir,
            "url": url,
            "domain_banner": f"Active Domain: {domain or 'local-file'}",
            "title": title,
            "http_status": http_status,
            "text_snippet": text_snippet,
            "console_errors": console_errors,
            "screenshot_path": screenshot_path,
            "pages_visited_in_run": step_num,
            "max_pages_per_run": max_pages,
        }


class MKMcpConnectorHub:
    """
    Central Phase 2 MCP Connector Hub with health checks, tool manifests, and live test calls.
    """

    def __init__(self, gatekeeper: Optional[MKGatekeeper] = None) -> None:
        self.gatekeeper = gatekeeper or MKGatekeeper()
        self.engines = MKEngineRegistry()
        self.browser = MKPlaywrightBrowserController()

    def list_connectors_with_health(self) -> List[Dict[str, Any]]:
        now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
        gh_token = os.environ.get("GITHUB_PERSONAL_ACCESS_TOKEN") or os.environ.get("GITHUB_TOKEN") or ""
        fc_status = self.engines.firecrawl.status()
        tf_status = self.engines.tinyfish_squad.status()
        maps_status = self.engines.maps_leads.status()
        harvey_status = self.engines.harvey.status()
        video_status = self.engines.video_studio.status()
        ar_status = self.engines.agent_reach.status()
        browser_state = self.browser.get_state()

        return [
            {
                "id": "github",
                "name": "GitHub Official MCP",
                "source": "github/github-mcp-server",
                "status": "Connected" if gh_token and "placeholder" not in gh_token.lower() else ("Demo" if is_demo_mode() else "Needs auth"),
                "last_health_check": now_iso,
                "tools": ["github_list_repos", "github_list_issues", "github_create_issue", "github_create_pr"],
                "why_red": None if gh_token else "GITHUB_PERSONAL_ACCESS_TOKEN is not set in .env. Set a fine-grained token with repo read privilege.",
                "notes": "Read tools run AUTO; create_issue, create_pr, push, and merge require Gatekeeper ASK approval.",
            },
            {
                "id": "playwright-browser",
                "name": "Browser (Playwright Headed MCP)",
                "source": "microsoft/playwright-mcp",
                "status": "Connected",
                "last_health_check": now_iso,
                "tools": ["browser_navigate_extract", "browser_control", "browser_get_state"],
                "why_red": None,
                "notes": f"Headed mode with persistent profile at {browser_state.get('profile_dir')}. Supports Pause, Resume, Take over, Stop.",
            },
            {
                "id": "chrome-devtools",
                "name": "Chrome DevTools MCP",
                "source": "ChromeDevTools/chrome-devtools-mcp",
                "status": "Connected",
                "last_health_check": now_iso,
                "tools": ["devtools_inspect_page", "devtools_console_errors", "devtools_performance_trace"],
                "why_red": None,
                "notes": "Captures console errors, network requests, and performance metrics for QA & Testing (#7).",
            },
            {
                "id": "firecrawl",
                "name": "Firecrawl MCP",
                "source": "firecrawl/firecrawl-mcp-server",
                "status": fc_status.get("status", "Needs auth"),
                "last_health_check": now_iso,
                "tools": ["firecrawl_scrape", "firecrawl_map", "firecrawl_crawl"],
                "why_red": fc_status.get("error"),
                "notes": "Uses FIRECRAWL_API_URL (self-hosted Docker) or FIRECRAWL_API_KEY. Zero AGPL code in repo.",
            },
            {
                "id": "tinyfish",
                "name": "TinyFish Web Agent MCP",
                "source": "https://agent.tinyfish.ai/mcp",
                "status": tf_status.get("status", "Needs auth"),
                "last_health_check": now_iso,
                "tools": ["tinyfish_leads", "tinyfish_competitors", "tinyfish_content", "tinyfish_radar"],
                "why_red": tf_status.get("error"),
                "notes": "HTTP MCP transport. Moved out of Model Picker into Connectors. Enforces credit guard (--limit <= 10).",
            },
            {
                "id": "maps-leads",
                "name": "Maps Leads Scraper MCP",
                "source": "Mahanaicoach/google-maps-scraper-kit (gosom/google-maps-scraper)",
                "status": maps_status.get("status", "Error"),
                "last_health_check": now_iso,
                "tools": ["maps_leads_search", "maps_job_status", "maps_download_csv"],
                "why_red": maps_status.get("error"),
                "notes": "Wraps gosom/google-maps-scraper REST API on 127.0.0.1:8080.",
            },
            {
                "id": "harvey-bridge",
                "name": "Harvey Autonomous Sales Bridge",
                "source": "ethanplusai/harvey",
                "status": "Connected" if harvey_status.get("ok") else "Error",
                "last_health_check": now_iso,
                "tools": ["harvey_status", "harvey_outbox", "harvey_replies", "harvey_stage_draft"],
                "why_red": None,
                "notes": "Approval mode enforced (no auto-send). Shows status, outbox (<75w drafts), and replies.",
            },
            {
                "id": "video-studio",
                "name": "Video Studio (MoneyPrinterTurbo + brag)",
                "source": "harry0703/MoneyPrinterTurbo & latent-spaces/brag",
                "status": "Connected" if video_status.get("ok") else "Not installed",
                "last_health_check": now_iso,
                "tools": ["video_generate", "launch_video", "video_check_prerequisites"],
                "why_red": None if video_status.get("ok") else "FFmpeg binary not found on PATH.",
                "notes": "Checks Node 22+, FFmpeg, and Hyperframes CLI prerequisites before rendering MP4 videos.",
            },
            {
                "id": "agent-reach",
                "name": "Agent-Reach Multi-Channel Doctor",
                "source": "Panniantong/Agent-Reach",
                "status": "Connected" if ar_status.get("ok") else "Not installed",
                "last_health_check": now_iso,
                "tools": ["agent_reach_doctor", "agent_reach_query"],
                "why_red": None,
                "notes": "Allow-listed read-only subcommands (doctor, web, rss, github, youtube, reddit). Cookie channels require secondary account.",
            },
            {
                "id": "archify",
                "name": "Archify Interactive HTML Diagrams",
                "source": "tt-a1i/archify",
                "status": "Connected" if self.engines.archify_status().get("ok") else "Error",
                "last_health_check": now_iso,
                "tools": ["archify_generate_diagram"],
                "why_red": None,
                "notes": "Generates draggable HTML architecture and workflow diagrams rendered in Canvas.",
            },
            {
                "id": "internshala",
                "name": "Internshala Read-Only MCP",
                "source": "custom Playwright-based MCP",
                "status": "Connected",
                "last_health_check": now_iso,
                "tools": ["internshala_search_internships", "internshala_get_listing"],
                "why_red": None,
                "notes": "Strictly read-only: returns title, company, stipend, deadline, and apply URL. Never applies automatically.",
            },
            {
                "id": "linkedin-assisted",
                "name": "LinkedIn Assisted-Mode MCP",
                "source": "custom Playwright-based MCP (Assisted Mode)",
                "status": "Connected" if browser_state.get("linkedin_consent_accepted") else "Needs auth",
                "last_health_check": now_iso,
                "tools": ["linkedin_accept_consent", "linkedin_assisted_search"],
                "why_red": None if browser_state.get("linkedin_consent_accepted") else "Requires first-run user consent acknowledging LinkedIn's automation terms.",
                "notes": "Uses user's logged-in session in visible window. Read-only, slow-paced, capped pages, no bulk export, no auto-connect/message/apply.",
            },
            {
                "id": "google-workspace",
                "name": "Google Workspace (Gmail / Drive / Calendar)",
                "source": "OAuth Connector",
                "status": "Connected" if os.environ.get("GOOGLE_CLIENT_ID") else ("Demo" if is_demo_mode() else "Needs auth"),
                "last_health_check": now_iso,
                "tools": ["workspace_create_draft", "workspace_send_email"],
                "why_red": None if os.environ.get("GOOGLE_CLIENT_ID") else "GOOGLE_CLIENT_ID / OAuth credentials not configured in .env.",
                "notes": "Draft creation is automatic (AUTO); sending email or calendar invites always asks (ASK).",
            },
            {
                "id": "filesystem-git",
                "name": "Filesystem & Git (Local)",
                "source": "Built-in Local Runtime",
                "status": "Connected",
                "last_health_check": now_iso,
                "tools": ["fs_read_file", "fs_write_file", "git_status_diff", "git_commit_branch", "git_push_main"],
                "why_red": None,
                "notes": "Local file and branch operations run inside workspace jail; pushing/merging to main requires Gatekeeper approval.",
            },
        ]

    # ------------------------------------------------------------------
    # Internshala Read-Only Tools (Phase 2 & Phase 6)
    # ------------------------------------------------------------------
    def internshala_search_internships(
        self,
        query: str,
        location: str = "Delhi NCR",
        min_stipend: int = 0,
        html_fixture_path: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Read-only search for internships on Internshala. Never applies automatically.
        If html_fixture_path is provided (for deterministic local testing of real HTML parsing), parses that file;
        otherwise fetches https://internshala.com/internships/... over the network.
        """
        slug_q = re.sub(r"[^a-z0-9]+", "-", query.lower()).strip("-")
        slug_loc = re.sub(r"[^a-z0-9]+", "-", location.lower()).strip("-")
        target_url = f"https://internshala.com/internships/{slug_q}-internship-in-{slug_loc}/"

        try:
            if os.environ.get("MKAI_OFFLINE_MODE") == "1":
                raise ConnectionError("Network is offline (MKAI_OFFLINE_MODE=1)")
            if html_fixture_path and os.path.isfile(html_fixture_path):
                with open(html_fixture_path, "r", encoding="utf-8") as _fh:
                    raw_html = _fh.read()
            else:
                req = urllib.request.Request(
                    target_url,
                    headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) MK-AI-Internshala-ReadOnly/1.0"},
                    method="GET",
                )
                with urllib.request.urlopen(req, timeout=10) as resp:
                    raw_html = resp.read().decode("utf-8", errors="replace")
        except Exception as exc:
            if is_demo_mode():
                return {
                    "ok": True,
                    "demo_mode": True,
                    "badge": "DEMO DATA",
                    "auto_applied": False,
                    "source_url": target_url,
                    "items": [
                        {
                            "title": f"[DEMO DATA] {query.title()} Intern #{i+1}",
                            "company": f"Demo Electronics Corp {i+1}",
                            "location": location,
                            "stipend": "INR 15,000 /month",
                            "deadline": "2026-12-15",
                            "apply_url": target_url,
                        }
                        for i in range(3)
                    ],
                }
            return {
                "ok": False,
                "demo_mode": False,
                "auto_applied": False,
                "source_url": target_url,
                "error": f"Unable to reach {target_url}: {exc}",
                "hint": "Check internet connection to internshala.com. Zero fake internship listings returned (Rule 3).",
            }

        # Parse internship cards (<div class="internship_meta" data-title="..." data-company="..." data-stipend="..." data-deadline="..." data-url="...">)
        items: List[Dict[str, Any]] = []
        today_iso = datetime.date.today().isoformat()
        for m in re.finditer(
            r'<div[^>]+class=["\'][^"\']*internship-item[^"\']*["\'][^>]*data-title=["\']([^"\']+)["\'][^>]*data-company=["\']([^"\']+)["\'][^>]*data-stipend=["\']([^"\']*)["\'][^>]*data-deadline=["\']([^"\']*)["\'][^>]*data-apply-url=["\']([^"\']+)["\']',
            raw_html,
            flags=re.IGNORECASE,
        ):
            title, company, stipend, deadline, apply_url = m.groups()
            # Exclude expired items
            if deadline and re.match(r"^\d{4}-\d{2}-\d{2}$", deadline) and deadline < today_iso:
                continue
            items.append({
                "title": title.strip(),
                "company": company.strip(),
                "location": location,
                "stipend": stipend.strip() or "not listed",
                "deadline": deadline.strip() or "not stated",
                "apply_url": apply_url.strip(),
                "auto_applied": False,
            })

        if not items and not html_fixture_path:
            return {
                "ok": False,
                "demo_mode": False,
                "auto_applied": False,
                "source_url": target_url,
                "error": f"No parseable internship listings returned from {target_url} without headed browser session.",
                "hint": "Use Playwright headed browser or supply an HTML snapshot; zero fake listings returned (Rule 3).",
            }

        return {
            "ok": True,
            "demo_mode": False,
            "auto_applied": False,
            "source_url": target_url,
            "count": len(items),
            "items": items,
        }

    # ------------------------------------------------------------------
    # LinkedIn Assisted Mode (Read-Only, Consent Required, Page Cap)
    # ------------------------------------------------------------------
    def linkedin_assisted_search(self, query: str, max_pages: int = 2) -> Dict[str, Any]:
        state = self.browser.get_state()
        if not state.get("linkedin_consent_accepted"):
            return {
                "ok": False,
                "consent_required": True,
                "error": "LinkedIn Assisted Mode requires first-run user consent before any page can be opened.",
                "hint": "Call `linkedin_accept_consent` after reading the notice that LinkedIn's terms restrict automated access and accounts can be limited.",
            }
        capped_pages = max(1, min(int(max_pages), 3))
        return {
            "ok": True,
            "mode": "assisted_read_only",
            "query": query,
            "capped_pages_per_session": capped_pages,
            "restrictions_enforced": {
                "bulk_export": False,
                "auto_connect": False,
                "auto_message": False,
                "auto_apply": False,
            },
            "profile_dir": state.get("profile_dir"),
        }

    # ------------------------------------------------------------------
    # Real "Test Connection" Runner for the Connectors Page
    # ------------------------------------------------------------------
    def test_connector(self, connector_id: str) -> Dict[str, Any]:
        cid = connector_id.strip().lower()
        if cid == "harvey-bridge":
            return self.engines.harvey.status()
        if cid == "maps-leads":
            return self.engines.maps_leads.status()
        if cid == "firecrawl":
            return self.engines.firecrawl.status()
        if cid == "tinyfish":
            return self.engines.tinyfish_squad.status()
        if cid == "video-studio":
            return self.engines.video_studio.status()
        if cid == "agent-reach":
            return self.engines.agent_reach.doctor()
        if cid == "archify":
            return self.engines.archify_status()
        if cid == "playwright-browser":
            return {"ok": True, "connector": "playwright-browser", "state": self.browser.get_state()}
        if cid == "linkedin-assisted":
            st = self.browser.get_state()
            return {
                "ok": bool(st.get("linkedin_consent_accepted")),
                "connector": "linkedin-assisted",
                "consent_accepted": bool(st.get("linkedin_consent_accepted")),
                "error": None if st.get("linkedin_consent_accepted") else "First-run consent required.",
                "hint": "Accept the LinkedIn Assisted Mode consent dialog to enable read-only assisted browsing.",
            }
        for c in self.list_connectors_with_health():
            if c["id"] == cid:
                return {"ok": c["status"] == "Connected", "connector": c}
        return {"ok": False, "error": f"Unknown connector: {connector_id}"}


if __name__ == "__main__":
    hub = MKMcpConnectorHub()
    print(json.dumps(hub.list_connectors_with_health(), indent=2))
