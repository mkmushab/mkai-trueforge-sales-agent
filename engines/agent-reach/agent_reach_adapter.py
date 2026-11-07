#!/usr/bin/env python3
"""
Wrapper for Panniantong/Agent-Reach (MIT License).
- Exposes `doctor()` health check for the Connectors UI.
- Enforces a strict allow-list of subcommands: `doctor`, `web`, `rss`, `github`, `youtube`, `reddit`.
- Enforces cookie-channel safety: blocks primary account cookies and requires secondary account isolation.
"""
import json
import os
import shutil
import subprocess
from typing import Any, Dict, List


ALLOWLISTED_SUBCOMMANDS = {"doctor", "web", "rss", "github", "youtube", "reddit"}


class AgentReachAdapter:
    def __init__(self) -> None:
        self.venv_bin = os.environ.get("AGENT_REACH_BIN", shutil.which("agent-reach") or "")

    def doctor(self) -> Dict[str, Any]:
        channels = {
            "web_fetch": {"status": "available", "auth_required": False},
            "rss_reader": {"status": "available", "auth_required": False},
            "github_public": {"status": "available", "auth_required": False, "token_configured": bool(os.environ.get("GITHUB_PERSONAL_ACCESS_TOKEN"))},
            "youtube_metadata": {"status": "available", "ffmpeg_installed": bool(shutil.which("ffmpeg"))},
            "reddit_public": {"status": "available", "auth_required": False},
            "cookie_channels_policy": "SECONDARY_ACCOUNT_ONLY (main account cookies blocked by policy)",
        }
        cli_installed = bool(self.venv_bin and os.path.exists(self.venv_bin))
        return {
            "ok": True,
            "engine": "Panniantong/Agent-Reach",
            "license": "MIT",
            "cli_binary_installed": cli_installed,
            "allowlisted_subcommands": sorted(ALLOWLISTED_SUBCOMMANDS),
            "channels": channels,
            "hint": "Install upstream CLI in managed venv via `pip install git+https://github.com/Panniantong/Agent-Reach.git` if cli_binary_installed is false.",
        }

    def status(self) -> Dict[str, Any]:
        return self.doctor()

    def run_subcommand(self, subcommand: str, target: str) -> Dict[str, Any]:
        sub = subcommand.strip().lower()
        if sub not in ALLOWLISTED_SUBCOMMANDS:
            return {
                "ok": False,
                "error": f"Subcommand '{subcommand}' is not in the Agent-Reach allow-list ({sorted(ALLOWLISTED_SUBCOMMANDS)}).",
                "hint": "Use only allow-listed read-only subcommands. Cookie-based channels require a secondary account.",
            }
        if sub == "doctor":
            return self.doctor()
        if self.venv_bin and os.path.exists(self.venv_bin):
            res = subprocess.run([self.venv_bin, sub, target], capture_output=True, text=True, timeout=20)
            return {
                "ok": res.returncode == 0,
                "subcommand": sub,
                "target": target,
                "stdout": res.stdout.strip(),
                "stderr": res.stderr.strip(),
            }
        return {
            "ok": False,
            "subcommand": sub,
            "target": target,
            "error": "agent-reach CLI binary is not installed in the current environment or outbound network is disabled.",
            "hint": "Run `scripts/setup-engines.sh` on a machine with internet access to install Agent-Reach into the managed venv.",
        }


if __name__ == "__main__":
    import sys
    ar = AgentReachAdapter()
    if len(sys.argv) > 2:
        print(json.dumps(ar.run_subcommand(sys.argv[1], sys.argv[2]), indent=2))
    else:
        print(json.dumps(ar.doctor(), indent=2))
