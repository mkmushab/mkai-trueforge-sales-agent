# MK-AI v6 — 8-Agent Business & Sales Orchestra (`AGENTS.md`)

All legacy 30 department agents have been eliminated and replaced with the focused **8-Agent Orchestra** (**6 Core Business Agents + 2 Shared Execution Engine Agents: Web Agent & Maps Agent**) commanding **44 Specialist Sub-Agents** across **34 Integrated Open-Source GitHub Repositories**.

## 3-Model Multi-LLM Router (`mkai-backend/router.py`)
1. **`gptoss120B` (`gpt-oss-120b` — `MAIN` Tier)**: Flagship Sales & Lead Qualification, Marketing Campaigns, Cold Email & LinkedIn Sequences, Proposals.
2. **`Deepseek V3.2` (`deepseek-v3.2` — `HEAVY` Tier)**: USA ($ USD) vs. India (₹ INR) Competitor Pricing & PPP Analysis, Market Intelligence, AI CEO Strategy Consulting, Cap Table & Fundraising Math.
3. **`gemma 31B` (`gemma-4-31B-it` — `FAST` Tier)**: High-Speed BANT/MEDDIC Lead Scoring, Customer Support Ticket Triage, Web & Google Maps Lead Extraction.

## Summary of the 8 Focused Agents

| # | Agent ID | Agent Name | Integrated Open-Source GitHub Repositories | Sub-Agents | Default Model Tier |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | `mkai-01-marketing` | **1. Marketing & Campaign Agent** | `shalintripathi/saas-marketing-agents`, `adaptico/adaptico-os`, `marketingtoolslist/awesome-marketing`, `cgallic/kai-cmo-harness` | 6 (`1.1`–`1.6`) | `MAIN` (`gptoss120B`) |
| 2 | `mkai-02-sales` | **2. Sales & Lead Qualification Agent (FLAGSHIP #1)** | `ethanplusai/harvey`, `kaymen99/AI-Sales-agent`, `latent-spaces/brag`, `eracle/OpenOutreach`, `espocrm/espocrm` + **USA ($ USD) vs. India (₹ INR) Competitor Pricing Engine** | 8 (`2.1`–`2.8`) | `MAIN` (`gptoss120B`) + `HEAVY` (`Deepseek V3.2`) |
| 3 | `mkai-03-research` | **3. Research & Market Intelligence Agent** | `vikas-kashyap97/Market-Intelligence-Agent`, `fleixweb/superleads`, `S313S/owli-market-research`, `hemantdpatil/Predictive-Marketing-Analytics` | 5 (`3.1`–`3.5`) | `HEAVY` (`Deepseek V3.2`) |
| 4 | `mkai-04-ceo` | **4. Business Strategy / AI CEO Agent** | `marsxhq/manifesto`, `Repugrid/sovereign-suite`, `sujalmanpara/orion-ceo-agent`, `unpod-ai/unpod` | 5 (`4.1`–`4.5`) | `HEAVY` (`Deepseek V3.2`) |
| 5 | `mkai-05-fundraising` | **5. Fundraising & Investor Relations Agent** | `howieyoung/ir-kit`, `captableinc/captable`, `civicrm/civicrm-core`, `tjboudreaux/cc-skills-vc-fundraising`, `MrZilinXiao/Auto-Make-Money`, `evalyze-ai/awesome-startup-fundraising` | 6 (`5.1`–`5.6`) | `HEAVY` (`Deepseek V3.2`) |
| 6 | `mkai-06-support` | **6. Customer Support Agent** | `cporter202/agentic-ai-starters`, `huabeitech/agent-desk`, `Mintplex-Labs/anythingllm-embed`, `helpin-ai/helpin`, `Bhavik-Jikadara/ai-customer-service-agent` | 5 (`6.1`–`6.5`) | `FAST` (`gemma 31B`) |
| 7 | `mkai-07-web-agent` | **7. WEB AGENT (Auto Laptop Chrome Fallback)** | `firecrawl/firecrawl`, `browser-use/browser-use`, `D4Vinci/Scrapling`, `Kappaemme-git/codex-first-customer-finder-skill`, `tinyfish-io/tinyfish-web-agent-integrations` | 5 (`7.1`–`7.5`) | `MAIN` (`gptoss120B`) |
| 8 | `mkai-08-maps-agent` | **8. MAPS AGENT (Google Maps Lead Scraper)** | `mahanaicoach/google-maps-scraper-kit`, `gosom/google-maps-scraper`, `omkarcloud/google-maps-scraper`, `webAutomationLover/google-map-scraper` | 4 (`8.1`–`8.4`) | `FAST` (`gemma 31B`) |
