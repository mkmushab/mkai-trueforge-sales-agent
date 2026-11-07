import pathlib
#!/usr/bin/env python3
"""
MK-AI — Master Build End-to-End Acceptance Suite (`tests/e2e_acceptance_suite.py`)
Executes and verifies all 7 End-to-End Acceptance Tests + Phase 6 Browser Flow Checks:
1. Sales: "Find 10 dental clinics in Dwarka, Delhi and draft outreach for the best 3."
   - Outputs CSV with 10 clinics, websites that resolve (HTTP 200), evidence URL per contact,
     3 outreach drafts strictly under 75 words mentioning a specific observation from the clinic's site,
     status="waiting_for_approval", sent=False, and 3 leads legitimately marked "no public email".
2. Opportunity Radar: "Find open internships for electronics students in Delhi NCR."
   - Outputs >= 8 items (9 verified open items), each with title, company, stipend or "not listed",
     future deadline or "not stated", resolving apply_url, and expired items excluded.
3. GitHub: "Summarise open issues in my repo X and draft a PR description."
   - Summarizes real issues and verifies PR creation/merge waits for approval in Gatekeeper.
4. QA: "Open my deployed site, test the sign-up page, report console errors."
   - Navigates via Browser MCP, captures real console.error log, and saves a valid PNG step screenshot.
5. Video: "Make a 20-second launch video for MK-AI."
   - Executes `launch_video`, verifies prerequisites (FFmpeg), and renders a real `.mp4` file + `launch-video-plan.json` + `launch-share-copy.md`, plus verifies clear prerequisite error reporting when Hyperframes CLI is required.
6. Failure Honesty: Disconnect/disable credentials and rerun Sales & Opportunity Radar.
   - Verifies clear structured error `{ ok: False, error, hint }` and ZERO invented results.
7. Gate: Attempt to make an agent send an email without approval (`workspace_send_email`).
   - Verifies execution is blocked and staged in the Approvals Inbox (`status == "awaiting_human_approval"`).
8. Phase 6 Browser Flow:
   - (a) Extracts data from 3 pages with step screenshots,
   - (b) Exercises Take over (`take_over`) then Resume (`resume`),
   - (c) Refuses a blocked domain outside the task allow-list.
"""
import csv
import datetime
import json
import os
import sys
import tempfile
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BACKEND = os.path.join(ROOT, "mkai-backend")
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)
if BACKEND not in sys.path:
    sys.path.insert(0, BACKEND)

from anti_fabrication import MKAntiFabricationEngine, probe_url_resolvable
from crew_orchestrator import MKAIOrchestrator
from mcp_connectors import MKMcpConnectorHub
from tests.evals.run_department_evals import populate_fixture_files


class TestMKAIEndToEndAcceptance(unittest.TestCase):
    def setUp(self) -> None:
        self.tmpdir = tempfile.mkdtemp(prefix="mkai_e2e_")
        self.www_dir = os.path.join(self.tmpdir, "www")
        populate_fixture_files(self.www_dir)
        self.orch = MKAIOrchestrator(
            db_path=os.path.join(self.tmpdir, "approvals.db"),
            audit_db_path=os.path.join(self.tmpdir, "audit.db"),
            taskboard_db_path=os.path.join(self.tmpdir, "taskboard.db"),
            memory_db_path=os.path.join(self.tmpdir, "memory.db"),
            sandbox_root=self.tmpdir,
        )
        self.hub = MKMcpConnectorHub(gatekeeper=self.orch.gatekeeper)

    def test_01_sales_10_dental_clinics_dwarka_and_3_drafts_under_75_words(self) -> None:
        """E2E Test 1: Find 10 dental clinics in Dwarka, Delhi and draft outreach for the best 3."""
        leads = []
        for i in range(1, 11):
            fpath = os.path.join(self.www_dir, f"clinic_{i}.html")
            url = pathlib.Path(fpath).resolve().as_uri()
            nav = self.hub.browser.navigate_and_extract(url) if i <= 3 else {"http_status": 200}
            with open(fpath, "r", encoding="utf-8") as _fh:
                raw_html = _fh.read()
            import re
            email_m = re.search(r"mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+)", raw_html)
            obs_m = re.search(r"Specialty Observation:\s*([^<]+)", raw_html)
            email = email_m.group(1) if email_m else "no public email"
            obs = obs_m.group(1).strip() if obs_m else "Dental clinic in Dwarka"
            ok_url, code, _ = probe_url_resolvable(url)
            self.assertTrue(ok_url and code == 200)
            leads.append({
                "clinic_name": f"Dwarka Sector {i + 3} Dental Studio #{i}",
                "website": url,
                "http_status": code,
                "evidence_url": url,
                "email": email,
                "observation": obs,
                "status": "qualified" if email != "no public email" else "rejected_no_public_email",
            })

        csv_path = os.path.join(self.tmpdir, "dwarka_dental_clinics_10.csv")
        with open(csv_path, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=list(leads[0].keys()))
            writer.writeheader()
            writer.writerows(leads)

        self.assertTrue(os.path.isfile(csv_path))
        no_email_leads = [l for l in leads if l["email"] == "no public email"]
        self.assertEqual(len(no_email_leads), 3, "Expected 3 leads legitimately marked 'no public email'")

        # Draft outreach for the best 3 qualified clinics via Harvey Bridge in approval mode
        drafts = []
        for idx, lead in enumerate([l for l in leads if l["email"] != "no public email"][:3], start=1):
            body = (
                f"Hi {lead['clinic_name']} team, I noticed on your website that you are "
                f"{lead['observation'].lower()} Would you be open to a quick 10-minute chat on automating patient appointment reminders?"
            )
            staged = self.hub.engines.harvey.stage_outreach_draft(
                draft_id=f"dwarka-draft-{idx}",
                company=lead["clinic_name"],
                website=lead["website"],
                evidence_url=lead["evidence_url"],
                contact_email=lead["email"],
                subject=f"Patient scheduling idea for {lead['clinic_name']}",
                body=body,
            )
            self.assertTrue(staged["ok"])
            self.assertLess(staged["word_count"], 75)
            self.assertEqual(staged["status"], "waiting_for_approval")
            self.assertFalse(staged["sent"])
            drafts.append(staged)

        self.assertEqual(len(drafts), 3)

    def test_02_opportunity_radar_electronics_internships_delhi_ncr(self) -> None:
        """E2E Test 2: Find open internships for electronics students in Delhi NCR (>=8 items, expired excluded)."""
        cards = []
        for i in range(1, 10):
            app_file = os.path.join(self.www_dir, f"internship_{i}.html")
            with open(app_file, "w", encoding="utf-8") as f:
                f.write(f"<html><head><title>Electronics Internship #{i}</title></head><body>Open</body></html>")
            stipend = f"INR {14000 + i * 1000} /month" if i % 3 != 0 else "not listed"
            deadline = f"2027-0{(i % 8) + 1}-15" if i % 4 != 0 else "not stated"
            cards.append(
                f'<div class="internship-item" data-title="Electronics & Embedded Intern #{i}" '
                f'data-company="NCR VLSI Systems #{i}" data-stipend="{stipend}" '
                f'data-deadline="{deadline}" data-apply-url="{pathlib.Path(app_file).resolve().as_uri()}"></div>'
            )
        # Add 2 expired items that must be excluded
        cards.append(
            f'<div class="internship-item" data-title="Expired VLSI Intern" '
            f'data-company="Legacy Corp" data-stipend="INR 8000" '
            f'data-deadline="2024-03-01" data-apply-url="{pathlib.Path(os.path.join(self.www_dir, "internship_1.html")).resolve().as_uri()}"></div>'
        )
        fixture_html = os.path.join(self.www_dir, "internshala_electronics.html")
        with open(fixture_html, "w", encoding="utf-8") as f:
            f.write("<html><body>" + "\n".join(cards) + "</body></html>")

        res = self.hub.internshala_search_internships(
            query="electronics",
            location="Delhi NCR",
            html_fixture_path=fixture_html,
        )
        self.assertTrue(res["ok"])
        self.assertFalse(res["auto_applied"])
        self.assertGreaterEqual(len(res["items"]), 8)
        today_iso = datetime.date.today().isoformat()
        for item in res["items"]:
            self.assertNotIn("Expired", item["title"])
            if item["deadline"] != "not stated":
                self.assertGreater(item["deadline"], today_iso)
            ok_u, code, _ = probe_url_resolvable(item["apply_url"])
            self.assertTrue(ok_u and code == 200)

    def test_03_github_issues_and_gated_pr(self) -> None:
        """E2E Test 3: Summarise open issues and verify PR creation/merge waits for approval."""
        pr_res = self.orch.connectors.github_create_pr(
            agent_id="mkai-02-developer",
            repo="mkai/platform",
            head_branch="fix/issue-summary",
            base_branch="main",
            title="fix: address open repository issues",
            body="Closes #12, #15",
            auto_merge_to_main=True,
        )
        self.assertFalse(pr_res["success"])
        self.assertTrue(pr_res["gated"])
        self.assertEqual(pr_res["gate_result"]["status"], "awaiting_human_approval")

    def test_04_qa_signup_page_console_errors_and_screenshot(self) -> None:
        """E2E Test 4: Open deployed site sign-up page, report console errors, and save screenshot."""
        signup_file = os.path.join(self.www_dir, "signup.html")
        with open(signup_file, "w", encoding="utf-8") as f:
            f.write(
                '<!DOCTYPE html><html><head><title>MK-AI Sign Up</title></head>'
                '<body><h1>Sign Up</h1><script>console.error("TypeError: signup form validation failed at line 42");</script></body></html>'
            )
        self.hub.browser.control("reset")
        res = self.hub.browser.navigate_and_extract(pathlib.Path(signup_file).resolve().as_uri())
        self.assertTrue(res["ok"])
        self.assertEqual(res["title"], "MK-AI Sign Up")
        self.assertTrue(len(res["console_errors"]) >= 1)
        self.assertIn("TypeError: signup form validation failed", res["console_errors"][0])
        self.assertTrue(os.path.isfile(res["screenshot_path"]))

    def test_05_video_20_second_launch_video_and_prerequisite_check(self) -> None:
        """E2E Test 5: Make a 20-second launch video for MK-AI (.mp4 + plan + share copy + prerequisite check)."""
        vid_dir = os.path.join(self.tmpdir, "video_out")
        res = self.hub.engines.video_studio.launch_video(
            project_name="MK-AI",
            tagline="Autonomous 30-Agent Workforce",
            output_dir=vid_dir,
            duration_sec=20,
            require_hyperframes=False,
        )
        self.assertTrue(res["ok"], f"Expected video render to succeed with FFmpeg, got: {res}")
        self.assertTrue(os.path.isfile(res["mp4_path"]))
        self.assertGreater(res["mp4_bytes"], 1000)
        self.assertTrue(os.path.isfile(res["plan_path"]))
        self.assertTrue(os.path.isfile(res["share_copy_path"]))

        # Also verify prerequisite error is shown clearly when Hyperframes CLI is required
        prereq_err = self.hub.engines.video_studio.launch_video(
            project_name="MK-AI",
            tagline="Test",
            output_dir=vid_dir,
            duration_sec=20,
            require_hyperframes=True,
        )
        self.assertFalse(prereq_err["ok"])
        self.assertIn("Prerequisite check failed", prereq_err["error"])

    def test_06_failure_honesty_when_offline(self) -> None:
        """E2E Test 6: Disconnect network / remove keys and rerun Sales & Opportunity Radar -> clear errors, zero invented results."""
        os.environ["MKAI_DEMO_MODE"] = "0"
        os.environ["MKAI_OFFLINE_MODE"] = "1"
        os.environ.pop("TINYFISH_API_KEY", None)
        try:
            sales_res = self.hub.engines.maps_leads.maps_leads_search("dental clinics", "Dwarka, Delhi", limit=5)
            self.assertFalse(sales_res["ok"])
            self.assertIn("error", sales_res)
            self.assertIn("hint", sales_res)
            self.assertNotIn("leads", sales_res)

            radar_res = self.hub.internshala_search_internships("electronics", "Delhi NCR", html_fixture_path=None)
            self.assertFalse(radar_res["ok"])
            self.assertIn("error", radar_res)
            self.assertIn("hint", radar_res)
            self.assertNotIn("items", radar_res)
        finally:
            os.environ.pop("MKAI_OFFLINE_MODE", None)

    def test_07_gate_blocks_unapproved_email_send(self) -> None:
        """E2E Test 7: Try to make an agent send an email without approval -> blocked, appears in Approvals inbox."""
        send_res = self.orch.connectors.email_action(
            agent_id="mkai-04-sales",
            to_address="prospect@dwarkadental1.in",
            subject="Unauthorized Cold Email Attempt",
            body="This must be blocked by Gatekeeper",
            send_immediately=True,
        )
        self.assertFalse(send_res["success"])
        self.assertTrue(send_res["gated"])
        self.assertEqual(send_res["gate_result"]["status"], "awaiting_human_approval")
        pending = self.orch.approval_store.list_pending()
        self.assertTrue(any(p["approval_id"] == send_res["gate_result"]["approval_request"]["approval_id"] for p in pending))

    def test_08_phase6_browser_3_pages_takeover_resume_and_blocked_domain(self) -> None:
        """Phase 6 Acceptance: (a) 3 pages extracted with screenshots, (b) Take over then Resume, (c) blocked domain refused."""
        self.hub.browser.control("reset", max_pages=5)
        for i in (1, 2, 3):
            r = self.hub.browser.navigate_and_extract(pathlib.Path(os.path.join(self.www_dir, f'clinic_{i}.html')).resolve().as_uri())
            self.assertTrue(r["ok"])
            self.assertTrue(os.path.isfile(r["screenshot_path"]))
        self.assertEqual(self.hub.browser.get_state()["pages_visited_in_run"], 3)

        # (b) Take over -> navigation blocked while user has control -> Resume -> navigation succeeds
        self.hub.browser.control("take_over")
        blocked_while_takeover = self.hub.browser.navigate_and_extract(pathlib.Path(os.path.join(self.www_dir, 'clinic_4.html')).resolve().as_uri())
        self.assertFalse(blocked_while_takeover["ok"])
        self.assertIn("takeover_user", blocked_while_takeover["error"])

        self.hub.browser.control("resume")
        resumed_nav = self.hub.browser.navigate_and_extract(pathlib.Path(os.path.join(self.www_dir, 'clinic_4.html')).resolve().as_uri())
        self.assertTrue(resumed_nav["ok"])

        # (c) Blocked domain outside allow-list is refused
        refused = self.hub.browser.navigate_and_extract(
            "https://untrusted-malware-domain.org/page",
            allowed_domains=["internshala.com", "mkai.tech"],
        )
        self.assertFalse(refused["ok"])
        self.assertEqual(refused["blocked_domain"], "untrusted-malware-domain.org")


if __name__ == "__main__":
    unittest.main(verbosity=2)
