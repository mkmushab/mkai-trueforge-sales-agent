import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet-async';

// ─── APP THEME — single, fixed (matches Home.jsx's emerald/sky/gold glass palette) ─
const APP_THEME = {
  pageBg: '#f6faf7',
  pageBgGradient: 'radial-gradient(ellipse 70% 50% at 20% 10%,rgba(15,169,104,0.08) 0%,transparent 55%),radial-gradient(ellipse 50% 60% at 80% 90%,rgba(21,150,214,0.06) 0%,transparent 55%)',
  headerBg: 'rgba(246,250,247,0.96)',
  headerBorder: 'rgba(18,54,42,0.10)',
  cardBg: 'rgba(255,255,252,0.88)',
  cardBorder: 'rgba(18,54,42,0.10)',
  cardBorderHover: 'rgba(15,169,104,0.4)',
  inputBg: '#fffefb',
  inputBorder: 'rgba(18,54,42,0.12)',
  inputColor: '#122420',
  selectBg: '#fffefb',
  textPrimary: '#122420',
  textSecondary: '#5c6b64',
  textMuted: 'rgba(18,54,42,0.42)',
  labelColor: '#5c6b64',
  tabBg: 'rgba(15,169,104,0.06)',
  tabActiveBg: 'rgba(15,169,104,0.16)',
  tabActiveColor: '#0C8457',
  tabInactiveColor: '#5c6b64',
  sectionCardBg: 'rgba(255,255,252,0.7)',
  sectionCardBorder: 'rgba(18,54,42,0.08)',
  toastBg: '#fffefb',
  toastBorder: 'rgba(18,54,42,0.15)',
  toastColor: '#122420',
  toggleBg: 'rgba(15,169,104,0.08)',
  toggleBorder: 'rgba(15,169,104,0.22)',
  backBtnBg: 'rgba(15,169,104,0.1)',
  backBtnBorder: 'rgba(15,169,104,0.35)',
  backBtnColor: '#0C8457',
  profileBtnBg: 'rgba(15,169,104,0.05)',
  profileBtnBorder: 'rgba(15,169,104,0.2)',
  profileBtnColor: '#5c6b64',
  profileBtnActiveBg: 'rgba(15,169,104,0.15)',
  profileBtnActiveBorder: 'rgba(15,169,104,0.5)',
  profileBtnActiveColor: '#0C8457',
  removeBtnBg: 'rgba(220,60,60,0.06)',
  removeBtnBorder: 'rgba(220,60,60,0.18)',
  removeBtnColor: '#B23B3B',
  addBtnBorder: 'rgba(15,169,104,0.25)',
  addBtnColor: '#5c6b64',
  hintBg: 'rgba(21,150,214,0.06)',
  hintBorder: 'rgba(21,150,214,0.2)',
  hintColor: '#0E77AC',
  warningBg: 'rgba(242,169,59,0.08)',
  warningBorder: 'rgba(242,169,59,0.25)',
  warningColor: '#92600E',
  successBg: 'rgba(15,169,104,0.07)',
  successBorder: 'rgba(15,169,104,0.22)',
  successColor: '#0C8457',
  previewBg: '#fff',
  divider: 'rgba(18,54,42,0.08)',
  statBg: 'rgba(15,169,104,0.06)',
  badgeTagBg: 'rgba(15,169,104,0.08)',
  badgeTagBorder: 'rgba(15,169,104,0.2)',
  badgeTagColor: '#0C8457',
};

// ─── 7 AI PROVIDERS (same as PDF.jsx) ────────────────────────────────────────
const AI_PROVIDERS = [
  {
    name: 'GeneralCompute',
    url: 'https://api.generalcompute.com/v1/chat/completions',
    key: 'YOUR_API_KEY_PLACEHOLDER',
    model: 'gpt-oss-120b',
    type: 'openai',
  },
  {
    name: 'Groq',
    url: 'https://api.groq.com/openai/v1/chat/completions',
    key: 'YOUR_API_KEY_PLACEHOLDER',
    model: 'qwen/qwen3-32b',
    type: 'openai',
  },
  {
    name: 'Cohere',
    url: 'https://api.cohere.com/v2/chat',
    key: 'YOUR_API_KEY_PLACEHOLDER',
    model: 'command-r-plus',
    type: 'cohere',
  },
  {
    name: 'Mistral',
    url: 'https://api.mistral.ai/v1/chat/completions',
    key: 'YOUR_API_KEY_PLACEHOLDER',
    model: 'mistral-large-latest',
    type: 'openai',
  },
  {
    name: 'Novita',
    url: 'https://api.novita.ai/v3/openai/chat/completions',
    key: 'YOUR_API_KEY_PLACEHOLDER',
    model: 'meta-llama/llama-3.3-70b-instruct',
    type: 'openai',
  },
  {
    name: 'DeepInfra',
    url: 'https://api.deepinfra.com/v1/openai/chat/completions',
    key: 'YOUR_API_KEY_PLACEHOLDER',
    model: 'meta-llama/Llama-3.3-70B-Instruct',
    type: 'openai',
  },
  {
    name: 'SambaNova',
    url: 'https://api.sambanova.ai/v1/chat/completions',
    key: 'YOUR_API_KEY_PLACEHOLDER',
    model: 'Meta-Llama-3.3-70B-Instruct',
    type: 'openai',
  },
  {
    name: 'OpenRouter',
    url: 'https://openrouter.ai/api/v1/chat/completions',
    key: 'YOUR_API_KEY_PLACEHOLDER',
    model: 'meta-llama/llama-3.3-70b-instruct',
    type: 'openai',
    extraHeaders: { 'HTTP-Referer': 'https://mkai.tech', 'X-Title': 'MK-AI' },
  },
];

const GEMINI_API_KEY = 'YOUR_API_KEY_PLACEHOLDER';
const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
const PDFJS_VERSION = '3.11.174';

const failCounts = Object.fromEntries(AI_PROVIDERS.map(p => [p.name, 0]));
const MAX_FAILS = 3;
const PRIMARY_PROVIDER_NAME = 'GeneralCompute';
let rrIndex = 0;

function getNextProvider() {
  const fallbacks = AI_PROVIDERS.filter(p => p.name !== PRIMARY_PROVIDER_NAME);
  const total = fallbacks.length;
  for (let i = 0; i < total; i++) {
    const p = fallbacks[rrIndex % total];
    rrIndex++;
    if (failCounts[p.name] < MAX_FAILS) return p;
  }
  AI_PROVIDERS.forEach(p => { failCounts[p.name] = 0; });
  rrIndex = 0;
  return fallbacks[0];
}

async function callProviderOnce(provider, messages) {
  if (provider.type === 'railway') {
    const res = await fetch(provider.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: provider.model,
        messages,
        max_tokens: 3000,
        temperature: 0.3,
      }),
    });
    if (!res.ok) throw new Error(`Railway HTTP ${res.status}`);
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content || data?.content || data?.text || data?.response;
    if (!text) throw new Error('Railway empty response');
    return text;
  }

  if (provider.type === 'cohere') {
    const system = messages.find(m => m.role === 'system');
    const chat = messages.filter(m => m.role !== 'system');
    const res = await fetch(provider.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${provider.key}` },
      body: JSON.stringify({
        model: provider.model,
        preamble: system?.content || '',
        chat_history: chat.slice(0, -1).map(m => ({
          role: m.role === 'user' ? 'USER' : 'CHATBOT',
          message: m.content,
        })),
        message: chat[chat.length - 1]?.content || '',
        max_tokens: 3000,
        temperature: 0.3,
      }),
    });
    if (!res.ok) throw new Error(`Cohere HTTP ${res.status}`);
    const data = await res.json();
    const text = data?.text || data?.message?.content?.[0]?.text;
    if (!text) throw new Error('Cohere empty response');
    return text;
  }

  const res = await fetch(provider.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${provider.key}`,
      ...(provider.extraHeaders || {}),
    },
    body: JSON.stringify({
      model: provider.model,
      messages,
      max_tokens: 3000,
      temperature: 0.3,
    }),
  });
  if (!res.ok) throw new Error(`${provider.name} HTTP ${res.status}`);
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error(`${provider.name} empty response`);
  return text;
}

async function callAI(systemPrompt, userContent, maxTokens = 3000) {
  const messages = [
    ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
    { role: 'user', content: typeof userContent === 'string' ? userContent : JSON.stringify(userContent) },
  ];

  const tried = new Set();
  const primary = AI_PROVIDERS.find(p => p.name === PRIMARY_PROVIDER_NAME) || AI_PROVIDERS[0];

  if (failCounts[primary.name] < MAX_FAILS) {
    tried.add(primary.name);
    try {
      console.log(`[Resume] Trying ${primary.name} [PRIMARY]`);
      const text = await callProviderOnce(primary, messages);
      failCounts[primary.name] = 0;
      return text;
    } catch (err) {
      failCounts[primary.name]++;
      console.warn(`[Resume] ${primary.name} failed: ${err.message}`);
    }
  }

  for (let attempt = 0; attempt < AI_PROVIDERS.length; attempt++) {
    const provider = getNextProvider();
    if (tried.has(provider.name)) continue;
    tried.add(provider.name);
    try {
      console.log(`[Resume] Trying ${provider.name}`);
      const text = await callProviderOnce(provider, messages);
      failCounts[provider.name] = 0;
      return text;
    } catch (err) {
      failCounts[provider.name]++;
      console.warn(`[Resume] ${provider.name} failed: ${err.message}`);
      await new Promise(r => setTimeout(r, 400));
    }
  }

  AI_PROVIDERS.forEach(p => { failCounts[p.name] = 0; });
  throw new Error('All AI providers failed. Please try again.');
}

async function callGemini(prompt) {
  if (!GEMINI_API_KEY || GEMINI_API_KEY.includes('PASTE_YOUR')) {
    throw new Error('Add your Gemini API key (GEMINI_API_KEY) near the top of this file first.');
  }
  const res = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 3000 },
    }),
  });
  if (!res.ok) { const t = await res.text().catch(() => ''); throw new Error(`Gemini HTTP ${res.status} ${t.slice(0, 180)}`); }
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
  if (!text) throw new Error('Empty response from Gemini');
  return text;
}

let pdfjsLoadPromise = null;
function loadPdfJs() {
  if (typeof window === 'undefined') return Promise.reject(new Error('No window'));
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  if (pdfjsLoadPromise) return pdfjsLoadPromise;
  pdfjsLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.min.js`;
    script.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.js`;
      resolve(window.pdfjsLib);
    };
    script.onerror = () => reject(new Error('Could not load pdf.js from CDN'));
    document.head.appendChild(script);
  });
  return pdfjsLoadPromise;
}

async function readResumePdfWithGemini(file) {
  const pdfjsLib = await loadPdfJs();
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  let rawText = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    rawText += content.items.map(it => it.str).join(' ') + '\n';
  }
  if (!rawText.trim()) throw new Error('Could not read text from this PDF (it may be a scanned image).');

  const cleaned = await callGemini(
    `You are reading a resume PDF whose text was extracted mechanically and may have jumbled spacing, merged columns, or broken line order. Reconstruct it as clean, readable plain text, preserving all real content (sections, bullet points, dates, skills) but fixing ordering and spacing. Do not summarize, do not omit anything, do not add commentary — output ONLY the cleaned resume text.

Raw extracted text:
"""${rawText.slice(0, 15000)}"""`
  );
  return cleaned.trim();
}

function parseJSON(text) {
  for (const fn of [
    () => JSON.parse(text),
    () => { const m = text.match(/```json\s*([\s\S]*?)```/); return m && JSON.parse(m[1]); },
    () => { const m = text.match(/```\s*([\s\S]*?)```/); return m && JSON.parse(m[1]); },
    () => { const m = text.match(/\{[\s\S]*\}/); return m && JSON.parse(m[0]); }
  ]) try { const r = fn(); if (r && typeof r === 'object') return r; } catch (_) {}
  return null;
}

function splitSkills(str) {
  if (!str || !str.trim()) return [];
  return str.split(',').map(s => s.trim()).filter(Boolean);
}

function hasRealExp(exp) {
  return (exp || []).some(e => (e.title || e.company || '').trim() !== '');
}

function inferJobTitle(profile) {
  if (profile.targetJob && profile.targetJob.trim()) return profile.targetJob.trim();
  const expTitles = (profile.exp || []).filter(e => e.title?.trim()).map(e => e.title.trim());
  if (expTitles.length) return expTitles[0];
  const projText = (profile.projects || []).map(p => (p.name + ' ' + p.desc).toLowerCase()).join(' ');
  if (projText.includes('ai') && projText.includes('product')) return 'AI Product Developer';
  if (projText.includes('ai') || projText.includes('llm') || projText.includes('ml')) return 'AI Developer';
  if (projText.includes('fullstack') || projText.includes('full-stack') || projText.includes('full stack')) return 'Full Stack Developer';
  if (projText.includes('react') || projText.includes('frontend') || projText.includes('front-end')) return 'Frontend Developer';
  if (projText.includes('backend') || projText.includes('api') || projText.includes('server')) return 'Backend Developer';
  const tech = (profile.tech || '').toLowerCase();
  if (tech.includes('vlsi') || tech.includes('verilog') || tech.includes('vhdl')) return 'VLSI Design Engineer';
  if (tech.includes('fastapi') || tech.includes('python')) {
    if (tech.includes('react') || tech.includes('frontend')) return 'Full Stack Developer';
    return 'Python Developer';
  }
  if (tech.includes('react') || tech.includes('vue') || tech.includes('next')) return 'Frontend Developer';
  if (tech.includes('ml') || tech.includes('tensorflow') || tech.includes('pytorch')) return 'ML Engineer';
  if (tech.includes('android') || tech.includes('kotlin') || tech.includes('flutter')) return 'Mobile Developer';
  return 'Software Engineer';
}

function autoEduContext(edu) {
  if (!edu.degree || !edu.field) return '';
  const deg = edu.degree.toLowerCase();
  if (deg.includes('b.tech') || deg.includes('b.e')) return `Graduated with a strong foundation in ${edu.field.toLowerCase()}, covering core engineering principles and practical applications.`;
  if (deg.includes('m.tech') || deg.includes('m.e')) return `Advanced studies in ${edu.field.toLowerCase()} with focus on research and specialized technical skills.`;
  if (deg.includes('mba')) return `Gained strong business acumen and management skills with specialization in ${edu.field.toLowerCase()}.`;
  if (deg.includes('bca') || deg.includes('b.sc')) return `Developed a solid foundation in ${edu.field.toLowerCase()} with hands-on programming and analytical skills.`;
  if (deg.includes('mca') || deg.includes('m.sc')) return `Advanced expertise in ${edu.field.toLowerCase()} with focus on applied computing and software development.`;
  if (deg.includes('12th') || deg.includes('hsc')) return `Completed higher secondary education with strong academic performance in core subjects.`;
  if (deg.includes('10th') || deg.includes('ssc')) return `Completed secondary education with a strong academic foundation.`;
  if (deg.includes('diploma')) return `Completed diploma with practical training in ${edu.field.toLowerCase()}.`;
  return `Studied ${edu.field.toLowerCase()} with a strong academic foundation and hands-on learning.`;
}

// ─── BRAND RESUME THEME — single, fixed (matches the MK-AI emerald palette) ──
// Used by every generated resume PDF. No picker, no randomness.
const BRAND_RESUME_THEME = { bg: '#0C8457', acc: '#0FA968', lt: '#E8F5EE', grad: 'linear-gradient(135deg,#0C8457 0%,#0FA968 100%)' };

const RESUME_TEMPLATES = [
  { id: 'modern',  name: 'Modern Colorful', blurb: 'Gradient header, color pills, icons' },
  { id: 'classic', name: 'Classic ATS',     blurb: 'Plain black & white, single column — max ATS compatibility' },
  { id: 'minimal', name: 'Minimal Clean',   blurb: 'Subtle accent line, no color blocks, elegant spacing' },
];

const ALL_TOOLS = [
  { id: 'resume',    icon: '📄', title: 'Resume Builder',     desc: 'ATS-optimized resume with proper PDF export',    color: '#0FA968', glow: 'rgba(15,169,104,0.12)',  badge: 'Popular' },
  { id: 'enhancer',  icon: '✨', title: 'Resume Enhancer',    desc: 'Upload or paste old resume — AI rewrites & builds your profile', color: '#1596D6', glow: 'rgba(21,150,214,0.12)' },
  { id: 'scanner',   icon: '📝', title: 'Text Extractor',     desc: 'Upload a PDF or paste certificate text — AI fills your profile', color: '#F2A93B', glow: 'rgba(242,169,59,0.12)'  },
  { id: 'cover',     icon: '✉️', title: 'Cover Letter',       desc: 'Job-specific, personalized cover letters',       color: '#0C8457', glow: 'rgba(12,132,87,0.12)' },
  { id: 'linkedin',  icon: '💼', title: 'LinkedIn Optimizer', desc: 'Headline, summary, skills & connection notes',   color: '#0E77AC', glow: 'rgba(14,119,172,0.12)'  },
  { id: 'ats',       icon: '🎯', title: 'ATS Analyzer',       desc: 'Score your resume vs any job description — upload a PDF or paste text', color: '#17B890', glow: 'rgba(23,184,144,0.12)'  },
  { id: 'advisor',   icon: '🧠', title: 'Career Advisor',     desc: 'Personalized roadmap, skills & salary insights', color: '#0FA968', glow: 'rgba(15,169,104,0.12)', badge: 'New' },
  { id: 'interview', icon: '💬', title: 'Interview Prep',     desc: 'Custom Q&A practice for your exact role',        color: '#F2A93B', glow: 'rgba(242,169,59,0.12)',  badge: 'New' }
];

const BLANK = {
  name: '', email: '', phone: '', location: '', linkedin: '',
  github: '', portfolio: '', targetJob: '',
  edu: [{ degree: '', field: '', inst: '', year: '', grade: '', context: '' }],
  exp: [{ title: '', company: '', dur: '', loc: '', pts: '', gapReason: '' }],
  tech: '', soft: '', tools: '', langs: '', certs: '', certsDetail: [],
  projects: [{ name: '', desc: '', tech: '', link: '' }],
  achievements: ''
};

function profileScore(p) {
  const f = [p.name, p.email, p.phone, p.targetJob || inferJobTitle(p), p.location, p.edu[0]?.degree, p.exp[0]?.title || p.exp[0]?.company || p.projects[0]?.name, p.tech];
  return Math.round(f.filter(Boolean).length / f.length * 100);
}

// ─── RESUME QUALITY ENGINE (the 15-point checklist) ──────────────────────────
const WEAK_VERBS = ['helped', 'worked on', 'responsible for', 'assisted', 'supported', 'involved in', 'participated in', 'tasked with', 'handled', 'was part of', 'contributed to'];
const STRONG_VERBS = ['Led', 'Drove', 'Launched', 'Owned', 'Spearheaded', 'Built', 'Scaled', 'Architected', 'Delivered', 'Automated', 'Optimized', 'Shipped'];
const BUZZWORDS = ['hardworking', 'hard-working', 'hard working', 'team player', 'detail-oriented', 'detail oriented', 'go-getter', 'self-motivated', 'fast learner', 'dynamic individual', 'results-oriented', 'passionate individual', 'people person'];

function collectBullets(result) {
  const bullets = [];
  (result.experience || []).forEach(exp => {
    const pts = Array.isArray(exp.points) ? exp.points : (exp.points || '').split('\n');
    pts.forEach(p => { if (p && p.trim()) bullets.push(p.replace(/^[-•▸]/, '').trim()); });
  });
  (result.achievements || []).forEach(a => { if (a && a.trim()) bullets.push(a.trim()); });
  return bullets;
}

function analyzeResumeQuality(result, profile) {
  if (!result) return { score: 0, checks: [] };
  const bullets = collectBullets(result);
  const checks = [];

  const weakHits = bullets.filter(b => WEAK_VERBS.some(w => b.toLowerCase().startsWith(w) || b.toLowerCase().includes(' ' + w)));
  checks.push({
    id: 'verbs', title: '1. Strong Action Verbs', pass: weakHits.length === 0,
    detail: weakHits.length
      ? `${weakHits.length} bullet(s) start with weak verbs like "helped / worked on / responsible for". Swap for ${STRONG_VERBS.slice(0, 4).join(', ')}...`
      : 'Every bullet opens with a strong ownership verb.'
  });

  const withMetric = bullets.filter(b => /\d/.test(b));
  const metricRatio = bullets.length ? withMetric.length / bullets.length : 1;
  checks.push({
    id: 'metrics', title: '2. Metrics & Outcomes', pass: bullets.length === 0 || metricRatio >= 0.6,
    detail: bullets.length === 0 ? 'Add bullets to check for measurable impact.'
      : metricRatio >= 0.6 ? `${withMetric.length}/${bullets.length} bullets are backed by a number (%, ₹, time, users, scale).`
      : `Only ${withMetric.length}/${bullets.length} bullets have a number. Add a metric to the rest — if exact data isn't available, use a fair estimate (e.g. "~20% faster").`
  });

  const buzzHits = bullets.concat([result.summary || '']).filter(b => BUZZWORDS.some(w => b.toLowerCase().includes(w)));
  checks.push({
    id: 'buzzwords', title: '3. No Generic Buzzwords', pass: buzzHits.length === 0,
    detail: buzzHits.length ? `Found unproven filler like "hardworking" / "team player". Replace each with a specific, provable achievement.` : 'No generic filler words detected — every claim reads as backed by evidence.'
  });

  const gapNotesGiven = (profile.exp || []).filter(e => e.gapReason && e.gapReason.trim()).length;
  const multipleRoles = (profile.exp || []).filter(e => (e.title || e.company || '').trim()).length > 1;
  checks.push({
    id: 'gaps', title: '4. Career Gap Handling', pass: true,
    detail: multipleRoles
      ? (gapNotesGiven > 0 ? `${gapNotesGiven} gap reason(s) noted — gaps read as intentional, not hidden.` : 'If there is a 2+ month gap between roles, add a short reason in Profile → Experience (layoff, upskilling, caregiving, sabbatical). Unexplained gaps invite guesswork.')
      : 'Add reasons for any employment gaps in Profile → Experience once you have 2+ roles.'
  });

  const missing = result.keywords_missing || [];
  checks.push({
    id: 'jd', title: '5. Job-Description Keyword Match', pass: missing.length === 0,
    detail: missing.length ? `${missing.length} JD keyword(s) still missing: ${missing.slice(0, 6).join(', ')}. Weave these into your bullets/skills using your own real experience.` : 'Resume language mirrors the target job description well.'
  });

  const expCount = (result.experience || []).filter(e => (e.title || e.company || '').trim()).length;
  checks.push({
    id: 'recency', title: '6. Recency Weightage', pass: true,
    detail: expCount > 3
      ? 'You have several roles — keep full detail only for the last 5-7 years; collapse older roles to title + company + 1-2 lines.'
      : 'Keep detailed bullets for recent roles (last 5-7 years); trim anything older.'
  });

  const techWords = ['built', 'developed', 'coded', 'engineered', 'implemented', 'designed', 'deployed', 'architected', 'debugged', 'optimized'];
  const bizWords = ['revenue', 'sales', 'client', 'cost', 'budget', 'roi', 'stakeholder', 'market', 'customer', 'growth'];
  const leadWords = ['led', 'managed', 'mentored', 'trained', 'coordinated', 'supervised', 'onboarded'];
  let t = 0, b = 0, l = 0;
  bullets.forEach(bt => { const low = bt.toLowerCase(); if (techWords.some(w => low.includes(w))) t++; if (bizWords.some(w => low.includes(w))) b++; if (leadWords.some(w => low.includes(w))) l++; });
  const totalCat = t + b + l;
  const maxShare = totalCat ? Math.max(t, b, l) / totalCat : 0;
  checks.push({
    id: 'balance', title: '7. Technical / Business / Leadership Balance', pass: totalCat <= 1 || maxShare < 0.85,
    detail: totalCat > 1 && maxShare >= 0.85 ? 'Bullets lean almost entirely into one lane. Add 1-2 lines showing business impact or leadership too, for a well-rounded story.' : 'Good spread across technical delivery, business impact, and leadership.'
  });

  checks.push({
    id: 'atsformat', title: '8. ATS-Friendly Format', pass: true,
    detail: 'Every template here is single-column plain text with standard section headers (Experience, Education, Skills) — no tables, columns or graphics, so ATS parsers read it cleanly. Pick "Classic ATS" for maximum compatibility.'
  });

  checks.push({
    id: 'order', title: '9. Reverse-Chronological Order', pass: true,
    detail: 'Make sure your most recent role and most recent degree are entered first in Profile → Experience / Education — sections render in the order you add them.'
  });

  const hasJD = !!(result._jobDescUsed && result._jobDescUsed.trim());
  checks.push({
    id: 'tailor', title: '10. Tailored for This Job', pass: hasJD,
    detail: hasJD ? 'This version was generated against a specific job description.' : 'Paste a job description before generating (or regenerate with one) to tailor language and keywords to that exact role.'
  });

  const summaryLen = (result.summary || '').split(/\s+/).filter(Boolean).length;
  checks.push({
    id: 'scan', title: '11. 6-Second Scan Optimizer', pass: summaryLen >= 25 && summaryLen <= 90,
    detail: summaryLen < 25 ? 'Summary is short — strengthen the top third (headline, summary, first 2-3 bullets), since that\'s what gets the most eye time.'
      : summaryLen > 90 ? 'Summary runs long — tighten it so your strongest points are visible in the first glance.'
      : 'Summary length is well tuned for a fast first scan.'
  });

  const pronounRegex = /(^|[\s(])(i|my|me)([\s.,!?)]|$)/i;
  const pronounHits = bullets.concat([result.summary || '']).filter(b => pronounRegex.test(b));
  checks.push({
    id: 'pronoun', title: '12. No First-Person Pronouns', pass: pronounHits.length === 0,
    detail: pronounHits.length ? `Found "I / my / me" in ${pronounHits.length} place(s). Resumes are written in implied first person — drop the pronoun (e.g. "Managed a team", not "I managed a team").` : 'No first-person pronouns — reads in proper implied-first-person resume style.'
  });

  const isSenior = expCount >= 3;
  checks.push({
    id: 'length', title: '13. Length / Page Checker', pass: true,
    detail: isSenior ? 'With 3+ roles this reads as mid/senior level — keep the exported PDF to a maximum of 2 pages.' : 'Fresher / early-career profile — aim to keep this to a single page; trim to only the strongest bullets.'
  });

  const ingStart = bullets.filter(b => /^\w+ing\b/i.test(b)).length;
  const pastStart = bullets.filter(b => /^\w+ed\b/i.test(b)).length;
  const mixedTense = ingStart > 0 && pastStart > 0;
  checks.push({
    id: 'consistency', title: '14. Tense & Format Consistency', pass: !mixedTense,
    detail: mixedTense ? 'Bullets mix "-ing" and past-tense verb openings. Use past tense for previous roles and present tense only for your current role, consistently throughout.' : 'Verb tense and bullet punctuation look consistent.'
  });

  const emailOk = !result.email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result.email);
  const linkedinOk = !result.linkedin || /linkedin\.com/i.test(result.linkedin);
  const githubOk = !result.github || /github\.com/i.test(result.github);
  const contactIssues = [!emailOk && 'email format looks off', !linkedinOk && 'LinkedIn should be a linkedin.com URL', !githubOk && 'GitHub should be a github.com URL'].filter(Boolean);
  checks.push({
    id: 'contact', title: '15. Contact Info & Links Validator', pass: contactIssues.length === 0,
    detail: contactIssues.length ? contactIssues.join('; ') + '.' : 'Email and links are valid, clickable, and professional.'
  });

  const passCount = checks.filter(c => c.pass).length;
  return { score: Math.round((passCount / checks.length) * 100), checks };
}

// ─── DYNAMIC STYLES (theme-aware) ────────────────────────────────────────────
function makeIS(A) {
  return { width: '100%', background: A.inputBg, border: `1px solid ${A.inputBorder}`, borderRadius: 8, padding: '10px 13px', color: A.inputColor, fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' };
}
function makeLS(A) {
  return { display: 'block', fontSize: 11, color: A.labelColor, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.07em' };
}
function makeCS(A) {
  return { background: A.sectionCardBg, border: `1px solid ${A.sectionCardBorder}`, borderRadius: 12, padding: 18, marginBottom: 12 };
}

// ─── REUSABLE COMPONENTS ──────────────────────────────────────────────────────
function Field({ label, value, onChange, ph, A }) {
  const IS = makeIS(A); const LS = makeLS(A);
  return <div><label style={LS}>{label}</label><input value={value || ''} onChange={e => onChange(e.target.value)} placeholder={ph} style={IS} /></div>;
}

function Area({ label, value, onChange, ph, rows = 4, A }) {
  const IS = makeIS(A); const LS = makeLS(A);
  return (
    <div style={{ marginBottom: 14 }}>
      {label && <label style={LS}>{label}</label>}
      <textarea rows={rows} value={value || ''} onChange={e => onChange(e.target.value)} placeholder={ph} style={{ ...IS, resize: 'vertical' }} />
    </div>
  );
}

function Btn({ children, onClick, color = '#0FA968', disabled, sm, outline }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ background: outline ? 'transparent' : `linear-gradient(135deg,${color}bb,${color})`, border: `1px solid ${color}88`, color: outline ? color : '#fff', padding: sm ? '7px 16px' : '12px 28px', borderRadius: 10, fontSize: sm ? 13 : 14, fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1, transition: 'all 0.2s', fontFamily: 'inherit' }}>
      {children}
    </button>
  );
}

function Toast({ msg, A }) {
  if (!msg) return null;
  return (
    <div style={{ position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', background: A.toastBg, border: `1px solid ${A.toastBorder}`, color: A.toastColor, padding: '12px 24px', borderRadius: 12, zIndex: 9999, fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', boxShadow: '0 8px 32px rgba(18,54,42,0.18)' }}>{msg}</div>
  );
}

function InfoCard({ color, title, children }) {
  return (
    <div style={{ background: `${color}0d`, border: `1px solid ${color}33`, borderRadius: 12, padding: 20 }}>
      <div style={{ fontSize: 11, color, fontWeight: 700, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{title}</div>
      {children}
    </div>
  );
}

function CopyBtn({ text, onToast }) {
  return (
    <button onClick={() => { navigator.clipboard.writeText(text); onToast('Copied to clipboard!'); }}
      style={{ background: 'transparent', border: '1px solid rgba(18,54,42,0.15)', color: '#5c6b64', padding: '6px 14px', borderRadius: 7, cursor: 'pointer', fontSize: 12, marginTop: 10 }}>
      Copy
    </button>
  );
}

// Reusable "upload a resume PDF" box — used by Enhancer, Text Extractor, ATS.
function PdfUploadBox({ A, uploading, uploadStatus, onFile, inputId, hint }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <label htmlFor={inputId}
        style={{ display: 'block', border: `1.5px dashed ${A.cardBorder}`, borderRadius: 12, padding: '20px', textAlign: 'center', cursor: uploading ? 'not-allowed' : 'pointer', background: A.sectionCardBg }}>
        <div style={{ fontSize: 22, marginBottom: 6 }}>⇪</div>
        <div style={{ fontSize: 13, fontWeight: 700, color: A.textPrimary, marginBottom: 3 }}>{uploading ? 'Reading your PDF...' : 'Click to upload a PDF resume'}</div>
        <div style={{ fontSize: 11, color: A.textMuted }}>{hint || 'AI reads the PDF and fills the text box below — you can still edit it.'}</div>
        <input id={inputId} type="file" accept="application/pdf" disabled={uploading} style={{ display: 'none' }}
          onChange={e => { onFile(e.target.files[0]); e.target.value = ''; }} />
      </label>
      {uploadStatus && <div style={{ fontSize: 11.5, color: A.hintColor, marginTop: 8 }}>{uploadStatus}</div>}
    </div>
  );
}

// ─── EDITABLE TEXT (live inline edit — same pattern as PDF Maker) ────────────
function EditableText({ value, onChange, tag: Tag = 'span', style = {}, editMode, accent = '#0FA968', block }) {
  const [active, setActive] = useState(false);
  const ref = React.useRef(null);
  if (!editMode) return <Tag style={style}>{value}</Tag>;
  return (
    <Tag
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      onFocus={() => setActive(true)}
      onBlur={() => { setActive(false); if (ref.current) onChange(ref.current.innerText); }}
      style={{
        ...style,
        display: block ? 'block' : style.display,
        outline: active ? `2px solid ${accent}` : `1px dashed ${accent}55`,
        borderRadius: 3,
        cursor: 'text',
        minHeight: '1em',
        padding: '0 2px',
      }}
    >
      {value}
    </Tag>
  );
}

// ─── Skills Tab ───────────────────────────────────────────────────────────────
function SkillsTab({ profile, set, setProj, A }) {
  const IS = makeIS(A); const LS = makeLS(A); const CS = makeCS(A);
  const skillFields = [
    { key: 'tech',  label: 'Technical Skills', ph: 'Python, C, FastAPI, React, VLSI Design', color: '#0FA968', hint: 'Add languages, frameworks, technologies you know' },
    { key: 'tools', label: 'Tools',             ph: 'VS Code, GitHub, Git, Cadence, LTspice',  color: '#1596D6', hint: 'IDEs, version control, design tools, software' },
    { key: 'soft',  label: 'Soft Skills',        ph: 'Leadership, Project Management, Communication', color: '#F2A93B', hint: 'These appear as pill tags in your resume' },
    { key: 'langs', label: 'Languages Known',    ph: 'English, Hindi, Urdu',                   color: '#0E77AC', hint: 'Languages you can speak/write professionally' },
  ];
  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginBottom: 24 }}>
        {skillFields.map(({ key, label, ph, color, hint }) => (
          <div key={key}>
            <label style={{ ...LS, color }}>{label}</label>
            <div style={{ fontSize: 11, color: A.textMuted, marginBottom: 6 }}>Tip: {hint}</div>
            <input value={profile[key] || ''} onChange={e => set(key, e.target.value)} placeholder={ph} style={IS} />
            {profile[key] && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 7 }}>
                {splitSkills(profile[key]).map((s, i) => (
                  <span key={i} style={{ background: color + '18', border: `1px solid ${color}44`, color, padding: '3px 11px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>{s}</span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Certifications */}
      <div style={{ marginBottom: 20 }}>
        <label style={{ ...LS, color: '#0E77AC' }}>Certifications</label>
        <div style={{ fontSize: 11, color: A.textMuted, marginBottom: 8 }}>Add name, issuer and year for each certification</div>
        {(profile.certsDetail && profile.certsDetail.length > 0 ? profile.certsDetail : [{ name: '', issuer: '', year: '' }]).map((cert, i) => (
          <div key={i} style={{ ...CS, marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ color: '#0E77AC', fontSize: 11, fontWeight: 700 }}>Certification #{i + 1}</span>
              {(profile.certsDetail || []).length > 1 && (
                <button onClick={() => set('certsDetail', (profile.certsDetail || []).filter((_, j) => j !== i))}
                  style={{ background: A.removeBtnBg, border: `1px solid ${A.removeBtnBorder}`, color: A.removeBtnColor, padding: '2px 8px', borderRadius: 5, cursor: 'pointer', fontSize: 11 }}>Remove</button>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 8 }}>
              <div>
                <label style={LS}>Certification Name</label>
                <input value={cert.name || ''} onChange={e => { const n = [...(profile.certsDetail || [{ name: '', issuer: '', year: '' }])]; n[i] = { ...n[i], name: e.target.value }; set('certsDetail', n); }} placeholder="e.g. Microsoft AI Fundamentals" style={IS} />
              </div>
              <div>
                <label style={LS}>Issuer</label>
                <input value={cert.issuer || ''} onChange={e => { const n = [...(profile.certsDetail || [{ name: '', issuer: '', year: '' }])]; n[i] = { ...n[i], issuer: e.target.value }; set('certsDetail', n); }} placeholder="Microsoft" style={IS} />
              </div>
              <div>
                <label style={LS}>Year</label>
                <input value={cert.year || ''} onChange={e => { const n = [...(profile.certsDetail || [{ name: '', issuer: '', year: '' }])]; n[i] = { ...n[i], year: e.target.value }; set('certsDetail', n); }} placeholder="2026" style={IS} />
              </div>
            </div>
          </div>
        ))}
        <button onClick={() => set('certsDetail', [...(profile.certsDetail || []), { name: '', issuer: '', year: '' }])}
          style={{ width: '100%', padding: 9, background: 'transparent', border: `1px dashed rgba(14,119,172,0.3)`, borderRadius: 8, color: '#0E77AC', cursor: 'pointer', fontSize: 12 }}>+ Add Certification</button>
      </div>

      {/* Projects */}
      <div style={{ marginBottom: 14 }}>
        <label style={LS}>Projects</label>
        <div style={{ background: A.hintBg, border: `1px solid ${A.hintBorder}`, borderRadius: 8, padding: '8px 12px', marginBottom: 10, fontSize: 12, color: A.hintColor }}>
          Projects will always appear in the resume under a dedicated Projects section.
        </div>
        {profile.projects.map((proj, i) => (
          <div key={i} style={CS}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ color: A.textSecondary, fontSize: 12, fontWeight: 700 }}>Project #{i + 1}</span>
              {profile.projects.length > 1 && (
                <button onClick={() => set('projects', profile.projects.filter((_, j) => j !== i))}
                  style={{ background: A.removeBtnBg, border: `1px solid ${A.removeBtnBorder}`, color: A.removeBtnColor, padding: '3px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>Remove</button>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
              <div><label style={LS}>Project Name</label><input value={proj.name || ''} onChange={e => setProj(i, 'name', e.target.value)} placeholder="e.g. AI Resume Builder" style={IS} /></div>
              <div><label style={LS}>Tech Stack</label><input value={proj.tech || ''} onChange={e => setProj(i, 'tech', e.target.value)} placeholder="Python, React, FastAPI" style={IS} /></div>
              <div style={{ gridColumn: '1/-1' }}><label style={LS}>GitHub / Live Link</label><input value={proj.link || ''} onChange={e => setProj(i, 'link', e.target.value)} placeholder="https://github.com/you/project" style={IS} /></div>
            </div>
            <label style={LS}>Description</label>
            <textarea rows={2} value={proj.desc || ''} onChange={e => setProj(i, 'desc', e.target.value)} placeholder="What does your project do and what impact does it create?" style={{ ...IS, resize: 'vertical' }} />
          </div>
        ))}
        <button onClick={() => set('projects', [...profile.projects, { name: '', desc: '', tech: '', link: '' }])}
          style={{ width: '100%', padding: 10, background: 'transparent', border: `1px dashed ${A.addBtnBorder}`, borderRadius: 8, color: A.addBtnColor, cursor: 'pointer', fontSize: 13 }}>+ Add Project</button>
      </div>

      <Area label="Achievements" value={profile.achievements} onChange={v => set('achievements', v)}
        ph="Won national hackathon | Built full-stack product from scratch | Published research paper" rows={3} A={A} />
    </div>
  );
}

// ─── Shared print-window helper ──────────────────────────────────────────────
function openPrintWindow(htmlContent, showToast) {
  const pw = window.open('', '_blank');
  if (!pw) { showToast('Allow popups to download PDF!'); return; }
  pw.document.write(htmlContent);
  pw.document.close();
  pw.onload = () => setTimeout(() => { pw.focus(); pw.print(); showToast('PDF ready! Save as PDF in print dialog.'); }, 500);
}

// ─── TEMPLATE 1: Modern Colorful (gradient header, color pills) ─────────────
function buildModernResumeHTML(result, profile, th) {
  const skills = result.skills || {};

  const buildSkillPills = (arr, color) => arr.map(s =>
    `<span style="display:inline-block;background:${color}20;border:1px solid ${color}55;color:${color};padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600;margin:2px 3px;">${s}</span>`
  ).join('');

  const realExp = (result.experience || []).filter(ex => (ex.title || ex.company || '').trim() !== '' && ex.company !== 'Personal Project');

  const expHTML = realExp.map(exp => `
    <div style="margin-bottom:18px;page-break-inside:avoid;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:4px;margin-bottom:5px;">
        <div>
          <div style="font-size:15px;font-weight:800;color:#111;">${exp.title || ''}</div>
          ${exp.company ? `<div style="font-size:13px;font-weight:700;color:${th.acc};margin-top:1px;">${exp.company}</div>` : ''}
        </div>
        <div style="text-align:right;">
          ${(exp.duration || exp.dur) ? `<div style="font-size:11px;background:${th.lt};border:1px solid ${th.acc}44;color:${th.bg};padding:2px 10px;border-radius:20px;font-weight:700;display:inline-block;">${exp.duration || exp.dur}</div>` : ''}
          ${exp.location ? `<div style="font-size:11px;color:#888;margin-top:3px;">  ${exp.location}</div>` : ''}
        </div>
      </div>
      <ul style="margin:6px 0 0 0;padding:0;list-style:none;">
        ${(Array.isArray(exp.points) ? exp.points : (exp.points || '').split('\n')).filter(Boolean).map(pt =>
          `<li style="display:flex;align-items:flex-start;gap:8px;font-size:12.5px;color:#333;line-height:1.75;margin-bottom:3px;">
            <span style="color:${th.acc};font-weight:900;margin-top:2px;flex-shrink:0;">&#9658;</span>
            <span>${pt.replace(/^[-•▸]/, '').trim()}</span>
          </li>`
        ).join('')}
      </ul>
    </div>`).join('');

  const projHTML = (result.projects || []).filter(p => p.name).map(proj => `
    <div style="margin-bottom:16px;page-break-inside:avoid;">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:4px;margin-bottom:5px;">
        <span style="font-size:14px;font-weight:800;color:${th.bg};">${proj.name}</span>
        ${proj.link ? `<span style="font-size:11px;color:${th.acc};">Link: ${proj.link}</span>` : ''}
      </div>
      <p style="margin:0 0 5px;color:#444;font-size:12px;line-height:1.65;">${proj.description || proj.desc || ''}</p>
      ${proj.impact ? `<p style="margin:0 0 6px;color:#555;font-size:11.5px;font-style:italic;">${proj.impact}</p>` : ''}
      <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px;">
        ${(Array.isArray(proj.tech) ? proj.tech : (proj.tech || '').split(',')).filter(s => s.trim()).map(t =>
          `<span style="background:${th.lt};border:1px solid ${th.acc}55;color:${th.bg};padding:2px 9px;border-radius:20px;font-size:10px;font-weight:700;">${t.trim()}</span>`
        ).join('')}
      </div>
    </div>`).join('');

  const eduHTML = (result.education || []).filter(ed => ed.degree).map(edu => {
    const contextLine = (edu.context && edu.context.trim()) ? edu.context : autoEduContext(edu);
    return `
    <div style="margin-bottom:14px;page-break-inside:avoid;display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px;padding-bottom:12px;border-bottom:1px solid #f0f0f0;">
      <div style="flex:1;">
        <div style="font-size:15px;font-weight:800;color:#111;margin-bottom:2px;">${edu.degree}${edu.field ? ` in ${edu.field}` : ''}</div>
        <div style="font-size:13px;font-weight:700;color:${th.acc};margin-bottom:5px;">${edu.institution || edu.inst || ''}</div>
        ${edu.grade ? `<span style="display:inline-flex;align-items:center;gap:4px;background:${th.lt};border:1px solid ${th.acc}33;color:${th.bg};padding:2px 10px;border-radius:20px;font-size:11px;font-weight:700;">Grade: ${edu.grade}</span>` : ''}
        ${contextLine ? `<div style="font-size:11.5px;color:#666;margin-top:5px;">${contextLine}</div>` : ''}
      </div>
      ${edu.year ? `<div style="background:${th.bg};color:#fff;padding:4px 16px;border-radius:20px;font-size:12px;font-weight:700;white-space:nowrap;">${edu.year}</div>` : ''}
    </div>`;
  }).join('');

  const certsArr = skills.certifications || [];
  const certHTML = certsArr.length === 0 ? '' : `
    <div style="margin-bottom:22px;">
      <div style="margin-bottom:12px;"><span style="background:${th.bg};color:#fff;padding:4px 12px;border-radius:4px;font-size:10px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;">Certifications</span></div>
      ${certsArr.map(c => `
        <div style="display:flex;align-items:center;gap:12px;background:${th.lt};border-left:4px solid ${th.acc};border-radius:0 8px 8px 0;padding:10px 16px;margin-bottom:8px;">
          <div>
            <div style="font-size:13px;font-weight:700;color:#111;">${typeof c === 'object' ? c.name : c}</div>
            ${typeof c === 'object' && (c.issuer || c.year) ? `<div style="font-size:11px;color:${th.acc};font-weight:600;margin-top:2px;">${c.issuer || ''}${c.issuer && c.year ? ' · ' : ''}${c.year || ''}</div>` : ''}
          </div>
        </div>`).join('')}
    </div>`;

  const achHTML = (result.achievements || []).filter(Boolean).length === 0 ? '' : `
    <div style="margin-bottom:22px;">
      <div style="margin-bottom:12px;"><span style="background:${th.bg};color:#fff;padding:4px 12px;border-radius:4px;font-size:10px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;">Achievements</span></div>
      ${(result.achievements || []).filter(Boolean).map(a =>
        `<div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:10px;font-size:12.5px;color:#333;line-height:1.75;">
          <span style="flex-shrink:0;font-size:16px;">&#11088;</span><span>${a}</span>
        </div>`
      ).join('')}
    </div>`;

  const techArr = skills.technical || [];
  const toolArr = skills.tools || [];
  const softArr = skills.soft || [];
  const langArr = skills.languages || [];
  const noExp = realExp.length === 0;

  const noExpWorkHTML = (result.projects || []).filter(p => p.name).map(proj => `
    <div style="margin-bottom:18px;page-break-inside:avoid;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:4px;margin-bottom:5px;">
        <div>
          <div style="font-size:15px;font-weight:800;color:#111;">${inferJobTitle(profile)}</div>
          <div style="font-size:13px;font-weight:700;color:${th.acc};margin-top:1px;">${proj.name}</div>
        </div>
        ${proj.link ? `<span style="font-size:11px;color:${th.acc};padding-top:2px;">Link: ${proj.link}</span>` : ''}
      </div>
      <ul style="margin:6px 0 0 0;padding:0;list-style:none;">
        <li style="display:flex;align-items:flex-start;gap:8px;font-size:12.5px;color:#333;line-height:1.75;margin-bottom:3px;">
          <span style="color:${th.acc};font-weight:900;margin-top:2px;flex-shrink:0;">&#9658;</span>
          <span>${proj.description || proj.desc || ''}</span>
        </li>
        ${proj.impact ? `<li style="display:flex;align-items:flex-start;gap:8px;font-size:12.5px;color:#333;line-height:1.75;margin-bottom:3px;">
          <span style="color:${th.acc};font-weight:900;margin-top:2px;flex-shrink:0;">&#9658;</span>
          <span>${proj.impact}</span>
        </li>` : ''}
      </ul>
      <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:6px;">
        ${(Array.isArray(proj.tech) ? proj.tech : (proj.tech || '').split(',')).filter(s => s.trim()).map(t =>
          `<span style="background:${th.lt};border:1px solid ${th.acc}55;color:${th.bg};padding:2px 9px;border-radius:20px;font-size:10px;font-weight:700;">${t.trim()}</span>`
        ).join('')}
      </div>
    </div>`).join('');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>${result.name || 'Resume'}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; background:#fff; color:#111; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
</head>
<body style="width:210mm;min-height:297mm;margin:0 auto;background:#fff;">
  <div style="background:${th.grad};padding:30px 36px 24px;color:#fff;">
    <div style="font-size:34px;font-weight:900;color:#fff;letter-spacing:-0.5px;line-height:1.1;margin-bottom:4px;">${result.name || profile.name}</div>
    <div style="font-size:12px;color:rgba(255,255,255,0.85);font-weight:700;letter-spacing:2.5px;text-transform:uppercase;font-style:italic;margin-bottom:16px;">${inferJobTitle(profile)}</div>
    <div style="display:flex;flex-wrap:wrap;gap:18px;margin-top:8px;">
      ${result.email ? `<span style="font-size:12px;color:rgba(255,255,255,0.88);">Email: ${result.email}</span>` : ''}
      ${result.phone ? `<span style="font-size:12px;color:rgba(255,255,255,0.88);">Phone: ${result.phone}</span>` : ''}
      ${result.location ? `<span style="font-size:12px;color:rgba(255,255,255,0.88);">Location: ${result.location}</span>` : ''}
      ${result.linkedin ? `<span style="font-size:12px;color:rgba(255,255,255,0.88);">LinkedIn: ${result.linkedin}</span>` : ''}
      ${result.github ? `<span style="font-size:12px;color:rgba(255,255,255,0.88);">GitHub: ${result.github}</span>` : ''}
    </div>
  </div>
  <div style="padding:28px 36px;">
    ${result.summary ? `
    <div style="margin-bottom:24px;">
      <div style="margin-bottom:10px;"><span style="background:${th.bg};color:#fff;padding:4px 12px;border-radius:4px;font-size:10px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;">Professional Summary</span></div>
      <div style="border-left:4px solid ${th.acc};padding:14px 18px;background:${th.lt};border-radius:0 10px 10px 0;">
        <p style="color:#333;line-height:1.85;font-size:13px;">${result.summary}</p>
      </div>
    </div>` : ''}

    ${noExp ? `
    <div style="margin-bottom:24px;">
      <div style="margin-bottom:12px;"><span style="background:${th.bg};color:#fff;padding:4px 12px;border-radius:4px;font-size:10px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;">Work Experience</span></div>
      ${noExpWorkHTML}
    </div>` : `
    <div style="margin-bottom:24px;">
      <div style="margin-bottom:12px;"><span style="background:${th.bg};color:#fff;padding:4px 12px;border-radius:4px;font-size:10px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;">Work Experience</span></div>
      ${expHTML}
    </div>`}

    ${(techArr.length + toolArr.length + softArr.length + langArr.length) > 0 ? `
    <div style="margin-bottom:24px;">
      <div style="margin-bottom:12px;"><span style="background:${th.bg};color:#fff;padding:4px 12px;border-radius:4px;font-size:10px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;">Skills</span></div>
      <div style="background:#fafafa;border:1px solid #eee;border-radius:10px;padding:16px 18px;">
        ${techArr.length ? `<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;flex-wrap:wrap;"><span style="font-size:11px;font-weight:700;color:#555;min-width:90px;">Technical</span><div>${buildSkillPills(techArr, th.acc)}</div></div>` : ''}
        ${toolArr.length ? `<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;flex-wrap:wrap;"><span style="font-size:11px;font-weight:700;color:#555;min-width:90px;">Tools</span><div>${buildSkillPills(toolArr, th.acc)}</div></div>` : ''}
        ${softArr.length ? `<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;flex-wrap:wrap;"><span style="font-size:11px;font-weight:700;color:#555;min-width:90px;">Soft Skills</span><div>${buildSkillPills(softArr, th.acc)}</div></div>` : ''}
        ${langArr.length ? `<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;"><span style="font-size:11px;font-weight:700;color:#555;min-width:90px;">Languages</span><div>${buildSkillPills(langArr, th.acc)}</div></div>` : ''}
      </div>
    </div>` : ''}

    ${(result.education || []).filter(e => e.degree).length > 0 ? `
    <div style="margin-bottom:24px;">
      <div style="margin-bottom:12px;"><span style="background:${th.bg};color:#fff;padding:4px 12px;border-radius:4px;font-size:10px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;">Education</span></div>
      <div style="background:#fafafa;border:1px solid #eee;border-radius:10px;padding:16px 18px;">
        ${eduHTML}
      </div>
    </div>` : ''}

    ${(result.projects || []).filter(p => p.name).length > 0 ? `
    <div style="margin-bottom:24px;">
      <div style="margin-bottom:12px;"><span style="background:${th.bg};color:#fff;padding:4px 12px;border-radius:4px;font-size:10px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;">Projects</span></div>
      ${projHTML}
    </div>` : ''}

    ${certHTML}
    ${achHTML}
    <div style="text-align:center;font-size:10px;color:#ccc;margin-top:20px;padding-top:12px;border-top:1px solid #eee;">
      Generated by MK-AI · ${result.name || 'MK AI'}
    </div>
  </div>
</body>
</html>`;
}

// ─── TEMPLATE 2: Classic ATS (plain black & white, single column) ───────────
function buildClassicResumeHTML(result, profile) {
  const skills = result.skills || {};
  const realExp = (result.experience || []).filter(ex => (ex.title || ex.company || '').trim() !== '' && ex.company !== 'Personal Project');
  const noExp = realExp.length === 0;

  const sec = (title, inner) => inner ? `
    <div style="margin-bottom:16px;">
      <div style="font-size:12px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;color:#111;border-bottom:1.5px solid #111;padding-bottom:3px;margin-bottom:8px;">${title}</div>
      ${inner}
    </div>` : '';

  const bulletList = (items) => `<ul style="margin:4px 0 0 0;padding:0;list-style:none;">
    ${items.filter(Boolean).map(pt => `<li style="font-size:12px;color:#222;line-height:1.65;margin-bottom:2px;padding-left:14px;position:relative;">
      <span style="position:absolute;left:0;">•</span>${pt.replace(/^[-•▸]/, '').trim()}
    </li>`).join('')}
  </ul>`;

  const expHTML = realExp.map(exp => `
    <div style="margin-bottom:12px;page-break-inside:avoid;">
      <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:4px;">
        <span style="font-size:13px;font-weight:700;color:#111;">${exp.title || ''}${exp.company ? ` — ${exp.company}` : ''}</span>
        <span style="font-size:11.5px;color:#333;">${exp.duration || exp.dur || ''}${(exp.duration || exp.dur) && exp.location ? ' | ' : ''}${exp.location || ''}</span>
      </div>
      ${bulletList(Array.isArray(exp.points) ? exp.points : (exp.points || '').split('\n'))}
    </div>`).join('');

  const noExpWorkHTML = (result.projects || []).filter(p => p.name).map(proj => `
    <div style="margin-bottom:12px;page-break-inside:avoid;">
      <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:4px;">
        <span style="font-size:13px;font-weight:700;color:#111;">${inferJobTitle(profile)} — ${proj.name}</span>
        <span style="font-size:11.5px;color:#333;">Present</span>
      </div>
      ${bulletList([proj.description || proj.desc || '', proj.impact || ''])}
    </div>`).join('');

  const eduHTML = (result.education || []).filter(e => e.degree).map(edu => `
    <div style="margin-bottom:10px;page-break-inside:avoid;">
      <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:4px;">
        <span style="font-size:13px;font-weight:700;color:#111;">${edu.degree}${edu.field ? ` — ${edu.field}` : ''}</span>
        <span style="font-size:11.5px;color:#333;">${edu.year || ''}</span>
      </div>
      <div style="font-size:12px;color:#333;">${edu.institution || edu.inst || ''}${edu.grade ? ` · ${edu.grade}` : ''}</div>
      ${(edu.context?.trim() || autoEduContext(edu)) ? `<div style="font-size:11px;color:#555;margin-top:2px;">${edu.context?.trim() || autoEduContext(edu)}</div>` : ''}
    </div>`).join('');

  const projHTML = (result.projects || []).filter(p => p.name).map(proj => `
    <div style="margin-bottom:10px;page-break-inside:avoid;">
      <div style="font-size:13px;font-weight:700;color:#111;">${proj.name}${proj.link ? ` | ${proj.link}` : ''}</div>
      <div style="font-size:12px;color:#333;line-height:1.6;">${proj.description || proj.desc || ''}</div>
      ${proj.impact ? `<div style="font-size:11.5px;color:#555;">${proj.impact}</div>` : ''}
      ${(() => { const t = (Array.isArray(proj.tech) ? proj.tech : (proj.tech || '').split(',')).filter(s => s.trim()); return t.length ? `<div style="font-size:11px;color:#444;margin-top:2px;"><strong>Stack:</strong> ${t.map(s => s.trim()).join(' · ')}</div>` : ''; })()}
    </div>`).join('');

  const skillLine = (label, arr) => (arr && arr.length) ? `<div style="font-size:12px;color:#222;margin-bottom:4px;"><strong>${label}:</strong> ${arr.join(', ')}</div>` : '';

  const certsArr = skills.certifications || [];
  const certHTML = certsArr.length ? certsArr.map(c => `
    <div style="font-size:12px;color:#222;margin-bottom:3px;">${typeof c === 'object' ? c.name : c}${typeof c === 'object' && (c.issuer || c.year) ? ` — ${c.issuer || ''}${c.issuer && c.year ? ', ' : ''}${c.year || ''}` : ''}</div>`).join('') : '';

  const achHTML = (result.achievements || []).filter(Boolean).map(a => `<div style="font-size:12px;color:#222;margin-bottom:3px;padding-left:14px;position:relative;"><span style="position:absolute;left:0;">•</span>${a}</div>`).join('');

  const contactParts = [result.email, result.phone, result.location, result.linkedin, result.github].filter(Boolean);

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>${result.name || 'Resume'}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: 'Georgia', 'Times New Roman', serif; background:#fff; color:#111; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
</head>
<body style="width:210mm;min-height:297mm;margin:0 auto;background:#fff;padding:34px 42px;">
  <div style="text-align:center;margin-bottom:16px;">
    <div style="font-size:24px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:#111;">${result.name || profile.name}</div>
    <div style="font-size:11.5px;color:#333;margin-top:6px;">${contactParts.join('  |  ')}</div>
  </div>

  ${sec('Profile', result.summary ? `<p style="font-size:12px;color:#222;line-height:1.7;">${result.summary}</p>` : '')}
  ${sec('Education', eduHTML)}
  ${sec('Experience', noExp ? noExpWorkHTML : expHTML)}
  ${sec('Projects', !noExp ? projHTML : '')}
  ${sec('Technical Skills', [
      skillLine('Technical', skills.technical),
      skillLine('Tools', skills.tools),
      skillLine('Soft Skills', skills.soft),
      skillLine('Languages', skills.languages),
    ].filter(Boolean).join(''))}
  ${sec('Certifications', certHTML)}
  ${sec('Achievements', achHTML)}
</body>
</html>`;
}

// ─── TEMPLATE 3: Minimal Clean (subtle accent, no color blocks) ─────────────
function buildMinimalResumeHTML(result, profile, th) {
  const skills = result.skills || {};
  const realExp = (result.experience || []).filter(ex => (ex.title || ex.company || '').trim() !== '' && ex.company !== 'Personal Project');
  const noExp = realExp.length === 0;

  const sec = (title, inner) => inner ? `
    <div style="margin-bottom:20px;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
        <div style="width:4px;height:14px;background:${th.acc};border-radius:2px;"></div>
        <span style="font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#222;">${title}</span>
      </div>
      ${inner}
    </div>` : '';

  const tag = (s) => `<span style="display:inline-block;background:#f4f4f5;color:#333;padding:3px 11px;border-radius:6px;font-size:11px;margin:2px 4px 2px 0;">${s}</span>`;

  const expHTML = realExp.map(exp => `
    <div style="margin-bottom:14px;page-break-inside:avoid;">
      <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:4px;margin-bottom:2px;">
        <span style="font-size:13.5px;font-weight:700;color:#111;">${exp.title || ''}</span>
        <span style="font-size:11.5px;color:${th.acc};font-weight:600;">${exp.duration || exp.dur || ''}</span>
      </div>
      <div style="font-size:12px;color:#555;margin-bottom:5px;">${exp.company || ''}${exp.location ? ` · ${exp.location}` : ''}</div>
      <ul style="margin:0;padding:0;list-style:none;">
        ${(Array.isArray(exp.points) ? exp.points : (exp.points || '').split('\n')).filter(Boolean).map(pt =>
          `<li style="font-size:12px;color:#333;line-height:1.7;padding-left:14px;position:relative;"><span style="position:absolute;left:0;color:${th.acc};">–</span>${pt.replace(/^[-•▸]/, '').trim()}</li>`
        ).join('')}
      </ul>
    </div>`).join('');

  const noExpWorkHTML = (result.projects || []).filter(p => p.name).map(proj => `
    <div style="margin-bottom:14px;page-break-inside:avoid;">
      <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:4px;margin-bottom:2px;">
        <span style="font-size:13.5px;font-weight:700;color:#111;">${inferJobTitle(profile)}</span>
        <span style="font-size:11.5px;color:${th.acc};font-weight:600;">Present</span>
      </div>
      <div style="font-size:12px;color:#555;margin-bottom:5px;">${proj.name}</div>
      <div style="font-size:12px;color:#333;line-height:1.7;padding-left:14px;position:relative;"><span style="position:absolute;left:0;color:${th.acc};">–</span>${proj.description || proj.desc || ''}</div>
    </div>`).join('');

  const eduHTML = (result.education || []).filter(e => e.degree).map(edu => `
    <div style="margin-bottom:12px;page-break-inside:avoid;">
      <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:4px;">
        <span style="font-size:13.5px;font-weight:700;color:#111;">${edu.degree}${edu.field ? ` in ${edu.field}` : ''}</span>
        <span style="font-size:11.5px;color:${th.acc};font-weight:600;">${edu.year || ''}</span>
      </div>
      <div style="font-size:12px;color:#555;">${edu.institution || edu.inst || ''}${edu.grade ? ` · ${edu.grade}` : ''}</div>
      ${(edu.context?.trim() || autoEduContext(edu)) ? `<div style="font-size:11.5px;color:#777;margin-top:3px;">${edu.context?.trim() || autoEduContext(edu)}</div>` : ''}
    </div>`).join('');

  const projHTML = (result.projects || []).filter(p => p.name).map(proj => `
    <div style="margin-bottom:12px;page-break-inside:avoid;">
      <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:4px;">
        <span style="font-size:13.5px;font-weight:700;color:#111;">${proj.name}</span>
        ${proj.link ? `<span style="font-size:11px;color:${th.acc};">${proj.link}</span>` : ''}
      </div>
      <div style="font-size:12px;color:#333;line-height:1.65;margin-top:2px;">${proj.description || proj.desc || ''}</div>
      ${proj.impact ? `<div style="font-size:11.5px;color:#777;font-style:italic;margin-top:2px;">${proj.impact}</div>` : ''}
      <div style="margin-top:5px;">${(Array.isArray(proj.tech) ? proj.tech : (proj.tech || '').split(',')).filter(s => s.trim()).map(t => tag(t.trim())).join('')}</div>
    </div>`).join('');

  const certsArr = skills.certifications || [];

  const contactParts = [result.email, result.phone, result.location, result.linkedin, result.github].filter(Boolean);

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>${result.name || 'Resume'}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; background:#fff; color:#111; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
</head>
<body style="width:210mm;min-height:297mm;margin:0 auto;background:#fff;padding:38px 44px;">
  <div style="border-bottom:2px solid ${th.acc};padding-bottom:14px;margin-bottom:22px;">
    <div style="font-size:28px;font-weight:800;color:#111;letter-spacing:-0.5px;">${result.name || profile.name}</div>
    <div style="font-size:12px;color:${th.acc};font-weight:700;letter-spacing:1.5px;text-transform:uppercase;margin-top:3px;">${inferJobTitle(profile)}</div>
    <div style="font-size:11.5px;color:#666;margin-top:8px;">${contactParts.join('   ·   ')}</div>
  </div>

  ${sec('Summary', result.summary ? `<p style="font-size:12.5px;color:#333;line-height:1.75;">${result.summary}</p>` : '')}
  ${sec('Experience', noExp ? noExpWorkHTML : expHTML)}
  ${sec('Skills', `
    ${(skills.technical || []).map(tag).join('')}
    ${(skills.tools || []).map(tag).join('')}
    ${(skills.soft || []).map(tag).join('')}
    ${(skills.languages || []).map(tag).join('')}
  `)}
  ${sec('Education', eduHTML)}
  ${sec('Projects', !noExp ? projHTML : '')}
  ${sec('Certifications', certsArr.length ? certsArr.map(c => `<div style="font-size:12px;color:#333;margin-bottom:4px;">${typeof c === 'object' ? c.name : c}${typeof c === 'object' && (c.issuer || c.year) ? ` — ${c.issuer || ''}${c.issuer && c.year ? ', ' : ''}${c.year || ''}` : ''}</div>`).join('') : '')}
  ${sec('Achievements', (result.achievements || []).filter(Boolean).map(a => `<div style="font-size:12px;color:#333;margin-bottom:4px;padding-left:14px;position:relative;"><span style="position:absolute;left:0;color:${th.acc};">–</span>${a}</div>`).join(''))}
</body>
</html>`;
}

// Wrapper — picks the right template builder and opens the print dialog.
function downloadResumeAsPDF(result, profile, th, showToast, template = 'modern') {
  showToast('Generating PDF...');
  let html;
  if (template === 'classic') html = buildClassicResumeHTML(result, profile);
  else if (template === 'minimal') html = buildMinimalResumeHTML(result, profile, th);
  else html = buildModernResumeHTML(result, profile, th);
  openPrintWindow(html, showToast);
}

// ─── TopBar ───────────────────────────────────────────────────────────────────
function TopBar({ view, setView, completion, A }) {
  const tool = ALL_TOOLS.find(t => t.id === view);
  const sc = completion === 100 ? '#0FA968' : completion > 50 ? '#F2A93B' : '#B23B3B';
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 28px', borderBottom: `1px solid ${A.headerBorder}`, background: A.headerBg, backdropFilter: 'blur(12px)', position: 'sticky', top: 0, zIndex: 100 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {view !== 'home' ? (
          <button onClick={() => setView('home')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: A.backBtnBg, border: `1px solid ${A.backBtnBorder}`, color: A.backBtnColor, padding: '8px 16px', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'inherit' }}>
            ← All Tools
          </button>
        ) : (
          <button onClick={() => window.history.back()}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: A.backBtnBg, border: `1px solid ${A.backBtnBorder}`, color: A.backBtnColor, padding: '8px 16px', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'inherit' }}>
            ← Back
          </button>
        )}
        <div style={{ fontSize: 19, fontWeight: 900, color: A.textPrimary }}>
          <span style={{ color: '#0FA968' }}>MK</span>-AI
          {tool && <span style={{ color: A.textSecondary, fontWeight: 400, fontSize: 14, marginLeft: 10 }}>{tool.icon} {tool.title}</span>}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ fontSize: 12, color: A.textSecondary }}>Profile: <span style={{ color: sc, fontWeight: 700 }}>{completion}%</span></div>
        <button onClick={() => setView('profile')}
          style={{ background: view === 'profile' ? A.profileBtnActiveBg : A.profileBtnBg, border: `1px solid ${view === 'profile' ? A.profileBtnActiveBorder : A.profileBtnBorder}`, color: view === 'profile' ? A.profileBtnActiveColor : A.profileBtnColor, padding: '7px 16px', borderRadius: 9, cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit' }}>
          My Profile
        </button>
      </div>
    </div>
  );
}

function FloatingBackBtn({ view, setView, A }) {
  if (view === 'home') return null;
  return (
    <button onClick={() => setView('home')}
      style={{ position: 'fixed', bottom: 28, right: 28, zIndex: 200, display: 'inline-flex', alignItems: 'center', gap: 8, background: 'linear-gradient(135deg,#0C8457,#0FA968)', border: '1px solid rgba(15,169,104,0.4)', color: '#fff', padding: '12px 20px', borderRadius: 50, cursor: 'pointer', fontSize: 14, fontWeight: 700, boxShadow: '0 6px 24px rgba(15,169,104,0.4)', fontFamily: 'inherit' }}>
      All Tools
    </button>
  );
}

// ─── Landing View ─────────────────────────────────────────────────────────────
function LandingView({ setView, completion, A }) {
  return (
    <div style={{ maxWidth: 980, margin: '0 auto', padding: '52px 24px 80px' }}>

      <Helmet>
        <title>AI Resume Builder — ResumeX | MK AI</title>
        <meta name="description" content="Auto-generate ATS-friendly resumes and cover letters in minutes with ResumeX on MK AI." />
      </Helmet>
      <div style={{ textAlign: 'center', marginBottom: 52 }}>
        <div style={{ display: 'inline-block', background: A.hintBg, border: `1px solid ${A.hintBorder}`, borderRadius: 24, padding: '5px 18px', fontSize: 11, color: A.hintColor, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 22 }}>
          AI Career Suite · Built by MK AI
        </div>
        <h1 style={{ fontSize: 48, fontWeight: 900, color: A.textPrimary, margin: '0 0 16px', lineHeight: 1.1, letterSpacing: '-1.5px' }}>
          Land Your Dream Job.<br />
          <span style={{ background: 'linear-gradient(135deg,#0FA968,#1596D6,#F2A93B)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Powered by AI.</span>
        </h1>
        <p style={{ color: A.textSecondary, fontSize: 16, maxWidth: 520, margin: '0 auto 36px', lineHeight: 1.6 }}>8 AI-powered career tools. Fill your profile once — use everywhere.</p>
        {completion < 100 ? (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 14, background: A.warningBg, border: `1px solid ${A.warningBorder}`, borderRadius: 14, padding: '12px 20px', marginBottom: 36 }}>
            <div style={{ width: 140, height: 5, background: 'rgba(18,54,42,0.08)', borderRadius: 999 }}>
              <div style={{ width: `${completion}%`, height: '100%', background: 'linear-gradient(90deg,#F2A93B,#F5C169)', borderRadius: 999 }} />
            </div>
            <span style={{ fontSize: 13, color: A.warningColor, fontWeight: 600 }}>{completion}% complete</span>
            <button onClick={() => setView('profile')} style={{ background: A.warningBg, border: `1px solid ${A.warningBorder}`, color: A.warningColor, padding: '5px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'inherit' }}>Complete Profile →</button>
          </div>
        ) : (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: A.successBg, border: `1px solid ${A.successBorder}`, borderRadius: 14, padding: '10px 20px', marginBottom: 36, color: A.successColor, fontSize: 13, fontWeight: 600 }}>
            Profile complete — all 8 tools unlocked!
          </div>
        )}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 14 }}>
        {ALL_TOOLS.map(tool => (
          <button key={tool.id} onClick={() => setView(tool.id)}
            style={{ background: A.cardBg, border: `1px solid ${A.cardBorder}`, borderRadius: 16, padding: '22px 20px', textAlign: 'left', cursor: 'pointer', transition: 'all 0.2s', position: 'relative', fontFamily: 'inherit' }}
            onMouseEnter={e => { e.currentTarget.style.border = `1px solid ${tool.color}55`; e.currentTarget.style.transform = 'translateY(-3px)'; }}
            onMouseLeave={e => { e.currentTarget.style.border = `1px solid ${A.cardBorder}`; e.currentTarget.style.transform = 'none'; }}>
            {tool.badge && <div style={{ position: 'absolute', top: 12, right: 12, background: tool.color + '22', border: `1px solid ${tool.color}44`, color: tool.color, fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20 }}>{tool.badge}</div>}
            <div style={{ fontSize: 32, marginBottom: 10 }}>{tool.icon}</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: A.textPrimary, marginBottom: 5 }}>{tool.title}</div>
            <div style={{ fontSize: 12, color: A.textSecondary, lineHeight: 1.5, marginBottom: 14 }}>{tool.desc}</div>
            <div style={{ fontSize: 12, color: tool.color, fontWeight: 600 }}>Open →</div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Profile View ─────────────────────────────────────────────────────────────
function ProfileView({ profile, setProfile, showToast, A }) {
  const [tab, setTab] = useState(0);
  const TABS = ['Personal', 'Education', 'Experience', 'Skills'];
  const set     = (k, v)    => setProfile(p => ({ ...p, [k]: v }));
  const setEdu  = (i, k, v) => { const n = [...profile.edu]; n[i] = { ...n[i], [k]: v }; set('edu', n); };
  const setExp  = (i, k, v) => { const n = [...profile.exp]; n[i] = { ...n[i], [k]: v }; set('exp', n); };
  const setProj = (i, k, v) => { const n = [...profile.projects]; n[i] = { ...n[i], [k]: v }; set('projects', n); };
  const EDU_TYPES = ['B.Tech', 'M.Tech', 'MBA', 'BCA', 'MCA', 'B.Sc', 'M.Sc', 'B.E', 'Diploma', '12th / HSC', '10th / SSC', 'Ph.D', 'Other'];
  const IS = makeIS(A); const LS = makeLS(A); const CS = makeCS(A);

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '32px 24px' }}>
      <h2 style={{ fontSize: 24, fontWeight: 800, color: A.textPrimary, margin: '0 0 6px' }}>Your Profile</h2>
      <p style={{ color: A.textSecondary, fontSize: 14, margin: '0 0 20px' }}>Fill once — used across all 8 tools · Auto-saved in browser</p>

      {!profile.targetJob && inferJobTitle(profile) !== 'Software Engineer' && (
        <div style={{ background: A.hintBg, border: `1px solid ${A.hintBorder}`, borderRadius: 10, padding: '10px 16px', marginBottom: 16, fontSize: 13, color: A.hintColor, display: 'flex', gap: 10, alignItems: 'center' }}>
          <span>AI suggests: <strong>{inferJobTitle(profile)}</strong></span>
          <button onClick={() => set('targetJob', inferJobTitle(profile))} style={{ background: A.hintBg, border: `1px solid ${A.hintBorder}`, color: A.hintColor, padding: '3px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'inherit' }}>Use This →</button>
        </div>
      )}

      <div style={{ display: 'flex', gap: 4, background: A.tabBg, borderRadius: 12, padding: 4, marginBottom: 28 }}>
        {TABS.map((t, i) => (
          <button key={i} onClick={() => setTab(i)} style={{ flex: 1, padding: '9px 8px', borderRadius: 9, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, background: tab === i ? A.tabActiveBg : 'transparent', color: tab === i ? A.tabActiveColor : A.tabInactiveColor, fontFamily: 'inherit' }}>{t}</button>
        ))}
      </div>

      {tab === 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {[
            ['name', 'Full Name *', 'e.g. Jane Doe'],
            ['targetJob', 'Target Job Title', 'e.g. AI Product Developer'],
            ['email', 'Email', 'e.g. jane@email.com'],
            ['phone', 'Phone', 'e.g. +91 9876543210'],
            ['location', 'City, State', 'e.g. Delhi, India'],
            ['linkedin', 'LinkedIn URL', 'e.g. linkedin.com/in/janedoe'],
            ['github', 'GitHub URL', 'e.g. github.com/janedoe'],
            ['portfolio', 'Portfolio URL', 'e.g. janedoe.dev']
          ].map(([key, label, ph]) => (
            <Field key={key} label={label} value={profile[key] || ''} onChange={v => set(key, v)} ph={ph} A={A} />
          ))}
          <div style={{ gridColumn: '1/-1', background: A.hintBg, border: `1px solid ${A.hintBorder}`, borderRadius: 8, padding: '10px 14px', fontSize: 12, color: A.hintColor }}>
            Leave "Target Job Title" blank — AI will auto-detect from your experience and projects.
          </div>
        </div>
      )}

      {tab === 1 && (
        <div>
          {profile.edu.map((edu, i) => (
            <div key={i} style={CS}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={{ color: A.textSecondary, fontSize: 12, fontWeight: 700 }}>Education #{i + 1}</span>
                {profile.edu.length > 1 && <button onClick={() => set('edu', profile.edu.filter((_, j) => j !== i))} style={{ background: A.removeBtnBg, border: `1px solid ${A.removeBtnBorder}`, color: A.removeBtnColor, padding: '3px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}>Remove</button>}
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={LS}>Degree Type</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {EDU_TYPES.map(t => (
                    <button key={t} onClick={() => setEdu(i, 'degree', t)}
                      style={{ padding: '5px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600, border: `1px solid ${edu.degree === t ? '#0FA968' : A.cardBorder}`, background: edu.degree === t ? A.tabActiveBg : A.cardBg, color: edu.degree === t ? A.tabActiveColor : A.tabInactiveColor, fontFamily: 'inherit' }}>{t}</button>
                  ))}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div><label style={LS}>Field of Study</label><input value={edu.field || ''} onChange={e => setEdu(i, 'field', e.target.value)} placeholder="e.g. Computer Science" style={IS} /></div>
                <div><label style={LS}>Institution</label><input value={edu.inst || ''} onChange={e => setEdu(i, 'inst', e.target.value)} placeholder="e.g. Delhi University" style={IS} /></div>
                <div><label style={LS}>Year</label><input value={edu.year || ''} onChange={e => setEdu(i, 'year', e.target.value)} placeholder="e.g. 2025" style={IS} /></div>
                <div><label style={LS}>Grade / CGPA</label><input value={edu.grade || ''} onChange={e => setEdu(i, 'grade', e.target.value)} placeholder="e.g. 8.5 CGPA" style={IS} /></div>
                <div style={{ gridColumn: '1/-1' }}>
                  <label style={LS}>Additional Context <span style={{ color: A.textMuted, fontWeight: 400 }}>(optional — auto-generated if left blank)</span></label>
                  <input value={edu.context || ''} onChange={e => setEdu(i, 'context', e.target.value)} placeholder={edu.degree && edu.field ? autoEduContext({ degree: edu.degree, field: edu.field }) : 'e.g. Graduated with a strong foundation in core engineering subjects'} style={IS} />
                </div>
              </div>
              {(edu.degree || edu.inst) && (
                <div style={{ marginTop: 12, background: A.hintBg, border: `1px solid ${A.hintBorder}`, borderRadius: 8, padding: '10px 14px' }}>
                  <div style={{ fontSize: 11, color: A.hintColor, fontWeight: 700, marginBottom: 4 }}>PREVIEW</div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: A.textPrimary }}>{edu.degree}{edu.field ? ` in ${edu.field}` : ''}</div>
                  <div style={{ fontSize: 12, color: A.hintColor, marginTop: 2 }}>{edu.inst}</div>
                  <div style={{ fontSize: 11, color: A.textSecondary, marginTop: 2 }}>{edu.year}{edu.grade ? ` · Grade: ${edu.grade}` : ''}</div>
                  {(edu.context?.trim() || (edu.degree && edu.field)) && (
                    <div style={{ fontSize: 11, color: A.textMuted, marginTop: 3, fontStyle: 'italic' }}>
                      {edu.context?.trim() || autoEduContext(edu)}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
          <button onClick={() => set('edu', [...profile.edu, { degree: '', field: '', inst: '', year: '', grade: '', context: '' }])} style={{ width: '100%', padding: 10, background: 'transparent', border: `1px dashed ${A.addBtnBorder}`, borderRadius: 8, color: A.addBtnColor, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>+ Add Another Degree</button>
        </div>
      )}

      {tab === 2 && (
        <div>
          <div style={{ background: A.warningBg, border: `1px solid ${A.warningBorder}`, borderRadius: 10, padding: '10px 16px', marginBottom: 16, fontSize: 13, color: A.warningColor }}>
            No work experience? Leave all fields empty — your <strong>Projects</strong> (from Skills tab) will automatically appear under Work Experience in the resume.
          </div>
          <div style={{ background: A.hintBg, border: `1px solid ${A.hintBorder}`, borderRadius: 10, padding: '10px 16px', marginBottom: 16, fontSize: 13, color: A.hintColor }}>
            Got a 2+ month gap between roles? Use "Reason for gap" below (layoff, upskilling, caregiving, sabbatical) so it reads intentional instead of hidden.
          </div>
          {profile.exp.map((exp, i) => (
            <div key={i} style={CS}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={{ color: A.textSecondary, fontSize: 12, fontWeight: 700 }}>Experience #{i + 1}</span>
                {profile.exp.length > 1 && <button onClick={() => set('exp', profile.exp.filter((_, j) => j !== i))} style={{ background: A.removeBtnBg, border: `1px solid ${A.removeBtnBorder}`, color: A.removeBtnColor, padding: '3px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}>Remove</button>}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                {[
                  ['title', 'Job Title', 'e.g. Software Engineer'],
                  ['company', 'Company', 'e.g. Google'],
                  ['dur', 'Duration', 'e.g. 2024 - Present'],
                  ['loc', 'Location', 'e.g. Bengaluru, India']
                ].map(([key, lbl, ph]) => (
                  <div key={key}><label style={LS}>{lbl}</label><input value={exp[key] || ''} onChange={e => setExp(i, key, e.target.value)} placeholder={ph} style={IS} /></div>
                ))}
                <div style={{ gridColumn: '1/-1' }}>
                  <label style={LS}>Reason for gap before this role <span style={{ color: A.textMuted, fontWeight: 400 }}>(optional — only if there's a 2+ month gap)</span></label>
                  <input value={exp.gapReason || ''} onChange={e => setExp(i, 'gapReason', e.target.value)} placeholder="e.g. Upskilling in AI/ML, caregiving break, layoff during hiring freeze" style={IS} />
                </div>
              </div>
              <label style={LS}>Key Achievements (one per line)</label>
              <textarea rows={3} value={exp.pts || ''} onChange={e => setExp(i, 'pts', e.target.value)} placeholder={'Built and deployed X feature that improved Y by Z%\nLed team of N engineers to deliver project on time'} style={{ ...IS, resize: 'vertical' }} />
            </div>
          ))}
          <button onClick={() => set('exp', [...profile.exp, { title: '', company: '', dur: '', loc: '', pts: '', gapReason: '' }])} style={{ width: '100%', padding: 10, background: 'transparent', border: `1px dashed ${A.addBtnBorder}`, borderRadius: 8, color: A.addBtnColor, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>+ Add More Experience</button>
        </div>
      )}

      {tab === 3 && <SkillsTab profile={profile} set={(k, v) => setProfile(p => ({ ...p, [k]: v }))} setProj={(i, k, v) => { const n = [...profile.projects]; n[i] = { ...n[i], [k]: v }; setProfile(p => ({ ...p, projects: n })); }} A={A} />}

      <div style={{ marginTop: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: A.textMuted }}>Auto-saved · Score: {profileScore(profile)}%</span>
        <div style={{ display: 'flex', gap: 10 }}>
          {tab < 3 && <Btn onClick={() => setTab(t => t + 1)} color="#0FA968">Next →</Btn>}
          {tab === 3 && <Btn onClick={() => showToast('Profile saved!')} color="#0FA968">Save</Btn>}
        </div>
      </div>
    </div>
  );
}

// ─── Resume Quality Report (renders the 15-point checklist) ─────────────────
function QualityReport({ quality, A, th }) {
  if (!quality || !quality.checks.length) return null;
  const sc = quality.score >= 80 ? '#0FA968' : quality.score >= 55 ? '#F2A93B' : '#B23B3B';
  return (
    <div style={{ background: A.sectionCardBg, border: `1px solid ${A.sectionCardBorder}`, borderRadius: 14, padding: '18px 20px', marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 800, color: A.textPrimary }}>Resume Quality Checklist</div>
          <div style={{ fontSize: 11.5, color: A.textSecondary, marginTop: 2 }}>15 recruiter-tested checks — strong verbs, metrics, ATS format, keyword match & more</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 26, fontWeight: 900, color: sc, lineHeight: 1 }}>{quality.score}</div>
          <div style={{ fontSize: 10, color: A.textMuted }}>/100</div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 10 }}>
        {quality.checks.map(c => (
          <div key={c.id} style={{ background: c.pass ? A.successBg : A.warningBg, border: `1px solid ${c.pass ? A.successBorder : A.warningBorder}`, borderRadius: 10, padding: '10px 12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
              <span style={{ fontSize: 13, color: c.pass ? A.successColor : A.warningColor }}>{c.pass ? '✓' : '!'}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: A.textPrimary }}>{c.title}</span>
            </div>
            <div style={{ fontSize: 11.5, color: A.textSecondary, lineHeight: 1.5 }}>{c.detail}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Resume Builder ───────────────────────────────────────────────────────────
function ResumeView({ profile, showToast, A }) {
  const [jobDesc, setJobDesc] = useState('');
  const [template, setTemplate] = useState('modern');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [quality, setQuality] = useState(null);
  const [activeProvider, setActiveProviderState] = useState('');
  const [editMode, setEditMode] = useState(false);
  const th = BRAND_RESUME_THEME;

  const buildSkills = () => {
    const certsArr = (profile.certsDetail || []).filter(c => c.name?.trim()).length > 0
      ? (profile.certsDetail || []).filter(c => c.name?.trim())
      : splitSkills(profile.certs || '').map(name => ({ name, issuer: '', year: '' }));
    return { technical: splitSkills(profile.tech), tools: splitSkills(profile.tools), soft: splitSkills(profile.soft), languages: splitSkills(profile.langs), certifications: certsArr };
  };

  // ── Live-edit helper — mutates the `result` state at any nested path.
  //    Used by every EditableText in the preview below, exactly like the
  //    updateResult() pattern in PDF Maker. Editing here updates state,
  //    so Download PDF always exports whatever is currently on screen.
  const updateResult = useCallback((path, value) => {
    setResult(prev => {
      if (!prev) return prev;
      const next = JSON.parse(JSON.stringify(prev));
      const keys = path.split('.');
      let obj = next;
      for (let i = 0; i < keys.length - 1; i++) {
        const k = keys[i];
        obj = isNaN(k) ? obj[k] : obj[parseInt(k)];
      }
      const last = keys[keys.length - 1];
      obj[isNaN(last) ? last : parseInt(last)] = value;
      return next;
    });
  }, []);

  // Recompute the 15-point quality report any time the on-screen resume changes
  // (including live edits made through EditableText), so the checklist stays live.
  useEffect(() => {
    if (result) setQuality(analyzeResumeQuality(result, profile));
    else setQuality(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  // Editing a skills array item (technical/tools/soft/languages) by index
  const updateSkillItem = (group, idx, value) => {
    setResult(prev => {
      if (!prev) return prev;
      const next = JSON.parse(JSON.stringify(prev));
      if (!next.skills) next.skills = {};
      if (!Array.isArray(next.skills[group])) next.skills[group] = [];
      next.skills[group][idx] = value;
      return next;
    });
  };

  // Editing a certification's name/issuer/year
  const updateCert = (idx, key, value) => {
    setResult(prev => {
      if (!prev) return prev;
      const next = JSON.parse(JSON.stringify(prev));
      if (!next.skills) next.skills = {};
      if (!Array.isArray(next.skills.certifications)) next.skills.certifications = [];
      const cur = next.skills.certifications[idx];
      next.skills.certifications[idx] = typeof cur === 'object' ? { ...cur, [key]: value } : { name: key === 'name' ? value : cur, issuer: '', year: '' };
      return next;
    });
  };

  const generate = async () => {
    if (!profile.name.trim()) { showToast('Add your name in Profile first!'); return; }
    setLoading(true); setResult(null); setQuality(null); setActiveProviderState(''); setEditMode(false);
    const skills = buildSkills();
    const exactTitle = inferJobTitle(profile);
    const userHasExp = hasRealExp(profile.exp);
    const eduWithContext = profile.edu.filter(e => e.degree).map(e => ({ ...e, context: e.context?.trim() || autoEduContext(e) }));
    const eduContext = eduWithContext.map(e => `${e.degree} in ${e.field} from ${e.inst} (${e.year})${e.grade ? ', ' + e.grade : ''}${e.context ? '. ' + e.context : ''}`).join('; ');
    const gapContext = (profile.exp || []).filter(e => e.gapReason && e.gapReason.trim()).map(e => `Gap before "${e.title || e.company}": ${e.gapReason}`).join('; ');
    const expSection = userHasExp
      ? `EXPERIENCE: ${JSON.stringify(profile.exp)}${gapContext ? `\nCAREER GAP CONTEXT (weave in naturally, do not over-explain): ${gapContext}` : ''}`
      : `EXPERIENCE: None — use projects as work experience entries. For each project, create a work experience entry with:
         - title = "${exactTitle}" (the job title)
         - company = the actual PROJECT NAME (e.g. "ChatBot Pro", "AI Resume Tool") — NOT "Personal Project"
         - duration = "Present"
         - bullet points describing what was built and achieved
         IMPORTANT: company field must be the real project name, not "Personal Project"`;
    try {
      const text = await callAI(
        `You are a world-class ATS resume writer. Follow this strict 15-point resume standard on EVERY bullet you write:
1. STRONG ACTION VERBS — never start a bullet with "helped / worked on / responsible for / assisted / supported". Always open with an ownership verb: Led, Drove, Launched, Owned, Spearheaded, Built, Scaled, Architected, Delivered, Automated, Optimized, Shipped.
2. METRICS/OUTCOMES — every bullet must contain a number (%, ₹, time saved, users, scale). If exact data is not given, produce a reasonable, clearly-scoped estimate (e.g. "~20% faster").
3. NO BUZZWORDS — never write "hardworking", "team player", "detail-oriented", "self-motivated" etc. Prove the trait with a fact instead of naming it.
4. CAREER GAPS — if gap context is provided, weave a brief, natural, confident reason into the relevant experience entry; never leave an unexplained multi-month gap looking hidden.
5. JD KEYWORDS — if a job description is given, mirror its exact terminology and required skills wherever truthful, using the candidate's own real experience/transferable skills.
6. RECENCY WEIGHTAGE — give full detail (multiple strong bullets) to roles within the last 5-7 years; compress older/less relevant roles to 1-2 lines.
7. BALANCE — across all bullets, mix technical delivery, business/impact language, and leadership/ownership language; do not make 80%+ of bullets purely technical.
8. ATS-FRIENDLY — plain text only, no special characters beyond standard punctuation, use the standard section names (Experience, Education, Skills, Projects).
9. REVERSE-CHRONOLOGICAL — keep the most recent role/degree first, exactly as given in the input order.
10. TAILORED — if a job description is supplied, actively tailor summary + bullets + skills emphasis to that specific role.
11. 6-SECOND SCAN — make the summary and the first 2-3 bullets of the top experience entry the strongest, most quantified content in the whole resume.
12. NO FIRST-PERSON — never use "I", "my", or "me" anywhere; resumes are written in implied first person.
13. LENGTH DISCIPLINE — do not pad with filler bullets; only include content that earns its place on 1 page (fresher) or up to 2 pages (3+ roles).
14. CONSISTENCY — use consistent verb tense (past tense for past roles, present tense only for a role explicitly marked current/Present) and consistent bullet style throughout.
15. CONTACT INTEGRITY — reproduce email/LinkedIn/GitHub exactly as given, never invent or alter them.

Additional hard rules:
- Job title MUST be EXACTLY "${exactTitle}" — do not change it.
- ONLY use skills from the provided list. NEVER invent new skills.
- Write a HIGHLY PROFESSIONAL 4-5 sentence summary that front-loads the strongest, most quantified achievement.
- CRITICAL — Work Experience:
   - If user HAS real experience: show title, company, date, and bullet points following all 15 rules above.
   - If NO real experience: for each project, create an experience entry where:
     * title = "${exactTitle}"
     * company = the ACTUAL PROJECT NAME — NEVER write "Personal Project"
     * duration = "Present"
     * points = bullet points about what was built + impact, following all 15 rules above
   - NEVER leave work experience empty.
- Education: include the context field as provided.
- ALWAYS include all projects in the "projects" array — do not skip them.
- Return ONLY valid JSON — no markdown, no extra text.`,
        `Name: ${profile.name} | Email: ${profile.email} | Phone: ${profile.phone}
Location: ${profile.location} | LinkedIn: ${profile.linkedin} | GitHub: ${profile.github}
JOB TITLE (exact): ${exactTitle}
EDUCATION: ${eduContext}
${expSection}
PROJECTS: ${JSON.stringify(profile.projects)}
ACHIEVEMENTS: ${profile.achievements || ''}
JOB DESCRIPTION: ${jobDesc || 'Not provided'}
SKILLS (ONLY use these):
Technical: ${skills.technical.join(', ') || 'None'}
Tools: ${skills.tools.join(', ') || 'None'}
Soft Skills: ${skills.soft.join(', ') || 'None'}
Languages: ${skills.languages.join(', ') || 'None'}
Certifications: ${JSON.stringify(skills.certifications)}
Return JSON:
{
  "name":"","email":"","phone":"","location":"","linkedin":"","github":"",
  "summary":"4-5 sentence highly professional summary, strongest quantified fact first",
  "education":[{"degree":"","field":"","institution":"","year":"","grade":"","context":""}],
  "experience":[{"title":"","company":"","duration":"","location":"","points":[]}],
  "projects":[{"name":"","description":"","tech":[],"link":"","impact":""}],
  "achievements":[],"ats_score":82,"ats_feedback":"","improvements":[],"keywords_matched":[],"keywords_missing":[]
}`,
        3000
      );
      const parsed = parseJSON(text);
      if (parsed) {
        parsed.job_title = exactTitle;
        parsed.skills = buildSkills();
        parsed._userHasExp = userHasExp;
        parsed._jobDescUsed = jobDesc;
        if (!parsed.projects || parsed.projects.length === 0) parsed.projects = profile.projects.filter(p => p.name?.trim());
        parsed.projects = parsed.projects.map((p, i) => ({ ...p, link: p.link || profile.projects[i]?.link || '', tech: p.tech || profile.projects[i]?.tech || '' }));
        if (parsed.education) parsed.education = parsed.education.map(edu => ({ ...edu, context: edu.context?.trim() || autoEduContext(edu) }));
        setResult(parsed);
        setQuality(analyzeResumeQuality(parsed, profile));
        showToast('Resume generated successfully!');
      } else showToast('Parse error — please try again');
    } catch (err) { showToast('Error: ' + err.message); }
    setLoading(false);
    setActiveProviderState('');
  };

  const atsColor = result ? (result.ats_score >= 70 ? '#0FA968' : result.ats_score >= 50 ? '#F2A93B' : '#B23B3B') : '#0FA968';
  const SectionHeader = ({ title }) => (
    <div style={{ marginBottom: 10 }}>
      <span style={{ background: th.bg, color: '#fff', padding: '4px 12px', borderRadius: 4, fontSize: 10, fontWeight: 800, letterSpacing: '1.5px', textTransform: 'uppercase' }}>{title}</span>
    </div>
  );
  const expEntries = (result?.experience || []).filter(e => (e.title || e.company || '').trim() !== '');
  const IS = makeIS(A); const LS = makeLS(A);

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 24px' }}>
      <h2 style={{ fontSize: 22, fontWeight: 800, color: A.textPrimary, marginBottom: 6 }}>Resume Builder</h2>
      <p style={{ color: A.textSecondary, fontSize: 14, marginBottom: 8 }}>ATS-optimized resume — AI-enhanced, professional summary, smart work experience</p>
      <div style={{ background: A.successBg, border: `1px solid ${A.successBorder}`, borderRadius: 10, padding: '8px 14px', marginBottom: 20, fontSize: 12, color: A.successColor }}>
        No work experience? Projects auto-appear under Work Experience · Projects always shown separately · 3 resume templates · 7 AI providers · Live edit before download · 15-point quality checklist
      </div>

      <div style={{ background: A.hintBg, border: `1px solid ${A.hintBorder}`, borderRadius: 10, padding: '10px 16px', marginBottom: 16, fontSize: 13, color: A.hintColor, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <strong>Detected title:</strong> <span style={{ color: A.hintColor, fontWeight: 700 }}>{inferJobTitle(profile)}</span>
        {!profile.targetJob && <span style={{ color: A.textMuted, fontSize: 11 }}>(auto-detected — override in Profile → Personal)</span>}
      </div>

      <div style={{ marginBottom: 20 }}>
        <label style={LS}>Resume Template</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 10 }}>
          {RESUME_TEMPLATES.map(t => (
            <button key={t.id} onClick={() => setTemplate(t.id)}
              style={{ textAlign: 'left', padding: '12px 14px', borderRadius: 10, cursor: 'pointer', border: template === t.id ? `2px solid ${th.acc}` : `1px solid ${A.cardBorder}`, background: template === t.id ? `${th.bg}22` : A.cardBg, fontFamily: 'inherit' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: template === t.id ? th.acc : A.textPrimary, marginBottom: 3 }}>{t.name}</div>
              <div style={{ fontSize: 11, color: A.textSecondary, lineHeight: 1.4 }}>{t.blurb}</div>
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 14 }}>
        <label style={LS}>Job Description (optional — boosts ATS score & tailors keywords)</label>
        <textarea rows={4} value={jobDesc} onChange={e => setJobDesc(e.target.value)} placeholder="Paste the full job description here to tailor this resume to it..." style={{ ...IS, resize: 'vertical' }} />
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: loading ? 12 : 28, flexWrap: 'wrap', alignItems: 'center' }}>
        <Btn onClick={generate} disabled={loading} color={th.acc}>{loading ? 'Generating...' : (jobDesc.trim() ? 'Generate Tailored Resume' : 'Generate Resume')}</Btn>
        {result && <Btn onClick={() => { setResult(null); setQuality(null); setEditMode(false); }} outline color="#5c6b64" sm>Clear</Btn>}
        {loading && activeProvider && (
          <span style={{ fontSize: 12, color: A.textMuted }}>
            Using: <span style={{ color: '#0FA968', fontWeight: 600 }}>{activeProvider}</span>
          </span>
        )}
      </div>

      {result && (
        <>
          {/* ATS Score */}
          <div style={{ display: 'flex', gap: 16, padding: '16px 20px', borderRadius: 12, border: `1px solid ${atsColor}44`, background: `${atsColor}0c`, marginBottom: 16, flexWrap: 'wrap' }}>
            <div style={{ minWidth: 80, textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: A.textSecondary, marginBottom: 2, textTransform: 'uppercase' }}>ATS Score</div>
              <div style={{ fontSize: 40, fontWeight: 900, color: atsColor, lineHeight: 1 }}>{result.ats_score}</div>
              <div style={{ fontSize: 11, color: A.textMuted }}>/100</div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ color: A.textPrimary, fontSize: 13, marginBottom: 8 }}>{result.ats_feedback}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
                {(result.improvements || []).map((imp, i) => <span key={i} style={{ background: A.badgeTagBg, border: `1px solid ${A.badgeTagBorder}`, color: A.badgeTagColor, padding: '2px 10px', borderRadius: 20, fontSize: 11 }}>{imp}</span>)}
              </div>
              {(result.keywords_missing || []).length > 0 && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{ color: '#B23B3B', fontSize: 11, fontWeight: 600 }}>Missing: </span>
                  {result.keywords_missing.slice(0, 5).map((kw, i) => <span key={i} style={{ background: 'rgba(220,60,60,0.08)', border: '1px solid rgba(220,60,60,0.18)', color: '#B23B3B', padding: '2px 8px', borderRadius: 4, fontSize: 11 }}>{kw}</span>)}
                </div>
              )}
            </div>
          </div>

          {/* 15-point Quality Checklist */}
          <QualityReport quality={quality} A={A} th={th} />

          {/* Download + Edit Buttons */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <button onClick={() => downloadResumeAsPDF(result, profile, th, showToast, template)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'linear-gradient(135deg,#0C8457cc,#0C8457)', border: '1px solid #0C845788', color: '#fff', padding: '11px 24px', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              Download PDF
            </button>
            <button onClick={() => setEditMode(e => !e)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                background: editMode ? `${th.acc}22` : 'transparent',
                border: `1px solid ${editMode ? th.acc : A.cardBorder}`,
                color: editMode ? th.acc : A.textSecondary,
                padding: '11px 22px', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit'
              }}>
              {editMode ? '✓ Done Editing' : '✏️ Edit Resume'}
            </button>
            <span style={{ fontSize: 12, color: A.textMuted }}>Opens print dialog → Save as PDF · Template: {RESUME_TEMPLATES.find(t => t.id === template)?.name}</span>
          </div>

          {editMode && (
            <div style={{ background: A.hintBg, border: `1px solid ${A.hintBorder}`, borderRadius: 10, padding: '10px 16px', marginBottom: 16, fontSize: 12.5, color: A.hintColor }}>
              ✏️ Edit mode active — click any dashed text below and type to change it. Your edits are saved live, re-checked against the 15-point checklist above, and will appear in the downloaded PDF.
            </div>
          )}

          {/* Preview */}
          <div style={{ marginBottom: 12, fontSize: 13, color: '#0FA968', fontWeight: 600 }}>Resume Preview</div>

          {template === 'classic' ? (
            <ClassicPreview result={result} profile={profile} editMode={editMode} updateResult={updateResult} updateSkillItem={updateSkillItem} updateCert={updateCert} />
          ) : template === 'minimal' ? (
            <MinimalPreview result={result} profile={profile} th={th} editMode={editMode} updateResult={updateResult} updateSkillItem={updateSkillItem} updateCert={updateCert} />
          ) : (
          <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 20px 60px rgba(18,54,42,0.22)', fontFamily: "'Segoe UI',Arial,sans-serif" }}>
            {/* Header */}
            <div style={{ background: th.grad, padding: '28px 32px 22px', color: '#fff' }}>
              <EditableText tag="div" value={result.name} editMode={editMode} accent="#fff"
                onChange={v => updateResult('name', v)}
                style={{ fontSize: 30, fontWeight: 900, color: '#fff', letterSpacing: '-0.5px', lineHeight: 1.1 }} />
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.82)', marginTop: 4, fontWeight: 700, letterSpacing: '2.5px', textTransform: 'uppercase', fontStyle: 'italic' }}>{inferJobTitle(profile)}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginTop: 12 }}>
                {result.email && <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.82)', display: 'flex', alignItems: 'center', gap: 5 }}>Email: <EditableText value={result.email} editMode={editMode} accent="#fff" onChange={v => updateResult('email', v)} style={{ color: 'rgba(255,255,255,0.82)' }} /></span>}
                {result.phone && <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.82)', display: 'flex', alignItems: 'center', gap: 5 }}>Phone: <EditableText value={result.phone} editMode={editMode} accent="#fff" onChange={v => updateResult('phone', v)} style={{ color: 'rgba(255,255,255,0.82)' }} /></span>}
                {result.location && <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.82)', display: 'flex', alignItems: 'center', gap: 5 }}>Location: <EditableText value={result.location} editMode={editMode} accent="#fff" onChange={v => updateResult('location', v)} style={{ color: 'rgba(255,255,255,0.82)' }} /></span>}
                {result.linkedin && <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.82)', display: 'flex', alignItems: 'center', gap: 5 }}>LinkedIn: <EditableText value={result.linkedin} editMode={editMode} accent="#fff" onChange={v => updateResult('linkedin', v)} style={{ color: 'rgba(255,255,255,0.82)' }} /></span>}
                {result.github && <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.82)', display: 'flex', alignItems: 'center', gap: 5 }}>GitHub: <EditableText value={result.github} editMode={editMode} accent="#fff" onChange={v => updateResult('github', v)} style={{ color: 'rgba(255,255,255,0.82)' }} /></span>}
              </div>
            </div>

            <div style={{ padding: '22px 28px' }}>
              {/* Summary */}
              {result.summary && (
                <div style={{ marginBottom: 20 }}>
                  <SectionHeader title="Professional Summary" />
                  <div style={{ borderLeft: `4px solid ${th.acc}`, padding: '12px 16px', background: th.lt, borderRadius: '0 8px 8px 0' }}>
                    <EditableText tag="p" value={result.summary} editMode={editMode} accent={th.acc}
                      onChange={v => updateResult('summary', v)}
                      style={{ margin: 0, color: '#333', lineHeight: 1.8, fontSize: 12.5 }} />
                  </div>
                </div>
              )}

              {/* Work Experience */}
              {expEntries.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <SectionHeader title="Work Experience" />
                  {expEntries.map((exp, i) => {
                    const realIdx = (result.experience || []).indexOf(exp);
                    return (
                    <div key={i} style={{ marginBottom: 14 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 4, marginBottom: 3 }}>
                        <div>
                          <EditableText tag="span" value={exp.title} editMode={editMode} accent={th.acc}
                            onChange={v => updateResult(`experience.${realIdx}.title`, v)}
                            style={{ fontWeight: 800, fontSize: 14, color: '#111' }} />
                          {exp.company && <EditableText tag="div" value={exp.company} editMode={editMode} accent={th.acc}
                            onChange={v => updateResult(`experience.${realIdx}.company`, v)}
                            style={{ fontSize: 12.5, fontWeight: 700, color: th.acc, marginTop: 1 }} />}
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          {exp.duration && <EditableText tag="div" value={exp.duration} editMode={editMode} accent={th.acc}
                            onChange={v => updateResult(`experience.${realIdx}.duration`, v)}
                            style={{ fontSize: 11, background: th.lt, border: `1px solid ${th.acc}44`, color: th.bg, padding: '2px 10px', borderRadius: 20, fontWeight: 700, display: 'inline-block' }} />}
                          {exp.location && <EditableText tag="div" value={exp.location} editMode={editMode} accent={th.acc}
                            onChange={v => updateResult(`experience.${realIdx}.location`, v)}
                            style={{ fontSize: 11, color: '#888', marginTop: 2 }} />}
                        </div>
                      </div>
                      {(Array.isArray(exp.points) ? exp.points : (exp.points || '').split('\n')).filter(Boolean).map((pt, j) => (
                        <div key={j} style={{ display: 'flex', alignItems: 'flex-start', gap: 7, fontSize: 12, color: '#333', lineHeight: 1.75, marginBottom: 2 }}>
                          <span style={{ color: th.acc, fontWeight: 900, flexShrink: 0 }}>▸</span>
                          <EditableText tag="span" value={pt.replace(/^[-•▸]/, '').trim()} editMode={editMode} accent={th.acc}
                            onChange={v => {
                              const arr = Array.isArray(exp.points) ? [...exp.points] : (exp.points || '').split('\n');
                              arr[j] = v;
                              updateResult(`experience.${realIdx}.points`, arr);
                            }}
                            style={{}} block />
                        </div>
                      ))}
                    </div>
                  ); })}
                </div>
              )}

              {/* Skills */}
              {(() => { const sk = result.skills || {}; return ((sk.technical || []).length + (sk.tools || []).length + (sk.soft || []).length + (sk.languages || []).length) > 0; })() && (
                <div style={{ marginBottom: 20 }}>
                  <SectionHeader title="Skills" />
                  <div style={{ background: '#fafafa', border: '1px solid #eee', borderRadius: 10, padding: '14px 16px' }}>
                    {['technical', 'tools', 'soft', 'languages'].map(group => {
                      const arr = result.skills?.[group] || [];
                      if (!arr.length) return null;
                      const groupLabel = { technical: 'Technical', tools: 'Tools', soft: 'Soft Skills', languages: 'Languages' }[group];
                      return (
                        <div key={group} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#555', minWidth: 90 }}>{groupLabel}</span>
                          <div>
                            {arr.map((s, i) => (
                              <span key={i} style={{ display: 'inline-block', background: th.acc + '22', border: `1px solid ${th.acc}55`, color: th.acc, padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, margin: '2px 3px' }}>
                                <EditableText value={s} editMode={editMode} accent={th.acc} onChange={v => updateSkillItem(group, i, v)} style={{ color: th.acc }} />
                              </span>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Education */}
              {(result.education || []).filter(e => e.degree).length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <SectionHeader title="Education" />
                  <div style={{ background: '#fafafa', border: '1px solid #eee', borderRadius: 10, padding: '14px 18px' }}>
                    {result.education.filter(e => e.degree).map((edu, i) => {
                      const realIdx = result.education.indexOf(edu);
                      const contextLine = edu.context?.trim() || autoEduContext(edu);
                      const isLast = i === result.education.filter(e => e.degree).length - 1;
                      return (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8, marginBottom: isLast ? 0 : 14, paddingBottom: isLast ? 0 : 14, borderBottom: isLast ? 'none' : '1px solid #eee' }}>
                          <div>
                            <EditableText tag="div" value={`${edu.degree}${edu.field ? ` in ${edu.field}` : ''}`} editMode={editMode} accent={th.acc}
                              onChange={v => updateResult(`education.${realIdx}.degree`, v)}
                              style={{ fontSize: 14, fontWeight: 800, color: '#111' }} />
                            <EditableText tag="div" value={edu.institution || edu.inst || ''} editMode={editMode} accent={th.acc}
                              onChange={v => updateResult(`education.${realIdx}.institution`, v)}
                              style={{ fontSize: 12.5, fontWeight: 700, color: th.acc, marginTop: 2 }} />
                            {edu.grade && <div style={{ marginTop: 4 }}><span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: th.lt, border: `1px solid ${th.acc}44`, color: th.bg, padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>Grade: <EditableText value={edu.grade} editMode={editMode} accent={th.acc} onChange={v => updateResult(`education.${realIdx}.grade`, v)} style={{ color: th.bg }} /></span></div>}
                            {contextLine && <EditableText tag="div" value={contextLine} editMode={editMode} accent={th.acc}
                              onChange={v => updateResult(`education.${realIdx}.context`, v)}
                              style={{ fontSize: 11.5, color: '#555', marginTop: 5, lineHeight: 1.5 }} />}
                          </div>
                          {edu.year && <EditableText tag="div" value={edu.year} editMode={editMode} accent="#fff"
                            onChange={v => updateResult(`education.${realIdx}.year`, v)}
                            style={{ background: th.bg, color: '#fff', padding: '4px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }} />}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Projects */}
              {(result.projects || []).filter(p => p.name).length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <SectionHeader title="Projects" />
                  {result.projects.filter(p => p.name).map((proj, i) => {
                    const realIdx = result.projects.indexOf(proj);
                    return (
                    <div key={i} style={{ marginBottom: 14 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', marginBottom: 4 }}>
                        <EditableText tag="span" value={proj.name} editMode={editMode} accent={th.acc}
                          onChange={v => updateResult(`projects.${realIdx}.name`, v)}
                          style={{ fontWeight: 800, fontSize: 13, color: th.bg }} />
                        {proj.link && <EditableText tag="span" value={proj.link} editMode={editMode} accent={th.acc}
                          onChange={v => updateResult(`projects.${realIdx}.link`, v)}
                          style={{ fontSize: 11, color: th.acc }} />}
                      </div>
                      <EditableText tag="p" value={proj.description || proj.desc || ''} editMode={editMode} accent={th.acc}
                        onChange={v => updateResult(`projects.${realIdx}.description`, v)}
                        style={{ margin: '0 0 5px', color: '#444', fontSize: 12, lineHeight: 1.65 }} />
                      {proj.impact && <EditableText tag="p" value={proj.impact} editMode={editMode} accent={th.acc}
                        onChange={v => updateResult(`projects.${realIdx}.impact`, v)}
                        style={{ margin: '0 0 5px', color: '#555', fontSize: 11.5, fontStyle: 'italic' }} />}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {(Array.isArray(proj.tech) ? proj.tech : (proj.tech || '').split(',')).filter(s => s.trim()).map((t, j) => (
                          <span key={j} style={{ background: th.lt, border: `1px solid ${th.acc}55`, color: th.bg, padding: '2px 9px', borderRadius: 20, fontSize: 10, fontWeight: 700 }}>{t.trim()}</span>
                        ))}
                      </div>
                    </div>
                  ); })}
                </div>
              )}

              {/* Certifications */}
              {(result.skills?.certifications || []).length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <SectionHeader title="Certifications" />
                  {result.skills.certifications.map((cert, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, background: th.lt, borderLeft: `4px solid ${th.acc}`, borderRadius: '0 8px 8px 0', padding: '10px 16px', marginBottom: 8 }}>
                      <div>
                        <EditableText tag="div" value={typeof cert === 'object' ? cert.name : cert} editMode={editMode} accent={th.acc}
                          onChange={v => updateCert(i, 'name', v)}
                          style={{ fontSize: 13, fontWeight: 700, color: '#111' }} />
                        {typeof cert === 'object' && (cert.issuer || cert.year) && (
                          <div style={{ fontSize: 11, color: th.acc, fontWeight: 600, marginTop: 2, display: 'flex', gap: 4 }}>
                            <EditableText value={cert.issuer || ''} editMode={editMode} accent={th.acc} onChange={v => updateCert(i, 'issuer', v)} style={{ color: th.acc }} />
                            {cert.issuer && cert.year ? <span>·</span> : null}
                            <EditableText value={cert.year || ''} editMode={editMode} accent={th.acc} onChange={v => updateCert(i, 'year', v)} style={{ color: th.acc }} />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Achievements */}
              {(result.achievements || []).filter(Boolean).length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <SectionHeader title="Achievements" />
                  {result.achievements.filter(Boolean).map((ach, i) => {
                    const realIdx = result.achievements.indexOf(ach);
                    return (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8, fontSize: 12.5, color: '#333', lineHeight: 1.7 }}>
                      <span style={{ flexShrink: 0, color: '#F2A93B', fontSize: 16 }}>★</span>
                      <EditableText tag="span" value={ach} editMode={editMode} accent={th.acc}
                        onChange={v => updateResult(`achievements.${realIdx}`, v)} style={{}} block />
                    </div>
                  ); })}
                </div>
              )}

              <div style={{ textAlign: 'center', fontSize: 10, color: '#ccc', marginTop: 16, paddingTop: 10, borderTop: '1px solid #eee' }}>
                Generated by MK-AI · {result.name || 'MK AI'}
              </div>
            </div>
          </div>
          )}
        </>
      )}
    </div>
  );
}

// Live preview — Classic ATS template (mirrors buildClassicResumeHTML), with live edit support
function ClassicPreview({ result, profile, editMode, updateResult, updateSkillItem, updateCert }) {
  const skills = result.skills || {};
  const realExp = (result.experience || []).filter(ex => (ex.title || ex.company || '').trim() !== '' && ex.company !== 'Personal Project');
  const noExp = realExp.length === 0;
  const contactParts = [result.email, result.phone, result.location, result.linkedin, result.github].filter(Boolean);
  const ACC = '#111';
  const Sec = ({ title, children }) => (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: '1.2px', textTransform: 'uppercase', color: '#111', borderBottom: '1.5px solid #111', paddingBottom: 4, marginBottom: 8 }}>{title}</div>
      {children}
    </div>
  );
  const Bullets = ({ items, onEdit }) => (
    <ul style={{ margin: '4px 0 0 0', padding: 0, listStyle: 'none' }}>
      {items.filter(Boolean).map((pt, i) => (
        <li key={i} style={{ fontSize: 12, color: '#222', lineHeight: 1.65, marginBottom: 2, paddingLeft: 14, position: 'relative' }}>
          <span style={{ position: 'absolute', left: 0 }}>•</span>
          <EditableText value={(pt || '').replace(/^[-•▸]/, '').trim()} editMode={editMode} accent={ACC} onChange={v => onEdit && onEdit(i, v)} style={{}} block />
        </li>
      ))}
    </ul>
  );
  return (
    <div style={{ background: '#fff', borderRadius: 4, overflow: 'hidden', boxShadow: '0 20px 60px rgba(18,54,42,0.22)', fontFamily: "Georgia,'Times New Roman',serif", padding: '34px 42px' }}>
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <EditableText tag="div" value={result.name || profile.name} editMode={editMode} accent={ACC}
          onChange={v => updateResult('name', v)}
          style={{ fontSize: 22, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase', color: '#111' }} />
        <div style={{ fontSize: 11.5, color: '#333', marginTop: 6 }}>{contactParts.join('  |  ')}</div>
      </div>
      {result.summary && <Sec title="Profile"><EditableText tag="p" value={result.summary} editMode={editMode} accent={ACC} onChange={v => updateResult('summary', v)} style={{ fontSize: 12, color: '#222', lineHeight: 1.7, margin: 0 }} /></Sec>}
      {(result.education || []).filter(e => e.degree).length > 0 && (
        <Sec title="Education">
          {result.education.filter(e => e.degree).map((edu, i) => {
            const realIdx = result.education.indexOf(edu);
            return (
            <div key={i} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 4 }}>
                <EditableText tag="span" value={edu.degree}
                  editMode={editMode} accent={ACC} onChange={v => updateResult(`education.${realIdx}.degree`, v)}
                  style={{ fontSize: 13, fontWeight: 700, color: '#111' }} />
                <EditableText tag="span" value={edu.year} editMode={editMode} accent={ACC} onChange={v => updateResult(`education.${realIdx}.year`, v)} style={{ fontSize: 11.5, color: '#333' }} />
              </div>
              <EditableText tag="div" value={edu.institution || edu.inst} editMode={editMode} accent={ACC} onChange={v => updateResult(`education.${realIdx}.institution`, v)} style={{ fontSize: 12, color: '#333' }} />
              {(edu.context?.trim() || autoEduContext(edu)) && <EditableText tag="div" value={edu.context?.trim() || autoEduContext(edu)} editMode={editMode} accent={ACC} onChange={v => updateResult(`education.${realIdx}.context`, v)} style={{ fontSize: 11, color: '#555', marginTop: 2 }} />}
            </div>
          ); })}
        </Sec>
      )}
      <Sec title="Experience">
        {noExp
          ? (result.projects || []).filter(p => p.name).map((proj, i) => {
            const realIdx = result.projects.indexOf(proj);
            return (
            <div key={i} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#111' }}>{inferJobTitle(profile)} — <EditableText value={proj.name} editMode={editMode} accent={ACC} onChange={v => updateResult(`projects.${realIdx}.name`, v)} style={{}} /></span>
                <span style={{ fontSize: 11.5, color: '#333' }}>Present</span>
              </div>
              <Bullets items={[proj.description || proj.desc || '', proj.impact || '']} onEdit={(i2, v) => updateResult(i2 === 0 ? `projects.${realIdx}.description` : `projects.${realIdx}.impact`, v)} />
            </div>
          ); })
          : realExp.map((exp, i) => {
            const realIdx = result.experience.indexOf(exp);
            const ptsArr = Array.isArray(exp.points) ? exp.points : (exp.points || '').split('\n');
            return (
            <div key={i} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#111' }}>
                  <EditableText value={exp.title} editMode={editMode} accent={ACC} onChange={v => updateResult(`experience.${realIdx}.title`, v)} style={{}} />
                  {exp.company ? ' — ' : ''}
                  <EditableText value={exp.company} editMode={editMode} accent={ACC} onChange={v => updateResult(`experience.${realIdx}.company`, v)} style={{}} />
                </span>
                <span style={{ fontSize: 11.5, color: '#333' }}>
                  <EditableText value={exp.duration} editMode={editMode} accent={ACC} onChange={v => updateResult(`experience.${realIdx}.duration`, v)} style={{}} />
                  {(exp.duration && exp.location) ? ' | ' : ''}
                  <EditableText value={exp.location} editMode={editMode} accent={ACC} onChange={v => updateResult(`experience.${realIdx}.location`, v)} style={{}} />
                </span>
              </div>
              <Bullets items={ptsArr} onEdit={(i2, v) => { const arr = [...ptsArr]; arr[i2] = v; updateResult(`experience.${realIdx}.points`, arr); }} />
            </div>
          ); })}
      </Sec>
      {!noExp && (result.projects || []).filter(p => p.name).length > 0 && (
        <Sec title="Projects">
          {result.projects.filter(p => p.name).map((proj, i) => {
            const realIdx = result.projects.indexOf(proj);
            return (
            <div key={i} style={{ marginBottom: 10 }}>
              <EditableText tag="div" value={proj.name} editMode={editMode} accent={ACC} onChange={v => updateResult(`projects.${realIdx}.name`, v)} style={{ fontSize: 13, fontWeight: 700, color: '#111' }} />
              <EditableText tag="div" value={proj.description || proj.desc} editMode={editMode} accent={ACC} onChange={v => updateResult(`projects.${realIdx}.description`, v)} style={{ fontSize: 12, color: '#333', lineHeight: 1.6 }} />
              {proj.impact && <EditableText tag="div" value={proj.impact} editMode={editMode} accent={ACC} onChange={v => updateResult(`projects.${realIdx}.impact`, v)} style={{ fontSize: 11.5, color: '#555' }} />}
            </div>
          ); })}
        </Sec>
      )}
      <Sec title="Technical Skills">
        {['technical', 'tools', 'soft', 'languages'].map(group => {
          const arr = skills[group] || [];
          if (!arr.length) return null;
          const lbl = { technical: 'Technical', tools: 'Tools', soft: 'Soft Skills', languages: 'Languages' }[group];
          return (
            <div key={group} style={{ fontSize: 12, color: '#222', marginBottom: 4 }}>
              <strong>{lbl}:</strong>{' '}
              {arr.map((s, i) => (
                <span key={i}><EditableText value={s} editMode={editMode} accent={ACC} onChange={v => updateSkillItem(group, i, v)} style={{}} />{i < arr.length - 1 ? ', ' : ''}</span>
              ))}
            </div>
          );
        })}
      </Sec>
      {(skills.certifications || []).length > 0 && (
        <Sec title="Certifications">
          {skills.certifications.map((c, i) => (
            <div key={i} style={{ fontSize: 12, color: '#222', marginBottom: 3 }}>
              <EditableText value={typeof c === 'object' ? c.name : c} editMode={editMode} accent={ACC} onChange={v => updateCert(i, 'name', v)} style={{}} />
              {typeof c === 'object' && (c.issuer || c.year) ? <span> — <EditableText value={c.issuer || ''} editMode={editMode} accent={ACC} onChange={v => updateCert(i, 'issuer', v)} style={{}} />{c.issuer && c.year ? ', ' : ''}<EditableText value={c.year || ''} editMode={editMode} accent={ACC} onChange={v => updateCert(i, 'year', v)} style={{}} /></span> : null}
            </div>
          ))}
        </Sec>
      )}
      {(result.achievements || []).filter(Boolean).length > 0 && (
        <Sec title="Achievements">
          {result.achievements.filter(Boolean).map((a, i) => {
            const realIdx = result.achievements.indexOf(a);
            return (
            <div key={i} style={{ fontSize: 12, color: '#222', marginBottom: 3, paddingLeft: 14, position: 'relative' }}>
              <span style={{ position: 'absolute', left: 0 }}>•</span>
              <EditableText value={a} editMode={editMode} accent={ACC} onChange={v => updateResult(`achievements.${realIdx}`, v)} style={{}} block />
            </div>
          ); })}
        </Sec>
      )}
    </div>
  );
}

// Live preview — Minimal Clean template (mirrors buildMinimalResumeHTML), with live edit support
function MinimalPreview({ result, profile, th, editMode, updateResult, updateSkillItem, updateCert }) {
  const skills = result.skills || {};
  const realExp = (result.experience || []).filter(ex => (ex.title || ex.company || '').trim() !== '' && ex.company !== 'Personal Project');
  const noExp = realExp.length === 0;
  const contactParts = [result.email, result.phone, result.location, result.linkedin, result.github].filter(Boolean);
  const Tag = ({ children }) => <span style={{ display: 'inline-block', background: '#f4f4f5', color: '#333', padding: '3px 11px', borderRadius: 6, fontSize: 11, margin: '2px 4px 2px 0' }}>{children}</span>;
  const Sec = ({ title, children }) => (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <div style={{ width: 4, height: 14, background: th.acc, borderRadius: 2 }} />
        <span style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: '#222' }}>{title}</span>
      </div>
      {children}
    </div>
  );
  return (
    <div style={{ background: '#fff', borderRadius: 8, overflow: 'hidden', boxShadow: '0 20px 60px rgba(18,54,42,0.22)', fontFamily: "'Segoe UI',Arial,sans-serif", padding: '38px 44px' }}>
      <div style={{ borderBottom: `2px solid ${th.acc}`, paddingBottom: 14, marginBottom: 22 }}>
        <EditableText tag="div" value={result.name || profile.name} editMode={editMode} accent={th.acc} onChange={v => updateResult('name', v)} style={{ fontSize: 28, fontWeight: 800, color: '#111', letterSpacing: '-0.5px' }} />
        <div style={{ fontSize: 12, color: th.acc, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', marginTop: 3 }}>{inferJobTitle(profile)}</div>
        <div style={{ fontSize: 11.5, color: '#666', marginTop: 8 }}>{contactParts.join('   ·   ')}</div>
      </div>
      {result.summary && <Sec title="Summary"><EditableText tag="p" value={result.summary} editMode={editMode} accent={th.acc} onChange={v => updateResult('summary', v)} style={{ fontSize: 12.5, color: '#333', lineHeight: 1.75, margin: 0 }} /></Sec>}
      <Sec title="Experience">
        {noExp
          ? (result.projects || []).filter(p => p.name).map((proj, i) => {
            const realIdx = result.projects.indexOf(proj);
            return (
            <div key={i} style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 4, marginBottom: 2 }}>
                <span style={{ fontSize: 13.5, fontWeight: 700, color: '#111' }}>{inferJobTitle(profile)}</span>
                <span style={{ fontSize: 11.5, color: th.acc, fontWeight: 600 }}>Present</span>
              </div>
              <EditableText tag="div" value={proj.name} editMode={editMode} accent={th.acc} onChange={v => updateResult(`projects.${realIdx}.name`, v)} style={{ fontSize: 12, color: '#555', marginBottom: 5 }} />
              <div style={{ fontSize: 12, color: '#333', lineHeight: 1.7, paddingLeft: 14, position: 'relative' }}>
                <span style={{ position: 'absolute', left: 0, color: th.acc }}>–</span>
                <EditableText value={proj.description || proj.desc} editMode={editMode} accent={th.acc} onChange={v => updateResult(`projects.${realIdx}.description`, v)} style={{}} block />
              </div>
            </div>
          ); })
          : realExp.map((exp, i) => {
            const realIdx = result.experience.indexOf(exp);
            const ptsArr = Array.isArray(exp.points) ? exp.points : (exp.points || '').split('\n');
            return (
            <div key={i} style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 4, marginBottom: 2 }}>
                <EditableText tag="span" value={exp.title} editMode={editMode} accent={th.acc} onChange={v => updateResult(`experience.${realIdx}.title`, v)} style={{ fontSize: 13.5, fontWeight: 700, color: '#111' }} />
                <EditableText tag="span" value={exp.duration} editMode={editMode} accent={th.acc} onChange={v => updateResult(`experience.${realIdx}.duration`, v)} style={{ fontSize: 11.5, color: th.acc, fontWeight: 600 }} />
              </div>
              <div style={{ fontSize: 12, color: '#555', marginBottom: 5 }}>
                <EditableText value={exp.company} editMode={editMode} accent={th.acc} onChange={v => updateResult(`experience.${realIdx}.company`, v)} style={{}} />
                {exp.location ? ' · ' : ''}
                <EditableText value={exp.location} editMode={editMode} accent={th.acc} onChange={v => updateResult(`experience.${realIdx}.location`, v)} style={{}} />
              </div>
              {ptsArr.filter(Boolean).map((pt, j) => (
                <div key={j} style={{ fontSize: 12, color: '#333', lineHeight: 1.7, paddingLeft: 14, position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 0, color: th.acc }}>–</span>
                  <EditableText value={pt.replace(/^[-•▸]/, '').trim()} editMode={editMode} accent={th.acc}
                    onChange={v => { const arr = [...ptsArr]; arr[j] = v; updateResult(`experience.${realIdx}.points`, arr); }} style={{}} block />
                </div>
              ))}
            </div>
          ); })}
      </Sec>
      <Sec title="Skills">
        {['technical', 'tools', 'soft', 'languages'].map(group => (skills[group] || []).map((s, i) => (
          <Tag key={group + i}><EditableText value={s} editMode={editMode} accent={th.acc} onChange={v => updateSkillItem(group, i, v)} style={{}} /></Tag>
        )))}
      </Sec>
      {(result.education || []).filter(e => e.degree).length > 0 && (
        <Sec title="Education">
          {result.education.filter(e => e.degree).map((edu, i) => {
            const realIdx = result.education.indexOf(edu);
            return (
            <div key={i} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 4 }}>
                <EditableText tag="span" value={edu.degree} editMode={editMode} accent={th.acc} onChange={v => updateResult(`education.${realIdx}.degree`, v)} style={{ fontSize: 13.5, fontWeight: 700, color: '#111' }} />
                <EditableText tag="span" value={edu.year} editMode={editMode} accent={th.acc} onChange={v => updateResult(`education.${realIdx}.year`, v)} style={{ fontSize: 11.5, color: th.acc, fontWeight: 600 }} />
              </div>
              <EditableText tag="div" value={edu.institution || edu.inst} editMode={editMode} accent={th.acc} onChange={v => updateResult(`education.${realIdx}.institution`, v)} style={{ fontSize: 12, color: '#555' }} />
              {(edu.context?.trim() || autoEduContext(edu)) && <EditableText tag="div" value={edu.context?.trim() || autoEduContext(edu)} editMode={editMode} accent={th.acc} onChange={v => updateResult(`education.${realIdx}.context`, v)} style={{ fontSize: 11.5, color: '#777', marginTop: 3 }} />}
            </div>
          ); })}
        </Sec>
      )}
      {!noExp && (result.projects || []).filter(p => p.name).length > 0 && (
        <Sec title="Projects">
          {result.projects.filter(p => p.name).map((proj, i) => {
            const realIdx = result.projects.indexOf(proj);
            return (
            <div key={i} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 4 }}>
                <EditableText tag="span" value={proj.name} editMode={editMode} accent={th.acc} onChange={v => updateResult(`projects.${realIdx}.name`, v)} style={{ fontSize: 13.5, fontWeight: 700, color: '#111' }} />
                {proj.link && <EditableText tag="span" value={proj.link} editMode={editMode} accent={th.acc} onChange={v => updateResult(`projects.${realIdx}.link`, v)} style={{ fontSize: 11, color: th.acc }} />}
              </div>
              <EditableText tag="div" value={proj.description || proj.desc} editMode={editMode} accent={th.acc} onChange={v => updateResult(`projects.${realIdx}.description`, v)} style={{ fontSize: 12, color: '#333', lineHeight: 1.65, marginTop: 2 }} />
              {proj.impact && <EditableText tag="div" value={proj.impact} editMode={editMode} accent={th.acc} onChange={v => updateResult(`projects.${realIdx}.impact`, v)} style={{ fontSize: 11.5, color: '#777', fontStyle: 'italic', marginTop: 2 }} />}
            </div>
          ); })}
        </Sec>
      )}
      {(skills.certifications || []).length > 0 && (
        <Sec title="Certifications">
          {skills.certifications.map((c, i) => (
            <div key={i} style={{ fontSize: 12, color: '#333', marginBottom: 4 }}>
              <EditableText value={typeof c === 'object' ? c.name : c} editMode={editMode} accent={th.acc} onChange={v => updateCert(i, 'name', v)} style={{}} />
              {typeof c === 'object' && (c.issuer || c.year) ? <span> — <EditableText value={c.issuer || ''} editMode={editMode} accent={th.acc} onChange={v => updateCert(i, 'issuer', v)} style={{}} />{c.issuer && c.year ? ', ' : ''}<EditableText value={c.year || ''} editMode={editMode} accent={th.acc} onChange={v => updateCert(i, 'year', v)} style={{}} /></span> : null}
            </div>
          ))}
        </Sec>
      )}
      {(result.achievements || []).filter(Boolean).length > 0 && (
        <Sec title="Achievements">
          {result.achievements.filter(Boolean).map((a, i) => {
            const realIdx = result.achievements.indexOf(a);
            return (
            <div key={i} style={{ fontSize: 12, color: '#333', marginBottom: 4, paddingLeft: 14, position: 'relative' }}>
              <span style={{ position: 'absolute', left: 0, color: th.acc }}>–</span>
              <EditableText value={a} editMode={editMode} accent={th.acc} onChange={v => updateResult(`achievements.${realIdx}`, v)} style={{}} block />
            </div>
          ); })}
        </Sec>
      )}
    </div>
  );
}

// ─── Resume Enhancer ──────────────────────────────────────────────────────────
function EnhancerView({ profile, setProfile, showToast, A }) {
  const [oldResume, setOldResume] = useState('');
  const [targetJob, setTargetJob] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [extractedProfile, setExtractedProfile] = useState(null);
  const IS = makeIS(A); const LS = makeLS(A);

  const handlePdfUpload = async (file) => {
    if (!file) return;
    if (file.type !== 'application/pdf') { showToast('Please upload a PDF file'); return; }
    setUploading(true);
    setUploadStatus('Reading PDF...');
    try {
      setUploadStatus('Extracted text — Gemini is cleaning it up...');
      const cleanedText = await readResumePdfWithGemini(file);
      setOldResume(cleanedText);
      setUploadStatus('Resume loaded from PDF — review below, then enhance.');
      showToast('Resume PDF read successfully!');
    } catch (err) {
      setUploadStatus('');
      showToast('PDF read failed: ' + err.message);
    }
    setUploading(false);
  };

  const enhance = async () => {
    if (!oldResume.trim()) { showToast('Paste or upload your old resume first!'); return; }
    setLoading(true); setResult(''); setExtractedProfile(null);
    try {
      const enhancedText = await callAI('You are a senior resume writer. Rewrite resumes dramatically stronger following these rules: use strong ownership action verbs (never "helped/worked on/responsible for"); back every claim with a number or fair estimate; cut generic buzzwords like "hardworking/team player"; never use "I/my/me"; keep tense consistent; ONLY use skills/experience already in the resume.',
        `Rewrite for: ${targetJob || 'a professional role'}\n\nORIGINAL RESUME:\n${oldResume}\n\nRules:\n- Powerful action verbs\n- Quantify every achievement\n- Compelling 4-5 sentence summary\n- Remove all weak language, buzzwords, and first-person pronouns`, 2500);
      setResult(enhancedText);
      showToast('Resume enhanced successfully!');

      try {
        const rawProfile = await callAI('You are a document parser. Extract structured profile info from a resume. Return ONLY valid JSON.',
          `Extract profile info from this resume text:\n\n${oldResume}\n\nReturn ONLY: {"name":"","email":"","phone":"","location":"","linkedin":"","github":"","degree":"","field":"","institution":"","year":"","grade":"","skills":"","tools":"","certifications":"","achievements":""}`);
        const parsedProfile = parseJSON(rawProfile);
        if (parsedProfile && (parsedProfile.name || parsedProfile.degree || parsedProfile.skills)) {
          setExtractedProfile(parsedProfile);
        }
      } catch (_) { /* profile extraction is a bonus — enhancing already succeeded */ }
    } catch (err) { showToast('Error: ' + err.message); }
    setLoading(false);
  };

  const applyProfile = () => {
    if (!extractedProfile) return;
    setProfile(prev => ({
      ...prev,
      name: extractedProfile.name || prev.name,
      email: extractedProfile.email || prev.email,
      phone: extractedProfile.phone || prev.phone,
      location: extractedProfile.location || prev.location,
      linkedin: extractedProfile.linkedin || prev.linkedin,
      github: extractedProfile.github || prev.github,
      tech: extractedProfile.skills ? (prev.tech ? prev.tech + ', ' + extractedProfile.skills : extractedProfile.skills) : prev.tech,
      tools: extractedProfile.tools ? (prev.tools ? prev.tools + ', ' + extractedProfile.tools : extractedProfile.tools) : prev.tools,
      certs: extractedProfile.certifications ? (prev.certs ? prev.certs + ', ' + extractedProfile.certifications : extractedProfile.certifications) : prev.certs,
      achievements: extractedProfile.achievements ? (prev.achievements ? prev.achievements + ' | ' + extractedProfile.achievements : extractedProfile.achievements) : prev.achievements,
      edu: extractedProfile.degree ? [{ degree: extractedProfile.degree || '', field: extractedProfile.field || '', inst: extractedProfile.institution || '', year: extractedProfile.year || '', grade: extractedProfile.grade || '', context: '' }, ...prev.edu.filter(e => e.degree)] : prev.edu
    }));
    showToast('Applied to your profile!');
  };

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '32px 24px' }}>
      <h2 style={{ fontSize: 22, fontWeight: 800, color: A.textPrimary, marginBottom: 6 }}>Resume Enhancer</h2>
      <p style={{ color: A.textSecondary, fontSize: 14, marginBottom: 20 }}>Upload a PDF or paste your old resume — AI rewrites it dramatically stronger and can auto-fill your profile</p>

      <PdfUploadBox A={A} uploading={uploading} uploadStatus={uploadStatus} onFile={handlePdfUpload} inputId="enhancer-pdf-upload"
        hint="Gemini reads the PDF and fills the text box below — you can still edit it." />

      <div style={{ marginBottom: 14 }}><label style={LS}>Target Job Title</label><input value={targetJob} onChange={e => setTargetJob(e.target.value)} placeholder="e.g. AI Product Developer" style={IS} /></div>
      <Area label="Old Resume Text *" value={oldResume} onChange={setOldResume} ph="Paste your full resume text here, or upload a PDF above..." rows={12} A={A} />
      <Btn onClick={enhance} disabled={loading} color="#1596D6">{loading ? 'Enhancing...' : 'Enhance My Resume'}</Btn>
      {result && (
        <div style={{ marginTop: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
            <span style={{ fontSize: 13, color: '#1596D6', fontWeight: 700 }}>Enhanced Resume</span>
            <CopyBtn text={result} onToast={showToast} />
          </div>
          <div style={{ background: '#fff', borderRadius: 12, padding: '28px 32px', fontFamily: 'Georgia,serif', color: '#1a1a1a', lineHeight: 1.9, fontSize: 14, whiteSpace: 'pre-wrap' }}>{result}</div>
        </div>
      )}
      {extractedProfile && (
        <div style={{ marginTop: 20 }}>
          <InfoCard color="#1596D6" title="Detected Profile Info">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
              {[['Name', extractedProfile.name], ['Email', extractedProfile.email], ['Phone', extractedProfile.phone], ['Location', extractedProfile.location], ['Degree', extractedProfile.degree], ['Institution', extractedProfile.institution], ['Skills', extractedProfile.skills], ['Certifications', extractedProfile.certifications]].filter(([, v]) => v).map(([l, v]) => (
                <div key={l}><div style={{ fontSize: 10, color: A.textMuted, marginBottom: 3, textTransform: 'uppercase' }}>{l}</div><div style={{ fontSize: 14, color: A.textPrimary, fontWeight: 500 }}>{v}</div></div>
              ))}
            </div>
          </InfoCard>
          <div style={{ marginTop: 14 }}><Btn onClick={applyProfile} color="#1596D6">Apply to My Profile</Btn></div>
        </div>
      )}
    </div>
  );
}

// ─── Text Extractor ───────────────────────────────────────────────────────────
function ScannerView({ profile, setProfile, showToast, A }) {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');

  const handlePdfUpload = async (file) => {
    if (!file) return;
    if (file.type !== 'application/pdf') { showToast('Please upload a PDF file'); return; }
    setUploading(true);
    setUploadStatus('Reading PDF...');
    try {
      setUploadStatus('Extracted text — Gemini is cleaning it up...');
      const cleanedText = await readResumePdfWithGemini(file);
      setText(cleanedText);
      setUploadStatus('Document loaded from PDF — review below, then extract.');
      showToast('PDF read successfully!');
    } catch (err) {
      setUploadStatus('');
      showToast('PDF read failed: ' + err.message);
    }
    setUploading(false);
  };

  const extract = async () => {
    if (!text.trim()) { showToast('Paste or upload some document text first!'); return; }
    setLoading(true); setResult(null);
    try {
      const raw = await callAI('You are a document parser. Extract structured info. Return ONLY valid JSON.',
        `Extract all info:\n\n${text}\n\nReturn ONLY: {"name":"","email":"","phone":"","degree":"","field":"","institution":"","year":"","grade":"","certifications":"","skills":"","achievements":"","document_type":""}`);
      const parsed = parseJSON(raw);
      if (parsed && (parsed.name || parsed.degree || parsed.institution)) { setResult(parsed); showToast('Info extracted successfully!'); }
      else showToast('Could not extract — try pasting more text');
    } catch (err) { showToast('Error: ' + err.message); }
    setLoading(false);
  };

  const apply = () => {
    if (!result) return;
    setProfile(prev => ({
      ...prev,
      name: result.name || prev.name, email: result.email || prev.email, phone: result.phone || prev.phone,
      tech: result.skills ? (prev.tech ? prev.tech + ', ' + result.skills : result.skills) : prev.tech,
      certs: result.certifications ? (prev.certs ? prev.certs + ', ' + result.certifications : result.certifications) : prev.certs,
      achievements: result.achievements ? (prev.achievements ? prev.achievements + ' | ' + result.achievements : result.achievements) : prev.achievements,
      edu: result.degree ? [{ degree: result.degree || '', field: result.field || '', inst: result.institution || '', year: result.year || '', grade: result.grade || '', context: '' }, ...prev.edu.filter(e => e.degree)] : prev.edu
    }));
    showToast('Applied to your profile!');
  };

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '32px 24px' }}>
      <h2 style={{ fontSize: 22, fontWeight: 800, color: A.textPrimary, marginBottom: 6 }}>Text Extractor</h2>
      <p style={{ color: A.textSecondary, fontSize: 14, marginBottom: 24 }}>Upload a PDF or paste certificate / degree text — AI extracts and fills your profile</p>

      <PdfUploadBox A={A} uploading={uploading} uploadStatus={uploadStatus} onFile={handlePdfUpload} inputId="scanner-pdf-upload"
        hint="Gemini reads the PDF and fills the text box below — you can still edit it." />

      <div style={{ background: A.warningBg, border: `1px solid ${A.warningBorder}`, borderRadius: 10, padding: '12px 16px', marginBottom: 20, fontSize: 13, color: A.warningColor }}>
        Or open your PDF certificate, press Ctrl+A → Ctrl+C, then paste below.
      </div>
      <Area label="Certificate / Degree / Marksheet Text *" value={text} onChange={setText} ph="Paste your certificate or degree text here, or upload a PDF above..." rows={10} A={A} />
      <Btn onClick={extract} disabled={loading} color="#F2A93B">{loading ? 'Extracting...' : 'Extract & Parse Info'}</Btn>
      {result && (
        <div style={{ marginTop: 24 }}>
          <InfoCard color="#0FA968" title="Extracted Information">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
              {[['Name', result.name], ['Email', result.email], ['Phone', result.phone], ['Degree', result.degree], ['Field', result.field], ['Institution', result.institution], ['Year', result.year], ['Grade', result.grade], ['Skills', result.skills], ['Certifications', result.certifications], ['Achievements', result.achievements], ['Document Type', result.document_type]].filter(([, v]) => v).map(([l, v]) => (
                <div key={l}><div style={{ fontSize: 10, color: A.textMuted, marginBottom: 3, textTransform: 'uppercase' }}>{l}</div><div style={{ fontSize: 14, color: A.textPrimary, fontWeight: 500 }}>{v}</div></div>
              ))}
            </div>
          </InfoCard>
          <div style={{ marginTop: 14 }}><Btn onClick={apply} color="#0FA968">Apply to My Profile</Btn></div>
        </div>
      )}
    </div>
  );
}

// ─── Cover Letter ─────────────────────────────────────────────────────────────
function CoverView({ profile, showToast, A }) {
  const [company, setCompany] = useState('');
  const [role, setRole] = useState('');
  const [jobDesc, setJobDesc] = useState('');
  const [tone, setTone] = useState('Professional');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');
  const IS = makeIS(A); const LS = makeLS(A);

  const generate = async () => {
    if (!profile.name.trim()) { showToast('Add your name in Profile first!'); return; }
    setLoading(true); setResult('');
    const targetRole = role || inferJobTitle(profile);
    try {
      const text = await callAI('You are an expert cover letter writer. Write compelling, personalized letters. Never invent skills not in the profile.',
        `Write a ${tone} cover letter.\nCandidate: ${profile.name} | Location: ${profile.location || 'India'}\nTarget: ${targetRole} at ${company || 'the company'}\nExp: ${profile.exp.filter(ex => ex.title).map(ex => `${ex.title} at ${ex.company}: ${ex.pts}`).join('; ') || 'Project-based experience'}\nProjects: ${profile.projects.filter(p => p.name).map(p => `${p.name}: ${p.desc}`).join('; ')}\nSkills: ${profile.tech}${profile.soft ? ', ' + profile.soft : ''}\nEducation: ${profile.edu.filter(e => e.degree).map(e => `${e.degree} in ${e.field} from ${e.inst}`).join('; ')}\nJD: ${jobDesc || 'Not provided'}\n4 paragraphs. Address: "Dear Hiring Manager," Sign: "${profile.name}"\nWrite ONLY the letter.`, 1200);
      setResult(text); showToast('Cover letter ready!');
    } catch (err) { showToast('Error: ' + err.message); }
    setLoading(false);
  };

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '32px 24px' }}>
      <h2 style={{ fontSize: 22, fontWeight: 800, color: A.textPrimary, marginBottom: 6 }}>Cover Letter</h2>
      <p style={{ color: A.textSecondary, fontSize: 14, marginBottom: 28 }}>Personalized cover letters for each application</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
        <div><label style={LS}>Company Name</label><input value={company} onChange={e => setCompany(e.target.value)} placeholder="e.g. Google / Intel" style={IS} /></div>
        <div><label style={LS}>Role (blank = auto-detect)</label><input value={role} onChange={e => setRole(e.target.value)} placeholder={inferJobTitle(profile)} style={IS} /></div>
      </div>
      <div style={{ marginBottom: 14 }}>
        <label style={LS}>Tone</label>
        <div style={{ display: 'flex', gap: 8 }}>
          {['Professional', 'Friendly', 'Confident', 'Passionate'].map(t => (
            <button key={t} onClick={() => setTone(t)} style={{ padding: '7px 16px', borderRadius: 8, border: `1px solid ${tone === t ? '#0C8457' : A.cardBorder}`, background: tone === t ? 'rgba(12,132,87,0.12)' : A.cardBg, color: tone === t ? '#0C8457' : A.textSecondary, cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit' }}>{t}</button>
          ))}
        </div>
      </div>
      <Area label="Job Description (optional)" value={jobDesc} onChange={setJobDesc} ph="Paste job description for better personalization..." rows={4} A={A} />
      <Btn onClick={generate} disabled={loading} color="#0C8457">{loading ? 'Writing...' : 'Generate Cover Letter'}</Btn>
      {result && (
        <div style={{ marginTop: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
            <span style={{ fontSize: 13, color: '#0C8457', fontWeight: 700 }}>Your Cover Letter</span>
            <CopyBtn text={result} onToast={showToast} />
          </div>
          <div style={{ background: '#fff', borderRadius: 12, padding: '32px 36px', fontFamily: 'Georgia,serif', color: '#1a1a1a', lineHeight: 1.9, fontSize: 14, whiteSpace: 'pre-wrap' }}>{result}</div>
        </div>
      )}
    </div>
  );
}

// ─── LinkedIn ─────────────────────────────────────────────────────────────────
function LinkedInView({ profile, showToast, A }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const generate = async () => {
    if (!profile.name.trim()) { showToast('Complete your profile first!'); return; }
    setLoading(true); setResult(null);
    try {
      const raw = await callAI('You are a LinkedIn optimization expert. Return ONLY valid JSON.',
        `LinkedIn for:\nName: ${profile.name} | Target: ${inferJobTitle(profile)} | Location: ${profile.location}\nSkills: ${profile.tech}, ${profile.tools}\nEdu: ${profile.edu.filter(e => e.degree).map(e => `${e.degree} in ${e.field} from ${e.inst}`).join(', ')}\nExp: ${profile.exp.filter(e => e.title).map(e => `${e.title} at ${e.company}`).join(', ') || 'Projects: ' + profile.projects.filter(p => p.name).map(p => p.name).join(', ')}\nReturn JSON: {"headline":"","summary":"","elevator_pitch":"","skills_to_add":[],"profile_tips":[],"connection_note":"","keywords_to_include":[],"banner_idea":""}`);
      const parsed = parseJSON(raw);
      if (parsed) { setResult(parsed); showToast('LinkedIn content ready!'); }
      else showToast('Try again');
    } catch (err) { showToast('Error: ' + err.message); }
    setLoading(false);
  };

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '32px 24px' }}>
      <h2 style={{ fontSize: 22, fontWeight: 800, color: A.textPrimary, marginBottom: 6 }}>LinkedIn Optimizer</h2>
      <p style={{ color: A.textSecondary, fontSize: 14, marginBottom: 28 }}>Complete LinkedIn presence from your profile</p>
      <Btn onClick={generate} disabled={loading} color="#0E77AC">{loading ? 'Optimizing...' : 'Generate LinkedIn Content'}</Btn>
      {result && (
        <div style={{ marginTop: 28, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {result.headline && <InfoCard color="#0E77AC" title="Headline"><div style={{ fontSize: 17, fontWeight: 700, color: A.textPrimary, marginBottom: 8 }}>{result.headline}</div><CopyBtn text={result.headline} onToast={showToast} /></InfoCard>}
          {result.summary && <InfoCard color="#5c6b64" title="About Section"><div style={{ fontSize: 14, color: A.textPrimary, lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{result.summary}</div><CopyBtn text={result.summary} onToast={showToast} /></InfoCard>}
          {result.elevator_pitch && <InfoCard color="#0C8457" title="Elevator Pitch"><div style={{ fontSize: 14, color: A.textPrimary, lineHeight: 1.8 }}>{result.elevator_pitch}</div><CopyBtn text={result.elevator_pitch} onToast={showToast} /></InfoCard>}
          {result.skills_to_add?.length > 0 && <InfoCard color="#1596D6" title="Skills to Add"><div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{result.skills_to_add.map((sk, i) => <span key={i} style={{ background: 'rgba(21,150,214,0.1)', border: '1px solid rgba(21,150,214,0.22)', color: '#0E77AC', padding: '4px 14px', borderRadius: 20, fontSize: 13 }}>{sk}</span>)}</div></InfoCard>}
          {result.connection_note && <InfoCard color="#0FA968" title="Connection Note"><div style={{ fontSize: 14, color: A.textPrimary, fontStyle: 'italic' }}>"{result.connection_note}"</div><CopyBtn text={result.connection_note} onToast={showToast} /></InfoCard>}
          {result.banner_idea && <InfoCard color="#F2A93B" title="Banner Idea"><div style={{ fontSize: 14, color: A.textPrimary }}>{result.banner_idea}</div></InfoCard>}
          {result.profile_tips?.length > 0 && <InfoCard color="#F2A93B" title="Pro Tips">{result.profile_tips.map((t, i) => <div key={i} style={{ fontSize: 13, color: A.textPrimary, marginBottom: 7 }}>→ {t}</div>)}</InfoCard>}
        </div>
      )}
    </div>
  );
}

// ─── ATS Analyzer ─────────────────────────────────────────────────────────────
function ATSView({ profile, showToast, A }) {
  const [resumeText, setResumeText] = useState('');
  const [jobDesc, setJobDesc] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');

  const handlePdfUpload = async (file) => {
    if (!file) return;
    if (file.type !== 'application/pdf') { showToast('Please upload a PDF file'); return; }
    setUploading(true);
    setUploadStatus('Reading PDF...');
    try {
      setUploadStatus('Extracted text — Gemini is cleaning it up...');
      const cleanedText = await readResumePdfWithGemini(file);
      setResumeText(cleanedText);
      setUploadStatus('Resume loaded from PDF — review below, then analyze.');
      showToast('Resume PDF read successfully!');
    } catch (err) {
      setUploadStatus('');
      showToast('PDF read failed: ' + err.message);
    }
    setUploading(false);
  };

  const analyze = async () => {
    if (!jobDesc.trim()) { showToast('Paste the job description first!'); return; }
    setLoading(true); setResult(null);
    try {
      const profileText = profile.name ? `Name: ${profile.name}, Target: ${inferJobTitle(profile)}, Skills: ${profile.tech} ${profile.soft} ${profile.tools}, Projects: ${profile.projects.filter(p => p.name).map(p => `${p.name}: ${p.desc}`).join('; ')}, Exp: ${profile.exp.filter(ex => ex.title).map(ex => `${ex.title} at ${ex.company}: ${ex.pts}`).join('; ')}, Edu: ${profile.edu.map(ed => `${ed.degree} in ${ed.field} from ${ed.inst}`).join(', ')}` : '';
      const raw = await callAI('You are an ATS expert. Return ONLY valid JSON.',
        `Analyze resume vs JD.\nRESUME: ${resumeText || profileText}\nJD: ${jobDesc}\nReturn JSON: {"ats_score":75,"grade":"B","summary":"","keyword_match_pct":65,"experience_match":"","keywords_found":[],"keywords_missing":[],"strengths":[],"weaknesses":[],"action_items":[],"rewrite_suggestions":[{"section":"","original":"","improved":""}]}`);
      const parsed = parseJSON(raw);
      if (parsed) { setResult(parsed); showToast('Analysis complete!'); }
      else showToast('Try again');
    } catch (err) { showToast('Error: ' + err.message); }
    setLoading(false);
  };

  const sc = result ? (result.ats_score >= 70 ? '#0FA968' : result.ats_score >= 50 ? '#F2A93B' : '#B23B3B') : '#0FA968';

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '32px 24px' }}>
      <h2 style={{ fontSize: 22, fontWeight: 800, color: A.textPrimary, marginBottom: 6 }}>ATS Analyzer</h2>
      <p style={{ color: A.textSecondary, fontSize: 14, marginBottom: 28 }}>Score your resume vs any job description — upload a PDF or paste text</p>

      <PdfUploadBox A={A} uploading={uploading} uploadStatus={uploadStatus} onFile={handlePdfUpload} inputId="ats-pdf-upload"
        hint="Gemini reads the PDF and fills the text box below — you can still edit it." />

      <Area label="Resume Text (auto-filled from PDF, or paste / leave blank to use profile)" value={resumeText} onChange={setResumeText} ph="Paste resume text, upload a PDF above, or leave blank to use profile..." rows={5} A={A} />
      <Area label="Job Description *" value={jobDesc} onChange={setJobDesc} ph="Paste the full job description here..." rows={6} A={A} />
      <Btn onClick={analyze} disabled={loading} color="#0FA968">{loading ? 'Analyzing...' : 'Analyze ATS Match'}</Btn>
      {result && (
        <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ background: `${sc}0c`, border: `1px solid ${sc}44`, borderRadius: 16, padding: '24px 28px', display: 'flex', gap: 28, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ textAlign: 'center' }}><div style={{ fontSize: 58, fontWeight: 900, color: sc, lineHeight: 1 }}>{result.ats_score}</div><div style={{ fontSize: 13, color: A.textSecondary }}>/100 · Grade {result.grade}</div></div>
            <div style={{ flex: 1 }}><div style={{ fontSize: 15, color: A.textPrimary, marginBottom: 8 }}>{result.summary}</div><div style={{ fontSize: 13, color: A.textSecondary }}>Keywords: <span style={{ color: sc, fontWeight: 700 }}>{result.keyword_match_pct}%</span> · {result.experience_match}</div></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <InfoCard color="#0FA968" title="Keywords Found">{(result.keywords_found || []).map((kw, i) => <span key={i} style={{ display: 'inline-block', background: 'rgba(15,169,104,0.1)', border: '1px solid rgba(15,169,104,0.22)', color: '#0C8457', padding: '3px 10px', borderRadius: 20, fontSize: 12, margin: '3px' }}>{kw}</span>)}</InfoCard>
            <InfoCard color="#B23B3B" title="Keywords Missing">{(result.keywords_missing || []).map((kw, i) => <span key={i} style={{ display: 'inline-block', background: 'rgba(220,60,60,0.08)', border: '1px solid rgba(220,60,60,0.18)', color: '#B23B3B', padding: '3px 10px', borderRadius: 20, fontSize: 12, margin: '3px' }}>{kw}</span>)}</InfoCard>
          </div>
          {result.action_items?.length > 0 && <InfoCard color="#1596D6" title="Action Items">{result.action_items.map((item, i) => <div key={i} style={{ fontSize: 13, color: A.textPrimary, marginBottom: 8, display: 'flex', gap: 10 }}><span style={{ color: '#1596D6', fontWeight: 700 }}>{i + 1}.</span>{item}</div>)}</InfoCard>}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <InfoCard color="#0FA968" title="Strengths">{(result.strengths || []).map((s, i) => <div key={i} style={{ fontSize: 13, color: A.textPrimary, marginBottom: 6 }}>✓ {s}</div>)}</InfoCard>
            <InfoCard color="#F2A93B" title="Weaknesses">{(result.weaknesses || []).map((w, i) => <div key={i} style={{ fontSize: 13, color: A.textPrimary, marginBottom: 6 }}>→ {w}</div>)}</InfoCard>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Career Advisor ───────────────────────────────────────────────────────────
function AdvisorView({ profile, showToast, A }) {
  const [status, setStatus] = useState('');
  const [timeline, setTimeline] = useState('6 months');
  const [concerns, setConcerns] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const IS = makeIS(A); const LS = makeLS(A);

  const analyze = async () => {
    if (!profile.name.trim()) { showToast('Complete your profile first!'); return; }
    setLoading(true); setResult(null);
    try {
      const raw = await callAI('You are a senior career coach. Give honest, actionable advice. Return ONLY valid JSON.',
        `Career roadmap:\nName: ${profile.name} | Target: ${inferJobTitle(profile)} | Status: ${status || 'Job seeker'} | Timeline: ${timeline}\nConcerns: ${concerns || 'General guidance'}\nEdu: ${JSON.stringify(profile.edu)} | Exp: ${JSON.stringify(profile.exp)}\nProjects: ${profile.projects.filter(p => p.name).map(p => p.name).join(', ')}\nSkills: ${profile.tech} | Tools: ${profile.tools} | Certs: ${profile.certs}\nReturn JSON: {"career_score":72,"grade":"B","profile_summary":"","market_readiness":"","strengths":[],"critical_gaps":[],"quick_wins":[],"roadmap":[{"period":"","action":"","why":"","effort":""}],"certifications_recommended":[{"name":"","platform":"","cost":"","priority":"","impact":""}],"job_titles_to_target":[],"salary_insights":{"entry":"","mid":"","senior":""},"top_companies":[],"brutal_honest_advice":""}`);
      const parsed = parseJSON(raw);
      if (parsed) { setResult(parsed); showToast('Career analysis ready!'); }
      else showToast('Try again');
    } catch (err) { showToast('Error: ' + err.message); }
    setLoading(false);
  };

  const sc = n => n >= 70 ? '#0FA968' : n >= 50 ? '#F2A93B' : '#B23B3B';

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '32px 24px' }}>
      <h2 style={{ fontSize: 22, fontWeight: 800, color: A.textPrimary, marginBottom: 6 }}>Career Advisor</h2>
      <p style={{ color: A.textSecondary, fontSize: 14, marginBottom: 28 }}>Personalized roadmap and honest career advice</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
        <div><label style={LS}>Current Status</label><input value={status} onChange={e => setStatus(e.target.value)} placeholder="Student / Fresher / Working" style={IS} /></div>
        <div><label style={LS}>Timeline</label><select value={timeline} onChange={e => setTimeline(e.target.value)} style={{ ...IS, cursor: 'pointer' }}>{['1 month', '3 months', '6 months', '1 year', '2 years'].map(t => <option key={t}>{t}</option>)}</select></div>
      </div>
      <Area label="Concerns / Questions" value={concerns} onChange={setConcerns} ph="Any career questions you want answered?" rows={3} A={A} />
      <Btn onClick={analyze} disabled={loading} color="#0FA968">{loading ? 'Analyzing...' : 'Get Career Roadmap'}</Btn>
      {result && (
        <div style={{ marginTop: 28, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ background: A.sectionCardBg, border: `1px solid ${A.sectionCardBorder}`, borderRadius: 16, padding: 24 }}>
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ textAlign: 'center' }}><div style={{ fontSize: 54, fontWeight: 900, color: sc(result.career_score), lineHeight: 1 }}>{result.career_score}</div><div style={{ fontSize: 12, color: A.textSecondary }}>Score · Grade {result.grade}</div></div>
              <div style={{ flex: 1 }}><div style={{ fontSize: 14, color: A.textPrimary, lineHeight: 1.7, marginBottom: 8 }}>{result.profile_summary}</div><div style={{ display: 'inline-block', background: sc(result.career_score) + '22', border: `1px solid ${sc(result.career_score)}44`, color: sc(result.career_score), padding: '4px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700 }}>{result.market_readiness}</div></div>
            </div>
          </div>
          {result.brutal_honest_advice && <div style={{ background: 'rgba(220,60,60,0.06)', border: '1px solid rgba(220,60,60,0.2)', borderRadius: 12, padding: 20 }}><div style={{ fontSize: 11, color: '#B23B3B', fontWeight: 700, marginBottom: 8, textTransform: 'uppercase' }}>Honest Advice</div><div style={{ fontSize: 15, color: A.textPrimary, lineHeight: 1.7, fontStyle: 'italic' }}>"{result.brutal_honest_advice}"</div></div>}
          {result.quick_wins?.length > 0 && <InfoCard color="#0FA968" title="Quick Wins">{result.quick_wins.map((w, i) => <div key={i} style={{ fontSize: 13, color: A.textPrimary, marginBottom: 8, display: 'flex', gap: 10 }}><span style={{ color: '#0FA968', fontWeight: 700 }}>{i + 1}.</span>{w}</div>)}</InfoCard>}
          {result.roadmap?.length > 0 && <InfoCard color="#0FA968" title="Your Roadmap">{result.roadmap.map((step, i) => (
            <div key={i} style={{ display: 'flex', gap: 14, marginBottom: 16, paddingBottom: 16, borderBottom: i < result.roadmap.length - 1 ? `1px solid ${A.divider}` : 'none' }}>
              <div style={{ minWidth: 90, background: 'rgba(15,169,104,0.12)', border: '1px solid rgba(15,169,104,0.2)', color: '#0FA968', padding: '5px 8px', borderRadius: 8, fontSize: 11, fontWeight: 700, textAlign: 'center' }}>{step.period}</div>
              <div style={{ flex: 1 }}><div style={{ fontSize: 14, fontWeight: 600, color: A.textPrimary, marginBottom: 3 }}>{step.action}</div><div style={{ fontSize: 12, color: A.textSecondary, marginBottom: 3 }}>{step.why}</div><span style={{ background: step.effort === 'High' ? 'rgba(220,60,60,0.08)' : step.effort === 'Medium' ? 'rgba(242,169,59,0.1)' : 'rgba(15,169,104,0.1)', color: step.effort === 'High' ? '#B23B3B' : step.effort === 'Medium' ? '#92600E' : '#0C8457', padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600 }}>Effort: {step.effort}</span></div>
            </div>
          ))}</InfoCard>}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <InfoCard color="#0FA968" title="Strengths">{(result.strengths || []).map((s, i) => <div key={i} style={{ fontSize: 13, color: A.textPrimary, marginBottom: 6 }}>✓ {s}</div>)}</InfoCard>
            <InfoCard color="#F2A93B" title="Critical Gaps">{(result.critical_gaps || []).map((g, i) => <div key={i} style={{ fontSize: 13, color: A.textPrimary, marginBottom: 6 }}>→ {g}</div>)}</InfoCard>
          </div>
          {result.certifications_recommended?.length > 0 && <InfoCard color="#1596D6" title="Recommended Certifications">{result.certifications_recommended.map((c, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: A.textPrimary, marginBottom: 10, flexWrap: 'wrap', gap: 6 }}>
              <div><span style={{ fontWeight: 600, color: '#0E77AC' }}>{c.name}</span> · {c.platform}</div>
              <div style={{ display: 'flex', gap: 6 }}><span style={{ background: 'rgba(21,150,214,0.1)', color: '#0E77AC', padding: '2px 8px', borderRadius: 6, fontSize: 11 }}>{c.priority}</span><span style={{ color: A.textSecondary, fontSize: 11 }}>{c.cost}</span></div>
            </div>
          ))}</InfoCard>}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {result.salary_insights && <InfoCard color="#5c6b64" title="Salary Insights">{[['Entry', result.salary_insights.entry], ['Mid', result.salary_insights.mid], ['Senior', result.salary_insights.senior]].filter(([, v]) => v).map(([l, s]) => <div key={l} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: A.textPrimary, marginBottom: 8 }}><span style={{ color: A.textSecondary }}>{l}</span><span style={{ fontWeight: 700, color: '#0FA968' }}>{s}</span></div>)}</InfoCard>}
            {result.top_companies?.length > 0 && <InfoCard color="#5c6b64" title="Target Companies">{result.top_companies.map((c, i) => <div key={i} style={{ fontSize: 13, color: A.textPrimary, marginBottom: 5 }}>▸ {c}</div>)}</InfoCard>}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Interview Prep ───────────────────────────────────────────────────────────
function InterviewView({ profile, showToast, A }) {
  const [role, setRole] = useState('');
  const [company, setCompany] = useState('');
  const [type, setType] = useState('Technical');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const IS = makeIS(A); const LS = makeLS(A);

  const generate = async () => {
    const targetRole = role || inferJobTitle(profile);
    if (!targetRole.trim()) { showToast('Enter the role!'); return; }
    setLoading(true); setResult(null);
    try {
      const raw = await callAI('You are an expert interview coach. Return ONLY valid JSON.',
        `Interview prep for: ${profile.name || 'Candidate'} | Role: ${targetRole} at ${company || 'a company'} | Type: ${type}\nSkills: ${profile.tech}, ${profile.soft}\nExp: ${profile.exp.filter(ex => ex.title).map(ex => `${ex.title} at ${ex.company}`).join(', ') || 'Project-based'}\nProjects: ${profile.projects.filter(p => p.name).map(p => p.name).join(', ')}\nReturn JSON: {"interview_type":"${type}","role":"${targetRole}","questions":[{"q":"","category":"","difficulty":"Easy/Medium/Hard","hint":"","star_answer":""}],"pro_tips":[],"questions_to_ask_interviewer":[],"red_flags_to_avoid":[],"salary_negotiation_tips":[],"day_before_checklist":[]}`);
      const parsed = parseJSON(raw);
      if (parsed) { setResult(parsed); showToast('Interview prep ready!'); }
      else showToast('Try again');
    } catch (err) { showToast('Error: ' + err.message); }
    setLoading(false);
  };

  const dc = d => d === 'Hard' ? '#B23B3B' : d === 'Medium' ? '#92600E' : '#0C8457';

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '32px 24px' }}>
      <h2 style={{ fontSize: 22, fontWeight: 800, color: A.textPrimary, marginBottom: 6 }}>Interview Prep</h2>
      <p style={{ color: A.textSecondary, fontSize: 14, marginBottom: 28 }}>Custom Q&A for your exact role and company</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
        <div><label style={LS}>Role (blank = auto-detect)</label><input value={role} onChange={e => setRole(e.target.value)} placeholder={inferJobTitle(profile)} style={IS} /></div>
        <div><label style={LS}>Company</label><input value={company} onChange={e => setCompany(e.target.value)} placeholder="e.g. Intel / TCS" style={IS} /></div>
      </div>
      <div style={{ marginBottom: 20 }}>
        <label style={LS}>Interview Type</label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {['Technical', 'Behavioral', 'HR Round', 'System Design', 'Case Study', 'Management'].map(t => (
            <button key={t} onClick={() => setType(t)} style={{ padding: '7px 14px', borderRadius: 8, border: `1px solid ${type === t ? '#F2A93B' : A.cardBorder}`, background: type === t ? 'rgba(242,169,59,0.12)' : A.cardBg, color: type === t ? '#92600E' : A.textSecondary, cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit' }}>{t}</button>
          ))}
        </div>
      </div>
      <Btn onClick={generate} disabled={loading} color="#D97706">{loading ? 'Preparing...' : 'Generate Interview Prep'}</Btn>
      {result && (
        <div style={{ marginTop: 28, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <InfoCard color="#F2A93B" title={`${result.interview_type} — ${result.role}`}>
            {(result.questions || []).map((qa, i) => (
              <div key={i} style={{ marginBottom: 20, paddingBottom: 20, borderBottom: i < result.questions.length - 1 ? `1px solid ${A.divider}` : 'none' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 8 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: A.textPrimary, flex: 1 }}>Q{i + 1}: {qa.q}</div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <span style={{ background: dc(qa.difficulty) + '22', color: dc(qa.difficulty), padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700 }}>{qa.difficulty}</span>
                    <span style={{ background: A.badgeTagBg, color: A.badgeTagColor, padding: '2px 8px', borderRadius: 6, fontSize: 10 }}>{qa.category}</span>
                  </div>
                </div>
                <div style={{ background: 'rgba(242,169,59,0.1)', borderLeft: '3px solid #F2A93B', padding: '8px 12px', borderRadius: '0 6px 6px 0', marginBottom: 8, fontSize: 12, color: '#92600E' }}>Hint: {qa.hint}</div>
                <div style={{ fontSize: 13, color: A.textSecondary, lineHeight: 1.7 }}>Answer approach: {qa.star_answer}</div>
              </div>
            ))}
          </InfoCard>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <InfoCard color="#0FA968" title="Pro Tips">{(result.pro_tips || []).map((t, i) => <div key={i} style={{ fontSize: 13, color: A.textPrimary, marginBottom: 7 }}>✓ {t}</div>)}</InfoCard>
            <InfoCard color="#1596D6" title="Ask the Interviewer">{(result.questions_to_ask_interviewer || []).map((q, i) => <div key={i} style={{ fontSize: 13, color: A.textPrimary, marginBottom: 7 }}>→ {q}</div>)}</InfoCard>
          </div>
          {result.salary_negotiation_tips?.length > 0 && <InfoCard color="#0FA968" title="Salary Negotiation Tips">{result.salary_negotiation_tips.map((t, i) => <div key={i} style={{ fontSize: 13, color: A.textPrimary, marginBottom: 6 }}>· {t}</div>)}</InfoCard>}
          {result.day_before_checklist?.length > 0 && <InfoCard color="#0FA968" title="Day-Before Checklist"><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>{result.day_before_checklist.map((item, i) => <div key={i} style={{ fontSize: 13, color: A.textPrimary }}>☐ {item}</div>)}</div></InfoCard>}
          {result.red_flags_to_avoid?.length > 0 && <InfoCard color="#B23B3B" title="Never Do This"><div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{result.red_flags_to_avoid.map((rf, i) => <span key={i} style={{ background: 'rgba(220,60,60,0.08)', border: '1px solid rgba(220,60,60,0.18)', color: '#B23B3B', padding: '4px 12px', borderRadius: 8, fontSize: 12 }}>✕ {rf}</span>)}</div></InfoCard>}
        </div>
      )}
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function MKAISuite() {
  const [view, setView] = useState('home');
  const [profile, setProfile] = useState(BLANK);
  const [toast, setToast] = useState('');

  const A = APP_THEME;

  useEffect(() => { try { const s = localStorage.getItem('mkaisuite_v6'); if (s) setProfile(JSON.parse(s)); } catch (_) {} }, []);
  useEffect(() => { try { localStorage.setItem('mkaisuite_v6', JSON.stringify(profile)); } catch (_) {} }, [profile]);

  const showToast = useCallback((msg) => { setToast(msg); setTimeout(() => setToast(''), 3500); }, []);
  const completion = profileScore(profile);

  const viewProps = { profile, setProfile, showToast, A };

  const views = {
    home:      <LandingView setView={setView} completion={completion} A={A} />,
    profile:   <ProfileView profile={profile} setProfile={setProfile} showToast={showToast} A={A} />,
    resume:    <ResumeView profile={profile} showToast={showToast} A={A} />,
    enhancer:  <EnhancerView {...viewProps} />,
    scanner:   <ScannerView profile={profile} setProfile={setProfile} showToast={showToast} A={A} />,
    cover:     <CoverView profile={profile} showToast={showToast} A={A} />,
    linkedin:  <LinkedInView profile={profile} showToast={showToast} A={A} />,
    ats:       <ATSView profile={profile} showToast={showToast} A={A} />,
    advisor:   <AdvisorView profile={profile} showToast={showToast} A={A} />,
    interview: <InterviewView profile={profile} showToast={showToast} A={A} />
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: A.pageBg,
      backgroundImage: A.pageBgGradient,
      color: A.textPrimary,
      fontFamily: "'Segoe UI',system-ui,sans-serif",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;650;700;800&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: rgba(18,54,42,0.12); border-radius: 4px; }
      `}</style>
      <Toast msg={toast} A={A} />
      <TopBar view={view} setView={setView} completion={completion} A={A} />
      <div style={{ position: 'relative', zIndex: 1 }}>{views[view] || views.home}</div>
      <FloatingBackBtn view={view} setView={setView} A={A} />
    </div>
  );
}