/**
 * MK-AI v6.1 Design Tokens & 6 Core Business Agents Sidebar (`src/renderer/styles/designTokens.ts`)
 * Web Agent & Maps Agent are integrated directly inside all 6 Core Agents!
 */
export const MKAI_DESIGN_TOKENS = {
  colors: {
    bgPrimary: '#0B0F19',
    bgElevated: '#111827',
    bgCard: '#131A2A',
    bgHover: '#1E293B',
    borderSubtle: '#1E293B',
    borderAccent: '#10B981',
    textPrimary: '#F8FAFC',
    textSecondary: '#CBD5E1',
    textMuted: '#94A3B8',
    accentEmerald: '#10B981',
    accentSky: '#38BDF8',
    accentAmber: '#F59E0B',
    statusConnected: '#10B981',
    statusRunning: '#38BDF8',
    statusWaitingApproval: '#F59E0B',
    statusError: '#EF4444',
    statusIdle: '#64748B',
  },
  spacing8pxGrid: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px',
    xxl: '40px',
  },
  radius: {
    sm: '8px',
    md: '12px',
    lg: '16px',
    pill: '9999px',
  },
  typography: {
    xs: '12px',
    sm: '14px',
    base: '16px',
    lg: '20px',
    xl: '24px',
  },
  a11y: {
    focusRingClass: 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B0F19]',
    reducedMotionClass: 'motion-reduce:transition-none motion-reduce:animate-none',
  },
} as const;

export interface DepartmentGroupItem {
  id: string;
  num: number;
  name: string;
  shortRole: string;
  modelBadge: string;
  repos: string[];
  status: 'idle' | 'running' | 'waiting_for_approval';
  exampleTasks: string[];
}

export interface SidebarDepartmentGroup {
  groupId: 'flagship_sales' | 'core_business';
  label: string;
  agents: DepartmentGroupItem[];
}

export const SIDEBAR_DEPARTMENT_GROUPS: SidebarDepartmentGroup[] = [
  {
    groupId: 'flagship_sales',
    label: 'Flagship #1 Priority (Web + Maps Integrated)',
    agents: [
      {
        id: 'mkai-02-sales',
        num: 2,
        name: '2. Sales & Lead Qualification Agent (MOST IMPORTANT)',
        shortRole: 'USA ($) vs India (₹) Pricing + Harvey + AI-Sales-Agent + OpenOutreach + EspoCRM + Brag + Built-in Web & Maps Agents',
        modelBadge: 'gptoss120B + Deepseek V3.2 + gemma 31B',
        repos: [
          'ethanplusai/harvey',
          'kaymen99/AI-Sales-agent',
          'latent-spaces/brag',
          'eracle/OpenOutreach',
          'espocrm/espocrm',
          'firecrawl/firecrawl',
          'browser-use/browser-use',
          'D4Vinci/Scrapling',
          'Kappaemme-git/codex-first-customer-finder-skill',
          'tinyfish-io/tinyfish-web-agent-integrations',
          'mahanaicoach/google-maps-scraper-kit',
          'gosom/google-maps-scraper',
          'omkarcloud/google-maps-scraper',
          'webAutomationLover/google-map-scraper',
        ],
        status: 'running',
        exampleTasks: [
          'Compare USA ($ USD) vs. India (₹ INR) competitor pricing, qualify leads via built-in Web & Maps Agents, and export Excel + PDF battlecard.',
          'Score B2B leads (0-100 BANT/MEDDIC), sync to EspoCRM, and stage <75w Harvey Gmail + OpenOutreach LinkedIn sequences.',
          'Generate a 20s Brag personalized sales pitch video and dual-currency (USD/INR) commercial proposal.',
        ],
      },
    ],
  },
  {
    groupId: 'core_business',
    label: 'Core Business Orchestra (Web & Maps Built-In)',
    agents: [
      {
        id: 'mkai-01-marketing',
        num: 1,
        name: '1. Marketing & Campaign Agent',
        shortRole: 'saas-marketing-agents + adaptico-os + awesome-marketing + kai-cmo-harness + Built-in Web & Maps Agents',
        modelBadge: 'gptoss120B (MAIN)',
        repos: [
          'shalintripathi/saas-marketing-agents',
          'adaptico/adaptico-os',
          'marketingtoolslist/awesome-marketing',
          'cgallic/kai-cmo-harness',
          'firecrawl/firecrawl',
          'browser-use/browser-use',
          'D4Vinci/Scrapling',
          'gosom/google-maps-scraper',
        ],
        status: 'idle',
        exampleTasks: [
          'Run a Kai CMO Harness funnel audit, scrape competitor ads via built-in Web Agent, and generate a 30-day campaign calendar.',
          'Create high-converting SaaS ad hooks, landing page copy, and technical SEO/GEO patches.',
        ],
      },
      {
        id: 'mkai-03-research',
        num: 3,
        name: '3. Research & Market Intelligence Agent',
        shortRole: 'Market-Intelligence-Agent + superleads + owli-market-research + Predictive-Analytics + Built-in Web & Maps Agents',
        modelBadge: 'Deepseek V3.2 (HEAVY)',
        repos: [
          'vikas-kashyap97/Market-Intelligence-Agent',
          'fleixweb/superleads',
          'S313S/owli-market-research',
          'hemantdpatil/Predictive-Marketing-Analytics',
          'firecrawl/firecrawl',
          'D4Vinci/Scrapling',
          'tinyfish-io/tinyfish-web-agent-integrations',
          'omkarcloud/google-maps-scraper',
        ],
        status: 'idle',
        exampleTasks: [
          'Analyze US vs. India TAM/SAM/SOM, competitor moves, and buyer sentiment via Owli & built-in Web/Maps Agents.',
          'Run SuperLeads B2B enrichment and Predictive-Marketing-Analytics CLV & price elasticity modeling.',
        ],
      },
      {
        id: 'mkai-04-ceo',
        num: 4,
        name: '4. Business Strategy / AI CEO Agent',
        shortRole: 'manifesto + sovereign-suite + orion-ceo-agent + unpod (Senior Management Consulting + Web & Maps)',
        modelBadge: 'Deepseek V3.2 (HEAVY)',
        repos: [
          'marsxhq/manifesto',
          'Repugrid/sovereign-suite',
          'sujalmanpara/orion-ceo-agent',
          'unpod-ai/unpod',
          'firecrawl/firecrawl',
          'browser-use/browser-use',
        ],
        status: 'idle',
        exampleTasks: [
          'Design a sustainable competitive moat, US vs. India market entry strategy, and unit economics model.',
          'Translate market dynamics into quarterly OKRs, board strategy memos, and multi-agent orchestra plans.',
        ],
      },
      {
        id: 'mkai-05-fundraising',
        num: 5,
        name: '5. Fundraising & Investor Relations Agent',
        shortRole: 'ir-kit + captable + civicrm-core + cc-skills-vc-fundraising + Auto-Make-Money + evalyze + Built-in Web Agent',
        modelBadge: 'Deepseek V3.2 (HEAVY)',
        repos: [
          'howieyoung/ir-kit',
          'captableinc/captable',
          'civicrm/civicrm-core',
          'tjboudreaux/cc-skills-vc-fundraising',
          'MrZilinXiao/Auto-Make-Money',
          'evalyze-ai/awesome-startup-fundraising',
        ],
        status: 'idle',
        exampleTasks: [
          'Model SAFE & Seed round cap table dilution (.xlsx) and author a 12-slide VC pitch deck (.pptx).',
          'Build an investor CRM pipeline, data room checklist, and Auto-Make-Money cashflow loop.',
        ],
      },
      {
        id: 'mkai-06-support',
        num: 6,
        name: '6. Customer Support Agent',
        shortRole: 'agentic-ai-starters + agent-desk + anythingllm-embed + helpin + ai-customer-service-agent + Built-in Web Agent',
        modelBadge: 'gemma 31B (FAST)',
        repos: [
          'cporter202/agentic-ai-starters',
          'huabeitech/agent-desk',
          'Mintplex-Labs/anythingllm-embed',
          'helpin-ai/helpin',
          'Bhavik-Jikadara/ai-customer-service-agent',
        ],
        status: 'idle',
        exampleTasks: [
          'Triage incoming support tickets by urgency & sentiment and draft instant RAG-backed resolutions.',
          'Configure AnythingLLM/Helpin embeddable helpdesk answers and gated refund approvals.',
        ],
      },
    ],
  },
];
