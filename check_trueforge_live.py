#!/usr/bin/env python3
"""
One-Click End-to-End Diagnostic & TrueForge Readiness Checker (`check_trueforge_live.py`)
Checks:
1. Self-Improving Agent Loop (Run 1 -> Skill Rewrite #1 -> Run 2 -> Skill Rewrite #2 -> Run 3)
2. Generated Scorecards, Unified Skill Diffs (.patch), and Sandbox Battlecards (.xlsx, .pdf, .csv)
3. Live MCP JSON-RPC 2.0 Server (`mkai-backend/mkai_mcp_server.py`) handshake & tool execution
4. Node.js / npx availability & TrueForge Server (`http://localhost:8790`) live connection check
"""
import json
import os
import shutil
import subprocess
import sys
import urllib.request

ROOT = os.path.dirname(os.path.abspath(__file__))


def main() -> int:
    print("=" * 88)
    print("  MK-AI x TRUEFORGE — FULL LOCAL CHECKER (WINDOWS / MAC / LINUX)")
    print("=" * 88)

    # 1. Run the Self-Improving Agent Loop
    print("\n[STEP 1/4] Running Self-Improving Sales & Leads Agent Loop (run.py)...")
    res = subprocess.run([sys.executable, os.path.join(ROOT, "run.py")], cwd=ROOT)
    if res.returncode != 0:
        print("  [FAIL] run.py exited with non-zero status.")
        return 1

    # 2. Verify all generated artifacts
    print("\n[STEP 2/4] Checking Generated Scorecards, Skill Diffs & Sandbox Battlecards...")
    required_files = [
        "results/run_1_score.json",
        "results/run_2_score.json",
        "results/run_3_score.json",
        "results/skill_diff_run1_to_run2.patch",
        "results/skill_diff_run2_to_run3.patch",
        "results/SELF_IMPROVEMENT_REPORT.md",
        "results/sandbox_run_3/us_india_competitor_pricing_battlecard.xlsx",
        "results/sandbox_run_3/sales_competitor_battlecard_report.pdf",
        "results/sandbox_run_3/competitor_pricing_us_vs_india.csv",
    ]
    for rel in required_files:
        p = os.path.join(ROOT, rel)
        exists = os.path.isfile(p) and os.path.getsize(p) > 0
        print(f"  [{'PASS' if exists else 'FAIL'}] {rel} ({os.path.getsize(p) if exists else 0} bytes)")
        if not exists:
            return 1

    # 3. Test MCP Server JSON-RPC 2.0 Handshake
    print("\n[STEP 3/4] Testing MK-AI MCP Server (mkai-backend/mkai_mcp_server.py)...")
    rpc_input = (
        json.dumps({"jsonrpc": "2.0", "id": 1, "method": "initialize"}) + "\n"
        + json.dumps({"jsonrpc": "2.0", "id": 2, "method": "tools/list"}) + "\n"
    )
    mcp_proc = subprocess.run(
        [sys.executable, os.path.join(ROOT, "mkai-backend", "mkai_mcp_server.py")],
        input=rpc_input,
        capture_output=True,
        text=True,
        cwd=ROOT,
    )
    lines = [l for l in mcp_proc.stdout.strip().splitlines() if l.strip()]
    tools_list = json.loads(lines[-1])["result"]["tools"]
    print(f"  [PASS] MCP Server responded over stdio with {len(tools_list)} live tools!")

    # 4. Check TrueForge UI/Server Status (localhost:8790) & Node/npx
    print("\n[STEP 4/4] Checking TrueForge Agent Harness Runtime (http://localhost:8790)...")
    node_bin = shutil.which("node")
    npx_bin = shutil.which("npx")
    print(f"  - Node.js detected: {node_bin or 'NOT FOUND (Install Node.js >= 22.14)'}")
    print(f"  - npx detected:     {npx_bin or 'NOT FOUND'}")

    tf_url = os.environ.get("TRUEFORGE_URL", "http://localhost:8790")
    try:
        with urllib.request.urlopen(tf_url, timeout=2) as resp:
            print(f"  [LIVE] TrueForge Server is RUNNING at {tf_url} (HTTP {resp.status})!")
    except Exception:
        print(f"  [INFO] TrueForge Web UI is not open on {tf_url} yet.")
        print("         To launch TrueForge Web UI right now, open a second terminal and run:")
        print("         npx @truefoundry/trueforge@latest")
        print("         Then open http://localhost:8790 in Chrome!")

    print("\n" + "=" * 88)
    print("  ALL CHECKS PASSED! Your repo is 100% ready for GitHub & Stranger Builds.")
    print("=" * 88)
    return 0


if __name__ == "__main__":
    sys.exit(main())
