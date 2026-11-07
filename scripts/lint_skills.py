#!/usr/bin/env python3
"""
MK-AI — Phase 3 Skill Contract & Live MCP Tool Linter (`scripts/lint_skills.py`)
Verifies that every `SKILLs/mkai-*/SKILL.md`:
1. Contains all 8 required contract sections (`## 1. Mission`, `## 2. Real Tools Available`, `## 3. Inputs Required from the User`, `## 4. Workflow`, `## 5. Output Schema`, `## 6. Approval Gates`, `## 7. Failure Behaviour`, `## 8. Quality Bar`).
2. Every tool name listed under `## 2. Real Tools Available` (and referenced in `## 4. Workflow`) exists in the live MCP tool list (`mkai-backend/mkai_mcp_server.py`).
3. Includes upstream open-source attribution (`> **Upstream Attribution**:`).
Exits 0 if all skills pass, or 1 if any violation is found.
"""
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BACKEND = os.path.join(ROOT, "mkai-backend")
if BACKEND not in sys.path:
    sys.path.insert(0, BACKEND)

from mkai_mcp_server import get_registered_tool_names

REQUIRED_SECTIONS = [
    "## 1. Mission",
    "## 2. Real Tools Available",
    "## 3. Inputs Required from the User",
    "## 4. Workflow",
    "## 5. Output Schema",
    "## 6. Approval Gates",
    "## 7. Failure Behaviour",
    "## 8. Quality Bar",
]


def lint_all_mkai_skills() -> int:
    live_tools = set(get_registered_tool_names())
    skills_root = os.path.join(ROOT, "SKILLs")
    skill_dirs = sorted(
        d for d in os.listdir(skills_root)
        if d.startswith("mkai-") and os.path.isdir(os.path.join(skills_root, d))
    )

    print("=" * 80)
    print(f"  MK-AI PHASE 3 SKILL LINTER (Live MCP Tools Registered: {len(live_tools)})")
    print("=" * 80)

    errors = []
    checked = 0
    total_tool_refs = 0

    for sdir in skill_dirs:
        md_path = os.path.join(skills_root, sdir, "SKILL.md")
        if not os.path.isfile(md_path):
            errors.append(f"{sdir}: Missing SKILL.md")
            continue
        txt = open(md_path, "r", encoding="utf-8").read()
        checked += 1

        for sec in REQUIRED_SECTIONS:
            if sec not in txt:
                errors.append(f"{sdir}/SKILL.md: Missing required section '{sec}'")

        if "Upstream Attribution" not in txt:
            errors.append(f"{sdir}/SKILL.md: Missing Upstream Attribution header")

        # Extract tools listed in section 2
        sec2_match = re.search(r"## 2\. Real Tools Available([\s\S]*?)## 3\.", txt)
        if not sec2_match:
            errors.append(f"{sdir}/SKILL.md: Cannot parse Section 2 tools block")
            continue
        sec2_block = sec2_match.group(1)
        listed_tools = re.findall(r"- `([a-z0-9_]+)`", sec2_block)
        if not listed_tools:
            errors.append(f"{sdir}/SKILL.md: Zero MCP tools listed in Section 2")
        for t in listed_tools:
            total_tool_refs += 1
            if t not in live_tools:
                errors.append(f"{sdir}/SKILL.md: Tool '{t}' does NOT exist in live MCP tool list!")

    if errors:
        print(f"[FAIL] {len(errors)} skill lint error(s) found:")
        for e in errors:
            print(f"  - {e}")
        return 1

    print(f"[PASS] Verified {checked} MK-AI Department & Radar SKILL.md files.")
    print(f"[PASS] All {total_tool_refs} tool references exist in the live MCP server ({len(live_tools)} registered tools).")
    print("[PASS] All 8 required contract sections + Upstream Attribution verified across every skill.")
    return 0


if __name__ == "__main__":
    sys.exit(lint_all_mkai_skills())
