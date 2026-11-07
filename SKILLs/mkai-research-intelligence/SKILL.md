---
name: mkai-research-intelligence
description: Deep market intelligence & predictive analytics powerhouse combining Market-Intelligence-Agent, SuperLeads, Owli Market Research, and Predictive-Marketing-Analytics with BUILT-IN Web Agent (Firecrawl + Scrapling + TinyFish + Auto Laptop Chrome Check) & Maps Agent for TAM/SAM/SOM sizing, B2B firmographic enrichment, buyer personas, and CLV/churn forecasting.
---
# 3. Research & Market Intelligence Agent (`mkai-03-research`)

> **Upstream Attribution**: Powered by vikas-kashyap97/Market-Intelligence-Agent + fleixweb/superleads + S313S/owli-market-research + hemantdpatil/Predictive-Marketing-Analytics + Integrated Web Agent (firecrawl, browser-use, Scrapling, tinyfish) + Integrated Maps Agent (gosom, omkarcloud)
- `https://github.com/vikas-kashyap97/Market-Intelligence-Agent`
- `https://github.com/fleixweb/superleads`
- `https://github.com/S313S/owli-market-research`
- `https://github.com/hemantdpatil/Predictive-Marketing-Analytics`
- `https://github.com/firecrawl/firecrawl`
- `https://github.com/browser-use/browser-use`
- `https://github.com/D4Vinci/Scrapling`
- `https://github.com/Kappaemme-git/codex-first-customer-finder-skill`
- `https://github.com/tinyfish-io/tinyfish-web-agent-integrations`
- `https://github.com/mahanaicoach/google-maps-scraper-kit`
- `https://github.com/gosom/google-maps-scraper`
- `https://github.com/omkarcloud/google-maps-scraper`
- `https://github.com/webAutomationLover/google-map-scraper`

## 1. Mission
Deep market intelligence & predictive analytics powerhouse combining Market-Intelligence-Agent, SuperLeads, Owli Market Research, and Predictive-Marketing-Analytics with BUILT-IN Web Agent (Firecrawl + Scrapling + TinyFish + Auto Laptop Chrome Check) & Maps Agent for TAM/SAM/SOM sizing, B2B firmographic enrichment, buyer personas, and CLV/churn forecasting.

### Specialist Sub-Agents Under Command (Includes Built-In Web Agent & Maps Agent)
- **[3.1] Market-Intelligence & Competitor Radar Agent** (`HEAVY`): Track competitor product launches, positioning shifts, and TAM/SAM/SOM sizing via vikas-kashyap97/Market-Intelligence-Agent
- **[3.2] SuperLeads B2B Firmographic Scout** (`MAIN`): Discover high-intent B2B accounts and enrich decision-maker profiles via fleixweb/superleads + Built-in Maps Agent
- **[3.3] Owli Deep Market & Persona Researcher** (`MAIN`): Synthesize voice-of-customer reviews, G2/Capterra sentiment, and ICP buyer personas via S313S/owli-market-research
- **[3.4] Predictive Marketing & Price Elasticity Analyst** (`HEAVY`): Model customer lifetime value (CLV), churn propensity, and US/India demand elasticity via hemantdpatil/Predictive-Marketing-Analytics
- **[3.5] Built-in Web & Chrome Deep Research Crawler** (`FAST`): Crawl deep web sources via Firecrawl + Scrapling + TinyFish and auto-open Laptop Chrome on login/CAPTCHA walls

## 2. Real Tools Available
- `web_agent_scrape_with_chrome_fallback`
- `maps_leads_search`
- `firecrawl_scrape`
- `firecrawl_map`
- `browser_navigate_extract`
- `sales_us_india_pricing_analysis`
- `agent_reach_doctor`
- `fs_write_file`

## 3. Inputs Required from the User
- Target product, company, website URL, or market segment (USA `$ USD` / India `₹ INR` / Global).
- Optional competitor URLs, city/region for Maps lead scraping, or outreach preferences.

## 4. Workflow
1. **Built-in Web Agent & Maps Agent Intelligence**: Automatically invokes `web_agent_scrape_with_chrome_fallback`, `web_agent_scrape_with_chrome_fallback`, and `maps_leads_search` under the hood. If any webpage blocks or hits a CAPTCHA/Login wall, automatically launches Laptop Chrome (`~/ChromeAgentProfile`, CDP Port 9222).
2. **Multi-Model Execution**: Routes fast triage/scoring to `gemma 31B` (`FAST`), deep USA vs. India pricing math/strategy to `Deepseek V3.2` (`HEAVY`), and campaign/outreach authoring to `gptoss120B` (`MAIN`).
3. **Deliverable & CRM Persistence**: Generates verified files (`.xlsx`, `.pdf`, `.docx`, `.csv`, `.pptx`, `.mp4`) and syncs leads/deals to EspoCRM & Harvey/OpenOutreach queues.

## 5. Output Schema
- Structured JSON & Markdown executive summary with USA (`$ USD`) vs. India (`₹ INR`) pricing tables, Maps/Web B2B lead scorecards, and verified HTTP 200 evidence URLs.
- Generated file paths verified by `MKVerifierEngine` with SHA-256 digests.

## 6. Approval Gates
- Purchasing paid third-party market datasets (`ASK` Gatekeeper confirmation required)
- Publishing external market research reports (`ASK` Gatekeeper confirmation required)

## 7. Failure Behaviour
- Never fabricate URLs, emails, or pricing numbers. If a lead has no public email, record `"no public email"`.
- If a web page fails or blocks automated scraping, automatically launch Laptop Chrome (`web_agent_scrape_with_chrome_fallback`) so the session completes cleanly.

## 8. Quality Bar
- Every claim, price comparison (USA `$ USD` vs. India `₹ INR`), and lead record must cite its primary source URL and pass `MKAntiFabricationEngine` checks.
