#!/usr/bin/env python3
"""
MK-AI — Phase 4 Typed Result Contract, Tool-Use Capability Checker & Anti-Fabrication Post-Processor (`mkai-backend/anti_fabrication.py`)
Enforces:
1. Tool-Use Capability Check (`check_model_supports_tool_calling(model_id)`).
2. Typed Structured Result Contract:
   `{ summary, items[], evidence[], confidence, next_actions[], needs_approval[], anti_fabrication_report }`
3. Anti-Fabrication Post-Processing:
   - Rejects placeholder domains (`example.com`, `example.org`, `test.com`, `yourdomain.com`, `placeholder.com`).
   - Performs a real HEAD/GET check on every URL in `evidence[]` and `items[]` (supporting `http://`, `https://`, and local `file://` or existing file paths), rejecting any item whose evidence URL fails to resolve.
   - Flags results where numeric scores across 3+ items have near-zero variance (`max(scores) - min(scores) < 1.5`).
   - Checks future-date constraints for deadlines and source-page email grounding.
"""
import datetime
import math
import os
import re
import urllib.error
import urllib.parse
import urllib.request
from typing import Any, Dict, List, Optional, Tuple


PLACEHOLDER_DOMAINS = {
    "example.com",
    "www.example.com",
    "example.org",
    "example.net",
    "test.com",
    "yourdomain.com",
    "placeholder.com",
    "domain.com",
}

TOOL_CALLING_CAPABLE_PATTERNS = [
    r"gpt-oss-120b",
    r"deepseek-v3",
    r"gemma-4-31b",
    r"claude-3",
    r"claude-sonnet",
    r"claude-opus",
    r"gpt-4",
    r"gpt-5",
    r"o1",
    r"o3",
    r"qwen",
    r"mistral-large",
    r"llama-3\.3",
]


def check_model_supports_tool_calling(model_id: str) -> Dict[str, Any]:
    mid = (model_id or "").strip().lower()
    supported = any(re.search(pat, mid) for pat in TOOL_CALLING_CAPABLE_PATTERNS)
    return {
        "model": model_id,
        "supports_tool_calling": supported,
        "warning": None if supported else f"Selected model '{model_id}' may not support structured MCP tool calling; switch to MK Main (gpt-oss-120b), MK Heavy (deepseek-v3.2), Anthropic Claude, or OpenAI GPT-4o.",
    }


def probe_url_resolvable(url: str, timeout_sec: float = 4.0) -> Tuple[bool, int, str]:
    if not url or not isinstance(url, str):
        return False, 0, "Empty URL"
    parsed = urllib.parse.urlparse(url.strip())
    host = (parsed.hostname or "").lower()
    if host in PLACEHOLDER_DOMAINS or any(host.endswith("." + pd) for pd in PLACEHOLDER_DOMAINS):
        return False, 422, f"Placeholder domain '{host}' is prohibited"

    if parsed.scheme == "file":
        raw_p = urllib.parse.unquote(parsed.path or "")
        if parsed.netloc and parsed.netloc != "localhost":
            raw_p = f"{parsed.netloc}{raw_p}"
        try:
            fpath = urllib.request.url2pathname(raw_p)
        except Exception:
            fpath = raw_p
        if not os.path.exists(fpath) and raw_p.startswith("/") and len(raw_p) > 2 and raw_p[2] == ":":
            fpath = raw_p[1:]
        if os.path.exists(fpath):
            return True, 200, "Local file verified"
        return False, 404, f"Local file not found: {fpath}"

    if not parsed.scheme and os.path.exists(url):
        return True, 200, "Local artifact path verified"

    if parsed.scheme not in ("http", "https"):
        return False, 400, f"Unsupported URL scheme: {parsed.scheme}"

    for method in ("HEAD", "GET"):
        req = urllib.request.Request(
            url,
            headers={"User-Agent": "MK-AI-AntiFabrication-Verifier/1.0"},
            method=method,
        )
        try:
            with urllib.request.urlopen(req, timeout=timeout_sec) as resp:
                code = int(resp.status)
                if 200 <= code < 400:
                    return True, code, f"HTTP {code}"
                return False, code, f"HTTP {code}"
        except urllib.error.HTTPError as he:
            if method == "HEAD" and he.code in (403, 405):
                continue
            return False, int(he.code or 500), f"HTTP {he.code}"
        except Exception as exc:
            if method == "HEAD":
                continue
            return False, 0, str(exc)
    return False, 0, "Unreachable"


class MKAntiFabricationEngine:
    @staticmethod
    def validate_and_filter_result(raw_result: Dict[str, Any], verify_urls_live: bool = True) -> Dict[str, Any]:
        summary = str(raw_result.get("summary", "")).strip()
        raw_items = list(raw_result.get("items") or [])
        raw_evidence = list(raw_result.get("evidence") or [])
        next_actions = list(raw_result.get("next_actions") or [])
        needs_approval = list(raw_result.get("needs_approval") or [])
        confidence = float(raw_result.get("confidence", 0.85))

        rejected_items: List[Dict[str, Any]] = []
        accepted_items: List[Dict[str, Any]] = []
        verified_evidence: List[Dict[str, Any]] = []
        flags: List[str] = []

        # 1. Validate evidence list
        for ev in raw_evidence:
            ev_url = str(ev.get("url") or ev.get("evidence_url") or "").strip()
            if verify_urls_live and ev_url:
                ok, code, reason = probe_url_resolvable(ev_url)
                if not ok:
                    flags.append(f"Rejected unresolvable evidence URL '{ev_url}' ({reason})")
                    continue
                ev = {**ev, "url": ev_url, "http_status": code, "verified": True}
            verified_evidence.append(ev)

        # 2. Validate each item's URL / evidence_url / apply_url / deadline / email grounding
        today_iso = datetime.date.today().isoformat()
        scores: List[float] = []

        for item in raw_items:
            if not isinstance(item, dict):
                continue
            item_url = str(
                item.get("evidence_url")
                or item.get("apply_url")
                or item.get("website")
                or item.get("url")
                or ""
            ).strip()

            if item_url and verify_urls_live:
                ok, code, reason = probe_url_resolvable(item_url)
                if not ok:
                    rejected_items.append({**item, "rejection_reason": f"Evidence/Target URL failed verification: {reason}"})
                    flags.append(f"Rejected item '{item.get('title') or item.get('name') or item_url}': {reason}")
                    continue
                item = {**item, "http_status": code}

            # Check deadline if present
            deadline = str(item.get("deadline", "")).strip()
            if deadline and re.match(r"^\d{4}-\d{2}-\d{2}$", deadline):
                if deadline <= today_iso:
                    rejected_items.append({**item, "rejection_reason": f"Expired deadline ({deadline} <= {today_iso})"})
                    flags.append(f"Excluded expired item '{item.get('title', 'item')}' with deadline {deadline}")
                    continue

            # Check email grounding if source_html is provided
            email = str(item.get("email") or item.get("contact_email") or "").strip()
            source_text = str(item.get("source_text", ""))
            if email and email.lower() not in ("no public email", "not listed", "none") and source_text:
                if email.lower() not in source_text.lower():
                    rejected_items.append({**item, "rejection_reason": f"Email '{email}' not found on source page"})
                    flags.append(f"Rejected ungrounded email '{email}'")
                    continue

            if "score" in item and isinstance(item["score"], (int, float)):
                scores.append(float(item["score"]))

            accepted_items.append(item)

        # 3. Check score variance (flag near-identical synthetic scores)
        near_identical_scores = False
        if len(scores) >= 3:
            spread = max(scores) - min(scores)
            if spread < 1.5:
                near_identical_scores = True
                flags.append(f"Suspicious near-identical score distribution detected across {len(scores)} items (spread={spread:.2f})")
                confidence = min(confidence, 0.4)

        return {
            "summary": summary,
            "items": accepted_items,
            "rejected_items": rejected_items,
            "evidence": verified_evidence,
            "confidence": round(confidence, 2),
            "next_actions": next_actions,
            "needs_approval": needs_approval,
            "anti_fabrication_report": {
                "passed": len(rejected_items) == 0 and not near_identical_scores,
                "accepted_count": len(accepted_items),
                "rejected_count": len(rejected_items),
                "near_identical_scores_flagged": near_identical_scores,
                "flags": flags,
            },
        }


if __name__ == "__main__":
    import json
    sample = {
        "summary": "Anti-fabrication self-test",
        "items": [
            {"title": "Fake Item", "evidence_url": "https://example.com/fake", "score": 85},
            {"title": "Expired Item", "deadline": "2024-01-01", "score": 85},
        ],
        "evidence": [],
        "confidence": 0.9,
        "next_actions": ["Review"],
        "needs_approval": [],
    }
    print(json.dumps(MKAntiFabricationEngine.validate_and_filter_result(sample), indent=2))
