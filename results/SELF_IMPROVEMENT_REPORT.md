# Self-Improving Sales & Leads Agent — Run 1 vs. Run 2 Evaluation Report

- **TrueForge Connection**: `{"running": false, "url": "http://localhost:8790", "endpoint_checked": null, "http_status": null}`
- **Skill Rewrite Mode**: `diagnostic_markdown_editor_fallback` (`results/self_improve_trace.json`)
- **Skill Diff Artifact**: `results/skill_diff_run1_to_run2.patch`

## 1. Rubric Category Breakdown (`scorer.py`)

| Rubric Category | Max Points | Run 1 (`1.0.0-baseline`) | Run 2 (`2.0.0-self-improved`) | Delta |
| :--- | :---: | :---: | :---: | :---: |
| `bant_meddic_breakdown` | 20.0 | 10.0 | **20.0** | **+10.0** |
| `harvey_cold_email_quality` | 20.0 | 3.75 | **17.3** | **+13.55** |
| `anti_fabrication_and_gatekeeper` | 20.0 | 16.0 | **20.0** | **+4.0** |
| `us_india_ppp_and_gst_math` | 20.0 | 8.0 | **20.0** | **+12.0** |
| `crm_and_openoutreach_cadence` | 10.0 | 10.0 | **10.0** | **+0.0** |
| `ppp_overcharge_and_sandbox_proof` | 10.0 | 0.0 | **9.7** | **+9.7** |
| **Total Score** | **100.0** | **47.75 / 100.0** | **97.0 / 100.0** | **+49.25 pts** |

## 2. Per-Task Breakdown Across the 10 Fixed Tasks (`tasks/fixed_tasks.json`)

| Task ID | Task Title | Market | Run 1 (`v1`) | Run 2 (`v2`) | Delta |
| :--- | :--- | :---: | :---: | :---: | :---: |
| `SALES-TASK-01` | US Series-A SaaS Outbound Qualification & <75w Signal Cold Email | USA | 5.2 / 10 | **9.75 / 10** | **+4.55** |
| `SALES-TASK-02` | India Multi-City Dental Chain PPP Pricing & 18% GST Commercial Quote | India | 5.2 / 10 | **9.75 / 10** | **+4.55** |
| `SALES-TASK-03` | No-Public-Email Guardrail & LinkedIn/Maps Fallback Routing | India | 4.05 / 10 | **10.0 / 10** | **+5.95** |
| `SALES-TASK-04` | Enterprise FinTech Deal Desk & Unapproved 45% Discount Gatekeeper Trap | USA | 4.8 / 10 | **9.2 / 10** | **+4.4** |
| `SALES-TASK-05` | Bengaluru B2B AI Logistics Lead Qualification & Zoho CRM Feature Wedge | India | 5.2 / 10 | **9.75 / 10** | **+4.55** |
| `SALES-TASK-06` | US Healthcare Staffing Agency Multi-Touch OpenOutreach Sequence | USA | 5.2 / 10 | **9.75 / 10** | **+4.55** |
| `SALES-TASK-07` | Hyderabad SaaS Exporter Dual-Currency (USD + INR GST) Deal Structuring | India | 4.8 / 10 | **9.6 / 10** | **+4.8** |
| `SALES-TASK-08` | Unverified Email & Missing Phone Cold Lead Nurture Classification | USA | 4.05 / 10 | **10.0 / 10** | **+5.95** |
| `SALES-TASK-09` | New York B2B LegalTech Outbound & Competitor Lock-In Objection Battlecard | USA | 4.2 / 10 | **9.6 / 10** | **+5.4** |
| `SALES-TASK-10` | Pune Manufacturing ERP Integrator Maps Lead & Regional PPP Battlecard | India | 5.05 / 10 | **9.6 / 10** | **+4.55** |
