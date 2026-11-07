#!/usr/bin/env python3
"""
MK AI — URL & Telemetry Audit Suite (`tests/test_url_and_telemetry_audit.py`)
Enforces Gap E:
1. No provider constant, platform guide URL, kit icon URL, about link, or portal link in `src/` or `package.json`
   points to `http://127.0.0.1:8765` (which is reserved strictly for local MK-AI backend API calls).
2. No unconsented NetEase / Youdao / 127.net telemetry endpoints exist in `src/` or `package.json`.
"""
import json
import os
import unittest

_TESTS_DIR = os.path.dirname(os.path.abspath(__file__))
_BACKEND_DIR = os.path.dirname(_TESTS_DIR)
_PROJECT_ROOT = os.path.dirname(_BACKEND_DIR)


class TestURLAndTelemetryAudit(unittest.TestCase):
    def test_01_no_non_backend_constants_point_to_localhost_8765(self) -> None:
        non_backend_files = [
            "package.json",
            "src/shared/providers/constants.ts",
            "src/shared/platform/constants.ts",
            "src/shared/skin/kit.ts",
            "src/shared/computerUse/constants.ts",
            "src/shared/analytics/constants.ts",
            "src/main/computerUse/computerUseKit.ts",
            "src/main/computerUse/computerUseRuntime.ts",
            "src/main/libs/decisionModelClient.ts",
            "src/renderer/components/Settings.tsx",
            "src/renderer/components/WelcomeDialog.tsx",
            "src/main/im/imGatewayManager.ts",
            "src/main/ipcHandlers/mcp/handlers.ts",
        ]
        for rel in non_backend_files:
            full = os.path.join(_PROJECT_ROOT, rel)
            self.assertTrue(os.path.isfile(full), f"Missing file: {rel}")
            with open(full, "r", encoding="utf-8") as f:
                content = f.read()
            self.assertNotIn(
                "127.0.0.1:8765",
                content,
                f"Non-backend file {rel} still contains bogus localhost URL '127.0.0.1:8765'!",
            )

    def test_02_telemetry_endpoint_disabled_and_zero_upstream_trackers(self) -> None:
        analytics_const = os.path.join(_PROJECT_ROOT, "src/shared/analytics/constants.ts")
        with open(analytics_const, "r", encoding="utf-8") as f:
            ac_text = f.read()
        self.assertIn("YoudaoAnalyzer: ''", ac_text)

        forbidden_domains = ("127.net", "youdao.com", "netease.com")
        for root, dirs, files in os.walk(os.path.join(_PROJECT_ROOT, "src")):
            for fname in files:
                if fname.endswith((".ts", ".tsx", ".js", ".cjs")):
                    fpath = os.path.join(root, fname)
                    with open(fpath, "r", encoding="utf-8", errors="ignore") as f:
                        txt = f.read().lower()
                    for dom in forbidden_domains:
                        self.assertNotIn(dom, txt, f"Found upstream tracking domain {dom} in {fpath}")


if __name__ == "__main__":
    unittest.main(verbosity=2)
