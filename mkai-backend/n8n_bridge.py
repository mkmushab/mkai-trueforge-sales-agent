#!/usr/bin/env python3
"""
MK AI — n8n Workflow Automation Bridge
Triggers self-hosted n8n workflows via webhooks and provides pre-built workflow templates
for Marketing, Sales CRM, Customer Support, Finance/GST, and DevOps/SEO.
"""
import json
import os
import urllib.request
from typing import Any, Dict


class MKN8nBridge:
    def __init__(self) -> None:
        self.webhook_base = os.environ.get("N8N_WEBHOOK_BASE_URL", "http://127.0.0.1:5678/webhook").rstrip("/")

    def trigger_workflow(self, workflow_slug: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        url = f"{self.webhook_base}/{workflow_slug.lstrip('/')}"
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json", "X-MKAI-Source": "MK-AI-Brain"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                return {
                    "success": True,
                    "workflow": workflow_slug,
                    "status_code": resp.status,
                    "response": resp.read().decode("utf-8", errors="replace"),
                }
        except Exception as exc:
            return {
                "success": False,
                "workflow": workflow_slug,
                "webhook_url": url,
                "note": "Local n8n instance not reachable yet. Start n8n via `docker compose up -d n8n` or `npx n8n`.",
                "error": str(exc),
            }
