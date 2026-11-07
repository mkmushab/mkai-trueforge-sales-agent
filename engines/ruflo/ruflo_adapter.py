#!/usr/bin/env python3
"""
Adapter for ruvnet/ruflo (MIT License).
Optional MCP server for engineering swarms ONLY (Departments #2 Developer, #7 QA, #15 DevOps).
Never used as the runtime for business agents.
"""
import json
import shutil
from typing import Any, Dict

ALLOWED_DEPARTMENTS = {"mkai-02-developer", "mkai-07-qa", "mkai-15-devops"}


class RufloSwarmAdapter:
    def status(self) -> Dict[str, Any]:
        npx_bin = shutil.which("npx")
        return {
            "ok": bool(npx_bin),
            "engine": "ruvnet/ruflo",
            "license": "MIT",
            "allowed_departments": sorted(ALLOWED_DEPARTMENTS),
            "mcp_command": "npx -y ruflo@latest mcp",
            "npx_available": bool(npx_bin),
        }


if __name__ == "__main__":
    print(json.dumps(RufloSwarmAdapter().status(), indent=2))
