import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';

/* ─────────────────────── THEME SYSTEM — single, fixed ───────────────────────
   Matches Home.jsx: emerald / mint / sky-blue / saffron on white. No toggle. */
const THEME = {
  bg: '#f6faf7',
  s1: '#eef8f2',
  headerBg: 'rgba(246,250,247,0.88)',
  headerBorder: 'rgba(18,54,42,0.10)',
  cardBg: 'rgba(255,255,255,0.6)',
  cardBorder: 'rgba(18,54,42,0.10)',
  inputBg: 'rgba(255,255,255,0.75)',
  inputBorder: 'rgba(18,54,42,0.16)',
  inputColor: '#122420',
  textPrimary: '#122420',
  textMuted: 'rgba(18,54,42,0.45)',
  textSub: 'rgba(18,54,42,0.65)',
  border2: 'rgba(18,54,42,0.10)',
  border3: 'rgba(18,54,42,0.05)',
  sectionBg: 'rgba(255,255,255,0.55)',
  dayCard: 'rgba(255,255,255,0.55)',
  quizCard: 'rgba(255,255,255,0.55)',
  termBorder: 'rgba(18,54,42,0.08)',
  mathWork: 'rgba(21,150,214,0.08)',
  conceptBg: 'rgba(242,169,59,0.08)',
  bgGradient: 'radial-gradient(ellipse at 15% 10%, rgba(15,169,104,0.10), transparent 26rem), radial-gradient(ellipse at 85% 60%, rgba(21,150,214,0.08), transparent 24rem)',
};
// Accent family — all rooted in the emerald / sky / gold palette
const A = {
  emerald: '#0FA968', emeraldLight: '#3FC98A', emerald2: '#0C8457',
  sky: '#1596D6', skyLight: '#5AB6E8', sky2: '#0E77AC',
  gold: '#F2A93B', goldLight: '#F7C568', gold2: '#C97F17',
  warn: '#D9701F', warnLight: '#F0A868',
};
const GRADIENT = `linear-gradient(135deg, ${A.emerald}, ${A.sky})`;

/* ─────────────────────── AI PROVIDERS ─────────────────────── */
const AI_PROVIDERS = [
    {
    name: 'GeneralCompute',
    url: 'https://api.generalcompute.com/v1/chat/completions',
    key: 'YOUR_API_KEY_PLACEHOLDER', // <-- General Compute API key
    model: 'gpt-oss-120b', // top GPT model on the platform — used first, always
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
    name: 'Cohere',
    url: 'https://api.cohere.com/v2/chat',
    model: 'command-r-plus',
    type: 'cohere',
    key: 'YOUR_API_KEY_PLACEHOLDER',
  },
  {
    name: 'Mistral',
    url: 'https://api.mistral.ai/v1/chat/completions',
    model: 'mistral-large-latest',
    type: 'openai',
    key: 'YOUR_API_KEY_PLACEHOLDER',
  },
  {
    name: 'Novita',
    url: 'https://api.novita.ai/v3/openai/chat/completions',
    model: 'meta-llama/llama-3.3-70b-instruct',
    type: 'openai',
    key: 'YOUR_API_KEY_PLACEHOLDER',
  },
  {
    name: 'DeepInfra',
    url: 'https://api.deepinfra.com/v1/openai/chat/completions',
    model: 'meta-llama/Llama-3.3-70B-Instruct',
    type: 'openai',
    key: 'YOUR_API_KEY_PLACEHOLDER',
  },
  {
    name: 'SambaNova',
    url: 'https://api.sambanova.ai/v1/chat/completions',
    model: 'Meta-Llama-3.3-70B-Instruct',
    type: 'openai',
    key: 'YOUR_API_KEY_PLACEHOLDER',
  },
  {
    name: 'OpenRouter',
    url: 'https://openrouter.ai/api/v1/chat/completions',
    model: 'meta-llama/llama-3.3-70b-instruct',
    type: 'openai',
    key: 'YOUR_API_KEY_PLACEHOLDER',
    extraHeaders: { 'HTTP-Referer': 'https://mkai.tech', 'X-Title': 'MK-AI' },
  },
];


const PRIMARY_PROVIDER_NAME = 'GeneralCompute'; // <-- ye hamesha sabse pehle try hoga
let rrIndex = 0;
const failCounts = Object.fromEntries(AI_PROVIDERS.map(p => [p.name, 0]));
const MAX_FAILS = 3;

function getNextProvider() {
  // round-robin sirf non-primary providers ke beech (fallback ke liye)
  const fallbacks = AI_PROVIDERS.filter(p => p.name !== PRIMARY_PROVIDER_NAME);
  const total = fallbacks.length;
  for (let i = 0; i < total; i++) {
    const p = fallbacks[rrIndex % total];
    rrIndex++;
    if (failCounts[p.name] < MAX_FAILS) return p;
  }
  AI_PROVIDERS.forEach(p => { failCounts[p.name] = 0; });
  rrIndex = 0;
  return AI_PROVIDERS[0];
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
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${provider.key}`,
      ...(provider.extraHeaders || {}),
    },
    body: JSON.stringify({ model: provider.model, messages, max_tokens: 3500, temperature: 0.5 }),
  });
  if (!res.ok) throw new Error(`${provider.name} HTTP ${res.status}`);
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error(`${provider.name} empty`);
  return text;
}

async function callAI(prompt) {
  const messages = [
    { role: 'system', content: 'You are an expert study assistant and educator. Return ONLY valid JSON — no markdown, no backticks.' },
    { role: 'user', content: prompt },
  ];
  const tried = new Set();
  const primary = AI_PROVIDERS.find(p => p.name === PRIMARY_PROVIDER_NAME) || AI_PROVIDERS[0];

  // STEP 1 — GeneralCompute hamesha pehle try hoga, jab tak MAX_FAILS na cross ho
  if (failCounts[primary.name] < MAX_FAILS) {
    tried.add(primary.name);
    try {
      const text = await callProviderOnce(primary, messages);
      failCounts[primary.name] = 0;
      return text;
    } catch (err) {
      failCounts[primary.name]++;
      await new Promise(r => setTimeout(r, 500));
    }
  }

  // STEP 2 — baaki providers round-robin fallback
  for (let attempt = 0; attempt < AI_PROVIDERS.length; attempt++) {
    const provider = getNextProvider();
    if (tried.has(provider.name)) continue;
    tried.add(provider.name);
    try {
      const text = await callProviderOnce(provider, messages);
      failCounts[provider.name] = 0;
      return text;
    } catch (err) {
      failCounts[provider.name]++;
      await new Promise(r => setTimeout(r, 500));
    }
  }
  throw new Error('All AI providers failed. Please try again.');
}

/* ─────────────────────── PDF EXPORT ─────────────────────── */
const loadJsPDF = () => new Promise((res, rej) => {
  if (window.jspdf) return res();
  const el = document.createElement('script');
  el.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
  el.onload = res; el.onerror = rej;
  document.head.appendChild(el);
});

async function exportStudyPDF(mode, result, formData) {
  await loadJsPDF();
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ format: 'a4', unit: 'mm' });
  const W = 210, M = 16;
  let y = 0;
  const rgb = hex => { const h = hex.replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; };
  const PURPLE = '0FA968', GOLD = 'F2A93B', GREEN = '0FA968', RED = 'D9701F', BLUE = '1596D6', BG = '0A0A0F';
  const newPage = () => {
    doc.addPage();
    doc.setFillColor(...rgb(BG)); doc.rect(0, 0, W, 297, 'F');
    doc.setFillColor(...rgb(PURPLE)); doc.rect(0, 0, W, 8, 'F');
    doc.setTextColor(...rgb(GOLD)); doc.setFontSize(7); doc.setFont('helvetica', 'bold');
    doc.text('MK STUDY PLANNER — AI Generated', M, 6);
    doc.setTextColor(150, 150, 150);
    doc.text(`${formData.subject} | ${new Date().toLocaleDateString()}`, W - M, 6, { align: 'right' });
    y = 18;
  };
  const chk = (n = 16) => { if (y + n > 275) newPage(); };
  const heading = (text, color = PURPLE) => {
    chk(12); doc.setFillColor(...rgb(color)); doc.rect(M, y - 4, W - M * 2, 9, 'F');
    doc.setTextColor(255, 255, 255); doc.setFontSize(10); doc.setFont('helvetica', 'bold');
    doc.text(text, M + 4, y + 1.5); y += 13;
  };
  const para = (text, color = '94A3B8') => {
    if (!text) return;
    doc.setTextColor(...rgb(color)); doc.setFontSize(9); doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(String(text), W - M * 2);
    chk(lines.length * 5 + 4); doc.text(lines, M, y); y += lines.length * 5 + 4;
  };
  const bullet = (items = [], color = '94A3B8', dot = PURPLE) => {
    (items || []).forEach(item => {
      chk(7); doc.setFillColor(...rgb(dot)); doc.circle(M + 2.5, y - 1, 1.2, 'F');
      doc.setTextColor(...rgb(color)); doc.setFontSize(9); doc.setFont('helvetica', 'normal');
      const lines = doc.splitTextToSize(String(item), W - M * 2 - 8);
      doc.text(lines, M + 7, y); y += lines.length * 5 + 2;
    }); y += 2;
  };
  const box = (text, bgHex = '111827', borderHex = PURPLE) => {
    if (!text) return;
    doc.setTextColor(...rgb('E2E8F0')); doc.setFontSize(9);
    const lines = doc.splitTextToSize(String(text), W - M * 2 - 8);
    chk(lines.length * 5 + 10);
    doc.setFillColor(...rgb(bgHex)); doc.rect(M, y - 4, W - M * 2, lines.length * 5 + 8, 'F');
    doc.setFillColor(...rgb(borderHex)); doc.rect(M, y - 4, 2.5, lines.length * 5 + 8, 'F');
    doc.text(lines, M + 7, y); y += lines.length * 5 + 12;
  };
  doc.setFillColor(...rgb(BG)); doc.rect(0, 0, W, 297, 'F');
  doc.setFillColor(...rgb(PURPLE)); doc.rect(0, 0, 6, 297, 'F');
  doc.setTextColor(...rgb(GOLD)); doc.setFontSize(9); doc.setFont('helvetica', 'bold');
  doc.text('MK STUDY PLANNER  ·  AI POWERED', 16, 35);
  doc.setFillColor(...rgb(GOLD)); doc.rect(16, 38, 80, 0.6, 'F');
  doc.setTextColor(240, 248, 255); doc.setFontSize(28); doc.setFont('helvetica', 'bold');
  const modeLabels = { study_plan: 'Study Plan', notes: 'Smart Notes', flashcards: 'Flashcard Deck', formulas: 'Formula Sheet', revision: 'Revision Guide', quiz: 'Practice Quiz', mind_map: 'Concept Map', math: 'Math Solution' };
  const titleLines = doc.splitTextToSize((modeLabels[mode] || mode).toUpperCase(), 175);
  doc.text(titleLines, 16, 58);
  const th = titleLines.length * 13;
  doc.setTextColor(...rgb('94A3B8')); doc.setFontSize(12); doc.setFont('helvetica', 'normal');
  doc.text('Subject: ' + formData.subject, 16, 58 + th + 8);
  if (formData.exam) doc.text('Exam: ' + formData.exam, 16, 58 + th + 18);
  doc.text('Level: ' + formData.level, 16, 58 + th + 28);
  doc.setTextColor(...rgb('475569')); doc.setFontSize(8);
  doc.text('Generated by MK Study Planner | ' + new Date().toLocaleDateString(), 16, 275);
  newPage();
  if (mode === 'study_plan' && result) { heading('OVERVIEW', PURPLE); box(result.overview); if (result.daily_hours) para('Daily: ' + result.daily_hours + ' hrs/day  |  Total: ' + result.total_days + ' days', GOLD); (result.weekly_plan || []).forEach(week => { heading('WEEK ' + week.week + ': ' + week.theme, '1E3A5F'); (week.days || []).forEach(day => { chk(22); doc.setFillColor(...rgb('1a1a2e')); doc.rect(M, y - 4, W - M * 2, 8, 'F'); doc.setTextColor(...rgb(GOLD)); doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.text('Day ' + day.day + ' — ' + day.duration, M + 4, y + 1); y += 10; bullet(day.topics, 'A5B4FC', PURPLE); bullet(day.tasks, '94A3B8', BLUE); if (day.tip) box(day.tip, '1C1A05', GOLD); }); }); if (result.tips?.length) { heading('STUDY TIPS', GREEN); bullet(result.tips, 'A7F3D0', GREEN); } if (result.milestones?.length) { heading('MILESTONES', GOLD); (result.milestones || []).forEach(m => para('Day ' + m.day + ': ' + m.goal, 'FDE68A')); } }
  else if (mode === 'notes' && result) { heading('SMART NOTES', PURPLE); (result.sections || []).forEach((sec, i) => { heading((i + 1) + '. ' + sec.heading, '1E3A5F'); box(sec.summary); bullet(sec.points, '94A3B8', PURPLE); if (sec.remember) box('Remember: ' + sec.remember, '150A0A', RED); }); if (result.key_terms?.length) { heading('KEY TERMS', BLUE); (result.key_terms || []).forEach(kt => para(kt.term + ': ' + kt.definition, '94A3B8')); } if (result.quick_revision?.length) { heading('QUICK REVISION', GREEN); bullet(result.quick_revision, 'A7F3D0', GREEN); } }
  else if (mode === 'flashcards' && result) { heading('FLASHCARD DECK', PURPLE); para('Subject: ' + result.subject + ' | Total: ' + result.total_cards + ' cards', GOLD); (result.cards || []).forEach((card, i) => { chk(34); const dc = card.difficulty === 'Easy' ? GREEN : card.difficulty === 'Medium' ? GOLD : RED; doc.setFillColor(...rgb('111827')); doc.rect(M, y - 4, W - M * 2, 30, 'F'); doc.setFillColor(...rgb(dc)); doc.rect(M, y - 4, 3, 30, 'F'); doc.setTextColor(...rgb(GOLD)); doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.text('Card ' + (i + 1) + ' — ' + card.category + ' — ' + card.difficulty, M + 7, y + 1); doc.setTextColor(...rgb('E2E8F0')); doc.setFont('helvetica', 'bold'); doc.setFontSize(9); const qL = doc.splitTextToSize('Q: ' + card.front, W - M * 2 - 10); doc.text(qL, M + 7, y + 7); doc.setTextColor(...rgb('A7F3D0')); doc.setFont('helvetica', 'normal'); const aL = doc.splitTextToSize('A: ' + card.back, W - M * 2 - 10); doc.text(aL, M + 7, y + 7 + qL.length * 4.5); y += 34; }); if (result.study_tip) box('Study Tip: ' + result.study_tip, '0A1220', GREEN); }
  else if (mode === 'revision' && result) { heading('MUST KNOW', RED); bullet(result.must_know, 'FCA5A5', RED); if (result.chapters?.length) { heading('CHAPTER WEIGHTAGE', BLUE); (result.chapters || []).forEach(ch => para(ch.name + ' — ' + ch.weightage, '94A3B8')); } if (result.formulas?.length) { heading('KEY FORMULAS', PURPLE); bullet(result.formulas, 'A5B4FC', PURPLE); } if (result.tricks?.length) { heading('MEMORY TRICKS', GOLD); bullet(result.tricks, 'FDE68A', GOLD); } if (result.exam_tips?.length) { heading('EXAM TIPS', GREEN); bullet(result.exam_tips, 'A7F3D0', GREEN); } if (result.avoid_mistakes?.length) { heading('AVOID MISTAKES', GOLD); bullet(result.avoid_mistakes, 'FDE68A', GOLD); } }
  else if (mode === 'math' && result) { heading('MATH SOLUTION', PURPLE); box('Problem: ' + (result.problem || ''), '111827', PURPLE); chk(16); doc.setFillColor(...rgb('064E3B')); doc.rect(M, y - 4, W - M * 2, 12, 'F'); doc.setTextColor(...rgb(GREEN)); doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.text('Answer: ' + (result.solution?.final_answer || ''), M + 6, y + 3.5); y += 16; heading('STEP-BY-STEP', '1E3A5F'); (result.solution?.steps || []).forEach(step => { chk(20); doc.setFillColor(...rgb(PURPLE)); doc.circle(M + 4, y, 4, 'F'); doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.text(String(step.step_no), M + 4, y + 1, { align: 'center' }); doc.setTextColor(...rgb('E2E8F0')); doc.text(step.title, M + 12, y + 1); y += 8; if (step.work) box(step.work, '0A1230', PURPLE); para(step.explanation, '94A3B8'); y += 2; }); if (result.concept_explanation) box('Concept: ' + result.concept_explanation, '1C1A05', GOLD); if (result.common_mistakes?.length) { heading('COMMON MISTAKES', GOLD); bullet(result.common_mistakes, 'FDE68A', GOLD); } }
  doc.save('MK_' + (modeLabels[mode] || mode).replace(/\s+/g, '_') + '_' + formData.subject.replace(/\s+/g, '_') + '.pdf');
}

/* ─────────────────────── SMART SUBJECT PARSER ─────────────────────── */
const SUBJECT_MAP = {
  p: 'Physics', c: 'Chemistry', m: 'Mathematics', b: 'Biology',
  e: 'English', h: 'Hindi', eco: 'Economics', acc: 'Accountancy',
  cs: 'Computer Science', ip: 'Informatics Practices', pe: 'Physical Education',
  geo: 'Geography', his: 'History', pol: 'Political Science', sst: 'Social Science',
  stat: 'Statistics', bs: 'Business Studies', psych: 'Psychology',
  soc: 'Sociology', fine: 'Fine Arts', music: 'Music',
};

const COMBO_MAP = {
  pcm: ['Physics', 'Chemistry', 'Mathematics'],
  pcb: ['Physics', 'Chemistry', 'Biology'],
  pcmb: ['Physics', 'Chemistry', 'Mathematics', 'Biology'],
  commerce: ['Economics', 'Accountancy', 'Business Studies', 'Mathematics'],
  arts: ['History', 'Political Science', 'Geography', 'Economics'],
  sci: ['Physics', 'Chemistry', 'Mathematics', 'Biology'],
};

const EXAM_SUGGESTIONS = {
  jee: { full: 'JEE Main / Advanced', subjects: ['Physics', 'Chemistry', 'Mathematics'], level: 'advanced' },
  neet: { full: 'NEET', subjects: ['Physics', 'Chemistry', 'Biology'], level: 'advanced' },
  boards: { full: 'CBSE Board Exam', subjects: [], level: 'intermediate' },
  cbse: { full: 'CBSE Board Exam', subjects: [], level: 'intermediate' },
  icse: { full: 'ICSE Board Exam', subjects: [], level: 'intermediate' },
  cat: { full: 'CAT', subjects: ['Quantitative Aptitude', 'Verbal Ability', 'Logical Reasoning'], level: 'advanced' },
  gate: { full: 'GATE', subjects: [], level: 'advanced' },
  upsc: { full: 'UPSC Civil Services', subjects: ['History', 'Political Science', 'Geography', 'Economics'], level: 'advanced' },
  ssc: { full: 'SSC CGL', subjects: ['Mathematics', 'English', 'General Knowledge'], level: 'intermediate' },
  bank: { full: 'Bank PO/Clerk', subjects: ['Mathematics', 'English', 'Reasoning'], level: 'intermediate' },
  sat: { full: 'SAT', subjects: ['Mathematics', 'English'], level: 'intermediate' },
};

function parseSubjectInput(raw) {
  const lower = raw.trim().toLowerCase().replace(/\s+/g, '');
  if (COMBO_MAP[lower]) return { subjects: COMBO_MAP[lower], display: COMBO_MAP[lower].join(' + ') };
  const parts = lower.split(/[+,&\/]/);
  const resolved = parts.map(p => SUBJECT_MAP[p.trim()] || (raw.split(/[+,&\/]/)[parts.indexOf(p)]?.trim()) || p);
  if (resolved.length > 1) return { subjects: resolved, display: resolved.join(' + ') };
  return { subjects: [raw], display: raw };
}

function parseExamInput(raw) {
  const lower = raw.trim().toLowerCase().replace(/\s+/g, '');
  const key = Object.keys(EXAM_SUGGESTIONS).find(k => lower.includes(k));
  if (key) return EXAM_SUGGESTIONS[key];
  return null;
}

/* ─────────────────────── STATIC CSS ─────────────────────── */
const STATIC_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;650;700;800&family=JetBrains+Mono:wght@400;700&display=swap');
*{box-sizing:border-box;margin:0;padding:0}

@keyframes fadeUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
@keyframes shimmer{0%{background-position:-300% center}100%{background-position:300% center}}
@keyframes borderPulse{0%,100%{border-color:rgba(15,169,104,.25)}50%{border-color:rgba(21,150,214,.6)}}
@keyframes countUp{from{opacity:0;transform:scale(.75)}to{opacity:1;transform:scale(1)}}
@keyframes spin{to{transform:rotate(360deg)}}

html,body{font-family:'Inter',ui-sans-serif,system-ui,sans-serif;min-height:100vh}

.sw{min-height:100vh;position:relative;overflow-x:hidden}
.s-grid{position:fixed;inset:0;pointer-events:none;z-index:0;
  background-image:linear-gradient(rgba(18,54,42,.025) 1px,transparent 1px),
    linear-gradient(90deg,rgba(18,54,42,.025) 1px,transparent 1px);
  background-size:44px 44px}
.s-orb1{position:fixed;top:-220px;left:-120px;width:600px;height:600px;border-radius:50%;
  background:radial-gradient(circle,rgba(15,169,104,.09) 0%,transparent 65%);pointer-events:none;z-index:0}
.s-orb2{position:fixed;bottom:-180px;right:-80px;width:480px;height:480px;border-radius:50%;
  background:radial-gradient(circle,rgba(242,169,59,.09) 0%,transparent 65%);pointer-events:none;z-index:0}

.s-header{position:sticky;top:0;z-index:200;display:flex;align-items:center;justify-content:space-between;
  padding:0 28px;height:60px;backdrop-filter:blur(20px)}
.s-logo{display:flex;align-items:center;gap:10px}
.s-logo-icon{width:34px;height:34px;border-radius:11px;
  background:${GRADIENT};
  display:flex;align-items:center;justify-content:center;font-size:16px;
  box-shadow:0 8px 20px rgba(15,150,120,.28)}
.s-logo-name{font-size:15px;font-weight:800;letter-spacing:-.01em;color:${A.emerald2}}
.s-logo-tag{font-size:9px;font-weight:700;letter-spacing:1.6px;color:${A.emerald2};
  background:rgba(15,169,104,.09);padding:3px 9px;border-radius:16px;border:1px solid rgba(15,169,104,.18)}
.s-hdr-right{display:flex;gap:8px;align-items:center}
.s-btn-back{background:transparent;border:1px solid rgba(18,54,42,.12);
  padding:7px 15px;border-radius:9px;cursor:pointer;
  font-size:12px;font-family:'Inter',sans-serif;font-weight:600;transition:all .2s}

.s-main{max-width:1000px;margin:0 auto;padding:28px 18px 80px;position:relative;z-index:1}

.s-hero{text-align:center;padding:36px 0 28px;animation:fadeUp .5s ease}
.s-hero-pill{display:inline-flex;align-items:center;gap:6px;
  font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;
  color:${A.emerald2};background:rgba(15,169,104,.09);
  border:1px solid rgba(15,169,104,.2);padding:5px 14px;border-radius:24px;margin-bottom:18px}
.s-hero-title{font-size:clamp(32px,5vw,50px);
  font-weight:800;line-height:1.1;letter-spacing:-.02em;margin-bottom:12px}
.s-hero-grad{background:linear-gradient(135deg,${A.emerald2},${A.sky},${A.gold});
  -webkit-background-clip:text;-webkit-text-fill-color:transparent}
.s-hero-sub{font-size:15px;max-width:460px;margin:0 auto;line-height:1.75;font-weight:400}

.tool-grid-wrap{margin-bottom:0;animation:fadeUp .5s .1s ease both}
.tg-label{font-size:10px;font-weight:700;letter-spacing:1.8px;text-transform:uppercase;
  margin-bottom:14px;display:flex;align-items:center;gap:10px}
.tg-label::after{content:'';flex:1;height:1px;background:rgba(18,54,42,.08)}
.tg{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
@media(max-width:700px){.tg{grid-template-columns:repeat(2,1fr)}}

.tc{position:relative;border-radius:18px;padding:20px 16px 16px;cursor:pointer;
  transition:all .28s cubic-bezier(.22,1,.36,1);overflow:hidden;text-align:center;
  backdrop-filter:blur(14px) saturate(150%);box-shadow:0 8px 24px rgba(15,90,70,.07),inset 0 1px 0 rgba(255,255,255,.55)}
.tc::before{content:'';position:absolute;inset:0;border-radius:18px;opacity:0;transition:opacity .3s;
  background:linear-gradient(135deg,rgba(15,169,104,.08),rgba(21,150,214,.05))}
.tc:hover::before,.tc.tc-active::before{opacity:1}
.tc:hover{transform:translateY(-3px);box-shadow:0 14px 32px rgba(15,90,70,.16),inset 0 1px 0 rgba(255,255,255,.7)}
.tc.tc-active{box-shadow:0 0 0 1px rgba(15,169,104,.3),0 14px 32px rgba(15,90,70,.16);animation:borderPulse 2.5s infinite}
.tc-icon{font-size:28px;margin-bottom:10px;display:block;animation:float 3s ease-in-out infinite}
.tc-name{font-size:13px;font-weight:700;margin-bottom:4px}
.tc.tc-active .tc-name{color:${A.emerald2}}
.tc-desc{font-size:10px;line-height:1.5}

.tool-view-header{display:flex;align-items:center;gap:12px;margin-bottom:24px;
  padding:16px 20px;border-radius:16px;border:1px solid;animation:fadeUp .35s ease}
.tvh-icon{width:42px;height:42px;border-radius:12px;display:flex;align-items:center;
  justify-content:center;font-size:20px;flex-shrink:0}
.tvh-info{flex:1}
.tvh-name{font-size:17px;font-weight:700;margin-bottom:3px}
.tvh-sub{font-size:12px}
.tvh-back{border:1px solid;padding:8px 14px;border-radius:9px;cursor:pointer;
  font-size:12px;font-family:'Inter',sans-serif;font-weight:600;
  white-space:nowrap;transition:all .2s;display:flex;align-items:center;gap:5px;background:transparent}

.s-form{border-radius:20px;padding:24px;margin-bottom:16px;border:1px solid;animation:fadeUp .35s .05s ease both;
  backdrop-filter:blur(14px) saturate(150%);box-shadow:0 8px 24px rgba(15,90,70,.07),inset 0 1px 0 rgba(255,255,255,.5)}
.flabel{display:block;font-size:10px;font-weight:700;letter-spacing:.9px;text-transform:uppercase;margin:16px 0 7px}
.finput,.fselect,.ftextarea{width:100%;border-radius:10px;
  padding:11px 14px;font-size:13.5px;
  font-family:'Inter',sans-serif;outline:none;transition:border-color .2s,background .2s,box-shadow .2s}
.finput:focus,.fselect:focus,.ftextarea:focus{
  border-color:rgba(15,169,104,.5)!important;
  box-shadow:0 0 0 3px rgba(15,169,104,.12)}
.ftextarea{resize:vertical;min-height:80px;line-height:1.7}
.frow{display:grid;grid-template-columns:1fr 1fr;gap:14px}
@media(max-width:580px){.frow{grid-template-columns:1fr}}
.fhalf{min-width:0}
.math-ta{width:100%;border-radius:11px;padding:14px;font-size:14px;
  font-family:'JetBrains Mono',monospace;outline:none;resize:vertical;min-height:90px;
  line-height:1.7;transition:border-color .2s,box-shadow .2s;border:1px solid rgba(15,169,104,.22)}
.math-ta:focus{border-color:rgba(15,169,104,.5)!important;box-shadow:0 0 0 3px rgba(15,169,104,.12)}

.smart-banner{background:rgba(15,169,104,.08);border:1px solid rgba(15,169,104,.25);
  border-radius:11px;padding:10px 14px;margin-top:8px;
  display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.smart-banner-icon{font-size:14px}
.smart-banner-text{font-size:12px;color:${A.emerald2};font-weight:600}
.smart-banner-subjects{display:flex;gap:5px;flex-wrap:wrap}
.s-subj-chip{background:rgba(15,169,104,.16);border:1px solid rgba(15,169,104,.3);
  color:${A.emerald2};padding:2px 9px;border-radius:7px;font-size:11px;font-weight:700}
.exam-banner{background:rgba(21,150,214,.08);border:1px solid rgba(21,150,214,.22);
  border-radius:11px;padding:10px 14px;margin-top:8px;
  display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}
.exam-banner-left{display:flex;align-items:center;gap:8px}
.exam-banner-text{font-size:12px;color:${A.sky2};font-weight:600}
.exam-apply-btn{background:rgba(21,150,214,.16);border:1px solid rgba(21,150,214,.35);
  color:${A.sky2};padding:4px 12px;border-radius:7px;font-size:11px;font-weight:700;
  cursor:pointer;font-family:'Inter',sans-serif;transition:all .2s}
.exam-apply-btn:hover{background:rgba(21,150,214,.26)}

.gen-btn{width:100%;padding:15px;border-radius:13px;cursor:pointer;
  font-size:15px;font-weight:700;font-family:'Inter',sans-serif;
  border:none;margin-top:20px;position:relative;overflow:hidden;
  transition:all .3s;letter-spacing:.2px}
.gen-btn:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 12px 30px rgba(15,150,120,.32)}
.gen-btn:disabled{opacity:.4;cursor:not-allowed}
.gen-indigo{background:${GRADIENT};color:#fff}
.gen-teal{background:linear-gradient(135deg,${A.sky},${A.skyLight});color:#fff}
.gen-amber{background:linear-gradient(135deg,${A.gold},${A.goldLight});color:#1C1208}
.gen-rose{background:linear-gradient(135deg,${A.warn},${A.warnLight});color:#fff}
.gen-green{background:linear-gradient(135deg,${A.emerald},${A.emeraldLight});color:#fff}
.gen-violet{background:linear-gradient(135deg,${A.sky2},${A.sky});color:#fff}

.s-loading{text-align:center;padding:52px 40px;border-radius:20px;margin-bottom:20px;
  border:1px solid;animation:fadeIn .4s ease}
.sl-icon{font-size:52px;margin-bottom:16px;display:block;animation:float 2s ease-in-out infinite}
.sl-title{font-size:20px;font-weight:700;margin-bottom:7px}
.sl-sub{font-size:13px;margin-bottom:22px}
.sl-bar{height:3px;background:rgba(18,54,42,.06);border-radius:99px;overflow:hidden}
.sl-fill{height:100%;width:70%;border-radius:99px;
  background:linear-gradient(90deg,${A.emerald},${A.sky},${A.gold});
  background-size:300% 100%;animation:shimmer 1.8s linear infinite}

.r-hdr{background:linear-gradient(135deg,rgba(15,169,104,.1),rgba(21,150,214,.06));
  border:1px solid rgba(15,169,104,.2);border-radius:18px;
  padding:20px 24px;margin-bottom:16px;
  display:flex;justify-content:space-between;align-items:flex-start;gap:14px;flex-wrap:wrap}
.r-hdr-title{font-size:21px;font-weight:800;margin-bottom:4px;letter-spacing:-.01em}
.r-hdr-sub{font-size:12px;line-height:1.6;margin-bottom:10px}
.r-badges{display:flex;gap:7px;flex-wrap:wrap}
.rbadge{padding:4px 12px;border-radius:16px;font-size:11px;font-weight:700}
.rb-indigo{background:rgba(15,169,104,.14);color:${A.emerald2};border:1px solid rgba(15,169,104,.25)}
.rb-teal{background:rgba(21,150,214,.12);color:${A.sky2};border:1px solid rgba(21,150,214,.22)}
.rb-amber{background:rgba(242,169,59,.14);color:${A.gold2};border:1px solid rgba(242,169,59,.26)}
.rb-rose{background:rgba(217,112,32,.12);color:${A.warn};border:1px solid rgba(217,112,32,.24)}
.rb-green{background:rgba(15,169,104,.14);color:${A.emerald2};border:1px solid rgba(15,169,104,.25)}

.pdf-btn{display:flex;align-items:center;gap:6px;padding:9px 16px;border-radius:10px;
  cursor:pointer;font-size:12px;font-weight:700;font-family:'Inter',sans-serif;
  background:linear-gradient(135deg,${A.gold2},${A.gold});color:#fff;
  border:none;transition:all .2s;white-space:nowrap;flex-shrink:0}
.pdf-btn:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 6px 18px rgba(201,127,23,.38)}
.pdf-btn:disabled{opacity:.45;cursor:not-allowed}

.sblock{border-radius:16px;padding:20px;margin-bottom:12px;border:1px solid}
.stitle{font-size:14px;font-weight:700;margin-bottom:14px;display:flex;align-items:center;gap:7px}
.stitle-ac{color:${A.emerald2}}

.week-block{margin-bottom:18px}
.week-hdr{background:linear-gradient(135deg,rgba(15,169,104,.12),rgba(21,150,214,.07));
  border:1px solid rgba(15,169,104,.18);border-radius:12px;
  padding:12px 16px;margin-bottom:10px;display:flex;align-items:center;gap:10px}
.week-n{background:${GRADIENT};width:32px;height:32px;
  border-radius:50%;display:flex;align-items:center;justify-content:center;
  font-weight:800;font-size:13px;color:#fff;flex-shrink:0}
.week-theme{font-weight:700;font-size:14px}
.day-card{border-radius:11px;padding:14px;margin-bottom:8px;
  border-left:3px solid ${A.emerald};transition:all .2s;border:1px solid}
.day-card:hover{transform:translateX(3px)}
.day-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}
.day-num{background:${GRADIENT};padding:3px 12px;
  border-radius:16px;font-size:11px;font-weight:800;color:#fff}
.day-dur{font-size:11px;font-weight:600}
.day-topics{display:flex;flex-wrap:wrap;gap:5px;margin-bottom:8px}
.tpill{background:rgba(15,169,104,.14);color:${A.emerald2};
  padding:3px 9px;border-radius:8px;font-size:10px;font-weight:700;
  border:1px solid rgba(15,169,104,.2)}
.task-item{font-size:12.5px;padding:3px 0;display:flex;align-items:center;gap:7px}
.task-item::before{content:'';width:5px;height:5px;border-radius:50%;
  background:${A.emerald};flex-shrink:0}
.day-tip{margin-top:8px;background:rgba(242,169,59,.09);
  border:1px solid rgba(242,169,59,.22);border-radius:8px;
  padding:7px 11px;font-size:11.5px;color:${A.gold2}}

.notes-sec{border-radius:13px;padding:18px;margin-bottom:12px;
  border-left:3px solid ${A.emerald};border:1px solid}
.ns-title{font-weight:700;font-size:15px;margin-bottom:8px}
.ns-sum{font-size:13px;line-height:1.75;margin-bottom:8px}
.ns-point{font-size:12.5px;padding:3px 0;display:flex;align-items:flex-start;gap:7px}
.ns-point::before{content:'▸';color:${A.emerald2};flex-shrink:0;font-size:10px;margin-top:3px}
.rem-box{margin-top:10px;background:rgba(217,112,32,.08);border:1px solid rgba(217,112,32,.22);
  border-radius:8px;padding:9px 12px;color:${A.warn};font-size:12.5px;
  display:flex;align-items:flex-start;gap:7px}
.term-item{display:flex;gap:10px;padding:7px 0;font-size:12.5px}
.term-k{color:${A.emerald2};font-weight:700;min-width:110px;flex-shrink:0}
.qrev-item{color:${A.emerald2};font-size:12.5px;padding:4px 0;display:flex;align-items:center;gap:7px}
.qrev-item::before{content:'✓';font-weight:700}

.quiz-card{border-radius:15px;padding:20px;margin-bottom:12px;border:1px solid}
.quiz-q-head{display:flex;align-items:flex-start;gap:10px;margin-bottom:14px}
.quiz-qn{background:${GRADIENT};width:26px;height:26px;
  border-radius:50%;display:flex;align-items:center;justify-content:center;
  font-size:12px;font-weight:800;color:#fff;flex-shrink:0;margin-top:1px}
.quiz-qt{font-size:15px;font-weight:600;line-height:1.6}
.opts-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px}
@media(max-width:480px){.opts-grid{grid-template-columns:1fr}}
.opt-btn{padding:11px 14px;border-radius:10px;cursor:pointer;font-size:13px;
  font-family:'Inter',sans-serif;text-align:left;
  transition:all .2s;border:1px solid rgba(18,54,42,.1)}
.opt-btn:hover:not(:disabled){background:rgba(15,169,104,.09);border-color:rgba(15,169,104,.28)}
.opt-btn.correct{background:rgba(15,169,104,.12);border-color:rgba(15,169,104,.4);color:${A.emerald2}}
.opt-btn.wrong{background:rgba(217,112,32,.09);border-color:rgba(217,112,32,.3);color:${A.warn}}
.opt-btn.sel{background:rgba(15,169,104,.16);border-color:rgba(15,169,104,.4)}
.q-exp{margin-top:10px;background:rgba(15,169,104,.07);border:1px solid rgba(15,169,104,.2);
  border-radius:8px;padding:10px 14px;font-size:12.5px;line-height:1.65}
.submit-btn{width:100%;padding:14px;border-radius:12px;cursor:pointer;
  font-size:15px;font-weight:800;font-family:'Inter',sans-serif;
  background:linear-gradient(135deg,${A.emerald},${A.emerald2});color:#fff;
  border:none;margin-top:6px;transition:all .2s}
.submit-btn:hover{transform:translateY(-2px);box-shadow:0 10px 28px rgba(15,169,104,.32)}
.score-wrap{text-align:center;padding:28px;
  background:linear-gradient(135deg,rgba(15,169,104,.1),rgba(12,132,87,.07));
  border:2px solid rgba(15,169,104,.25);border-radius:16px;margin-top:10px}
.score-big{font-size:56px;font-weight:800;
  color:${A.emerald2};line-height:1;animation:countUp .6s ease}
.score-msg{font-size:14px;margin-top:8px}

.flash-bar{height:3px;background:rgba(18,54,42,.06);border-radius:99px;overflow:hidden;margin-bottom:20px}
.flash-bar-fill{height:100%;border-radius:99px;
  background:${GRADIENT};transition:width .4s ease}
.fcard{border:2px solid;border-radius:20px;padding:28px;min-height:190px;
  cursor:pointer;transition:all .3s;user-select:none;position:relative}
.fcard-label{display:inline-flex;align-items:center;gap:5px;
  font-size:9px;font-weight:800;letter-spacing:1.8px;text-transform:uppercase;
  padding:4px 11px;border-radius:16px;margin-bottom:14px}
.fcl-q{background:rgba(18,54,42,.06);color:${THEME.textMuted}}
.fcl-a{background:rgba(15,169,104,.16);color:${A.emerald2}}
.fcard-text{font-size:17px;line-height:1.7}
.fcard-hint{margin-top:14px;background:rgba(242,169,59,.1);
  border:1px solid rgba(242,169,59,.22);border-radius:8px;
  padding:9px 13px;font-size:12px;color:${A.gold2}}
.fcard-click{position:absolute;bottom:14px;right:16px;font-size:10px;font-weight:500}
.fnav{display:flex;gap:9px;margin-top:14px;justify-content:center;flex-wrap:wrap}
.fnav-btn{border:1px solid;padding:9px 18px;border-radius:10px;cursor:pointer;
  font-size:13px;font-weight:600;font-family:'Inter',sans-serif;transition:all .2s;background:transparent}
.fnav-btn:disabled{opacity:.3;cursor:not-allowed}
.fflip-btn{background:${GRADIENT};border:none;
  color:#fff;padding:9px 22px;border-radius:10px;cursor:pointer;
  font-size:13px;font-weight:700;font-family:'Inter',sans-serif;transition:all .2s}
.fflip-btn:hover{transform:translateY(-1px);box-shadow:0 5px 18px rgba(15,150,120,.35)}
.fall-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:7px;margin-top:18px}
.fmini{padding:9px 11px;border-radius:9px;cursor:pointer;font-size:10.5px;
  border:1px solid;transition:all .2s;overflow:hidden;background:transparent}
.fmini.active{background:rgba(15,169,104,.14);border-color:rgba(15,169,104,.35)!important}
.fmini-n{font-weight:800;font-size:11px;color:${A.emerald2};margin-bottom:2px}
.fmini-p{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.stip{margin-top:14px;background:rgba(15,169,104,.07);
  border:1px solid rgba(15,169,104,.2);border-radius:10px;
  padding:12px 16px;font-size:12.5px;color:${A.emerald2};line-height:1.6}

.math-prob{border-radius:12px;padding:16px 20px;margin-bottom:16px;border:1px solid}
.math-prob-l{font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-bottom:7px}
.math-prob-t{font-size:15px;line-height:1.6;font-family:'JetBrains Mono',monospace}
.math-ans{background:linear-gradient(135deg,rgba(15,169,104,.1),rgba(12,132,87,.07));
  border:2px solid rgba(15,169,104,.3);border-radius:14px;
  padding:22px;margin-bottom:20px;text-align:center}
.math-ans-l{font-size:9px;font-weight:800;letter-spacing:2px;text-transform:uppercase;
  color:${A.emerald2};margin-bottom:9px}
.math-ans-v{font-family:'JetBrains Mono',monospace;font-size:28px;font-weight:700;
  color:${A.emerald2};letter-spacing:1px}
.math-step{display:flex;gap:14px;align-items:flex-start;margin-bottom:14px}
.msn{background:${GRADIENT};width:32px;height:32px;
  border-radius:50%;display:flex;align-items:center;justify-content:center;
  font-weight:800;font-size:13px;color:#fff;flex-shrink:0;box-shadow:0 3px 10px rgba(15,150,120,.32)}
.msc{flex:1}
.msc-title{font-weight:700;font-size:13.5px;margin-bottom:7px}
.msc-work{border-radius:9px;padding:10px 14px;
  font-family:'JetBrains Mono',monospace;font-size:14px;color:${A.sky2};margin-bottom:7px;border:1px solid rgba(21,150,214,.2)}
.msc-exp{font-size:12.5px;line-height:1.6}
.formula-used{font-family:'JetBrains Mono',monospace;font-size:14px;color:${A.emerald2};
  background:rgba(15,169,104,.08);padding:9px 13px;border-radius:8px;margin-bottom:7px}
.concept-b{border-radius:11px;padding:16px;margin-top:12px;border:1px solid rgba(242,169,59,.22)}
.concept-b-l{font-size:9px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;
  color:${A.gold2};margin-bottom:7px}
.concept-b-t{font-size:13px;line-height:1.7}
.sim-prob{padding:11px 14px;border-radius:9px;margin-bottom:7px;font-size:13px;cursor:pointer;
  border:1px solid;transition:all .2s}
.sim-prob:hover{background:rgba(15,169,104,.09);border-color:rgba(15,169,104,.28)}

.must-item{color:${A.warn};font-size:13.5px;padding:5px 0;display:flex;align-items:flex-start;gap:9px}
.must-item::before{content:'⚡';flex-shrink:0}
.ch-row{display:flex;align-items:center;justify-content:space-between;
  padding:9px 13px;border-radius:8px;margin-bottom:5px;border:1px solid}
.ch-name{font-size:13px}
.ch-wt{background:${GRADIENT};
  padding:2px 11px;border-radius:10px;font-size:11px;font-weight:700;color:#fff}
.fmono{font-family:'JetBrains Mono',monospace;font-size:13.5px;color:${A.emerald2};
  padding:4px 0;display:flex;align-items:center;gap:7px}
.fmono::before{content:'▸';color:${A.emerald};font-family:'Inter',sans-serif}
.trick-item{color:${A.gold2};font-size:13px;padding:5px 0;display:flex;align-items:flex-start;gap:7px}
.trick-item::before{content:'🧠';flex-shrink:0}
.mistake-item{font-size:13px;padding:5px 0;display:flex;align-items:flex-start;gap:7px}

.fcat-title{font-size:15px;font-weight:700;color:${A.emerald2};margin-bottom:10px;
  padding-bottom:7px;border-bottom:1px solid rgba(15,169,104,.2)}
.fcrd{border-radius:12px;padding:16px;margin-bottom:9px;
  border-left:3px solid ${A.emerald};transition:all .2s;border:1px solid}
.fcrd:hover{transform:translateX(3px)}
.fcrd-name{font-weight:700;font-size:10px;text-transform:uppercase;letter-spacing:.5px;margin-bottom:7px}
.fcrd-expr{font-family:'JetBrains Mono',monospace;font-size:19px;font-weight:700;
  color:${A.emerald2};background:rgba(15,169,104,.08);
  padding:8px 14px;border-radius:8px;margin-bottom:7px;letter-spacing:1px}
.fcrd-vars{font-size:11.5px;margin-bottom:5px;line-height:1.6}
.fcrd-use{font-size:11.5px;color:${A.gold2};display:flex;align-items:center;gap:5px}
.fcrd-use::before{content:'📌';font-size:10px}
.const-item{display:flex;align-items:center;gap:12px;padding:9px 13px;
  border-radius:8px;margin-bottom:5px;border:1px solid}
.const-sym{font-family:'JetBrains Mono',monospace;font-size:17px;font-weight:800;color:${A.emerald2};min-width:36px}
.const-val{font-size:13px;font-weight:600}
.const-name{font-size:11px;margin-left:3px}

.branch-block{border:2px solid;border-radius:15px;padding:18px;margin-bottom:12px;transition:all .2s}
.branch-block:hover{transform:translateY(-2px)}
.bb-title{font-size:16px;font-weight:700;margin-bottom:12px;display:flex;align-items:center;gap:7px}
.sub-branch{margin-bottom:10px;padding-left:14px;border-left:2px solid rgba(15,169,104,.2)}
.sb-name{font-weight:700;font-size:13.5px;margin-bottom:5px;display:flex;align-items:center;gap:5px}
.sb-name::before{content:'→';color:${A.emerald}}
.sb-detail{font-size:12px;padding:2px 0;padding-left:12px;display:flex;align-items:center;gap:5px}
.sb-detail::before{content:'•';font-size:9px}
.conn-item{font-size:12.5px;padding:5px 0;display:flex;align-items:center;gap:7px;border-bottom:1px solid rgba(18,54,42,.05)}
.conn-item::before{content:'↔';color:${A.sky2};font-weight:700}

.tip-box{background:rgba(242,169,59,.09);border:1px solid rgba(242,169,59,.2);
  border-radius:10px;padding:12px 16px;font-size:12.5px;color:${A.gold2};line-height:1.6}
.tips-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:9px}
.tip-card{background:rgba(15,169,104,.06);border:1px solid rgba(15,169,104,.15);
  border-radius:10px;padding:13px 14px;font-size:12.5px;line-height:1.6}
.tip-card::before{content:'💡';display:block;font-size:16px;margin-bottom:5px}
.m-row{display:flex;align-items:center;gap:12px;padding:9px 13px;
  border-radius:8px;margin-bottom:5px;border:1px solid}
.m-day{background:linear-gradient(135deg,${A.gold2},${A.gold});
  padding:2px 11px;border-radius:9px;font-size:11px;font-weight:800;color:#fff;white-space:nowrap}

.toast{position:fixed;bottom:22px;right:22px;z-index:9999;
  background:linear-gradient(135deg,${A.emerald},${A.emerald2});color:#fff;
  padding:11px 20px;border-radius:11px;font-weight:700;font-size:13px;
  animation:fadeUp .3s ease;display:flex;align-items:center;gap:7px;
  box-shadow:0 10px 26px rgba(15,169,104,.35)}

@media(max-width:400px){.tg{grid-template-columns:1fr 1fr}.tc{padding:14px 10px 12px}}
`;

/* ─────────────────────── INJECT CSS ONCE ─────────────────────── */
if (!document.getElementById('mk-study-css')) {
  const styleEl = document.createElement('style');
  styleEl.id = 'mk-study-css';
  styleEl.textContent = STATIC_CSS;
  document.head.appendChild(styleEl);
}

/* ─────────────────────── CONSTANTS ─────────────────────── */
const MODES = [
  { id: 'study_plan', icon: '📅', name: 'Study Plan', desc: 'Daily schedule', color: A.emerald, btnClass: 'gen-indigo' },
  { id: 'notes', icon: '📝', name: 'Smart Notes', desc: 'Topic notes', color: A.sky, btnClass: 'gen-teal' },
  { id: 'quiz', icon: '❓', name: 'Practice Quiz', desc: '10 MCQ', color: A.emerald, btnClass: 'gen-green' },
  { id: 'flashcards', icon: '🃏', name: 'Flashcards', desc: 'Q&A cards', color: A.gold, btnClass: 'gen-amber' },
  { id: 'math', icon: '🧮', name: 'Math Solver', desc: 'Step-by-step', color: A.sky, btnClass: 'gen-teal' },
  { id: 'revision', icon: '🔄', name: 'Revision', desc: 'Last-minute', color: A.warn, btnClass: 'gen-rose' },
  { id: 'mind_map', icon: '🧠', name: 'Concept Map', desc: 'Connections', color: A.sky2, btnClass: 'gen-violet' },
  { id: 'formulas', icon: '📐', name: 'Formula Sheet', desc: 'All formulas', color: A.gold, btnClass: 'gen-amber' },
];

const LOADING_MESSAGES = {
  study_plan: { icon: '📅', title: 'Building your study plan…', sub: 'AI is scheduling every day for success' },
  notes: { icon: '📝', title: 'Writing smart notes…', sub: 'Extracting key concepts and insights' },
  quiz: { icon: '❓', title: 'Crafting quiz questions…', sub: 'AI is testing your knowledge limits' },
  flashcards: { icon: '🃏', title: 'Creating flashcard deck…', sub: 'Turning knowledge into memorable cards' },
  math: { icon: '🧮', title: 'Solving step by step…', sub: 'AI mathematician is at work' },
  revision: { icon: '🔄', title: 'Building revision guide…', sub: 'Condensing everything that matters' },
  mind_map: { icon: '🧠', title: 'Mapping concepts…', sub: 'Building connections between ideas' },
  formulas: { icon: '📐', title: 'Compiling formulas…', sub: 'Every formula you need, one place' },
};

/* ─────────────────────── MAIN COMPONENT ─────────────────────── */
export default function Study() {
  const navigate = useNavigate();

  const TH = THEME;

  /* ── CORE STATE ── */
  const [activeTool, setActiveTool] = useState(null);
  const [mode, setMode] = useState('study_plan');

  const [form, setForm] = useState({
    subject: '', exam: '', timeAvailable: '30',
    level: 'intermediate', goal: 'pass', topics: '', weakAreas: '',
  });

  /* ── LOCAL INPUT STATES ── */
  const [localSubject, setLocalSubject] = useState('');
  const [localExam, setLocalExam] = useState('');
  const [localTopics, setLocalTopics] = useState('');
  const [localWeak, setLocalWeak] = useState('');
  const [mathInput, setMathInput] = useState('');

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [quizAnswers, setQuizAnswers] = useState({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [flashIdx, setFlashIdx] = useState(0);
  const [flashFlipped, setFlashFlipped] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [toast, setToast] = useState('');

  const [parsedSubjects, setParsedSubjects] = useState(null);
  const [examSuggestion, setExamSuggestion] = useState(null);

  const resultRef = useRef(null);

  const setF = useCallback((k, v) => setForm(f => ({ ...f, [k]: v })), []);
  const showToast = useCallback((msg) => { setToast(msg); setTimeout(() => setToast(''), 2500); }, []);

  const syncSubject = useCallback((v) => setF('subject', v), [setF]);
  const syncExam = useCallback((v) => setF('exam', v), [setF]);
  const syncTopics = useCallback((v) => setF('topics', v), [setF]);
  const syncWeak = useCallback((v) => setF('weakAreas', v), [setF]);

  /* ── Subject parse debounced ── */
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!localSubject.trim()) { setParsedSubjects(null); return; }
      const parsed = parseSubjectInput(localSubject);
      if (parsed.subjects.length > 1 || parsed.display !== localSubject) {
        setParsedSubjects(parsed);
      } else {
        setParsedSubjects(null);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [localSubject]);

  /* ── Exam parse debounced ── */
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!localExam.trim()) { setExamSuggestion(null); return; }
      const sugg = parseExamInput(localExam);
      setExamSuggestion(sugg || null);
    }, 400);
    return () => clearTimeout(timer);
  }, [localExam]);

  const applyExamSuggestion = useCallback(() => {
    if (!examSuggestion) return;
    const newExam = examSuggestion.full;
    setLocalExam(newExam);
    setF('exam', newExam);
    setF('level', examSuggestion.level);
    if (examSuggestion.subjects.length > 0 && !localSubject.trim()) {
      const newSubj = examSuggestion.subjects.join(' + ');
      setLocalSubject(newSubj);
      setF('subject', newSubj);
    }
    setExamSuggestion(null);
  }, [examSuggestion, localSubject, setF]);

  /* ── Generate ── */
  const syncAllAndGenerate = useCallback(async () => {
    const subject = localSubject;
    const exam = localExam;
    const topics = localTopics;
    const weakAreas = localWeak;

    if (!subject.trim()) return;
    if (mode === 'math' && !mathInput.trim() && !topics.trim()) return;

    const latestForm = { ...form, subject, exam, topics, weakAreas };
    const subjectDisplay = (() => {
      if (!subject.trim()) return subject;
      const parsed = parseSubjectInput(subject);
      return (parsed.subjects.length > 1 || parsed.display !== subject) ? parsed.display : subject;
    })();

    const prompts = {
      study_plan: `Create a detailed ${latestForm.timeAvailable}-day study plan.\nSubject: ${subjectDisplay}\nExam: ${exam}\nLevel: ${latestForm.level}\nGoal: ${latestForm.goal}\nWeak areas: ${weakAreas}\nReturn ONLY JSON: {"title":"title","overview":"overview","daily_hours":3,"total_days":${latestForm.timeAvailable},"weekly_plan":[{"week":1,"theme":"theme","days":[{"day":1,"topics":["t1"],"tasks":["t1"],"duration":"3 hours","tip":"tip"}]}],"tips":["t1","t2","t3"],"milestones":[{"day":7,"goal":"goal"}]}`,
      notes: `Create comprehensive notes.\nSubject: ${subjectDisplay}\nTopics: ${topics || subjectDisplay}\nLevel: ${latestForm.level}\nReturn ONLY JSON: {"title":"title","subject":"${subjectDisplay}","sections":[{"heading":"h","summary":"s","points":["p1","p2"],"examples":["e1"],"remember":"r"}],"key_terms":[{"term":"t","definition":"d"}],"quick_revision":["f1","f2","f3","f4","f5"]}`,
      quiz: `Create 10 MCQ questions.\nSubject: ${subjectDisplay}\nLevel: ${latestForm.level}\nTopics: ${topics || subjectDisplay}\nReturn ONLY JSON: {"title":"title","subject":"${subjectDisplay}","questions":[{"q_no":1,"question":"q","options":{"A":"a","B":"b","C":"c","D":"d"},"correct":"A","explanation":"why"}]}`,
      flashcards: `Create 15 flashcards.\nSubject: ${subjectDisplay}\nTopics: ${topics || subjectDisplay}\nLevel: ${latestForm.level}\nExam: ${exam || 'General'}\nReturn ONLY JSON: {"title":"title","subject":"${subjectDisplay}","total_cards":15,"cards":[{"id":1,"front":"q","back":"a","category":"Definition","difficulty":"Easy","hint":"hint"}],"study_tip":"tip"}`,
      math: `Solve this math problem step by step.\nProblem: ${mathInput || topics || subjectDisplay}\nLevel: ${latestForm.level}\nReturn ONLY JSON: {"problem":"restated","topic":"topic","difficulty":"Easy","solution":{"final_answer":"answer","steps":[{"step_no":1,"title":"title","work":"work","explanation":"explain"}]},"formula_used":["f1"],"similar_problems":["Try: p1","Try: p2","Try: p3"],"concept_explanation":"explain","common_mistakes":["m1","m2"]}`,
      revision: `Create revision guide.\nSubject: ${subjectDisplay}\nExam: ${exam}\nWeak areas: ${weakAreas}\nReturn ONLY JSON: {"title":"title","time_needed":"2-3 hours","must_know":["p1","p2","p3","p4","p5"],"chapters":[{"name":"ch","weightage":"30%"}],"formulas":["f1","f2"],"tricks":["t1","t2"],"exam_tips":["t1","t2","t3"],"avoid_mistakes":["m1","m2"]}`,
      mind_map: `Create mind map.\nSubject: ${subjectDisplay}\nTopics: ${topics || subjectDisplay}\nReturn ONLY JSON: {"central_topic":"${subjectDisplay}","branches":[{"name":"branch","color":"#0FA968","sub_branches":[{"name":"sub","details":["d1","d2"]}]}],"connections":["c1","c2"],"summary":"summary"}`,
      formulas: `Create formula sheet.\nSubject: ${subjectDisplay}\nTopics: ${topics || subjectDisplay}\nLevel: ${latestForm.level}\nReturn ONLY JSON: {"title":"title","subject":"${subjectDisplay}","categories":[{"name":"cat","formulas":[{"name":"n","formula":"F=ma","variables":"vars","use":"when"}]}],"constants":[{"name":"n","value":"v","symbol":"s"}],"tips":["t1","t2"]}`,
    };

    setLoading(true); setResult(null);
    setQuizAnswers({}); setQuizSubmitted(false);
    setFlashIdx(0); setFlashFlipped(false);

    try {
      const text = await callAI(prompts[mode]);
      const m = text.match(/\{[\s\S]*\}/);
      if (m) {
        setResult(JSON.parse(m[0]));
        setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
      }
    } catch (e) { alert('Error! Try again.'); }
    setLoading(false);
  }, [localSubject, localExam, localTopics, localWeak, mathInput, mode, form]);

  const subjectForDisplay = parsedSubjects ? parsedSubjects.display : localSubject;

  const handlePDF = useCallback(async () => {
    setPdfLoading(true);
    try {
      await exportStudyPDF(mode, result, { subject: subjectForDisplay, exam: localExam, level: form.level });
      showToast('📄 PDF downloaded!');
    } catch (e) { alert('PDF error. Try again.'); }
    setPdfLoading(false);
  }, [mode, result, subjectForDisplay, localExam, form.level, showToast]);

  const openTool = useCallback((modeId) => {
    setActiveTool(modeId);
    setMode(modeId);
    setResult(null);
    setQuizAnswers({});
    setQuizSubmitted(false);
    setFlashIdx(0);
    setFlashFlipped(false);
  }, []);

  const goBack = useCallback(() => {
    setActiveTool(null);
    setResult(null);
  }, []);

  /* ── DYNAMIC STYLES (single theme — no branching) ── */
  const dynStyles = {
    sw: { background: TH.bg, backgroundImage: TH.bgGradient, color: TH.textPrimary },
    header: { background: TH.headerBg, borderBottom: `1px solid ${TH.headerBorder}` },
    btnBack: { color: TH.textSub, borderColor: TH.border2 },
    heroSub: { color: TH.textMuted },
    tgLabel: { color: TH.textMuted },
    tc: { background: TH.cardBg, borderColor: TH.cardBorder },
    tcName: { color: TH.textPrimary },
    tcDesc: { color: TH.textMuted },
    toolViewHeader: { background: TH.s1, borderColor: TH.cardBorder },
    tvhName: { color: TH.textPrimary },
    tvhSub: { color: TH.textMuted },
    tvhBack: { color: TH.textSub, borderColor: TH.border2 },
    form: { background: TH.s1, borderColor: TH.cardBorder },
    flabel: { color: TH.textMuted },
    input: { background: TH.inputBg, border: `1px solid ${TH.inputBorder}`, color: TH.inputColor },
    mathTa: { background: TH.inputBg, color: TH.inputColor },
    loading: { background: TH.s1, borderColor: TH.cardBorder },
    slTitle: { color: TH.textPrimary },
    slSub: { color: TH.textMuted },
    sblock: { background: TH.sectionBg, borderColor: TH.border2 },
    dayCard: { background: TH.dayCard, borderColor: TH.border2, borderLeft: `3px solid ${A.emerald}` },
    dayDur: { color: TH.textMuted },
    notesSec: { background: TH.sectionBg, borderColor: TH.border2 },
    nsTitle: { color: TH.textPrimary },
    nsSum: { color: TH.textSub },
    nsPoint: { color: TH.textSub },
    termItem: { borderBottom: `1px solid ${TH.termBorder}` },
    termV: { color: TH.textSub },
    quizCard: { background: TH.quizCard, borderColor: TH.border2 },
    quizQt: { color: TH.textPrimary },
    optBtn: { background: TH.inputBg, color: TH.textPrimary },
    qExp: { color: TH.textSub },
    scoreMsg: { color: TH.textMuted },
    fcardFront: { borderColor: TH.border2, background: TH.sectionBg },
    fcardBack: { borderColor: 'rgba(15,169,104,0.4)', background: 'linear-gradient(135deg,rgba(15,169,104,0.1),rgba(21,150,214,0.06))' },
    fnavBtn: { borderColor: TH.border2, color: TH.textSub },
    fmini: { borderColor: TH.border2, color: TH.textMuted },
    mathProb: { background: TH.sectionBg, borderColor: TH.border2 },
    mathProbL: { color: TH.textMuted },
    mathWork: { background: TH.mathWork },
    mathExp: { color: TH.textSub },
    conceptBg: { background: TH.conceptBg },
    conceptT: { color: TH.textSub },
    simProb: { background: TH.sectionBg, borderColor: TH.border2, color: TH.textSub },
    chRow: { background: TH.sectionBg, borderColor: TH.border2 },
    chName: { color: TH.textPrimary },
    fcrd: { background: TH.sectionBg, borderColor: TH.border2 },
    fcrdName: { color: TH.textMuted },
    fcrdVars: { color: TH.textSub },
    constItem: { background: TH.sectionBg, borderColor: TH.border2 },
    constVal: { color: TH.textPrimary },
    constName: { color: TH.textMuted },
    mRow: { background: TH.sectionBg, borderColor: TH.border2 },
    weekTheme: { color: TH.textPrimary },
    taskItem: { color: TH.textSub },
    tipCard: { color: TH.textSub },
    connItem: { color: TH.textSub },
    mscTitle: { color: TH.textPrimary },
    mscExp: { color: TH.textSub },
    switchBtn: { background: TH.sectionBg, borderColor: TH.border2, color: TH.textSub },
  };

  /* ── RENDERERS ── */
  const PDFBtn = () => (
    <button className="pdf-btn" disabled={pdfLoading} onClick={handlePDF}>
      {pdfLoading ? '⏳' : '📄'} {pdfLoading ? 'Exporting…' : 'Download PDF'}
    </button>
  );

  const ResultHeader = ({ title, sub, badges = [] }) => (
    <div className="r-hdr">
      <div>
        <div className="r-hdr-title" style={{ color: TH.textPrimary }}>{title}</div>
        {sub && <div className="r-hdr-sub" style={{ color: TH.textMuted }}>{sub}</div>}
        {badges.length > 0 && (
          <div className="r-badges">
            {badges.map((b, i) => <span key={i} className={`rbadge rb-${b.color || 'indigo'}`}>{b.text}</span>)}
          </div>
        )}
      </div>
      <PDFBtn />
    </div>
  );

  const activeMode = MODES.find(m => m.id === mode);
  const lm = LOADING_MESSAGES[mode];

  /* ── RESULT RENDERERS ── */
  const renderStudyPlan = () => (
    <div>
      <ResultHeader title={result.title || '📅 Study Plan'} sub={result.overview}
        badges={[{ text: `📅 ${result.total_days} Days`, color: 'indigo' }, { text: `⏰ ${result.daily_hours} hrs/day`, color: 'green' }]} />
      {result.weekly_plan?.map((week, i) => (
        <div key={i} className="week-block">
          <div className="week-hdr">
            <div className="week-n">{week.week}</div>
            <div><div className="week-theme" style={dynStyles.weekTheme}>Week {week.week}: {week.theme}</div></div>
          </div>
          {week.days?.map((day, j) => (
            <div key={j} className="day-card" style={dynStyles.dayCard}>
              <div className="day-top">
                <span className="day-num">Day {day.day}</span>
                <span className="day-dur" style={dynStyles.dayDur}>⏱ {day.duration}</span>
              </div>
              <div className="day-topics">{day.topics?.map((t, k) => <span key={k} className="tpill">{t}</span>)}</div>
              {day.tasks?.map((task, k) => <div key={k} className="task-item" style={dynStyles.taskItem}>{task}</div>)}
              {day.tip && <div className="day-tip">💡 {day.tip}</div>}
            </div>
          ))}
        </div>
      ))}
      {result.milestones?.length > 0 && (
        <div className="sblock" style={dynStyles.sblock}>
          <div className="stitle" style={{ color: TH.textPrimary }}>🏆 <span className="stitle-ac">Milestones</span></div>
          {result.milestones.map((m, i) => (
            <div key={i} className="m-row" style={dynStyles.mRow}>
              <span className="m-day">Day {m.day}</span>
              <span style={dynStyles.taskItem}>{m.goal}</span>
            </div>
          ))}
        </div>
      )}
      {result.tips?.length > 0 && (
        <div className="sblock" style={dynStyles.sblock}>
          <div className="stitle" style={{ color: TH.textPrimary }}>🌟 <span className="stitle-ac">Study Tips</span></div>
          <div className="tips-grid">{result.tips.map((t, i) => <div key={i} className="tip-card" style={dynStyles.tipCard}>{t}</div>)}</div>
        </div>
      )}
    </div>
  );

  const renderNotes = () => (
    <div>
      <ResultHeader title={result.title || '📝 Smart Notes'} sub={`Subject: ${result.subject}`}
        badges={[{ text: `${result.sections?.length || 0} Sections`, color: 'teal' }]} />
      {result.sections?.map((sec, i) => (
        <div key={i} className="notes-sec" style={dynStyles.notesSec}>
          <div className="ns-title" style={dynStyles.nsTitle}>{i + 1}. {sec.heading}</div>
          <div className="ns-sum" style={dynStyles.nsSum}>{sec.summary}</div>
          {sec.points?.map((p, j) => <div key={j} className="ns-point" style={dynStyles.nsPoint}>{p}</div>)}
          {sec.examples?.length > 0 && <div className="tip-box" style={{ marginTop: 10 }}>📌 Example: {sec.examples[0]}</div>}
          {sec.remember && <div className="rem-box">🔴 Remember: {sec.remember}</div>}
        </div>
      ))}
      {result.key_terms?.length > 0 && (
        <div className="sblock" style={dynStyles.sblock}>
          <div className="stitle" style={{ color: TH.textPrimary }}>📖 <span className="stitle-ac">Key Terms</span></div>
          {result.key_terms.map((kt, i) => (
            <div key={i} className="term-item" style={dynStyles.termItem}>
              <span className="term-k">{kt.term}</span>
              <span className="term-v" style={dynStyles.termV}>{kt.definition}</span>
            </div>
          ))}
        </div>
      )}
      {result.quick_revision?.length > 0 && (
        <div className="sblock" style={{ ...dynStyles.sblock, background: 'rgba(15,169,104,.05)', borderColor: 'rgba(15,169,104,.2)' }}>
          <div className="stitle">⚡ <span style={{ color: A.emerald2 }}>Quick Revision</span></div>
          {result.quick_revision.map((qr, i) => <div key={i} className="qrev-item">{qr}</div>)}
        </div>
      )}
    </div>
  );

  const renderQuiz = () => {
    const score = result.questions?.filter((q, i) => quizAnswers[i] === q.correct).length || 0;
    const total = result.questions?.length || 0;
    const pct = total ? Math.round((score / total) * 100) : 0;
    return (
      <div>
        <ResultHeader title={result.title || '❓ Practice Quiz'} sub={`Subject: ${result.subject}`}
          badges={[{ text: `${total} Questions`, color: 'green' }]} />
        {result.questions?.map((q, i) => (
          <div key={i} className="quiz-card" style={dynStyles.quizCard}>
            <div className="quiz-q-head">
              <span className="quiz-qn">{q.q_no}</span>
              <span className="quiz-qt" style={dynStyles.quizQt}>{q.question}</span>
            </div>
            <div className="opts-grid">
              {Object.entries(q.options || {}).map(([key, val]) => {
                let cls = 'opt-btn';
                if (quizSubmitted) { if (key === q.correct) cls += ' correct'; else if (quizAnswers[i] === key) cls += ' wrong'; }
                else if (quizAnswers[i] === key) cls += ' sel';
                return (
                  <button key={key} className={cls}
                    style={!quizSubmitted && quizAnswers[i] !== key ? dynStyles.optBtn : undefined}
                    onClick={() => !quizSubmitted && setQuizAnswers({ ...quizAnswers, [i]: key })}>
                    <strong>{key}.</strong> {val}
                  </button>
                );
              })}
            </div>
            {quizSubmitted && <div className="q-exp" style={dynStyles.qExp}>💡 {q.explanation}</div>}
          </div>
        ))}
        {!quizSubmitted
          ? <button className="submit-btn" onClick={() => setQuizSubmitted(true)}>✅ Submit Quiz</button>
          : (
            <div className="score-wrap">
              <div className="score-big">{score}/{total}</div>
              <div className="score-msg" style={dynStyles.scoreMsg}>
                {pct >= 80 ? '🎉 Excellent! Keep it up!' : pct >= 60 ? '👍 Good job! Practice more.' : '💪 Keep studying! You can do this.'}
              </div>
              <div style={{ marginTop: 12 }}>
                <span className={`rbadge ${pct >= 80 ? 'rb-green' : pct >= 60 ? 'rb-amber' : 'rb-rose'}`}>{pct}% Score</span>
              </div>
            </div>
          )}
      </div>
    );
  };

  const renderFlashcards = () => {
    if (!result?.cards?.length) return null;
    const card = result.cards[flashIdx];
    const diffColor = card.difficulty === 'Easy' ? A.emerald : card.difficulty === 'Medium' ? A.gold : A.warn;
    return (
      <div>
        <ResultHeader title={result.title || '🃏 Flashcard Deck'} sub={`${result.total_cards} cards to master`}
          badges={[{ text: `Card ${flashIdx + 1}/${result.cards.length}`, color: 'indigo' }, { text: result.subject, color: 'teal' }]} />
        <div className="flash-bar"><div className="flash-bar-fill" style={{ width: `${((flashIdx + 1) / result.cards.length) * 100}%` }} /></div>
        <div className="fcard"
          style={flashFlipped ? dynStyles.fcardBack : dynStyles.fcardFront}
          onClick={() => setFlashFlipped(!flashFlipped)}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <span className={`fcard-label ${flashFlipped ? 'fcl-a' : 'fcl-q'}`}>
              {flashFlipped ? '✅ ANSWER' : '❓ QUESTION'}
            </span>
            <div style={{ display: 'flex', gap: 7 }}>
              <span className="rbadge" style={{ background: diffColor + '22', color: diffColor, border: `1px solid ${diffColor}44` }}>{card.difficulty}</span>
              <span className="rbadge rb-indigo" style={{ fontSize: 9 }}>{card.category}</span>
            </div>
          </div>
          <div className="fcard-text" style={{ color: TH.textPrimary }}>{flashFlipped ? card.back : card.front}</div>
          {!flashFlipped && card.hint && <div className="fcard-hint">💡 Hint: {card.hint}</div>}
          <div className="fcard-click" style={{ color: TH.textMuted }}>{flashFlipped ? 'Click to see question' : 'Click to reveal answer'}</div>
        </div>
        <div className="fnav">
          <button className="fnav-btn" style={dynStyles.fnavBtn} disabled={flashIdx === 0} onClick={() => { setFlashIdx(i => i - 1); setFlashFlipped(false); }}>← Previous</button>
          <button className="fflip-btn" onClick={() => setFlashFlipped(!flashFlipped)}>🔄 Flip Card</button>
          <button className="fnav-btn" style={dynStyles.fnavBtn} disabled={flashIdx === result.cards.length - 1} onClick={() => { setFlashIdx(i => i + 1); setFlashFlipped(false); }}>Next →</button>
        </div>
        <div className="sblock" style={{ ...dynStyles.sblock, marginTop: 18 }}>
          <div className="stitle" style={{ color: TH.textPrimary }}>📋 <span className="stitle-ac">Jump to Any Card</span></div>
          <div className="fall-grid">
            {result.cards.map((c, i) => (
              <div key={i} className={`fmini ${i === flashIdx ? 'active' : ''}`}
                style={i !== flashIdx ? dynStyles.fmini : undefined}
                onClick={() => { setFlashIdx(i); setFlashFlipped(false); }}>
                <div className="fmini-n">Card {i + 1}</div>
                <div className="fmini-p" style={{ color: TH.textSub }}>{c.front.slice(0, 32)}…</div>
              </div>
            ))}
          </div>
        </div>
        {result.study_tip && <div className="stip">💡 Study Tip: {result.study_tip}</div>}
      </div>
    );
  };

  const renderMath = () => (
    <div>
      <ResultHeader title="🧮 Math Solution" sub={`${result.topic} · ${result.difficulty}`}
        badges={[{ text: result.topic, color: 'indigo' }, { text: result.difficulty, color: result.difficulty === 'Easy' ? 'green' : result.difficulty === 'Hard' ? 'rose' : 'amber' }]} />
      <div className="math-prob" style={dynStyles.mathProb}>
        <div className="math-prob-l" style={dynStyles.mathProbL}>Problem</div>
        <div className="math-prob-t" style={{ color: TH.textPrimary }}>{result.problem}</div>
      </div>
      <div className="math-ans">
        <div className="math-ans-l">✅ Final Answer</div>
        <div className="math-ans-v">{result.solution?.final_answer}</div>
      </div>
      <div className="sblock" style={dynStyles.sblock}>
        <div className="stitle" style={{ color: TH.textPrimary }}>📐 <span className="stitle-ac">Step-by-Step Solution</span></div>
        {result.solution?.steps?.map((step, i) => (
          <div key={i} className="math-step">
            <div className="msn">{step.step_no}</div>
            <div className="msc">
              <div className="msc-title" style={dynStyles.mscTitle}>{step.title}</div>
              {step.work && <div className="msc-work" style={dynStyles.mathWork}>{step.work}</div>}
              <div className="msc-exp" style={dynStyles.mscExp}>{step.explanation}</div>
            </div>
          </div>
        ))}
      </div>
      {result.formula_used?.length > 0 && (
        <div className="sblock" style={dynStyles.sblock}>
          <div className="stitle" style={{ color: TH.textPrimary }}>📏 <span className="stitle-ac">Formulas Used</span></div>
          {result.formula_used.map((f, i) => <div key={i} className="formula-used">{f}</div>)}
        </div>
      )}
      {result.concept_explanation && (
        <div className="concept-b" style={dynStyles.conceptBg}>
          <div className="concept-b-l">📖 Concept Explanation</div>
          <div className="concept-b-t" style={dynStyles.conceptT}>{result.concept_explanation}</div>
        </div>
      )}
      {result.common_mistakes?.length > 0 && (
        <div className="sblock" style={{ ...dynStyles.sblock, background: 'rgba(242,169,59,.05)', borderColor: 'rgba(242,169,59,.2)' }}>
          <div className="stitle">⚠️ <span style={{ color: A.gold2 }}>Common Mistakes</span></div>
          {result.common_mistakes.map((m, i) => <div key={i} className="mistake-item" style={{ color: A.gold2 }}>{m}</div>)}
        </div>
      )}
      {result.similar_problems?.length > 0 && (
        <div className="sblock" style={dynStyles.sblock}>
          <div className="stitle" style={{ color: TH.textPrimary }}>🎯 <span className="stitle-ac">Try Similar Problems</span></div>
          {result.similar_problems.map((p, i) => (
            <div key={i} className="sim-prob" style={dynStyles.simProb}
              onClick={() => setMathInput(p.replace('Try: ', ''))}>{p}</div>
          ))}
        </div>
      )}
    </div>
  );

  const renderRevision = () => (
    <div>
      <ResultHeader title={result.title || '🔄 Revision Guide'} sub={`⏱ Time needed: ${result.time_needed}`}
        badges={[{ text: 'Last Minute', color: 'rose' }, { text: subjectForDisplay, color: 'indigo' }]} />
      <div className="sblock" style={{ background: 'rgba(217,112,32,.05)', borderColor: 'rgba(217,112,32,.2)' }}>
        <div className="stitle">🔴 <span style={{ color: A.warn }}>Must Know</span></div>
        {result.must_know?.map((item, i) => <div key={i} className="must-item">{item}</div>)}
      </div>
      {result.chapters?.length > 0 && (
        <div className="sblock" style={dynStyles.sblock}>
          <div className="stitle" style={{ color: TH.textPrimary }}>📚 <span className="stitle-ac">Chapter Weightage</span></div>
          {result.chapters.map((ch, i) => (
            <div key={i} className="ch-row" style={dynStyles.chRow}>
              <span className="ch-name" style={dynStyles.chName}>{ch.name}</span>
              <span className="ch-wt">{ch.weightage}</span>
            </div>
          ))}
        </div>
      )}
      {result.formulas?.length > 0 && (
        <div className="sblock" style={{ ...dynStyles.sblock, background: 'rgba(15,169,104,.05)', borderColor: 'rgba(15,169,104,.18)' }}>
          <div className="stitle" style={{ color: TH.textPrimary }}>📐 <span className="stitle-ac">Key Formulas</span></div>
          {result.formulas.map((f, i) => <div key={i} className="fmono">{f}</div>)}
        </div>
      )}
      {result.tricks?.length > 0 && (
        <div className="sblock" style={{ background: 'rgba(242,169,59,.05)', borderColor: 'rgba(242,169,59,.18)' }}>
          <div className="stitle">🧠 <span style={{ color: A.gold2 }}>Memory Tricks</span></div>
          {result.tricks.map((t, i) => <div key={i} className="trick-item">{t}</div>)}
        </div>
      )}
      {result.exam_tips?.length > 0 && (
        <div className="sblock" style={dynStyles.sblock}>
          <div className="stitle" style={{ color: TH.textPrimary }}>🎯 <span className="stitle-ac">Exam Day Tips</span></div>
          <div className="tips-grid">{result.exam_tips.map((t, i) => <div key={i} className="tip-card" style={dynStyles.tipCard}>{t}</div>)}</div>
        </div>
      )}
      {result.avoid_mistakes?.length > 0 && (
        <div className="sblock" style={{ background: 'rgba(242,169,59,.05)', borderColor: 'rgba(242,169,59,.18)' }}>
          <div className="stitle">⚠️ <span style={{ color: A.gold2 }}>Avoid These Mistakes</span></div>
          {result.avoid_mistakes.map((m, i) => <div key={i} className="mistake-item" style={{ color: A.gold2 }}>✗ {m}</div>)}
        </div>
      )}
    </div>
  );

  const renderMindMap = () => (
    <div>
      <ResultHeader title={`🧠 ${result.central_topic}`} sub={result.summary}
        badges={[{ text: `${result.branches?.length || 0} Branches`, color: 'indigo' }]} />
      {result.branches?.map((branch, i) => (
        <div key={i} className="branch-block" style={{ borderColor: (branch.color || A.emerald) + '55', background: (branch.color || A.emerald) + '10' }}>
          <div className="bb-title" style={{ color: branch.color || A.emerald }}>◆ {branch.name}</div>
          {branch.sub_branches?.map((sub, j) => (
            <div key={j} className="sub-branch">
              <div className="sb-name">{sub.name}</div>
              {sub.details?.map((d, k) => <div key={k} className="sb-detail" style={dynStyles.connItem}>{d}</div>)}
            </div>
          ))}
        </div>
      ))}
      {result.connections?.length > 0 && (
        <div className="sblock" style={{ ...dynStyles.sblock, background: 'rgba(21,150,214,.05)', borderColor: 'rgba(21,150,214,.2)' }}>
          <div className="stitle">🔗 <span style={{ color: A.sky2 }}>Topic Connections</span></div>
          {result.connections.map((c, i) => <div key={i} className="conn-item" style={dynStyles.connItem}>{c}</div>)}
        </div>
      )}
    </div>
  );

  const renderFormulas = () => (
    <div>
      <ResultHeader title={result.title || '📐 Formula Sheet'} sub={`Subject: ${result.subject}`}
        badges={[{ text: `${result.categories?.length || 0} Categories`, color: 'amber' }, { text: `${result.categories?.reduce((a, c) => a + (c.formulas?.length || 0), 0) || 0} Formulas`, color: 'indigo' }]} />
      {result.categories?.map((cat, i) => (
        <div key={i} className="sblock" style={dynStyles.sblock}>
          <div className="fcat-title">📂 {cat.name}</div>
          {cat.formulas?.map((f, j) => (
            <div key={j} className="fcrd" style={dynStyles.fcrd}>
              <div className="fcrd-name" style={dynStyles.fcrdName}>{f.name}</div>
              <div className="fcrd-expr">{f.formula}</div>
              <div className="fcrd-vars" style={dynStyles.fcrdVars}>{f.variables}</div>
              <div className="fcrd-use">{f.use}</div>
            </div>
          ))}
        </div>
      ))}
      {result.constants?.length > 0 && (
        <div className="sblock" style={dynStyles.sblock}>
          <div className="stitle" style={{ color: TH.textPrimary }}>🔢 <span className="stitle-ac">Constants</span></div>
          {result.constants.map((c, i) => (
            <div key={i} className="const-item" style={dynStyles.constItem}>
              <span className="const-sym">{c.symbol}</span>
              <span className="const-val" style={dynStyles.constVal}>= {c.value}</span>
              <span className="const-name" style={dynStyles.constName}>({c.name})</span>
            </div>
          ))}
        </div>
      )}
      {result.tips?.length > 0 && (
        <div className="sblock" style={dynStyles.sblock}>
          <div className="stitle" style={{ color: TH.textPrimary }}>💡 <span className="stitle-ac">Formula Tips</span></div>
          <div className="tips-grid">{result.tips.map((t, i) => <div key={i} className="tip-card" style={dynStyles.tipCard}>{t}</div>)}</div>
        </div>
      )}
    </div>
  );

  const renderResult = () => {
    if (!result) return null;
    const map = { study_plan: renderStudyPlan, notes: renderNotes, quiz: renderQuiz, flashcards: renderFlashcards, math: renderMath, revision: renderRevision, mind_map: renderMindMap, formulas: renderFormulas };
    return map[mode]?.();
  };

  /* ══════════════════════════════════════════
     sharedFormJSX is a variable, NOT
     an inline component. No remount on re-render.
  ══════════════════════════════════════════ */
  const sharedFormJSX = (
    <div className="s-form" style={dynStyles.form}>
      {mode === 'math' && (
        <>
          <label className="flabel" style={dynStyles.flabel}>Math Problem *</label>
          <textarea className="math-ta"
            style={dynStyles.mathTa}
            placeholder={"Solve: 2x² + 5x - 3 = 0\nOr: Find derivative of f(x) = x³ + 2x²\nOr: A train travels 120 km at 60 km/h, find time…"}
            value={mathInput}
            onChange={e => setMathInput(e.target.value)} />
        </>
      )}

      <label className="flabel" style={dynStyles.flabel}>Subject *</label>
      <input
        className="finput"
        style={dynStyles.input}
        placeholder="Physics, PCM, PCB, Math+Eco, History…"
        value={localSubject}
        onChange={e => setLocalSubject(e.target.value)}
        onBlur={e => syncSubject(e.target.value)}
      />
      {parsedSubjects && (
        <div className="smart-banner">
          <span className="smart-banner-icon">🧠</span>
          <span className="smart-banner-text">Detected:</span>
          <div className="smart-banner-subjects">
            {parsedSubjects.subjects.map((s, i) => <span key={i} className="s-subj-chip">{s}</span>)}
          </div>
        </div>
      )}

      <label className="flabel" style={dynStyles.flabel}>Exam Name</label>
      <input
        className="finput"
        style={dynStyles.input}
        placeholder="JEE, NEET, CBSE Boards, UPSC, CAT…"
        value={localExam}
        onChange={e => setLocalExam(e.target.value)}
        onBlur={e => syncExam(e.target.value)}
      />
      {examSuggestion && (
        <div className="exam-banner">
          <div className="exam-banner-left">
            <span style={{ fontSize: 14 }}>🎯</span>
            <span className="exam-banner-text">
              Detected: <b>{examSuggestion.full}</b>
              {examSuggestion.subjects.length > 0 && ` · Subjects: ${examSuggestion.subjects.join(', ')}`}
            </span>
          </div>
          <button className="exam-apply-btn" onClick={applyExamSuggestion}>Apply →</button>
        </div>
      )}

      <div className="frow">
        <div className="fhalf">
          <label className="flabel" style={dynStyles.flabel}>Level</label>
          <select className="fselect" style={dynStyles.input} value={form.level} onChange={e => setF('level', e.target.value)}>
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </div>
        <div className="fhalf">
          <label className="flabel" style={dynStyles.flabel}>Goal</label>
          <select className="fselect" style={dynStyles.input} value={form.goal} onChange={e => setF('goal', e.target.value)}>
            <option value="pass">Pass the Exam</option>
            <option value="good_marks">Good Marks</option>
            <option value="top_rank">Top Rank</option>
            <option value="concept_clarity">Concept Clarity</option>
          </select>
        </div>
      </div>

      {mode === 'study_plan' && (
        <>
          <label className="flabel" style={dynStyles.flabel}>Days Available</label>
          <select className="fselect" style={dynStyles.input} value={form.timeAvailable} onChange={e => setF('timeAvailable', e.target.value)}>
            <option value="7">7 Days (1 Week)</option>
            <option value="14">14 Days (2 Weeks)</option>
            <option value="30">30 Days (1 Month)</option>
            <option value="60">60 Days (2 Months)</option>
            <option value="90">90 Days (3 Months)</option>
          </select>
        </>
      )}

      <label className="flabel" style={dynStyles.flabel}>Topics (optional)</label>
      <input
        className="finput"
        style={dynStyles.input}
        placeholder={mode === 'math' ? 'e.g. Quadratic Equations, Calculus…' : 'e.g. Calculus, Thermodynamics, World War 2…'}
        value={localTopics}
        onChange={e => setLocalTopics(e.target.value)}
        onBlur={e => syncTopics(e.target.value)}
      />

      {mode !== 'math' && (
        <>
          <label className="flabel" style={dynStyles.flabel}>Weak Areas (optional)</label>
          <input
            className="finput"
            style={dynStyles.input}
            placeholder="e.g. Organic Chemistry, Integration…"
            value={localWeak}
            onChange={e => setLocalWeak(e.target.value)}
            onBlur={e => syncWeak(e.target.value)}
          />
        </>
      )}

      <button
        className={`gen-btn ${activeMode?.btnClass || 'gen-indigo'}`}
        disabled={loading || !localSubject.trim() || (mode === 'math' && !mathInput.trim() && !localTopics.trim())}
        onClick={syncAllAndGenerate}>
        {loading ? '⏳ Generating…'
          : mode === 'math' ? '🧮 Solve Problem'
          : mode === 'flashcards' ? '🃏 Generate Flashcards'
          : mode === 'quiz' ? '❓ Generate Quiz'
          : mode === 'revision' ? '🔄 Build Revision Guide'
          : `${activeMode?.icon} Generate ${activeMode?.name}`}
      </button>
    </div>
  );

  return (
    <div className="sw" style={dynStyles.sw}>

      <Helmet>
        <title>Smart Study — AI Tools for Notes & Exams | MK AI</title>
        <meta name="description" content="Master your notes and exams with 8 AI-powered study tools on MK AI." />
      </Helmet>
      <div className="s-grid" />
      <div className="s-orb1" />
      <div className="s-orb2" />

      {/* ── HEADER ── */}
      <header className="s-header" style={dynStyles.header}>
        <div className="s-logo">
          <div className="s-logo-icon">📚</div>
          <span className="s-logo-name">MK Study Planner</span>
          <span className="s-logo-tag">AI POWERED</span>
        </div>
        <div className="s-hdr-right">
          {activeTool && (
            <button className="s-btn-back" style={dynStyles.btnBack} onClick={goBack}>← All Tools</button>
          )}
          <button className="s-btn-back" style={dynStyles.btnBack} onClick={() => navigate('/')}>🏠 Home</button>
        </div>
      </header>

      <main className="s-main">
        {/* ═══ LANDING ═══ */}
        {!activeTool ? (
          <>
            <div className="s-hero">
              <div className="s-hero-pill">🚀 8 Study Tools in One</div>
              <h1 className="s-hero-title" style={{ color: TH.textPrimary }}>
                Study Smarter with<br />
                <span className="s-hero-grad">AI-Powered Tools</span>
              </h1>
              <p className="s-hero-sub" style={dynStyles.heroSub}>
                Study plans, notes, quizzes, flashcards, math solver — Everything in one place.
              </p>
            </div>

            <div className="tool-grid-wrap">
              <div className="tg-label" style={dynStyles.tgLabel}>Choose Your Tool</div>
              <div className="tg">
                {MODES.map((m, idx) => (
                  <div key={m.id}
                    className="tc"
                    style={{ ...dynStyles.tc, animationDelay: `${idx * 0.05}s`, animation: 'fadeUp .45s ease both' }}
                    onClick={() => openTool(m.id)}>
                    <span className="tc-icon" style={{ animationDelay: `${idx * 0.2}s` }}>{m.icon}</span>
                    <div className="tc-name" style={dynStyles.tcName}>{m.name}</div>
                    <div className="tc-desc" style={dynStyles.tcDesc}>{m.desc}</div>
                    <div style={{ marginTop: 10, fontSize: 10, fontWeight: 700, color: m.color, display: 'flex', alignItems: 'center', gap: 4 }}>
                      Open <span>→</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ textAlign: 'center', marginTop: 22, fontSize: 11.5, color: TH.textMuted, animation: 'fadeUp .5s .4s ease both' }}>
              Powered by MK AI · 7 AI Providers · PDF export supported
            </div>
          </>
        ) : (
          /* ═══ TOOL VIEW ═══ */
          <>
            <div className="tool-view-header" style={dynStyles.toolViewHeader}>
              <div className="tvh-icon" style={{ background: activeMode?.color + '22', border: `1px solid ${activeMode?.color}44` }}>
                {activeMode?.icon}
              </div>
              <div className="tvh-info">
                <div className="tvh-name" style={dynStyles.tvhName}>{activeMode?.name}</div>
                <div className="tvh-sub" style={dynStyles.tvhSub}>
                  {localSubject ? `Subject: ${subjectForDisplay}` : 'Fill in your subject to get started'}
                  {localExam ? ` · ${localExam}` : ''}
                </div>
              </div>
              <button className="tvh-back" style={dynStyles.tvhBack} onClick={goBack}>← All Tools</button>
            </div>

            {/* Quick-switch other tools */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 18, animation: 'fadeIn .35s ease' }}>
              {MODES.filter(m => m.id !== mode).map(m => (
                <button key={m.id}
                  style={{ ...dynStyles.switchBtn, padding: '6px 13px', borderRadius: 9, cursor: 'pointer', fontSize: 11, fontWeight: 700, border: `1px solid ${TH.border2}`, fontFamily: "'Inter',sans-serif", transition: 'all .2s', display: 'flex', alignItems: 'center', gap: 4 }}
                  onClick={() => openTool(m.id)}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = m.color + '60'; e.currentTarget.style.color = m.color; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = TH.border2; e.currentTarget.style.color = TH.textSub; }}>
                  {m.icon} {m.name}
                </button>
              ))}
            </div>

            {sharedFormJSX}

            {loading && (
              <div className="s-loading" style={dynStyles.loading}>
                <span className="sl-icon">{lm?.icon}</span>
                <div className="sl-title" style={dynStyles.slTitle}>{lm?.title}</div>
                <div className="sl-sub" style={dynStyles.slSub}>{lm?.sub}</div>
                <div className="sl-bar"><div className="sl-fill" /></div>
              </div>
            )}

            {result && (
              <div ref={resultRef} style={{ animation: 'fadeUp .5s ease' }}>
                {renderResult()}
              </div>
            )}
          </>
        )}
      </main>

      {toast && <div className="toast">✅ {toast}</div>}
    </div>
  );
}