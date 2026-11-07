import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';

// ══════════════════════════════════════════════════════════════
// SCRIPT LOADER
// ══════════════════════════════════════════════════════════════
const _loaded = new Set();
const loadScript = (src) => new Promise((res, rej) => {
  if (_loaded.has(src)) return res();
  const el = document.createElement('script');
  el.src = src; el.onload = () => { _loaded.add(src); res(); }; el.onerror = rej;
  document.head.appendChild(el);
});

// ══════════════════════════════════════════════════════════════
// AI PROVIDERS — 8 providers
// ⚠️ These keys are visible to anyone who views page source / devtools.
//    For production, proxy these calls through a backend so keys stay secret.
// ══════════════════════════════════════════════════════════════
const AI_PROVIDERS = [
  {
    name: 'GeneralCompute',
    url:  'https://api.generalcompute.com/v1/chat/completions',
    key:  'YOUR_API_KEY_PLACEHOLDER',
    model:'gpt-oss-120b',
    type: 'openai',
  },
  {
    name: 'OpenRouter',
    url:  'https://openrouter.ai/api/v1/chat/completions',
    key:  'YOUR_API_KEY_PLACEHOLDER',
    model:'meta-llama/llama-3.3-70b-instruct',
    type: 'openai',
    extraHeaders: { 'HTTP-Referer': 'https://mkai.tech', 'X-Title': 'MK-AI' },
  },
  {
    name: 'SambaNova',
    url:  'https://api.sambanova.ai/v1/chat/completions',
    key:  'YOUR_API_KEY_PLACEHOLDER',
    model:'Meta-Llama-3.3-70B-Instruct',
    type: 'openai',
  },
   {
    name: 'Groq',
    url: 'https://api.groq.com/openai/v1/chat/completions',
    key: 'YOUR_API_KEY_PLACEHOLDER', // <-- apni Groq API key yaha daal de
    model: 'qwen/qwen3-32b',
    type: 'openai',
  },
  {
    name: 'DeepInfra',
    url:  'https://api.deepinfra.com/v1/openai/chat/completions',
    key:  'YOUR_API_KEY_PLACEHOLDER',
    model:'meta-llama/Llama-3.3-70B-Instruct',
    type: 'openai',
  },
  {
    name: 'Novita',
    url:  'https://api.novita.ai/v3/openai/chat/completions',
    key:  'YOUR_API_KEY_PLACEHOLDER',
    model:'meta-llama/llama-3.3-70b-instruct',
    type: 'openai',
  },
  {
    name: 'Mistral',
    url:  'https://api.mistral.ai/v1/chat/completions',
    key:  'YOUR_API_KEY_PLACEHOLDER',
    model:'mistral-large-latest',
    type: 'openai',
  },
  {
    name: 'Cohere',
    url:  'https://api.cohere.com/v2/chat',
    key:  'YOUR_API_KEY_PLACEHOLDER',
    model:'command-r-plus',
    type: 'cohere',
  },
];

let rrIndex = 0;
const failCounts = Object.fromEntries(AI_PROVIDERS.map(p => [p.name, 0]));
const MAX_FAILS = 3;

function getNextProvider() {
  const total = AI_PROVIDERS.length;
  for (let i = 0; i < total; i++) {
    const p = AI_PROVIDERS[rrIndex % total];
    rrIndex++;
    if (failCounts[p.name] < MAX_FAILS) return p;
  }
  AI_PROVIDERS.forEach(p => { failCounts[p.name] = 0; });
  rrIndex = 0;
  return AI_PROVIDERS[0];
}

async function callProviderOnce(provider, systemPrompt, userPrompt, maxTokens = 4000) {
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user',   content: userPrompt },
  ];

  if (provider.type === 'railway') {
    const res = await fetch(provider.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: provider.model, messages, max_tokens: maxTokens, temperature: 0.7 }),
    });
    if (!res.ok) throw new Error(`Railway HTTP ${res.status}`);
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content || data?.content || data?.text;
    if (!text) throw new Error('Railway empty response');
    return text;
  }

  if (provider.type === 'cohere') {
    const res = await fetch(provider.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${provider.key}` },
      body: JSON.stringify({
        model: provider.model,
        preamble: systemPrompt,
        chat_history: [],
        message: userPrompt,
        max_tokens: maxTokens,
        temperature: 0.7,
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
    body: JSON.stringify({ model: provider.model, messages, max_tokens: maxTokens, temperature: 0.7 }),
  });
  if (!res.ok) throw new Error(`${provider.name} HTTP ${res.status}`);
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error(`${provider.name} empty response`);
  return text;
}

async function callAI(systemPrompt, userPrompt, maxTokens = 4000) {
  const tried = new Set();
  for (let attempt = 0; attempt < AI_PROVIDERS.length; attempt++) {
    const provider = getNextProvider();
    if (tried.has(provider.name)) continue;
    tried.add(provider.name);
    try {
      console.log(`[Hub] Trying ${provider.name}`);
      const text = await callProviderOnce(provider, systemPrompt, userPrompt, maxTokens);
      failCounts[provider.name] = 0;
      return text;
    } catch (err) {
      failCounts[provider.name]++;
      console.warn(`[Hub] ${provider.name} failed: ${err.message}`);
      await new Promise(r => setTimeout(r, 400));
    }
  }
  throw new Error('All AI providers failed. Please try again.');
}

async function callAIJSON(systemPrompt, userPrompt, maxTokens = 4000) {
  const text = await callAI(systemPrompt, userPrompt, maxTokens);
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) { try { return JSON.parse(fence[1].trim()); } catch (_) {} }
  const direct = text.match(/\{[\s\S]*\}/);
  if (direct) { try { return JSON.parse(direct[0]); } catch (_) {} }
  let str = (direct?.[0] || text).trim().replace(/,\s*([}\]])/g, '$1');
  try { return JSON.parse(str); } catch (_) {}
  throw new Error('JSON parse failed');
}

// ══════════════════════════════════════════════════════════════
// THEME — single MK AI liquid-glass theme (emerald / sky-blue / gold accent).
// Dark mode removed — matches Home.jsx / About.jsx / mkaiCore.jsx.
// ══════════════════════════════════════════════════════════════
const THEME = {
  bg:        '#F6FAF7',
  s1:        '#FFFFFF',
  s2:        '#EEF8F2',
  gold:      '#0FA968',
  gold2:     '#13BE79',
  text:      '#122420',
  muted:     '#5C6B64',
  muted2:    '#8A958E',
  border:    'rgba(15,169,104,.16)',
  border2:   'rgba(18,54,42,.08)',
  cardHover: 'rgba(15,169,104,.04)',
  inputBg:   'rgba(15,169,104,.05)',
  headerBg:  'rgba(246,250,247,.92)',
  toastBg:   '#0FA968',
  gridLine:  'rgba(15,169,104,.05)',
  green:     '#16A34A',
  red:       '#DC2626',
  amber:     '#D97706',
  blue:      '#1596D6',
  purple:    '#6366F1',
  pink:      '#E2793D',
  cyan:      '#0EA5E9',
};

// ══════════════════════════════════════════════════════════════
// TOOLS CONFIG
// ══════════════════════════════════════════════════════════════
const TOOLS = [
  { id: 'business',    icon: '📊', label: 'Business Plan',       desc: 'Full AI business plan with PDF export',                color: '#0FA968' },
  { id: 'startup',     icon: '🔮', label: 'Startup Name',        desc: '20 unique name ideas with taglines & domain tips',    color: '#6366F1' },
  { id: 'validator',   icon: '🧬', label: 'Idea Validator',      desc: 'Viability score, market size & competitor check',     color: '#16A34A' },
  { id: 'competitor',  icon: '📈', label: 'Competitor Analyzer', desc: 'SWOT, market position & opportunity gaps',            color: '#0EA5E9' },
  { id: 'brand',       icon: '🌟', label: 'Personal Brand',      desc: 'Bio, tagline, content strategy & roadmap',           color: '#E2793D' },
];

// ══════════════════════════════════════════════════════════════
// STYLES FACTORY
// ══════════════════════════════════════════════════════════════
function buildCss(T) {
  return `
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=Space+Mono:wght@400;700&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:${T.bg};--s1:${T.s1};--s2:${T.s2};
  --gold:${T.gold};--gold2:${T.gold2};
  --text:${T.text};--muted:${T.muted};--muted2:${T.muted2};
  --border:${T.border};--border2:${T.border2};
  --green:${T.green};--red:${T.red};--amber:${T.amber};
  --blue:${T.blue};--purple:${T.purple};--pink:${T.pink};--cyan:${T.cyan};
}
html,body{background:${T.bg};font-family:'Outfit',sans-serif;color:${T.text};min-height:100vh;transition:background .3s,color .3s}
@keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes glow{0%,100%{box-shadow:0 0 0 0 rgba(15,169,104,0)}50%{box-shadow:0 0 20px 3px rgba(15,169,104,.2)}}
@keyframes pulse-export{0%,100%{opacity:1}50%{opacity:.6}}

.wrap{min-height:100vh;background:${T.bg};position:relative;overflow-x:hidden;transition:background .3s}
.grid-bg{position:fixed;inset:0;pointer-events:none;z-index:0;
  background-image:linear-gradient(${T.gridLine} 1px,transparent 1px),linear-gradient(90deg,${T.gridLine} 1px,transparent 1px);
  background-size:60px 60px}
.glow-orb{position:fixed;width:500px;height:500px;border-radius:50%;
  background:radial-gradient(circle,rgba(15,169,104,.06) 0%,transparent 70%);pointer-events:none;z-index:0}

/* HEADER */
.header{position:sticky;top:0;z-index:100;display:flex;align-items:center;justify-content:space-between;
  padding:14px 32px;background:${T.headerBg};backdrop-filter:blur(24px);border-bottom:1px solid ${T.border};transition:background .3s,border-color .3s}
.logo{display:flex;align-items:center;gap:10px}
.logo-icon{width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,${T.gold},${T.blue});
  display:flex;align-items:center;justify-content:center;font-size:18px}
.logo-name{font-size:16px;font-weight:800;background:linear-gradient(135deg,${T.gold},${T.gold2});
  -webkit-background-clip:text;-webkit-text-fill-color:transparent}
.logo-tag{font-size:9px;font-weight:700;letter-spacing:1.5px;color:${T.gold};
  background:${T.inputBg};padding:2px 8px;border-radius:20px;border:1px solid ${T.border}}
.back-btn{background:none;border:1px solid ${T.border2};color:${T.muted2};
  padding:8px 16px;border-radius:8px;cursor:pointer;font-size:13px;font-family:'Outfit',sans-serif;
  transition:all .2s;display:flex;align-items:center;gap:6px}
.back-btn:hover{border-color:${T.gold};color:${T.gold}}

/* MAIN */
.main{max-width:920px;margin:0 auto;padding:36px 20px 80px;position:relative;z-index:1}

/* HUB HOME */
.hub-hero{text-align:center;padding:48px 0 40px;animation:fadeUp .5s ease}
.hub-title{font-size:42px;font-weight:900;letter-spacing:-1.5px;line-height:1.1;margin-bottom:12px;color:${T.text}}
.hub-title span{background:linear-gradient(135deg,${T.gold},${T.blue});-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.hub-sub{font-size:16px;color:${T.muted2};max-width:480px;margin:0 auto;line-height:1.6}
.tools-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:16px;margin-top:40px}
.tool-card{background:${T.s1};border:1px solid ${T.border2};border-radius:18px;padding:24px;
  cursor:pointer;transition:all .25s;animation:fadeUp .4s ease;position:relative;overflow:hidden}
.tool-card:hover{transform:translateY(-3px);border-color:var(--card-color,${T.gold});
  box-shadow:0 12px 32px rgba(15,90,70,.14)}
.tool-card::before{content:'';position:absolute;inset:0;border-radius:18px;
  background:var(--card-color,${T.gold});opacity:0;transition:opacity .25s}
.tool-card:hover::before{opacity:.04}
.tool-icon{font-size:32px;margin-bottom:14px}
.tool-label{font-size:17px;font-weight:800;margin-bottom:6px}
.tool-desc{font-size:12px;color:${T.muted2};line-height:1.6}
.tool-arrow{position:absolute;right:20px;top:50%;transform:translateY(-50%);
  font-size:18px;color:${T.muted};transition:all .25s}
.tool-card:hover .tool-arrow{color:var(--card-color,${T.gold});transform:translateY(-50%) translateX(3px)}

/* TOOL HEADER */
.tool-header{display:flex;align-items:center;gap:14px;margin-bottom:28px;padding-bottom:20px;
  border-bottom:1px solid ${T.border2};animation:fadeUp .3s ease}
.tool-header-icon{width:48px;height:48px;border-radius:14px;display:flex;align-items:center;
  justify-content:center;font-size:22px;flex-shrink:0}
.tool-header-title{font-size:22px;font-weight:800;letter-spacing:-.5px;color:${T.text}}
.tool-header-sub{font-size:13px;color:${T.muted2};margin-top:3px}

/* CARD */
.card{background:${T.s1};border:1px solid ${T.border2};border-radius:20px;padding:28px;
  margin-bottom:18px;animation:fadeUp .4s ease;transition:background .3s,border-color .3s}
.card-title{font-size:18px;font-weight:800;margin-bottom:6px;color:${T.text}}
.card-sub{font-size:13px;color:${T.muted2};margin-bottom:24px;line-height:1.5}

/* FORM */
.field-label{display:block;font-size:11px;font-weight:700;color:${T.muted2};
  letter-spacing:.8px;text-transform:uppercase;margin:18px 0 7px}
.input,.textarea{width:100%;background:${T.inputBg};border:1px solid ${T.border2};
  border-radius:10px;padding:12px 16px;color:${T.text};font-size:14px;
  font-family:'Outfit',sans-serif;outline:none;transition:all .2s}
.input:focus,.textarea:focus{border-color:${T.gold};box-shadow:0 0 0 3px ${T.gold}14}
.textarea{resize:vertical;min-height:90px;line-height:1.6}
.opts{display:flex;flex-wrap:wrap;gap:8px;margin-top:7px}
.opt{padding:7px 14px;border-radius:9px;cursor:pointer;font-size:13px;font-weight:600;
  font-family:'Outfit',sans-serif;transition:all .2s;border:1px solid ${T.border2};
  background:${T.inputBg};color:${T.muted2}}
.opt:hover{border-color:${T.gold};color:${T.gold}}
.opt.sel{background:linear-gradient(135deg,${T.gold},${T.blue});border-color:transparent;color:#fff;font-weight:700}
.opt.sel-green{background:linear-gradient(135deg,${T.green},#059669);border-color:transparent;color:#fff;font-weight:700}
.opt.sel-blue{background:linear-gradient(135deg,${T.purple},${T.blue});border-color:transparent;color:#fff;font-weight:700}
.opt.sel-pink{background:linear-gradient(135deg,${T.pink},#C2620E);border-color:transparent;color:#fff;font-weight:700}
.opt.sel-cyan{background:linear-gradient(135deg,${T.cyan},#0284C7);border-color:transparent;color:#fff;font-weight:700}

/* BUTTONS */
.btn-row{display:flex;gap:10px;margin-top:22px;flex-wrap:wrap}
.btn-primary{flex:1;padding:13px 22px;border-radius:12px;cursor:pointer;font-size:15px;font-weight:700;
  font-family:'Outfit',sans-serif;background:linear-gradient(135deg,${T.gold},${T.blue});
  border:none;color:#fff;transition:all .25s;min-width:160px}
.btn-primary:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 8px 24px ${T.gold}40}
.btn-primary:disabled{opacity:.4;cursor:not-allowed}
.btn-primary.green{background:linear-gradient(135deg,${T.green},#059669);color:#fff}
.btn-primary.blue{background:linear-gradient(135deg,${T.purple},${T.blue});color:#fff}
.btn-primary.pink{background:linear-gradient(135deg,${T.pink},#C2620E);color:#fff}
.btn-primary.cyan{background:linear-gradient(135deg,${T.cyan},#0284C7);color:#fff}
.btn-secondary{padding:12px 20px;border-radius:12px;cursor:pointer;font-size:13px;font-weight:600;
  font-family:'Outfit',sans-serif;background:${T.inputBg};
  border:1px solid ${T.border2};color:${T.text};transition:all .2s}
.btn-secondary:hover{background:${T.cardHover};border-color:${T.border}}
.btn-secondary:disabled{opacity:.4;cursor:not-allowed}

/* EXPORT BUTTONS */
.export-bar{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:20px;padding:16px;
  background:${T.gold}0a;border:1px solid ${T.gold}25;border-radius:14px}
.export-bar-title{font-size:11px;font-weight:700;color:${T.gold};letter-spacing:.8px;
  text-transform:uppercase;margin-bottom:10px;display:flex;align-items:center;gap:6px;width:100%}
.btn-export{display:flex;align-items:center;gap:8px;padding:10px 18px;border-radius:10px;
  cursor:pointer;font-size:13px;font-weight:700;font-family:'Outfit',sans-serif;
  border:none;transition:all .25s;white-space:nowrap}
.btn-export:disabled{opacity:.5;cursor:not-allowed;animation:pulse-export 1.2s infinite}
.btn-export-pdf{background:linear-gradient(135deg,#EF4444,#DC2626);color:#fff}
.btn-export-pdf:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 6px 20px rgba(239,68,68,.4)}
.btn-export-json{background:${T.inputBg};border:1px solid ${T.border2};color:${T.muted2}}
.btn-export-json:hover:not(:disabled){background:${T.cardHover};color:${T.text}}

/* LOADING */
.load-box{display:flex;align-items:center;gap:14px;background:${T.gold}0f;
  border:1px solid ${T.gold}33;border-radius:12px;padding:16px;margin-top:14px}
.spinner{width:22px;height:22px;border:3px solid ${T.gold}33;
  border-top-color:${T.gold};border-radius:50%;animation:spin 1s linear infinite;flex-shrink:0}
.load-text{font-size:14px;font-weight:600;color:${T.gold}}
.load-sub{font-size:12px;color:${T.muted};margin-top:3px}

/* RESULTS */
.section{background:${T.s1};border:1px solid ${T.border2};border-radius:16px;
  padding:22px;margin-bottom:14px;animation:fadeUp .4s ease;transition:background .3s}
.section-title{font-size:15px;font-weight:800;margin-bottom:14px;display:flex;align-items:center;gap:8px;color:${T.text}}
.info-box{border-radius:10px;padding:13px 15px;margin-bottom:10px;border:1px solid}
.info-label{font-size:10px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;margin-bottom:4px}
.info-val{font-size:13px;color:${T.muted2};line-height:1.6}
.sum-box{border-radius:10px;padding:13px 15px;font-size:13px;color:${T.muted2};line-height:1.7;margin-bottom:10px;border:1px solid}
.sub-label{font-size:10px;font-weight:700;color:${T.gold};letter-spacing:.5px;text-transform:uppercase;margin:12px 0 7px}
.sub-item{font-size:13px;color:${T.muted2};padding:2px 0;line-height:1.5}
.tbl-wrap{overflow-x:auto;border-radius:10px;border:1px solid ${T.border2};margin-top:10px}
table{width:100%;border-collapse:collapse;font-size:13px}
th{background:${T.gold}1a;padding:9px 13px;text-align:left;color:${T.gold};font-weight:700;font-size:11px;letter-spacing:.4px}
td{padding:9px 13px;color:${T.muted2};border-bottom:1px solid ${T.border2};vertical-align:top}
tr:last-child td{border-bottom:none}
tr:hover td{background:${T.cardHover}}
.two-col{display:grid;grid-template-columns:1fr 1fr;gap:14px}
@media(max-width:580px){.two-col{grid-template-columns:1fr}}
.name-grid{display:flex;flex-wrap:wrap;gap:8px}
.name-badge{background:${T.gold}1a;border:1px solid ${T.gold}40;
  border-radius:9px;padding:8px 14px;font-weight:700;font-size:13px;
  color:${T.gold2};cursor:pointer;transition:all .2s}
.name-badge:hover{background:${T.gold}30;transform:translateY(-1px)}
.score-box{border-radius:14px;padding:22px;margin-bottom:16px;display:flex;
  gap:20px;align-items:center;flex-wrap:wrap;border:1px solid}
.score-num{font-size:52px;font-weight:900;line-height:1;font-family:'Space Mono',monospace}
.score-right{flex:1;min-width:200px;padding-left:20px;border-left:1px solid ${T.border2}}
.swot-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(195px,1fr));gap:12px}
.swot-box{border:1px solid;border-radius:12px;padding:14px}
.swot-title{font-size:12px;font-weight:700;margin-bottom:9px}
.swot-item{font-size:12px;color:${T.muted2};padding:2px 0;line-height:1.5}
.tag-row{display:flex;flex-wrap:wrap;gap:7px;margin-top:8px}
.tag{background:${T.inputBg};border:1px solid ${T.border2};
  border-radius:20px;padding:4px 12px;font-size:11px;color:${T.muted2}}
.motivation{background:linear-gradient(135deg,${T.gold}14,${T.blue}0f);
  border:1px solid ${T.gold}33;border-radius:14px;padding:24px;text-align:center;margin-top:16px}
.motivation-text{font-size:16px;font-style:italic;line-height:1.8;color:${T.text}}
.motivation-author{color:${T.gold};font-weight:700;margin-top:10px;font-size:13px}
.toast{position:fixed;bottom:24px;right:24px;z-index:9999;background:${T.toastBg};
  color:#fff;padding:11px 20px;border-radius:10px;font-weight:600;font-size:13px;animation:fadeUp .3s ease}

/* WIZARD */
.wizard{display:flex;align-items:center;gap:0;padding:16px 20px;margin-bottom:24px;
  background:${T.s1};border:1px solid ${T.border2};border-radius:14px;overflow-x:auto;scrollbar-width:none}
.wiz-item{display:flex;align-items:center;gap:6px;flex-shrink:0}
.wiz-dot{width:30px;height:30px;border-radius:50%;display:flex;align-items:center;
  justify-content:center;font-size:12px;font-weight:700;transition:all .3s;border:2px solid transparent}
.wiz-dot.done{background:${T.gold};color:#fff;border-color:${T.gold}}
.wiz-dot.active{background:${T.gold}22;color:${T.gold};border-color:${T.gold};animation:glow 2s infinite}
.wiz-dot.pending{background:${T.inputBg};color:${T.muted};border-color:${T.border2}}
.wiz-lbl{font-size:10px;font-weight:600;white-space:nowrap}
.wiz-lbl.done{color:${T.green}}.wiz-lbl.active{color:${T.gold}}.wiz-lbl.pending{color:${T.muted}}
.wiz-line{width:20px;height:2px;margin:0 4px;transition:background .3s;flex-shrink:0}
.wiz-line.done{background:${T.gold}}.wiz-line.pending{background:${T.border2}}
.review-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px;margin-bottom:18px}
.review-item{background:${T.inputBg};border:1px solid ${T.border2};border-radius:10px;padding:11px}
.review-key{font-size:10px;font-weight:700;color:${T.gold};letter-spacing:.4px;text-transform:uppercase}
.review-val{font-size:12px;color:${T.muted2};margin-top:4px;line-height:1.4}
`;
}

// ══════════════════════════════════════════════════════════════
// SHARED HELPERS
// ══════════════════════════════════════════════════════════════
function Section({ title, children }) {
  return <div className="section"><div className="section-title">{title}</div>{children}</div>;
}
function InfoBox({ label, value, color = '#0FA968' }) {
  if (!value) return null;
  return (
    <div className="info-box" style={{ borderColor: color + '33', background: color + '0d' }}>
      <div className="info-label" style={{ color }}>{label}</div>
      <div className="info-val">{value}</div>
    </div>
  );
}
function SubList({ label, items = [] }) {
  if (!items.length) return null;
  return <div><div className="sub-label">{label}</div>{items.map((it, i) => <div key={i} className="sub-item">▸ {it}</div>)}</div>;
}
function SumBox({ accent = '#0FA968', bold, children }) {
  return (
    <div className="sum-box" style={{ background: accent + '0d', borderColor: accent + '33' }}>
      {bold && <b style={{ color: accent }}>{bold} </b>}{children}
    </div>
  );
}
function LoadBox({ text }) {
  return (
    <div className="load-box">
      <div className="spinner" />
      <div><div className="load-text">{text}</div><div className="load-sub">This may take 15–30 seconds...</div></div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// PDF EXPORT
// ══════════════════════════════════════════════════════════════
async function exportToPDF(plan, form, showToast) {
  showToast('⏳ Generating PDF...');
  try {
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
    const W = 210, H = 297, mg = 18, cW = W - mg * 2;
    let y = 0;

    const addPage = () => { doc.addPage(); y = mg; };
    const checkY  = (n = 20) => { if (y + n > H - 14) addPage(); };

    const rect  = (x, ry, w, h, r, g, b) => { doc.setFillColor(r, g, b); doc.rect(x, ry, w, h, 'F'); };
    const text  = (str, x, ty, size = 10, r = 255, g = 255, b = 255, bold = false) => {
      doc.setFontSize(size); doc.setFont('helvetica', bold ? 'bold' : 'normal');
      doc.setTextColor(r, g, b); doc.text(str, x, ty);
    };
    const wrap  = (str, x, ty, maxW, size = 10, r = 148, g = 163, b = 184) => {
      doc.setFontSize(size); doc.setFont('helvetica', 'normal'); doc.setTextColor(r, g, b);
      const lines = doc.splitTextToSize(str || '', maxW); doc.text(lines, x, ty);
      return lines.length * (size * 0.37);
    };
    const label = (str, x, ty, col) => { doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(...col); doc.text(str.toUpperCase(), x, ty); };
    const hRule = (ty) => { doc.setDrawColor(15, 169, 104); doc.setLineWidth(0.3); doc.line(mg, ty, W - mg, ty); };

    // PAGE 1 — COVER
    rect(0, 0, W, H, 3, 5, 8);
    rect(0, 0, W, 52, 15, 10, 0);
    doc.setFillColor(15, 169, 104); doc.rect(0, 0, 4, 52, 'F');
    text('ENTREPRENEUR HUB', mg + 8, 16, 9, 15, 169, 104, true);
    text('AI-POWERED BUSINESS PLAN', mg + 8, 23, 16, 255, 255, 255, true);
    text('Generated by AI · Indian Market Focus', mg + 8, 31, 8, 148, 163, 184);

    const sc = plan.viability_score || 0;
    const scCol = sc >= 70 ? [16, 185, 129] : sc >= 50 ? [245, 158, 11] : [239, 68, 68];
    rect(W - 58, 10, 42, 32, ...scCol.map(c => Math.round(c * 0.25)));
    doc.setDrawColor(...scCol); doc.setLineWidth(0.8); doc.rect(W - 58, 10, 42, 32);
    text(String(sc), W - 44, 29, 22, ...scCol, true);
    text('VIABILITY', W - 54, 38, 7, ...scCol, true);
    text('SCORE / 100', W - 54, 43, 6, 148, 163, 184);
    y = 62;

    doc.setFontSize(18); doc.setFont('helvetica', 'bold'); doc.setTextColor(190, 240, 215);
    const ideaLines = doc.splitTextToSize(form.idea || 'Business Plan', cW);
    doc.text(ideaLines, mg, y); y += ideaLines.length * 7.5 + 4;
    if (form.name) { text(`Prepared for: ${form.name}`, mg, y, 10, 148, 163, 184); y += 7; }
    hRule(y); y += 8;

    if (plan.executive_summary) { label('EXECUTIVE SUMMARY', mg, y, [15, 169, 104]); y += 6; y += wrap(plan.executive_summary, mg, y, cW, 11, 220, 230, 240) + 8; }
    if (plan.viability_feedback) { label('VIABILITY FEEDBACK', mg, y, [...scCol]); y += 6; y += wrap(plan.viability_feedback, mg, y, cW, 10) + 10; }

    if (plan.business_name_suggestions?.length) {
      checkY(30); label('SUGGESTED BUSINESS NAMES', mg, y, [15, 169, 104]); y += 7;
      let nx = mg;
      plan.business_name_suggestions.forEach(nm => {
        const nw = Math.max(doc.getStringUnitWidth(nm) * 10 * 0.35 + 10, 30);
        if (nx + nw > W - mg) { nx = mg; y += 10; }
        rect(nx, y - 6, nw, 9, 0, 25, 15);
        doc.setDrawColor(15, 169, 104, 0.4); doc.rect(nx, y - 6, nw, 9);
        text(nm, nx + 3, y, 9, 90, 220, 165, true); nx += nw + 6;
      }); y += 14;
    }

    hRule(y); y += 8; label('BUSINESS DETAILS', mg, y, [148, 163, 184]); y += 7;
    const details = [['Business Type', form.btype],['Market', form.market],['Location', `${form.location} ${form.city}`.trim()],['Investment', form.investment],['Team', form.team],['Revenue Model', form.revenue]].filter(([, v]) => v);
    const colW = cW / 2;
    details.forEach(([k, v], i) => {
      const cx = mg + (i % 2) * colW; const ry = y + Math.floor(i / 2) * 12; checkY(14);
      text(k + ':', cx, ry, 8, 148, 163, 184, true); text(v.slice(0, 40), cx + 26, ry, 8, 220, 230, 240);
    }); y += Math.ceil(details.length / 2) * 12 + 8;

    // PAGE 2 — SWOT
    if (plan.swot) {
      addPage(); rect(0, 0, W, H, 3, 5, 8); rect(0, 0, W, 14, 15, 10, 0);
      text('SWOT ANALYSIS', mg, 9, 11, 15, 169, 104, true); y = 22;
      const quadrants = [['STRENGTHS', plan.swot.strengths, 16, 185, 129],['WEAKNESSES', plan.swot.weaknesses, 239, 68, 68],['OPPORTUNITIES', plan.swot.opportunities, 99, 102, 241],['THREATS', plan.swot.threats, 245, 158, 11]];
      const qW = cW / 2 - 4, qH = 110;
      quadrants.forEach(([title, items, r, g, b], idx) => {
        const qx = mg + (idx % 2) * (qW + 8); const qy = y + Math.floor(idx / 2) * (qH + 8);
        rect(qx, qy, qW, qH, 5 + r * 0.05, 5 + g * 0.05, 5 + b * 0.05);
        doc.setDrawColor(r, g, b); doc.setLineWidth(0.5); doc.rect(qx, qy, qW, qH);
        doc.setFillColor(r, g, b); doc.rect(qx, qy, qW, 10, 'F');
        text(title, qx + 4, qy + 7, 9, 0, 0, 0, true);
        let iy = qy + 16;
        (items || []).slice(0, 5).forEach(item => {
          const il = doc.splitTextToSize('• ' + item, qW - 6);
          doc.setFontSize(8.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(180, 190, 205);
          doc.text(il, qx + 4, iy); iy += il.length * 4 + 2;
        });
      }); y += 2 * qH + 2 * 8 + 10;
    }

    // PAGE 3 — MARKET & COMPETITORS
    if (plan.market_analysis || plan.competitor_analysis) {
      addPage(); rect(0, 0, W, H, 3, 5, 8); rect(0, 0, W, 14, 15, 10, 0);
      text('MARKET & COMPETITOR ANALYSIS', mg, 9, 11, 15, 169, 104, true); y = 22;
      if (plan.market_analysis) {
        label('MARKET ANALYSIS', mg, y, [14, 165, 233]); y += 7;
        const ma = plan.market_analysis;
        [['Market Size', ma.market_size],['Growth Rate', ma.growth_rate]].filter(([, v]) => v).forEach(([k, v]) => {
          checkY(10); text(k + ': ', mg, y, 9, 14, 165, 233, true);
          doc.setFontSize(9); doc.setFont('h', 'n'); doc.setTextColor(148, 163, 184); doc.text(v || '', mg + 28, y); y += 7;
        });
        if (ma.target_customers?.length) { label('TARGET CUSTOMERS', mg, y, [15, 169, 104]); y += 6; ma.target_customers.forEach(c => { text('• ' + c, mg + 3, y, 9, 148, 163, 184); y += 6; }); }
        if (ma.market_trends?.length) { label('MARKET TRENDS', mg, y + 2, [99, 102, 241]); y += 9; ma.market_trends.forEach(t => { text('▸ ' + t, mg + 3, y, 9, 148, 163, 184); y += 6; }); }
        y += 6;
      }
      if (plan.competitor_analysis) {
        checkY(30); hRule(y); y += 8; label('COMPETITIVE LANDSCAPE', mg, y, [16, 185, 129]); y += 7;
        if (plan.competitor_analysis.competitive_advantage) {
          rect(mg, y - 5, cW, 14, 8, 25, 18); doc.setDrawColor(16, 185, 129, 0.4); doc.rect(mg, y - 5, cW, 14);
          doc.setFillColor(16, 185, 129); doc.rect(mg, y - 5, 3, 14, 'F');
          text('Your Edge: ' + plan.competitor_analysis.competitive_advantage.slice(0, 110), mg + 6, y + 2, 9, 180, 240, 210); y += 18;
        }
        const comps = plan.competitor_analysis.direct_competitors || [];
        if (comps.length) {
          rect(mg, y, cW, 9, 20, 15, 5);
          ['Competitor', 'Strength', 'Weakness'].forEach((h, i) => { text(h, mg + 4 + i * (cW / 3), y + 6, 8, 15, 169, 104, true); }); y += 9;
          comps.slice(0, 6).forEach((c, i) => {
            checkY(12); rect(mg, y, cW, 10, i % 2 ? 8 : 5, i % 2 ? 8 : 6, i % 2 ? 10 : 8);
            text(c.name || '', mg + 4, y + 7, 8, 90, 220, 165, true);
            const cCW = cW / 3 - 6;
            doc.setFontSize(7.5); doc.setFont('h', 'n'); doc.setTextColor(148, 163, 184); doc.text(doc.splitTextToSize(c.strength || '', cCW), mg + 4 + cW / 3, y + 7);
            doc.setTextColor(245, 158, 11); doc.text(doc.splitTextToSize(c.weakness || '', cCW), mg + 4 + 2 * (cW / 3), y + 7); y += 10;
          });
        }
      }
    }

    // PAGE 4 — FINANCIALS
    if (plan.financial_projections) {
      addPage(); rect(0, 0, W, H, 3, 5, 8); rect(0, 0, W, 14, 15, 10, 0);
      text('FINANCIAL PROJECTIONS', mg, 9, 11, 15, 169, 104, true); y = 22;
      const fp = plan.financial_projections;
      if (fp.initial_investment?.breakdown?.length) {
        label('INITIAL INVESTMENT BREAKDOWN', mg, y, [16, 185, 129]); y += 7;
        rect(mg, y, cW, 9, 20, 15, 5); text('Item', mg + 4, y + 6, 8, 15, 169, 104, true); text('Amount', mg + cW - 34, y + 6, 8, 15, 169, 104, true); y += 9;
        fp.initial_investment.breakdown.forEach((item, i) => {
          checkY(10); rect(mg, y, cW, 9, i % 2 ? 7 : 5, i % 2 ? 8 : 6, i % 2 ? 9 : 8);
          text(item.item || '', mg + 4, y + 6, 8, 148, 163, 184); text(item.amount || '', mg + cW - 34, y + 6, 8, 16, 185, 129, true); y += 9;
        });
        rect(mg, y, cW, 10, 20, 18, 5); doc.setDrawColor(15, 169, 104); doc.rect(mg, y, cW, 10);
        text('TOTAL INVESTMENT', mg + 4, y + 7, 9, 15, 169, 104, true); text(fp.initial_investment.total || '', mg + cW - 34, y + 7, 9, 15, 169, 104, true); y += 16;
      }
      if (fp.revenue_projections) {
        checkY(50); hRule(y); y += 8; label('REVENUE PROJECTIONS', mg, y, [16, 185, 129]); y += 8;
        const rev = [['Month 1-3', fp.revenue_projections.month_1_3],['Month 4-6', fp.revenue_projections.month_4_6],['Year 1', fp.revenue_projections.year_1],['Year 2', fp.revenue_projections.year_2],['Year 3', fp.revenue_projections.year_3]].filter(([, v]) => v);
        const rW = cW / rev.length - 3;
        rev.forEach(([period, val], i) => {
          const rx = mg + i * (rW + 3); rect(rx, y, rW, 24, 8, 22, 14); doc.setDrawColor(16, 185, 129, 0.3); doc.rect(rx, y, rW, 24);
          text(period, rx + 3, y + 8, 7, 148, 163, 184, true); text(val || '', rx + 3, y + 18, 9, 16, 185, 129, true);
        }); y += 32;
      }
      if (fp.break_even) { checkY(20); rect(mg, y, cW, 16, 12, 18, 8); doc.setDrawColor(245, 158, 11, 0.5); doc.rect(mg, y, cW, 16); text('BREAK EVEN: ' + (fp.break_even.point || '') + '  |  Monthly Needed: ' + (fp.break_even.monthly_revenue_needed || ''), mg + 6, y + 10, 9, 245, 158, 11, true); y += 22; }
      if (fp.roi) { checkY(16); rect(mg, y, cW, 14, 8, 25, 18); doc.setDrawColor(16, 185, 129); doc.rect(mg, y, cW, 14); text('EXPECTED ROI: ' + fp.roi, mg + 6, y + 9, 10, 16, 185, 129, true); y += 20; }
    }

    // PAGE 5 — ROADMAP
    addPage(); rect(0, 0, W, H, 3, 5, 8); rect(0, 0, W, 14, 15, 10, 0);
    text('ROADMAP & ACTION PLAN', mg, 9, 11, 15, 169, 104, true); y = 22;
    if (plan.roadmap) {
      label('BUSINESS ROADMAP', mg, y, [15, 169, 104]); y += 7;
      const roadmapItems = [['MONTH 1-3', plan.roadmap.month_1_3, 15, 169, 104],['MONTH 3-6', plan.roadmap.month_3_6, 99, 102, 241],['MONTH 6-12', plan.roadmap.month_6_12, 16, 185, 129],['YEAR 2-3', plan.roadmap.year_2_3, 14, 165, 233]].filter(([, tasks]) => tasks?.length);
      roadmapItems.forEach(([period, tasks, r, g, b]) => {
        checkY(20); rect(mg, y - 5, cW, 10, 10, 10, 12); doc.setFillColor(r, g, b); doc.rect(mg, y - 5, 3, 10, 'F');
        text(period, mg + 7, y + 2, 9, r, g, b, true); y += 10;
        (tasks || []).forEach(t => { checkY(7); text('• ' + t, mg + 6, y, 8.5, 148, 163, 184); y += 6; }); y += 4;
      });
    }
    if (plan.first_steps?.length) {
      checkY(30); hRule(y); y += 8; label('FIRST STEPS — START TODAY', mg, y, [16, 185, 129]); y += 8;
      plan.first_steps.forEach((step, i) => {
        checkY(14); doc.setFillColor(15, 169, 104); doc.circle(mg + 5, y - 2, 4, 'F');
        text(String(i + 1), mg + 3.5, y, 9, 255, 255, 255, true);
        y += wrap(step, mg + 13, y - 4, cW - 15, 9, 220, 230, 240) + 6;
      });
    }
    if (plan.funding_options?.government_schemes?.length) {
      checkY(40); hRule(y); y += 8; label('GOVERNMENT SCHEMES', mg, y, [14, 165, 233]); y += 7;
      rect(mg, y, cW, 9, 20, 15, 5);
      ['Scheme', 'Benefit', 'Eligibility'].forEach((h, i) => { text(h, mg + 4 + i * (cW / 3), y + 6, 8, 15, 169, 104, true); }); y += 9;
      plan.funding_options.government_schemes.forEach((s, i) => {
        checkY(10); rect(mg, y, cW, 9, i % 2 ? 7 : 5, i % 2 ? 8 : 6, i % 2 ? 10 : 8);
        text(s.scheme || '', mg + 4, y + 6, 8, 15, 169, 104, true); text(s.benefit || '', mg + 4 + cW / 3, y + 6, 8, 16, 185, 129); text(s.eligibility || '', mg + 4 + 2 * (cW / 3), y + 6, 8, 148, 163, 184); y += 9;
      }); y += 6;
    }
    if (plan.motivation) {
      checkY(28); rect(mg, y, cW, 24, 0, 25, 15); doc.setDrawColor(15, 169, 104, 0.3); doc.rect(mg, y, cW, 24);
      wrap('"' + plan.motivation + '"', mg + 8, y + 9, cW - 16, 9.5, 190, 240, 215);
      text('— Entrepreneur Hub 🔥 | ' + (form.name || ''), mg + 8, y + 20, 8, 15, 169, 104, true);
    }

    const totalPages = doc.internal.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p); rect(0, H - 10, W, 10, 6, 4, 2);
      text('Entrepreneur Hub · AI Business Plan', mg, H - 4, 7, 15, 169, 104, true);
      doc.setTextColor(148, 163, 184); doc.setFontSize(7); doc.text(`Page ${p} / ${totalPages}`, W - mg, H - 4, { align: 'right' });
    }

    const safeName = (form.idea || 'business_plan').slice(0, 30).replace(/[^a-z0-9]/gi, '_');
    doc.save(`${safeName}_business_plan.pdf`);
    showToast('✅ PDF downloaded!');
  } catch (err) { console.error(err); showToast('❌ PDF failed. Try again.'); }
}

// ══════════════════════════════════════════════════════════════
// TOOL 1 — BUSINESS PLAN
// ══════════════════════════════════════════════════════════════
const BP_STEPS = [
  { id: 0, label: 'Basic', icon: '👤' }, { id: 1, label: 'Business', icon: '🏢' },
  { id: 2, label: 'Market', icon: '🎯' }, { id: 3, label: 'Resources', icon: '💰' },
  { id: 4, label: 'Strategy', icon: '⭐' }, { id: 5, label: 'Generate', icon: '🚀' },
];
const BTYPES    = ['Product based','Service based','Online/Digital','Retail/Shop','Manufacturing','Food/Restaurant','Tech Startup','Other'];
const MARKETS   = ['B2C (Direct to customers)','B2B (Business to business)','Both B2C and B2B'];
const LOCS      = ['Tier 1 City (Mumbai/Delhi/Bangalore)','Tier 2 City (Jaipur/Lucknow/Pune)','Tier 3 City/Town','Pan India','Online only'];
const INVESTS   = ['Under ₹1 Lakh','₹1–5 Lakh','₹5–25 Lakh','₹25 Lakh – 1 Crore','Above ₹1 Crore'];
const TEAMS     = ['Solo founder','2–3 co-founders','Small team (4–10)','Solo, planning to hire'];
const REVENUES  = ['One-time purchase','Subscription','Commission/Marketplace','Freemium','Advertisement','Mixed'];
const EXPS      = ['Yes, have experience','No experience','Some experience','Experience in other field'];
const BP_TABS   = [{ id: 'overview', label: '📊 Overview' },{ id: 'market', label: '🎯 Market' },{ id: 'finance', label: '💰 Finance' },{ id: 'marketing', label: '📢 Marketing' },{ id: 'roadmap', label: '🗺️ Roadmap' }];

function bpPrompt(f) {
  return `Create a comprehensive business plan for an Indian entrepreneur.
Idea: ${f.idea}, Name: ${f.name}, Type: ${f.btype}, Market: ${f.market},
Location: ${f.location} ${f.city}, Investment: ${f.investment},
Experience: ${f.experience}, Team: ${f.team}, USP: ${f.usp}, Revenue: ${f.revenue}.
Return ONLY valid JSON:
{"business_name_suggestions":["Name1","Name2","Name3","Name4","Name5"],
"executive_summary":"2-3 sentence overview",
"viability_score":75,
"viability_feedback":"detailed feedback",
"swot":{"strengths":["S1","S2","S3"],"weaknesses":["W1","W2","W3"],"opportunities":["O1","O2","O3"],"threats":["T1","T2","T3"]},
"market_analysis":{"market_size":"size with numbers","growth_rate":"rate","target_customers":["C1","C2","C3"],"market_trends":["T1","T2","T3"]},
"competitor_analysis":{"direct_competitors":[{"name":"Name","strength":"strength","weakness":"weakness"}],"competitive_advantage":"your edge"},
"financial_projections":{"initial_investment":{"breakdown":[{"item":"item","amount":"₹X"}],"total":"₹X"},"revenue_projections":{"month_1_3":"₹X-Y","month_4_6":"₹X-Y","year_1":"₹X","year_2":"₹X","year_3":"₹X"},"break_even":{"point":"X months","monthly_revenue_needed":"₹X"},"roi":"X%"},
"marketing_strategy":{"first_100_customers":"strategy","digital_marketing":["S1","S2","S3"],"social_media":{"platforms":["Instagram"],"budget":"₹X"},"customer_acquisition_cost":"₹X"},
"operations_plan":{"team_structure":["R1","R2"],"technology_needed":["T1","T2"],"hiring_plan":"plan"},
"legal_requirements":{"business_registration":["type"],"licenses_needed":["L1","L2"],"gst_registration":"details"},
"funding_options":{"bootstrap":"strategy","government_schemes":[{"scheme":"Startup India","benefit":"Tax exemption","eligibility":"DPIIT registered"},{"scheme":"Mudra Loan","benefit":"Up to ₹10L","eligibility":"Small business"}]},
"roadmap":{"month_1_3":["T1","T2","T3"],"month_3_6":["T1","T2"],"month_6_12":["T1","T2"],"year_2_3":["G1","G2"]},
"risk_analysis":{"risks":[{"risk":"Risk","probability":"High","mitigation":"How"}]},
"india_specific":{"india_opportunity":"why India is great now","tier_2_3_potential":"tier 2/3 opportunity","digital_india":"digital India benefit"},
"first_steps":["Step 1 today","Step 2 this week","Step 3 this month"],
"motivation":"personalized motivational message for ${f.name}"}`;
}

function BusinessPlan({ showToast, T }) {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState(null);
  const [tab, setTab] = useState('overview');
  const [exporting, setExporting] = useState(null);
  const [form, setForm] = useState({ name:'', idea:'', btype:'', market:'', location:'', city:'', investment:'', experience:'', team:'', usp:'', revenue:'' });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const generate = async () => {
    setLoading(true); setPlan(null);
    try {
      const result = await callAIJSON(
        'You are an expert Indian business consultant. Return ONLY valid JSON — no markdown, no backticks.',
        bpPrompt(form), 8000
      );
      setPlan(result); setTab('overview');
      showToast('✅ Business plan ready!');
    } catch (e) { showToast('❌ Error. Please try again.'); }
    setLoading(false);
  };

  const sc = plan?.viability_score || 0;
  const scColor = sc >= 70 ? T.green : sc >= 50 ? T.amber : T.red;

  if (plan) return (
    <div style={{ animation: 'fadeUp .5s ease' }}>
      <div className="export-bar">
        <div className="export-bar-title">⬇️ Export Your Business Plan</div>
        <button className="btn-export btn-export-pdf" disabled={exporting !== null}
          onClick={async () => { setExporting('pdf'); await exportToPDF(plan, form, showToast); setExporting(null); }}>
          {exporting === 'pdf' ? '⏳ Generating...' : '📄 Download PDF'}
        </button>
        <button className="btn-export btn-export-json" disabled={exporting !== null}
          onClick={() => { navigator.clipboard.writeText(JSON.stringify(plan, null, 2)); showToast('📋 JSON copied!'); }}>
          📋 Copy JSON
        </button>
        <button className="btn-export btn-export-json" disabled={exporting !== null} onClick={() => setPlan(null)}>← New Plan</button>
      </div>

      <div className="score-box" style={{ background: scColor + '12', borderColor: scColor + '35' }}>
        <div style={{ textAlign: 'center', minWidth: 90 }}>
          <div className="score-num" style={{ color: scColor }}>{sc}</div>
          <div style={{ fontSize: 10, color: T.muted, marginTop: 4 }}>VIABILITY / 100</div>
        </div>
        <div className="score-right">
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6, color: T.text }}>{form.idea.slice(0, 60)}</div>
          <div style={{ fontSize: 13, color: T.muted2, lineHeight: 1.6 }}>{plan.viability_feedback}</div>
        </div>
      </div>

      {plan.business_name_suggestions?.length > 0 && (
        <Section title="💡 Name Suggestions">
          <div className="name-grid">
            {plan.business_name_suggestions.map((n, i) => (
              <div key={i} className="name-badge" onClick={() => { navigator.clipboard.writeText(n); showToast(`"${n}" copied!`); }}>{n}</div>
            ))}
          </div>
          <div style={{ fontSize: 11, color: T.muted, marginTop: 6 }}>Click to copy</div>
        </Section>
      )}
      {plan.executive_summary && <Section title="📋 Executive Summary"><SumBox accent={T.gold}>{plan.executive_summary}</SumBox></Section>}

      <div className="opts" style={{ marginBottom: 16 }}>
        {BP_TABS.map(t => <button key={t.id} className={`opt ${tab === t.id ? 'sel' : ''}`} onClick={() => setTab(t.id)}>{t.label}</button>)}
      </div>

      {tab === 'overview' && plan.swot && (
        <Section title="⚡ SWOT Analysis">
          <div className="swot-grid">
            {[['💪 Strengths', plan.swot.strengths, T.green], ['😰 Weaknesses', plan.swot.weaknesses, T.red],
              ['🌟 Opportunities', plan.swot.opportunities, T.purple], ['⚠️ Threats', plan.swot.threats, T.amber]]
              .map(([title, items, color]) => (
                <div key={title} className="swot-box" style={{ borderColor: color + '40', background: color + '0a' }}>
                  <div className="swot-title" style={{ color }}>{title}</div>
                  {(items || []).map((it, i) => <div key={i} className="swot-item">• {it}</div>)}
                </div>
              ))}
          </div>
        </Section>
      )}

      {tab === 'market' && plan.market_analysis && (
        <>
          <Section title="📊 Market Analysis">
            <div className="two-col">
              <InfoBox label="Market Size" value={plan.market_analysis.market_size} color={T.cyan} />
              <InfoBox label="Growth Rate" value={plan.market_analysis.growth_rate} color={T.green} />
            </div>
            <SubList label="Target Customers" items={plan.market_analysis.target_customers} />
            <SubList label="Market Trends" items={plan.market_analysis.market_trends} />
          </Section>
          {plan.competitor_analysis && (
            <Section title="🔍 Competitors">
              {plan.competitor_analysis.competitive_advantage && <SumBox accent={T.green} bold="Your Edge:">{plan.competitor_analysis.competitive_advantage}</SumBox>}
              {plan.competitor_analysis.direct_competitors?.length > 0 && (
                <div className="tbl-wrap"><table>
                  <thead><tr>{['Competitor','Strength','Weakness'].map(h => <th key={h}>{h}</th>)}</tr></thead>
                  <tbody>{plan.competitor_analysis.direct_competitors.map((c, i) => (
                    <tr key={i}><td style={{ color: T.gold, fontWeight: 600 }}>{c.name}</td><td>{c.strength}</td><td style={{ color: T.amber }}>{c.weakness}</td></tr>
                  ))}</tbody>
                </table></div>
              )}
            </Section>
          )}
        </>
      )}

      {tab === 'finance' && plan.financial_projections && (
        <>
          <Section title="💰 Investment Breakdown">
            <div className="tbl-wrap"><table>
              <thead><tr><th>Item</th><th>Amount</th></tr></thead>
              <tbody>
                {(plan.financial_projections.initial_investment?.breakdown || []).map((item, i) => (
                  <tr key={i}><td>{item.item}</td><td style={{ color: T.green, fontWeight: 700 }}>{item.amount}</td></tr>
                ))}
                <tr style={{ background: T.gold + '12' }}>
                  <td style={{ color: T.gold, fontWeight: 700 }}>TOTAL</td>
                  <td style={{ color: T.gold, fontWeight: 700 }}>{plan.financial_projections.initial_investment?.total}</td>
                </tr>
              </tbody>
            </table></div>
          </Section>
          <Section title="📈 Revenue Projections">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(110px,1fr))', gap: 10 }}>
              {[['Mo 1-3', plan.financial_projections.revenue_projections?.month_1_3],['Mo 4-6', plan.financial_projections.revenue_projections?.month_4_6],['Year 1', plan.financial_projections.revenue_projections?.year_1],['Year 2', plan.financial_projections.revenue_projections?.year_2],['Year 3', plan.financial_projections.revenue_projections?.year_3]]
                .filter(([, v]) => v).map(([p, v]) => (
                  <div key={p} style={{ background: T.green + '0f', border: `1px solid ${T.green}2e`, borderRadius: 10, padding: 12, textAlign: 'center' }}>
                    <div style={{ fontSize: 10, color: T.muted, fontWeight: 600 }}>{p}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: T.green, marginTop: 5 }}>{v}</div>
                  </div>
                ))}
            </div>
            {plan.financial_projections.break_even && <SumBox accent={T.amber} bold="Break Even:" style={{ marginTop: 12 }}>{plan.financial_projections.break_even.point} | Monthly needed: {plan.financial_projections.break_even.monthly_revenue_needed}</SumBox>}
            {plan.financial_projections.roi && <SumBox accent={T.green} bold="Expected ROI:">{plan.financial_projections.roi}</SumBox>}
          </Section>
        </>
      )}

      {tab === 'marketing' && plan.marketing_strategy && (
        <Section title="📢 Marketing Strategy">
          {plan.marketing_strategy.first_100_customers && <SumBox accent={T.gold} bold="🎯 First 100 Customers:">{plan.marketing_strategy.first_100_customers}</SumBox>}
          {plan.marketing_strategy.customer_acquisition_cost && <SumBox accent={T.green} bold="💵 CAC:">{plan.marketing_strategy.customer_acquisition_cost}</SumBox>}
          <SubList label="Digital Marketing" items={plan.marketing_strategy.digital_marketing} />
          {plan.marketing_strategy.social_media && <SumBox accent={T.purple} bold="📱 Social Media:">{(plan.marketing_strategy.social_media.platforms || []).join(', ')} | Budget: {plan.marketing_strategy.social_media.budget}</SumBox>}
        </Section>
      )}

      {tab === 'roadmap' && (
        <>
          {plan.roadmap && (
            <Section title="🗺️ Roadmap">
              <div className="tbl-wrap"><table>
                <thead><tr><th>Timeline</th><th>Goals</th></tr></thead>
                <tbody>
                  {[['Month 1-3', plan.roadmap.month_1_3],['Month 3-6', plan.roadmap.month_3_6],['Month 6-12', plan.roadmap.month_6_12],['Year 2-3', plan.roadmap.year_2_3]]
                    .filter(([, t]) => t?.length).map(([period, tasks]) => (
                      <tr key={period}><td style={{ color: T.gold, fontWeight: 700, whiteSpace: 'nowrap' }}>{period}</td>
                        <td>{tasks.map((t, i) => <div key={i}>• {t}</div>)}</td></tr>
                    ))}
                </tbody>
              </table></div>
            </Section>
          )}
          {plan.first_steps?.length > 0 && (
            <Section title="👣 First Steps — Start Today!">
              {plan.first_steps.map((s, i) => (
                <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '10px 0', borderBottom: '1px solid var(--border2)' }}>
                  <div style={{ background: `linear-gradient(135deg,${T.gold},${T.blue})`, width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12, color: '#fff', flexShrink: 0 }}>{i + 1}</div>
                  <div style={{ fontSize: 14, color: T.muted2, lineHeight: 1.6 }}>{s}</div>
                </div>
              ))}
            </Section>
          )}
          {plan.funding_options?.government_schemes?.length > 0 && (
            <Section title="🏛️ Government Schemes">
              <div className="tbl-wrap"><table>
                <thead><tr>{['Scheme','Benefit','Eligibility'].map(h => <th key={h}>{h}</th>)}</tr></thead>
                <tbody>{plan.funding_options.government_schemes.map((s, i) => (
                  <tr key={i}><td style={{ color: T.gold, fontWeight: 600 }}>{s.scheme}</td><td style={{ color: T.green }}>{s.benefit}</td><td>{s.eligibility}</td></tr>
                ))}</tbody>
              </table></div>
            </Section>
          )}
          {plan.motivation && <div className="motivation"><div className="motivation-text">"{plan.motivation}"</div><div className="motivation-author">— Entrepreneur Hub 🔥 | {form.name}</div></div>}
        </>
      )}
    </div>
  );

  return (
    <>
      <div className="wizard">
        {BP_STEPS.map((s, i) => (
          <div key={i} className="wiz-item">
            <div className={`wiz-dot ${i < step ? 'done' : i === step ? 'active' : 'pending'}`}>{i < step ? '✓' : s.icon}</div>
            <span className={`wiz-lbl ${i < step ? 'done' : i === step ? 'active' : 'pending'}`}>{s.label}</span>
            {i < BP_STEPS.length - 1 && <div className={`wiz-line ${i < step ? 'done' : 'pending'}`} />}
          </div>
        ))}
      </div>
      <div className="card">
        {step === 0 && (<>
          <div className="card-title">👤 Basic Information</div>
          <div className="card-sub">Tell us about yourself and your business idea</div>
          <label className="field-label">Your Name</label>
          <input className="input" placeholder="e.g. John Doe " value={form.name} onChange={e => set('name', e.target.value)} />
          <label className="field-label">Business Idea</label>
          <textarea className="textarea" placeholder="Describe your business idea in detail..." value={form.idea} onChange={e => set('idea', e.target.value)} />
        </>)}
        {step === 1 && (<>
          <div className="card-title">🏢 Business Type</div>
          <div className="card-sub">What kind of business is this?</div>
          <label className="field-label">Business Type</label>
          <div className="opts">{BTYPES.map(t => <button key={t} className={`opt ${form.btype === t ? 'sel' : ''}`} onClick={() => set('btype', t)}>{t}</button>)}</div>
          <label className="field-label">Revenue Model</label>
          <div className="opts">{REVENUES.map(r => <button key={r} className={`opt ${form.revenue === r ? 'sel-green' : ''}`} onClick={() => set('revenue', r)}>{r}</button>)}</div>
        </>)}
        {step === 2 && (<>
          <div className="card-title">🎯 Market & Location</div>
          <div className="card-sub">Who are you selling to and where?</div>
          <label className="field-label">Target Market</label>
          <div className="opts">{MARKETS.map(m => <button key={m} className={`opt ${form.market === m ? 'sel' : ''}`} onClick={() => set('market', m)}>{m}</button>)}</div>
          <label className="field-label">Location</label>
          <div className="opts">{LOCS.map(l => <button key={l} className={`opt ${form.location === l ? 'sel-blue' : ''}`} onClick={() => set('location', l)}>{l}</button>)}</div>
          <label className="field-label">City / State</label>
          <input className="input" placeholder="e.g. Delhi, Maharashtra..." value={form.city} onChange={e => set('city', e.target.value)} />
        </>)}
        {step === 3 && (<>
          <div className="card-title">💰 Investment & Team</div>
          <div className="card-sub">What resources do you have?</div>
          <label className="field-label">Investment Budget</label>
          <div className="opts">{INVESTS.map(inv => <button key={inv} className={`opt ${form.investment === inv ? 'sel-green' : ''}`} onClick={() => set('investment', inv)}>{inv}</button>)}</div>
          <label className="field-label">Team</label>
          <div className="opts">{TEAMS.map(t => <button key={t} className={`opt ${form.team === t ? 'sel' : ''}`} onClick={() => set('team', t)}>{t}</button>)}</div>
          <label className="field-label">Experience</label>
          <div className="opts">{EXPS.map(e => <button key={e} className={`opt ${form.experience === e ? 'sel-blue' : ''}`} onClick={() => set('experience', e)}>{e}</button>)}</div>
        </>)}
        {step === 4 && (<>
          <div className="card-title">⭐ Your USP</div>
          <div className="card-sub">What makes you different from competitors?</div>
          <label className="field-label">Unique Selling Proposition</label>
          <textarea className="textarea" style={{ minHeight: 110 }} placeholder="e.g. AI-powered, 70% cheaper, Hindi language support, offline-first..." value={form.usp} onChange={e => set('usp', e.target.value)} />
        </>)}
        {step === 5 && (<>
          <div className="card-title">🚀 Review & Generate</div>
          <div className="card-sub">Confirm your details before generating</div>
          <div className="review-grid">
            {[['Name', form.name],['Idea', form.idea],['Type', form.btype],['Market', form.market],['Location', form.location],['Investment', form.investment],['Team', form.team],['USP', form.usp]]
              .filter(([, v]) => v).map(([k, v]) => (
                <div key={k} className="review-item">
                  <div className="review-key">{k}</div>
                  <div className="review-val">{v.length > 70 ? v.slice(0, 70) + '…' : v}</div>
                </div>
              ))}
          </div>
          {loading && <LoadBox text="🧠 AI is building your comprehensive business plan..." />}
        </>)}
        <div className="btn-row">
          {step > 0 && <button className="btn-secondary" onClick={() => setStep(s => s - 1)}>← Back</button>}
          {step < 5 && <button className="btn-primary" disabled={step === 0 && (!form.name.trim() || !form.idea.trim())} onClick={() => setStep(s => s + 1)}>Next →</button>}
          {step === 5 && <button className="btn-primary green" disabled={loading} onClick={generate}>{loading ? '⏳ Generating...' : '🚀 Generate Plan'}</button>}
        </div>
      </div>
    </>
  );
}

// ══════════════════════════════════════════════════════════════
// TOOL 2 — STARTUP NAME GENERATOR
// ══════════════════════════════════════════════════════════════
function StartupNames({ showToast, T }) {
  const [form, setForm] = useState({ industry: '', desc: '', style: '', audience: '' });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const STYLES    = ['Modern & Tech','Fun & Playful','Professional','Hindi/Desi','Short & Punchy','Descriptive'];
  const AUDIENCES = ['Youth (18-30)','Professionals','SMBs','Enterprise','General Public','Students'];

  const generate = async () => {
    setLoading(true); setResult(null);
    try {
      const data = await callAIJSON(
        'You are a creative brand naming expert for Indian startups. Return ONLY valid JSON.',
        `Generate 20 startup name ideas for:
Industry: ${form.industry}, Description: ${form.desc}, Style: ${form.style}, Audience: ${form.audience}
Return JSON: {"names":[{"name":"Name","tagline":"Short tagline","meaning":"Why this name works","domain_tip":"domain suggestion"}],"top_3":["Name1","Name2","Name3"],"naming_insight":"key insight about naming in this industry"}`
      );
      setResult(data); showToast('✅ Names generated!');
    } catch (e) { showToast('❌ Error. Try again.'); }
    setLoading(false);
  };

  return (
    <>
      {!result ? (
        <div className="card">
          <div className="card-title">🔮 Startup Name Generator</div>
          <div className="card-sub">Get 20 unique name ideas with taglines, meaning and domain tips</div>
          <label className="field-label">Industry / Niche</label>
          <input className="input" placeholder="e.g. EdTech, Food Delivery, FinTech, SaaS..." value={form.industry} onChange={e => set('industry', e.target.value)} />
          <label className="field-label">What does your startup do?</label>
          <textarea className="textarea" placeholder="Briefly describe what problem you solve and for whom..." value={form.desc} onChange={e => set('desc', e.target.value)} />
          <label className="field-label">Naming Style</label>
          <div className="opts">{STYLES.map(s => <button key={s} className={`opt ${form.style === s ? 'sel' : ''}`} onClick={() => set('style', s)}>{s}</button>)}</div>
          <label className="field-label">Target Audience</label>
          <div className="opts">{AUDIENCES.map(a => <button key={a} className={`opt ${form.audience === a ? 'sel-blue' : ''}`} onClick={() => set('audience', a)}>{a}</button>)}</div>
          {loading && <LoadBox text="🧠 Generating 20 creative names..." />}
          <div className="btn-row">
            <button className="btn-primary blue" disabled={loading || !form.industry.trim()} onClick={generate}>{loading ? '⏳ Generating...' : '🔮 Generate Names'}</button>
          </div>
        </div>
      ) : (
        <div>
          <div className="btn-row" style={{ marginBottom: 20 }}>
            <button className="btn-secondary" onClick={() => setResult(null)}>← Generate New</button>
          </div>
          {result.naming_insight && <SumBox accent={T.purple} bold="💡 Naming Insight:">{result.naming_insight}</SumBox>}
          {result.top_3?.length > 0 && (
            <Section title="🏆 Top 3 Picks">
              <div className="name-grid">
                {result.top_3.map((n, i) => (
                  <div key={i} className="name-badge" style={{ fontSize: 16, padding: '12px 20px', background: T.purple + '22', borderColor: T.purple + '44', color: T.purple }}
                    onClick={() => { navigator.clipboard.writeText(n); showToast(`"${n}" copied!`); }}>
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'} {n}
                  </div>
                ))}
              </div>
            </Section>
          )}
          <Section title="📋 All 20 Name Ideas">
            <div className="tbl-wrap"><table>
              <thead><tr>{['Name','Tagline','Why It Works','Domain Tip'].map(h => <th key={h}>{h}</th>)}</tr></thead>
              <tbody>{(result.names || []).map((n, i) => (
                <tr key={i} style={{ cursor: 'pointer' }} onClick={() => { navigator.clipboard.writeText(n.name); showToast(`"${n.name}" copied!`); }}>
                  <td style={{ color: T.purple, fontWeight: 700 }}>{n.name}</td>
                  <td style={{ color: T.gold }}>{n.tagline}</td>
                  <td>{n.meaning}</td>
                  <td style={{ color: T.green, fontSize: 12 }}>{n.domain_tip}</td>
                </tr>
              ))}</tbody>
            </table></div>
            <div style={{ fontSize: 11, color: T.muted, marginTop: 8 }}>Click any row to copy the name</div>
          </Section>
        </div>
      )}
    </>
  );
}

// ══════════════════════════════════════════════════════════════
// TOOL 3 — IDEA VALIDATOR
// ══════════════════════════════════════════════════════════════
function IdeaValidator({ showToast, T }) {
  const [form, setForm] = useState({ idea: '', market: '', investment: '', experience: '' });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const generate = async () => {
    setLoading(true); setResult(null);
    try {
      const data = await callAIJSON(
        'You are an expert startup advisor for the Indian market. Return ONLY valid JSON.',
        `Validate this business idea for the Indian market:
Idea: ${form.idea}, Market: ${form.market}, Investment: ${form.investment}, Experience: ${form.experience}
Return JSON: {"viability_score":75,"verdict":"GO/WAIT/STOP","verdict_reason":"2-3 sentence reason","market_size_india":"estimated market size","problem_validation":"is this a real problem? how strong?","competition_level":"Low/Medium/High","competition_detail":"competitor landscape","timing":"Is now a good time?","strengths":["S1","S2","S3"],"risks":["R1","R2","R3"],"suggestions":["Improve by doing X","Consider Y angle","Test Z first"],"mvp_idea":"simplest way to test this idea in 30 days","verdict_color":"green/yellow/red"}`
      );
      setResult(data); showToast('✅ Validation complete!');
    } catch (e) { showToast('❌ Error. Try again.'); }
    setLoading(false);
  };

  const vColorMap = { green: T.green, yellow: T.amber, red: T.red };

  return (
    <>
      {!result ? (
        <div className="card">
          <div className="card-title">🧬 Idea Validator</div>
          <div className="card-sub">Get a viability score, market size estimate and competitor check</div>
          <label className="field-label">Your Business Idea</label>
          <textarea className="textarea" placeholder="Describe your idea in detail — what problem does it solve, how, and for whom?" value={form.idea} onChange={e => set('idea', e.target.value)} />
          <label className="field-label">Target Market</label>
          <input className="input" placeholder="e.g. College students, Small shop owners, Working professionals..." value={form.market} onChange={e => set('market', e.target.value)} />
          <label className="field-label">Available Investment</label>
          <div className="opts">{['Under ₹1L','₹1-5L','₹5-25L','₹25L-1Cr','Above ₹1Cr'].map(i => (
            <button key={i} className={`opt ${form.investment === i ? 'sel-green' : ''}`} onClick={() => set('investment', i)}>{i}</button>
          ))}</div>
          <label className="field-label">Your Experience in This Field</label>
          <div className="opts">{['Expert','Some Experience','No Experience'].map(e => (
            <button key={e} className={`opt ${form.experience === e ? 'sel-blue' : ''}`} onClick={() => set('experience', e)}>{e}</button>
          ))}</div>
          {loading && <LoadBox text="🧬 Analyzing your idea against the Indian market..." />}
          <div className="btn-row">
            <button className="btn-primary green" disabled={loading || !form.idea.trim()} onClick={generate}>{loading ? '⏳ Analyzing...' : '🧬 Validate Idea'}</button>
          </div>
        </div>
      ) : (
        <div>
          <div className="btn-row" style={{ marginBottom: 20 }}>
            <button className="btn-secondary" onClick={() => setResult(null)}>← Validate New Idea</button>
          </div>
          {(() => {
            const col = vColorMap[result.verdict_color] || T.green;
            return (
              <div className="score-box" style={{ background: col + '12', borderColor: col + '35' }}>
                <div style={{ textAlign: 'center', minWidth: 100 }}>
                  <div className="score-num" style={{ color: col }}>{result.viability_score}</div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: col, marginTop: 4, letterSpacing: 1 }}>{result.verdict}</div>
                  <div style={{ fontSize: 10, color: T.muted, marginTop: 2 }}>VIABILITY</div>
                </div>
                <div className="score-right">
                  <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6, color: T.text }}>{form.idea.slice(0, 60)}</div>
                  <div style={{ fontSize: 13, color: T.muted2, lineHeight: 1.6 }}>{result.verdict_reason}</div>
                </div>
              </div>
            );
          })()}
          <div className="two-col">
            <Section title="📊 Key Metrics">
              <InfoBox label="Market Size in India" value={result.market_size_india} color={T.cyan} />
              <InfoBox label="Competition Level" value={result.competition_level} color={result.competition_level === 'Low' ? T.green : result.competition_level === 'Medium' ? T.amber : T.red} />
              <InfoBox label="Timing" value={result.timing} color={T.purple} />
              <InfoBox label="Problem Validation" value={result.problem_validation} color={T.gold} />
            </Section>
            <Section title="🔍 Competition"><SumBox accent={T.cyan}>{result.competition_detail}</SumBox></Section>
          </div>
          <Section title="⚡ Strengths & Risks">
            <div className="two-col">
              <div><SubList label="✅ Strengths" items={result.strengths} /></div>
              <div><SubList label="⚠️ Risks" items={result.risks} /></div>
            </div>
          </Section>
          <Section title="💡 Suggestions to Improve">
            {(result.suggestions || []).map((s, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border2)' }}>
                <span style={{ color: T.gold, fontWeight: 700 }}>{i + 1}.</span>
                <span style={{ fontSize: 13, color: T.muted2 }}>{s}</span>
              </div>
            ))}
          </Section>
          {result.mvp_idea && <SumBox accent={T.green} bold="🚀 30-Day MVP Test:">{result.mvp_idea}</SumBox>}
        </div>
      )}
    </>
  );
}

// ══════════════════════════════════════════════════════════════
// TOOL 4 — COMPETITOR ANALYZER
// ══════════════════════════════════════════════════════════════
function CompetitorAnalyzer({ showToast, T }) {
  const [form, setForm] = useState({ company: '', industry: '', yourIdea: '' });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const generate = async () => {
    setLoading(true); setResult(null);
    try {
      const data = await callAIJSON(
        'You are an expert competitive intelligence analyst for Indian markets. Return ONLY valid JSON.',
        `Analyze competitors for this Indian business context:
Company/Competitor to Analyze: ${form.company}
Industry: ${form.industry}
My Business Idea: ${form.yourIdea}
Return JSON: {"company_overview":"2-3 sentence overview of the competitor","swot":{"strengths":["S1","S2","S3"],"weaknesses":["W1","W2","W3"],"opportunities":["O1","O2","O3"],"threats":["T1","T2","T3"]},"market_position":"their position in Indian market","pricing_strategy":"how they price","target_segment":"who they target","revenue_estimate":"estimated revenue/funding","key_features":["F1","F2","F3"],"what_they_do_well":["WD1","WD2","WD3"],"where_they_fail":["WF1","WF2","WF3"],"opportunity_gaps":["OG1 - how to exploit","OG2 - how to exploit","OG3 - how to exploit"],"your_differentiation":["Diff1","Diff2","Diff3"],"strategy_to_beat":"specific strategy to compete against them in India"}`
      );
      setResult(data); showToast('✅ Analysis complete!');
    } catch (e) { showToast('❌ Error. Try again.'); }
    setLoading(false);
  };

  return (
    <>
      {!result ? (
        <div className="card">
          <div className="card-title">📈 Competitor Analyzer</div>
          <div className="card-sub">Get full SWOT, market position, opportunity gaps and strategy to beat them</div>
          <label className="field-label">Competitor Name</label>
          <input className="input" placeholder="e.g. Zomato, BYJU's, OYO, Nykaa, Urban Company..." value={form.company} onChange={e => set('company', e.target.value)} />
          <label className="field-label">Industry</label>
          <input className="input" placeholder="e.g. Food Delivery, EdTech, Hotels, Beauty, Home Services..." value={form.industry} onChange={e => set('industry', e.target.value)} />
          <label className="field-label">My Business Idea (optional)</label>
          <textarea className="textarea" placeholder="Describe your idea so we can find gaps and differentiation opportunities..." value={form.yourIdea} onChange={e => set('yourIdea', e.target.value)} />
          {loading && <LoadBox text="📈 Analyzing competitor across Indian market..." />}
          <div className="btn-row">
            <button className="btn-primary cyan" disabled={loading || !form.company.trim()} onClick={generate}>{loading ? '⏳ Analyzing...' : '📈 Analyze Competitor'}</button>
          </div>
        </div>
      ) : (
        <div>
          <div className="btn-row" style={{ marginBottom: 20 }}>
            <button className="btn-secondary" onClick={() => setResult(null)}>← Analyze New</button>
          </div>
          <Section title={`📈 ${form.company} Overview`}>
            <SumBox accent={T.cyan}>{result.company_overview}</SumBox>
            <div className="two-col">
              <InfoBox label="Market Position" value={result.market_position} color={T.cyan} />
              <InfoBox label="Pricing Strategy" value={result.pricing_strategy} color={T.gold} />
              <InfoBox label="Target Segment" value={result.target_segment} color={T.purple} />
              <InfoBox label="Revenue / Funding" value={result.revenue_estimate} color={T.green} />
            </div>
          </Section>
          <Section title="⚡ SWOT Analysis">
            <div className="swot-grid">
              {[['💪 Strengths', result.swot?.strengths, T.green],['😰 Weaknesses', result.swot?.weaknesses, T.red],['🌟 Opportunities', result.swot?.opportunities, T.purple],['⚠️ Threats', result.swot?.threats, T.amber]]
                .map(([title, items, color]) => (
                  <div key={title} className="swot-box" style={{ borderColor: color + '40', background: color + '0a' }}>
                    <div className="swot-title" style={{ color }}>{title}</div>
                    {(items || []).map((it, i) => <div key={i} className="swot-item">• {it}</div>)}
                  </div>
                ))}
            </div>
          </Section>
          <Section title="🎯 Opportunity Gaps (Where You Can Win)">
            {(result.opportunity_gaps || []).map((gap, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--border2)' }}>
                <span style={{ background: `linear-gradient(135deg,${T.gold},${T.blue})`, width: 26, height: 26, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0 }}>{i + 1}</span>
                <span style={{ fontSize: 13, color: T.muted2, lineHeight: 1.6 }}>{gap}</span>
              </div>
            ))}
          </Section>
          {result.your_differentiation?.length > 0 && <Section title="✨ Your Differentiation"><SubList label="How you can stand out" items={result.your_differentiation} /></Section>}
          {result.strategy_to_beat && <SumBox accent={T.green} bold="🏆 Strategy to Beat Them:">{result.strategy_to_beat}</SumBox>}
        </div>
      )}
    </>
  );
}

// ══════════════════════════════════════════════════════════════
// TOOL 5 — PERSONAL BRAND BUILDER
// ══════════════════════════════════════════════════════════════
function PersonalBrand({ showToast, T }) {
  const [form, setForm] = useState({ name: '', niche: '', skills: '', audience: '', platform: '', goal: '' });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const PLATFORMS = ['LinkedIn','Instagram','Twitter/X','YouTube','All Platforms'];
  const GOALS     = ['Get clients','Land a job','Grow followers','Build authority','Sell a course/product'];

  const generate = async () => {
    setLoading(true); setResult(null);
    try {
      const data = await callAIJSON(
        'You are a personal branding expert for Indian professionals and entrepreneurs. Return ONLY valid JSON.',
        `Create a complete personal brand strategy for:
Name: ${form.name}, Niche: ${form.niche}, Skills: ${form.skills}, Audience: ${form.audience}, Platform: ${form.platform}, Goal: ${form.goal}
Return JSON: {"brand_statement":"1 powerful sentence defining who you are and what you do","tagline":"5-7 word catchy tagline","bio_short":"100 word bio for social media","bio_long":"300 word professional bio","brand_colors":["color1 with hex","color2 with hex","color3 with hex"],"content_pillars":["Pillar 1: topic + why","Pillar 2: topic + why","Pillar 3: topic + why","Pillar 4: topic + why"],"content_ideas":["Post idea 1","Post idea 2","Post idea 3","Post idea 4","Post idea 5","Post idea 6","Post idea 7","Post idea 8","Post idea 9","Post idea 10"],"posting_frequency":"how often to post on each platform","hashtag_strategy":["#tag1","#tag2","#tag3","#tag4","#tag5","#tag6","#tag7","#tag8","#tag9","#tag10"],"90_day_roadmap":{"week_1_4":["Action 1","Action 2","Action 3"],"week_5_8":["Action 1","Action 2","Action 3"],"week_9_12":["Action 1","Action 2","Action 3"]},"profile_optimization":{"headline":"Perfect LinkedIn/social headline","about_keywords":["keyword1","keyword2","keyword3","keyword4","keyword5"],"profile_tips":["Tip 1","Tip 2","Tip 3"]},"monetization":["Monetization path 1","Monetization path 2","Monetization path 3"]}`
      );
      setResult(data); showToast('✅ Brand strategy ready!');
    } catch (e) { showToast('❌ Error. Try again.'); }
    setLoading(false);
  };

  return (
    <>
      {!result ? (
        <div className="card">
          <div className="card-title">🌟 Personal Brand Builder</div>
          <div className="card-sub">Get bio, tagline, content strategy and a 90-day roadmap</div>
          <label className="field-label">Your Name</label>
          <input className="input" placeholder="e.g. John Doe" value={form.name} onChange={e => set('name', e.target.value)} />
          <label className="field-label">Your Niche / Field</label>
          <input className="input" placeholder="e.g. Web Development, Digital Marketing, Finance, Fitness..." value={form.niche} onChange={e => set('niche', e.target.value)} />
          <label className="field-label">Your Top Skills</label>
          <input className="input" placeholder="e.g. React, SEO, Content Writing, Business Strategy..." value={form.skills} onChange={e => set('skills', e.target.value)} />
          <label className="field-label">Target Audience</label>
          <input className="input" placeholder="e.g. Startup founders, College students, Working professionals..." value={form.audience} onChange={e => set('audience', e.target.value)} />
          <label className="field-label">Primary Platform</label>
          <div className="opts">{PLATFORMS.map(p => <button key={p} className={`opt ${form.platform === p ? 'sel-pink' : ''}`} onClick={() => set('platform', p)}>{p}</button>)}</div>
          <label className="field-label">Primary Goal</label>
          <div className="opts">{GOALS.map(g => <button key={g} className={`opt ${form.goal === g ? 'sel' : ''}`} onClick={() => set('goal', g)}>{g}</button>)}</div>
          {loading && <LoadBox text="🌟 Building your personal brand strategy..." />}
          <div className="btn-row">
            <button className="btn-primary pink" disabled={loading || !form.name.trim() || !form.niche.trim()} onClick={generate}>{loading ? '⏳ Building...' : '🌟 Build My Brand'}</button>
          </div>
        </div>
      ) : (
        <div>
          <div className="btn-row" style={{ marginBottom: 20 }}>
            <button className="btn-secondary" onClick={() => setResult(null)}>← Build New Brand</button>
          </div>
          {result.brand_statement && (
            <div className="motivation" style={{ background: T.pink + '14', borderColor: T.pink + '40', marginBottom: 16 }}>
              <div className="motivation-text" style={{ fontStyle: 'normal', fontSize: 18, fontWeight: 700 }}>"{result.brand_statement}"</div>
              {result.tagline && <div style={{ color: T.pink, fontSize: 14, marginTop: 8, fontStyle: 'italic' }}>Tagline: {result.tagline}</div>}
            </div>
          )}
          <Section title="👤 Your Bios">
            <div className="sub-label">Short Bio (Social Media)</div>
            <SumBox accent={T.pink}>{result.bio_short}</SumBox>
            <div className="sub-label">Long Bio (Professional)</div>
            <SumBox accent={T.purple}>{result.bio_long}</SumBox>
          </Section>
          {result.profile_optimization && (
            <Section title="🔧 Profile Optimization">
              <InfoBox label="Perfect Headline" value={result.profile_optimization.headline} color={T.gold} />
              <div className="sub-label">Keywords to Use</div>
              <div className="tag-row">{(result.profile_optimization.about_keywords || []).map((k, i) => <span key={i} className="tag" style={{ color: T.purple, borderColor: T.purple + '44' }}>#{k}</span>)}</div>
              <SubList label="Profile Tips" items={result.profile_optimization.profile_tips} />
            </Section>
          )}
          {result.content_pillars?.length > 0 && (
            <Section title="📱 Content Pillars">
              {result.content_pillars.map((p, i) => (
                <div key={i} style={{ padding: '10px 12px', background: T.pink + '0f', border: `1px solid ${T.pink}2e`, borderRadius: 10, marginBottom: 8 }}>
                  <span style={{ color: T.pink, fontWeight: 700 }}>Pillar {i + 1}: </span>
                  <span style={{ color: T.muted2, fontSize: 13 }}>{p}</span>
                </div>
              ))}
            </Section>
          )}
          {result.content_ideas?.length > 0 && (
            <Section title="💡 10 Content Ideas">
              {result.content_ideas.map((idea, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, padding: '7px 0', borderBottom: '1px solid var(--border2)' }}>
                  <span style={{ color: T.gold, fontWeight: 700, fontSize: 12, minWidth: 20 }}>{i + 1}.</span>
                  <span style={{ fontSize: 13, color: T.muted2 }}>{idea}</span>
                </div>
              ))}
            </Section>
          )}
          {result['90_day_roadmap'] && (
            <Section title="🗺️ 90-Day Brand Roadmap">
              <div className="tbl-wrap"><table>
                <thead><tr><th>Phase</th><th>Actions</th></tr></thead>
                <tbody>
                  {[['Week 1-4 (Foundation)', result['90_day_roadmap'].week_1_4],['Week 5-8 (Growth)', result['90_day_roadmap'].week_5_8],['Week 9-12 (Scale)', result['90_day_roadmap'].week_9_12]]
                    .map(([period, tasks]) => (
                      <tr key={period}><td style={{ color: T.pink, fontWeight: 700, whiteSpace: 'nowrap' }}>{period}</td>
                        <td>{(tasks || []).map((t, i) => <div key={i}>• {t}</div>)}</td></tr>
                    ))}
                </tbody>
              </table></div>
            </Section>
          )}
          {result.hashtag_strategy?.length > 0 && (
            <Section title="# Hashtag Strategy">
              <div className="tag-row">{result.hashtag_strategy.map((h, i) => <span key={i} className="tag" style={{ color: T.purple, borderColor: T.purple + '44' }}>{h}</span>)}</div>
            </Section>
          )}
          {result.monetization?.length > 0 && <Section title="💰 Monetization Paths"><SubList label="How to earn from your brand" items={result.monetization} /></Section>}
        </div>
      )}
    </>
  );
}

// ══════════════════════════════════════════════════════════════
// MAIN HUB
// ══════════════════════════════════════════════════════════════
export default function EntrepreneurHub() {
  const navigate = useNavigate();
  const [activeTool, setActiveTool] = useState(null);
  const [toast, setToast] = useState('');

  // ── Single MK AI liquid-glass theme — dark mode removed ──
  const T = THEME;

  const showToast = (msg, dur = 2500) => {
    setToast(msg);
    setTimeout(() => setToast(''), dur);
  };

  const currentTool = TOOLS.find(t => t.id === activeTool);

  const renderTool = () => {
    const props = { showToast, T };
    switch (activeTool) {
      case 'business':   return <BusinessPlan       {...props} />;
      case 'startup':    return <StartupNames       {...props} />;
      case 'validator':  return <IdeaValidator      {...props} />;
      case 'competitor': return <CompetitorAnalyzer {...props} />;
      case 'brand':      return <PersonalBrand      {...props} />;
      default:           return null;
    }
  };

  const css = buildCss(T);

  return (
    <>
      <style>{css}</style>
      <Helmet>
        <title>Entrepreneur Hub — Validate & Build Your Startup | MK AI</title>
        <meta name="description" content="Validate, analyze, and build your startup idea with AI-powered tools in one place." />
      </Helmet>
      <div className="wrap">
        <div className="grid-bg" />
        <div className="glow-orb" style={{ top: '-200px', left: '-200px' }} />
        <div className="glow-orb" style={{ bottom: '-200px', right: '-200px', background: `radial-gradient(circle,${T.blue}0a 0%,transparent 70%)` }} />

        {/* HEADER */}
        <header className="header">
          <div className="logo">
            <div className="logo-icon">🚀</div>
            <span className="logo-name">Entrepreneur Hub</span>
            <span className="logo-tag">AI POWERED</span>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {activeTool && (
              <button className="back-btn" onClick={() => setActiveTool(null)}>← All Tools</button>
            )}
            <button className="back-btn" onClick={() => navigate('/')}>← Back to MK AI</button>
          </div>
        </header>

        <main className="main">
          {/* HUB HOME */}
          {!activeTool && (
            <>
              <div className="hub-hero">
                <h1 className="hub-title" style={{ margin: 0 }}>Entrepreneur <span>Hub</span></h1>
                <div style={{ fontSize: 13, fontWeight: 700, color: T.gold, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12 }}>5 Powerful AI Tools</div>
                <div className="hub-sub">Everything you need to build, validate and launch your startup — powered by AI.</div>
              </div>
              <div className="tools-grid">
                {TOOLS.map((tool) => (
                  <div key={tool.id} className="tool-card" style={{ '--card-color': tool.color }} onClick={() => setActiveTool(tool.id)}>
                    <div className="tool-icon">{tool.icon}</div>
                    <div className="tool-label" style={{ color: tool.color }}>{tool.label}</div>
                    <div className="tool-desc">{tool.desc}</div>
                    <div className="tool-arrow">→</div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ACTIVE TOOL */}
          {activeTool && (
            <>
              <div className="tool-header">
                <div className="tool-header-icon" style={{ background: currentTool.color + '22', border: `1px solid ${currentTool.color}40` }}>
                  {currentTool.icon}
                </div>
                <div>
                  <div className="tool-header-title">{currentTool.label}</div>
                  <div className="tool-header-sub">{currentTool.desc}</div>
                </div>
              </div>
              {renderTool()}
            </>
          )}
        </main>

        {toast && <div className="toast">{toast}</div>}
      </div>
    </>
  );
}