#!/usr/bin/env python3
"""
Bridge adapter for ethanplusai/harvey (MIT License).
Runs Harvey as its own process/state with its own approval flow and dashboard.
MK-AI reads status(), outbox(), and replies() through this bridge and enforces approval-mode (no auto-sends).
"""
import json
import os
import sqlite3
import time
import urllib.request
from typing import Any, Dict, List, Optional


def is_demo_mode() -> bool:
    return os.environ.get("MKAI_DEMO_MODE", "0").strip().lower() in ("1", "true", "yes")


class HarveyBridgeAdapter:
    def __init__(self, state_db: Optional[str] = None) -> None:
        self.harvey_url = os.environ.get("HARVEY_DASHBOARD_URL", "http://127.0.0.1:4310").rstrip("/")
        self.state_db = state_db or os.path.join(os.path.dirname(os.path.abspath(__file__)), "harvey_bridge_state.db")
        self._init_db()

    def _init_db(self) -> None:
        conn = sqlite3.connect(self.state_db)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS harvey_outbox (
                draft_id TEXT PRIMARY KEY,
                company TEXT NOT NULL,
                website TEXT NOT NULL,
                evidence_url TEXT NOT NULL,
                contact_email TEXT NOT NULL,
                subject TEXT NOT NULL,
                body TEXT NOT NULL,
                word_count INTEGER NOT NULL,
                status TEXT NOT NULL DEFAULT 'waiting_for_approval',
                created_at REAL NOT NULL
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS harvey_replies (
                reply_id TEXT PRIMARY KEY,
                draft_id TEXT NOT NULL,
                sender_email TEXT NOT NULL,
                snippet TEXT NOT NULL,
                sentiment TEXT NOT NULL,
                received_at REAL NOT NULL
            )
        """)
        conn.commit()
        conn.close()

    def status(self) -> Dict[str, Any]:
        # Probe live Harvey process first
        req = urllib.request.Request(f"{self.harvey_url}/health", method="GET")
        daemon_up = False
        try:
            with urllib.request.urlopen(req, timeout=2) as resp:
                daemon_up = (resp.status == 200)
        except Exception:
            daemon_up = False

        conn = sqlite3.connect(self.state_db)
        pending_count = conn.execute("SELECT COUNT(*) FROM harvey_outbox WHERE status = 'waiting_for_approval'").fetchone()[0]
        sent_count = conn.execute("SELECT COUNT(*) FROM harvey_outbox WHERE status = 'sent'").fetchone()[0]
        reply_count = conn.execute("SELECT COUNT(*) FROM harvey_replies").fetchone()[0]
        conn.close()

        return {
            "ok": True,
            "engine": "ethanplusai/harvey",
            "license": "MIT",
            "approval_mode": "ASK_REQUIRED_NO_AUTO_SEND",
            "harvey_daemon_reachable": daemon_up,
            "harvey_dashboard_url": self.harvey_url,
            "outbox_waiting_for_approval": pending_count,
            "sent_count": sent_count,
            "replies_count": reply_count,
            "demo_mode": is_demo_mode(),
        }

    def stage_outreach_draft(
        self,
        draft_id: str,
        company: str,
        website: str,
        evidence_url: str,
        contact_email: str,
        subject: str,
        body: str,
    ) -> Dict[str, Any]:
        words = len([w for w in body.split() if w.strip()])
        if words > 75:
            return {
                "ok": False,
                "error": f"Outreach draft exceeds 75-word limit ({words} words).",
                "hint": "Shorten outreach draft to under 75 words with one specific observation from the prospect site.",
            }
        conn = sqlite3.connect(self.state_db)
        conn.execute(
            "INSERT OR REPLACE INTO harvey_outbox (draft_id, company, website, evidence_url, contact_email, subject, body, word_count, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'waiting_for_approval', ?)",
            (draft_id, company, website, evidence_url, contact_email, subject, body, words, time.time()),
        )
        conn.commit()
        conn.close()
        return {
            "ok": True,
            "draft_id": draft_id,
            "company": company,
            "website": website,
            "evidence_url": evidence_url,
            "contact_email": contact_email,
            "word_count": words,
            "status": "waiting_for_approval",
            "sent": False,
        }

    def list_outbox(self) -> Dict[str, Any]:
        conn = sqlite3.connect(self.state_db)
        conn.row_factory = sqlite3.Row
        rows = [dict(r) for r in conn.execute("SELECT * FROM harvey_outbox ORDER BY created_at DESC").fetchall()]
        conn.close()
        return {"ok": True, "engine": "ethanplusai/harvey", "outbox": rows}

    def list_replies(self) -> Dict[str, Any]:
        conn = sqlite3.connect(self.state_db)
        conn.row_factory = sqlite3.Row
        rows = [dict(r) for r in conn.execute("SELECT * FROM harvey_replies ORDER BY received_at DESC").fetchall()]
        conn.close()
        return {"ok": True, "engine": "ethanplusai/harvey", "replies": rows}


if __name__ == "__main__":
    import sys
    bridge = HarveyBridgeAdapter()
    if "--outbox" in sys.argv:
        print(json.dumps(bridge.list_outbox(), indent=2))
    elif "--replies" in sys.argv:
        print(json.dumps(bridge.list_replies(), indent=2))
    else:
        print(json.dumps(bridge.status(), indent=2))
