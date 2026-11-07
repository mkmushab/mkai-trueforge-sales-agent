import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import { Helmet } from 'react-helmet-async';

/* ─────────────────────── THEME ─────────────────────── */
const THEME = {
  bg: '#f6faf7',
  headerBg: 'rgba(246,250,247,0.92)',
  headerBorder: 'rgba(15,169,104,0.15)',
  textPrimary: '#122420',
  textMuted: 'rgba(18,54,42,0.42)',
  textSub: 'rgba(18,54,42,0.6)',
  border2: 'rgba(15,169,104,0.15)',
  bgGradient: 'radial-gradient(ellipse at 85% 50%,rgba(15,169,104,0.08) 0%,transparent 55%)',
};

/* ─────────────────────── AI PROVIDERS (same fallback chain as Margdarshak.jsx) ───────────────────────
   NOTE: These keys are hardcoded client-side, which means anyone can read them from
   the browser's DevTools Network/Sources tab. Proxy these through a backend before
   shipping publicly. ────────────────────── */
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
  const tried = new Set();
  const primary = AI_PROVIDERS.find(p => p.name === PRIMARY_PROVIDER_NAME) || AI_PROVIDERS[0];
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
async function callAI(prompt, systemMsg) {
  return callAIMessages([
    { role: 'system', content: systemMsg || 'You are an expert skilling assessor. Return ONLY valid JSON — no markdown, no backticks.' },
    { role: 'user', content: prompt },
  ]);
}

/* ─────────────────────── EXTERNAL GROUNDING APIs (free, no key) ─────────────────────── */
// Real rule-based grammar engine — NOT an AI guess.
async function checkGrammarLanguageTool(text) {
  try {
    const res = await fetch('https://api.languagetool.org/v2/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `text=${encodeURIComponent(text)}&language=en-US`,
    });
    if (!res.ok) return { matches: [], ok: false };
    const data = await res.json();
    return { matches: data.matches || [], ok: true };
  } catch (e) { return { matches: [], ok: false }; }
}
// Word pronunciation / definitions.
async function fetchDefinition(word) {
  try {
    const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word.trim())}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data[0] || null;
  } catch (e) { return null; }
}
// Live Wikipedia summary — always shown with a visible "Source: Wikipedia" citation in the UI.
async function fetchWikiSummary(title) {
  try {
    const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`);
    if (!res.ok) return null;
    const data = await res.json();
    return { title: data.title, extract: data.extract, url: data.content_urls?.desktop?.page };
  } catch (e) { return null; }
}

/* ─────────────────────── SKILL TAXONOMY (64+ skills across 8 domains) ───────────────────────
   ssc = indicative Sector Skill Council mapping under NSQF for that trade.
   Skills without `ssc` are modern/digital skills that don't yet have a formal
   NSQF mapping — the UI must label this honestly rather than inventing one. */
const SKILL_DOMAINS = [
  { id: 'soft', label: 'Soft & Employability Skills', icon: '🤝', skills: [
    { id: 'english', name: 'English Speaking', icon: '🗣️', diagType: 'speaking', flagship: true },
    { id: 'communication', name: 'Communication & Interview Skills', icon: '🎤', diagType: 'situational' },
    { id: 'digital-literacy', name: 'Digital Literacy', icon: '💻', diagType: 'mcq' },
    { id: 'teamwork', name: 'Teamwork & Workplace Behavior', icon: '🧑‍🤝‍🧑', diagType: 'situational' },
    { id: 'time-management', name: 'Time Management', icon: '⏰', diagType: 'situational' },
    { id: 'problem-solving', name: 'Problem Solving', icon: '🧩', diagType: 'situational' },
    { id: 'leadership', name: 'Leadership Basics', icon: '🧭', diagType: 'situational' },
    { id: 'financial-literacy', name: 'Financial Literacy', icon: '💰', diagType: 'mcq' },
  ]},
  { id: 'coding', label: 'Programming Languages', icon: '👨‍💻', skills: [
    { id: 'python', name: 'Python', icon: '🐍', diagType: 'mcq' },
    { id: 'javascript', name: 'JavaScript', icon: '📜', diagType: 'mcq' },
    { id: 'java', name: 'Java', icon: '☕', diagType: 'mcq' },
    { id: 'c-prog', name: 'C Programming', icon: '🔤', diagType: 'mcq' },
    { id: 'cpp', name: 'C++', icon: '➕', diagType: 'mcq' },
    { id: 'html-css', name: 'HTML & CSS', icon: '🌐', diagType: 'mcq' },
    { id: 'sql', name: 'SQL & Databases', icon: '🗄️', diagType: 'mcq' },
    { id: 'php', name: 'PHP', icon: '🐘', diagType: 'mcq' },
    { id: 'kotlin', name: 'Kotlin (Android)', icon: '📱', diagType: 'mcq' },
    { id: 'swift', name: 'Swift (iOS)', icon: '🍏', diagType: 'mcq' },
  ]},
  { id: 'frameworks', label: 'Frameworks & Tools', icon: '🧰', skills: [
    { id: 'react', name: 'React.js', icon: '⚛️', diagType: 'mcq' },
    { id: 'nodejs', name: 'Node.js', icon: '🟢', diagType: 'mcq' },
    { id: 'django', name: 'Django', icon: '🎸', diagType: 'mcq' },
    { id: 'flutter', name: 'Flutter', icon: '🦋', diagType: 'mcq' },
    { id: 'angular', name: 'Angular', icon: '🅰️', diagType: 'mcq' },
    { id: 'vuejs', name: 'Vue.js', icon: '🟩', diagType: 'mcq' },
    { id: 'git-github', name: 'Git & GitHub', icon: '🐙', diagType: 'mcq' },
    { id: 'cloud-basics', name: 'Cloud Basics (AWS/Azure)', icon: '☁️', diagType: 'mcq' },
  ]},
  { id: 'data', label: 'Data, AI & Analytics', icon: '📊', skills: [
    { id: 'ms-excel', name: 'MS Excel', icon: '📗', diagType: 'mcq' },
    { id: 'data-analysis', name: 'Data Analysis', icon: '📈', diagType: 'mcq' },
    { id: 'data-science', name: 'Data Science Basics', icon: '🔬', diagType: 'mcq' },
    { id: 'ml-basics', name: 'Machine Learning Basics', icon: '🤖', diagType: 'mcq' },
    { id: 'power-bi', name: 'Power BI / Tableau', icon: '📉', diagType: 'mcq' },
    { id: 'data-entry', name: 'Data Entry', icon: '⌨️', diagType: 'mcq' },
  ]},
  { id: 'design', label: 'Design & Creative', icon: '🎨', skills: [
    { id: 'graphic-design', name: 'Graphic Design', icon: '🖌️', diagType: 'mcq' },
    { id: 'ui-ux', name: 'UI/UX Design', icon: '🧑‍🎨', diagType: 'mcq' },
    { id: 'video-editing', name: 'Video Editing', icon: '🎬', diagType: 'mcq' },
    { id: 'animation', name: '2D/3D Animation', icon: '🌀', diagType: 'mcq' },
    { id: 'photography', name: 'Photography', icon: '📷', diagType: 'mcq' },
    { id: 'canva-design', name: 'Canva / Quick Design Tools', icon: '🖼️', diagType: 'mcq' },
  ]},
  { id: 'marketing', label: 'Digital Marketing', icon: '📣', skills: [
    { id: 'seo', name: 'SEO', icon: '🔍', diagType: 'mcq' },
    { id: 'smm', name: 'Social Media Marketing', icon: '📱', diagType: 'mcq' },
    { id: 'content-writing', name: 'Content Writing', icon: '✍️', diagType: 'mcq' },
    { id: 'google-ads', name: 'Google Ads / Performance Marketing', icon: '🎯', diagType: 'mcq' },
    { id: 'email-marketing', name: 'Email Marketing', icon: '📧', diagType: 'mcq' },
    { id: 'ecommerce', name: 'E-commerce Basics', icon: '🛒', diagType: 'mcq' },
  ]},
  { id: 'business', label: 'Business & Office', icon: '🏢', skills: [
    { id: 'tally', name: 'Tally & Accounting', icon: '🧾', diagType: 'mcq' },
    { id: 'ms-office', name: 'MS Office Suite', icon: '🗂️', diagType: 'mcq' },
    { id: 'gst-basics', name: 'GST & Taxation Basics', icon: '💵', diagType: 'mcq' },
    { id: 'hr-basics', name: 'HR & Recruitment Basics', icon: '🧑‍💼', diagType: 'mcq' },
    { id: 'sales-skills', name: 'Sales Skills', icon: '🤝', diagType: 'situational' },
  ]},
  { id: 'trades', label: 'Traditional Vocational Trades', icon: '🛠️', skills: [
    { id: 'tailoring', name: 'Tailoring', icon: '🧵', diagType: 'mcq', ssc: 'Apparel, Made-ups & Home Furnishing SSC' },
    { id: 'electrician', name: 'Electrician', icon: '💡', diagType: 'mcq', ssc: 'Power Sector Skill Council' },
    { id: 'plumbing', name: 'Plumbing', icon: '🔧', diagType: 'mcq', ssc: 'Plumbing Skill Council of India' },
    { id: 'beautician', name: 'Beautician & Wellness', icon: '💇', diagType: 'mcq', ssc: 'Beauty & Wellness SSC' },
    { id: 'automotive', name: 'Automotive Repair', icon: '🚗', diagType: 'mcq', ssc: 'Automotive Skills Development Council' },
    { id: 'carpentry', name: 'Carpentry', icon: '🪚', diagType: 'mcq', ssc: 'Furniture & Fittings Skill Council' },
    { id: 'welding', name: 'Welding & Fabrication', icon: '🔩', diagType: 'mcq', ssc: 'Capital Goods SSC' },
    { id: 'food-beverage', name: 'Food & Beverage Service', icon: '🍽️', diagType: 'mcq', ssc: 'Tourism & Hospitality SSC' },
    { id: 'healthcare-assist', name: 'Healthcare Assistant', icon: '🩺', diagType: 'mcq', ssc: 'Healthcare Sector Skill Council' },
    { id: 'agriculture', name: 'Agriculture & Farming', icon: '🌾', diagType: 'mcq', ssc: 'Agriculture Skill Council of India' },
    { id: 'construction', name: 'Construction & Masonry', icon: '🧱', diagType: 'mcq', ssc: 'Construction SSC' },
    { id: 'retail', name: 'Retail Sales', icon: '🏬', diagType: 'situational', ssc: 'Retailers Association SSC of India' },
    { id: 'bpo', name: 'BPO / Customer Service', icon: '🎧', diagType: 'situational', ssc: 'IT-ITeS SSC (NASSCOM)' },
    { id: 'logistics', name: 'Logistics & Warehousing', icon: '📦', diagType: 'mcq', ssc: 'Logistics Sector Skill Council' },
    { id: 'security', name: 'Security Services', icon: '🛡️', diagType: 'mcq', ssc: 'Security SSC' },
  ]},
];
const ALL_SKILLS = SKILL_DOMAINS.flatMap(d => d.skills.map(s => ({ ...s, domainId: d.id, domainLabel: d.label })));
const SKILL_COUNT = ALL_SKILLS.length;

/* Indicative NSQF level descriptors — paraphrased, not the official verbatim text.
   Always shown with a "verify on nsdcindia.org" caveat. */
const NSQF_LEVELS = [
  { level: 1, desc: 'Can follow simple, repetitive instructions under close supervision.' },
  { level: 2, desc: 'Can perform basic routine tasks with some supervision.' },
  { level: 3, desc: 'Can perform a range of routine tasks with defined procedures, limited supervision.' },
  { level: 4, desc: 'Can perform a broad range of skilled tasks, some non-routine, with minimal supervision.' },
  { level: 5, desc: 'Can perform skilled tasks requiring judgement, plans own work.' },
  { level: 6, desc: 'Can supervise others, handle non-routine problems, some technical/managerial responsibility.' },
  { level: 7, desc: 'Can manage a team, take technical/managerial decisions in a defined field.' },
  { level: 8, desc: 'Can manage complex activities, significant autonomy and responsibility.' },
  { level: 9, desc: 'Specialist / expert level, contributes to knowledge development in the field.' },
  { level: 10, desc: 'Highest level of mastery, research/innovation leadership in the field.' },
];
function estimateNSQFLevel(scorePct) {
  if (scorePct >= 90) return 6;
  if (scorePct >= 75) return 5;
  if (scorePct >= 60) return 4;
  if (scorePct >= 40) return 3;
  if (scorePct >= 20) return 2;
  return 1;
}

const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

const SKILL_TREE_STAGES = ['Beginner', 'Intermediate', 'Advanced', 'Job-Ready'];

const LANGUAGES = [
  { code: 'hi', label: 'हिंदी (Hindi)', speech: 'hi-IN' },
  { code: 'hinglish', label: 'Hinglish', speech: 'hi-IN' },
  { code: 'en', label: 'English', speech: 'en-IN' },
  { code: 'bn', label: 'বাংলা (Bengali)', speech: 'bn-IN' },
  { code: 'ta', label: 'தமிழ் (Tamil)', speech: 'ta-IN' },
  { code: 'te', label: 'తెలుగు (Telugu)', speech: 'te-IN' },
  { code: 'mr', label: 'मराठी (Marathi)', speech: 'mr-IN' },
  { code: 'gu', label: 'ગુજરાતી (Gujarati)', speech: 'gu-IN' },
  { code: 'pa', label: 'ਪੰਜਾਬੀ (Punjabi)', speech: 'pa-IN' },
  { code: 'kn', label: 'ಕನ್ನಡ (Kannada)', speech: 'kn-IN' },
];

/* ─────────────────────── SPACED REPETITION (reused approach from Margdarshak) ─────────────────────── */
function injectSpacedRepetition(planResult, weakGaps) {
  if (!planResult?.weekly_plan || !weakGaps?.length) return planResult;
  const weakTopics = weakGaps.map(g => (g.topic || '').toLowerCase()).filter(Boolean);
  if (!weakTopics.length) return planResult;
  const flat = [];
  planResult.weekly_plan.forEach((week, wi) => (week.days || []).forEach((day, di) => flat.push({ wi, di, day })));
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

/* ─────────────────────── SPEECH: continuous recording + objective metrics ─────────────────────── */
function useContinuousSpeech() {
  const recogRef = useRef(null);
  const startTimeRef = useRef(null);
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [duration, setDuration] = useState(0);

  const start = useCallback((lang) => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert('Voice input isn\'t supported in this browser. Try Chrome.'); return; }
    const recog = new SR();
    recog.lang = lang || 'en-IN';
    recog.continuous = true;
    recog.interimResults = true;
    let finalText = '';
    recog.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalText += t + ' ';
        else interim += t;
      }
      setTranscript((finalText + interim).trim());
    };
    recog.onerror = () => setRecording(false);
    recog.onend = () => setRecording(false);
    recogRef.current = recog;
    startTimeRef.current = performance.now();
    setTranscript('');
    setRecording(true);
    recog.start();
  }, []);

  const stop = useCallback(() => {
    recogRef.current?.stop();
    if (startTimeRef.current) setDuration((performance.now() - startTimeRef.current) / 1000);
    setRecording(false);
  }, []);

  return { recording, transcript, duration, start, stop };
}

function useSpeechToText() {
  const recogRef = useRef(null);
  const [listening, setListening] = useState(false);
  const start = useCallback((lang, onResult) => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert('Voice input isn\'t supported in this browser. Try Chrome.'); return; }
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

function MicButton({ lang, onResult, big }) {
  const { listening, start, stop } = useSpeechToText();
  return (
    <button type="button" className={`ks-mic-btn ${listening ? 'listening' : ''} ${big ? 'big' : ''}`}
      onClick={() => (listening ? stop() : start(lang, onResult))} title="Voice input">
      {listening ? '🔴' : '🎤'}
    </button>
  );
}

function SpeakButton({ text, lang, label = '🔊 Listen' }) {
  const [speaking, setSpeaking] = useState(false);
  const toggle = () => {
    if (!window.speechSynthesis) { alert('Text-to-speech isn\'t supported in this browser.'); return; }
    if (speaking) { window.speechSynthesis.cancel(); setSpeaking(false); return; }
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = lang || 'en-IN';
    utter.rate = 0.95;
    utter.onend = () => setSpeaking(false);
    setSpeaking(true);
    window.speechSynthesis.speak(utter);
  };
  return <button type="button" className="ks-speak-btn" onClick={toggle}>{speaking ? '⏸ Stop' : label}</button>;
}

// Objectively computed from transcript + timestamps — labeled "Measured" in the UI, never AI-guessed.
function computeSpeechMetrics(transcript, durationSec) {
  const words = transcript.trim().split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const wpm = durationSec > 0 ? Math.round((wordCount / durationSec) * 60) : 0;
  const fillers = ['um', 'uh', 'umm', 'uhh', 'like', 'you know', 'actually', 'basically'];
  const lower = transcript.toLowerCase();
  let fillerCount = 0;
  fillers.forEach(f => {
    const re = new RegExp(`\\b${f.replace(/\s+/g, '\\s+')}\\b`, 'g');
    const m = lower.match(re);
    if (m) fillerCount += m.length;
  });
  const uniqueWords = new Set(words.map(w => w.toLowerCase().replace(/[^\w']/g, ''))).size;
  const ttr = wordCount > 0 ? +(uniqueWords / wordCount).toFixed(2) : 0;
  const sentences = transcript.split(/[.!?]+/).map(s => s.trim()).filter(Boolean);
  const sentenceLengths = sentences.map(s => s.split(/\s+/).filter(Boolean).length);
  const avgLen = sentenceLengths.length ? sentenceLengths.reduce((a, b) => a + b, 0) / sentenceLengths.length : 0;
  const variance = sentenceLengths.length ? sentenceLengths.reduce((a, b) => a + Math.pow(b - avgLen, 2), 0) / sentenceLengths.length : 0;
  return {
    wordCount, wpm, fillerCount, ttr,
    avgSentenceLength: +avgLen.toFixed(1),
    sentenceLengthStdDev: +Math.sqrt(variance).toFixed(2),
    durationSec: +durationSec.toFixed(1),
  };
}

/* ─────────────────────── PDF EXPORT — "Skill Snapshot" (self-assessment, not a verified certificate) ─────────────────────── */
const loadJsPDF = () => new Promise((res, rej) => {
  if (window.jspdf) return res();
  const el = document.createElement('script');
  el.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
  el.onload = res; el.onerror = rej;
  document.head.appendChild(el);
});

async function exportSkillSnapshot({ skillName, diagResult, planResult, arenaFeedback, nsqfLevel, ssc, language }) {
  await loadJsPDF();
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ format: 'a4', unit: 'mm' });
  const W = 210, M = 16;
  let y = 0;
  const rgb = hex => { const h = hex.replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; };
  const TEAL = '0FA968', GOLD = 'F2A93B', GREEN = '10B981', RED = 'EF4444', BG = '0A0A0F';
  const newPage = () => {
    doc.addPage();
    doc.setFillColor(...rgb(BG)); doc.rect(0, 0, W, 297, 'F');
    doc.setFillColor(...rgb(TEAL)); doc.rect(0, 0, W, 8, 'F');
    doc.setTextColor(...rgb(GOLD)); doc.setFontSize(7); doc.setFont('helvetica', 'bold');
    doc.text('KAUSHAL AI — Skill Snapshot (Self-Assessment)', M, 6);
    doc.setTextColor(150, 150, 150);
    doc.text(`${skillName} | ${new Date().toLocaleDateString()}`, W - M, 6, { align: 'right' });
    y = 18;
  };
  const chk = (n = 16) => { if (y + n > 275) newPage(); };
  const heading = (text, color = TEAL) => {
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
  const bullet = (items = [], color = '94A3B8', dot = TEAL) => {
    (items || []).forEach(item => {
      chk(7); doc.setFillColor(...rgb(dot)); doc.circle(M + 2.5, y - 1, 1.2, 'F');
      doc.setTextColor(...rgb(color)); doc.setFontSize(9); doc.setFont('helvetica', 'normal');
      const lines = doc.splitTextToSize(String(item), W - M * 2 - 8);
      doc.text(lines, M + 7, y); y += lines.length * 5 + 2;
    }); y += 2;
  };

  doc.setFillColor(...rgb(BG)); doc.rect(0, 0, W, 297, 'F');
  doc.setFillColor(...rgb(TEAL)); doc.rect(0, 0, 6, 297, 'F');
  doc.setTextColor(...rgb(GOLD)); doc.setFontSize(9); doc.setFont('helvetica', 'bold');
  doc.text('KAUSHAL AI  ·  DIAGNOSE · BUILD · PRACTICE · CERTIFY · MATCH', 16, 35);
  doc.setFillColor(...rgb(GOLD)); doc.rect(16, 38, 90, 0.6, 'F');
  doc.setTextColor(240, 248, 255); doc.setFontSize(24); doc.setFont('helvetica', 'bold');
  doc.text('SKILL SNAPSHOT', 16, 58);
  doc.setTextColor(...rgb('94A3B8')); doc.setFontSize(11); doc.setFont('helvetica', 'normal');
  doc.text('This is a self-assessment report, not a verified or accredited certificate.', 16, 68);
  doc.setFontSize(13); doc.setTextColor(255, 255, 255);
  doc.text('Skill: ' + skillName, 16, 82);
  doc.setFontSize(11); doc.setTextColor(...rgb('94A3B8'));
  doc.text('Language: ' + language, 16, 92);
  if (nsqfLevel) doc.text(`Indicative NSQF Level: ${nsqfLevel} (mapping is approximate — verify at nsdcindia.org)`, 16, 100);
  if (ssc) doc.text('Related Sector Skill Council: ' + ssc, 16, 108);
  doc.setTextColor(...rgb('475569')); doc.setFontSize(8);
  doc.text('Generated by Kaushal AI | ' + new Date().toLocaleDateString(), 16, 275);

  newPage();
  heading('DIAGNOSIS RESULTS', TEAL);
  para(diagResult?.summary);
  if (diagResult?.measured) {
    heading('Measured (objective, not AI-generated)', GREEN);
    const m = diagResult.measured;
    bullet([
      `Speaking pace: ${m.wpm} words/min`,
      `Filler words used: ${m.fillerCount}`,
      `Vocabulary diversity (type-token ratio): ${m.ttr}`,
      `Avg sentence length: ${m.avgSentenceLength} words (variation: ${m.sentenceLengthStdDev})`,
    ], 'A7F3D0', GREEN);
  }
  if (diagResult?.strengths?.length) { heading('Strengths', GREEN); bullet(diagResult.strengths, 'A7F3D0', GREEN); }
  if (diagResult?.weakGaps?.length) {
    heading('Weak Areas (AI Feedback)', RED);
    bullet(diagResult.weakGaps.map(g => `${g.topic} (${g.severity}) — ${g.why || ''}`), 'FCA5A5', RED);
  }

  if (planResult) {
    newPage();
    heading('PRACTICE PLAN OVERVIEW', TEAL);
    para(planResult.overview);
  }

  if (arenaFeedback) {
    newPage();
    heading('PRACTICE ARENA FEEDBACK (AI Feedback)', TEAL);
    para(arenaFeedback.summary);
    if (arenaFeedback.strengths?.length) bullet(arenaFeedback.strengths, '94A3B8', GREEN);
    if (arenaFeedback.improvements?.length) { heading('Suggested Improvements', GOLD); bullet(arenaFeedback.improvements, 'FDE68A', GOLD); }
  }

  doc.save('Kaushal_SkillSnapshot_' + skillName.replace(/\s+/g, '_') + '.pdf');
}

const STORAGE_KEY = 'kaushal_progress_v1';

/* ─────────────────────── CSS ─────────────────────── */
const STATIC_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=Space+Mono:wght@400;700&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
@keyframes fadeUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
@keyframes shimmer{0%{background-position:-300% center}100%{background-position:300% center}}
@keyframes micPulse{0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,.4)}50%{box-shadow:0 0 0 8px rgba(239,68,68,0)}}
html,body{font-family:'Outfit',sans-serif}
.ks-wrap{min-height:100vh;position:relative;overflow-x:hidden;font-family:'Outfit',sans-serif}
.ks-orb1{position:fixed;top:-220px;right:-120px;width:600px;height:600px;border-radius:50%;background:radial-gradient(circle,rgba(15,169,104,.12) 0%,transparent 65%);pointer-events:none;z-index:0}
.ks-orb2{position:fixed;bottom:-180px;left:-80px;width:480px;height:480px;border-radius:50%;background:radial-gradient(circle,rgba(21,150,214,.08) 0%,transparent 65%);pointer-events:none;z-index:0}
.ks-header{position:sticky;top:0;z-index:200;display:flex;align-items:center;justify-content:space-between;padding:0 28px;height:58px;backdrop-filter:blur(24px)}
.ks-logo{display:flex;align-items:center;gap:10px}
.ks-logo-icon{width:34px;height:34px;border-radius:9px;background:linear-gradient(135deg,#3DDC97,#0FA968,#0C8457);display:flex;align-items:center;justify-content:center;font-size:16px;box-shadow:0 0 18px rgba(15,169,104,.45)}
.ks-logo-name{font-size:15px;font-weight:800;letter-spacing:-.01em;background:linear-gradient(135deg,#3DDC97,#0FA968);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.ks-logo-tag{font-size:9px;font-weight:700;letter-spacing:1.2px;color:#0E77AC;background:rgba(15,169,104,.1);padding:3px 9px;border-radius:16px;border:1px solid rgba(15,169,104,.2)}
.ks-btn-back{background:transparent;border:1px solid rgba(15,169,104,.18);padding:7px 15px;border-radius:9px;cursor:pointer;font-size:12px;font-family:'Outfit',sans-serif;font-weight:600}
.ks-main{max-width:920px;margin:0 auto;padding:28px 18px 80px;position:relative;z-index:1}
.ks-hero{text-align:center;padding:26px 0 20px;animation:fadeUp .5s ease}
.ks-hero-pill{display:inline-flex;align-items:center;gap:6px;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#0E77AC;background:rgba(15,169,104,.1);border:1px solid rgba(15,169,104,.22);padding:5px 14px;border-radius:24px;margin-bottom:16px}
.ks-hero-title{font-size:clamp(28px,4.6vw,46px);font-weight:800;line-height:1.12;letter-spacing:-.02em;margin-bottom:10px}
.ks-hero-grad{background:linear-gradient(135deg,#3DDC97,#0FA968,#0C8457);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.ks-hero-sub{font-size:14px;max-width:540px;margin:0 auto;line-height:1.8}
.ks-stepper{display:flex;align-items:center;justify-content:center;gap:0;margin-bottom:26px;flex-wrap:wrap}
.ks-step{display:flex;flex-direction:column;align-items:center;gap:6px;cursor:pointer;position:relative;flex:1;min-width:70px}
.ks-step-circle{width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:13px;border:2px solid;transition:all .3s;background:#fff}
.ks-step-label{font-size:9.5px;font-weight:700;text-align:center}
.ks-step-line{flex:1;height:2px;margin:0 -2px;margin-bottom:22px;min-width:14px}
.ks-search-row{display:flex;gap:8px;margin-bottom:12px}
.ks-search-input{flex:1;border-radius:10px;padding:11px 14px;font-size:13.5px;border:1px solid rgba(15,169,104,.22);outline:none;font-family:'Outfit',sans-serif}
.ks-domain-tabs{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px}
.ks-domain-tab{padding:7px 13px;border-radius:20px;font-size:11.5px;font-weight:700;cursor:pointer;border:1px solid rgba(15,169,104,.22);background:#fff;transition:all .2s}
.ks-domain-tab.active{background:linear-gradient(135deg,#0FA968,#1596D6);color:#fff;border-color:transparent}
.ks-skill-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px}
.ks-skill-card{border-radius:12px;padding:14px 12px;cursor:pointer;text-align:center;border:1px solid rgba(15,169,104,.18);background:#fff;transition:all .2s}
.ks-skill-card:hover{background:rgba(15,169,104,.06);transform:translateY(-2px)}
.ks-skill-card.sel{background:linear-gradient(135deg,#0FA968,#1596D6);color:#fff;border-color:transparent}
.ks-skill-icon{font-size:22px;display:block;margin-bottom:6px}
.ks-skill-name{font-size:11.5px;font-weight:700;line-height:1.3}
.ks-skill-flag{font-size:8px;background:rgba(245,158,11,.15);color:#B45309;padding:2px 6px;border-radius:8px;display:inline-block;margin-top:5px;font-weight:700}
.ks-count-pill{font-size:11px;color:rgba(18,54,42,.45);margin-bottom:10px;text-align:center}
.ks-form{border-radius:18px;padding:24px;margin-bottom:16px;border:1px solid rgba(15,169,104,.18);background:#fff;animation:fadeUp .35s ease both}
.ks-flabel{display:block;font-size:10px;font-weight:700;letter-spacing:.9px;text-transform:uppercase;margin:16px 0 7px;color:rgba(18,54,42,.42)}
.ks-select{width:100%;border-radius:9px;padding:11px 14px;font-size:14px;font-family:'Outfit',sans-serif;outline:none;border:1px solid rgba(15,169,104,.22);background:#fff}
.ks-gen-btn{width:100%;padding:15px;border-radius:12px;cursor:pointer;font-size:15px;font-weight:700;font-family:'Outfit',sans-serif;border:none;margin-top:20px;transition:all .3s;background:linear-gradient(135deg,#0FA968,#1596D6);color:#fff}
.ks-gen-btn:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 12px 32px rgba(15,169,104,.4)}
.ks-gen-btn:disabled{opacity:.38;cursor:not-allowed}
.ks-gen-btn-secondary{width:100%;padding:13px;border-radius:11px;cursor:pointer;font-size:13.5px;font-weight:700;font-family:'Outfit',sans-serif;border:1px dashed rgba(15,169,104,.4);margin-top:10px;background:rgba(15,169,104,.04);color:#0C8457}
.ks-loading{text-align:center;padding:52px 40px;border-radius:18px;margin-bottom:20px;border:1px solid rgba(15,169,104,.18);background:#fff}
.ks-sl-icon{font-size:48px;margin-bottom:14px;display:block;animation:float 2s ease-in-out infinite}
.ks-sl-title{font-size:19px;font-weight:800;margin-bottom:7px}
.ks-sl-sub{font-size:13px;margin-bottom:20px}
.ks-sl-bar{height:2px;background:rgba(15,169,104,.1);border-radius:99px;overflow:hidden}
.ks-sl-fill{height:100%;width:70%;border-radius:99px;background:linear-gradient(90deg,#0FA968,#1596D6,#F2A93B);background-size:300% 100%;animation:shimmer 1.8s linear infinite}
.ks-quiz-card{border-radius:13px;padding:18px;margin-bottom:12px;border:1px solid rgba(15,169,104,.15);background:rgba(15,169,104,.03)}
.ks-quiz-qt{font-size:14.5px;font-weight:600;line-height:1.65;margin-bottom:12px}
.ks-scenario-box{font-size:12.5px;font-style:italic;color:#0C8457;background:rgba(15,169,104,.06);padding:10px 12px;border-radius:9px;margin-bottom:10px;line-height:1.6}
.ks-opts{display:grid;grid-template-columns:1fr 1fr;gap:7px}
@media(max-width:520px){.ks-opts{grid-template-columns:1fr}}
.ks-opt-btn{padding:10px 13px;border-radius:9px;cursor:pointer;font-size:12.5px;text-align:left;border:1px solid rgba(15,169,104,.18);background:#fff;font-family:'Outfit',sans-serif}
.ks-opt-btn:hover:not(:disabled){background:rgba(15,169,104,.08)}
.ks-opt-btn.sel{background:rgba(15,169,104,.16);border-color:rgba(15,169,104,.4)}
.ks-opt-btn.correct{background:rgba(34,197,94,.12);border-color:rgba(34,197,94,.4);color:#059669}
.ks-opt-btn.wrong{background:rgba(244,63,94,.1);border-color:rgba(244,63,94,.35);color:#DC2626}
.ks-topic-tag{font-size:9px;font-weight:700;color:#0E77AC;background:rgba(15,169,104,.1);padding:2px 8px;border-radius:10px;display:inline-block;margin-bottom:8px}
.ks-r-hdr{background:linear-gradient(135deg,rgba(15,169,104,.1),rgba(21,150,214,.06));border:1px solid rgba(15,169,104,.22);border-radius:16px;padding:20px 24px;margin-bottom:16px}
.ks-r-hdr-title{font-size:20px;font-weight:800;margin-bottom:6px;letter-spacing:-.01em}
.ks-r-hdr-sub{font-size:12.5px;line-height:1.7}
.ks-sblock{border-radius:14px;padding:20px;margin-bottom:12px;border:1px solid rgba(15,169,104,.15);background:rgba(15,169,104,.035)}
.ks-stitle{font-size:14px;font-weight:700;margin-bottom:14px;display:flex;align-items:center;gap:7px}
.ks-label-badge{font-size:9px;font-weight:800;letter-spacing:.6px;text-transform:uppercase;padding:3px 9px;border-radius:8px;display:inline-block;margin-bottom:8px}
.ks-label-measured{background:rgba(34,197,94,.12);color:#059669}
.ks-label-ai{background:rgba(245,158,11,.14);color:#B45309}
.ks-label-source{background:rgba(59,130,246,.12);color:#1D4ED8}
.ks-metric-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px;margin:10px 0}
.ks-metric-box{background:#fff;border:1px solid rgba(15,169,104,.15);border-radius:10px;padding:12px;text-align:center}
.ks-metric-val{font-size:20px;font-weight:800;color:#0FA968}
.ks-metric-lbl{font-size:10px;color:rgba(18,54,42,.5);margin-top:2px}
.ks-cefr-badge{display:inline-flex;align-items:center;gap:6px;background:linear-gradient(135deg,#0FA968,#1596D6);color:#fff;padding:8px 18px;border-radius:20px;font-weight:800;font-size:16px}
.ks-chip-row{display:flex;flex-wrap:wrap;gap:6px;margin:10px 0}
.ks-chip{padding:5px 12px;border-radius:16px;font-size:11.5px;font-weight:700}
.ks-chip-weak{background:rgba(244,63,94,.1);color:#DC2626;border:1px solid rgba(244,63,94,.22)}
.ks-chip-strong{background:rgba(34,197,94,.1);color:#059669;border:1px solid rgba(34,197,94,.22)}
.ks-mic-btn{width:40px;height:40px;border-radius:9px;border:1px solid rgba(15,169,104,.25);background:#fff;cursor:pointer;font-size:16px;flex-shrink:0}
.ks-mic-btn.big{width:74px;height:74px;border-radius:50%;font-size:30px}
.ks-mic-btn.listening{background:rgba(239,68,68,.1);border-color:#EF4444;animation:micPulse 1.2s infinite}
.ks-speak-btn{padding:8px 14px;border-radius:9px;border:1px solid rgba(10,191,188,.3);background:rgba(10,191,188,.08);color:#0891A8;cursor:pointer;font-size:12px;font-weight:700;font-family:'Outfit',sans-serif}
.ks-record-panel{text-align:center;padding:30px 20px;border-radius:16px;border:1px dashed rgba(15,169,104,.3);background:rgba(15,169,104,.03)}
.ks-record-transcript{min-height:60px;max-height:180px;overflow-y:auto;text-align:left;background:#fff;border-radius:10px;padding:12px;margin-top:16px;font-size:13px;line-height:1.7;border:1px solid rgba(15,169,104,.15)}
.ks-day-row{display:flex;align-items:flex-start;gap:10px}
.ks-day-check{width:22px;height:22px;border-radius:6px;border:2px solid rgba(15,169,104,.35);cursor:pointer;flex-shrink:0;margin-top:2px;display:flex;align-items:center;justify-content:center;font-size:12px;background:#fff}
.ks-day-check.done{background:linear-gradient(135deg,#22C55E,#059669);border-color:#22C55E;color:#fff}
.ks-tree-row{display:flex;align-items:center;gap:8px;margin:10px 0}
.ks-tree-stage{flex:1;text-align:center;padding:12px 8px;border-radius:11px;font-size:11px;font-weight:700;border:2px solid rgba(15,169,104,.18);background:#fff;opacity:.4}
.ks-tree-stage.unlocked{opacity:1}
.ks-tree-stage.current{border-color:#0FA968;background:linear-gradient(135deg,rgba(15,169,104,.12),rgba(21,150,214,.06));box-shadow:0 0 0 3px rgba(15,169,104,.12)}
.ks-tree-stage.done{border-color:#22C55E;background:rgba(34,197,94,.08)}
.ks-tree-arrow{font-size:14px;color:rgba(15,169,104,.4)}
.ks-arena-panel{border-radius:16px;border:1px solid rgba(15,169,104,.18);background:#fff;padding:16px;margin-top:16px}
.ks-arena-msgs{max-height:360px;overflow-y:auto;display:flex;flex-direction:column;gap:10px;margin-bottom:12px;padding-right:4px}
.ks-arena-msg{max-width:85%;padding:10px 14px;border-radius:13px;font-size:13px;line-height:1.6}
.ks-arena-msg.user{align-self:flex-end;background:linear-gradient(135deg,#0FA968,#1596D6);color:#fff;border-bottom-right-radius:4px}
.ks-arena-msg.assistant{align-self:flex-start;background:rgba(15,169,104,.06);color:#122420;border-bottom-left-radius:4px}
.ks-arena-input-row{display:flex;gap:8px}
.ks-arena-input-row input{flex:1;border-radius:10px;border:1px solid rgba(15,169,104,.22);padding:10px 14px;font-size:13px;font-family:'Outfit',sans-serif;outline:none}
.ks-arena-send{background:linear-gradient(135deg,#0FA968,#1596D6);color:#fff;border:none;border-radius:10px;padding:0 18px;cursor:pointer;font-weight:700;font-size:13px}
.ks-persona-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:10px 0}
@media(max-width:520px){.ks-persona-grid{grid-template-columns:1fr}}
.ks-persona-card{padding:14px;border-radius:12px;border:1px solid rgba(15,169,104,.2);background:#fff;cursor:pointer;text-align:center}
.ks-persona-card.sel{background:linear-gradient(135deg,#0FA968,#1596D6);color:#fff;border-color:transparent}
.ks-opp-link{font-size:12px;font-weight:700;color:#0891A8;text-decoration:none;background:rgba(10,191,188,.08);border:1px solid rgba(10,191,188,.22);padding:6px 12px;border-radius:9px;cursor:pointer;font-family:'Outfit',sans-serif;display:inline-block;margin:3px 4px 3px 0}
.ks-opp-link:hover{background:rgba(10,191,188,.16)}
.ks-nsqf-table{width:100%;border-collapse:collapse;font-size:11.5px;margin-top:10px}
.ks-nsqf-table td{padding:6px 8px;border-bottom:1px solid rgba(15,169,104,.1)}
.ks-nsqf-table tr.highlight{background:rgba(15,169,104,.08);font-weight:700}
.ks-pdf-btn{display:flex;align-items:center;gap:6px;padding:10px 18px;border-radius:9px;cursor:pointer;font-size:13px;font-weight:700;font-family:'Outfit',sans-serif;background:linear-gradient(135deg,#F59E0B,#DC2626);color:#fff;border:none;margin-top:14px;width:100%;justify-content:center}
.ks-pdf-btn:disabled{opacity:.45;cursor:not-allowed}
.ks-restart{text-align:center;margin-top:16px}
.ks-restart button{background:transparent;border:1px solid rgba(15,169,104,.2);padding:8px 18px;border-radius:9px;cursor:pointer;font-size:12px;font-weight:600;color:rgba(18,54,42,.6);font-family:'Outfit',sans-serif}
.ks-lang-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin:10px 0}
@media(max-width:600px){.ks-lang-grid{grid-template-columns:repeat(2,1fr)}}
.ks-lang-btn{padding:11px 10px;border-radius:10px;cursor:pointer;font-size:12px;font-weight:700;text-align:center;border:1px solid rgba(15,169,104,.2);background:#fff}
.ks-lang-btn.active{background:linear-gradient(135deg,#0FA968,#1596D6);color:#fff;border-color:transparent}
.ks-wiki-box{background:rgba(59,130,246,.05);border:1px solid rgba(59,130,246,.18);border-radius:10px;padding:12px 14px;font-size:12px;line-height:1.7;margin-top:8px}
.ks-saved-pill{display:inline-flex;align-items:center;gap:5px;font-size:10.5px;font-weight:600;color:rgba(18,54,42,.4);margin-top:6px}
`;
if (!document.getElementById('ks-kaushal-css')) {
  const styleEl = document.createElement('style');
  styleEl.id = 'ks-kaushal-css';
  styleEl.textContent = STATIC_CSS;
  document.head.appendChild(styleEl);
}

const STAGES = [
  { id: 'select', label: 'Choose Skill', icon: '🎯' },
  { id: 'diagnose', label: 'Diagnose', icon: '🔍' },
  { id: 'build', label: 'Build', icon: '📅' },
  { id: 'practice', label: 'Practice', icon: '🎭' },
  { id: 'certify', label: 'Certify', icon: '📜' },
  { id: 'match', label: 'Match', icon: '🔗' },
];

const LOADING_TEXT = {
  quiz: { icon: '🔍', title: 'Building your diagnostic…', sub: 'Preparing questions tailored to this skill' },
  gap: { icon: '📊', title: 'Analyzing your responses…', sub: 'Combining measured data with AI feedback' },
  plan: { icon: '📅', title: 'Building your practice plan…', sub: 'Targeting weak areas + scheduling spaced revisits' },
  arena_setup: { icon: '🎭', title: 'Setting up the roleplay…', sub: 'Preparing your practice partner' },
  arena_feedback: { icon: '🧾', title: 'Reviewing the conversation…', sub: 'Structuring feedback from the roleplay' },
  wiki: { icon: '📖', title: 'Fetching background from Wikipedia…', sub: 'Grounding this concept in a real source' },
  grammar: { icon: '📝', title: 'Running grammar check…', sub: 'Using LanguageTool, a rule-based engine' },
};

/* ─────────────────────── MAIN COMPONENT ─────────────────────── */
export default function KaushalAI() {
  const navigate = useNavigate();
  const TH = THEME;
  const resultRef = useRef(null);
  const arenaEndRef = useRef(null);
  const loadedRef = useRef(false);

  const [stage, setStage] = useState('select');
  const [loadingKey, setLoadingKey] = useState(null);

  // Skill selection
  const [search, setSearch] = useState('');
  const [activeDomain, setActiveDomain] = useState('soft');
  const [selectedSkill, setSelectedSkill] = useState(null);
  const [trade, setTrade] = useState('');

  // Diagnose (mcq/situational)
  const [quiz, setQuiz] = useState(null);
  const [quizAnswers, setQuizAnswers] = useState({});
  // Diagnose (speaking)
  const speech = useContinuousSpeech();
  const [speechMetrics, setSpeechMetrics] = useState(null);
  const [grammarResult, setGrammarResult] = useState(null);
  const [cefrResult, setCefrResult] = useState(null);

  const [diagResult, setDiagResult] = useState(null);

  // Build
  const [days, setDays] = useState('14');
  const [hoursPerDay, setHoursPerDay] = useState('1');
  const [planResult, setPlanResult] = useState(null);
  const [completedDays, setCompletedDays] = useState({});

  // Practice Arena
  const [persona, setPersona] = useState(null);
  const [arenaMessages, setArenaMessages] = useState([]);
  const [arenaInput, setArenaInput] = useState('');
  const [arenaLoading, setArenaLoading] = useState(false);
  const [arenaFeedback, setArenaFeedback] = useState(null);

  // Match
  const [wikiSummary, setWikiSummary] = useState(null);

  const [language, setLanguage] = useState('hinglish');
  const [pdfLoading, setPdfLoading] = useState(false);
  const [toast, setToast] = useState('');
  const showToast = useCallback((msg) => { setToast(msg); setTimeout(() => setToast(''), 2500); }, []);

  const langObj = LANGUAGES.find(l => l.code === language) || LANGUAGES[1];

  const filteredDomains = useMemo(() => {
    if (!search.trim()) return SKILL_DOMAINS;
    const q = search.toLowerCase();
    return SKILL_DOMAINS.map(d => ({ ...d, skills: d.skills.filter(s => s.name.toLowerCase().includes(q)) })).filter(d => d.skills.length);
  }, [search]);

  const currentDomainSkills = useMemo(() => {
    if (search.trim()) return filteredDomains.flatMap(d => d.skills);
    return (SKILL_DOMAINS.find(d => d.id === activeDomain) || SKILL_DOMAINS[0]).skills;
  }, [activeDomain, filteredDomains, search]);

  /* ── LOAD / SAVE PROGRESS ── */
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (saved) {
        if (saved.selectedSkill) setSelectedSkill(saved.selectedSkill);
        if (saved.trade) setTrade(saved.trade);
        if (saved.diagResult) setDiagResult(saved.diagResult);
        if (saved.planResult) setPlanResult(saved.planResult);
        if (saved.completedDays) setCompletedDays(saved.completedDays);
        if (saved.arenaFeedback) setArenaFeedback(saved.arenaFeedback);
        if (saved.language) setLanguage(saved.language);
        if (saved.stage) setStage(saved.stage);
        showToast('📂 Restored your saved progress');
      }
    } catch (e) { /* ignore */ }
    loadedRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!loadedRef.current) return;
    const state = { selectedSkill, trade, diagResult, planResult, completedDays, arenaFeedback, language, stage };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
  }, [selectedSkill, trade, diagResult, planResult, completedDays, arenaFeedback, language, stage]);

  useEffect(() => { arenaEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [arenaMessages]);

  const chooseSkill = useCallback((skill) => { setSelectedSkill(skill); }, []);

  /* ── DIAGNOSE: mcq / situational quiz ── */
  const generateQuiz = useCallback(async () => {
    if (!selectedSkill) return;
    setLoadingKey('quiz'); setQuiz(null); setQuizAnswers({}); setDiagResult(null);
    const styleNote = selectedSkill.diagType === 'situational'
      ? 'Use realistic workplace scenario-based situational-judgment questions (describe a short scenario, then ask what the best response is).'
      : 'Use direct knowledge-check MCQs appropriate for someone learning this skill for employability.';
    const prompt = `Create a 8-question diagnostic quiz for the skill: "${selectedSkill.name}"${trade ? ` (trade: ${trade})` : ''}.
${styleNote}
Tag each question with the specific sub-topic it tests.
Return ONLY JSON: {"questions":[{"q_no":1,"topic":"sub-topic","scenario":"optional short scenario text or empty string","question":"the question","options":{"A":"a","B":"b","C":"c","D":"d"},"correct":"A"}]}`;
    try {
      const text = await callAI(prompt);
      const m = text.match(/\{[\s\S]*\}/);
      if (m) setQuiz(JSON.parse(m[0]));
    } catch (e) { alert('Error generating diagnostic. Try again.'); }
    setLoadingKey(null);
  }, [selectedSkill, trade]);

  const analyzeQuizGaps = useCallback(async () => {
    if (!quiz) return;
    setLoadingKey('gap');
    const wrongQs = quiz.questions.filter(q => quizAnswers[q.q_no] !== q.correct);
    const correctQs = quiz.questions.filter(q => quizAnswers[q.q_no] === q.correct);
    const scorePct = Math.round((correctQs.length / quiz.questions.length) * 100);
    const prompt = `A learner took a diagnostic on "${selectedSkill.name}". Topics gotten WRONG: ${wrongQs.map(q => q.topic).join(', ') || 'none'}. Topics gotten RIGHT: ${correctQs.map(q => q.topic).join(', ') || 'none'}.
Generate a structured skill-gap report for employability purposes.
Return ONLY JSON: {"summary":"2-3 sentence overview","strengths":["topic1"],"weakGaps":[{"topic":"name","severity":"High/Medium/Low","why":"short reason"}]}`;
    try {
      const text = await callAI(prompt);
      const m = text.match(/\{[\s\S]*\}/);
      if (m) {
        const parsed = JSON.parse(m[0]);
        setDiagResult({ ...parsed, scorePct, type: 'quiz' });
        setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
      }
    } catch (e) { alert('Error analyzing gaps. Try again.'); }
    setLoadingKey(null);
  }, [quiz, quizAnswers, selectedSkill]);

  /* ── DIAGNOSE: English speaking sample ── */
  const analyzeSpeaking = useCallback(async () => {
    if (!speech.transcript || speech.transcript.trim().split(/\s+/).length < 8) {
      alert('Please record at least a few sentences before analyzing.');
      return;
    }
    const metrics = computeSpeechMetrics(speech.transcript, speech.duration || 20);
    setSpeechMetrics(metrics);

    setLoadingKey('grammar');
    const grammar = await checkGrammarLanguageTool(speech.transcript);
    setGrammarResult(grammar);

    setLoadingKey('gap');
    const prompt = `A learner gave this spoken English sample (auto-transcribed, so minor transcription noise is possible):
"""${speech.transcript}"""
Objective measurements — Speaking pace: ${metrics.wpm} WPM, Filler words: ${metrics.fillerCount}, Vocabulary diversity (TTR): ${metrics.ttr}, Avg sentence length: ${metrics.avgSentenceLength} words.
Grammar issues found by a rule-based checker: ${grammar.matches.slice(0, 8).map(m => m.message).join(' | ') || 'none flagged'}.
Assess this against the CEFR framework (A1, A2, B1, B2, C1, or C2) and give qualitative feedback on grammar, fluency, relevance and structure. Be encouraging but honest.
Return ONLY JSON: {"cefr":"B1","summary":"2-3 sentence overview","strengths":["s1"],"weakGaps":[{"topic":"e.g. Sentence structure","severity":"High/Medium/Low","why":"short reason"}]}`;
    try {
      const text = await callAI(prompt, 'You are an English proficiency assessor using the CEFR framework. Return ONLY valid JSON.');
      const m = text.match(/\{[\s\S]*\}/);
      if (m) {
        const parsed = JSON.parse(m[0]);
        setCefrResult(parsed.cefr);
        setDiagResult({ ...parsed, measured: metrics, grammarCount: grammar.matches.length, type: 'speaking', scorePct: null });
        setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
      }
    } catch (e) { alert('Error analyzing speech. Try again.'); }
    setLoadingKey(null);
  }, [speech.transcript, speech.duration]);

  /* ── BUILD: practice plan with spaced repetition ── */
  const generatePlan = useCallback(async () => {
    if (!diagResult) return;
    setLoadingKey('plan'); setPlanResult(null); setCompletedDays({});
    const weakList = (diagResult.weakGaps || []).map(g => `${g.topic} (${g.severity} priority)`).join(', ') || 'general practice';
    const prompt = `Create a ${days}-day practice plan for the employability skill "${selectedSkill.name}"${trade ? ` (trade: ${trade})` : ''}, targeting these weak areas first: ${weakList}.
Hours available per day: ${hoursPerDay}.
Return ONLY JSON: {"overview":"2 sentence plan overview","weekly_plan":[{"week":1,"theme":"theme","days":[{"day":1,"topics":["t1"],"tasks":["t1"],"duration":"${hoursPerDay} hours","tip":"tip"}]}]}`;
    try {
      const text = await callAI(prompt);
      const m = text.match(/\{[\s\S]*\}/);
      if (m) {
        const parsed = JSON.parse(m[0]);
        const withRepetition = injectSpacedRepetition(parsed, diagResult.weakGaps || []);
        setPlanResult(withRepetition);
        setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
      }
    } catch (e) { alert('Error generating plan. Try again.'); }
    setLoadingKey(null);
  }, [diagResult, selectedSkill, trade, days, hoursPerDay]);

  const toggleDayComplete = useCallback((week, day) => {
    setCompletedDays(prev => ({ ...prev, [`${week}-${day}`]: !prev[`${week}-${day}`] }));
  }, []);

  /* ── PRACTICE ARENA: AI roleplay + structured feedback ── */
  const PERSONAS = useMemo(() => ([
    { id: 'interviewer', label: 'Mock Interviewer', icon: '🧑‍💼', desc: 'Job interview practice' },
    { id: 'customer', label: 'Difficult Customer', icon: '🙍', desc: 'Handling complaints/queries' },
    { id: 'colleague', label: 'Workplace Colleague', icon: '🧑‍🔧', desc: 'On-the-job conversation' },
  ]), []);

  const startArena = useCallback((p) => {
    setPersona(p);
    setArenaMessages([]);
    setArenaFeedback(null);
    const opening = p.id === 'interviewer'
      ? `Hi, thanks for coming in. Let's start — can you tell me a little about yourself and why you're interested in ${selectedSkill?.name || 'this role'}?`
      : p.id === 'customer'
      ? `Excuse me, I've been waiting for a while and I'm not happy with the service. Can you help me?`
      : `Hey, quick one — can you walk me through how you'd handle ${selectedSkill?.name || 'this task'} today?`;
    setArenaMessages([{ role: 'assistant', content: opening }]);
  }, [selectedSkill]);

  const sendArenaMessage = useCallback(async (textOverride) => {
    const text = (textOverride ?? arenaInput).trim();
    if (!text || !persona) return;
    const newMessages = [...arenaMessages, { role: 'user', content: text }];
    setArenaMessages(newMessages);
    setArenaInput('');
    setArenaLoading(true);
    const systemMsg = `You are roleplaying as a ${persona.label} for a skills-practice conversation about "${selectedSkill?.name}"${trade ? ` (trade: ${trade})` : ''}. Stay fully in character, keep replies short (2-4 sentences), natural and realistic — do not break character or mention you are an AI.`;
    try {
      const messages = [{ role: 'system', content: systemMsg }, ...newMessages.map(m => ({ role: m.role, content: m.content }))];
      const reply = await callAIMessages(messages);
      setArenaMessages([...newMessages, { role: 'assistant', content: reply }]);
    } catch (e) {
      setArenaMessages([...newMessages, { role: 'assistant', content: '(connection issue — try again)' }]);
    }
    setArenaLoading(false);
  }, [arenaInput, arenaMessages, persona, selectedSkill, trade]);

  const endArenaAndGetFeedback = useCallback(async () => {
    if (arenaMessages.length < 2) { alert('Have a bit more conversation before ending.'); return; }
    setLoadingKey('arena_feedback');
    const transcript = arenaMessages.map(m => `${m.role === 'user' ? 'Learner' : persona.label}: ${m.content}`).join('\n');
    const prompt = `Here is a roleplay practice conversation for the skill "${selectedSkill?.name}" where the AI played a ${persona.label}:
${transcript}
Give structured, constructive feedback on the learner's performance (communication clarity, relevance, tone, problem-solving).
Return ONLY JSON: {"summary":"2-3 sentence overview","strengths":["s1"],"improvements":["i1","i2"]}`;
    try {
      const text = await callAI(prompt, 'You are a skills coach reviewing a practice roleplay. Return ONLY valid JSON.');
      const m = text.match(/\{[\s\S]*\}/);
      if (m) setArenaFeedback(JSON.parse(m[0]));
    } catch (e) { alert('Error generating feedback. Try again.'); }
    setLoadingKey(null);
  }, [arenaMessages, persona, selectedSkill]);

  /* ── MATCH: Wikipedia grounding for the chosen skill/trade ── */
  const loadWikiGrounding = useCallback(async () => {
    setLoadingKey('wiki');
    const title = trade || selectedSkill?.name;
    const summary = await fetchWikiSummary(title);
    setWikiSummary(summary);
    setLoadingKey(null);
  }, [trade, selectedSkill]);

  const handlePDF = useCallback(async () => {
    setPdfLoading(true);
    try {
      const nsqfLevel = diagResult?.scorePct != null ? estimateNSQFLevel(diagResult.scorePct) : null;
      await exportSkillSnapshot({
        skillName: selectedSkill?.name || 'Skill',
        diagResult, planResult, arenaFeedback,
        nsqfLevel, ssc: selectedSkill?.ssc, language: langObj.label,
      });
      showToast('📄 Skill Snapshot downloaded!');
    } catch (e) { alert('PDF error. Try again.'); }
    setPdfLoading(false);
  }, [selectedSkill, diagResult, planResult, arenaFeedback, langObj, showToast]);

  const restart = useCallback(() => {
    setStage('select'); setSelectedSkill(null); setTrade(''); setQuiz(null); setQuizAnswers({});
    setDiagResult(null); setSpeechMetrics(null); setGrammarResult(null); setCefrResult(null);
    setPlanResult(null); setCompletedDays({}); setPersona(null); setArenaMessages([]); setArenaFeedback(null);
    setWikiSummary(null);
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* ignore */ }
  }, []);

  const canGoToStage = (id) => {
    if (id === 'select') return true;
    if (id === 'diagnose') return !!selectedSkill;
    if (id === 'build') return !!diagResult;
    if (id === 'practice') return !!planResult;
    if (id === 'certify') return !!planResult;
    if (id === 'match') return !!planResult;
    return false;
  };

  const loadingInfo = loadingKey ? LOADING_TEXT[loadingKey] : null;
  const allQuizAnswered = quiz ? Object.keys(quizAnswers).length >= quiz.questions.length : false;

  const skillTreeStageIndex = useMemo(() => {
    let idx = 0;
    if (diagResult) idx = 1;
    if (planResult) idx = 2;
    if (arenaFeedback) idx = 3;
    return idx;
  }, [diagResult, planResult, arenaFeedback]);

  const gapChartData = diagResult ? [
    ...(diagResult.strengths || []).map(s => ({ name: s, score: 85, fill: '#22C55E' })),
    ...(diagResult.weakGaps || []).map(g => ({ name: g.topic, score: g.severity === 'High' ? 25 : g.severity === 'Medium' ? 45 : 60, fill: g.severity === 'High' ? '#EF4444' : g.severity === 'Medium' ? '#F59E0B' : '#FBBF24' })),
  ] : [];

  return (
    <div className="ks-wrap" style={{ background: TH.bg, backgroundImage: TH.bgGradient, color: TH.textPrimary }}>

      <Helmet>
        <title>Kaushal AI — Vocational Skill Gap Diagnosis | MK AI</title>
        <meta name="description" content="Diagnose employability and vocational skill gaps across 64+ skills, build a practice plan, and roleplay mock interviews with Kaushal AI." />
      </Helmet>
      <div className="ks-orb1" /><div className="ks-orb2" />

      <header className="ks-header" style={{ background: TH.headerBg, borderBottom: `1px solid ${TH.headerBorder}` }}>
        <div className="ks-logo">
          <div className="ks-logo-icon">🧑‍🔧</div>
          <span className="ks-logo-name">Kaushal AI</span>
          <span className="ks-logo-tag">DIAGNOSE · BUILD · PRACTICE · CERTIFY · MATCH</span>
        </div>
        <button className="ks-btn-back" style={{ color: TH.textSub, borderColor: TH.border2 }} onClick={() => navigate('/')}>🏠 Home</button>
      </header>

      <main className="ks-main">
        <div className="ks-hero">
          <div className="ks-hero-pill">🛠️ {SKILL_COUNT}+ Skills · NSQF-Aligned · Voice-Enabled</div>
          <h1 className="ks-hero-title">Skill Up. Get <span className="ks-hero-grad">Job-Ready.</span></h1>
          <p className="ks-hero-sub" style={{ color: TH.textMuted }}>Diagnose real gaps, build a spaced practice plan, roleplay with an AI interviewer or customer, and get a self-assessed Skill Snapshot mapped to India's official skilling frameworks.</p>
        </div>

        <div className="ks-stepper">
          {STAGES.map((s, i) => (
            <React.Fragment key={s.id}>
              <div className="ks-step" onClick={() => canGoToStage(s.id) && setStage(s.id)}>
                <div className="ks-step-circle" style={{
                  borderColor: stage === s.id ? '#0FA968' : 'rgba(15,169,104,.25)',
                  background: stage === s.id ? 'linear-gradient(135deg,#0FA968,#1596D6)' : 'rgba(15,169,104,.06)',
                  color: stage === s.id ? '#fff' : 'rgba(18,54,42,.4)',
                }}>{s.icon}</div>
                <div className="ks-step-label" style={{ color: stage === s.id ? '#0C8457' : 'rgba(18,54,42,.4)' }}>{s.label}</div>
              </div>
              {i < STAGES.length - 1 && <div className="ks-step-line" style={{ background: 'rgba(15,169,104,.15)' }} />}
            </React.Fragment>
          ))}
        </div>

        {selectedSkill && <div className="ks-saved-pill">💾 Progress auto-saves on this device</div>}

        {/* ═══ SKILL TREE (gamified) ═══ */}
        {selectedSkill && (
          <div className="ks-sblock">
            <div className="ks-stitle">🌳 Skill Tree — {selectedSkill.name}</div>
            <div className="ks-tree-row">
              {SKILL_TREE_STAGES.map((s, i) => (
                <React.Fragment key={s}>
                  <div className={`ks-tree-stage ${i <= skillTreeStageIndex ? 'unlocked' : ''} ${i === skillTreeStageIndex ? 'current' : ''} ${i < skillTreeStageIndex ? 'done' : ''}`}>
                    {i < skillTreeStageIndex ? '✓ ' : i > skillTreeStageIndex ? '🔒 ' : '▶ '}{s}
                  </div>
                  {i < SKILL_TREE_STAGES.length - 1 && <span className="ks-tree-arrow">→</span>}
                </React.Fragment>
              ))}
            </div>
          </div>
        )}

        {/* ═══ STAGE: SELECT SKILL ═══ */}
        {stage === 'select' && (
          <>
            <div className="ks-count-pill">Choose from {SKILL_COUNT}+ skills across 8 categories</div>
            <div className="ks-search-row">
              <input className="ks-search-input" placeholder="Search skills… e.g. Python, Graphic Design, Tailoring" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            {!search.trim() && (
              <div className="ks-domain-tabs">
                {SKILL_DOMAINS.map(d => (
                  <div key={d.id} className={`ks-domain-tab ${activeDomain === d.id ? 'active' : ''}`} onClick={() => setActiveDomain(d.id)}>{d.icon} {d.label}</div>
                ))}
              </div>
            )}
            <div className="ks-skill-grid">
              {currentDomainSkills.map(s => (
                <div key={s.id} className={`ks-skill-card ${selectedSkill?.id === s.id ? 'sel' : ''}`} onClick={() => chooseSkill(s)}>
                  <span className="ks-skill-icon">{s.icon}</span>
                  <div className="ks-skill-name">{s.name}</div>
                  {s.flagship && <span className="ks-skill-flag">⭐ Flagship</span>}
                </div>
              ))}
            </div>
            {selectedSkill?.domainId === 'trades' || selectedSkill?.domainId === undefined ? null : null}
            {selectedSkill && (
              <div className="ks-form" style={{ marginTop: 16 }}>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>Selected: {selectedSkill.icon} {selectedSkill.name}</div>
                {selectedSkill.ssc && <div style={{ fontSize: 11.5, color: TH.textMuted, marginBottom: 10 }}>Indicative Sector Skill Council: {selectedSkill.ssc} (verify at nsdcindia.org)</div>}
                <label className="ks-flabel">Any specific trade / specialization? (optional)</label>
                <input className="ks-select" placeholder="e.g. Two-wheeler repair, Bridal makeup, Backend development…" value={trade} onChange={e => setTrade(e.target.value)} />
                <button className="ks-gen-btn" onClick={() => setStage('diagnose')}>🔍 Start Diagnosis →</button>
              </div>
            )}
          </>
        )}

        {/* ═══ STAGE: DIAGNOSE ═══ */}
        {stage === 'diagnose' && selectedSkill && (
          <>
            {selectedSkill.diagType === 'speaking' ? (
              <>
                {!diagResult && (
                  <div className="ks-record-panel">
                    <div style={{ fontWeight: 700, marginBottom: 6 }}>🎤 Speak for ~30-60 seconds</div>
                    <div style={{ fontSize: 12.5, color: TH.textMuted, marginBottom: 14 }}>Introduce yourself, or talk about your favourite hobby. This will be measured for pace, filler words, vocabulary and checked for grammar.</div>
                    <button className={`ks-mic-btn big ${speech.recording ? 'listening' : ''}`} onClick={() => (speech.recording ? speech.stop() : speech.start('en-IN'))}>
                      {speech.recording ? '🔴' : '🎤'}
                    </button>
                    <div className="ks-record-transcript">{speech.transcript || <span style={{ color: TH.textMuted }}>Transcript will appear here as you speak…</span>}</div>
                    {loadingKey && (
                      <div className="ks-loading" style={{ marginTop: 16 }}>
                        <span className="ks-sl-icon">{loadingInfo.icon}</span>
                        <div className="ks-sl-title">{loadingInfo.title}</div>
                        <div className="ks-sl-sub" style={{ color: TH.textMuted }}>{loadingInfo.sub}</div>
                        <div className="ks-sl-bar"><div className="ks-sl-fill" /></div>
                      </div>
                    )}
                    {!speech.recording && speech.transcript && !loadingKey && (
                      <button className="ks-gen-btn" onClick={analyzeSpeaking}>📊 Analyze My Speaking</button>
                    )}
                  </div>
                )}
              </>
            ) : (
              <>
                {!quiz && (
                  <div className="ks-form">
                    <div style={{ fontWeight: 700, marginBottom: 10 }}>{selectedSkill.icon} {selectedSkill.name} — Diagnostic</div>
                    <button className="ks-gen-btn" disabled={loadingKey} onClick={generateQuiz}>🔍 Generate Diagnostic Quiz</button>
                  </div>
                )}
                {loadingKey && (
                  <div className="ks-loading">
                    <span className="ks-sl-icon">{loadingInfo.icon}</span>
                    <div className="ks-sl-title">{loadingInfo.title}</div>
                    <div className="ks-sl-sub" style={{ color: TH.textMuted }}>{loadingInfo.sub}</div>
                    <div className="ks-sl-bar"><div className="ks-sl-fill" /></div>
                  </div>
                )}
                {quiz && !diagResult && !loadingKey && (
                  <div>
                    {quiz.questions.map(q => (
                      <div key={q.q_no} className="ks-quiz-card">
                        <span className="ks-topic-tag">{q.topic}</span>
                        {q.scenario && <div className="ks-scenario-box">📌 {q.scenario}</div>}
                        <div className="ks-quiz-qt">{q.q_no}. {q.question}</div>
                        <div className="ks-opts">
                          {Object.entries(q.options).map(([k, v]) => (
                            <button key={k} className={`ks-opt-btn ${quizAnswers[q.q_no] === k ? 'sel' : ''}`} onClick={() => setQuizAnswers({ ...quizAnswers, [q.q_no]: k })}>
                              <strong>{k}.</strong> {v}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                    <button className="ks-gen-btn" disabled={!allQuizAnswered} onClick={analyzeQuizGaps}>📊 Analyze My Gaps</button>
                  </div>
                )}
              </>
            )}

            {diagResult && (
              <div ref={resultRef}>
                <div className="ks-r-hdr">
                  <div className="ks-r-hdr-title">📊 Diagnosis — {selectedSkill.name}</div>
                  <div className="ks-r-hdr-sub" style={{ color: TH.textMuted }}>{diagResult.summary}</div>
                  {diagResult.scorePct != null && <div className="ks-chip" style={{ background: 'rgba(15,169,104,.12)', color: '#0C8457', display: 'inline-block', marginTop: 8 }}>Score: {diagResult.scorePct}%</div>}
                  {cefrResult && <div style={{ marginTop: 10 }}><span className="ks-cefr-badge">CEFR: {cefrResult}</span></div>}
                </div>

                {diagResult.measured && (
                  <div className="ks-sblock">
                    <span className="ks-label-badge ks-label-measured">✓ Measured (objective)</span>
                    <div className="ks-metric-grid">
                      <div className="ks-metric-box"><div className="ks-metric-val">{diagResult.measured.wpm}</div><div className="ks-metric-lbl">Words / min</div></div>
                      <div className="ks-metric-box"><div className="ks-metric-val">{diagResult.measured.fillerCount}</div><div className="ks-metric-lbl">Filler words</div></div>
                      <div className="ks-metric-box"><div className="ks-metric-val">{diagResult.measured.ttr}</div><div className="ks-metric-lbl">Vocab diversity (TTR)</div></div>
                      <div className="ks-metric-box"><div className="ks-metric-val">{diagResult.measured.avgSentenceLength}</div><div className="ks-metric-lbl">Avg sentence length</div></div>
                    </div>
                    {diagResult.grammarCount != null && <div style={{ fontSize: 11.5, color: TH.textMuted, marginTop: 6 }}>Grammar check (LanguageTool): {diagResult.grammarCount} issue(s) flagged.</div>}
                  </div>
                )}

                <div className="ks-sblock">
                  <span className="ks-label-badge ks-label-ai">🤖 AI Feedback</span>
                  {gapChartData.length > 0 && (
                    <div style={{ width: '100%', height: Math.max(160, gapChartData.length * 42) }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={gapChartData} layout="vertical" margin={{ left: 10, right: 20 }}>
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(15,169,104,.1)" />
                          <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
                          <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 11 }} />
                          <Tooltip formatter={(v) => `${v}%`} />
                          <Bar dataKey="score" radius={[0, 6, 6, 0]} barSize={18}>
                            {gapChartData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                  <div className="ks-chip-row">
                    {diagResult.strengths?.map((s, i) => <span key={i} className="ks-chip ks-chip-strong">✓ {s}</span>)}
                  </div>
                  {diagResult.weakGaps?.map((g, i) => <span key={i} className="ks-chip ks-chip-weak" style={{ marginRight: 6, marginBottom: 6, display: 'inline-block' }}>⚠ {g.topic} ({g.severity})</span>)}
                </div>

                <button className="ks-gen-btn" onClick={() => setStage('build')}>Continue to Build Plan →</button>
              </div>
            )}
          </>
        )}

        {/* ═══ STAGE: BUILD ═══ */}
        {stage === 'build' && diagResult && (
          <>
            {!planResult && !loadingKey && (
              <div className="ks-form">
                <div style={{ fontSize: 12, color: TH.textMuted, marginBottom: 10 }}>Targeting weak areas: {(diagResult.weakGaps || []).map(g => g.topic).join(', ') || 'general practice'}. Spaced revision auto-added at +3 and +7 days.</div>
                <label className="ks-flabel">Days Available</label>
                <select className="ks-select" value={days} onChange={e => setDays(e.target.value)}>
                  <option value="7">7 Days</option><option value="14">14 Days</option><option value="30">30 Days</option><option value="60">60 Days</option>
                </select>
                <label className="ks-flabel">Hours per Day</label>
                <select className="ks-select" value={hoursPerDay} onChange={e => setHoursPerDay(e.target.value)}>
                  <option value="0.5">30 mins</option><option value="1">1 hour</option><option value="2">2 hours</option><option value="3">3+ hours</option>
                </select>
                <button className="ks-gen-btn" onClick={generatePlan}>📅 Generate My Practice Plan</button>
              </div>
            )}
            {loadingKey && (
              <div className="ks-loading">
                <span className="ks-sl-icon">{loadingInfo.icon}</span>
                <div className="ks-sl-title">{loadingInfo.title}</div>
                <div className="ks-sl-sub" style={{ color: TH.textMuted }}>{loadingInfo.sub}</div>
                <div className="ks-sl-bar"><div className="ks-sl-fill" /></div>
              </div>
            )}
            {planResult && (
              <div ref={resultRef}>
                <div className="ks-r-hdr">
                  <div className="ks-r-hdr-title">📅 Practice Plan</div>
                  <div className="ks-r-hdr-sub" style={{ color: TH.textMuted }}>{planResult.overview}</div>
                </div>
                {planResult.weekly_plan?.map((week, i) => (
                  <div key={i} className="ks-sblock">
                    <div className="ks-stitle">Week {week.week}: {week.theme}</div>
                    {week.days?.map((day, j) => {
                      const key = `${week.week}-${day.day}`;
                      const isDone = !!completedDays[key];
                      return (
                        <div key={j} className="ks-day-row" style={{ marginBottom: 10, paddingBottom: 10, borderBottom: j < week.days.length - 1 ? '1px solid rgba(15,169,104,.1)' : 'none' }}>
                          <div className={`ks-day-check ${isDone ? 'done' : ''}`} onClick={() => toggleDayComplete(week.week, day.day)}>{isDone ? '✓' : ''}</div>
                          <div style={{ flex: 1, opacity: isDone ? 0.55 : 1 }}>
                            <div style={{ fontSize: 12.5, fontWeight: 700, color: '#0C8457', marginBottom: 4 }}>Day {day.day} · {day.duration}</div>
                            <div className="ks-chip-row" style={{ margin: '4px 0' }}>
                              {day.topics?.map((t, k) => <span key={k} className="ks-chip" style={{ background: 'rgba(15,169,104,.1)', color: '#0C8457' }}>{t}</span>)}
                            </div>
                            {day.tasks?.map((t, k) => <div key={k} style={{ fontSize: 12.5, color: TH.textSub }}>✓ {t}</div>)}
                            {day.tip && <div style={{ marginTop: 6, fontSize: 11.5, color: '#B45309', background: 'rgba(245,158,11,.07)', padding: '6px 10px', borderRadius: 7 }}>💡 {day.tip}</div>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
                <button className="ks-gen-btn" onClick={() => setStage('practice')}>Continue to Practice Arena →</button>
              </div>
            )}
          </>
        )}

        {/* ═══ STAGE: PRACTICE ARENA ═══ */}
        {stage === 'practice' && planResult && (
          <>
            {!persona && (
              <div className="ks-form">
                <div style={{ fontWeight: 700, marginBottom: 10 }}>🎭 Choose who you want to practice with</div>
                <div className="ks-persona-grid">
                  {PERSONAS.map(p => (
                    <div key={p.id} className="ks-persona-card" onClick={() => startArena(p)}>
                      <div style={{ fontSize: 24 }}>{p.icon}</div>
                      <div style={{ fontWeight: 700, fontSize: 13, margin: '6px 0 2px' }}>{p.label}</div>
                      <div style={{ fontSize: 11, opacity: .75 }}>{p.desc}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {persona && (
              <div className="ks-arena-panel">
                <div className="ks-stitle">{persona.icon} Roleplay: {persona.label}</div>
                <div className="ks-arena-msgs">
                  {arenaMessages.map((m, i) => <div key={i} className={`ks-arena-msg ${m.role}`}>{m.content}</div>)}
                  {arenaLoading && <div className="ks-arena-msg assistant">Typing…</div>}
                  <div ref={arenaEndRef} />
                </div>
                <div className="ks-arena-input-row">
                  <input placeholder="Type your response…" value={arenaInput} onChange={e => setArenaInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendArenaMessage()} />
                  <MicButton lang="en-IN" onResult={t => sendArenaMessage(t)} />
                  <button className="ks-arena-send" onClick={() => sendArenaMessage()} disabled={arenaLoading}>Send</button>
                </div>
                {!arenaFeedback && (
                  <button className="ks-gen-btn-secondary" style={{ marginTop: 12 }} disabled={loadingKey} onClick={endArenaAndGetFeedback}>
                    {loadingKey === 'arena_feedback' ? '⏳ Reviewing…' : '✅ End Conversation & Get Feedback'}
                  </button>
                )}
                {arenaFeedback && (
                  <div className="ks-sblock" style={{ marginTop: 14 }}>
                    <span className="ks-label-badge ks-label-ai">🤖 AI Feedback</span>
                    <div style={{ fontSize: 13, marginBottom: 10 }}>{arenaFeedback.summary}</div>
                    <div className="ks-chip-row">{arenaFeedback.strengths?.map((s, i) => <span key={i} className="ks-chip ks-chip-strong">✓ {s}</span>)}</div>
                    <div style={{ marginTop: 8 }}>
                      {arenaFeedback.improvements?.map((im, i) => <div key={i} style={{ fontSize: 12.5, color: TH.textSub, marginBottom: 4 }}>→ {im}</div>)}
                    </div>
                    <button className="ks-gen-btn" style={{ marginTop: 14 }} onClick={() => setStage('certify')}>Continue to Certify →</button>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* ═══ STAGE: CERTIFY ═══ */}
        {stage === 'certify' && planResult && (
          <div>
            <div className="ks-r-hdr">
              <div className="ks-r-hdr-title">📜 Your Skill Snapshot</div>
              <div className="ks-r-hdr-sub" style={{ color: TH.textMuted }}>This is a self-assessment summary, not a verified/accredited certificate — it's meant to help you and recruiters see honest, evidence-backed progress.</div>
            </div>
            <div className="ks-sblock">
              <div className="ks-stitle">🌳 Skill Tree Status</div>
              <div className="ks-tree-row">
                {SKILL_TREE_STAGES.map((s, i) => (
                  <React.Fragment key={s}>
                    <div className={`ks-tree-stage ${i <= skillTreeStageIndex ? 'unlocked' : ''} ${i === skillTreeStageIndex ? 'current' : ''} ${i < skillTreeStageIndex ? 'done' : ''}`}>
                      {i < skillTreeStageIndex ? '✓ ' : i > skillTreeStageIndex ? '🔒 ' : '▶ '}{s}
                    </div>
                    {i < SKILL_TREE_STAGES.length - 1 && <span className="ks-tree-arrow">→</span>}
                  </React.Fragment>
                ))}
              </div>
            </div>
            {diagResult?.scorePct != null && (
              <div className="ks-sblock">
                <div className="ks-stitle">🏛️ Indicative NSQF Mapping</div>
                <div style={{ fontSize: 12, color: TH.textMuted, marginBottom: 8 }}>Approximate mapping based on your diagnostic score — always verify against the official framework at nsdcindia.org.</div>
                <table className="ks-nsqf-table">
                  <tbody>
                    {NSQF_LEVELS.map(l => (
                      <tr key={l.level} className={l.level === estimateNSQFLevel(diagResult.scorePct) ? 'highlight' : ''}>
                        <td>Level {l.level}</td><td>{l.desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {selectedSkill?.ssc && <div style={{ fontSize: 11.5, color: TH.textMuted, marginTop: 8 }}>Related Sector Skill Council (indicative): {selectedSkill.ssc}</div>}
              </div>
            )}
            <button className="ks-pdf-btn" disabled={pdfLoading} onClick={handlePDF}>
              {pdfLoading ? '⏳ Exporting…' : '📄 Download Skill Snapshot (PDF)'}
            </button>
            <button className="ks-gen-btn" style={{ marginTop: 10 }} onClick={() => setStage('match')}>Continue to Match →</button>
          </div>
        )}

        {/* ═══ STAGE: MATCH ═══ */}
        {stage === 'match' && planResult && (
          <div>
            <div className="ks-r-hdr">
              <div className="ks-r-hdr-title">🔗 Real Opportunities & Resources</div>
              <div className="ks-r-hdr-sub" style={{ color: TH.textMuted }}>Linked to real government and industry platforms — not invented listings.</div>
            </div>
            <div className="ks-sblock">
              <div className="ks-stitle">📚 Learning Resources</div>
              <a className="ks-opp-link" href="https://swayam.gov.in" target="_blank" rel="noreferrer">🎓 SWAYAM (free courses)</a>
              <a className="ks-opp-link" href="https://www.skillindiadigital.gov.in" target="_blank" rel="noreferrer">🇮🇳 Skill India Digital Hub</a>
              <a className="ks-opp-link" href="https://www.nsdcindia.org" target="_blank" rel="noreferrer">🏛️ NSDC</a>
            </div>
            <div className="ks-sblock">
              <div className="ks-stitle">💼 Jobs & Apprenticeships</div>
              <a className="ks-opp-link" href="https://www.ncs.gov.in" target="_blank" rel="noreferrer">🇮🇳 National Career Service</a>
              <a className="ks-opp-link" href="https://www.apprenticeshipindia.gov.in" target="_blank" rel="noreferrer">🤝 Apprenticeship India (NAPS)</a>
              <a className="ks-opp-link" href="https://data.gov.in" target="_blank" rel="noreferrer">📊 data.gov.in (job-market data)</a>
            </div>
            <div className="ks-sblock">
              <div className="ks-stitle">📖 Background — <span className="ks-label-badge ks-label-source" style={{ marginLeft: 4 }}>Source: Wikipedia</span></div>
              {!wikiSummary && (
                <button className="ks-gen-btn-secondary" disabled={loadingKey} onClick={loadWikiGrounding}>
                  {loadingKey === 'wiki' ? '⏳ Fetching…' : `Fetch background on "${trade || selectedSkill?.name}"`}
                </button>
              )}
              {wikiSummary && (
                <div className="ks-wiki-box">
                  {wikiSummary.extract}
                  <div style={{ marginTop: 6 }}><a href={wikiSummary.url} target="_blank" rel="noreferrer">Source: Wikipedia — {wikiSummary.title}</a>. Please verify further before relying on this.</div>
                </div>
              )}
            </div>
            <div className="ks-restart"><button onClick={restart}>🔄 Start a New Skill Journey</button></div>
          </div>
        )}
      </main>

      {toast && <div style={{ position: 'fixed', bottom: 22, right: 22, zIndex: 9999, background: 'linear-gradient(135deg,#0FA968,#1596D6)', color: '#fff', padding: '11px 20px', borderRadius: 10, fontWeight: 700, fontSize: 13, boxShadow: '0 7px 22px rgba(15,169,104,.38)' }}>{toast}</div>}
    </div>
  );
}