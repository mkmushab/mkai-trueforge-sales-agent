import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Helmet } from 'react-helmet-async';

// ═══════════════════════════════════════════════════════════════════════
//  MULTI-PROVIDER AI — Round-Robin with Auto-Fallback
//  8 providers, auto-rotate, skip failed ones
//  ⚠️ IMPORTANT: Regenerate all keys before pushing to GitHub!
//  ⚠️ These keys are visible to anyone who views page source / devtools.
//     For production, proxy these calls through a backend so keys stay secret.
// ═══════════════════════════════════════════════════════════════════════
const AI_PROVIDERS = [
  {
    name: "GeneralCompute",
    url:  "https://api.generalcompute.com/v1/chat/completions",
    key:  "YOUR_API_KEY_PLACEHOLDER",
    model:"gpt-oss-120b",
    type: "openai",
  },
  {
    name: "OpenRouter",
    url:  "https://openrouter.ai/api/v1/chat/completions",
    key:  "sk-or-v1-REPLACE_ME",
    model:"meta-llama/llama-3.3-70b-instruct",
    type: "openai",
    extraHeaders: { "HTTP-Referer": "https://mkai.tech", "X-Title": "MK-AI" },
  },
  {
    name: "SambaNova",
    url:  "https://api.sambanova.ai/v1/chat/completions",
    key:  "REPLACE_ME",
    model:"Meta-Llama-3.3-70B-Instruct",
    type: "openai",
  },
   {
    name: 'Groq',
    url: 'https://api.groq.com/openai/v1/chat/completions',
    key: 'REPLACE_ME', // <-- apni Groq API key yaha daal de
    model: 'qwen/qwen3-32b',
    type: 'openai',
  },
  {
    name: "DeepInfra",
    url:  "https://api.deepinfra.com/v1/openai/chat/completions",
    key:  "REPLACE_ME",
    model:"meta-llama/Llama-3.3-70B-Instruct",
    type: "openai",
  },
  {
    name: "Novita",
    url:  "https://api.novita.ai/v3/openai/chat/completions",
    key:  "REPLACE_ME",
    model:"meta-llama/llama-3.3-70b-instruct",
    type: "openai",
  },
  {
    name: "Mistral",
    url:  "https://api.mistral.ai/v1/chat/completions",
    key:  "REPLACE_ME",
    model:"mistral-large-latest",
    type: "openai",
  },
  {
    name: "Cohere",
    url:  "https://api.cohere.com/v2/chat",
    key:  "REPLACE_ME",
    model:"command-r-plus",
    type: "cohere",
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

async function callProvider(provider, messages, maxTokens) {
  if (provider.type === "railway") {
    const res = await fetch(provider.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: provider.model,
        messages,
        max_tokens: maxTokens,
        temperature: 0.8,
      }),
    });
    if (!res.ok) throw new Error(`Railway HTTP ${res.status}`);
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content;
    if (!text) throw new Error("Railway empty response");
    return text;
  }

  if (provider.type === "cohere") {
    const system = messages.find(m => m.role === "system");
    const chat   = messages.filter(m => m.role !== "system");
    const res = await fetch(provider.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${provider.key}`,
      },
      body: JSON.stringify({
        model: provider.model,
        preamble: system?.content || "",
        chat_history: chat.slice(0, -1).map(m => ({
          role: m.role === "user" ? "USER" : "CHATBOT",
          message: m.content,
        })),
        message: chat[chat.length - 1]?.content || "",
        max_tokens: maxTokens,
        temperature: 0.8,
      }),
    });
    if (!res.ok) throw new Error(`Cohere HTTP ${res.status}`);
    const data = await res.json();
    const text = data?.text || data?.message?.content?.[0]?.text;
    if (!text) throw new Error("Cohere empty response");
    return text;
  }

  // Default: OpenAI-compatible
  const res = await fetch(provider.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${provider.key}`,
      ...(provider.extraHeaders || {}),
    },
    body: JSON.stringify({
      model: provider.model,
      messages,
      max_tokens: maxTokens,
      temperature: 0.8,
    }),
  });
  if (!res.ok) throw new Error(`${provider.name} HTTP ${res.status}`);
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error(`${provider.name} empty response`);
  return text;
}

async function callAI(messages, maxTokens = 4000) {
  const tried = new Set();
  for (let attempt = 0; attempt < AI_PROVIDERS.length; attempt++) {
    const provider = getNextProvider();
    if (tried.has(provider.name)) continue;
    tried.add(provider.name);
    try {
      console.log(`[Social] Trying ${provider.name} (${provider.model})`);
      const text = await callProvider(provider, messages, maxTokens);
      failCounts[provider.name] = 0;
      console.log(`[Social] ✅ ${provider.name} success`);
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("JSON not found in response");
      return JSON.parse(match[0]);
    } catch (err) {
      failCounts[provider.name]++;
      console.warn(`[Social] ❌ ${provider.name} failed (${failCounts[provider.name]}): ${err.message}`);
    }
  }
  throw new Error("All AI providers failed. Please try again in a moment.");
}

/* ═══════════════════════════════════════════════════════
   THEME — single, fixed design system (matches Home.jsx)
   Emerald / mint / sky-blue / saffron on white. No toggle.
═══════════════════════════════════════════════════════ */
const T = {
  bg:'#f6faf7', s1:'#eef8f2', s2:'#e4f3ea',
  text:'#122420', muted2:'#5c6b64', muted3:'#7b877f',
  border:'rgba(18,54,42,.10)', border2:'rgba(18,54,42,.08)', border3:'rgba(18,54,42,.05)',
  inputBg:'rgba(255,255,255,.72)', inputBorder:'rgba(18,54,42,.14)',
  orb1:'rgba(21,150,214,.14)', orb2:'rgba(242,169,59,.10)',
  gridLine:'rgba(18,54,42,.02)',
  headerBg:'rgba(246,250,247,.85)',
  accent:'#0FA968', accentMid:'#1596D6',
  cardHover:'rgba(15,169,104,.06)',
  loadBox:'rgba(15,169,104,.05)', loadBorder:'rgba(15,169,104,.25)',
  glassBg:'linear-gradient(135deg, rgba(255,255,255,.66), rgba(255,255,255,.28))',
  glassBorder:'rgba(255,255,255,.7)',
};
// Accent family used for varied badges/tags — all rooted in the same palette
const A = {
  emerald:'#0FA968', emerald2:'#0C8457',
  sky:'#1596D6', sky2:'#0E77AC',
  gold:'#F2A93B', gold2:'#C97F17',
};
const GRADIENT = `linear-gradient(135deg, ${A.emerald}, ${A.sky})`;

/* ─────────────────────── CSS ─────────────────────── */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;650;700;800&display=swap');

*{box-sizing:border-box;margin:0;padding:0}
html,body{background:${T.bg};font-family:'Inter',ui-sans-serif,system-ui,sans-serif;color:${T.text};min-height:100vh}

@keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes glowPulse{0%,100%{box-shadow:0 0 20px rgba(15,169,104,.18)}50%{box-shadow:0 0 36px rgba(21,150,214,.32)}}
@keyframes slideIn{from{opacity:0;transform:translateX(-12px)}to{opacity:1;transform:translateX(0)}}
@keyframes borderGlow{0%,100%{border-color:rgba(15,169,104,.25)}50%{border-color:rgba(21,150,214,.5)}}
@keyframes floatY{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}

.grid-bg{position:fixed;inset:0;pointer-events:none;z-index:0;
  background-image:linear-gradient(${T.gridLine} 1px,transparent 1px),linear-gradient(90deg,${T.gridLine} 1px,transparent 1px);
  background-size:48px 48px;}
.orb1{position:fixed;top:-180px;right:-80px;width:520px;height:520px;border-radius:50%;
  background:radial-gradient(circle,${T.orb1} 0%,transparent 70%);pointer-events:none;z-index:0;filter:blur(2px);}
.orb2{position:fixed;bottom:-200px;left:-100px;width:600px;height:600px;border-radius:50%;
  background:radial-gradient(circle,${T.orb2} 0%,transparent 70%);pointer-events:none;z-index:0;filter:blur(2px);}

.header{position:sticky;top:0;z-index:200;display:flex;align-items:center;justify-content:space-between;
  padding:0 28px;height:64px;background:${T.headerBg};backdrop-filter:blur(20px);
  border-bottom:1px solid ${T.border};}
.logo{display:flex;align-items:center;gap:10px}
.logo-icon{width:34px;height:34px;border-radius:11px;background:${GRADIENT};
  display:flex;align-items:center;justify-content:center;font-size:16px;
  box-shadow:0 8px 20px rgba(15,150,120,.28);}
.logo-name{font-size:15px;font-weight:800;letter-spacing:-.01em;color:${T.text}}
.logo-tag{font-size:9px;font-weight:700;letter-spacing:1.6px;color:${A.emerald2};
  background:rgba(15,169,104,.09);padding:3px 8px;border-radius:20px;border:1px solid rgba(15,169,104,.18)}
.header-right{display:flex;gap:8px;align-items:center}

.wrap{min-height:100vh;background:${T.bg};}
.main{max-width:980px;margin:0 auto;padding:32px 18px 80px;position:relative;z-index:1}

.tool-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:14px;margin-bottom:32px}
@media(max-width:600px){.tool-grid{grid-template-columns:1fr}}
.tool-card{position:relative;background:${T.glassBg};backdrop-filter:blur(16px) saturate(150%);
  border:1px solid ${T.glassBorder};border-radius:20px;padding:22px 20px;cursor:pointer;
  transition:transform .28s cubic-bezier(.22,1,.36,1),box-shadow .28s;
  box-shadow:0 10px 30px rgba(15,90,70,.08),inset 0 1px 0 rgba(255,255,255,.5);overflow:hidden}
.tool-card:hover{transform:translateY(-4px) scale(1.01);box-shadow:0 18px 40px rgba(15,90,70,.18),inset 0 1px 0 rgba(255,255,255,.65)}
.tool-card.active{border-color:rgba(15,169,104,.4);box-shadow:0 0 0 1px rgba(15,169,104,.25),0 18px 40px rgba(15,90,70,.16)}
.tool-icon{width:46px;height:46px;border-radius:13px;display:flex;align-items:center;justify-content:center;
  font-size:21px;margin-bottom:12px;background:rgba(255,255,255,.65);box-shadow:inset 0 1px 0 rgba(255,255,255,.8)}
.tool-name{font-size:16px;font-weight:700;margin-bottom:5px;color:${T.text}}
.tool-desc{font-size:12px;color:${T.muted3};line-height:1.5}

.section-header{margin-bottom:24px;animation:fadeUp .4s ease}
.section-title{font-size:22px;font-weight:800;margin-bottom:6px;color:${T.text};letter-spacing:-.02em}
.section-sub{font-size:13px;color:${T.muted3};line-height:1.6}

.form-card{background:${T.glassBg};backdrop-filter:blur(16px) saturate(150%);border:1px solid ${T.glassBorder};
  border-radius:22px;padding:28px;margin-bottom:16px;animation:fadeUp .35s ease;
  box-shadow:0 10px 30px rgba(15,90,70,.08),inset 0 1px 0 rgba(255,255,255,.5)}

.label{display:block;font-size:10px;font-weight:700;color:${T.muted2};letter-spacing:1px;
  text-transform:uppercase;margin:18px 0 7px}
.input,.textarea{width:100%;background:${T.inputBg};border:1px solid ${T.inputBorder};
  border-radius:12px;padding:11px 14px;color:${T.text};font-size:14px;
  font-family:'Inter',sans-serif;outline:none;transition:all .2s}
.input:focus,.textarea:focus{border-color:rgba(15,169,104,.5);background:#fff;
  box-shadow:0 0 0 3px rgba(15,169,104,.12)}
.textarea{resize:vertical;min-height:90px;line-height:1.7}
.input::placeholder,.textarea::placeholder{color:${T.muted3};opacity:.8}

.opts{display:flex;flex-wrap:wrap;gap:7px;margin-top:6px}
.opt{padding:7px 14px;border-radius:9px;cursor:pointer;font-size:12px;font-weight:600;
  font-family:'Inter',sans-serif;transition:all .2s;
  border:1px solid ${T.border2};background:${T.border3};color:${T.muted2}}
.opt:hover{border-color:rgba(15,169,104,.4);color:${A.emerald2};background:rgba(15,169,104,.06)}
.opt.sel{background:${GRADIENT};border-color:transparent;color:#fff;font-weight:700}
.opt.sel-gold{background:linear-gradient(135deg,${A.gold},${A.gold2});border-color:transparent;color:#fff;font-weight:700}
.opt.sel-cyan{background:linear-gradient(135deg,${A.sky},${A.sky2});border-color:transparent;color:#fff;font-weight:700}
.opt.sel-violet{background:linear-gradient(135deg,${A.sky2},${A.emerald2});border-color:transparent;color:#fff;font-weight:700}

.btn-row{display:flex;gap:10px;margin-top:24px;flex-wrap:wrap}
.btn{padding:13px 22px;border-radius:14px;cursor:pointer;font-size:14px;font-weight:700;
  font-family:'Inter',sans-serif;transition:all .25s;border:none;
  display:flex;align-items:center;gap:8px;justify-content:center;white-space:nowrap}
.btn-primary{background:${GRADIENT};color:#fff;flex:1;
  box-shadow:0 10px 26px rgba(15,150,120,.24)}
.btn-primary:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 14px 34px rgba(15,150,120,.34);animation:glowPulse 2s infinite}
.btn-primary:disabled{opacity:.4;cursor:not-allowed}
.btn-outline{background:rgba(255,255,255,.55);border:1px solid ${T.border2}!important;color:${T.muted2}}
.btn-outline:hover{background:#fff;color:${T.text}}
.btn-sm{padding:7px 14px;font-size:12px;border-radius:9px;cursor:pointer;font-weight:600;
  font-family:'Inter',sans-serif;border:none;transition:all .2s;display:inline-flex;align-items:center;gap:5px}
.btn-copy{background:rgba(15,169,104,.09);border:1px solid rgba(15,169,104,.22)!important;color:${A.emerald2}}
.btn-copy:hover{background:rgba(15,169,104,.16)}

.spinner{width:18px;height:18px;border:2.5px solid rgba(15,169,104,.2);border-top-color:${A.emerald};
  border-radius:50%;animation:spin 1s linear infinite;flex-shrink:0}
.load-box{display:flex;align-items:center;gap:14px;
  background:${T.loadBox};border:1px solid ${T.loadBorder};
  border-radius:14px;padding:16px 18px;margin-top:14px;animation:borderGlow 2s infinite}
.load-text{font-size:14px;font-weight:600;color:${A.emerald2}}
.load-sub{font-size:11px;color:${T.muted2};margin-top:2px}
.provider-badge{font-size:10px;color:${T.muted3};margin-top:4px;
  padding:2px 8px;border-radius:20px;background:rgba(15,169,104,.07);
  border:1px solid rgba(15,169,104,.14);display:inline-block}

.result-wrap{animation:fadeIn .5s ease}
.info-strip{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:18px}
.badge{display:inline-flex;align-items:center;gap:5px;padding:4px 12px;
  border-radius:20px;font-size:11px;font-weight:700;
  background:rgba(15,169,104,.09);border:1px solid rgba(15,169,104,.18);color:${A.emerald2}}
.badge.gold{background:rgba(242,169,59,.12);border-color:rgba(242,169,59,.28);color:${A.gold2}}
.badge.cyan{background:rgba(21,150,214,.09);border-color:rgba(21,150,214,.2);color:${A.sky2}}
.badge.violet{background:rgba(14,119,172,.1);border-color:rgba(14,119,172,.22);color:${A.sky2}}

.tabs{display:flex;gap:5px;overflow-x:auto;margin-bottom:18px;padding-bottom:2px;scrollbar-width:none}
.tabs::-webkit-scrollbar{display:none}
.tab{padding:8px 15px;border-radius:10px;cursor:pointer;font-size:12px;font-weight:700;
  font-family:'Inter',sans-serif;white-space:nowrap;transition:all .2s;border:none;outline:none;letter-spacing:.3px}
.tab.active{background:${GRADIENT};color:#fff}
.tab.inactive{background:rgba(15,169,104,.05);color:${T.muted2};border:1px solid ${T.border2}}
.tab.inactive:hover{border-color:rgba(15,169,104,.3);color:${A.emerald2}}

.r-section{background:${T.glassBg};backdrop-filter:blur(14px) saturate(150%);border:1px solid ${T.glassBorder};
  border-radius:18px;padding:22px;margin-bottom:14px;animation:slideIn .3s ease;
  box-shadow:0 8px 24px rgba(15,90,70,.06),inset 0 1px 0 rgba(255,255,255,.5)}
.r-title{font-size:15px;font-weight:700;margin-bottom:14px;
  display:flex;align-items:center;gap:8px;color:${T.text}}
.post-card{background:rgba(255,255,255,.5);border:1px solid ${T.border2};border-radius:14px;padding:18px;margin-bottom:12px}
.post-head{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;gap:10px;flex-wrap:wrap}
.post-ver{font-size:10px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:${A.emerald2}}
.post-meta{display:flex;gap:6px;flex-wrap:wrap}
.meta-tag{font-size:10px;font-weight:600;padding:2px 9px;border-radius:8px}
.meta-formula{background:rgba(18,54,42,.05);color:${T.muted3}}
.meta-eng{background:rgba(15,169,104,.1);color:${A.emerald2}}
.meta-eng.med{background:rgba(242,169,59,.12);color:${A.gold2}}
.post-body{font-size:13.5px;color:#3a4842;line-height:1.85;white-space:pre-wrap;margin-bottom:12px}
.hook-item{background:rgba(15,169,104,.05);border:1px solid rgba(15,169,104,.14);border-radius:11px;
  padding:11px 14px;font-size:13px;color:#3a4842;line-height:1.6;cursor:pointer;
  transition:all .2s;margin-bottom:7px;display:flex;gap:10px;align-items:flex-start}
.hook-item:hover{border-color:rgba(15,169,104,.35);background:rgba(15,169,104,.09);transform:translateX(3px)}
.hook-num{color:${A.emerald2};font-weight:800;font-size:13px;flex-shrink:0;min-width:20px}
.hook-copy-hint{font-size:10px;color:${T.muted2};margin-left:auto;flex-shrink:0;margin-top:3px}
.hashtag-wrap{display:flex;flex-wrap:wrap;gap:5px;margin-top:8px}
.hashtag{background:rgba(21,150,214,.09);border:1px solid rgba(21,150,214,.2);
  color:${A.sky2};padding:3px 10px;border-radius:10px;font-size:11px;font-weight:600;cursor:pointer;transition:all .2s}
.hashtag:hover{background:rgba(21,150,214,.18);transform:scale(1.03)}
.ht-trending{background:rgba(242,169,59,.1);border-color:rgba(242,169,59,.24);color:${A.gold2}}
.ht-niche{background:rgba(21,150,214,.09);border-color:rgba(21,150,214,.2);color:${A.sky2}}
.ht-branded{background:rgba(15,169,104,.09);border-color:rgba(15,169,104,.2);color:${A.emerald2}}
.cta-item{background:rgba(21,150,214,.07);border:1px solid rgba(21,150,214,.18);
  border-radius:11px;padding:10px 14px;font-size:13px;color:${A.sky2};margin-bottom:7px;
  cursor:pointer;transition:all .2s;display:flex;align-items:center;gap:8px}
.cta-item:hover{background:rgba(21,150,214,.13);transform:translateX(3px)}
.slide-card{background:rgba(255,255,255,.5);border:1px solid ${T.border2};border-radius:13px;padding:16px;margin-bottom:10px}
.slide-num{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;
  border-radius:8px;background:${GRADIENT};
  font-size:12px;font-weight:800;color:#fff;margin-bottom:10px}
.slide-head{font-weight:700;font-size:14px;color:${A.emerald2};margin-bottom:5px}
.slide-body{font-size:12.5px;color:${T.muted3};line-height:1.6;margin-bottom:7px}
.slide-visual{font-size:11px;color:${T.muted2};font-style:italic}
.story-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:10px}
.story-item{background:rgba(14,119,172,.06);border:1px solid rgba(14,119,172,.16);
  border-radius:13px;padding:14px;font-size:12.5px;color:${A.sky2};line-height:1.6}
.story-type{font-size:10px;font-weight:700;color:${A.sky2};text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px}
.cal-table{width:100%;border-collapse:collapse;font-size:12.5px}
.cal-table th{background:rgba(15,169,104,.1);padding:9px 12px;text-align:left;
  color:${A.emerald2};font-weight:700;font-size:10px;letter-spacing:.5px;text-transform:uppercase}
.cal-table td{padding:9px 12px;border-top:1px solid ${T.border2};vertical-align:top;color:#3a4842}
.cal-table tr:hover td{background:rgba(15,169,104,.03)}
.ab-tip{background:rgba(242,169,59,.09);border:1px solid rgba(242,169,59,.24);
  border-radius:12px;padding:12px 16px;font-size:13px;color:${A.gold2};margin-top:10px}
.perf-bar{background:rgba(15,169,104,.07);border:1px solid rgba(15,169,104,.16);
  border-radius:14px;padding:14px 18px;margin-bottom:18px;display:flex;gap:24px;flex-wrap:wrap}
.perf-item{flex:1;min-width:120px}
.perf-label{font-size:9px;font-weight:700;color:${T.muted2};letter-spacing:.8px;text-transform:uppercase;margin-bottom:4px}
.perf-val{font-size:13px;font-weight:700;color:${A.emerald2}}
.perf-val.green{color:${A.emerald2}}
.perf-val.gold{color:${A.gold2}}

.blog-content{font-size:14px;color:#3a4842;line-height:1.9;white-space:pre-wrap}
.blog-section-card{background:rgba(255,255,255,.5);border:1px solid ${T.border2};border-radius:13px;padding:16px;margin-bottom:10px}
.blog-section-title{font-size:14px;font-weight:700;color:${A.emerald2};margin-bottom:8px}
.seo-chip{background:rgba(21,150,214,.09);border:1px solid rgba(21,150,214,.2);
  color:${A.sky2};padding:4px 11px;border-radius:10px;font-size:11px;font-weight:600;cursor:pointer;transition:all .2s}
.seo-chip:hover{background:rgba(21,150,214,.18)}

.scene-card{background:rgba(255,255,255,.45);border:1px solid ${T.border2};border-radius:13px;padding:16px;margin-bottom:10px;position:relative}
.scene-badge{display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:9px;
  font-size:10px;font-weight:700;letter-spacing:.4px;text-transform:uppercase;margin-bottom:10px}
.scene-time{font-size:11px;color:${A.gold2};font-weight:700;margin-bottom:6px}
.scene-body{font-size:13px;color:#3a4842;line-height:1.75;white-space:pre-wrap}
.voiceover{background:rgba(14,119,172,.07);border-left:3px solid ${A.sky2};
  padding:10px 14px;font-size:13px;color:${A.sky2};line-height:1.7;border-radius:0 10px 10px 0;margin-top:8px;font-style:italic}

.chapter-card{background:rgba(255,255,255,.5);border:1px solid ${T.border2};border-radius:14px;padding:18px;margin-bottom:12px}
.chapter-num{font-size:10px;font-weight:700;color:${A.sky2};letter-spacing:1px;text-transform:uppercase;margin-bottom:6px}
.chapter-title{font-size:15px;font-weight:700;color:${A.emerald2};margin-bottom:10px}
.chapter-text{font-size:13.5px;color:#3a4842;line-height:1.9;white-space:pre-wrap}
.char-card{background:rgba(21,150,214,.06);border:1px solid rgba(21,150,214,.16);border-radius:12px;padding:12px 14px}
.char-name{font-weight:700;font-size:14px;color:${A.sky2};margin-bottom:4px}
.char-role{font-size:11px;color:${T.muted3};margin-bottom:6px}
.char-trait{font-size:12px;color:#4a5850}
.plot-twist{background:rgba(15,169,104,.08);border:1px solid rgba(15,169,104,.2);border-radius:12px;padding:12px 16px;margin-bottom:7px;font-size:13px;color:${A.emerald2}}
.two-col{display:grid;grid-template-columns:1fr 1fr;gap:14px}
@media(max-width:560px){.two-col{grid-template-columns:1fr}}

.toast{position:fixed;bottom:24px;right:24px;z-index:9999;
  background:${GRADIENT};
  color:#fff;padding:11px 20px;border-radius:12px;font-weight:600;font-size:13px;
  animation:fadeUp .3s ease;box-shadow:0 12px 28px rgba(15,150,120,.32)}
.divider{height:1px;background:${T.border2};margin:16px 0}

.hero{text-align:center;padding:40px 20px;animation:fadeUp .5s ease}
.hero-icon{font-size:48px;margin-bottom:16px;animation:floatY 3s infinite ease-in-out;display:block}
.hero-title{font-size:28px;font-weight:800;margin-bottom:10px;letter-spacing:-.02em;
  background:linear-gradient(135deg,${A.emerald2},${A.sky},${A.gold});
  -webkit-background-clip:text;-webkit-text-fill-color:transparent}
.hero-sub{font-size:14px;color:${T.muted3};max-width:480px;margin:0 auto;line-height:1.7}
`;

/* ─────────────────────── CONSTANTS ─────────────────────── */
const PLATFORMS  = [{ id:"Instagram",icon:"📸" },{ id:"Twitter/X",icon:"🐦" },{ id:"LinkedIn",icon:"💼" },{ id:"Facebook",icon:"👥" },{ id:"YouTube",icon:"📺" },{ id:"WhatsApp",icon:"💬" }];
const POST_TYPES = ["Single Post","Carousel","Story Ideas","Thread","Reel Caption","Content Calendar"];
const TONES      = ["Professional","Funny & Casual","Motivational","Educational","Promotional","Storytelling","Controversial"];
const LANGUAGES  = ["English","Hindi","Hinglish","Bilingual"];
const BLOG_TYPES = ["How-To Guide","Listicle","Opinion Piece","Case Study","News Article","Comparison","Tutorial","Thought Leadership"];
const BLOG_LENGTHS=["Short (~500 words)","Medium (~1000 words)","Long (~2000 words)","Detailed (~3000 words)"];
const BLOG_TONES = ["Professional","Conversational","Storytelling","Academic","Persuasive","Funny"];
const SCRIPT_TYPES=["YouTube Video","Instagram Reel","TikTok","Podcast Episode","Ad/Commercial","Explainer Video","Documentary","Webinar"];
const SCRIPT_DURATIONS=["30 sec","1 min","3 min","5 min","10 min","15 min","30 min"];
const SCRIPT_STYLES=["Educational","Entertainment","Motivational","Tutorial","Interview","Storytelling","Sales Pitch"];
const STORY_GENRES=["Romance","Thriller","Fantasy","Sci-Fi","Horror","Comedy","Drama","Mystery","Adventure"];
const STORY_TYPES=["Short Story","Flash Fiction","Chapter 1","Full Story Outline","Micro Fiction","Fan Fiction"];
const STORY_POV  =["First Person","Third Person","Omniscient","Second Person"];

const TOOLS = [
  { id:"social", name:"Social Media", icon:"📱", desc:"Viral posts, hooks, hashtags, carousels, story ideas & content calendar", badge:"🔥 VIRAL" },
  { id:"blog",   name:"Blog Writer",  icon:"✍️", desc:"SEO-optimized blog posts with intros, sections, meta descriptions & keyword analysis", badge:"✨ SEO" },
  { id:"script", name:"Script Writer",icon:"🎬", desc:"Full video/podcast scripts with scenes, voiceovers, hooks & engagement cues", badge:"🎥 PRO" },
  { id:"story",  name:"Story Generator",icon:"📖",desc:"Creative stories with characters, plot twists, world-building & dialogue", badge:"🌟 CREATIVE" },
];

/* ═══════════════════════ SOCIAL TOOL ═══════════════════════ */
function SocialTool({ showToast }) {
  const [platform,setPlatform]=useState(""); const [postType,setPostType]=useState(""); const [topic,setTopic]=useState("");
  const [tone,setTone]=useState(""); const [language,setLanguage]=useState("English"); const [brandName,setBrandName]=useState("");
  const [niche,setNiche]=useState(""); const [loading,setLoading]=useState(false); const [status,setStatus]=useState("");
  const [result,setResult]=useState(null); const [activeTab,setActiveTab]=useState("posts");

  const generate = async () => {
    if (!topic.trim() || !platform) return;
    setLoading(true); setResult(null);
    setStatus(`✨ Generating ${platform} posts...`);
    try {
      const data = await callAI([
        { role:"system", content:"You are a viral social media expert. Return ONLY valid JSON — no markdown, no backticks." },
        { role:"user", content:`Create viral ${postType||"Single Post"} for ${platform}:\n\nTopic: ${topic}\nTone: ${tone||"Professional"}\nLanguage: ${language}\nBrand: ${brandName||"Brand"}\nNiche: ${niche||"General"}\n\nReturn ONLY this JSON:\n{\n  "platform": "${platform}",\n  "hooks": ["Hook 1","Hook 2","Hook 3","Hook 4","Hook 5"],\n  "posts": [\n    {"version":"Version A — Direct","viral_formula":"PAS Formula","caption":"Full caption here...","estimated_engagement":"High","character_count":280},\n    {"version":"Version B — Story","viral_formula":"AIDA Formula","caption":"Story version...","estimated_engagement":"High","character_count":220},\n    {"version":"Version C — Minimal","viral_formula":"Less is More","caption":"Short punchy version","estimated_engagement":"Medium","character_count":150}\n  ],\n  "hashtags":{"trending":["#t1","#t2","#t3","#t4","#t5"],"niche":["#n1","#n2","#n3","#n4","#n5"],"branded":["#b1","#b2"],"all_30":["#h1","#h2","#h3","#h4","#h5","#h6","#h7","#h8","#h9","#h10","#h11","#h12","#h13","#h14","#h15","#h16","#h17","#h18","#h19","#h20","#h21","#h22","#h23","#h24","#h25","#h26","#h27","#h28","#h29","#h30"]},\n  "cta_options":["CTA 1","CTA 2","CTA 3"],\n  "carousel_slides":[{"slide":1,"type":"hook","headline":"Headline","content":"Content","visual":"Design tip"},{"slide":2,"type":"content","headline":"Headline 2","content":"Content 2","visual":"Design tip"},{"slide":3,"type":"content","headline":"Headline 3","content":"Content 3","visual":"Design tip"},{"slide":4,"type":"cta","headline":"CTA Slide","content":"CTA content","visual":"Design tip"}],\n  "story_ideas":[{"slide":1,"type":"Poll","content":"Story idea 1"},{"slide":2,"type":"Swipe Up","content":"Story idea 2"},{"slide":3,"type":"BTS","content":"Story idea 3"}],\n  "content_calendar":[{"day":"Monday","theme":"Motivation Monday","topic":"topic","post_type":"Reel","hook":"hook line","best_time":"9 AM"},{"day":"Tuesday","theme":"Tips Tuesday","topic":"topic","post_type":"Carousel","hook":"hook line","best_time":"12 PM"},{"day":"Wednesday","theme":"Wisdom Wednesday","topic":"topic","post_type":"Single","hook":"hook line","best_time":"7 PM"},{"day":"Thursday","theme":"Throwback","topic":"topic","post_type":"Story","hook":"hook line","best_time":"6 PM"},{"day":"Friday","theme":"Feature Friday","topic":"topic","post_type":"Reel","hook":"hook line","best_time":"5 PM"},{"day":"Saturday","theme":"Story Saturday","topic":"topic","post_type":"Story","hook":"hook line","best_time":"11 AM"},{"day":"Sunday","theme":"Sunday Funday","topic":"topic","post_type":"Single","hook":"hook line","best_time":"8 PM"}],\n  "best_posting_time":"Best time string",\n  "engagement_prediction":"Why this will perform well",\n  "bio_suggestion":"Optimized bio text",\n  "ab_test_tip":"Which version to test first and why"\n}` }
      ]);
      setResult(data); setActiveTab("posts"); setStatus(""); showToast("✅ Posts ready!");
    } catch(e) { console.error(e); setStatus("❌ Error! Try again."); }
    setLoading(false);
  };

  const copyText = t => { navigator.clipboard.writeText(t); showToast("📋 Copied!"); };
  const socialTabs = [{ id:"posts",label:"📝 Posts" },{ id:"hooks",label:"🪝 Hooks" },{ id:"hashtags",label:"#️⃣ Hashtags" },{ id:"carousel",label:"📊 Carousel" },{ id:"stories",label:"📸 Stories" },{ id:"calendar",label:"📅 Calendar" }];

  if (!result) return (
    <div className="form-card">
      <div className="section-header">
        <div className="section-title">📱 Social Media Post Generator</div>
        <div className="section-sub">Enter your topic and AI will generate viral posts, hooks, hashtags, carousel slides and a content calendar.</div>
      </div>
      <label className="label">Platform *</label>
      <div className="opts">{PLATFORMS.map(p=>(<button key={p.id} className={`opt ${platform===p.id?"sel":""}`} onClick={()=>setPlatform(p.id)}>{p.icon} {p.id}</button>))}</div>
      <label className="label">Post Type</label>
      <div className="opts">{POST_TYPES.map(t=>(<button key={t} className={`opt ${postType===t?"sel-gold":""}`} onClick={()=>setPostType(t)}>{t}</button>))}</div>
      <label className="label">Topic / Idea *</label>
      <textarea className="textarea" placeholder="e.g. 5 AI tools that will change your workflow, My startup journey, Product launch announcement..." value={topic} onChange={e=>setTopic(e.target.value)} />
      <div className="two-col">
        <div>
          <label className="label">Tone</label>
          <div className="opts">{TONES.map(t=>(<button key={t} className={`opt ${tone===t?"sel-violet":""}`} onClick={()=>setTone(t)}>{t}</button>))}</div>
        </div>
        <div>
          <label className="label">Language</label>
          <div className="opts">{LANGUAGES.map(l=>(<button key={l} className={`opt ${language===l?"sel-cyan":""}`} onClick={()=>setLanguage(l)}>{l}</button>))}</div>
        </div>
      </div>
      <div className="two-col" style={{marginTop:8}}>
        <div>
          <label className="label">Brand / Name (optional)</label>
          <input className="input" placeholder="e.g. MK-AI, Your Brand Name..." value={brandName} onChange={e=>setBrandName(e.target.value)} />
        </div>
        <div>
          <label className="label">Niche (optional)</label>
          <input className="input" placeholder="e.g. AI, Finance, Fitness..." value={niche} onChange={e=>setNiche(e.target.value)} />
        </div>
      </div>
      {loading && (
        <div className="load-box">
          <div className="spinner"/>
          <div>
            <div className="load-text">{status}</div>
            <div className="load-sub">Creating viral content... 15-20 seconds</div>
            <div className="provider-badge">🔄 Auto-switching: {AI_PROVIDERS.map(p=>p.name).join(" → ")}</div>
          </div>
        </div>
      )}
      <div className="btn-row">
        <button className="btn btn-primary" disabled={loading||!topic.trim()||!platform} onClick={generate}>
          {loading?<><div className="spinner"/>Generating...</>:"🚀 Generate Viral Posts"}
        </button>
      </div>
    </div>
  );

  return (
    <div className="result-wrap">
      <div className="info-strip">
        <button className="btn btn-outline btn-sm" onClick={()=>setResult(null)}>← New Post</button>
        <span className="badge">📱 {platform}</span>
        <span className="badge gold">📝 {postType||"Single Post"}</span>
        <span className="badge cyan">🌐 {language}</span>
      </div>
      <div className="perf-bar">
        <div className="perf-item"><div className="perf-label">Best Time</div><div className="perf-val">⏰ {result.best_posting_time}</div></div>
        <div className="perf-item" style={{flex:3}}><div className="perf-label">Engagement Prediction</div><div style={{fontSize:12,fontWeight:500,color:"#3a4842"}}>{result.engagement_prediction}</div></div>
      </div>
      <div className="tabs">{socialTabs.map(t=>(<button key={t.id} className={`tab ${activeTab===t.id?"active":"inactive"}`} onClick={()=>setActiveTab(t.id)}>{t.label}</button>))}</div>

      {activeTab==="posts" && <>
        {(result.posts||[]).map((p,i)=>(
          <div key={i} className="post-card">
            <div className="post-head">
              <span className="post-ver">{p.version}</span>
              <div className="post-meta">
                <span className="meta-tag meta-formula">{p.viral_formula}</span>
                <span className={`meta-tag meta-eng ${p.estimated_engagement!=="High"?"med":""}`}>{p.estimated_engagement}</span>
              </div>
            </div>
            <div className="post-body">{p.caption}</div>
            <button className="btn-sm btn-copy" onClick={()=>copyText(p.caption)}>📋 Copy Caption</button>
          </div>
        ))}
        {result.cta_options?.length>0&&(<div className="r-section"><div className="r-title">📢 CTA Options</div>{result.cta_options.map((c,i)=>(<div key={i} className="cta-item" onClick={()=>copyText(c)}>➡ {c}</div>))}</div>)}
        {result.bio_suggestion&&(<div className="r-section"><div className="r-title">👤 Optimized Bio</div><div style={{fontSize:13,color:"#3a4842",lineHeight:1.7}}>{result.bio_suggestion}</div><button className="btn-sm btn-copy" style={{marginTop:10}} onClick={()=>copyText(result.bio_suggestion)}>📋 Copy Bio</button></div>)}
      </>}

      {activeTab==="hooks"&&(<div className="r-section"><div className="r-title">🪝 5 Viral Hooks</div>{(result.hooks||[]).map((h,i)=>(<div key={i} className="hook-item" onClick={()=>copyText(h)}><span className="hook-num">{i+1}.</span><span style={{flex:1}}>{h}</span><span className="hook-copy-hint">tap to copy</span></div>))}{result.ab_test_tip&&<div className="ab-tip">🔬 <b style={{color:A.gold2}}>A/B Tip: </b>{result.ab_test_tip}</div>}</div>)}

      {activeTab==="hashtags"&&(<div className="r-section"><div className="r-title">#️⃣ 30 Hashtags</div><button className="btn-sm btn-copy" onClick={()=>copyText((result.hashtags?.all_30||[]).join(" "))} style={{marginBottom:14}}>📋 Copy All 30</button>{[["🔥 Trending","trending","ht-trending"],["🎯 Niche","niche","ht-niche"],["🏷️ Branded","branded","ht-branded"]].map(([label,key,cls])=>(<div key={key} style={{marginBottom:14}}><div style={{fontSize:10,fontWeight:700,color:T.muted2,textTransform:"uppercase",letterSpacing:".6px",marginBottom:7}}>{label}</div><div className="hashtag-wrap">{(result.hashtags?.[key]||[]).map((h,i)=>(<span key={i} className={`hashtag ${cls}`} onClick={()=>copyText(h)}>{h}</span>))}</div></div>))}<div style={{marginBottom:6,fontSize:10,fontWeight:700,color:T.muted2,textTransform:"uppercase",letterSpacing:".6px"}}>📦 Complete Set</div><div className="hashtag-wrap">{(result.hashtags?.all_30||[]).map((h,i)=>(<span key={i} className="hashtag" onClick={()=>copyText(h)}>{h}</span>))}</div></div>)}

      {activeTab==="carousel"&&(<div className="r-section"><div className="r-title">📊 Carousel Slides</div>{(result.carousel_slides||[]).map((s,i)=>(<div key={i} className="slide-card"><div className="slide-num">{s.slide}</div><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}><span style={{fontSize:10,color:T.muted2,textTransform:"uppercase",letterSpacing:".4px"}}>{s.type}</span></div><div className="slide-head">{s.headline}</div><div className="slide-body">{s.content}</div><div className="slide-visual">🎨 {s.visual}</div></div>))}</div>)}

      {activeTab==="stories"&&(<div className="r-section"><div className="r-title">📸 Story Ideas</div><div className="story-grid">{(result.story_ideas||[]).map((s,i)=>(<div key={i} className="story-item"><div className="story-type">Slide {s.slide} · {s.type}</div>{s.content}</div>))}</div></div>)}

      {activeTab==="calendar"&&(<div className="r-section"><div className="r-title">📅 7-Day Content Calendar</div><div style={{overflowX:"auto",borderRadius:12,border:`1px solid ${T.border2}`}}><table className="cal-table"><thead><tr>{["Day","Theme","Topic","Type","Hook","Time"].map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{(result.content_calendar||[]).map((d,i)=>(<tr key={i}><td style={{color:A.gold2,fontWeight:700}}>{d.day}</td><td style={{color:A.emerald2}}>{d.theme}</td><td>{d.topic}</td><td><span style={{background:"rgba(14,119,172,.12)",color:A.sky2,padding:"2px 8px",borderRadius:8,fontSize:10,fontWeight:700}}>{d.post_type}</span></td><td style={{color:T.muted3,maxWidth:180}}>{(d.hook||"").slice(0,55)}…</td><td style={{color:A.emerald2}}>⏰ {d.best_time}</td></tr>))}</tbody></table></div></div>)}
    </div>
  );
}

/* ═══════════════════════ BLOG TOOL ═══════════════════════ */
function BlogTool({ showToast }) {
  const [topic,setTopic]=useState(""); const [blogType,setBlogType]=useState(""); const [blogLen,setBlogLen]=useState("Medium (~1000 words)");
  const [blogTone,setBlogTone]=useState(""); const [targetAud,setTargetAud]=useState(""); const [keywords,setKeywords]=useState("");
  const [language,setLanguage]=useState("English"); const [loading,setLoading]=useState(false); const [status,setStatus]=useState("");
  const [result,setResult]=useState(null); const [activeTab,setActiveTab]=useState("content");

  const generate = async () => {
    if (!topic.trim()) return;
    setLoading(true); setResult(null);
    setStatus("✍️ Writing SEO blog post...");
    try {
      const data = await callAI([
        { role:"system", content:"You are a professional SEO blog writer and content strategist. Return ONLY valid JSON — no markdown, no backticks." },
        { role:"user", content:`Write a complete ${blogType||"How-To Guide"} blog post:\n\nTopic: ${topic}\nLength: ${blogLen}\nTone: ${blogTone||"Professional"}\nTarget Audience: ${targetAud||"General audience"}\nKeywords: ${keywords||"auto-generate"}\nLanguage: ${language}\n\nReturn ONLY this JSON:\n{\n  "title": "SEO-optimized blog title",\n  "meta_description": "160 char meta description",\n  "slug": "url-friendly-slug",\n  "reading_time": "X min read",\n  "word_count": 1000,\n  "intro": "Compelling introduction paragraph",\n  "sections": [\n    {"heading": "Section 1 Heading", "content": "Full section content here with details", "word_count": 200},\n    {"heading": "Section 2 Heading", "content": "Full section 2 content", "word_count": 200},\n    {"heading": "Section 3 Heading", "content": "Full section 3 content", "word_count": 200}\n  ],\n  "conclusion": "Strong conclusion paragraph with CTA",\n  "seo_keywords": {\n    "primary": ["keyword1", "keyword2", "keyword3"],\n    "secondary": ["kw4", "kw5", "kw6", "kw7", "kw8"],\n    "lsi": ["lsi1", "lsi2", "lsi3", "lsi4", "lsi5"]\n  },\n  "full_post": "Complete formatted blog post as single string",\n  "social_snippets": [\n    "Twitter/X snippet for this blog",\n    "LinkedIn post promoting this blog",\n    "Instagram caption for this blog"\n  ],\n  "internal_linking_ideas": ["Related topic 1 you can link to", "Related topic 2"],\n  "faq": [\n    {"question": "FAQ Question 1?", "answer": "Concise answer"},\n    {"question": "FAQ Question 2?", "answer": "Concise answer"},\n    {"question": "FAQ Question 3?", "answer": "Concise answer"}\n  ],\n  "schema_type": "Article or HowTo or FAQ",\n  "content_score": 85,\n  "seo_tips": ["SEO tip 1 for this post", "SEO tip 2", "SEO tip 3"]\n}` }
      ], 5000);
      setResult(data); setActiveTab("content"); setStatus(""); showToast("✅ Blog ready!");
    } catch(e) { console.error(e); setStatus("❌ Error! Try again."); }
    setLoading(false);
  };

  const copyText = t => { navigator.clipboard.writeText(t); showToast("📋 Copied!"); };
  const blogTabs = [{ id:"content",label:"📄 Content" },{ id:"seo",label:"🔍 SEO" },{ id:"social",label:"📱 Social Snippets" },{ id:"faq",label:"❓ FAQ" }];

  if (!result) return (
    <div className="form-card">
      <div className="section-header">
        <div className="section-title">✍️ Blog Writer</div>
        <div className="section-sub">SEO-optimized blog posts with proper structure, keyword analysis and social media snippets.</div>
      </div>
      <label className="label">Blog Topic *</label>
      <textarea className="textarea" placeholder="e.g. How to start a YouTube channel from scratch, 10 AI tools every marketer needs..." value={topic} onChange={e=>setTopic(e.target.value)} />
      <div className="two-col">
        <div><label className="label">Blog Type</label><div className="opts">{BLOG_TYPES.map(t=>(<button key={t} className={`opt ${blogType===t?"sel":""}`} onClick={()=>setBlogType(t)}>{t}</button>))}</div></div>
        <div><label className="label">Tone</label><div className="opts">{BLOG_TONES.map(t=>(<button key={t} className={`opt ${blogTone===t?"sel-cyan":""}`} onClick={()=>setBlogTone(t)}>{t}</button>))}</div></div>
      </div>
      <label className="label">Length</label>
      <div className="opts">{BLOG_LENGTHS.map(l=>(<button key={l} className={`opt ${blogLen===l?"sel-gold":""}`} onClick={()=>setBlogLen(l)}>{l}</button>))}</div>
      <div className="two-col" style={{marginTop:8}}>
        <div><label className="label">Target Audience (optional)</label><input className="input" placeholder="e.g. Entrepreneurs, developers, students..." value={targetAud} onChange={e=>setTargetAud(e.target.value)} /></div>
        <div><label className="label">Focus Keywords (optional)</label><input className="input" placeholder="e.g. AI tools, social media marketing..." value={keywords} onChange={e=>setKeywords(e.target.value)} /></div>
      </div>
      <label className="label">Language</label>
      <div className="opts">{LANGUAGES.map(l=>(<button key={l} className={`opt ${language===l?"sel-violet":""}`} onClick={()=>setLanguage(l)}>{l}</button>))}</div>
      {loading&&(<div className="load-box"><div className="spinner"/><div><div className="load-text">{status}</div><div className="load-sub">Writing your SEO blog post... 20-25 seconds</div><div className="provider-badge">🔄 Auto-switching providers</div></div></div>)}
      <div className="btn-row">
        <button className="btn btn-primary" disabled={loading||!topic.trim()} onClick={generate}>
          {loading?<><div className="spinner"/>Generating...</>:"✍️ Write Blog Post"}
        </button>
      </div>
    </div>
  );

  return (
    <div className="result-wrap">
      <div className="info-strip">
        <button className="btn btn-outline btn-sm" onClick={()=>setResult(null)}>← New Blog</button>
        <span className="badge cyan">📖 {result.reading_time}</span>
        <span className="badge gold">📊 Score: {result.content_score}/100</span>
        <span className="badge violet">🔗 {result.schema_type}</span>
      </div>
      <div className="perf-bar">
        <div className="perf-item"><div className="perf-label">Title</div><div style={{fontSize:13,fontWeight:600,color:"#3a4842"}}>{result.title}</div></div>
        <div className="perf-item" style={{minWidth:80}}><div className="perf-label">Words</div><div className="perf-val gold">~{result.word_count}</div></div>
      </div>
      <div className="tabs">{blogTabs.map(t=>(<button key={t.id} className={`tab ${activeTab===t.id?"active":"inactive"}`} onClick={()=>setActiveTab(t.id)}>{t.label}</button>))}</div>

      {activeTab==="content"&&<>
        <div className="r-section">
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <div className="r-title">📄 Full Blog Post</div>
            <button className="btn-sm btn-copy" onClick={()=>copyText(result.full_post)}>📋 Copy All</button>
          </div>
          <div style={{background:"rgba(21,150,214,.06)",border:"1px solid rgba(21,150,214,.16)",borderRadius:12,padding:"12px 14px",marginBottom:14}}>
            <div style={{fontSize:10,color:A.sky2,fontWeight:700,letterSpacing:".6px",textTransform:"uppercase",marginBottom:6}}>Meta Description</div>
            <div style={{fontSize:12.5,color:"#4a5850"}}>{result.meta_description}</div>
            <div style={{fontSize:11,color:T.muted2,marginTop:4}}>🔗 Slug: /{result.slug}</div>
          </div>
          <div className="blog-section-card"><div style={{fontSize:10,color:A.sky2,fontWeight:700,letterSpacing:".6px",textTransform:"uppercase",marginBottom:6}}>Introduction</div><div className="blog-content">{result.intro}</div></div>
          {(result.sections||[]).map((s,i)=>(<div key={i} className="blog-section-card"><div className="blog-section-title">H2: {s.heading}</div><div className="blog-content">{s.content}</div><div style={{fontSize:10,color:T.muted2,marginTop:6}}>~{s.word_count} words</div></div>))}
          <div className="blog-section-card"><div style={{fontSize:10,color:A.sky2,fontWeight:700,letterSpacing:".6px",textTransform:"uppercase",marginBottom:6}}>Conclusion</div><div className="blog-content">{result.conclusion}</div></div>
        </div>
        {result.internal_linking_ideas?.length>0&&(<div className="r-section"><div className="r-title">🔗 Internal Linking Ideas</div>{result.internal_linking_ideas.map((l,i)=>(<div key={i} style={{fontSize:13,color:"#3a4842",padding:"7px 0",borderBottom:`1px solid ${T.border2}`,display:"flex",gap:8}}><span style={{color:A.sky2}}>→</span>{l}</div>))}</div>)}
      </>}

      {activeTab==="seo"&&(<div className="r-section"><div className="r-title">🔍 SEO Analysis</div>{[["🎯 Primary Keywords",result.seo_keywords?.primary,A.emerald2],["📌 Secondary Keywords",result.seo_keywords?.secondary,A.sky2],["🔤 LSI Keywords",result.seo_keywords?.lsi,A.gold2]].map(([label,kws,color])=>(<div key={label} style={{marginBottom:16}}><div style={{fontSize:10,fontWeight:700,color,letterSpacing:".6px",textTransform:"uppercase",marginBottom:8}}>{label}</div><div style={{display:"flex",flexWrap:"wrap",gap:6}}>{(kws||[]).map((k,i)=>(<span key={i} className="seo-chip" style={{borderColor:`${color}40`,color,background:`${color}14`}} onClick={()=>copyText(k)}>{k}</span>))}</div></div>))}{result.seo_tips?.length>0&&(<div style={{marginTop:8}}><div style={{fontSize:10,fontWeight:700,color:A.gold2,letterSpacing:".6px",textTransform:"uppercase",marginBottom:10}}>💡 SEO Tips</div>{result.seo_tips.map((tip,i)=>(<div key={i} className="ab-tip" style={{marginBottom:7}}>💡 {tip}</div>))}</div>)}</div>)}

      {activeTab==="social"&&(<div className="r-section"><div className="r-title">📱 Social Media Snippets</div>{(result.social_snippets||[]).map((s,i)=>{const labels=["🐦 Twitter/X","💼 LinkedIn","📸 Instagram"];return(<div key={i} className="blog-section-card" style={{marginBottom:10}}><div style={{fontSize:11,fontWeight:700,color:A.emerald2,marginBottom:8}}>{labels[i]||`Platform ${i+1}`}</div><div style={{fontSize:13,color:"#3a4842",lineHeight:1.7}}>{s}</div><button className="btn-sm btn-copy" style={{marginTop:8}} onClick={()=>copyText(s)}>📋 Copy</button></div>);})}</div>)}

      {activeTab==="faq"&&(<div className="r-section"><div className="r-title">❓ FAQ Section (Schema Ready)</div>{(result.faq||[]).map((f,i)=>(<div key={i} style={{background:"rgba(255,255,255,.5)",border:`1px solid ${T.border2}`,borderRadius:12,padding:14,marginBottom:10}}><div style={{fontWeight:700,fontSize:13.5,color:A.emerald2,marginBottom:6}}>Q: {f.question}</div><div style={{fontSize:13,color:"#3a4842",lineHeight:1.7}}>A: {f.answer}</div></div>))}</div>)}
    </div>
  );
}

/* ═══════════════════════ SCRIPT TOOL ═══════════════════════ */
function ScriptTool({ showToast }) {
  const [topic,setTopic]=useState(""); const [scriptType,setScriptType]=useState(""); const [duration,setDuration]=useState("");
  const [style,setStyle]=useState(""); const [language,setLanguage]=useState("English"); const [targetAud,setTargetAud]=useState("");
  const [loading,setLoading]=useState(false); const [status,setStatus]=useState(""); const [result,setResult]=useState(null); const [activeTab,setActiveTab]=useState("scenes");

  const generate = async () => {
    if (!topic.trim()) return;
    setLoading(true); setResult(null);
    setStatus("🎬 Writing your script...");
    try {
      const data = await callAI([
        { role:"system", content:"You are a professional video scriptwriter and content strategist. Return ONLY valid JSON — no markdown, no backticks." },
        { role:"user", content:`Write a complete script:\n\nTopic: ${topic}\nType: ${scriptType||"YouTube Video"}\nDuration: ${duration||"5 min"}\nStyle: ${style||"Educational"}\nLanguage: ${language}\nTarget Audience: ${targetAud||"General"}\n\nReturn ONLY this JSON:\n{\n  "title": "Script title",\n  "type": "${scriptType||"YouTube Video"}",\n  "duration": "${duration||"5 min"}",\n  "total_words": 750,\n  "hook": "Opening hook line (first 5 seconds)",\n  "thumbnail_text": "Text to write on thumbnail",\n  "scenes": [\n    {"scene": 1, "timestamp": "0:00-0:30", "type": "Hook", "script": "Exact words to say", "action": "Camera direction", "voiceover": ""},\n    {"scene": 2, "timestamp": "0:30-1:30", "type": "Intro", "script": "Words to say", "action": "Visual direction", "voiceover": ""},\n    {"scene": 3, "timestamp": "1:30-3:00", "type": "Main Content", "script": "Main content script", "action": "Visual direction", "voiceover": ""},\n    {"scene": 4, "timestamp": "3:00-4:30", "type": "Details", "script": "Detail script", "action": "Visual direction", "voiceover": ""},\n    {"scene": 5, "timestamp": "4:30-5:00", "type": "CTA & Outro", "script": "Closing words and call to action", "action": "Outro visual", "voiceover": ""}\n  ],\n  "full_script": "Complete script as single readable text",\n  "b_roll_suggestions": ["B-roll idea 1", "B-roll idea 2", "B-roll idea 3", "B-roll idea 4"],\n  "music_suggestions": ["Background music type/mood", "Outro music suggestion"],\n  "engagement_cues": ["Engagement cue 1", "Engagement cue 2", "Engagement cue 3"],\n  "pattern_interrupts": ["Pattern interrupt idea 1 at 2:00", "Pattern interrupt idea 2 at 3:30"],\n  "titles_ab": ["Title Option A — curiosity based","Title Option B — number based","Title Option C — question based"],\n  "description_youtube": "Full YouTube description with timestamps and links placeholder",\n  "tags": ["tag1","tag2","tag3","tag4","tag5","tag6","tag7","tag8","tag9","tag10"]\n}` }
      ], 5000);
      setResult(data); setActiveTab("scenes"); setStatus(""); showToast("✅ Script ready!");
    } catch(e) { console.error(e); setStatus("❌ Error! Try again."); }
    setLoading(false);
  };

  const copyText = t => { navigator.clipboard.writeText(t); showToast("📋 Copied!"); };
  const scriptTabs=[{ id:"scenes",label:"🎬 Scenes" },{ id:"full",label:"📃 Full Script" },{ id:"production",label:"🎥 Production" },{ id:"titles",label:"✏️ Titles & Tags" }];
  const sceneColors={ "Hook":A.emerald,"Intro":A.sky2,"Main Content":A.gold2,"Details":A.sky2,"CTA & Outro":A.emerald2 };

  if (!result) return (
    <div className="form-card">
      <div className="section-header">
        <div className="section-title">🎬 Script Writer</div>
        <div className="section-sub">Professional video and podcast scripts with scene breakdowns, B-roll ideas, music suggestions and engagement cues.</div>
      </div>
      <label className="label">Topic / Title *</label>
      <textarea className="textarea" placeholder="e.g. How I grew 100k YouTube subscribers in 6 months, Top 5 productivity hacks for developers..." value={topic} onChange={e=>setTopic(e.target.value)} />
      <div className="two-col">
        <div><label className="label">Script Type</label><div className="opts">{SCRIPT_TYPES.map(t=>(<button key={t} className={`opt ${scriptType===t?"sel":""}`} onClick={()=>setScriptType(t)}>{t}</button>))}</div></div>
        <div><label className="label">Style</label><div className="opts">{SCRIPT_STYLES.map(t=>(<button key={t} className={`opt ${style===t?"sel-gold":""}`} onClick={()=>setStyle(t)}>{t}</button>))}</div></div>
      </div>
      <label className="label">Duration</label>
      <div className="opts">{SCRIPT_DURATIONS.map(d=>(<button key={d} className={`opt ${duration===d?"sel-cyan":""}`} onClick={()=>setDuration(d)}>{d}</button>))}</div>
      <div className="two-col" style={{marginTop:4}}>
        <div><label className="label">Language</label><div className="opts">{LANGUAGES.map(l=>(<button key={l} className={`opt ${language===l?"sel-violet":""}`} onClick={()=>setLanguage(l)}>{l}</button>))}</div></div>
        <div><label className="label">Target Audience (optional)</label><input className="input" placeholder="e.g. Beginners, 18-30 age group, tech enthusiasts..." value={targetAud} onChange={e=>setTargetAud(e.target.value)} /></div>
      </div>
      {loading&&(<div className="load-box"><div className="spinner"/><div><div className="load-text">{status}</div><div className="load-sub">Writing your professional script... 20-25 seconds</div><div className="provider-badge">🔄 Auto-switching providers</div></div></div>)}
      <div className="btn-row">
        <button className="btn btn-primary" disabled={loading||!topic.trim()} onClick={generate}>
          {loading?<><div className="spinner"/>Generating...</>:"🎬 Write Script"}
        </button>
      </div>
    </div>
  );

  return (
    <div className="result-wrap">
      <div className="info-strip">
        <button className="btn btn-outline btn-sm" onClick={()=>setResult(null)}>← New Script</button>
        <span className="badge gold">🎬 {result.type}</span>
        <span className="badge gold">⏱ {result.duration}</span>
        <span className="badge">📝 ~{result.total_words} words</span>
      </div>
      <div className="perf-bar">
        <div className="perf-item"><div className="perf-label">Opening Hook</div><div style={{fontSize:12.5,fontWeight:600,color:"#3a4842"}}>{result.hook}</div></div>
        <div className="perf-item" style={{minWidth:160}}><div className="perf-label">Thumbnail Text</div><div className="perf-val gold">{result.thumbnail_text}</div></div>
      </div>
      <div className="tabs">{scriptTabs.map(t=>(<button key={t.id} className={`tab ${activeTab===t.id?"active":"inactive"}`} onClick={()=>setActiveTab(t.id)}>{t.label}</button>))}</div>

      {activeTab==="scenes"&&(<div className="r-section"><div className="r-title">🎬 Scene Breakdown</div>{(result.scenes||[]).map((s,i)=>{const col=sceneColors[s.type]||A.emerald;return(<div key={i} className="scene-card"><div style={{display:"flex",gap:8,alignItems:"center",marginBottom:8}}><span className="scene-badge" style={{background:`${col}1A`,border:`1px solid ${col}40`,color:col}}>Scene {s.scene} · {s.type}</span><span className="scene-time">⏱ {s.timestamp}</span></div><div className="scene-body">{s.script}</div>{s.voiceover&&<div className="voiceover">🎙 VO: {s.voiceover}</div>}{s.action&&<div style={{fontSize:11,color:T.muted2,marginTop:8,fontStyle:"italic"}}>📹 Direction: {s.action}</div>}</div>);})}</div>)}

      {activeTab==="full"&&(<div className="r-section"><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}><div className="r-title">📃 Full Script</div><button className="btn-sm btn-copy" onClick={()=>copyText(result.full_script)}>📋 Copy All</button></div><div style={{background:"rgba(255,255,255,.5)",border:`1px solid ${T.border2}`,borderRadius:14,padding:18,fontSize:13.5,color:"#3a4842",lineHeight:2,whiteSpace:"pre-wrap"}}>{result.full_script}</div></div>)}

      {activeTab==="production"&&<>
        <div className="r-section"><div className="r-title">🎥 B-Roll Suggestions</div>{(result.b_roll_suggestions||[]).map((b,i)=>(<div key={i} style={{fontSize:13,color:"#3a4842",padding:"7px 0",borderBottom:`1px solid ${T.border2}`,display:"flex",gap:8}}><span style={{color:A.gold2}}>🎞</span>{b}</div>))}</div>
        <div className="r-section"><div className="r-title">🎵 Music Suggestions</div>{(result.music_suggestions||[]).map((m,i)=>(<div key={i} className="cta-item">🎵 {m}</div>))}</div>
        <div className="r-section"><div className="r-title">📣 Engagement Cues</div>{(result.engagement_cues||[]).map((e,i)=>(<div key={i} className="hook-item" onClick={()=>copyText(e)}><span className="hook-num">{i+1}.</span><span>{e}</span></div>))}</div>
        {result.pattern_interrupts?.length>0&&(<div className="r-section"><div className="r-title">⚡ Pattern Interrupts</div>{result.pattern_interrupts.map((p,i)=>(<div key={i} className="ab-tip" style={{marginBottom:7}}>⚡ {p}</div>))}</div>)}
        {result.description_youtube&&(<div className="r-section"><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}><div className="r-title">📋 YouTube Description</div><button className="btn-sm btn-copy" onClick={()=>copyText(result.description_youtube)}>📋 Copy</button></div><div style={{fontSize:12.5,color:"#3a4842",lineHeight:1.75,whiteSpace:"pre-wrap",background:"rgba(255,255,255,.5)",borderRadius:12,padding:14}}>{result.description_youtube}</div></div>)}
      </>}

      {activeTab==="titles"&&<>
        <div className="r-section"><div className="r-title">✏️ Title Variations (A/B Test)</div>{(result.titles_ab||[]).map((t,i)=>(<div key={i} className="hook-item" onClick={()=>copyText(t)}><span className="hook-num">{String.fromCharCode(65+i)}.</span><span>{t}</span><span className="hook-copy-hint">tap to copy</span></div>))}</div>
        {result.tags?.length>0&&(<div className="r-section"><div className="r-title">🏷️ Tags</div><button className="btn-sm btn-copy" style={{marginBottom:10}} onClick={()=>copyText(result.tags.join(", "))}>📋 Copy All Tags</button><div style={{display:"flex",flexWrap:"wrap",gap:6}}>{result.tags.map((t,i)=>(<span key={i} className="seo-chip" onClick={()=>copyText(t)}>{t}</span>))}</div></div>)}
      </>}
    </div>
  );
}

/* ═══════════════════════ STORY TOOL ═══════════════════════ */
function StoryTool({ showToast }) {
  const [prompt,setPrompt]=useState(""); const [genre,setGenre]=useState(""); const [storyType,setStoryType]=useState("");
  const [pov,setPov]=useState(""); const [setting,setSetting]=useState(""); const [language,setLanguage]=useState("English");
  const [loading,setLoading]=useState(false); const [status,setStatus]=useState(""); const [result,setResult]=useState(null); const [activeTab,setActiveTab]=useState("story");

  const generate = async () => {
    if (!prompt.trim()) return;
    setLoading(true); setResult(null);
    setStatus("📖 Writing your story...");
    try {
      const data = await callAI([
        { role:"system", content:"You are a creative fiction writer and storyteller. Return ONLY valid JSON — no markdown, no backticks." },
        { role:"user", content:`Write a creative ${storyType||"Short Story"}:\n\nPrompt/Idea: ${prompt}\nGenre: ${genre||"Drama"}\nPOV: ${pov||"Third Person"}\nSetting: ${setting||"Modern day"}\nLanguage: ${language}\n\nReturn ONLY this JSON:\n{\n  "title": "Story title",\n  "tagline": "One-line story tagline",\n  "genre": "${genre||"Drama"}",\n  "tone": "Dark/Light/Romantic/Tense etc",\n  "estimated_read": "X min read",\n  "characters": [\n    {"name": "Character 1 Name", "role": "Protagonist", "age": "25", "traits": "Key personality traits"},\n    {"name": "Character 2 Name", "role": "Antagonist", "age": "30", "traits": "Key personality traits"},\n    {"name": "Character 3 Name", "role": "Supporting", "age": "22", "traits": "Key personality traits"}\n  ],\n  "setting_description": "Vivid world/setting description",\n  "chapters": [\n    {"chapter": 1, "title": "Chapter Title", "content": "Full chapter content with dialogue and description"},\n    {"chapter": 2, "title": "Chapter Title 2", "content": "Full chapter 2 content"},\n    {"chapter": 3, "title": "Chapter Title 3", "content": "Full chapter 3 content — climax/resolution"}\n  ],\n  "full_story": "Complete story as single text",\n  "plot_outline": ["Act 1: Setup description","Act 2: Conflict/Rising action","Act 3: Climax","Act 4: Resolution"],\n  "plot_twists": ["Potential twist idea 1","Potential twist idea 2","Potential twist idea 3"],\n  "dialogue_snippets": [\n    {"characters": "Character1 to Character2", "dialogue": "Sample dialogue exchange"},\n    {"characters": "Character2 response", "dialogue": "Response dialogue"}\n  ],\n  "sequel_hook": "How this story could continue",\n  "moral": "The underlying theme or moral",\n  "writing_style_tips": ["Tip 1 to improve this kind of story", "Tip 2", "Tip 3"]\n}` }
      ], 5000);
      setResult(data); setActiveTab("story"); setStatus(""); showToast("✅ Story ready!");
    } catch(e) { console.error(e); setStatus("❌ Error! Try again."); }
    setLoading(false);
  };

  const copyText = t => { navigator.clipboard.writeText(t); showToast("📋 Copied!"); };
  const storyTabs=[{ id:"story",label:"📖 Story" },{ id:"characters",label:"👥 Characters" },{ id:"plot",label:"📐 Plot" },{ id:"extras",label:"✨ Extras" }];

  if (!result) return (
    <div className="form-card">
      <div className="section-header">
        <div className="section-title">📖 Story Generator</div>
        <div className="section-sub">Creative stories with developed characters, plot twists, vivid settings and immersive dialogue.</div>
      </div>
      <label className="label">Story Idea / Prompt *</label>
      <textarea className="textarea" style={{minHeight:110}} placeholder="e.g. A girl who can see the future but cannot prevent her own death, A scientist who discovers time travel..." value={prompt} onChange={e=>setPrompt(e.target.value)} />
      <div className="two-col">
        <div><label className="label">Genre</label><div className="opts">{STORY_GENRES.map(g=>(<button key={g} className={`opt ${genre===g?"sel":""}`} onClick={()=>setGenre(g)}>{g}</button>))}</div></div>
        <div><label className="label">Story Type</label><div className="opts">{STORY_TYPES.map(t=>(<button key={t} className={`opt ${storyType===t?"sel-gold":""}`} onClick={()=>setStoryType(t)}>{t}</button>))}</div></div>
      </div>
      <div className="two-col" style={{marginTop:4}}>
        <div><label className="label">Point of View</label><div className="opts">{STORY_POV.map(p=>(<button key={p} className={`opt ${pov===p?"sel-cyan":""}`} onClick={()=>setPov(p)}>{p}</button>))}</div></div>
        <div><label className="label">Language</label><div className="opts">{LANGUAGES.map(l=>(<button key={l} className={`opt ${language===l?"sel-violet":""}`} onClick={()=>setLanguage(l)}>{l}</button>))}</div></div>
      </div>
      <label className="label">Setting (optional)</label>
      <input className="input" placeholder="e.g. Futuristic Mumbai 2047, Medieval fantasy kingdom, Modern day Tokyo..." value={setting} onChange={e=>setSetting(e.target.value)} />
      {loading&&(<div className="load-box"><div className="spinner"/><div><div className="load-text">{status}</div><div className="load-sub">Writing your creative story... 20-30 seconds</div><div className="provider-badge">🔄 Auto-switching providers</div></div></div>)}
      <div className="btn-row">
        <button className="btn btn-primary" disabled={loading||!prompt.trim()} onClick={generate}>
          {loading?<><div className="spinner"/>Generating...</>:"📖 Generate Story"}
        </button>
      </div>
    </div>
  );

  return (
    <div className="result-wrap">
      <div className="info-strip">
        <button className="btn btn-outline btn-sm" onClick={()=>setResult(null)}>← New Story</button>
        <span className="badge violet">📖 {result.genre}</span>
        <span className="badge violet">⏱ {result.estimated_read}</span>
        <span className="badge">{result.tone}</span>
      </div>
      <div className="perf-bar">
        <div className="perf-item"><div className="perf-label">Title</div><div style={{fontSize:14,fontWeight:700,color:A.emerald2}}>{result.title}</div></div>
        <div className="perf-item" style={{flex:2}}><div className="perf-label">Tagline</div><div style={{fontSize:12.5,fontWeight:400,color:"#3a4842"}}>{result.tagline}</div></div>
      </div>
      <div className="tabs">{storyTabs.map(t=>(<button key={t.id} className={`tab ${activeTab===t.id?"active":"inactive"}`} onClick={()=>setActiveTab(t.id)}>{t.label}</button>))}</div>

      {activeTab==="story"&&<>
        {result.setting_description&&(<div className="r-section"><div className="r-title">🌍 Setting</div><div style={{fontSize:13,color:"#3a4842",lineHeight:1.75,fontStyle:"italic"}}>{result.setting_description}</div></div>)}
        {(result.chapters||[]).map((c,i)=>(<div key={i} className="chapter-card"><div className="chapter-num">Chapter {c.chapter}</div><div className="chapter-title">{c.title}</div><div className="chapter-text">{c.content}</div></div>))}
        <div className="r-section"><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}><div className="r-title">📜 Full Story</div><button className="btn-sm btn-copy" onClick={()=>copyText(result.full_story)}>📋 Copy Full</button></div><div style={{fontSize:13,color:"#3a4842",lineHeight:1.9,whiteSpace:"pre-wrap",background:"rgba(14,119,172,.05)",borderRadius:12,padding:16}}>{result.full_story}</div></div>
      </>}

      {activeTab==="characters"&&(<div className="r-section"><div className="r-title">👥 Characters</div><div style={{display:"flex",flexDirection:"column",gap:10}}>{(result.characters||[]).map((c,i)=>(<div key={i} className="char-card"><div className="char-name">{c.name}</div><div className="char-role">{c.role} · Age: {c.age}</div><div className="char-trait">{c.traits}</div></div>))}</div>{result.dialogue_snippets?.length>0&&(<div style={{marginTop:16}}><div className="r-title" style={{marginBottom:10}}>💬 Dialogue Samples</div>{result.dialogue_snippets.map((d,i)=>(<div key={i} style={{background:"rgba(14,119,172,.06)",border:"1px solid rgba(14,119,172,.16)",borderRadius:11,padding:"10px 14px",marginBottom:8}}><div style={{fontSize:10,color:A.sky2,fontWeight:700,marginBottom:5}}>{d.characters}</div><div style={{fontSize:13,color:A.sky2,fontStyle:"italic"}}>"{d.dialogue}"</div></div>))}</div>)}</div>)}

      {activeTab==="plot"&&<>
        {result.plot_outline?.length>0&&(<div className="r-section"><div className="r-title">📐 Plot Structure</div>{result.plot_outline.map((p,i)=>(<div key={i} style={{padding:"10px 14px",borderLeft:`3px solid ${A.sky2}`,background:"rgba(14,119,172,.05)",borderRadius:"0 10px 10px 0",marginBottom:8,fontSize:13,color:A.sky2,lineHeight:1.65}}>{p}</div>))}</div>)}
        {result.plot_twists?.length>0&&(<div className="r-section"><div className="r-title">🌀 Possible Plot Twists</div>{result.plot_twists.map((t,i)=>(<div key={i} className="plot-twist">🌀 {t}</div>))}</div>)}
        {result.moral&&(<div className="r-section"><div className="r-title">💡 Theme & Moral</div><div style={{fontSize:14,color:"#3a4842",lineHeight:1.7,fontStyle:"italic"}}>"{result.moral}"</div></div>)}
      </>}

      {activeTab==="extras"&&<>
        {result.sequel_hook&&(<div className="r-section"><div className="r-title">➡️ Sequel Hook</div><div style={{fontSize:13,color:"#3a4842",lineHeight:1.7}}>{result.sequel_hook}</div></div>)}
        {result.writing_style_tips?.length>0&&(<div className="r-section"><div className="r-title">✍️ Writing Tips</div>{result.writing_style_tips.map((t,i)=>(<div key={i} className="ab-tip" style={{marginBottom:7}}>💡 {t}</div>))}</div>)}
      </>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   MAIN APP
═══════════════════════════════════════════════════════ */
export default function Social() {
  const navigate = useNavigate();
  const [activeTool, setActiveTool] = useState(null);
  const [toast, setToast] = useState("");

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(""), 2500); };

  return (
    <>
      <style>{CSS}</style>
      <Helmet>
        <title>Creator Studio — AI Tools for Content Creators | MK AI</title>
        <meta name="description" content="Create viral posts, blogs, and scripts with MK AI's Creator Studio, powered by AI." />
      </Helmet>
      <div className="wrap">
        <div className="grid-bg"/>
        <div className="orb1"/><div className="orb2"/>

        <header className="header">
          <div className="logo">
            <div className="logo-icon">🎬</div>
            <span className="logo-name">MK Content Studio</span>
            <span className="logo-tag">AI POWERED</span>
          </div>
          <div className="header-right">
            {activeTool && (
              <button className="btn btn-outline" style={{padding:"7px 14px",fontSize:13}} onClick={()=>setActiveTool(null)}>← Tools</button>
            )}
            <button className="btn btn-outline" style={{padding:"7px 14px",fontSize:13}} onClick={()=>navigate("/")}>🏠 Home</button>
          </div>
        </header>

        <main className="main">
          {!activeTool ? (
            <>
              <div className="hero">
                <span className="hero-icon">🎬</span>
                <h1 className="hero-title" style={{ margin: 0 }}>MK Content Studio</h1>
                <div className="hero-sub">4 powerful AI tools — social media posts, blogs, scripts and stories — all in one place. Choose a tool and start creating.</div>
              </div>

              <div className="tool-grid">
                {TOOLS.map(tool => (
                  <div key={tool.id} className="tool-card" onClick={()=>setActiveTool(tool.id)}>
                    <div className="tool-icon">{tool.icon}</div>
                    <div style={{position:"absolute",top:14,right:14,fontSize:9,fontWeight:700,letterSpacing:"1px",padding:"3px 9px",borderRadius:10,
                      background:"rgba(15,169,104,.1)",color:A.emerald2,border:"1px solid rgba(15,169,104,.2)"}}>{tool.badge}</div>
                    <div className="tool-name">{tool.name}</div>
                    <div className="tool-desc">{tool.desc}</div>
                    <div style={{marginTop:14,display:"flex",alignItems:"center",gap:5,fontSize:12,color:A.emerald2,fontWeight:600}}>
                      Start creating <span style={{fontSize:14}}>→</span>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{textAlign:"center",marginTop:10,fontSize:12,color:T.muted2,animation:"fadeUp .6s .3s ease both"}}>
                Powered by MK AI
              </div>
            </>
          ) : (
            <>
              {activeTool==="social" && <SocialTool showToast={showToast}/>}
              {activeTool==="blog"   && <BlogTool   showToast={showToast}/>}
              {activeTool==="script" && <ScriptTool showToast={showToast}/>}
              {activeTool==="story"  && <StoryTool  showToast={showToast}/>}
            </>
          )}
        </main>

        {toast && <div className="toast">{toast}</div>}
      </div>
    </>
  );
}