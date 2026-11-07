import type { LocalizedText } from '../../types/skill';

/**
 * Localized display names for the skills bundled with the app
 * (the ones listed in SKILLs/skills.config.json).
 *
 * The skill store currently ships English-only ids as names, so these give
 * Chinese users a readable title today. Once the server sends `displayName`
 * for a skill, that value wins over this map — see
 * `skillService.getLocalizedSkillName()`.
 *
 * When adding a bundled skill, add its display name here too; a missing entry
 * only means the prettified English name is shown.
 */
export const BUNDLED_SKILL_DISPLAY_NAMES: Record<string, LocalizedText> = {
  'article-writer': { zh: ' ', en: 'Article Writer' },
  'canvas-design': { zh: ' ', en: 'Canvas Design' },
  'content-planner': { zh: ' ', en: 'Content Planner' },
  'create-plan': { zh: ' ', en: 'Create Plan' },
  'daily-trending': { zh: ' ', en: 'Daily Trending' },
  'develop-web-game': { zh: ' ', en: 'Web Game Development' },
  'docx': { zh: 'Word  ', en: 'Word Documents' },
  'films-search': { zh: ' ', en: 'Films Search' },
  'frontend-design': { zh: ' ', en: 'Frontend Design' },
  'imap-smtp-email': { zh: ' ', en: 'Email (IMAP/SMTP)' },
  'local-tools': { zh: ' ', en: 'Local Tools' },
  'music-search': { zh: ' ', en: 'Music Search' },
  'pdf': { zh: 'PDF  ', en: 'PDF Toolkit' },
  'playwright': { zh: 'Playwright  ', en: 'Playwright' },
  'pptx': { zh: 'PPT  ', en: 'PowerPoint Slides' },
  'remotion': { zh: ' ', en: 'Programmatic Video' },
  'seedance': { zh: 'Seedance  ', en: 'Seedance' },
  'seedream': { zh: 'Seedream  ', en: 'Seedream' },
  'skill-creator': { zh: ' ', en: 'Skill Creator' },
  'skill-vetter': { zh: ' ', en: 'Skill Vetter' },
  'skin-creator': { zh: ' ', en: 'Skin Creator' },
  'stock-analyzer': { zh: ' ', en: 'Stock Analyzer' },
  'stock-announcements': { zh: ' ', en: 'Stock Announcements' },
  'stock-explorer': { zh: ' ', en: 'Stock Explorer' },
  'technology-news-search': { zh: ' ', en: 'Tech News Search' },
  'weather': { zh: ' ', en: 'Weather' },
  'web-search': { zh: ' ', en: 'Web Search' },
  'xlsx': { zh: ' ', en: 'Excel Spreadsheets' },
  'youdaonote': { zh: ' ', en: 'MK Cloud Notes' },
  'mkai-marketing-campaign': { zh: 'Marketing & Campaign Agent', en: 'MK AI · Marketing & Campaign Agent' },
  'mkai-developer-engineering': { zh: 'Developer Agent', en: 'MK AI · Developer Agent' },
  'mkai-content-copywriting': { zh: 'Content & Copywriting Agent', en: 'MK AI · Content & Copywriting Agent' },
  'mkai-sales-leads': { zh: 'Sales & Lead Qualification Agent', en: 'MK AI · Sales & Lead Qualification Agent' },
  'mkai-customer-support': { zh: 'Customer Support Agent', en: 'MK AI · Customer Support Agent' },
  'mkai-research-intelligence': { zh: 'Research & Market Intelligence Agent', en: 'MK AI · Research & Market Intelligence Agent' },
  'mkai-qa-testing': { zh: 'QA & Testing Agent', en: 'MK AI · QA & Testing Agent' },
  'mkai-data-analytics': { zh: 'Data & Analytics Agent', en: 'MK AI · Data & Analytics Agent' },
  'mkai-operations-orchestrator': { zh: 'Operations & Workflow Orchestrator (Manager)', en: 'MK AI · Operations & Workflow Orchestrator (Manager)' },
  'mkai-creative-design': { zh: 'Creative / Visual Design Agent', en: 'MK AI · Creative / Visual Design Agent' },
  'mkai-seo-discovery': { zh: 'SEO & Discovery Agent', en: 'MK AI · SEO & Discovery Agent' },
  'mkai-video-producer': { zh: 'Video Producer / Media Agent', en: 'MK AI · Video Producer / Media Agent' },
  'mkai-finance-accounting': { zh: 'Finance & Accounting Agent', en: 'MK AI · Finance & Accounting Agent' },
  'mkai-legal-compliance': { zh: 'Legal & Compliance Agent', en: 'MK AI · Legal & Compliance Agent' },
  'mkai-devops-infra': { zh: 'DevOps & Infrastructure Agent', en: 'MK AI · DevOps & Infrastructure Agent' },
  'mkai-hr-recruitment': { zh: 'HR & Recruitment Agent', en: 'MK AI · HR & Recruitment Agent' },
  'mkai-executive-assistant': { zh: 'Executive Assistant Agent', en: 'MK AI · Executive Assistant Agent' },
  'mkai-product-management': { zh: 'Product Management Agent', en: 'MK AI · Product Management Agent' },
  'mkai-project-management': { zh: 'Project Management Agent', en: 'MK AI · Project Management Agent' },
  'mkai-customer-success': { zh: 'Customer Success & Onboarding Agent', en: 'MK AI · Customer Success & Onboarding Agent' },
  'mkai-ecommerce-ops': { zh: 'E-commerce Store Operations Agent', en: 'MK AI · E-commerce Store Operations Agent' },
  'mkai-supply-chain': { zh: 'Supply Chain & Logistics Agent', en: 'MK AI · Supply Chain & Logistics Agent' },
  'mkai-voice-callcenter': { zh: 'Voice & Call Center Agent', en: 'MK AI · Voice & Call Center Agent' },
  'mkai-cybersecurity-secops': { zh: 'Cybersecurity Agent', en: 'MK AI · Cybersecurity Agent' },
  'mkai-strategy-ceo': { zh: 'Business Strategy / AI CEO Agent', en: 'MK AI · Business Strategy / AI CEO Agent' },
  'mkai-fundraising-ir': { zh: 'Fundraising & Investor Relations Agent', en: 'MK AI · Fundraising & Investor Relations Agent' },
  'mkai-community-reputation': { zh: 'Community & Reputation Agent', en: 'MK AI · Community & Reputation Agent' },
  'mkai-education-training': { zh: 'Education & Training Agent', en: 'MK AI · Education & Training Agent' },
  'mkai-document-processing': { zh: 'Document & Data Processing Agent', en: 'MK AI · Document & Data Processing Agent' },
  'mkai-partnerships-affiliate': { zh: 'Partnerships & Affiliate Agent', en: 'MK AI · Partnerships & Affiliate Agent' },
};