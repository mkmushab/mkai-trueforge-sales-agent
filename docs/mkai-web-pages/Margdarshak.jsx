import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Helmet } from 'react-helmet-async';

/* ─────────────────────── THEME (same tokens as Home.jsx) ─────────────────────── */
const T = {
  bg: '#f6faf7', panel: '#e4f3ea', panel2: '#eef8f2',
  ink: '#122420', muted: '#5c6b64',
  emerald: '#0FA968', emerald2: '#0C8457',
  sky: '#1596D6', sky2: '#0E77AC',
  gold: '#F2A93B', mint: '#cdeedd', white: '#fffefb',
  red: '#E5484D', amber: '#F2A93B',
};

/* ─────────────────────── AI PROVIDERS ───────────────────────
   WARNING: paste your API keys below. Providers with an empty key are skipped.
   Better: proxy these calls through your backend (Railway). Client-side keys
   are visible to anyone in DevTools. Rotate any key that was pasted publicly. */
const AI_PROVIDERS = [
  { name: 'GeneralCompute', url: 'https://api.generalcompute.com/v1/chat/completions', key: 'YOUR_API_KEY_PLACEHOLDER', model: 'gpt-oss-120b', type: 'openai' },
  { name: 'Groq', url: 'https://api.groq.com/openai/v1/chat/completions', key: 'YOUR_API_KEY_PLACEHOLDER', model: 'qwen/qwen3-32b', type: 'openai' },
  { name: 'Cohere', url: 'https://api.cohere.com/v2/chat', model: 'command-r-plus', type: 'cohere', key: 'YOUR_API_KEY_PLACEHOLDER' },
  { name: 'Mistral', url: 'https://api.mistral.ai/v1/chat/completions', model: 'mistral-large-latest', type: 'openai', key: 'YOUR_API_KEY_PLACEHOLDER' },
  { name: 'Novita', url: 'https://api.novita.ai/v3/openai/chat/completions', model: 'meta-llama/llama-3.3-70b-instruct', type: 'openai', key: 'YOUR_API_KEY_PLACEHOLDER' },
  { name: 'DeepInfra', url: 'https://api.deepinfra.com/v1/openai/chat/completions', model: 'meta-llama/Llama-3.3-70B-Instruct', type: 'openai', key: 'YOUR_API_KEY_PLACEHOLDER' },
  { name: 'SambaNova', url: 'https://api.sambanova.ai/v1/chat/completions', model: 'Meta-Llama-3.3-70B-Instruct', type: 'openai', key: 'YOUR_API_KEY_PLACEHOLDER' },
  { name: 'OpenRouter', url: 'https://openrouter.ai/api/v1/chat/completions', model: 'meta-llama/llama-3.3-70b-instruct', type: 'openai', key: 'YOUR_API_KEY_PLACEHOLDER', extraHeaders: { 'HTTP-Referer': 'https://totus.tech', 'X-Title': 'Totus' } },
];

const PRIMARY_PROVIDER_NAME = 'GeneralCompute';
let rrIndex = 0;
const failCounts = Object.fromEntries(AI_PROVIDERS.map(p => [p.name, 0]));
const MAX_FAILS = 3;
const hasKey = p => typeof p.key === 'string' && p.key.trim().length > 0;

function getNextProvider() {
  const fallbacks = AI_PROVIDERS.filter(p => p.name !== PRIMARY_PROVIDER_NAME && hasKey(p));
  const total = fallbacks.length;
  if (!total) return null;
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
  if (provider.type === 'cohere') {
    const system = messages.find(m => m.role === 'system');
    const chat = messages.filter(m => m.role !== 'system');
    const res = await fetch(provider.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${provider.key}` },
      body: JSON.stringify({
        model: provider.model,
        preamble: system?.content || '',
        chat_history: chat.slice(0, -1).map(m => ({ role: m.role === 'user' ? 'USER' : 'CHATBOT', message: m.content })),
        message: chat[chat.length - 1]?.content || '',
        max_tokens: 3500,
        temperature: 0.5,
      }),
    });
    if (!res.ok) throw new Error(`Cohere HTTP ${res.status}`);
    const data = await res.json();
    const text = data?.text || data?.message?.content?.[0]?.text;
    if (!text) throw new Error('Cohere empty');
    return text;
  }
  const res = await fetch(provider.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${provider.key}`, ...(provider.extraHeaders || {}) },
    body: JSON.stringify({ model: provider.model, messages, max_tokens: 3500, temperature: 0.5 }),
  });
  if (!res.ok) throw new Error(`${provider.name} HTTP ${res.status}`);
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error(`${provider.name} empty`);
  return text;
}

async function callAIMessages(messages) {
  if (!AI_PROVIDERS.some(hasKey)) {
    throw new Error('No AI provider API key is configured. Add at least one key in AI_PROVIDERS.');
  }
  const tried = new Set();
  const primary = AI_PROVIDERS.find(p => p.name === PRIMARY_PROVIDER_NAME) || AI_PROVIDERS[0];
  if (hasKey(primary) && failCounts[primary.name] < MAX_FAILS) {
    tried.add(primary.name);
    try {
      const text = await callProviderOnce(primary, messages);
      failCounts[primary.name] = 0;
      return text;
    } catch (err) {
      console.warn(err);
      failCounts[primary.name]++;
      await new Promise(r => setTimeout(r, 500));
    }
  }
  for (let attempt = 0; attempt < AI_PROVIDERS.length; attempt++) {
    const provider = getNextProvider();
    if (!provider) break;
    if (tried.has(provider.name)) continue;
    tried.add(provider.name);
    try {
      const text = await callProviderOnce(provider, messages);
      failCounts[provider.name] = 0;
      return text;
    } catch (err) {
      console.warn(err);
      failCounts[provider.name]++;
      await new Promise(r => setTimeout(r, 500));
    }
  }
  throw new Error('All AI providers failed. Please try again.');
}

async function callAI(prompt, systemMsg) {
  return callAIMessages([
    { role: 'system', content: systemMsg || 'You are an expert educational mentor. Return ONLY valid JSON — no markdown, no backticks.' },
    { role: 'user', content: prompt },
  ]);
}

/* Robust JSON extraction: strips <think> blocks (qwen3) and code fences */
function parseJSON(text) {
  const clean = String(text).replace(/<think>[\s\S]*?<\/think>/g, '').replace(/```json|```/g, '');
  const m = clean.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('No JSON found');
  return JSON.parse(m[0]);
}

/* ─────────────────────── SPACED REPETITION ─────────────────────── */
function injectSpacedRepetition(planResult, weakGaps) {
  if (!planResult?.weekly_plan || !weakGaps?.length) return planResult;
  const weakTopics = weakGaps.map(g => (g.topic || '').toLowerCase()).filter(Boolean);
  if (!weakTopics.length) return planResult;
  const flat = [];
  planResult.weekly_plan.forEach(week => (week.days || []).forEach(day => flat.push({ day })));
  flat.forEach((entry, idx) => {
    const topics = entry.day.topics || [];
    const matched = topics.find(t => weakTopics.some(w => t.toLowerCase().includes(w) || w.includes(t.toLowerCase())));
    if (matched) {
      [3, 7].forEach(offset => {
        const target = flat[idx + offset];
        if (target) {
          target.day.tasks = target.day.tasks || [];
          const label = `🔁 Spaced revisit: ${matched}`;
          if (!target.day.tasks.includes(label)) target.day.tasks.push(label);
        }
      });
    }
  });
  return planResult;
}

/* ─────────────────────── PDF EXPORT (light, emerald theme) ─────────────────────── */
const loadJsPDF = () => new Promise((res, rej) => {
  if (window.jspdf) return res();
  const el = document.createElement('script');
  el.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
  el.onload = res; el.onerror = rej;
  document.head.appendChild(el);
});

async function exportJourneyPDF({ subject, gapReport, planResult, mentorResult, language, initialScorePct, retestScorePct }) {
  await loadJsPDF();
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ format: 'a4', unit: 'mm' });
  const W = 210, M = 16;
  let y = 0;
  const rgb = hex => { const h = hex.replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; };
  const EM = '0C8457', SKY = '0E77AC', GOLD = 'C98418', RED = 'C93A3F', INK = '122420', MUTED = '4A5A53', PAGE = 'F6FAF7';
  // jsPDF's built-in font can't render arrows/emoji — keep text ASCII-safe
  const safe = s => String(s ?? '').replace(/[→]/g, '->').replace(/[^\x00-\x7F\u00A0-\u00FF]/g, '');

  const paintPage = () => { doc.setFillColor(...rgb(PAGE)); doc.rect(0, 0, W, 297, 'F'); };
  const newPage = () => {
    doc.addPage(); paintPage();
    doc.setFillColor(...rgb(EM)); doc.rect(0, 0, W, 9, 'F');
    doc.setTextColor(255, 255, 255); doc.setFontSize(7.5); doc.setFont('helvetica', 'bold');
    doc.text('MARGDARSHAK AI - Learning Journey Report', M, 6);
    doc.text(safe(`${subject} | ${new Date().toLocaleDateString()}`), W - M, 6, { align: 'right' });
    y = 20;
  };
  const chk = (n = 16) => { if (y + n > 278) newPage(); };
  const heading = (text, color = EM) => {
    chk(14); doc.setFillColor(...rgb(color)); doc.roundedRect(M, y - 5, W - M * 2, 9, 2, 2, 'F');
    doc.setTextColor(255, 255, 255); doc.setFontSize(10); doc.setFont('helvetica', 'bold');
    doc.text(safe(text), M + 4, y + 1); y += 12;
  };
  const para = (text, color = MUTED, bold = false) => {
    if (!text) return;
    doc.setTextColor(...rgb(color)); doc.setFontSize(9.5); doc.setFont('helvetica', bold ? 'bold' : 'normal');
    const lines = doc.splitTextToSize(safe(text), W - M * 2);
    chk(lines.length * 5 + 4); doc.text(lines, M, y); y += lines.length * 5 + 3;
  };
  const bullet = (items = [], color = INK, dot = EM) => {
    (items || []).forEach(item => {
      const lines = doc.splitTextToSize(safe(item), W - M * 2 - 8);
      chk(lines.length * 5 + 3);
      doc.setFillColor(...rgb(dot)); doc.circle(M + 2.5, y - 1.2, 1.1, 'F');
      doc.setTextColor(...rgb(color)); doc.setFontSize(9.5); doc.setFont('helvetica', 'normal');
      doc.text(lines, M + 7, y); y += lines.length * 5 + 1.5;
    }); y += 2;
  };

  // Cover
  paintPage();
  doc.setFillColor(...rgb(EM)); doc.rect(0, 0, W, 110, 'F');
  doc.setFillColor(...rgb(SKY)); doc.triangle(W, 0, W, 110, 90, 110, 'F');
  doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
  doc.text('MK AI  |  MARGDARSHAK AI', M, 30);
  doc.setFontSize(30); doc.text('Learning Journey', M, 60); doc.text('Report', M, 74);
  doc.setFontSize(11); doc.setFont('helvetica', 'normal');
  doc.text('Diagnose. Plan. Guide.', M, 92);
  doc.setTextColor(...rgb(INK)); doc.setFontSize(13); doc.setFont('helvetica', 'bold');
  doc.text(safe('Subject: ' + subject), M, 135);
  doc.setFont('helvetica', 'normal'); doc.setTextColor(...rgb(MUTED));
  doc.text(safe('Guidance language: ' + language), M, 145);
  if (initialScorePct != null) doc.text(`Diagnostic score: ${initialScorePct}%`, M, 155);
  if (retestScorePct != null) {
    doc.setTextColor(...rgb(EM)); doc.setFont('helvetica', 'bold');
    doc.text(`Progress: ${initialScorePct}% -> ${retestScorePct}%`, M, 165);
  }
  doc.setTextColor(...rgb(MUTED)); doc.setFontSize(8); doc.setFont('helvetica', 'normal');
  doc.text('Generated by MK AI | ' + new Date().toLocaleDateString(), M, 282);

  newPage();
  heading('STEP 1 - SKILL GAP REPORT');
  para(gapReport?.summary);
  if (gapReport?.strengths?.length) { heading('Strengths', EM); bullet(gapReport.strengths, INK, EM); }
  if (gapReport?.weakGaps?.length) {
    heading('Weak areas to fix', RED);
    bullet(gapReport.weakGaps.map(g => `${g.topic} (${g.severity}) - ${g.why || ''}${g.rootCause ? ' | Root cause: ' + g.rootCause : ''}`), INK, RED);
  }
  if (gapReport?.prerequisites?.length) { heading('Revisit first', GOLD); bullet(gapReport.prerequisites, INK, GOLD); }

  newPage();
  heading('STEP 2 - ADAPTIVE STUDY PLAN');
  para(planResult?.overview);
  (planResult?.weekly_plan || []).forEach(week => {
    heading('Week ' + week.week + ': ' + week.theme, SKY);
    (week.days || []).forEach(day => {
      para('Day ' + day.day + ' (' + day.duration + '): ' + (day.topics || []).join(', '), INK, true);
      bullet(day.tasks, MUTED, EM);
    });
  });

  newPage();
  heading('STEP 3 - CAREER GUIDANCE (' + language + ')');
  para('Note: regional-language text may not render in the PDF; view it in the app.', MUTED);
  para(mentorResult?.greeting);
  (mentorResult?.career_paths || []).forEach(cp => {
    heading(cp.title || 'Career path', SKY);
    para(cp.why_fit);
    para('First step: ' + (cp.first_step || ''), GOLD, true);
  });
  if (mentorResult?.next_actions?.length) { heading('Next actions', EM); bullet(mentorResult.next_actions, INK, EM); }
  para(mentorResult?.closing_message, GOLD);

  if (retestScorePct != null) {
    newPage();
    heading('PROGRESS TRACKING', EM);
    para(`Before starting the plan: ${initialScorePct}% on the diagnostic quiz.`);
    para(`After completing the plan: ${retestScorePct}% on the same quiz.`);
    const diff = retestScorePct - initialScorePct;
    para(`Improvement: ${diff >= 0 ? '+' : ''}${diff} percentage points.`, EM, true);
  }

  doc.save('Margdarshak_Journey_' + subject.replace(/\s+/g, '_') + '.pdf');
}

/* ─────────────────────── LANGUAGES (mentor output language) ─────────────────────── */
const LANGUAGES = [
  { code: 'en', label: 'English', speech: 'en-IN' },
  { code: 'hi', label: 'हिंदी (Hindi)', speech: 'hi-IN' },
  { code: 'hinglish', label: 'Hinglish', speech: 'hi-IN' },
  { code: 'bn', label: 'বাংলা (Bengali)', speech: 'bn-IN' },
  { code: 'ta', label: 'தமிழ் (Tamil)', speech: 'ta-IN' },
  { code: 'te', label: 'తెలుగు (Telugu)', speech: 'te-IN' },
  { code: 'mr', label: 'मराठी (Marathi)', speech: 'mr-IN' },
  { code: 'gu', label: 'ગુજરાતી (Gujarati)', speech: 'gu-IN' },
  { code: 'pa', label: 'ਪੰਜਾਬੀ (Punjabi)', speech: 'pa-IN' },
  { code: 'kn', label: 'ಕನ್ನಡ (Kannada)', speech: 'kn-IN' },
];

/* ─────────────────────── VOICE HELPERS ─────────────────────── */
function useSpeechToText() {
  const recogRef = useRef(null);
  const [listening, setListening] = useState(false);
  const start = useCallback((lang, onResult) => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert("Voice input isn't supported in this browser. Try Chrome."); return; }
    const recog = new SR();
    recog.lang = lang || 'en-IN';
    recog.interimResults = false;
    recog.maxAlternatives = 1;
    recog.onresult = (e) => { onResult(e.results[0][0].transcript); setListening(false); };
    recog.onerror = () => setListening(false);
    recog.onend = () => setListening(false);
    recogRef.current = recog;
    setListening(true);
    recog.start();
  }, []);
  const stop = useCallback(() => { recogRef.current?.stop(); setListening(false); }, []);
  return { listening, start, stop };
}

function MicButton({ lang, onResult }) {
  const { listening, start, stop } = useSpeechToText();
  return (
    <button type="button" className={`mg-mic-btn ${listening ? 'listening' : ''}`}
      onClick={() => (listening ? stop() : start(lang, onResult))}
      title="Voice input" aria-label="Voice input">
      {listening ? '🔴' : '🎤'}
    </button>
  );
}

function SpeakButton({ text, lang, label = '🔊 Listen' }) {
  const [speaking, setSpeaking] = useState(false);
  const toggle = () => {
    if (!window.speechSynthesis) { alert("Text-to-speech isn't supported in this browser."); return; }
    if (speaking) { window.speechSynthesis.cancel(); setSpeaking(false); return; }
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = lang || 'en-IN';
    utter.rate = 0.95;
    utter.onend = () => setSpeaking(false);
    utter.onerror = () => setSpeaking(false);
    setSpeaking(true);
    window.speechSynthesis.speak(utter);
  };
  return <button type="button" className="mg-speak-btn" onClick={toggle}>{speaking ? '⏸ Stop' : label}</button>;
}

/* Circular score ring */
function ScoreRing({ pct, size = 96, label = 'Score' }) {
  const r = 40, c = 2 * Math.PI * r;
  const off = c - (Math.max(0, Math.min(100, pct)) / 100) * c;
  return (
    <div className="mg-ring" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" width={size} height={size}>
        <defs>
          <linearGradient id="mgRingGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={T.emerald} /><stop offset="100%" stopColor={T.sky} />
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(18,54,42,.08)" strokeWidth="9" />
        <circle cx="50" cy="50" r={r} fill="none" stroke="url(#mgRingGrad)" strokeWidth="9" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={off} transform="rotate(-90 50 50)" style={{ transition: 'stroke-dashoffset .8s ease' }} />
      </svg>
      <div className="mg-ring-text"><b>{pct}%</b><span>{label}</span></div>
    </div>
  );
}

/* ─────────────────────── PROGRESS HELPERS ─────────────────────── */
function computeStreak(planResult, completedDays) {
  if (!planResult?.weekly_plan) return 0;
  let streak = 0;
  outer:
  for (const week of planResult.weekly_plan) {
    for (const day of week.days || []) {
      if (completedDays[`${week.week}-${day.day}`]) streak++;
      else break outer;
    }
  }
  return streak;
}
function computeTotals(planResult, completedDays) {
  if (!planResult?.weekly_plan) return { done: 0, total: 0 };
  let total = 0, done = 0;
  planResult.weekly_plan.forEach(week => (week.days || []).forEach(day => {
    total++;
    if (completedDays[`${week.week}-${day.day}`]) done++;
  }));
  return { done, total };
}

/* New key + version: old saved data from earlier builds is ignored instead of crashing the page */
const STORAGE_KEY = 'margdarshak_progress_v3';
const OLD_STORAGE_KEYS = ['margdarshak_progress_v2'];
const STORAGE_VERSION = 3;

const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);

/* ─────────────────────── CSS ───────────────────────
   NOTE: backdrop-filter was removed from the large panels. Stacking many
   backdrop-filter layers can make Chrome skip painting them (blank page).
   The panels already have a near-opaque glass background, so the look is the same. */
const STATIC_CSS = `
.mg-wrap{
  --bg:${T.bg};--panel:${T.panel};--ink:${T.ink};--muted:${T.muted};
  --em:${T.emerald};--em2:${T.emerald2};--sky:${T.sky};--sky2:${T.sky2};--gold:${T.gold};--mint:${T.mint};
  --line:rgba(18,54,42,.10);
  --glass:linear-gradient(135deg,rgba(255,255,255,.88),rgba(255,255,255,.62));
  --glass-b:rgba(255,255,255,.8);
  --glass-s:0 10px 34px rgba(15,90,70,.12),inset 0 1px 0 rgba(255,255,255,.55);
  --shadow:0 24px 70px rgba(15,90,70,.10);
  min-height:100vh;position:relative;overflow-x:hidden;color:var(--ink);
  font-family:Inter,ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif;
  background:radial-gradient(circle at 15% 10%,rgba(15,169,104,.10),transparent 26rem),radial-gradient(circle at 90% 60%,rgba(21,150,214,.08),transparent 24rem),var(--bg);
}
.mg-wrap *,.mg-wrap *::before,.mg-wrap *::after{box-sizing:border-box}
.mg-wrap button,.mg-wrap input,.mg-wrap select,.mg-wrap textarea{font-family:inherit}
.mg-wrap :focus-visible{outline:2px solid var(--em);outline-offset:2px}
@keyframes mgFade{from{opacity:0}to{opacity:1}}
@keyframes mgUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
@keyframes mgFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
@keyframes mgSpin{to{transform:rotate(360deg)}}
@keyframes mgShimmer{0%{background-position:-300% center}100%{background-position:300% center}}
@keyframes mgPulse{0%,100%{box-shadow:0 0 0 0 rgba(229,72,77,.4)}50%{box-shadow:0 0 0 8px rgba(229,72,77,0)}}
@media(prefers-reduced-motion:reduce){.mg-wrap *{animation:none!important;transition:none!important}}

/* header */
.mg-header{position:sticky;top:0;z-index:200;display:flex;align-items:center;justify-content:space-between;padding:12px clamp(14px,4vw,32px);background:rgba(246,250,247,.96);border-bottom:1px solid var(--line)}
.mg-logo{display:flex;align-items:center;gap:10px;min-width:0}
.mg-logo-icon{width:40px;height:40px;border-radius:50%;background:linear-gradient(150deg,var(--em2),var(--sky2));display:grid;place-items:center;font-size:18px;box-shadow:0 10px 26px rgba(15,90,70,.22),inset 0 1px 0 rgba(255,255,255,.18);flex-shrink:0}
.mg-logo-name{font-size:17px;font-weight:800;letter-spacing:-.01em;color:var(--em2);white-space:nowrap}
.mg-logo-tag{font-size:11px;font-weight:600;color:var(--em2);background:rgba(15,169,104,.1);padding:4px 11px;border-radius:20px;border:1px solid rgba(15,169,104,.2)}
@media(max-width:640px){.mg-logo-tag{display:none}}
.mg-btn-back{background:rgba(255,255,255,.8);border:1px solid var(--line);color:var(--em2);padding:9px 16px;border-radius:30px;cursor:pointer;font-size:13px;font-weight:650;transition:transform .2s,background .2s}
.mg-btn-back:hover{transform:translateY(-2px);background:#fff}

.mg-main{max-width:960px;margin:0 auto;padding:22px 16px 90px;position:relative;z-index:1}

/* hero */
.mg-hero{position:relative;overflow:hidden;border-radius:30px;border:1px solid rgba(15,60,45,.06);padding:clamp(28px,5vw,52px) clamp(22px,5vw,52px);margin-bottom:22px;box-shadow:var(--shadow);
  background:radial-gradient(circle at 82% 40%,rgba(21,150,214,.18),transparent 16rem),radial-gradient(circle at 92% 88%,rgba(242,169,59,.12),transparent 12rem),linear-gradient(145deg,#eaf5ee,#f4faf6)}
.mg-hero-copy{position:relative;z-index:2;max-width:560px}
.mg-hero-pill{display:inline-flex;align-items:center;gap:8px;padding:8px 14px;border-radius:22px;background:rgba(255,255,255,.85);box-shadow:0 7px 20px rgba(15,90,70,.06);color:#3c4a44;font-size:13px;margin-bottom:20px}
.mg-hero-pill b{color:var(--em2)}
.mg-hero-title{font-size:clamp(32px,5vw,54px);line-height:1.04;letter-spacing:-.04em;font-weight:750;margin:0 0 16px;color:var(--ink)}
.mg-hero-title em{font-style:normal;color:var(--em2)}
.mg-hero-sub{font-size:15.5px;line-height:1.65;color:#586059;max-width:470px;margin:0}
.mg-orb{position:absolute;right:5%;top:50%;margin-top:-120px;width:240px;height:240px;z-index:1;animation:mgFloat 10s ease-in-out infinite}
.mg-orb-ring{position:absolute;inset:0;border-radius:50%;background:conic-gradient(from 120deg,var(--em),var(--sky),var(--gold),var(--em));filter:blur(24px);opacity:.35;animation:mgSpin 12s linear infinite}
.mg-orb-glass{position:absolute;inset:26px;border-radius:50%;background:linear-gradient(135deg,rgba(255,255,255,.85),rgba(255,255,255,.4));border:1px solid rgba(255,255,255,.75);box-shadow:0 22px 48px rgba(15,90,70,.18),inset 0 1px 0 rgba(255,255,255,.8);display:grid;place-items:center;font-size:56px}
.mg-orb-glass:before{content:"";position:absolute;top:8%;left:14%;width:40%;height:26%;border-radius:50%;background:linear-gradient(135deg,rgba(255,255,255,.9),rgba(255,255,255,0))}
@media(max-width:760px){.mg-orb{display:none}}

/* stepper */
.mg-stepper{display:flex;align-items:center;gap:8px;padding:14px clamp(12px,3vw,26px);border-radius:24px;background:var(--glass);border:1px solid var(--glass-b);box-shadow:var(--glass-s);margin-bottom:18px}
.mg-step{display:flex;align-items:center;gap:10px;cursor:pointer;background:none;border:none;padding:4px;color:inherit;text-align:left}
.mg-step:disabled{cursor:not-allowed;opacity:.55}
.mg-step-circle{width:38px;height:38px;border-radius:50%;display:grid;place-items:center;font-weight:800;font-size:15px;border:2px solid;transition:all .3s;flex-shrink:0}
.mg-step-label{font-size:13.5px;font-weight:650}
.mg-step-line{flex:1;height:3px;border-radius:9px;min-width:14px;transition:background .3s}
@media(max-width:520px){.mg-step-label{display:none}}

.mg-saved-pill{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:550;color:var(--muted);margin:0 0 14px 6px}

/* glass surfaces */
.mg-form,.mg-sblock,.mg-loading,.mg-chat-panel,.mg-mentor-bubble,.mg-r-hdr,.mg-compare-box,.mg-quiz-card{
  border-radius:24px;background:var(--glass);border:1px solid var(--glass-b);box-shadow:var(--glass-s);margin-bottom:14px}
.mg-form{padding:clamp(18px,3vw,28px);animation:mgUp .4s ease}
.mg-sblock{padding:clamp(16px,3vw,24px)}
.mg-r-hdr{padding:clamp(18px,3vw,26px);background:linear-gradient(135deg,rgba(15,169,104,.12),rgba(21,150,214,.08)),#fff}
.mg-r-hdr-row{display:flex;gap:18px;align-items:center;justify-content:space-between;flex-wrap:wrap}
.mg-r-hdr-title{font-size:clamp(19px,2.6vw,24px);font-weight:750;letter-spacing:-.02em;margin-bottom:6px}
.mg-r-hdr-sub{font-size:14px;line-height:1.65;color:var(--muted);max-width:640px}
.mg-stitle{font-size:15px;font-weight:700;margin-bottom:14px;display:flex;align-items:center;gap:8px}

/* form */
.mg-flabel{display:block;font-size:13px;font-weight:650;margin:18px 0 8px;color:var(--ink)}
.mg-flabel:first-child{margin-top:0}
.mg-input,.mg-select,.mg-textarea{width:100%;border-radius:14px;padding:13px 16px;font-size:14.5px;outline:none;transition:border-color .2s,box-shadow .2s;border:1.5px solid var(--line);background:rgba(255,255,255,.9);color:var(--ink)}
.mg-input:focus,.mg-select:focus,.mg-textarea:focus{border-color:var(--em);box-shadow:0 0 0 3px rgba(15,169,104,.16)}
.mg-textarea{resize:vertical;min-height:84px;line-height:1.6}
.mg-input-row{display:flex;gap:8px;align-items:flex-start}
.mg-input-row .mg-input,.mg-input-row .mg-textarea{flex:1;min-width:0}
.mg-mic-btn{width:46px;height:46px;border-radius:14px;border:1.5px solid var(--line);background:rgba(255,255,255,.9);cursor:pointer;font-size:17px;flex-shrink:0;transition:all .2s}
.mg-mic-btn:hover{background:#fff;border-color:var(--em)}
.mg-mic-btn.listening{background:rgba(229,72,77,.1);border-color:${T.red};animation:mgPulse 1.2s infinite}
.mg-speak-btn{padding:8px 14px;border-radius:30px;border:1px solid rgba(21,150,214,.28);background:rgba(21,150,214,.08);color:var(--sky2);cursor:pointer;font-size:12.5px;font-weight:650;transition:all .2s;flex-shrink:0;white-space:nowrap}
.mg-speak-btn:hover{background:rgba(21,150,214,.16)}

/* buttons */
.mg-gen-btn,.mg-continue-btn{width:100%;padding:16px;border-radius:35px;cursor:pointer;font-size:15px;font-weight:650;border:0;margin-top:20px;transition:transform .2s,box-shadow .2s;background:linear-gradient(135deg,var(--em),var(--sky));color:#fff;box-shadow:0 14px 30px rgba(15,150,120,.24)}
.mg-gen-btn:hover:not(:disabled),.mg-continue-btn:hover{transform:translateY(-2px);box-shadow:0 18px 38px rgba(15,150,120,.32)}
.mg-gen-btn:disabled{opacity:.42;cursor:not-allowed;box-shadow:none}
.mg-gen-btn-secondary,.mg-retake-btn{width:100%;padding:14px;border-radius:35px;cursor:pointer;font-size:14px;font-weight:650;border:1.5px dashed rgba(15,120,90,.35);background:rgba(255,255,255,.7);color:var(--em2);transition:background .2s}
.mg-retake-btn{margin-top:14px}
.mg-gen-btn-secondary:hover:not(:disabled),.mg-retake-btn:hover{background:#fff}
.mg-gen-btn-secondary:disabled{opacity:.45;cursor:not-allowed}
.mg-pdf-btn{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;padding:15px;border-radius:35px;cursor:pointer;font-size:14.5px;font-weight:650;border:0;margin-top:14px;color:#fff;background:linear-gradient(135deg,${T.gold},#E58A1F);box-shadow:0 12px 26px rgba(242,169,59,.32);transition:transform .2s}
.mg-pdf-btn:hover:not(:disabled){transform:translateY(-2px)}
.mg-pdf-btn:disabled{opacity:.5;cursor:not-allowed}
.mg-restart{text-align:center;margin-top:16px}
.mg-restart button{background:rgba(255,255,255,.8);border:1px solid var(--line);padding:10px 22px;border-radius:30px;cursor:pointer;font-size:13px;font-weight:600;color:var(--muted)}
.mg-restart button:hover{background:#fff}

/* loader */
.mg-loading{text-align:center;padding:52px 28px;animation:mgFade .4s ease}
.mg-sl-icon{font-size:48px;margin-bottom:14px;display:block;animation:mgFloat 2s ease-in-out infinite}
.mg-sl-title{font-size:19px;font-weight:750;margin-bottom:6px;letter-spacing:-.01em}
.mg-sl-sub{font-size:13.5px;margin-bottom:22px;color:var(--muted)}
.mg-sl-bar{height:4px;background:rgba(15,169,104,.12);border-radius:99px;overflow:hidden;max-width:320px;margin:0 auto}
.mg-sl-fill{height:100%;width:70%;border-radius:99px;background:linear-gradient(90deg,var(--em),var(--sky),var(--gold));background-size:300% 100%;animation:mgShimmer 1.8s linear infinite}

/* quiz */
.mg-quiz-card{padding:20px}
.mg-quiz-qt-row{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;margin-bottom:14px}
.mg-quiz-qt{font-size:15px;font-weight:600;line-height:1.6}
.mg-tag-row{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:9px}
.mg-topic-tag,.mg-bloom-tag{font-size:11.5px;font-weight:650;padding:3px 10px;border-radius:20px;display:inline-block}
.mg-topic-tag{color:var(--em2);background:rgba(15,169,104,.12)}
.mg-bloom-tag{color:var(--sky2);background:rgba(21,150,214,.12)}
.mg-opts{display:grid;grid-template-columns:1fr 1fr;gap:8px}
@media(max-width:560px){.mg-opts{grid-template-columns:1fr}}
.mg-opt-btn{padding:12px 14px;border-radius:14px;cursor:pointer;font-size:13.5px;text-align:left;transition:all .2s;border:1.5px solid var(--line);background:rgba(255,255,255,.95);color:var(--ink);line-height:1.45}
.mg-opt-btn:hover:not(:disabled){background:#fff;border-color:rgba(15,169,104,.5)}
.mg-opt-btn.sel{background:rgba(15,169,104,.14);border-color:var(--em);box-shadow:0 0 0 2px rgba(15,169,104,.14)}
.mg-opt-btn.correct{background:rgba(15,169,104,.16);border-color:var(--em);color:var(--em2)}
.mg-opt-btn.wrong{background:rgba(229,72,77,.1);border-color:${T.red};color:#B3282D}
.mg-opt-btn:disabled{cursor:default}
.mg-qprogress{height:6px;border-radius:99px;background:rgba(15,169,104,.12);overflow:hidden;margin-top:14px}
.mg-qprogress>div{height:100%;border-radius:99px;background:linear-gradient(90deg,var(--em),var(--sky));transition:width .3s}

/* ring */
.mg-ring{position:relative;flex-shrink:0}
.mg-ring-text{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;line-height:1.1}
.mg-ring-text b{font-size:22px;font-weight:800;color:var(--em2)}
.mg-ring-text span{font-size:11px;color:var(--muted);font-weight:600}

/* chips */
.mg-chip-row{display:flex;flex-wrap:wrap;gap:7px;margin:10px 0}
.mg-chip{padding:6px 13px;border-radius:20px;font-size:12.5px;font-weight:650;display:inline-block}
.mg-chip-weak{background:rgba(229,72,77,.1);color:#B3282D;border:1px solid rgba(229,72,77,.22)}
.mg-chip-strong{background:rgba(15,169,104,.12);color:var(--em2);border:1px solid rgba(15,169,104,.24)}
.mg-chip-topic{background:rgba(21,150,214,.1);color:var(--sky2)}
.mg-rootcause{font-size:12.5px;color:var(--muted);margin:4px 0 12px 6px;line-height:1.55}
.mg-next-item{font-size:13.5px;padding:5px 0;display:flex;align-items:flex-start;gap:8px;line-height:1.55}
.mg-next-item::before{content:'✓';color:var(--em);font-weight:800;flex-shrink:0}

/* language */
.mg-lang-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin:10px 0}
@media(max-width:700px){.mg-lang-grid{grid-template-columns:repeat(2,1fr)}}
.mg-lang-btn{padding:12px 8px;border-radius:14px;cursor:pointer;font-size:13px;font-weight:650;text-align:center;border:1.5px solid var(--line);background:rgba(255,255,255,.9);transition:all .2s;color:var(--ink)}
.mg-lang-btn:hover{background:#fff;border-color:rgba(15,169,104,.5)}
.mg-lang-btn.active{background:linear-gradient(135deg,var(--em),var(--sky));color:#fff;border-color:transparent;box-shadow:0 10px 22px rgba(15,150,120,.24)}
.mg-summary-box{background:rgba(15,169,104,.07);border:1px dashed rgba(15,169,104,.35);border-radius:16px;padding:14px 16px;font-size:13.5px;line-height:1.7;color:#3c4a44;margin:12px 0}

/* mentor */
.mg-mentor-bubble{padding:clamp(18px,3vw,26px);background:linear-gradient(135deg,rgba(15,169,104,.10),rgba(21,150,214,.07)),#fff}
.mg-mentor-top{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:16px}
.mg-mentor-greet{font-size:17px;font-weight:600;line-height:1.7;flex:1}
.mg-career-card{background:rgba(255,255,255,.95);border:1px solid var(--line);border-left:4px solid var(--em);border-radius:16px;padding:16px 18px;margin-bottom:10px}
.mg-career-title{font-weight:700;font-size:15px;margin-bottom:6px;color:var(--em2)}
.mg-career-why{font-size:13.5px;line-height:1.65;margin-bottom:10px;color:var(--muted)}
.mg-career-step{font-size:12.5px;font-weight:650;color:var(--sky2);background:rgba(21,150,214,.1);padding:7px 12px;border-radius:12px;display:inline-block;line-height:1.45}
.mg-closing{margin-top:14px;font-size:14px;font-style:italic;color:#7a5a17}
.mg-opportunity-links{display:flex;gap:10px;flex-wrap:wrap}
.mg-opp-link{font-size:13px;font-weight:650;color:var(--em2);text-decoration:none;background:rgba(255,255,255,.9);border:1px solid rgba(15,169,104,.25);padding:10px 16px;border-radius:30px;cursor:pointer;transition:transform .2s,background .2s}
.mg-opp-link:hover{background:#fff;transform:translateY(-2px)}

/* plan */
.mg-streak-row{display:flex;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:14px;padding:14px 18px;border-radius:22px;background:var(--glass);border:1px solid var(--glass-b);box-shadow:var(--glass-s)}
.mg-streak-badge{display:inline-flex;align-items:center;gap:6px;background:rgba(242,169,59,.16);border:1px solid rgba(242,169,59,.4);padding:6px 14px;border-radius:20px;font-size:13px;font-weight:700;color:#9A6206}
.mg-progress-outer{height:10px;border-radius:99px;background:rgba(15,169,104,.12);overflow:hidden;flex:1;min-width:120px}
.mg-progress-inner{height:100%;border-radius:99px;background:linear-gradient(90deg,var(--em),var(--sky));transition:width .4s ease}
.mg-day-row{display:flex;align-items:flex-start;gap:12px;padding:14px 0;border-bottom:1px solid var(--line)}
.mg-day-row:last-child{border-bottom:none;padding-bottom:0}
.mg-day-row:first-of-type{padding-top:0}
.mg-day-check{width:26px;height:26px;border-radius:8px;border:2px solid rgba(15,169,104,.45);cursor:pointer;flex-shrink:0;margin-top:1px;display:grid;place-items:center;font-size:13px;background:#fff;transition:all .2s;color:#fff;padding:0}
.mg-day-check:hover{border-color:var(--em)}
.mg-day-check.done{background:linear-gradient(135deg,var(--em),var(--sky));border-color:transparent}
.mg-day-head{font-size:13.5px;font-weight:700;color:var(--em2);margin-bottom:4px}
.mg-tip{margin-top:8px;font-size:12.5px;color:#8A5A05;background:rgba(242,169,59,.12);padding:8px 12px;border-radius:12px;line-height:1.55}
.mg-day-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
.mg-day-action-btn{font-size:12px;font-weight:650;padding:7px 13px;border-radius:30px;cursor:pointer;border:1px solid;background:transparent;transition:all .2s;text-decoration:none;display:inline-block}
.mg-yt-link{color:#C93A3F;border-color:rgba(201,58,63,.3);background:rgba(229,72,77,.06)}
.mg-yt-link:hover{background:rgba(229,72,77,.12)}
.mg-recall-btn{color:var(--sky2);border-color:rgba(21,150,214,.32);background:rgba(21,150,214,.07)}
.mg-recall-btn:hover{background:rgba(21,150,214,.14)}
.mg-recall-box{margin-top:12px;padding:14px;border-radius:18px;background:rgba(21,150,214,.06);border:1px solid rgba(21,150,214,.2)}
.mg-recall-q{font-size:13.5px;font-weight:600;margin-bottom:9px;line-height:1.5}

/* chat */
.mg-chat-panel{padding:18px;margin-top:14px}
.mg-chat-msgs{max-height:340px;overflow-y:auto;display:flex;flex-direction:column;gap:10px;margin-bottom:12px;padding-right:4px}
.mg-chat-msg{max-width:86%;padding:11px 15px;border-radius:18px;font-size:14px;line-height:1.6;white-space:pre-wrap;word-break:break-word}
.mg-chat-msg.user{align-self:flex-end;background:linear-gradient(135deg,var(--em),var(--sky));color:#fff;border-bottom-right-radius:6px}
.mg-chat-msg.assistant{align-self:flex-start;background:rgba(255,255,255,.95);border:1px solid var(--line);color:var(--ink);border-bottom-left-radius:6px}
.mg-chat-input-row{display:flex;gap:8px}
.mg-chat-input-row input{flex:1;min-width:0;border-radius:30px;border:1.5px solid var(--line);padding:12px 18px;font-size:14px;outline:none;background:rgba(255,255,255,.95);color:var(--ink)}
.mg-chat-input-row input:focus{border-color:var(--em);box-shadow:0 0 0 3px rgba(15,169,104,.16)}
.mg-chat-input-row .mg-mic-btn{border-radius:50%}
.mg-chat-send{background:linear-gradient(135deg,var(--em),var(--sky));color:#fff;border:none;border-radius:30px;padding:0 22px;cursor:pointer;font-weight:650;font-size:14px}
.mg-chat-send:disabled{opacity:.5;cursor:not-allowed}

/* compare */
.mg-compare-box{padding:22px;margin-top:14px;background:linear-gradient(135deg,rgba(15,169,104,.12),rgba(255,255,255,.7)),#fff}
.mg-improve-msg{text-align:center;font-size:16px;font-weight:750;color:var(--em2);margin-top:10px}

.mg-toast{position:fixed;bottom:22px;right:22px;z-index:9999;background:linear-gradient(135deg,var(--em),var(--sky));color:#fff;padding:12px 22px;border-radius:30px;font-weight:650;font-size:13.5px;box-shadow:0 14px 34px rgba(15,150,120,.34);animation:mgUp .3s ease}
@media(max-width:520px){.mg-toast{left:14px;right:14px;text-align:center;bottom:14px}}

/* error fallback */
.mg-error{max-width:520px;margin:12vh auto;padding:28px;border-radius:24px;background:#fff;border:1px solid rgba(229,72,77,.3);box-shadow:0 24px 70px rgba(15,90,70,.10);text-align:center;font-family:Inter,ui-sans-serif,system-ui,sans-serif;color:#122420}
.mg-error h2{margin:0 0 8px;font-size:20px}
.mg-error p{margin:0 0 18px;color:#5c6b64;font-size:14px;line-height:1.6}
.mg-error button{padding:12px 22px;border-radius:30px;border:0;cursor:pointer;font-weight:650;font-size:14px;color:#fff;background:linear-gradient(135deg,#0FA968,#1596D6)}
`;

const STEPS = [
  { id: 1, label: 'Diagnose', icon: '🔍' },
  { id: 2, label: 'Plan', icon: '📅' },
  { id: 3, label: 'Guide', icon: '🧭' },
];

const LOADING_TEXT = {
  quiz: { icon: '🔍', title: 'Building your diagnostic quiz…', sub: 'AI is testing your current understanding' },
  quiz2: { icon: '🎯', title: 'Calibrating Phase 2…', sub: 'Adjusting difficulty to how you did in Phase 1' },
  gap: { icon: '📊', title: 'Analyzing your skill gaps…', sub: 'Tracing weak spots back to their root cause' },
  plan: { icon: '📅', title: 'Building your study plan…', sub: 'Targeting weak areas + scheduling spaced revisits' },
  mentor: { icon: '🧭', title: 'Preparing your guidance…', sub: 'Crafting advice in your language' },
  parent: { icon: '👨‍👩‍👧', title: 'Writing a parent summary…', sub: 'Keeping it simple and encouraging' },
};

function Loader({ info }) {
  if (!info) return null;
  return (
    <div className="mg-loading" role="status" aria-live="polite">
      <span className="mg-sl-icon">{info.icon}</span>
      <div className="mg-sl-title">{info.title}</div>
      <div className="mg-sl-sub">{info.sub}</div>
      <div className="mg-sl-bar"><div className="mg-sl-fill" /></div>
    </div>
  );
}

/* ─────────────────────── ERROR BOUNDARY ───────────────────────
   If anything throws while rendering (for example bad saved data),
   the user sees a recovery screen instead of a blank page. */
class MargdarshakErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error('Margdarshak crashed:', error, info); }
  reset = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      OLD_STORAGE_KEYS.forEach(k => localStorage.removeItem(k));
    } catch (e) { /* ignore */ }
    window.location.reload();
  };
  render() {
    if (this.state.error) {
      return (
        <div className="mg-error" role="alert">
          <style>{STATIC_CSS}</style>
          <h2>Something went wrong</h2>
          <p>The page hit an error, most likely from outdated saved progress. Reset your saved progress and reload to start fresh.</p>
          <button onClick={this.reset}>Reset saved progress and reload</button>
        </div>
      );
    }
    return this.props.children;
  }
}

/* ─────────────────────── MAIN COMPONENT ─────────────────────── */
function MargdarshakPage() {
  const navigate = useNavigate();
  const resultRef = useRef(null);
  const chatEndRef = useRef(null);
  const loadedRef = useRef(false);

  const [step, setStep] = useState(1);
  const [loadingKey, setLoadingKey] = useState(null);

  // Step 1
  const [subject, setSubject] = useState('');
  const [topics, setTopics] = useState('');
  const [level, setLevel] = useState('intermediate');
  const [quiz, setQuiz] = useState(null);
  const [quizPhase, setQuizPhase] = useState(1);
  const [quizAnswers, setQuizAnswers] = useState({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [gapReport, setGapReport] = useState(null);
  const [initialScorePct, setInitialScorePct] = useState(null);

  // Step 2
  const [days, setDays] = useState('14');
  const [hoursPerDay, setHoursPerDay] = useState('2');
  const [planResult, setPlanResult] = useState(null);
  const [completedDays, setCompletedDays] = useState({});
  const [recallData, setRecallData] = useState({});

  // Step 3
  const [language, setLanguage] = useState('en');
  const [mentorResult, setMentorResult] = useState(null);
  const [parentSummary, setParentSummary] = useState(null);

  // Retest
  const [showRetest, setShowRetest] = useState(false);
  const [retestAnswers, setRetestAnswers] = useState({});
  const [retestScorePct, setRetestScorePct] = useState(null);

  // Chat
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  const [pdfLoading, setPdfLoading] = useState(false);
  const [toast, setToast] = useState('');
  const showToast = useCallback((msg) => { setToast(msg); setTimeout(() => setToast(''), 2500); }, []);

  const langObj = LANGUAGES.find(l => l.code === language) || LANGUAGES[0];

  /* ── LOAD SAVED PROGRESS (validated, so old/bad data can't crash the page) ── */
  useEffect(() => {
    try {
      OLD_STORAGE_KEYS.forEach(k => localStorage.removeItem(k));
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (isObj(saved) && saved.v === STORAGE_VERSION) {
        const okQuiz = isObj(saved.quiz) && Array.isArray(saved.quiz.questions) && saved.quiz.questions.length > 0;
        const okGap = isObj(saved.gapReport);
        const okPlan = isObj(saved.planResult) && Array.isArray(saved.planResult.weekly_plan);
        const okMentor = isObj(saved.mentorResult);

        if (typeof saved.subject === 'string') setSubject(saved.subject);
        if (typeof saved.topics === 'string') setTopics(saved.topics);
        if (['beginner', 'intermediate', 'advanced'].includes(saved.level)) setLevel(saved.level);
        if (okQuiz) {
          setQuiz(saved.quiz);
          if (saved.quizPhase === 1 || saved.quizPhase === 2) setQuizPhase(saved.quizPhase);
          if (isObj(saved.quizAnswers)) setQuizAnswers(saved.quizAnswers);
          if (saved.quizSubmitted) setQuizSubmitted(true);
        }
        if (okGap) {
          setGapReport({
            ...saved.gapReport,
            strengths: Array.isArray(saved.gapReport.strengths) ? saved.gapReport.strengths : [],
            weakGaps: Array.isArray(saved.gapReport.weakGaps) ? saved.gapReport.weakGaps : [],
          });
        }
        if (typeof saved.initialScorePct === 'number') setInitialScorePct(saved.initialScorePct);
        if (typeof saved.days === 'string') setDays(saved.days);
        if (typeof saved.hoursPerDay === 'string') setHoursPerDay(saved.hoursPerDay);
        if (okPlan) setPlanResult(saved.planResult);
        if (isObj(saved.completedDays)) setCompletedDays(saved.completedDays);
        if (LANGUAGES.some(l => l.code === saved.language)) setLanguage(saved.language);
        if (okMentor) setMentorResult(saved.mentorResult);
        if (typeof saved.parentSummary === 'string') setParentSummary(saved.parentSummary);
        if (typeof saved.retestScorePct === 'number') setRetestScorePct(saved.retestScorePct);

        // Never land on a step whose data is missing
        let s = [1, 2, 3].includes(saved.step) ? saved.step : 1;
        if (s === 3 && !okPlan) s = okGap ? 2 : 1;
        if (s === 2 && !okGap) s = 1;
        setStep(s);

        if (saved.subject || okQuiz) showToast('📂 Restored your saved progress');
      }
    } catch (e) {
      try { localStorage.removeItem(STORAGE_KEY); } catch (e2) { /* ignore */ }
    }
    loadedRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── AUTO-SAVE ── */
  useEffect(() => {
    if (!loadedRef.current) return;
    const state = { v: STORAGE_VERSION, subject, topics, level, quiz, quizPhase, quizAnswers, quizSubmitted, gapReport, initialScorePct, days, hoursPerDay, planResult, completedDays, language, mentorResult, parentSummary, retestScorePct, step };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
  }, [subject, topics, level, quiz, quizPhase, quizAnswers, quizSubmitted, gapReport, initialScorePct, days, hoursPerDay, planResult, completedDays, language, mentorResult, parentSummary, retestScorePct, step]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatMessages]);

  const scrollToResult = () => setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);

  /* ── PHASE 1 ── */
  const generateQuiz = useCallback(async () => {
    if (!subject.trim()) return;
    setLoadingKey('quiz'); setQuiz(null); setQuizAnswers({}); setQuizSubmitted(false); setGapReport(null); setQuizPhase(1);
    const prompt = `Create a 6-question diagnostic MCQ quiz (Phase 1 — baseline check) to test a student's understanding.
Subject: ${subject}
Topics covered: ${topics || subject}
Level: ${level}
Mix easy and medium difficulty. Tag each question with the specific sub-topic it tests AND a Bloom's Taxonomy level (Remember, Understand, Apply, or Analyze).
Return ONLY JSON: {"questions":[{"q_no":1,"topic":"specific sub-topic name","bloom":"Remember","difficulty":"Easy","question":"q","options":{"A":"a","B":"b","C":"c","D":"d"},"correct":"A"}]}`;
    try {
      const data = parseJSON(await callAI(prompt));
      if (!data.questions?.length) throw new Error('empty');
      setQuiz(data);
    } catch (e) { console.error(e); alert(`Could not generate the quiz. ${e.message || 'Please try again.'}`); }
    setLoadingKey(null);
  }, [subject, topics, level]);

  /* ── PHASE 2 ── */
  const generateQuizPhase2 = useCallback(async () => {
    if (!quiz) return;
    const p1Correct = quiz.questions.filter(q => quizAnswers[q.q_no] === q.correct).length;
    const p1Pct = Math.round((p1Correct / quiz.questions.length) * 100);
    setLoadingKey('quiz2');
    const difficultyTarget = p1Pct >= 70
      ? 'Hard — testing Apply and Analyze level thinking, since they did well on the basics'
      : p1Pct <= 35
      ? 'Easy to Medium — revisiting foundational sub-topics they seem shaky on'
      : 'Medium — a balanced mix';
    const startNo = quiz.questions.length + 1;
    const prompt = `A student just scored ${p1Pct}% on Phase 1 of a diagnostic quiz on ${subject} (${level} level).
Generate 4 more MCQ questions for Phase 2, calibrated to: ${difficultyTarget}.
Continue numbering q_no starting at ${startNo}.
Tag each with the specific sub-topic and a Bloom's Taxonomy level (Remember, Understand, Apply, Analyze).
Avoid repeating topics already tested: ${quiz.questions.map(q => q.topic).join(', ')}.
Return ONLY JSON: {"questions":[{"q_no":${startNo},"topic":"name","bloom":"Apply","difficulty":"Medium","question":"q","options":{"A":"a","B":"b","C":"c","D":"d"},"correct":"A"}]}`;
    try {
      const p2 = parseJSON(await callAI(prompt));
      if (!p2.questions?.length) throw new Error('empty');
      setQuiz(prev => ({ questions: [...prev.questions, ...p2.questions] }));
      setQuizPhase(2);
    } catch (e) { console.error(e); alert(`Could not generate Phase 2. ${e.message || 'Please try again.'}`); }
    setLoadingKey(null);
  }, [quiz, quizAnswers, subject, level]);

  /* ── GAP ANALYSIS ── */
  const analyzeGaps = useCallback(async () => {
    if (!quiz) return;
    setQuizSubmitted(true);
    const wrongQs = quiz.questions.filter(q => quizAnswers[q.q_no] !== q.correct);
    const correctQs = quiz.questions.filter(q => quizAnswers[q.q_no] === q.correct);
    const scorePct = Math.round((correctQs.length / quiz.questions.length) * 100);
    setInitialScorePct(scorePct);
    setLoadingKey('gap');
    const wrongDetail = wrongQs.map(q => `${q.topic} (Bloom: ${q.bloom || 'N/A'})`).join(', ') || 'none';
    const correctDetail = correctQs.map(q => `${q.topic} (Bloom: ${q.bloom || 'N/A'})`).join(', ') || 'none';
    const prompt = `A student took a two-phase adaptive diagnostic quiz on ${subject} (${level} level).
Topics + Bloom's level they got WRONG: ${wrongDetail}
Topics + Bloom's level they got RIGHT: ${correctDetail}
Generate a structured skill-gap report. For each weak area, trace it back to the underlying root-cause prerequisite concept — don't just restate the surface topic, explain what earlier concept they likely need to revisit.
Return ONLY JSON: {"summary":"2-3 sentence overview of where they stand, mentioning whether they struggle more with recall or with application","strengths":["topic1","topic2"],"weakGaps":[{"topic":"name","severity":"High/Medium/Low","why":"short reason","rootCause":"the underlying prerequisite concept causing this gap"}],"prerequisites":["concept student should revisit first"]}`;
    try {
      const data = parseJSON(await callAI(prompt));
      data.strengths = Array.isArray(data.strengths) ? data.strengths : [];
      data.weakGaps = Array.isArray(data.weakGaps) ? data.weakGaps : [];
      setGapReport(data);
      scrollToResult();
    } catch (e) { console.error(e); alert(`Gap analysis failed. ${e.message || 'Please try again.'}`); setQuizSubmitted(false); }
    setLoadingKey(null);
  }, [quiz, quizAnswers, subject, level]);

  /* ── PLAN ── */
  const generatePlan = useCallback(async () => {
    if (!gapReport) return;
    setLoadingKey('plan'); setPlanResult(null); setCompletedDays({}); setRecallData({});
    const weakList = gapReport.weakGaps.map(g => `${g.topic} (${g.severity} priority)`).join(', ');
    const prompt = `Create a ${days}-day adaptive study plan targeting these specific weak areas first, then reinforcing strengths.
Subject: ${subject}
Level: ${level}
Weak areas to prioritize: ${weakList}
Prerequisites to cover early: ${(gapReport.prerequisites || []).join(', ')}
Hours available per day: ${hoursPerDay}
Return ONLY JSON: {"overview":"2 sentence plan overview","weekly_plan":[{"week":1,"theme":"theme","days":[{"day":1,"topics":["t1"],"tasks":["t1"],"duration":"${hoursPerDay} hours","tip":"tip"}]}]}`;
    try {
      const parsed = parseJSON(await callAI(prompt));
      if (!Array.isArray(parsed.weekly_plan)) throw new Error('Plan format was invalid');
      setPlanResult(injectSpacedRepetition(parsed, gapReport.weakGaps));
      scrollToResult();
    } catch (e) { console.error(e); alert(`Could not generate the study plan. ${e.message || 'Please try again.'}`); }
    setLoadingKey(null);
  }, [gapReport, subject, level, days, hoursPerDay]);

  const toggleDayComplete = useCallback((week, day) => {
    setCompletedDays(prev => {
      const key = `${week}-${day}`;
      return { ...prev, [key]: !prev[key] };
    });
  }, []);

  /* ── RECALL ── */
  const generateRecall = useCallback(async (weekNum, dayNum, dayTopics) => {
    const key = `${weekNum}-${dayNum}`;
    setRecallData(prev => ({ ...prev, [key]: { ...(prev[key] || {}), loading: true } }));
    const prompt = `Create 2 quick MCQ recall questions to check if a student remembers what they just studied.
Topics: ${(dayTopics || []).join(', ')}
Subject: ${subject}
Return ONLY JSON: {"questions":[{"q_no":1,"question":"q","options":{"A":"a","B":"b","C":"c","D":"d"},"correct":"A"}]}`;
    try {
      const parsed = parseJSON(await callAI(prompt));
      setRecallData(prev => ({ ...prev, [key]: { questions: parsed.questions || [], answers: {}, loading: false, done: false } }));
    } catch (e) {
      console.error(e);
      setRecallData(prev => { const n = { ...prev }; delete n[key]; return n; });
      alert(`Could not generate the recall quiz. ${e.message || 'Please try again.'}`);
    }
  }, [subject]);

  const answerRecall = useCallback((key, qNo, opt) => {
    setRecallData(prev => {
      const entry = prev[key];
      if (!entry) return prev;
      const nextAnswers = { ...entry.answers, [qNo]: opt };
      const done = entry.questions.every(q => nextAnswers[q.q_no] != null);
      return { ...prev, [key]: { ...entry, answers: nextAnswers, done } };
    });
  }, []);

  /* ── MENTOR ── */
  const generateMentorGuidance = useCallback(async () => {
    setLoadingKey('mentor'); setMentorResult(null); setChatMessages([]); setParentSummary(null);
    const strengths = (gapReport?.strengths || []).join(', ');
    const weak = (gapReport?.weakGaps || []).map(g => g.topic).join(', ');
    const prompt = `You are a warm, encouraging career and skilling mentor for an Indian student. Respond entirely in ${langObj.label} (if Hinglish, mix Hindi+English naturally like everyday conversation; if a regional language, write in that language's native script).
Student profile — Subject: ${subject}, Level: ${level}, Strengths: ${strengths}, Weak areas: ${weak}.
Give personalized career path suggestions that fit their strengths, and concrete next skilling steps.
Return ONLY JSON (keep all text values in ${langObj.label}): {"greeting":"warm personal opening line","career_paths":[{"title":"career path name","why_fit":"why it fits them","first_step":"one concrete first action"}],"next_actions":["action1","action2","action3"],"closing_message":"encouraging closing line"}`;
    try {
      const data = parseJSON(await callAI(prompt, 'You are a multilingual career mentor. Always return ONLY valid JSON, no markdown, no backticks, regardless of the response language.'));
      setMentorResult(data);
      scrollToResult();
    } catch (e) { console.error(e); alert(`Could not generate guidance. ${e.message || 'Please try again.'}`); }
    setLoadingKey(null);
  }, [langObj, gapReport, subject, level]);

  const generateParentSummary = useCallback(async () => {
    setLoadingKey('parent');
    const prompt = `Write a short, warm summary (in ${langObj.label}) for a parent or guardian explaining:
1) What subject their child (${subject}) is working on and their current level (${level}).
2) Their child's key strengths: ${(gapReport?.strengths || []).join(', ') || 'still building up'}.
3) Areas needing support: ${(gapReport?.weakGaps || []).map(g => g.topic).join(', ') || 'general practice'}.
4) The recommended career direction: ${(mentorResult?.career_paths || []).map(c => c.title).join(', ') || 'still exploring options'}.
Keep it simple, non-technical, encouraging, about 5-6 sentences, entirely in ${langObj.label}.
Return ONLY JSON: {"parent_summary":"the text"}`;
    try {
      const data = parseJSON(await callAI(prompt, 'You are explaining a student learning report to a parent in simple language. Always return ONLY valid JSON.'));
      setParentSummary(data.parent_summary);
    } catch (e) { console.error(e); alert(`Could not generate the parent summary. ${e.message || 'Please try again.'}`); }
    setLoadingKey(null);
  }, [langObj, subject, level, gapReport, mentorResult]);

  /* ── CHAT ── */
  const sendChatMessage = useCallback(async (textOverride) => {
    const text = (typeof textOverride === 'string' ? textOverride : chatInput).trim();
    if (!text || chatLoading) return;
    const newMessages = [...chatMessages, { role: 'user', content: text }];
    setChatMessages(newMessages);
    setChatInput('');
    setChatLoading(true);
    const systemMsg = `You are a friendly, patient mentor helping an Indian student with ${subject} (${level} level). Always respond in ${langObj.label} — plain text, no JSON, no markdown formatting. Keep answers short (3-5 sentences) and encouraging. Student's known weak areas: ${(gapReport?.weakGaps || []).map(g => g.topic).join(', ') || 'none noted'}.`;
    try {
      const messages = [{ role: 'system', content: systemMsg }, ...newMessages.map(m => ({ role: m.role, content: m.content }))];
      const reply = (await callAIMessages(messages)).replace(/<think>[\s\S]*?<\/think>/g, '').trim();
      setChatMessages([...newMessages, { role: 'assistant', content: reply }]);
    } catch (e) {
      console.error(e);
      setChatMessages([...newMessages, { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' }]);
    }
    setChatLoading(false);
  }, [chatInput, chatMessages, chatLoading, subject, level, langObj, gapReport]);

  /* ── RETEST ── */
  const submitRetest = useCallback(() => {
    if (!quiz) return;
    const correct = quiz.questions.filter(q => retestAnswers[q.q_no] === q.correct).length;
    setRetestScorePct(Math.round((correct / quiz.questions.length) * 100));
  }, [quiz, retestAnswers]);

  const handlePDF = useCallback(async () => {
    setPdfLoading(true);
    try {
      await exportJourneyPDF({ subject, gapReport, planResult, mentorResult, language: langObj.label, initialScorePct, retestScorePct });
      showToast('📄 Report downloaded!');
    } catch (e) { console.error(e); alert('PDF export failed. Please try again.'); }
    setPdfLoading(false);
  }, [subject, gapReport, planResult, mentorResult, langObj, initialScorePct, retestScorePct, showToast]);

  const restart = useCallback(() => {
    setStep(1); setQuiz(null); setQuizPhase(1); setQuizAnswers({}); setQuizSubmitted(false);
    setGapReport(null); setInitialScorePct(null); setPlanResult(null); setCompletedDays({}); setRecallData({});
    setMentorResult(null); setParentSummary(null); setShowRetest(false); setRetestAnswers({}); setRetestScorePct(null);
    setChatMessages([]); setSubject(''); setTopics('');
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* ignore */ }
  }, []);

  const canGoToStep = (n) => (n === 1 ? true : n === 2 ? !!gapReport : n === 3 ? !!planResult : false);
  const loadingInfo = loadingKey ? LOADING_TEXT[loadingKey] : null;

  const skillChartData = gapReport ? [
    ...(gapReport.strengths || []).map(s => ({ name: s, score: 85, fill: T.emerald })),
    ...(gapReport.weakGaps || []).map(g => ({
      name: g.topic,
      score: g.severity === 'High' ? 25 : g.severity === 'Medium' ? 45 : 60,
      fill: g.severity === 'High' ? T.red : T.amber,
    })),
  ] : [];

  const { done: daysDone, total: daysTotal } = computeTotals(planResult, completedDays);
  const streak = computeStreak(planResult, completedDays);
  const planProgressPct = daysTotal ? Math.round((daysDone / daysTotal) * 100) : 0;
  const answeredCount = quiz ? quiz.questions.filter(q => quizAnswers[q.q_no]).length : 0;
  const allQuizAnswered = quiz ? answeredCount >= quiz.questions.length : false;

  return (
    <div className="mg-wrap">
      {/* CSS is rendered with the component (not injected at module load) so it can never go missing or go stale */}
      <style>{STATIC_CSS}</style>

      <Helmet>
        <title>Margdarshak AI — Adaptive Study & Career Guidance | MK AI</title>
        <meta name="description" content="Diagnose learning gaps, get an adaptive study plan, and multilingual career guidance with Margdarshak AI." />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" />
      </Helmet>

      <header className="mg-header">
        <div className="mg-logo">
          <div className="mg-logo-icon">🧭</div>
          <span className="mg-logo-name">Margdarshak AI</span>
          <span className="mg-logo-tag">Diagnose · Plan · Guide</span>
        </div>
        <button className="mg-btn-back" onClick={() => navigate('/')}>🏠 Home</button>
      </header>

      <main className="mg-main">
        {/* HERO */}
        <section className="mg-hero">
          <div className="mg-hero-copy">
            <div className="mg-hero-pill"><b>✧</b> Adaptive · Spaced revision · Multilingual mentor</div>
            <h1 className="mg-hero-title">Diagnose. Plan. <em>Guide.</em></h1>
            <p className="mg-hero-sub">An adaptive quiz that traces gaps back to their root cause, a study plan that schedules your revision for you, and career guidance in your own language — with voice support.</p>
          </div>
          <div className="mg-orb" aria-hidden="true">
            <div className="mg-orb-ring" />
            <div className="mg-orb-glass">🧭</div>
          </div>
        </section>

        {/* STEPPER */}
        <nav className="mg-stepper" aria-label="Progress">
          {STEPS.map((s, i) => (
            <React.Fragment key={s.id}>
              <button className="mg-step" disabled={!canGoToStep(s.id)} onClick={() => setStep(s.id)} aria-current={step === s.id ? 'step' : undefined}>
                <span className="mg-step-circle" style={{
                  borderColor: step >= s.id ? T.emerald : 'rgba(18,54,42,.18)',
                  background: step === s.id ? `linear-gradient(135deg,${T.emerald},${T.sky})` : step > s.id ? 'rgba(15,169,104,.14)' : '#fff',
                  color: step === s.id ? '#fff' : step > s.id ? T.emerald2 : 'rgba(18,36,32,.4)',
                }}>{step > s.id ? '✓' : s.icon}</span>
                <span className="mg-step-label" style={{ color: step >= s.id ? T.emerald2 : 'rgba(18,36,32,.45)' }}>{s.label}</span>
              </button>
              {i < STEPS.length - 1 && <div className="mg-step-line" style={{ background: step > s.id ? `linear-gradient(90deg,${T.emerald},${T.sky})` : 'rgba(18,54,42,.10)' }} />}
            </React.Fragment>
          ))}
        </nav>

        {(subject || quiz) && <div className="mg-saved-pill">💾 Your progress is auto-saved on this device</div>}

        {/* ═══ STEP 1 ═══ */}
        {step === 1 && (
          <>
            {!quiz && !loadingKey && (
              <div className="mg-form">
                <label className="mg-flabel" htmlFor="mg-subject">Subject</label>
                <div className="mg-input-row">
                  <input id="mg-subject" className="mg-input" placeholder="Physics, Mathematics, PCM…" value={subject} onChange={e => setSubject(e.target.value)} />
                  <MicButton lang="en-IN" onResult={t => setSubject(t)} />
                </div>
                <label className="mg-flabel" htmlFor="mg-topics">Topics / syllabus (optional)</label>
                <div className="mg-input-row">
                  <textarea id="mg-topics" className="mg-textarea" placeholder="e.g. Algebra, Trigonometry, Calculus basics…" value={topics} onChange={e => setTopics(e.target.value)} />
                  <MicButton lang="en-IN" onResult={t => setTopics(prev => (prev ? prev + ', ' : '') + t)} />
                </div>
                <label className="mg-flabel" htmlFor="mg-level">Level</label>
                <select id="mg-level" className="mg-select" value={level} onChange={e => setLevel(e.target.value)}>
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
                <button className="mg-gen-btn" disabled={!subject.trim()} onClick={generateQuiz}>Start diagnostic quiz (Phase 1)</button>
              </div>
            )}

            {loadingKey && (step === 1) && ['quiz', 'quiz2', 'gap'].includes(loadingKey) && <Loader info={loadingInfo} />}

            {quiz && !gapReport && !loadingKey && (
              <div>
                <div className="mg-r-hdr">
                  <div className="mg-r-hdr-title">Diagnostic quiz — {subject}{quizPhase === 2 && <span style={{ fontSize: 13, color: T.sky2, fontWeight: 650 }}> · Phase 2 (adaptive)</span>}</div>
                  <div className="mg-r-hdr-sub">Answer all {quiz.questions.length} questions honestly — your whole plan is built from them. Phase 2 adjusts to how you did in Phase 1.</div>
                  <div className="mg-qprogress"><div style={{ width: `${(answeredCount / quiz.questions.length) * 100}%` }} /></div>
                </div>
                {quiz.questions.map(q => (
                  <div key={q.q_no} className="mg-quiz-card">
                    <div className="mg-quiz-qt-row">
                      <div>
                        <div className="mg-tag-row">
                          <span className="mg-topic-tag">{q.topic}</span>
                          {q.bloom && <span className="mg-bloom-tag">🧠 {q.bloom}</span>}
                        </div>
                        <div className="mg-quiz-qt">{q.q_no}. {q.question}</div>
                      </div>
                      <SpeakButton text={q.question} lang="en-IN" label="🔊" />
                    </div>
                    <div className="mg-opts">
                      {Object.entries(q.options || {}).map(([k, v]) => (
                        <button key={k}
                          className={`mg-opt-btn ${quizAnswers[q.q_no] === k ? 'sel' : ''}`}
                          onClick={() => setQuizAnswers({ ...quizAnswers, [q.q_no]: k })}>
                          <strong>{k}.</strong> {v}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                {quizPhase === 1 ? (
                  <button className="mg-gen-btn" disabled={!allQuizAnswered} onClick={generateQuizPhase2}>Continue to Phase 2 (adaptive)</button>
                ) : (
                  <button className="mg-gen-btn" disabled={!allQuizAnswered} onClick={analyzeGaps}>Analyze my gaps</button>
                )}
              </div>
            )}

            {gapReport && !loadingKey && (
              <div ref={resultRef}>
                <div className="mg-r-hdr">
                  <div className="mg-r-hdr-row">
                    <div style={{ flex: 1, minWidth: 220 }}>
                      <div className="mg-r-hdr-title">Your skill gap report</div>
                      <div className="mg-r-hdr-sub">{gapReport.summary}</div>
                    </div>
                    {initialScorePct != null && <ScoreRing pct={initialScorePct} label="Diagnostic" />}
                  </div>
                </div>
                <div className="mg-sblock">
                  <div className="mg-stitle">🎯 Skill snapshot</div>
                  <div style={{ width: '100%', height: Math.max(180, skillChartData.length * 42) }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={skillChartData} layout="vertical" margin={{ left: 10, right: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(18,54,42,.10)" />
                        <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: T.muted }} />
                        <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 11, fill: T.ink }} />
                        <Tooltip formatter={(v) => `${v}%`} />
                        <Bar dataKey="score" radius={[0, 8, 8, 0]} barSize={18}>
                          {skillChartData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mg-chip-row">
                    {gapReport.strengths?.map((s, i) => <span key={i} className="mg-chip mg-chip-strong">✓ {s}</span>)}
                  </div>
                  {gapReport.weakGaps?.map((g, i) => (
                    <div key={i}>
                      <span className="mg-chip mg-chip-weak">⚠ {g.topic} ({g.severity})</span>
                      {g.rootCause && <div className="mg-rootcause">↳ Root cause: {g.rootCause}</div>}
                    </div>
                  ))}
                </div>
                {gapReport.prerequisites?.length > 0 && (
                  <div className="mg-sblock">
                    <div className="mg-stitle">📌 Revisit these first</div>
                    {gapReport.prerequisites.map((p, i) => <div key={i} className="mg-next-item">{p}</div>)}
                  </div>
                )}
                <button className="mg-continue-btn" onClick={() => setStep(2)}>Continue to study planner →</button>
              </div>
            )}
          </>
        )}

        {/* ═══ STEP 2 ═══ */}
        {step === 2 && gapReport && (
          <>
            {!planResult && !loadingKey && (
              <div className="mg-form">
                <div className="mg-summary-box" style={{ marginTop: 0 }}>Weak areas: <b>{gapReport.weakGaps.map(g => g.topic).join(', ') || '—'}</b>. A revision session is automatically added 3 and 7 days after each weak topic.</div>
                <label className="mg-flabel" htmlFor="mg-days">Days available</label>
                <select id="mg-days" className="mg-select" value={days} onChange={e => setDays(e.target.value)}>
                  <option value="7">7 days</option>
                  <option value="14">14 days</option>
                  <option value="30">30 days</option>
                  <option value="60">60 days</option>
                </select>
                <label className="mg-flabel" htmlFor="mg-hours">Hours per day</label>
                <select id="mg-hours" className="mg-select" value={hoursPerDay} onChange={e => setHoursPerDay(e.target.value)}>
                  <option value="1">1 hour</option>
                  <option value="2">2 hours</option>
                  <option value="3">3 hours</option>
                  <option value="4">4+ hours</option>
                </select>
                <button className="mg-gen-btn" onClick={generatePlan}>Generate my study plan</button>
              </div>
            )}

            {loadingKey === 'plan' && <Loader info={loadingInfo} />}

            {planResult && (
              <div ref={resultRef}>
                <div className="mg-r-hdr">
                  <div className="mg-r-hdr-title">Your adaptive study plan</div>
                  <div className="mg-r-hdr-sub">{planResult.overview}</div>
                </div>

                <div className="mg-streak-row">
                  <span className="mg-streak-badge">🔥 Streak: {streak} day{streak !== 1 ? 's' : ''}</span>
                  <div className="mg-progress-outer"><div className="mg-progress-inner" style={{ width: planProgressPct + '%' }} /></div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: T.muted }}>{daysDone}/{daysTotal} days</span>
                </div>

                {planResult.weekly_plan?.map((week, i) => (
                  <div key={i} className="mg-sblock">
                    <div className="mg-stitle">Week {week.week}: {week.theme}</div>
                    {week.days?.map((day, j) => {
                      const key = `${week.week}-${day.day}`;
                      const isDone = !!completedDays[key];
                      const recall = recallData[key];
                      const ytQuery = encodeURIComponent(`${(day.topics || []).join(' ')} ${subject} tutorial`);
                      return (
                        <div key={j} className="mg-day-row">
                          <button type="button" className={`mg-day-check ${isDone ? 'done' : ''}`} aria-label={`Mark day ${day.day} complete`} aria-pressed={isDone} onClick={() => toggleDayComplete(week.week, day.day)}>{isDone ? '✓' : ''}</button>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ opacity: isDone ? 0.55 : 1 }}>
                              <div className="mg-day-head">Day {day.day} · {day.duration}</div>
                              <div className="mg-chip-row" style={{ margin: '4px 0' }}>
                                {day.topics?.map((t, k) => <span key={k} className="mg-chip mg-chip-topic">{t}</span>)}
                              </div>
                              {day.tasks?.map((t, k) => <div key={k} className="mg-next-item" style={{ color: T.muted }}>{t}</div>)}
                              {day.tip && <div className="mg-tip">💡 {day.tip}</div>}
                            </div>

                            <div className="mg-day-actions">
                              <a className="mg-day-action-btn mg-yt-link" href={`https://www.youtube.com/results?search_query=${ytQuery}`} target="_blank" rel="noreferrer">▶ Watch on YouTube</a>
                              {!recall && (
                                <button className="mg-day-action-btn mg-recall-btn" onClick={() => generateRecall(week.week, day.day, day.topics)}>🎯 Quick recall (2 Q)</button>
                              )}
                            </div>

                            {recall?.loading && <div style={{ fontSize: 12.5, color: T.muted, marginTop: 8 }}>⏳ Building recall questions…</div>}
                            {recall?.questions?.length > 0 && (
                              <div className="mg-recall-box">
                                {recall.questions.map(q => (
                                  <div key={q.q_no} style={{ marginBottom: 10 }}>
                                    <div className="mg-recall-q">{q.q_no}. {q.question}</div>
                                    <div className="mg-opts">
                                      {Object.entries(q.options || {}).map(([k, v]) => {
                                        const answered = recall.answers[q.q_no];
                                        let cls = 'mg-opt-btn';
                                        if (answered) { if (k === q.correct) cls += ' correct'; else if (answered === k) cls += ' wrong'; }
                                        return (
                                          <button key={k} className={cls} disabled={!!answered} onClick={() => answerRecall(key, q.q_no, k)}>
                                            <strong>{k}.</strong> {v}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>
                                ))}
                                {recall.done && <div style={{ fontSize: 13, fontWeight: 700, color: T.emerald2 }}>✓ Recall check complete for this day</div>}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
                <button className="mg-continue-btn" onClick={() => setStep(3)}>Continue to career mentor →</button>
              </div>
            )}
          </>
        )}

        {/* ═══ STEP 3 ═══ */}
        {step === 3 && planResult && (
          <>
            {!mentorResult && !loadingKey && (
              <div className="mg-form">
                <label className="mg-flabel">Choose your language</label>
                <div className="mg-lang-grid">
                  {LANGUAGES.map(l => (
                    <button key={l.code} className={`mg-lang-btn ${language === l.code ? 'active' : ''}`} onClick={() => setLanguage(l.code)}>{l.label}</button>
                  ))}
                </div>
                <div className="mg-summary-box">Based on your {subject} performance — strengths: {gapReport?.strengths?.join(', ') || '—'}; weak areas: {gapReport?.weakGaps?.map(g => g.topic).join(', ') || '—'}.</div>
                <button className="mg-gen-btn" onClick={generateMentorGuidance}>Get my career guidance</button>
              </div>
            )}

            {loadingKey === 'mentor' && <Loader info={loadingInfo} />}

            {mentorResult && (
              <div ref={resultRef}>
                <div className="mg-mentor-bubble">
                  <div className="mg-mentor-top">
                    <div className="mg-mentor-greet">{mentorResult.greeting}</div>
                    <SpeakButton
                      lang={langObj.speech}
                      text={[mentorResult.greeting, ...(mentorResult.career_paths || []).map(cp => `${cp.title}. ${cp.why_fit}`), mentorResult.closing_message].filter(Boolean).join('. ')}
                    />
                  </div>
                  {mentorResult.career_paths?.map((cp, i) => (
                    <div key={i} className="mg-career-card">
                      <div className="mg-career-title">{cp.title}</div>
                      <div className="mg-career-why">{cp.why_fit}</div>
                      <span className="mg-career-step">→ {cp.first_step}</span>
                    </div>
                  ))}
                  {mentorResult.next_actions?.length > 0 && (
                    <div style={{ marginTop: 16 }}>
                      <div className="mg-stitle" style={{ marginBottom: 8 }}>✅ Next actions</div>
                      {mentorResult.next_actions.map((a, i) => <div key={i} className="mg-next-item">{a}</div>)}
                    </div>
                  )}
                  <div className="mg-closing">{mentorResult.closing_message}</div>
                </div>

                <div className="mg-sblock">
                  <div className="mg-stitle">🔗 Real opportunities</div>
                  <div className="mg-opportunity-links">
                    <a className="mg-opp-link" href="https://www.ncs.gov.in" target="_blank" rel="noreferrer">🇮🇳 National Career Service</a>
                    <button className="mg-opp-link" onClick={() => navigate('/scheme-finder')}>📋 Find government schemes for you</button>
                  </div>
                </div>

                <div className="mg-sblock">
                  <div className="mg-stitle">👨‍👩‍👧 Explain it to your parents</div>
                  {!parentSummary ? (
                    <button className="mg-gen-btn-secondary" disabled={!!loadingKey} onClick={generateParentSummary}>
                      {loadingKey === 'parent' ? '⏳ Writing…' : `Create a simple parent summary (${langObj.label})`}
                    </button>
                  ) : (
                    <div className="mg-summary-box" style={{ marginTop: 0 }}>
                      {parentSummary}
                      <div style={{ marginTop: 10 }}><SpeakButton text={parentSummary} lang={langObj.speech} label="🔊 Read aloud for parent" /></div>
                    </div>
                  )}
                </div>

                <div className="mg-chat-panel">
                  <div className="mg-stitle">💬 Have a doubt? Ask your mentor</div>
                  <div className="mg-chat-msgs">
                    {chatMessages.length === 0 && <div style={{ fontSize: 13.5, color: T.muted }}>Type or speak — your mentor will reply in {langObj.label}.</div>}
                    {chatMessages.map((m, i) => <div key={i} className={`mg-chat-msg ${m.role}`}>{m.content}</div>)}
                    {chatLoading && <div className="mg-chat-msg assistant">Typing…</div>}
                    <div ref={chatEndRef} />
                  </div>
                  <div className="mg-chat-input-row">
                    <input placeholder="Type or speak your question…" value={chatInput} aria-label="Ask your mentor"
                      onChange={e => setChatInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && sendChatMessage()} />
                    <MicButton lang={langObj.speech} onResult={t => sendChatMessage(t)} />
                    <button className="mg-chat-send" onClick={() => sendChatMessage()} disabled={chatLoading || !chatInput.trim()}>Send</button>
                  </div>
                </div>

                {!showRetest && retestScorePct == null && (
                  <button className="mg-retake-btn" onClick={() => setShowRetest(true)}>🔁 Retake the diagnostic quiz — see your progress</button>
                )}

                {showRetest && retestScorePct == null && quiz && (
                  <div style={{ marginTop: 16 }}>
                    <div className="mg-r-hdr">
                      <div className="mg-r-hdr-title">Progress check</div>
                      <div className="mg-r-hdr-sub">Same quiz, new attempt — let's see how much you've improved.</div>
                    </div>
                    {quiz.questions.map(q => (
                      <div key={q.q_no} className="mg-quiz-card">
                        <div className="mg-tag-row"><span className="mg-topic-tag">{q.topic}</span></div>
                        <div className="mg-quiz-qt" style={{ marginBottom: 12 }}>{q.q_no}. {q.question}</div>
                        <div className="mg-opts">
                          {Object.entries(q.options || {}).map(([k, v]) => (
                            <button key={k} className={`mg-opt-btn ${retestAnswers[q.q_no] === k ? 'sel' : ''}`}
                              onClick={() => setRetestAnswers({ ...retestAnswers, [q.q_no]: k })}>
                              <strong>{k}.</strong> {v}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                    <button className="mg-gen-btn" disabled={Object.keys(retestAnswers).length < quiz.questions.length} onClick={submitRetest}>Submit & see my progress</button>
                  </div>
                )}

                {retestScorePct != null && (
                  <div className="mg-compare-box">
                    <div className="mg-stitle">📈 Your progress</div>
                    <div style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
                      <ScoreRing pct={initialScorePct ?? 0} label="Before" />
                      <span style={{ fontSize: 26, color: T.emerald2 }}>→</span>
                      <ScoreRing pct={retestScorePct} label="After" />
                    </div>
                    <div style={{ width: '100%', height: 140, marginTop: 14 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={[{ name: 'Before', score: initialScorePct ?? 0 }, { name: 'After', score: retestScorePct }]}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(18,54,42,.10)" />
                          <XAxis dataKey="name" tick={{ fontSize: 12, fill: T.ink }} />
                          <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: T.muted }} />
                          <Tooltip formatter={v => `${v}%`} />
                          <Bar dataKey="score" radius={[8, 8, 0, 0]} barSize={60}>
                            <Cell fill={T.amber} />
                            <Cell fill={T.emerald} />
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="mg-improve-msg">
                      {retestScorePct - (initialScorePct ?? 0) >= 0 ? '🎉 +' : ''}{retestScorePct - (initialScorePct ?? 0)} points improvement!
                    </div>
                  </div>
                )}

                <button className="mg-pdf-btn" disabled={pdfLoading} onClick={handlePDF}>
                  {pdfLoading ? '⏳ Exporting…' : '📄 Download full journey report (PDF)'}
                </button>
                <div className="mg-restart"><button onClick={restart}>🔄 Start a new journey</button></div>
              </div>
            )}
          </>
        )}
      </main>

      {toast && <div className="mg-toast" role="status">{toast}</div>}
    </div>
  );
}

export default function Margdarshak() {
  return (
    <MargdarshakErrorBoundary>
      <MargdarshakPage />
    </MargdarshakErrorBoundary>
  );
}