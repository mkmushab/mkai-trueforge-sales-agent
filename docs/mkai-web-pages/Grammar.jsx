import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';

// ─── API ──────────────────────────────────────────────────────────────────────
const GC_API_KEY = "YOUR_API_KEY_PLACEHOLDER"; // <-- General Compute API key
const GC_BASE_URL = "https://api.generalcompute.com/v1/chat/completions";
const GC_MODEL = "gpt-oss-120b";

async function callAPI(messages, max_tokens = 2500) {
  const res = await fetch(GC_BASE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GC_API_KEY}`,
    },
    body: JSON.stringify({
      model: GC_MODEL,
      messages,
      max_tokens,
      temperature: 0.35,
    }),
  });
  const data = await res.json();
  const raw = data.choices[0].message.content || '';
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('JSON not found in response');
  return JSON.parse(match[0]);
}

// ─── TOOL DEFINITIONS ─────────────────────────────────────────────────────────
const TOOL_CATEGORIES = [
  {
    id: 'fix',
    label: 'Fix & Polish',
    icon: '🔧',
    tools: [
      { id: 'fix_grammar',    icon: '✏️', name: 'Fix Grammar',        short: 'Fix all grammar, spelling & syntax errors',       badge: 'Core'    },
      { id: 'punctuation',    icon: '🔠', name: 'Punctuation Fixer',  short: 'Fix commas, periods, colons & all punctuation',   badge: null      },
      { id: 'active_passive', icon: '🔁', name: 'Active/Passive',     short: 'Convert passive voice ↔ active voice',            badge: null      },
      { id: 'sentence_short', icon: '✂️', name: 'Sentence Shortener', short: 'Long sentences → short, punchy & clear',          badge: 'Popular' },
    ],
  },
  {
    id: 'rewrite',
    label: 'Rewrite & Transform',
    icon: '🔄',
    tools: [
      { id: 'paraphrase',  icon: '📝', name: 'Paraphrase',          short: 'Same meaning, completely different words',        badge: 'Popular' },
      { id: 'plagiarism',  icon: '🔍', name: 'Plagiarism Rewriter', short: 'Rewrite to make text 100% original',              badge: null      },
      { id: 'creative',    icon: '🎨', name: 'Creative Rewrite',    short: 'Boring text → engaging, vivid & memorable',       badge: null      },
      { id: 'simplify',    icon: '🧒', name: 'Simplify Text',       short: 'Complex → simple language anyone can understand', badge: null      },
    ],
  },
  {
    id: 'enhance',
    label: 'Enhance & Elevate',
    icon: '✨',
    tools: [
      { id: 'improve',      icon: '✨', name: 'Improve Writing',    short: 'Elevate overall quality, flow & impact',          badge: null },
      { id: 'professional', icon: '💼', name: 'Make Professional',  short: 'Casual → polished, professional tone',            badge: null },
      { id: 'tone_changer', icon: '🎯', name: 'Tone Changer',       short: 'Shift tone: formal, friendly, assertive & more',  badge: null },
      { id: 'expand',       icon: '📖', name: 'Expand Text',        short: 'Add depth, examples & richer detail',             badge: null },
    ],
  },
  {
    id: 'format',
    label: 'Format & Structure',
    icon: '📐',
    tools: [
      { id: 'email_format', icon: '📧', name: 'Email Formatter',      short: 'Structure text into a professional email',        badge: null },
      { id: 'essay_format', icon: '📄', name: 'Essay Formatter',      short: 'Format as a well-structured essay',               badge: null },
      { id: 'social_media', icon: '📱', name: 'Social Media Format',  short: 'Optimize for LinkedIn, Twitter or Instagram',     badge: null },
      { id: 'dialogue',     icon: '💬', name: 'Dialogue Formatter',   short: 'Convert text into clean conversation format',     badge: null },
    ],
  },
  {
    id: 'specialized',
    label: 'Specialized Tools',
    icon: '🎯',
    tools: [
      { id: 'summarize',     icon: '📋', name: 'Summarize',           short: 'Extract key points into a concise summary',      badge: null },
      { id: 'translate',     icon: '🌐', name: 'Translate & Fix',     short: 'Translate to any language + grammar fix',        badge: null },
      { id: 'speech_formal', icon: '🗣️', name: 'Speech to Formal',    short: 'Casual spoken text → formal written prose',      badge: null },
      { id: 'cv_writer',     icon: '📄', name: 'CV/Resume Writer',    short: 'Convert text into impactful CV bullet points',   badge: null },
      { id: 'subject_line',  icon: '✉️', name: 'Subject Line Gen',    short: 'Generate catchy email subject lines',            badge: null },
      { id: 'readability',   icon: '📊', name: 'Readability Scorer',  short: 'Analyze reading level, grade & complexity',      badge: null },
    ],
  },
];

const TONES          = ['Professional', 'Casual', 'Formal', 'Friendly', 'Academic', 'Assertive', 'Empathetic'];
const LANGUAGES      = ['English', 'Hindi', 'Spanish', 'French', 'German', 'Arabic', 'Portuguese', 'Japanese'];
const SOCIAL_TARGETS = ['LinkedIn', 'Twitter/X', 'Instagram', 'Facebook'];

// ─── THEME — same palette & language as Home.jsx (emerald / sky / gold, on cream) ──
const T = {
  pageBg: '#f6faf7', s1: '#eef8f2', s2: '#e4f3ea', s3: '#cdeedd',
  navBg: 'rgba(228,243,234,.84)', navBorder: 'rgba(18,54,42,.10)',
  ink: '#122420', ink2: '#5c6b64', ink3: 'rgba(18,54,42,.45)',
  accent: '#0FA968', acc2: '#0C8457', acc3: 'rgba(15,169,104,.10)',
  sky: '#1596D6', sky2: '#0E77AC', gold: '#F2A93B',
  green: '#0FA968', red: '#DC2626', yellow: '#F2A93B', cyan: '#1596D6',
  b1: 'rgba(18,54,42,.10)', b2: 'rgba(18,54,42,.06)', b3: 'rgba(18,54,42,.04)',
  accentGrad: 'linear-gradient(135deg,#0FA968,#1596D6)',
  accentGrad2: 'linear-gradient(135deg,#0FA968 0%,#1596D6 50%,#0FA968 100%)',
  logoGrad: 'linear-gradient(135deg,#0FA968,#0C8457)',
  btnMainBg: 'linear-gradient(135deg,#0FA968,#1596D6)',
  btnMainShadow: '0 14px 30px rgba(15,150,120,.24)',
  btnMainShadowH: '0 18px 38px rgba(15,150,120,.34)',
  orbGrad1: 'radial-gradient(circle,rgba(15,169,104,.18),transparent 70%)',
  orbGrad2: 'radial-gradient(circle,rgba(21,150,214,.14),transparent 70%)',
  orbGrad3: 'radial-gradient(circle,rgba(242,169,59,.12),transparent 70%)',
  gridLine: 'rgba(15,169,104,.04)',
  chipBg: 'rgba(255,255,255,.68)',
  chipBorder: 'rgba(15,169,104,.24)',
  chipColor: '#0C8457',
  chipDot: '#0FA968',
  searchBg: 'rgba(255,255,255,.72)',
  searchFocusBg: 'rgba(15,169,104,.05)',
  searchFocusBorder: 'rgba(15,169,104,.40)',
  searchFocusShadow: '0 0 0 3px rgba(15,169,104,.16)',
  cardHoverBorder: 'rgba(15,169,104,.30)',
  cardHoverShadow: '0 18px 42px rgba(15,90,70,.20), inset 0 1px 0 rgba(255,255,255,.7)',
  inputBg: 'rgba(18,54,42,.04)',
  inputFocusBg: 'rgba(15,169,104,.05)',
  inputFocusBorder: 'rgba(15,169,104,.45)',
  inputFocusShadow: '0 0 0 3px rgba(15,169,104,.14)',
  tabOnBg: 'linear-gradient(135deg,#0FA968,#1596D6)',
  tabOffBg: 'rgba(255,255,255,.55)',
  tabOffBorder: 'rgba(18,54,42,.10)',
  tipBoxBg: 'rgba(15,169,104,.06)',
  tipBoxBorder: 'rgba(15,169,104,.18)',
  pillBg: 'rgba(15,169,104,.10)',
  pillBorder: 'rgba(15,169,104,.20)',
  badgeBg: 'rgba(242,169,59,.16)',
  badgeBorder: 'rgba(242,169,59,.32)',
  badgeColor: '#9A6415',
  changeBg: '#eef8f2',
  subjectCardBg: '#eef8f2',
  subjectCardHoverBg: 'rgba(15,169,104,.06)',
  subjectCardHoverBorder: 'rgba(15,169,104,.30)',
  metricBg: '#eef8f2',
  toastSuccessBg: 'linear-gradient(135deg,#0FA968,#0C8457)',
  toastSuccessColor: '#fff',
  toastErrBg: 'linear-gradient(135deg,#DC2626,#B91C1C)',
  toastErrColor: '#fff',
  catLineBg: 'rgba(18,54,42,.08)',
  catCountBg: 'rgba(18,54,42,.06)',
  scroll: 'rgba(15,169,104,.25)',
  catColors: ['#0FA968', '#1596D6', '#F2A93B', '#0C8457', '#0E77AC'],
};

// ─── PROMPT BUILDER ───────────────────────────────────────────────────────────
function buildPrompt(toolId, text, opts = {}) {
  const base      = `Text: "${text}"\n\n`;
  const jsonNote  = `Return ONLY valid JSON, no markdown, no backticks.`;
  const defaultSchema = `{
  "original": "original text",
  "result": "transformed text",
  "changes": [{"original": "old phrase", "corrected": "new phrase", "reason": "explanation"}],
  "score_before": 60,
  "score_after": 90,
  "improvements": ["improvement 1", "improvement 2", "improvement 3"],
  "word_count_before": 20,
  "word_count_after": 22,
  "readability": "Easy/Medium/Hard",
  "tone_detected": "detected tone",
  "tips": ["tip 1", "tip 2"]
}`;

  const prompts = {
    fix_grammar:    `Fix all grammar, spelling, punctuation, and syntax errors. Preserve the original meaning and style.\n${base}${jsonNote}\n${defaultSchema}`,
    punctuation:    `Fix ONLY punctuation errors (commas, periods, semicolons, apostrophes, colons, etc). Do not change word choices.\n${base}${jsonNote}\n${defaultSchema}`,
    active_passive: `Convert passive voice constructions to active voice (or vice versa if text is already active). Improve clarity.\n${base}${jsonNote}\n${defaultSchema}`,
    sentence_short: `Break down long, complex sentences into short, punchy, clear sentences. Maintain meaning.\n${base}${jsonNote}\n${defaultSchema}`,
    paraphrase:     `Rewrite this text with completely different wording while preserving the exact meaning.\n${base}${jsonNote}\n${defaultSchema}`,
    plagiarism:     `Rewrite this text to make it completely original — change sentence structure, vocabulary, and flow significantly.\n${base}${jsonNote}\n${defaultSchema}`,
    creative:       `Rewrite this text in a creative, engaging, vivid way. Make it memorable and compelling.\n${base}${jsonNote}\n${defaultSchema}`,
    simplify:       `Simplify this text so anyone can understand it. Use short sentences, simple words, avoid jargon.\n${base}${jsonNote}\n${defaultSchema}`,
    improve:        `Improve the overall writing quality — better word choices, smoother flow, stronger sentences.\n${base}${jsonNote}\n${defaultSchema}`,
    professional:   `Rewrite in a polished, professional tone suitable for business communication.\n${base}Tone: ${opts.tone || 'Professional'}\n${jsonNote}\n${defaultSchema}`,
    tone_changer:   `Rewrite this text in a ${opts.tone || 'Formal'} tone. Adjust word choices, sentence structure, and register accordingly.\n${base}${jsonNote}\n${defaultSchema}`,
    expand:         `Expand this text with more detail, context, examples, and supporting ideas. Make it richer.\n${base}${jsonNote}\n${defaultSchema}`,
    email_format:   `Format this text as a professional email with Subject, greeting, body paragraphs, and sign-off.\n${base}${jsonNote}\n{\n  "original": "...",\n  "result": "full formatted email",\n  "subject_line": "email subject",\n  "improvements": ["imp 1", "imp 2"],\n  "tone_detected": "tone",\n  "tips": ["tip 1"],\n  "score_before": 60, "score_after": 90\n}`,
    essay_format:   `Format this text as a well-structured essay with Introduction, Body paragraphs, and Conclusion.\n${base}${jsonNote}\n${defaultSchema}`,
    social_media:   `Rewrite and format this text optimized for ${opts.platform || 'LinkedIn'}. Include relevant hashtags, proper length, and engaging hooks.\n${base}${jsonNote}\n{\n  "original": "...",\n  "result": "formatted post",\n  "platform": "${opts.platform || 'LinkedIn'}",\n  "char_count": 280,\n  "hashtags": ["#tag1", "#tag2"],\n  "hook": "opening hook line",\n  "improvements": ["imp 1"],\n  "tips": ["tip 1"],\n  "score_before": 60, "score_after": 90\n}`,
    dialogue:       `Convert this text into a natural, well-formatted dialogue/conversation between characters.\n${base}${jsonNote}\n${defaultSchema}`,
    summarize:      `Create a concise, comprehensive summary capturing all key points.\n${base}${jsonNote}\n{\n  "original": "...",\n  "result": "concise summary",\n  "key_points": ["point 1", "point 2", "point 3"],\n  "word_count_before": 100,\n  "word_count_after": 30,\n  "score_before": 70, "score_after": 95,\n  "tone_detected": "tone",\n  "improvements": ["what was captured well"],\n  "tips": ["tip 1"]\n}`,
    translate:      `Translate this text to ${opts.targetLang || 'Spanish'} and fix any grammar issues in the translation.\n${base}${jsonNote}\n{\n  "original": "...",\n  "result": "translated & corrected text",\n  "target_language": "${opts.targetLang || 'Spanish'}",\n  "back_translation": "back-translate to verify accuracy",\n  "improvements": ["translation note 1"],\n  "score_before": 70, "score_after": 95,\n  "tone_detected": "tone",\n  "tips": ["tip 1"]\n}`,
    speech_formal:  `Convert this casual spoken/voice text into polished formal written prose. Fix run-ons, filler words, and informal language.\n${base}${jsonNote}\n${defaultSchema}`,
    cv_writer:      `Convert this text into impactful, action-verb-led CV/resume bullet points suitable for a professional resume.\n${base}${jsonNote}\n{\n  "original": "...",\n  "result": "formatted CV bullet points",\n  "bullet_points": ["• Action verb... result/impact", "• Action verb... result"],\n  "keywords": ["keyword1", "keyword2"],\n  "improvements": ["imp 1"],\n  "score_before": 55, "score_after": 92,\n  "tone_detected": "professional",\n  "tips": ["tip 1"]\n}`,
    subject_line:   `Generate 6 different compelling email subject lines for this content. Vary styles: curiosity, urgency, benefit, question, number-led, personalized.\n${base}${jsonNote}\n{\n  "original": "...",\n  "result": "Best recommended subject line",\n  "subject_lines": [\n    {"line": "subject 1", "style": "Curiosity", "score": 88},\n    {"line": "subject 2", "style": "Urgency", "score": 82},\n    {"line": "subject 3", "style": "Benefit", "score": 90},\n    {"line": "subject 4", "style": "Question", "score": 78},\n    {"line": "subject 5", "style": "Number-led", "score": 85},\n    {"line": "subject 6", "style": "Personalized", "score": 80}\n  ],\n  "improvements": ["what makes subject lines strong"],\n  "tips": ["best practice 1"],\n  "score_before": 60, "score_after": 90\n}`,
    readability:    `Analyze this text for readability, grade level, complexity, and writing quality.\n${base}${jsonNote}\n{\n  "original": "...",\n  "result": "readability analysis summary",\n  "grade_level": "Grade 8 (Middle School)",\n  "reading_ease": 65,\n  "reading_time": "2 min",\n  "flesch_score": 65,\n  "complexity": "Medium",\n  "avg_sentence_length": 18,\n  "avg_word_length": 5,\n  "passive_voice_pct": 15,\n  "vocabulary_richness": "Good",\n  "improvements": ["what to improve"],\n  "score_before": 70, "score_after": 70,\n  "tone_detected": "neutral",\n  "tips": ["tip to improve readability"]\n}`,
  };
  return prompts[toolId] || prompts.fix_grammar;
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function Grammar() {
  const navigate = useNavigate();

  const [activeTool, setActiveTool] = useState(null);
  const [text, setText]             = useState('');
  const [tone, setTone]             = useState('Professional');
  const [targetLang, setTargetLang] = useState('Spanish');
  const [platform, setPlatform]     = useState('LinkedIn');
  const [loading, setLoading]       = useState(false);
  const [result, setResult]         = useState(null);
  const [toast, setToast]           = useState('');
  const [search, setSearch]         = useState('');
  const [activeTab, setActiveTab]   = useState('result');
  const textareaRef = useRef();

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(''), 2600);
  };
  const copy   = (str) => { navigator.clipboard.writeText(str); showToast('Copied to clipboard!'); };
  const goTool = (tool) => { setActiveTool(tool); setResult(null); setActiveTab('result'); };
  const goBack = () => { setActiveTool(null); setResult(null); setText(''); };

  const filteredCategories = TOOL_CATEGORIES.map((cat, ci) => ({
    ...cat,
    color: T.catColors[ci],
    tools: cat.tools.filter(t =>
      !search ||
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.short.toLowerCase().includes(search.toLowerCase())
    ),
  })).filter(cat => !search || cat.tools.length > 0);

  const run = async () => {
    if (!text.trim() || !activeTool) return;
    setLoading(true); setResult(null);
    try {
      const prompt = buildPrompt(activeTool.id, text, { tone, targetLang, platform });
      const data = await callAPI([
        {
          role: 'system',
          content: 'You are MK-AI Writing Assistant, an expert in English writing, editing, and linguistic analysis. Return ONLY valid JSON — no markdown, no backticks, no explanations.',
        },
        { role: 'user', content: prompt },
      ]);
      setResult(data);
      setActiveTab('result');
    } catch (e) {
      showToast('Something went wrong. Try again.', 'error');
    }
    setLoading(false);
  };

  const scoreColor = s => s >= 80 ? T.green : s >= 60 ? T.yellow : T.red;
  const scoreBg    = s =>
    s >= 80
      ? 'rgba(15,169,104,0.12)'
      : s >= 60
      ? 'rgba(242,169,59,0.14)'
      : 'rgba(220,38,38,0.10)';

  // ─── CSS ──────────────────────────────────────────────────────────────────
  const CSS = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;650;700;800&display=swap');

    *{box-sizing:border-box;margin:0;padding:0}
    html,body{background:${T.pageBg};font-family:'Inter',ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif;color:${T.ink}}

    @keyframes up{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}
    @keyframes in{from{opacity:0}to{opacity:1}}
    @keyframes spin{to{transform:rotate(360deg)}}
    @keyframes slR{from{opacity:0;transform:translateX(-12px)}to{opacity:1;transform:translateX(0)}}
    @keyframes glow{0%,100%{opacity:.6}50%{opacity:1}}
    @keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
    @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
    @keyframes badgePop{0%{transform:scale(0.6)}60%{transform:scale(1.12)}100%{transform:scale(1)}}
    @keyframes bf{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}

    .ambience{position:fixed;inset:0;pointer-events:none;z-index:0;overflow:hidden}
    .orb{position:absolute;border-radius:50%;filter:blur(120px);animation:glow 7s ease-in-out infinite}
    .o1{width:600px;height:600px;background:${T.orbGrad1};top:-200px;left:-150px}
    .o2{width:500px;height:500px;background:${T.orbGrad2};bottom:-120px;right:-100px;animation-delay:3s}
    .o3{width:350px;height:350px;background:${T.orbGrad3};top:40%;right:20%;animation-delay:5s}
    .glines{position:fixed;inset:0;pointer-events:none;z-index:0;
      background-image:linear-gradient(${T.gridLine} 1px,transparent 1px),linear-gradient(90deg,${T.gridLine} 1px,transparent 1px);
      background-size:58px 58px}

    .wrap{min-height:100vh;position:relative;overflow-x:hidden;background:${T.pageBg}}

    .hdr{position:sticky;top:0;z-index:200;display:flex;align-items:center;justify-content:space-between;
      padding:12px 28px;background:${T.navBg};backdrop-filter:blur(28px) saturate(1.5);
      border-bottom:1px solid ${T.navBorder}}
    .logo{display:flex;align-items:center;gap:11px}
    .logo-box{width:38px;height:38px;border-radius:11px;background:${T.accentGrad};
      display:flex;align-items:center;justify-content:center;font-size:18px;
      box-shadow:0 8px 20px rgba(15,150,120,.28)}
    .logo-name{font-family:'Inter',sans-serif;font-size:15px;font-weight:700;
      background:${T.logoGrad};-webkit-background-clip:text;-webkit-text-fill-color:transparent}
    .logo-tag{font-size:9px;font-weight:700;letter-spacing:1.8px;color:${T.acc2};
      background:${T.acc3};padding:2px 9px;border-radius:20px;
      border:1px solid rgba(15,169,104,0.22);text-transform:uppercase}
    .hdr-btns{display:flex;gap:8px;align-items:center}

    .main{max-width:1060px;margin:0 auto;padding:42px 20px 100px;position:relative;z-index:1}

    .hero{text-align:center;padding:16px 0 48px;animation:up .7s ease}

    .hero-notch{
      display:inline-flex;align-items:center;gap:6px;
      background:${T.chipBg};
      border:1px solid ${T.chipBorder};
      color:${T.chipColor};
      padding:5px 14px;
      border-radius:100px;
      font-size:10px;font-weight:700;
      margin-bottom:28px;
      letter-spacing:0.6px;
      animation:bf 3.8s ease-in-out infinite;
      white-space:nowrap;
      box-shadow:0 7px 20px rgba(15,90,70,.06);
    }
    .hero-notch-dot{
      width:6px;height:6px;border-radius:50%;
      background:${T.chipDot};
      box-shadow:0 0 7px ${T.chipDot};
      display:inline-block;flex-shrink:0;
    }

    .hero-h{font-family:'Inter',sans-serif;font-size:clamp(36px,5.5vw,60px);font-weight:750;
      line-height:1.06;letter-spacing:-.04em;margin-bottom:16px;color:${T.ink}}
    .hero-h span{background:${T.accentGrad2};background-size:300%;
      animation:shimmer 4s linear infinite;-webkit-background-clip:text;-webkit-text-fill-color:transparent}
    .hero-sub{font-size:14px;color:${T.ink2};max-width:460px;margin:0 auto 12px;line-height:1.7}
    .hero-count{font-size:12px;color:${T.ink3};display:flex;align-items:center;justify-content:center;gap:10px}
    .hero-count b{color:${T.acc2}}

    .search-wrap{max-width:420px;margin:28px auto 36px;position:relative}
    .search-icon{position:absolute;left:16px;top:50%;transform:translateY(-50%);font-size:15px;opacity:.5}
    .search-inp{width:100%;background:${T.searchBg};border:1px solid ${T.b1};border-radius:12px;
      padding:12px 16px 12px 42px;color:${T.ink};font-size:13px;
      font-family:'Inter',sans-serif;outline:none;transition:all .2s}
    .search-inp:focus{border-color:${T.searchFocusBorder};background:${T.searchFocusBg};box-shadow:${T.searchFocusShadow}}
    .search-inp::placeholder{color:${T.ink3}}

    .cat-section{margin-bottom:36px;animation:up .5s ease both}
    .cat-label{display:flex;align-items:center;gap:10px;margin-bottom:16px}
    .cat-icon{font-size:15px}
    .cat-name{font-family:'Inter',sans-serif;font-size:13px;font-weight:700;letter-spacing:.4px;text-transform:uppercase}
    .cat-line{flex:1;height:1px;background:${T.catLineBg}}
    .cat-count{font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px;background:${T.catCountBg};color:${T.ink3}}
    .tools-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px}

    .tc{position:relative;background:${T.s1};border:1px solid ${T.b1};border-radius:16px;
      padding:20px;cursor:pointer;transition:all .22s;overflow:hidden}
    .tc::after{content:'';position:absolute;inset:0;border-radius:16px;opacity:0;transition:opacity .2s;
      background:linear-gradient(135deg,rgba(15,169,104,0.08),transparent 60%)}
    .tc:hover{transform:translateY(-3px);border-color:${T.cardHoverBorder};box-shadow:${T.cardHoverShadow}}
    .tc:hover::after{opacity:1}
    .tc-top{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:12px}
    .tc-icon{width:40px;height:40px;border-radius:10px;display:flex;align-items:center;justify-content:center;
      font-size:20px;background:${T.s2};border:1px solid ${T.b1};flex-shrink:0}
    .tc-badge{font-size:9px;font-weight:800;letter-spacing:.8px;padding:2px 8px;border-radius:20px;
      background:${T.badgeBg};color:${T.badgeColor};border:1px solid ${T.badgeBorder};
      animation:badgePop .4s ease;text-transform:uppercase}
    .tc-name{font-family:'Inter',sans-serif;font-size:14px;font-weight:700;margin-bottom:5px;letter-spacing:-.2px}
    .tc-short{font-size:11px;color:${T.ink2};line-height:1.55}
    .tc-arrow{position:absolute;bottom:18px;right:18px;font-size:12px;opacity:0;
      transition:all .2s;transform:translateX(-4px);color:${T.acc2}}
    .tc:hover .tc-arrow{opacity:1;transform:translateX(0)}

    .bc{display:flex;align-items:center;gap:8px;margin-bottom:24px;animation:slR .3s ease}
    .bc-btn{background:none;border:none;color:${T.ink2};cursor:pointer;font-size:13px;
      font-family:'Inter',sans-serif;display:flex;align-items:center;gap:5px;
      padding:7px 11px;border-radius:8px;transition:all .2s;font-weight:500}
    .bc-btn:hover{color:${T.acc2};background:rgba(15,169,104,0.08)}
    .bc-sep{color:${T.ink3};font-size:11px}
    .bc-curr{font-size:13px;font-weight:700;color:${T.acc2}}

    .tool-hdr{background:${T.s1};border:1px solid ${T.b1};border-radius:18px;padding:26px 28px;
      margin-bottom:18px;display:flex;align-items:center;gap:18px;animation:up .4s ease}
    .tool-hdr-icon{width:56px;height:56px;border-radius:14px;display:flex;align-items:center;justify-content:center;
      font-size:28px;background:${T.s2};border:1px solid ${T.b1};flex-shrink:0}
    .tool-hdr-name{font-family:'Inter',sans-serif;font-size:22px;font-weight:750;
      margin-bottom:4px;letter-spacing:-.4px}
    .tool-hdr-desc{font-size:13px;color:${T.ink2};line-height:1.55}

    .form-card{background:${T.s1};border:1px solid ${T.b1};border-radius:18px;padding:28px;
      margin-bottom:18px;animation:up .4s ease .05s both}
    .lbl{display:block;font-size:10px;font-weight:700;color:${T.ink2};
      letter-spacing:1px;text-transform:uppercase;margin:18px 0 8px}
    .ta,.inp,.sel{width:100%;background:${T.inputBg};border:1px solid ${T.b1};border-radius:10px;
      padding:12px 15px;color:${T.ink};font-size:14px;
      font-family:'Inter',sans-serif;outline:none;transition:all .2s}
    .ta:focus,.inp:focus,.sel:focus{border-color:${T.inputFocusBorder};
      background:${T.inputFocusBg};box-shadow:${T.inputFocusShadow}}
    .ta::placeholder,.inp::placeholder{color:${T.ink3}}
    .ta{resize:vertical;min-height:200px;line-height:1.8}
    .sel{cursor:pointer;appearance:none;
      background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%235c6b64' stroke-width='2' fill='none'/%3E%3C/svg%3E");
      background-repeat:no-repeat;background-position:right 13px center}
    .wc{font-size:11px;color:${T.ink3};margin-top:6px;display:flex;gap:16px}
    .two{display:grid;grid-template-columns:1fr 1fr;gap:14px}
    .three{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px}
    @media(max-width:580px){.two,.three{grid-template-columns:1fr}}

    .opts{display:flex;flex-wrap:wrap;gap:7px;margin-top:6px}
    .opt{padding:7px 14px;border-radius:8px;cursor:pointer;font-size:12px;font-weight:600;
      font-family:'Inter',sans-serif;transition:all .2s;
      border:1px solid ${T.b1};background:${T.b2};color:${T.ink2}}
    .opt:hover{border-color:rgba(15,169,104,0.4);color:${T.acc2}}
    .opt.on{background:${T.btnMainBg};border-color:transparent;color:#fff;font-weight:700}

    .btn-row{display:flex;gap:10px;margin-top:24px;flex-wrap:wrap}
    .btn{padding:12px 20px;border-radius:10px;cursor:pointer;font-size:13px;font-weight:700;
      font-family:'Inter',sans-serif;transition:all .24s;border:none;
      display:flex;align-items:center;gap:7px;justify-content:center;white-space:nowrap}
    .btn-main{background:${T.btnMainBg};color:#fff;flex:1;box-shadow:${T.btnMainShadow}}
    .btn-main:hover:not(:disabled){transform:translateY(-2px);box-shadow:${T.btnMainShadowH}}
    .btn-main:disabled{opacity:.4;cursor:not-allowed;transform:none!important}
    .btn-ghost{background:${T.b2};border:1px solid ${T.b1}!important;color:${T.ink}}
    .btn-ghost:hover{background:${T.b1}}
    .btn-green{background:linear-gradient(135deg,#0FA968,#0C8457);color:#fff;font-weight:800}
    .btn-sky{background:linear-gradient(135deg,#1596D6,#0E77AC);color:#fff;font-weight:800}
    .btn-sm{padding:8px 14px!important;font-size:12px!important;border-radius:8px!important}

    .spin{width:17px;height:17px;border:2.5px solid rgba(15,169,104,0.2);
      border-top-color:${T.accent};border-radius:50%;animation:spin .85s linear infinite;flex-shrink:0}

    .loading-card{background:${T.s1};border:1px solid ${T.b1};border-radius:18px;padding:40px;
      text-align:center;animation:in .3s ease;margin-bottom:18px}
    .loading-icon{font-size:42px;margin-bottom:14px;animation:float 2s ease infinite}
    .loading-title{font-family:'Inter',sans-serif;font-size:18px;font-weight:700;
      margin-bottom:6px;color:${T.acc2}}
    .loading-sub{font-size:13px;color:${T.ink2}}
    .loading-bar{width:100%;height:3px;background:rgba(15,169,104,0.14);border-radius:2px;
      margin-top:20px;overflow:hidden}
    .loading-fill{height:100%;background:linear-gradient(90deg,transparent,${T.accent},transparent);
      animation:shimmer 1.5s linear infinite;background-size:200% 100%}

    .result-wrap{animation:up .5s ease}
    .score-row{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:18px}
    .score-box{flex:1;min-width:90px;background:${T.s1};border:1px solid ${T.b1};
      border-radius:14px;padding:16px;text-align:center}
    .score-num{font-family:'Inter',sans-serif;font-size:30px;font-weight:900;line-height:1.1}
    .score-lbl{font-size:10px;color:${T.ink3};font-weight:600;letter-spacing:.4px;margin-top:4px;text-transform:uppercase}

    .cmp-row{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:18px}
    @media(max-width:620px){.cmp-row{grid-template-columns:1fr}}
    .cmp-box{background:${T.s2};border:1px solid ${T.b1};border-radius:14px;padding:18px;position:relative}
    .cmp-head{font-size:12px;font-weight:700;margin-bottom:10px;display:flex;align-items:center;gap:6px;
      text-transform:uppercase;letter-spacing:.6px}
    .cmp-body{font-size:13px;color:${T.ink2};line-height:1.8;white-space:pre-wrap}

    .sec{background:${T.s1};border:1px solid ${T.b1};border-radius:14px;padding:20px;margin-bottom:12px}
    .sec-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}
    .sec-title{font-family:'Inter',sans-serif;font-size:14px;font-weight:700;
      display:flex;align-items:center;gap:7px;letter-spacing:-.2px;color:${T.ink}}
    .sec-badge{font-size:9px;font-weight:800;padding:2px 9px;border-radius:20px;
      background:rgba(15,169,104,0.12);color:${T.acc2};letter-spacing:.3px}

    .change{margin-bottom:10px;padding:10px 14px;background:${T.changeBg};
      border-radius:8px;border:1px solid ${T.b1};font-size:13px;line-height:1.65}
    .wrong{color:${T.red};background:rgba(220,38,38,0.10);
      padding:2px 7px;border-radius:5px;font-weight:600}
    .right{color:${T.green};background:rgba(15,169,104,0.10);
      padding:2px 7px;border-radius:5px;font-weight:600}
    .reason{color:${T.ink3};font-size:12px}

    .list-item{font-size:13px;color:${T.ink2};padding:7px 0;
      border-bottom:1px solid ${T.b3};line-height:1.6;
      display:flex;gap:8px;align-items:flex-start}
    .list-item:last-child{border-bottom:none}
    .list-dot{color:${T.accent};font-size:16px;line-height:1;flex-shrink:0;margin-top:1px}

    .subj-card{background:${T.subjectCardBg};border:1px solid ${T.b1};border-radius:10px;
      padding:14px 16px;margin-bottom:8px;cursor:pointer;transition:all .2s;
      display:flex;align-items:center;justify-content:space-between;gap:12px}
    .subj-card:hover{border-color:${T.subjectCardHoverBorder};background:${T.subjectCardHoverBg}}
    .subj-style{font-size:9px;font-weight:800;padding:2px 8px;border-radius:12px;
      background:${T.acc3};color:${T.acc2};text-transform:uppercase;letter-spacing:.6px;flex-shrink:0}
    .subj-text{font-size:13px;color:${T.ink};font-weight:600;flex:1}
    .subj-score{font-size:11px;font-weight:700;color:${T.green};flex-shrink:0}

    .metric-row{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:10px;margin-bottom:14px}
    .metric{background:${T.metricBg};border:1px solid ${T.b1};border-radius:10px;padding:14px;text-align:center}
    .metric-val{font-family:'Inter',sans-serif;font-size:20px;font-weight:800;margin-bottom:4px}
    .metric-key{font-size:10px;color:${T.ink3};text-transform:uppercase;letter-spacing:.5px;font-weight:600}

    .tabs{display:flex;gap:6px;margin-bottom:16px;overflow-x:auto;scrollbar-width:none;padding-bottom:2px}
    .tab{padding:9px 16px;border-radius:8px;cursor:pointer;font-size:12px;font-weight:700;
      font-family:'Inter',sans-serif;white-space:nowrap;transition:all .2s;border:none;outline:none}
    .tab.on{background:${T.tabOnBg};color:#fff}
    .tab.off{background:${T.tabOffBg};color:${T.ink2};border:1px solid ${T.tabOffBorder}}
    .tab.off:hover{border-color:rgba(15,169,104,0.3);color:${T.acc2}}

    .pill{display:inline-flex;align-items:center;gap:5px;background:${T.pillBg};
      border:1px solid ${T.pillBorder};color:${T.acc2};padding:4px 12px;
      border-radius:100px;font-size:11px;font-weight:700}

    .tip-box{background:${T.tipBoxBg};border:1px solid ${T.tipBoxBorder};border-radius:12px;padding:16px}
    .act-bar{display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap}

    .toast-ok{position:fixed;bottom:24px;right:24px;z-index:9999;
      background:${T.toastSuccessBg};color:${T.toastSuccessColor};font-weight:800;
      padding:12px 20px;border-radius:11px;font-size:13px;
      animation:up .3s ease;box-shadow:0 8px 24px rgba(0,0,0,0.15)}
    .toast-err{position:fixed;bottom:24px;right:24px;z-index:9999;
      background:${T.toastErrBg};color:${T.toastErrColor};font-weight:800;
      padding:12px 20px;border-radius:11px;font-size:13px;animation:up .3s ease}

    ::-webkit-scrollbar{width:4px}
    ::-webkit-scrollbar-track{background:transparent}
    ::-webkit-scrollbar-thumb{background:${T.scroll};border-radius:4px}

    @media(max-width:500px){.hdr{padding:10px 14px}.main{padding:28px 12px 80px}}
  `;

  // ─── Header ───────────────────────────────────────────────────────────────
  const Header = () => (
    <header className="hdr">
      <div className="logo">
        <div className="logo-box">✏️</div>
        <span className="logo-name">MK Grammar Suite</span>
        <span className="logo-tag">22 Tools</span>
      </div>
      <div className="hdr-btns">
        {activeTool && (
          <button className="btn btn-ghost btn-sm" onClick={goBack}>⚡ All Tools</button>
        )}
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/')}>🏠 Home</button>
      </div>
    </header>
  );

  // ══ TOOL SELECTOR ══════════════════════════════════════════════════════════
  if (!activeTool) return (
    <>

      <Helmet>
        <title>Grammar Studio — 22-in-1 AI Writing Toolkit | MK AI</title>
        <meta name="description" content="Fix grammar, rewrite text, and polish your writing with MK AI's 22-in-1 grammar and writing toolkit." />
      </Helmet>
      <style>{CSS}</style>
      <div className="wrap">
        <div className="ambience">
          <div className="orb o1" /><div className="orb o2" /><div className="orb o3" />
        </div>
        <div className="glines" />
        <Header />
        <main className="main">
          <div className="hero">

            <div className="hero-notch">
              <span className="hero-notch-dot" />
              22 AI TOOLS &nbsp;·&nbsp; FREE TO USE
            </div>

            <h1 className="hero-h">
              Write <span>Better</span>,<br />Instantly.
            </h1>
            <p className="hero-sub">22 powerful tools to fix, rewrite, format, translate, and elevate any piece of text. Pick a tool and let AI do the work.</p>
            <div className="hero-count"><b>22 tools</b> · <b>5 categories</b> · Free to use</div>
          </div>

          <div className="search-wrap">
            <span className="search-icon">🔍</span>
            <input
              className="search-inp"
              placeholder="Search tools..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {filteredCategories.map((cat, ci) => cat.tools.length === 0 ? null : (
            <div key={cat.id} className="cat-section" style={{ animationDelay: `${ci * 0.07}s` }}>
              <div className="cat-label">
                <span className="cat-icon">{cat.icon}</span>
                <span className="cat-name" style={{ color: cat.color }}>{cat.label}</span>
                <div className="cat-line" style={{ background: `linear-gradient(90deg,${cat.color}33,transparent)` }} />
                <span className="cat-count">{cat.tools.length}</span>
              </div>
              <div className="tools-grid">
                {cat.tools.map(tool => (
                  <div
                    key={tool.id}
                    className="tc"
                    onClick={() => goTool({ ...tool, catColor: cat.color })}
                  >
                    <div className="tc-top">
                      <div
                        className="tc-icon"
                        style={{ borderColor: `${cat.color}22`, background: `${cat.color}0D` }}
                      >
                        <span style={{ fontSize: 22 }}>{tool.icon}</span>
                      </div>
                      {tool.badge && <span className="tc-badge">{tool.badge}</span>}
                    </div>
                    <div className="tc-name" style={{ color: cat.color }}>{tool.name}</div>
                    <div className="tc-short">{tool.short}</div>
                    <span className="tc-arrow">→</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </main>
      </div>
    </>
  );

  // ══ ACTIVE TOOL ════════════════════════════════════════════════════════════
  const tColor        = activeTool.catColor || T.accent;
  const needsTarget   = activeTool.id === 'translate';
  const needsPlatform = activeTool.id === 'social_media';
  const needsTone     = ['professional', 'tone_changer', 'email_format'].includes(activeTool.id);
  const isSubjectTool = activeTool.id === 'subject_line';
  const isReadability = activeTool.id === 'readability';
  const isCV          = activeTool.id === 'cv_writer';
  const isTranslate   = activeTool.id === 'translate';
  const isSocial      = activeTool.id === 'social_media';

  return (
    <>
      <style>{CSS}</style>
      <div className="wrap">
        <div className="ambience">
          <div className="orb o1" /><div className="orb o2" /><div className="orb o3" />
        </div>
        <div className="glines" />
        <Header />

        <main className="main">
          <div className="bc">
            <button className="bc-btn" onClick={goBack}>← All Tools</button>
            <span className="bc-sep">›</span>
            <span style={{ fontSize: 16 }}>{activeTool.icon}</span>
            <span className="bc-curr">{activeTool.name}</span>
          </div>

          <div className="tool-hdr">
            <div className="tool-hdr-icon" style={{ borderColor: `${tColor}22`, background: `${tColor}0D` }}>
              <span style={{ fontSize: 30 }}>{activeTool.icon}</span>
            </div>
            <div>
              <div className="tool-hdr-name" style={{ color: tColor }}>{activeTool.name}</div>
              <div className="tool-hdr-desc">{activeTool.short}</div>
            </div>
          </div>

          {!result && (
            <div className="form-card">
              {needsTone && (
                <>
                  <label className="lbl">Output Tone</label>
                  <div className="opts">
                    {TONES.map(t => (
                      <button key={t} className={`opt ${tone === t ? 'on' : ''}`} onClick={() => setTone(t)}>{t}</button>
                    ))}
                  </div>
                </>
              )}
              {needsTarget && (
                <>
                  <label className="lbl">Translate To</label>
                  <div className="opts">
                    {LANGUAGES.filter(l => l !== 'English').map(l => (
                      <button key={l} className={`opt ${targetLang === l ? 'on' : ''}`} onClick={() => setTargetLang(l)}>{l}</button>
                    ))}
                  </div>
                </>
              )}
              {needsPlatform && (
                <>
                  <label className="lbl">Target Platform</label>
                  <div className="opts">
                    {SOCIAL_TARGETS.map(p => (
                      <button key={p} className={`opt ${platform === p ? 'on' : ''}`} onClick={() => setPlatform(p)}>{p}</button>
                    ))}
                  </div>
                </>
              )}
              <label className="lbl">Your Text *</label>
              <textarea
                ref={textareaRef}
                className="ta"
                style={{ minHeight: isSubjectTool ? 120 : 220 }}
                placeholder={
                  isSubjectTool  ? 'Describe your email content or paste a draft...' :
                  isReadability  ? 'Paste any text to analyze its readability...' :
                  isCV           ? 'Describe your experience, skills, or achievements...' :
                  isSocial       ? 'Paste the content you want to optimize for social media...' :
                  isTranslate    ? 'Paste the text you want to translate...' :
                  'Paste your text here...'
                }
                value={text}
                onChange={e => setText(e.target.value)}
              />
              <div className="wc">
                <span>Words: {text.trim() ? text.trim().split(/\s+/).length : 0}</span>
                <span>Characters: {text.length}</span>
              </div>
              <div className="btn-row">
                <button className="btn btn-ghost" onClick={goBack}>← Back</button>
                <button className="btn btn-main" disabled={loading || !text.trim()} onClick={run}>
                  {loading
                    ? <><div className="spin" /> Analyzing...</>
                    : `${activeTool.icon} Run ${activeTool.name}`}
                </button>
              </div>
            </div>
          )}

          {loading && (
            <div className="loading-card">
              <div className="loading-icon">{activeTool.icon}</div>
              <div className="loading-title">Running {activeTool.name}...</div>
              <div className="loading-sub">AI is processing your text, give it a moment</div>
              <div className="loading-bar"><div className="loading-fill" /></div>
            </div>
          )}

          {result && !loading && (
            <div className="result-wrap">
              <div className="act-bar">
                <button className="btn btn-ghost btn-sm" onClick={() => setResult(null)}>← Edit Input</button>
                <button className="btn btn-green btn-sm" onClick={() => copy(result.result || result.corrected || '')}>📋 Copy Result</button>
                <button className="btn btn-ghost btn-sm" onClick={() => { setResult(null); setText(''); goBack(); }}>⚡ New Tool</button>
              </div>

              <div className="tabs">
                <button className={`tab ${activeTab === 'result' ? 'on' : 'off'}`} onClick={() => setActiveTab('result')}>✅ Result</button>
                {result.changes?.length > 0 && (
                  <button className={`tab ${activeTab === 'changes' ? 'on' : 'off'}`} onClick={() => setActiveTab('changes')}>
                    🔄 Changes ({result.changes.length})
                  </button>
                )}
                {result.improvements?.length > 0 && (
                  <button className={`tab ${activeTab === 'improve' ? 'on' : 'off'}`} onClick={() => setActiveTab('improve')}>
                    💡 Improvements
                  </button>
                )}
                {(result.tips || result.suggestions)?.length > 0 && (
                  <button className={`tab ${activeTab === 'tips' ? 'on' : 'off'}`} onClick={() => setActiveTab('tips')}>
                    📌 Tips
                  </button>
                )}
                {isReadability && (
                  <button className={`tab ${activeTab === 'metrics' ? 'on' : 'off'}`} onClick={() => setActiveTab('metrics')}>
                    📊 Metrics
                  </button>
                )}
                {isSubjectTool && result.subject_lines?.length > 0 && (
                  <button className={`tab ${activeTab === 'subjects' ? 'on' : 'off'}`} onClick={() => setActiveTab('subjects')}>
                    ✉️ All Lines
                  </button>
                )}
                {isCV && result.bullet_points?.length > 0 && (
                  <button className={`tab ${activeTab === 'bullets' ? 'on' : 'off'}`} onClick={() => setActiveTab('bullets')}>
                    📄 Bullets
                  </button>
                )}
                {isSocial && result.hashtags?.length > 0 && (
                  <button className={`tab ${activeTab === 'hashtags' ? 'on' : 'off'}`} onClick={() => setActiveTab('hashtags')}>
                    🏷️ Hashtags
                  </button>
                )}
                {isTranslate && result.back_translation && (
                  <button className={`tab ${activeTab === 'verify' ? 'on' : 'off'}`} onClick={() => setActiveTab('verify')}>
                    🔁 Verify
                  </button>
                )}
              </div>

              {activeTab === 'result' && (
                <>
                  {result.score_before !== undefined && (
                    <div className="score-row">
                      <div className="score-box" style={{ background: scoreBg(result.score_before), borderColor: `${scoreColor(result.score_before)}22` }}>
                        <div className="score-num" style={{ color: scoreColor(result.score_before) }}>{result.score_before}</div>
                        <div className="score-lbl">Before</div>
                      </div>
                      <div className="score-box" style={{ background: 'rgba(15,169,104,0.10)', borderColor: 'rgba(15,169,104,0.20)' }}>
                        <div className="score-num" style={{ color: T.acc2, fontSize: 22 }}>
                          {result.score_after > result.score_before ? '+' : ''}{result.score_after - result.score_before}
                        </div>
                        <div className="score-lbl">Change</div>
                      </div>
                      <div className="score-box" style={{ background: scoreBg(result.score_after), borderColor: `${scoreColor(result.score_after)}22` }}>
                        <div className="score-num" style={{ color: scoreColor(result.score_after) }}>{result.score_after}</div>
                        <div className="score-lbl">After</div>
                      </div>
                      {result.readability && (
                        <div className="score-box">
                          <div className="score-num" style={{ fontSize: 14, color: T.acc2 }}>{result.readability}</div>
                          <div className="score-lbl">Readability</div>
                        </div>
                      )}
                      {result.tone_detected && (
                        <div className="score-box">
                          <div className="score-num" style={{ fontSize: 12, color: T.cyan }}>{result.tone_detected}</div>
                          <div className="score-lbl">Tone Detected</div>
                        </div>
                      )}
                    </div>
                  )}

                  {isReadability && (
                    <div className="metric-row">
                      {[
                        { k: 'Grade Level',  v: result.grade_level },
                        { k: 'Reading Ease', v: result.reading_ease },
                        { k: 'Reading Time', v: result.reading_time },
                        { k: 'Complexity',   v: result.complexity },
                        { k: 'Avg. Sentence',v: result.avg_sentence_length ? `${result.avg_sentence_length} words` : null },
                        { k: 'Passive Voice',v: result.passive_voice_pct   ? `${result.passive_voice_pct}%`       : null },
                        { k: 'Vocabulary',   v: result.vocabulary_richness },
                      ].filter(m => m.v).map((m, i) => (
                        <div key={i} className="metric">
                          <div className="metric-val" style={{ color: tColor }}>{m.v}</div>
                          <div className="metric-key">{m.k}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {result.word_count_before !== undefined && (
                    <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
                      <span className="pill">{result.word_count_before} words before</span>
                      <span className="pill">{result.word_count_after} words after</span>
                      {result.char_count      && <span className="pill">{result.char_count} chars</span>}
                      {result.target_language && <span className="pill">🌐 {result.target_language}</span>}
                      {result.platform        && <span className="pill">📱 {result.platform}</span>}
                    </div>
                  )}

                  {result.email_subject && (
                    <div className="sec" style={{ marginBottom: 12 }}>
                      <div className="sec-title">📬 Subject Line</div>
                      <div style={{ marginTop: 10, background: 'rgba(15,169,104,0.07)', border: '1px solid rgba(15,169,104,0.2)', borderRadius: 10, padding: '12px 16px', color: T.acc2, fontWeight: 700, fontSize: 14 }}>
                        {result.email_subject}
                      </div>
                    </div>
                  )}

                  {isSubjectTool && result.result && (
                    <div className="sec" style={{ marginBottom: 12 }}>
                      <div className="sec-title">⭐ Top Recommended</div>
                      <div
                        style={{ marginTop: 10, background: 'rgba(15,169,104,0.07)', border: '1px solid rgba(15,169,104,0.22)', borderRadius: 10, padding: '14px 16px', color: T.green, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
                        onClick={() => copy(result.result)}
                      >
                        {result.result} <span style={{ color: T.ink3, fontSize: 11, marginLeft: 8 }}>(click to copy)</span>
                      </div>
                    </div>
                  )}

                  {result.hook && (
                    <div className="sec" style={{ marginBottom: 12 }}>
                      <div className="sec-title">🪝 Opening Hook</div>
                      <div style={{ marginTop: 10, background: 'rgba(21,150,214,0.07)', border: '1px solid rgba(21,150,214,0.20)', borderRadius: 10, padding: '12px 16px', color: T.sky2, fontWeight: 600, fontSize: 14 }}>
                        {result.hook}
                      </div>
                    </div>
                  )}

                  {!isReadability && !isSubjectTool && (result.original || result.result) && (
                    <div className="cmp-row">
                      <div className="cmp-box">
                        <div className="cmp-head" style={{ color: T.red }}><span>❌</span> Original</div>
                        <div className="cmp-body">{result.original || text}</div>
                      </div>
                      <div className="cmp-box">
                        <div className="cmp-head" style={{ color: T.green }}><span>✅</span> Result</div>
                        <div className="cmp-body">{result.result || result.corrected}</div>
                        <button className="btn btn-green btn-sm" style={{ marginTop: 12 }} onClick={() => copy(result.result || result.corrected)}>
                          📋 Copy
                        </button>
                      </div>
                    </div>
                  )}

                  {isCV && result.bullet_points?.length > 0 && (
                    <div className="sec">
                      <div className="sec-head">
                        <div className="sec-title">📄 CV Bullet Points</div>
                        <span className="sec-badge">{result.bullet_points.length} points</span>
                      </div>
                      {result.bullet_points.map((b, i) => (
                        <div key={i} className="list-item">
                          <span className="list-dot">•</span>
                          <span style={{ color: T.ink, fontWeight: 500 }}>{b}</span>
                        </div>
                      ))}
                      {result.keywords?.length > 0 && (
                        <>
                          <div style={{ fontSize: 10, fontWeight: 700, color: tColor, marginTop: 14, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.6px' }}>ATS Keywords</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {result.keywords.map((k, i) => <span key={i} className="pill">{k}</span>)}
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {result.key_points?.length > 0 && (
                    <div className="sec">
                      <div className="sec-title">🔑 Key Points</div>
                      {result.key_points.map((p, i) => (
                        <div key={i} className="list-item">
                          <span className="list-dot">▸</span>{p}
                        </div>
                      ))}
                    </div>
                  )}

                  {isReadability && result.result && (
                    <div className="sec">
                      <div className="sec-title">📊 Analysis Summary</div>
                      <p style={{ fontSize: 13, color: T.ink2, lineHeight: 1.8, marginTop: 10 }}>{result.result}</p>
                    </div>
                  )}
                </>
              )}

              {activeTab === 'changes' && result.changes?.length > 0 && (
                <div className="sec">
                  <div className="sec-head">
                    <div className="sec-title">🔄 Changes Made</div>
                    <span className="sec-badge">{result.changes.length}</span>
                  </div>
                  {result.changes.map((ch, i) => (
                    <div key={i} className="change">
                      <span className="wrong">"{ch.original}"</span>
                      <span style={{ color: T.ink3, margin: '0 8px' }}>→</span>
                      <span className="right">"{ch.corrected}"</span>
                      <span className="reason"> — {ch.reason}</span>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'improve' && result.improvements?.length > 0 && (
                <div className="sec">
                  <div className="sec-title">💡 Improvements Made</div>
                  {result.improvements.map((imp, i) => (
                    <div key={i} className="list-item">
                      <span className="list-dot">✨</span>{imp}
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'tips' && (
                <div className="tip-box">
                  <div className="sec-title" style={{ marginBottom: 14 }}>📌 Pro Tips</div>
                  {(result.tips || result.suggestions || []).map((t, i) => (
                    <div key={i} className="list-item" style={{ borderColor: 'rgba(15,169,104,0.10)' }}>
                      <span className="list-dot">▸</span>{t}
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'subjects' && result.subject_lines?.length > 0 && (
                <div className="sec">
                  <div className="sec-head">
                    <div className="sec-title">✉️ All Subject Lines</div>
                    <span className="sec-badge">{result.subject_lines.length} options</span>
                  </div>
                  {result.subject_lines.map((sl, i) => (
                    <div key={i} className="subj-card" onClick={() => copy(sl.line)}>
                      <span className="subj-style">{sl.style}</span>
                      <span className="subj-text">{sl.line}</span>
                      <span className="subj-score">{sl.score}/100</span>
                      <span style={{ color: T.ink3, fontSize: 11 }}>copy</span>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'bullets' && result.bullet_points?.length > 0 && (
                <div className="sec">
                  <div className="sec-head">
                    <div className="sec-title">📄 CV Bullet Points</div>
                    <button className="btn btn-green btn-sm" onClick={() => copy(result.bullet_points.join('\n'))}>📋 Copy All</button>
                  </div>
                  {result.bullet_points.map((b, i) => (
                    <div key={i} className="list-item">
                      <span className="list-dot">•</span>
                      <span style={{ color: T.ink, fontWeight: 500 }}>{b}</span>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'hashtags' && result.hashtags?.length > 0 && (
                <div className="sec">
                  <div className="sec-head">
                    <div className="sec-title">🏷️ Hashtags for {result.platform || platform}</div>
                    <button className="btn btn-ghost btn-sm" onClick={() => copy(result.hashtags.join(' '))}>📋 Copy All</button>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                    {result.hashtags.map((h, i) => (
                      <span key={i} className="pill" style={{ cursor: 'pointer' }} onClick={() => copy(h)}>{h}</span>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'verify' && result.back_translation && (
                <div className="sec">
                  <div className="sec-title">🔁 Back Translation (Accuracy Check)</div>
                  <p style={{ fontSize: 13, color: T.ink2, lineHeight: 1.8, marginTop: 12 }}>{result.back_translation}</p>
                  <p style={{ fontSize: 12, color: T.ink3, marginTop: 12 }}>Compare this with your original to verify translation accuracy.</p>
                </div>
              )}

              {activeTab === 'metrics' && isReadability && (
                <>
                  <div className="metric-row">
                    {[
                      { k: 'Grade Level',  v: result.grade_level,         c: T.acc2   },
                      { k: 'Flesch Score', v: result.flesch_score,        c: T.green  },
                      { k: 'Reading Time', v: result.reading_time,        c: T.cyan   },
                      { k: 'Complexity',   v: result.complexity,          c: T.gold   },
                      { k: 'Avg Sentence', v: result.avg_sentence_length ? `${result.avg_sentence_length} wds` : null, c: T.sky2 },
                      { k: 'Passive Voice',v: result.passive_voice_pct   ? `${result.passive_voice_pct}%`       : null, c: T.red  },
                      { k: 'Vocabulary',   v: result.vocabulary_richness, c: T.green  },
                    ].filter(m => m.v).map((m, i) => (
                      <div key={i} className="metric">
                        <div className="metric-val" style={{ color: m.c }}>{m.v}</div>
                        <div className="metric-key">{m.k}</div>
                      </div>
                    ))}
                  </div>
                  {result.improvements?.length > 0 && (
                    <div className="sec">
                      <div className="sec-title">💡 How to Improve</div>
                      {result.improvements.map((imp, i) => (
                        <div key={i} className="list-item"><span className="list-dot">▸</span>{imp}</div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </main>

        {toast && (
          <div className={toast.type === 'error' ? 'toast-err' : 'toast-ok'}>
            {toast.type === 'error' ? '❌' : '✅'} {toast.msg}
          </div>
        )}
      </div>
    </>
  );
}