import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const GEMINI_API_KEY = 'YOUR_API_KEY_PLACEHOLDER';
const GEMINI_MODEL   = 'gemini-2.5-flash';
// ─────────────────────────────────────────────────────────────────────────────

async function callGemini(prompt, jsonMode = false) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 4096,
      ...(jsonMode ? { responseMimeType: 'application/json' } : {}),
    },
  };
  const res  = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

async function callGeminiJSON(prompt) {
  const raw   = await callGemini(prompt, true);
  const clean = raw.replace(/```json|```/g, '').trim();
  return JSON.parse(clean);
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const extractVid = (url) => {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/);
  return m ? m[1] : null;
};
const thumbUrl = (id, q = 'maxresdefault') => `https://img.youtube.com/vi/${id}/${q}.jpg`;
const watchUrl = (id) => `https://www.youtube.com/watch?v=${id}`;

// ─── THEME — same single palette as Home.jsx (emerald / mint / sky-blue / saffron, on white) ──
const T = {
  bg: '#f6faf7', s1: '#fffefb', s2: '#eef8f2', s3: '#e4f3ea',
  border: 'rgba(18,54,42,.10)', borderHover: 'rgba(15,169,104,.30)',
  accent: '#0FA968', accent2: '#0C8457', accentOrange: '#F2A93B',
  grad: 'linear-gradient(135deg,#0FA968,#1596D6)',
  gradWarm: 'linear-gradient(135deg,#F2A93B,#EA580C)',
  ink: '#122420', ink2: 'rgba(18,36,32,0.58)', ink3: 'rgba(18,36,32,0.34)',
  red3: 'rgba(15,169,104,0.08)', rb: 'rgba(15,169,104,0.16)',
  btnShadow: '0 4px 20px rgba(15,150,120,0.22)',
  btnShadowH: '0 8px 30px rgba(15,150,120,0.38)',
  inputBg: 'rgba(18,36,32,0.04)', inputBorder: 'rgba(18,36,32,0.12)',
  inputFocusBorder: 'rgba(15,169,104,0.45)', inputFocusShadow: '0 0 0 3px rgba(15,169,104,0.10)',
  tagBg: 'rgba(15,169,104,0.10)', tagColor: '#0C8457',
  kpNum: 'rgba(15,169,104,0.22)',
  overviewBg: 'rgba(15,169,104,0.06)',
  actionBg: 'rgba(21,128,61,0.05)', actionBorder: 'rgba(21,128,61,0.16)',
  chipBg: 'rgba(15,169,104,0.09)', chipBorder: 'rgba(15,169,104,0.20)', chipColor: '#0C8457',
  chatUser: 'linear-gradient(135deg,#0FA968,#1596D6)',
  toastBg: 'linear-gradient(135deg,#22C55E,#16A34A)', toastColor: '#fff',
  scroll: 'rgba(15,169,104,0.18)',
  verdictBg: 'rgba(15,169,104,0.06)',
  gridColor: 'rgba(18,54,42,0.04)',
  orb1: 'radial-gradient(circle,rgba(15,169,104,0.13),transparent 70%)',
  orb2: 'radial-gradient(circle,rgba(21,150,214,0.10),transparent 70%)',
  orb3: 'radial-gradient(circle,rgba(242,169,59,0.08),transparent 70%)',
  thumbOverlay: 'linear-gradient(to top,rgba(246,250,247,0.96) 0%,rgba(246,250,247,0.3) 55%,transparent 100%)',
  navBg: 'rgba(246,250,247,0.90)',
};

// ─── PDF EXPORT ───────────────────────────────────────────────────────────────
function exportPDF(result, videoId) {
  const w = window.open('', '_blank');
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${result.title}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:system-ui,sans-serif;background:#fff;color:#122420;padding:40px;font-size:13px;line-height:1.75}
    .cover{background:linear-gradient(135deg,#0C8457,#1596D6);color:#fff;padding:32px;border-radius:14px;margin-bottom:28px;display:flex;gap:22px}
    .cover img{width:190px;border-radius:8px;flex-shrink:0;object-fit:cover}
    .cover-title{font-size:22px;font-weight:800;margin-bottom:8px}
    .cover-meta{font-size:12px;color:#d9f7e7;margin-bottom:10px}
    .tag{display:inline-block;background:rgba(255,255,255,.18);color:#eafaf1;padding:3px 10px;border-radius:12px;font-size:10px;font-weight:700;margin:2px;border:1px solid rgba(255,255,255,.25)}
    .rating{display:inline-flex;align-items:center;gap:6px;background:rgba(255,255,255,.2);border:1px solid rgba(255,255,255,.35);color:#fff;padding:5px 14px;border-radius:20px;font-size:12px;font-weight:800;margin-top:12px}
    h2{font-size:14px;font-weight:800;color:#0C8457;margin:22px 0 10px;padding:7px 13px;background:#eef8f2;border-radius:6px;border-left:4px solid #0FA968}
    .overview{background:#f5fbf7;border-left:4px solid #0FA968;padding:14px 16px;border-radius:0 8px 8px 0;font-size:13px;color:#374151;line-height:1.85;margin:10px 0}
    .kp{background:#f9fdfa;border:1px solid #e4f3ea;border-radius:8px;padding:12px 16px;margin-bottom:9px}
    .kp-title{font-weight:700;color:#0C8457;margin-bottom:4px}
    .kp-detail{font-size:12px;color:#6b7280}
    .chapter{display:flex;gap:12px;padding:10px 14px;background:#f9fdfa;border-radius:8px;margin-bottom:8px;align-items:flex-start}
    .ch-time{background:#0FA968;color:#fff;padding:3px 9px;border-radius:6px;font-size:11px;font-weight:800;flex-shrink:0}
    .ch-title{font-weight:700;color:#122420;font-size:13px}
    .ch-sum{font-size:12px;color:#6b7280}
    .action{padding:8px 0;border-bottom:1px solid #e4f3ea;font-size:13px;color:#374151}
    .action:before{content:"☑  ";color:#22C55E;font-weight:800}
    .verdict{background:#f5fbf7;border:1px solid #e4f3ea;border-radius:10px;padding:16px;font-size:13px;color:#122420;line-height:1.85}
    .verdict-score{font-size:48px;font-weight:900;color:#0FA968;margin-bottom:8px}
    .quote{border-left:3px solid #0FA968;padding:10px 14px;background:#f5fbf7;color:#374151;margin:8px 0;font-style:italic;font-size:12px;border-radius:0 8px 8px 0}
    .footer{margin-top:28px;padding-top:14px;border-top:2px solid #e4f3ea;font-size:11px;color:#9ca3af;text-align:center}
    @media print{body{padding:20px}}
  </style></head><body>
  <div class="cover">
    <img src="${thumbUrl(videoId)}" onerror="this.src='${thumbUrl(videoId,'mqdefault')}'"/>
    <div>
      <div class="cover-title">${result.title}</div>
      <div class="cover-meta">📺 ${result.channel||'YouTube'} · 🌐 ${result.language||'English'} · ⏱ ${result.duration_estimate||'—'}</div>
      <div>${(result.tags||[]).map(t=>`<span class="tag">#${t}</span>`).join('')}</div>
      <div class="rating">⭐ ${result.rating||'N/A'} &nbsp;·&nbsp; ${result.verdict_short||''}</div>
    </div>
  </div>
  <h2>📋 Overview</h2><div class="overview">${result.overview}</div>
  ${result.key_points?.length?`<h2>🎯 Key Points</h2>${result.key_points.map(k=>`<div class="kp"><div class="kp-title">▸ ${k.point}</div><div class="kp-detail">${k.detail}</div></div>`).join('')}`:''}
  ${result.chapters?.length?`<h2>📑 Chapters</h2>${result.chapters.map(c=>`<div class="chapter"><span class="ch-time">${c.time}</span><div><div class="ch-title">${c.title}</div><div class="ch-sum">${c.summary}</div></div></div>`).join('')}`:''}
  ${result.important_quotes?.length?`<h2>💬 Quotes</h2>${result.important_quotes.map(q=>`<div class="quote">"${q}"</div>`).join('')}`:''}
  ${result.action_items?.length?`<h2>✅ Action Items</h2>${result.action_items.map(a=>`<div class="action">${a}</div>`).join('')}`:''}
  ${result.verdict?`<h2>🏆 Verdict</h2><div class="verdict"><div class="verdict-score">${result.rating||'?'}</div>${result.verdict}</div>`:''}
  <div class="footer">Generated on ${new Date().toLocaleDateString('en-US',{day:'numeric',month:'long',year:'numeric'})}</div>
  </body></html>`);
  w.document.close();
  setTimeout(() => w.print(), 600);
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function YouTubeSummarizer() {
  const navigate = useNavigate();

  const [url, setUrl]           = useState('');
  const [sumType, setSumType]   = useState('Detailed');
  const [lang, setLang]         = useState('English');
  const [loading, setLoading]   = useState(false);
  const [loadStep, setLoadStep] = useState(0);
  const [result, setResult]     = useState(null);
  const [videoId, setVid]       = useState('');
  const [activeTab, setTab]     = useState('summary');
  const [toast, setToast]       = useState('');
  const [msgs, setMsgs]         = useState([]);
  const [chatInp, setChatInp]   = useState('');
  const [chatLoad, setChatLoad] = useState(false);
  const msgsEnd = useRef();
  const chatRef = useRef();

  const liveVid = extractVid(url);
  const showToast = (m) => { setToast(m); setTimeout(() => setToast(''), 2800); };
  const copy = (s) => { navigator.clipboard.writeText(s); showToast('Copied!'); };

  useEffect(() => { msgsEnd.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs, chatLoad]);

  const LOAD_STEPS = [
    '🔍 Fetching video info…',
    '🧠 Reading content with Gemini…',
    '✍️ Extracting key insights…',
    '📊 Building your summary…',
  ];

  const summarize = async () => {
    if (!url.trim()) return;
    const vid = extractVid(url);
    if (!vid) { showToast('Please enter a valid YouTube URL.'); return; }
    setVid(vid);
    setLoading(true);
    setResult(null);
    setMsgs([]);
    setLoadStep(0);

    const steps = [1, 2, 3];
    steps.forEach((s, i) => setTimeout(() => setLoadStep(i + 1), (i + 1) * 1400));

    try {
      const prompt = `You are an expert YouTube video analyst with deep knowledge. Analyze the following YouTube video and produce a rich, accurate, detailed summary.

YouTube URL: ${url}
Video ID: ${vid}
Requested Summary Depth: ${sumType}
Output Language: ${lang}

Use the video ID and URL to infer as much as possible about the video's content, topic, creator, and context.

Return ONLY valid JSON with this exact structure (no markdown, no backticks):
{
  "title": "Accurate video title based on URL/ID inference",
  "channel": "Channel/creator name",
  "topic": "Core topic in 4-6 words",
  "duration_estimate": "Estimated duration e.g. 12 min",
  "language": "${lang}",
  "overview": "A thorough 4-5 sentence overview covering what the video is about, what value it provides, and what makes it noteworthy",
  "key_points": [
    {"point": "Concise point title", "detail": "2-3 sentence elaboration with specifics"},
    {"point": "...", "detail": "..."},
    {"point": "...", "detail": "..."},
    {"point": "...", "detail": "..."},
    {"point": "...", "detail": "..."},
    {"point": "...", "detail": "..."}
  ],
  "chapters": [
    {"time": "0:00", "title": "Chapter name", "summary": "What's covered in this segment"},
    {"time": "...", "title": "...", "summary": "..."}
  ],
  "important_quotes": [
    "A memorable or insightful line from the video",
    "Another key quote or statement"
  ],
  "action_items": [
    "Specific actionable takeaway viewers should do",
    "Another concrete next step",
    "Third actionable item",
    "Fourth actionable item"
  ],
  "rating": "8.5/10",
  "verdict_short": "3-word verdict e.g. Must Watch Now",
  "verdict": "2-3 sentence honest verdict — is this video worth watching, what type of viewer will benefit most, any caveats",
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
  "target_audience": "Who will get the most value from this video",
  "pros": ["Pro 1", "Pro 2", "Pro 3"],
  "cons": ["Con 1", "Con 2"]
}`;

      const data = await callGeminiJSON(prompt);
      setResult(data);
      setTab('summary');
      setMsgs([{
        role: 'ai',
        text: `Video analyzed! **"${data.title}"** — ${data.overview?.slice(0, 120)}…\n\nAsk me anything about this video.`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }]);
    } catch (e) {
      console.error(e);
      showToast('Error: ' + (e.message || 'Something went wrong. Please try again.'));
    }
    setLoading(false);
  };

  const sendChat = async (custom) => {
    const q = custom || chatInp.trim();
    if (!q || !result) return;
    setChatInp('');
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setMsgs(prev => [...prev, { role: 'user', text: q, time: now }]);
    setChatLoad(true);

    const ctx = `Video: "${result.title}" by ${result.channel}
Topic: ${result.topic}
Overview: ${result.overview}
Key Points: ${result.key_points?.map(k => `${k.point}: ${k.detail}`).join(' | ')}
Chapters: ${result.chapters?.map(c => `${c.time} ${c.title}: ${c.summary}`).join(' | ')}
Action Items: ${result.action_items?.join(', ')}
Verdict: ${result.verdict}
Pros: ${result.pros?.join(', ')}
Cons: ${result.cons?.join(', ')}`;

    const history = msgs.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.text}`).join('\n');

    const prompt = `You are an expert assistant who has fully analyzed a YouTube video. Answer questions about it clearly and helpfully. Respond in ${lang}.

VIDEO CONTEXT:
${ctx}

CONVERSATION HISTORY:
${history}

User's Question: ${q}

Give a helpful, specific answer based on the video context. Be concise but thorough. If asked something not in the context, say so honestly.`;

    try {
      const raw = await callGemini(prompt);
      setMsgs(prev => [...prev, { role: 'ai', text: raw, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
    } catch {
      setMsgs(prev => [...prev, { role: 'ai', text: 'Something went wrong. Please try again.', time: '' }]);
    }
    setChatLoad(false);
  };

  const SUGGESTIONS = [
    'What are the main takeaways?',
    'Explain this in simple terms',
    'Is this good for beginners?',
    'Which chapter is most important?',
    'List the pros and cons',
    'Give me a 3-sentence summary',
  ];

  const fmt = (t) => t.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br/>');

  // ── CSS ─────────────────────────────────────────────────────────────────────
  const CSS = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;650;700;800;900&display=swap');
    *{box-sizing:border-box;margin:0;padding:0}
    html,body{background:${T.bg};font-family:'Inter',ui-sans-serif,system-ui,sans-serif;color:${T.ink};min-height:100vh}
    body{background:radial-gradient(circle at 15% 10%, rgba(15,169,104,.10), transparent 26rem), ${T.bg};}

    @keyframes fadeUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}
    @keyframes spin{to{transform:rotate(360deg)}}
    @keyframes pulse{0%,100%{opacity:.6}50%{opacity:1}}
    @keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
    @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
    @keyframes glow{0%,100%{opacity:.4}50%{opacity:.85}}
    @keyframes bars{0%,100%{transform:scaleY(.35)}50%{transform:scaleY(1)}}

    .wrap{min-height:100vh;position:relative;overflow-x:hidden;background:transparent}

    .amb{position:fixed;inset:0;pointer-events:none;z-index:0;overflow:hidden}
    .orb{position:absolute;border-radius:50%;filter:blur(120px);animation:glow 8s ease-in-out infinite}
    .o1{width:600px;height:600px;background:${T.orb1};top:-220px;left:-150px}
    .o2{width:450px;height:450px;background:${T.orb2};bottom:-100px;right:-80px;animation-delay:3.5s}
    .o3{width:320px;height:320px;background:${T.orb3};top:45%;right:8%;animation-delay:6s}
    .grid-bg{position:fixed;inset:0;pointer-events:none;z-index:0;
      background-image:linear-gradient(${T.gridColor} 1px,transparent 1px),linear-gradient(90deg,${T.gridColor} 1px,transparent 1px);
      background-size:52px 52px}

    /* ── Header ── */
    .hdr{
      position:sticky;top:0;z-index:200;
      display:flex;align-items:center;justify-content:space-between;
      padding:10px 24px;
      background:${T.navBg};
      backdrop-filter:blur(24px) saturate(1.4);
      border-bottom:1px solid ${T.border};
      gap:10px;
    }
    .logo{display:flex;align-items:center;gap:9px;flex-shrink:0}
    .logo-icon{
      width:34px;height:34px;border-radius:10px;
      background:${T.grad};
      display:flex;align-items:center;justify-content:center;
      font-size:16px;
      box-shadow:0 0 20px rgba(15,169,104,0.25);
    }
    .logo-text{
      font-size:15px;font-weight:700;
      background:${T.grad};-webkit-background-clip:text;-webkit-text-fill-color:transparent;
    }
    .hdr-r{display:flex;gap:7px;align-items:center;flex-shrink:0}

    /* Back button */
    .back-btn{
      background:none;
      border:1px solid ${T.inputBorder};
      color:${T.ink};
      padding:6px 13px;
      border-radius:100px;
      cursor:pointer;
      font-size:12px;font-weight:600;
      font-family:'Inter',sans-serif;
      transition:border-color .2s,color .2s;
      white-space:nowrap;
    }
    .back-btn:hover{border-color:${T.borderHover};color:${T.accent2}}

    /* Main */
    .main{max-width:920px;margin:0 auto;padding:44px 20px 100px;position:relative;z-index:1}

    /* Hero */
    .hero{text-align:center;padding:20px 0 44px;animation:fadeUp .6s ease}
    .hero-chip{display:inline-flex;align-items:center;gap:7px;background:${T.chipBg};
      border:1px solid ${T.chipBorder};padding:6px 18px;border-radius:100px;margin-bottom:28px}
    .hero-dot{width:6px;height:6px;background:${T.accent};border-radius:50%;animation:pulse 2s ease infinite}
    .hero-chip-txt{font-size:11px;font-weight:700;letter-spacing:1.5px;color:${T.chipColor};text-transform:uppercase}
    .hero-h{font-size:clamp(28px,4.5vw,52px);font-weight:750;letter-spacing:-.03em;
      line-height:1.12;margin-bottom:16px;color:${T.ink}}
    .hero-span{background:${T.grad};background-size:300%;animation:shimmer 4s linear infinite;
      -webkit-background-clip:text;-webkit-text-fill-color:transparent}
    .hero-sub{font-size:14px;color:${T.ink2};max-width:500px;margin:0 auto;line-height:1.75}

    /* Card */
    .card{background:${T.s1};border:1px solid ${T.border};border-radius:22px;padding:26px;
      margin-bottom:16px;animation:fadeUp .4s ease;box-shadow:0 10px 30px rgba(15,90,70,.06)}
    .card-title{font-size:16px;font-weight:750;
      margin-bottom:4px;color:${T.ink}}
    .card-sub{font-size:13px;color:${T.ink2};margin-bottom:20px}

    /* Input */
    .url-wrap{position:relative;margin-bottom:14px}
    .url-icon{position:absolute;left:14px;top:50%;transform:translateY(-50%);font-size:16px;pointer-events:none}
    .url-inp{width:100%;background:${T.inputBg};border:1.5px solid ${T.inputBorder};border-radius:14px;
      padding:12px 16px 12px 44px;color:${T.ink};font-size:14px;
      font-family:'Inter',sans-serif;outline:none;transition:all .2s}
    .url-inp:focus{border-color:${T.inputFocusBorder};box-shadow:${T.inputFocusShadow}}
    .url-inp::placeholder{color:${T.ink3}}

    /* Thumb */
    .thumb-preview{border-radius:14px;overflow:hidden;margin-bottom:16px;position:relative;
      border:1px solid ${T.border};animation:fadeUp .3s ease}
    .thumb-preview img{width:100%;display:block;max-height:200px;object-fit:cover}
    .thumb-overlay{position:absolute;inset:0;background:${T.thumbOverlay};
      display:flex;align-items:flex-end;padding:14px}
    .thumb-open{display:flex;align-items:center;gap:6px;background:${T.accent};
      color:#fff;padding:7px 14px;border-radius:100px;font-size:12px;font-weight:700;
      cursor:pointer;border:none;text-decoration:none;transition:opacity .2s}
    .thumb-open:hover{opacity:.84}

    /* Options */
    .lbl{display:block;font-size:10px;font-weight:700;color:${T.ink2};
      letter-spacing:1.2px;text-transform:uppercase;margin:14px 0 7px}
    .opts{display:flex;flex-wrap:wrap;gap:7px}
    .opt{padding:7px 14px;border-radius:100px;cursor:pointer;font-size:12px;font-weight:600;
      font-family:'Inter',sans-serif;transition:all .2s;
      border:1.5px solid ${T.inputBorder};background:${T.inputBg};color:${T.ink2}}
    .opt:hover{border-color:${T.borderHover};color:${T.accent2}}
    .opt.on{background:${T.grad};border-color:transparent;color:#fff;font-weight:700}
    .two{display:grid;grid-template-columns:1fr 1fr;gap:14px}
    @media(max-width:580px){.two{grid-template-columns:1fr}}

    /* Buttons */
    .btn-row{display:flex;gap:9px;margin-top:20px;flex-wrap:wrap}
    .btn{padding:11px 18px;border-radius:100px;cursor:pointer;font-size:13px;font-weight:700;
      font-family:'Inter',sans-serif;transition:all .22s;border:none;
      display:flex;align-items:center;gap:7px;justify-content:center;white-space:nowrap}
    .btn-main{background:${T.grad};color:#fff;flex:1;box-shadow:${T.btnShadow}}
    .btn-main:hover:not(:disabled){transform:translateY(-1px);box-shadow:${T.btnShadowH}}
    .btn-main:disabled{opacity:.38;cursor:not-allowed;transform:none!important}
    .btn-ghost{background:${T.inputBg};border:1.5px solid ${T.inputBorder}!important;color:${T.ink}}
    .btn-ghost:hover{border-color:${T.borderHover}!important}
    .btn-pdf{background:${T.gradWarm};color:#fff}
    .btn-sm{padding:7px 13px!important;font-size:12px!important;border-radius:100px!important}

    /* Spinner */
    .spin{width:15px;height:15px;border:2.5px solid rgba(255,255,255,0.25);border-top-color:#fff;
      border-radius:50%;animation:spin .8s linear infinite;flex-shrink:0}
    .spin-dark{border-color:${T.red3};border-top-color:${T.accent}}

    /* Loading */
    .load-card{background:${T.s1};border:1px solid ${T.border};border-radius:22px;
      padding:48px 28px;text-align:center;animation:fadeUp .3s ease;margin-bottom:16px}
    .load-icon{font-size:44px;margin-bottom:14px;display:block;animation:float 2s ease infinite}
    .load-title{font-size:18px;font-weight:750;margin-bottom:6px;color:${T.accent2}}
    .load-sub{font-size:13px;color:${T.ink2};margin-bottom:22px}
    .load-steps{display:flex;flex-direction:column;gap:8px;margin-bottom:22px}
    .load-step{font-size:13px;color:${T.ink3};transition:color .3s}
    .load-step.done{color:${T.accent2}}
    .load-step.active{color:${T.ink};font-weight:600}
    .load-bar{width:100%;height:3px;background:${T.red3};border-radius:2px;overflow:hidden}
    .load-fill{height:100%;background:linear-gradient(90deg,transparent,${T.accent},${T.accentOrange},transparent);
      background-size:200% 100%;animation:shimmer 1.3s linear infinite}

    /* Video Card */
    .vid-card{background:${T.s1};border:1px solid ${T.border};border-radius:22px;overflow:hidden;margin-bottom:14px;box-shadow:0 10px 30px rgba(15,90,70,.06)}
    .vid-thumb{position:relative}
    .vid-thumb img{width:100%;display:block;max-height:300px;object-fit:cover}
    .vid-thumb-overlay{position:absolute;inset:0;background:${T.thumbOverlay}}
    .vid-play{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
      width:54px;height:54px;border-radius:50%;background:${T.accent};opacity:.92;
      display:flex;align-items:center;justify-content:center;font-size:20px;
      text-decoration:none;transition:all .2s;border:3px solid rgba(255,255,255,.4);color:#fff}
    .vid-play:hover{transform:translate(-50%,-50%) scale(1.07);opacity:1}
    .vid-meta{padding:16px 20px 20px}
    .vid-title{font-size:17px;font-weight:750;
      margin-bottom:7px;line-height:1.35;letter-spacing:-.01em;color:${T.ink}}
    .vid-ch{font-size:13px;color:${T.ink2};margin-bottom:10px;display:flex;flex-wrap:wrap;gap:6px;align-items:center}
    .vid-tags{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:11px}
    .vid-tag{background:${T.tagBg};border:1px solid ${T.rb};color:${T.tagColor};
      padding:3px 10px;border-radius:12px;font-size:11px;font-weight:700}
    .vid-rating{display:inline-flex;align-items:center;gap:6px;background:${T.overviewBg};
      border:1px solid ${T.rb};color:${T.accent2};padding:5px 14px;border-radius:20px;
      font-size:13px;font-weight:800}

    /* Action Bar */
    .act-bar{display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap}

    /* Tabs */
    .tabs{display:flex;gap:6px;margin-bottom:16px;overflow-x:auto;scrollbar-width:none;padding-bottom:2px}
    .tabs::-webkit-scrollbar{display:none}
    .tab{padding:8px 15px;border-radius:100px;cursor:pointer;font-size:12px;font-weight:700;
      font-family:'Inter',sans-serif;white-space:nowrap;transition:all .2s;border:none;outline:none}
    .tab.on{background:${T.grad};color:#fff}
    .tab.off{background:${T.inputBg};color:${T.ink2};border:1.5px solid ${T.inputBorder}}
    .tab.off:hover{border-color:${T.borderHover};color:${T.accent2}}

    /* Sections */
    .sec{background:${T.s1};border:1px solid ${T.border};border-radius:18px;padding:22px;margin-bottom:12px;box-shadow:0 10px 30px rgba(15,90,70,.05)}
    .sec-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}
    .sec-title{font-size:15px;font-weight:750;
      display:flex;align-items:center;gap:7px;color:${T.ink}}
    .sec-badge{font-size:9px;font-weight:800;padding:2px 9px;border-radius:20px;
      background:${T.red3};color:${T.accent2};letter-spacing:.3px}

    .overview-box{background:${T.overviewBg};border:1px solid ${T.rb};border-radius:14px;
      padding:16px 18px;font-size:14px;color:${T.ink};line-height:1.9;margin-top:12px}

    /* Pros/Cons */
    .procon{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:14px}
    @media(max-width:500px){.procon{grid-template-columns:1fr}}
    .pro-box{background:rgba(15,169,104,0.06);border:1px solid rgba(15,169,104,0.18);border-radius:12px;padding:14px}
    .con-box{background:rgba(220,38,38,0.05);border:1px solid rgba(220,38,38,0.16);border-radius:12px;padding:14px}
    .procon-title{font-size:11px;font-weight:800;letter-spacing:1px;text-transform:uppercase;margin-bottom:10px}
    .pro-title{color:#0FA968}
    .con-title{color:#DC2626}
    .pro-item,.con-item{font-size:13px;color:${T.ink};margin-bottom:7px;line-height:1.55;
      display:flex;gap:7px;align-items:flex-start}

    /* Key Points */
    .kp{background:${T.s2};border:1px solid ${T.border};border-radius:14px;padding:16px;
      margin-bottom:10px;display:flex;gap:14px;align-items:flex-start}
    .kp-n{font-size:24px;font-weight:750;
      color:${T.kpNum};flex-shrink:0;line-height:1}
    .kp-title{font-size:14px;font-weight:700;color:${T.ink};margin-bottom:4px}
    .kp-detail{font-size:13px;color:${T.ink2};line-height:1.65}

    /* Chapters */
    .chapter{display:flex;gap:12px;align-items:flex-start;background:${T.s2};
      border:1px solid ${T.border};border-radius:12px;padding:13px;margin-bottom:9px;transition:border-color .2s}
    .chapter:hover{border-color:${T.borderHover}}
    .ch-time{background:${T.grad};color:#fff;padding:4px 10px;border-radius:7px;
      font-size:11px;font-weight:800;flex-shrink:0;margin-top:2px}
    .ch-title{font-size:14px;font-weight:700;color:${T.ink};margin-bottom:3px}
    .ch-sum{font-size:12px;color:${T.ink2};line-height:1.55}

    /* Quotes */
    .quote{border-left:3px solid ${T.accent};padding:12px 16px;background:${T.overviewBg};
      border-radius:0 12px 12px 0;font-size:13px;color:${T.ink2};font-style:italic;
      line-height:1.8;margin-bottom:10px;cursor:pointer;transition:border-color .2s}
    .quote:hover{border-color:${T.accent2}}

    /* Actions */
    .action-item{display:flex;gap:12px;align-items:flex-start;background:${T.actionBg};
      border:1px solid ${T.actionBorder};border-radius:12px;padding:12px 14px;
      margin-bottom:8px;font-size:13px;color:${T.ink};line-height:1.6}
    .ai-dot{color:#0FA968;font-size:16px;flex-shrink:0;margin-top:1px}

    /* Verdict */
    .verdict-box{background:${T.verdictBg};border:1px solid ${T.border};
      border-radius:20px;padding:28px;text-align:center}
    .verdict-score{font-size:60px;font-weight:800;
      background:${T.grad};-webkit-background-clip:text;-webkit-text-fill-color:transparent;
      line-height:1.1;margin-bottom:10px}
    .verdict-short{font-size:16px;font-weight:750;color:${T.accent2};margin-bottom:12px}
    .verdict-text{font-size:14px;color:${T.ink2};line-height:1.85;max-width:560px;margin:0 auto}

    /* Pills */
    .pill{display:inline-flex;align-items:center;gap:4px;background:${T.chipBg};
      border:1px solid ${T.chipBorder};color:${T.chipColor};
      padding:4px 12px;border-radius:100px;font-size:11px;font-weight:700}
    .pills{display:flex;flex-wrap:wrap;gap:7px;margin-top:13px}

    /* Chat */
    .chat-wrap{display:flex;flex-direction:column;height:460px}
    .chat-ctx{background:${T.overviewBg};border:1px solid ${T.rb};border-radius:12px;
      padding:10px 14px;margin-bottom:12px;font-size:12px;color:${T.accent2};
      display:flex;align-items:center;gap:7px}
    .chat-msgs{flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:10px;
      margin-bottom:12px;scrollbar-width:thin;scrollbar-color:${T.scroll} transparent;padding-right:4px}
    .msg{max-width:82%;animation:fadeUp .25s ease}
    .msg-user{align-self:flex-end}
    .msg-ai{align-self:flex-start}
    .msg-bubble{padding:11px 15px;border-radius:16px;font-size:13px;line-height:1.75}
    .msg-user .msg-bubble{background:${T.chatUser};color:#fff;border-bottom-right-radius:4px}
    .msg-ai .msg-bubble{background:${T.s2};border:1px solid ${T.border};color:${T.ink};border-bottom-left-radius:4px}
    .msg-time{font-size:10px;color:${T.ink3};margin-top:3px;text-align:right;padding:0 3px}
    .msg-ai .msg-time{text-align:left}
    .typing{display:flex;align-items:center;gap:4px;padding:12px 15px;
      background:${T.s2};border:1px solid ${T.border};border-radius:16px;border-bottom-left-radius:4px;width:fit-content}
    .tdot{width:6px;height:6px;background:${T.accent2};border-radius:50%;animation:bars .85s ease-in-out infinite}
    .tdot:nth-child(2){animation-delay:.15s}
    .tdot:nth-child(3){animation-delay:.3s}
    .chat-inp{flex:1;background:${T.inputBg};border:1.5px solid ${T.inputBorder};border-radius:14px;
      padding:11px 15px;color:${T.ink};font-size:14px;
      font-family:'Inter',sans-serif;outline:none;transition:all .2s;resize:none}
    .chat-inp:focus{border-color:${T.inputFocusBorder};box-shadow:${T.inputFocusShadow}}
    .chat-inp::placeholder{color:${T.ink3}}
    .chat-send{background:${T.grad};border:none;width:42px;height:42px;border-radius:14px;
      cursor:pointer;font-size:16px;transition:all .2s;flex-shrink:0;
      display:flex;align-items:center;justify-content:center;color:#fff}
    .chat-send:hover:not(:disabled){transform:scale(1.05)}
    .chat-send:disabled{opacity:.4;cursor:not-allowed}
    .chat-bar{display:flex;gap:8px}
    .chat-sugs{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px}
    .chat-sug{background:${T.inputBg};border:1.5px solid ${T.inputBorder};border-radius:100px;
      padding:6px 12px;font-size:11px;font-weight:600;color:${T.ink2};cursor:pointer;
      font-family:'Inter',sans-serif;transition:all .2s}
    .chat-sug:hover{border-color:${T.borderHover};color:${T.accent2}}

    /* Toast */
    .toast{position:fixed;bottom:24px;right:24px;z-index:9999;background:${T.toastBg};
      color:${T.toastColor};font-weight:800;padding:12px 20px;border-radius:100px;
      font-size:13px;animation:fadeUp .3s ease;box-shadow:0 8px 24px rgba(0,0,0,.18)}

    .result-wrap{animation:fadeUp .5s ease}

    /* ── MOBILE ── */
    @media(max-width:500px){
      .hdr{padding:8px 14px !important;}
      .logo-icon{width:30px;height:30px;font-size:14px;}
      .logo-text{font-size:13px;}
      .back-btn{padding:5px 10px !important;font-size:11px !important;}
      .main{padding:28px 12px 80px;}
      .card{padding:18px;}
      .vid-meta{padding:12px 14px 16px;}
      .vid-title{font-size:15px;}
      .sec{padding:16px;}
      .verdict-score{font-size:48px;}
    }
  `;

  const TABS = [
    { id: 'summary',  label: '📋 Summary' },
    { id: 'points',   label: '🎯 Key Points' },
    { id: 'chapters', label: '📑 Chapters' },
    { id: 'quotes',   label: '💬 Quotes' },
    { id: 'actions',  label: '✅ Actions' },
    { id: 'verdict',  label: '🏆 Verdict' },
    { id: 'chat',     label: '💬 Chat' },
  ];

  return (
    <>

      <Helmet>
        <title>YouTube Summarizer — Instant Video Summaries | MK AI</title>
        <meta name="description" content="Get instant YouTube video summaries with AI chat, powered by MK AI." />
      </Helmet>
      <style>{CSS}</style>
      <div className="wrap">
        <div className="amb">
          <div className="orb o1"/><div className="orb o2"/><div className="orb o3"/>
        </div>
        <div className="grid-bg"/>

        {/* ── Header ── */}
        <header className="hdr">
          <div className="logo">
            <div className="logo-icon">▶️</div>
            <span className="logo-text">YT Summarizer</span>
          </div>
          <div className="hdr-r">
            <button className="back-btn" onClick={() => navigate('/')}>← Back</button>
          </div>
        </header>

        <main className="main">

          {/* Hero */}
          {!result && !loading && (
            <div className="hero">
              <div className="hero-chip">
                <div className="hero-dot"/>
                <span className="hero-chip-txt">Powered by Gemini AI</span>
              </div>
              <h1 className="hero-h">
                Any Video.<br/>
                <span className="hero-span">Understood Instantly.</span>
              </h1>
              <p className="hero-sub">Paste a YouTube URL — Gemini AI analyzes the full video and gives you a summary, chapters, quotes, and action items. Chat with it too.</p>
            </div>
          )}

          {/* Input */}
          {!result && !loading && (
            <div className="card">
              <div className="card-title">🎬 YouTube Video URL</div>
              <div className="card-sub">Paste any YouTube link to get started</div>

              <div className="url-wrap">
                <span className="url-icon">🔗</span>
                <input className="url-inp"
                  placeholder="https://youtube.com/watch?v=..."
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && summarize()}
                />
              </div>

              {liveVid && (
                <div className="thumb-preview">
                  <img src={thumbUrl(liveVid)} alt="thumb"
                    onError={e => { e.target.src = thumbUrl(liveVid, 'mqdefault'); }}/>
                  <div className="thumb-overlay">
                    <a href={watchUrl(liveVid)} target="_blank" rel="noreferrer" className="thumb-open">
                      ▶ Watch on YouTube
                    </a>
                  </div>
                </div>
              )}

              <div className="two">
                <div>
                  <label className="lbl">Summary Depth</label>
                  <div className="opts">
                    {['Brief', 'Detailed', 'Comprehensive'].map(t => (
                      <button key={t} className={`opt ${sumType === t ? 'on' : ''}`} onClick={() => setSumType(t)}>{t}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="lbl">Language</label>
                  <div className="opts">
                    {['English', 'Hindi', 'Hinglish'].map(l => (
                      <button key={l} className={`opt ${lang === l ? 'on' : ''}`} onClick={() => setLang(l)}>{l}</button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="btn-row">
                <button className="btn btn-main" disabled={!url.trim()} onClick={summarize}>
                  🚀 Summarize Video
                </button>
              </div>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="load-card">
              <span className="load-icon">🤖</span>
              <div className="load-title">Gemini is analyzing the video…</div>
              <div className="load-sub">Reading through the full content — this takes a moment</div>
              <div className="load-steps">
                {LOAD_STEPS.map((s, i) => (
                  <div key={i} className={`load-step ${i < loadStep ? 'done' : i === loadStep ? 'active' : ''}`}>
                    {i < loadStep ? '✅ ' : i === loadStep ? '⏳ ' : '⬜ '}{s}
                  </div>
                ))}
              </div>
              <div className="load-bar"><div className="load-fill"/></div>
            </div>
          )}

          {/* Result */}
          {result && !loading && (
            <div className="result-wrap">

              {/* Video Card */}
              <div className="vid-card">
                <div className="vid-thumb">
                  <img src={thumbUrl(videoId)} alt="thumb"
                    onError={e => { e.target.src = thumbUrl(videoId, 'mqdefault'); }}/>
                  <div className="vid-thumb-overlay"/>
                  <a href={watchUrl(videoId)} target="_blank" rel="noreferrer" className="vid-play">▶</a>
                </div>
                <div className="vid-meta">
                  <div className="vid-title">{result.title}</div>
                  <div className="vid-ch">
                    <span>📺 {result.channel || 'YouTube Channel'}</span>
                    {result.duration_estimate && <span style={{color:T.ink3}}>· ⏱ {result.duration_estimate}</span>}
                    {result.language && <span style={{color:T.ink3}}>· 🌐 {result.language}</span>}
                  </div>
                  <div className="vid-tags">
                    {(result.tags || []).map((t, i) => <span key={i} className="vid-tag">#{t}</span>)}
                  </div>
                  <div className="vid-rating">⭐ {result.rating || 'N/A'} · {result.verdict_short || 'See Verdict'}</div>
                </div>
              </div>

              {/* Action Bar */}
              <div className="act-bar">
                <button className="btn btn-ghost btn-sm" onClick={() => { setResult(null); setUrl(''); }}>← New Video</button>
                <button className="btn btn-pdf btn-sm" onClick={() => { exportPDF(result, videoId); showToast('Opening PDF…'); }}>📄 Export PDF</button>
                <button className="btn btn-ghost btn-sm" onClick={() => copy(result.overview)}>📋 Copy Overview</button>
              </div>

              {/* Tabs */}
              <div className="tabs">
                {TABS.map(t => (
                  <button key={t.id} className={`tab ${activeTab === t.id ? 'on' : 'off'}`}
                    onClick={() => setTab(t.id)}>{t.label}</button>
                ))}
              </div>

              {/* ── Summary Tab ── */}
              {activeTab === 'summary' && (
                <>
                  <div className="sec">
                    <div className="sec-title">📋 Overview</div>
                    <div className="overview-box">{result.overview}</div>
                    <div className="pills">
                      {result.topic && <span className="pill">🎬 {result.topic}</span>}
                      {result.target_audience && <span className="pill">👥 {result.target_audience}</span>}
                      {result.duration_estimate && <span className="pill">⏱ {result.duration_estimate}</span>}
                    </div>
                    {(result.pros?.length || result.cons?.length) && (
                      <div className="procon">
                        {result.pros?.length > 0 && (
                          <div className="pro-box">
                            <div className="procon-title pro-title">✅ Pros</div>
                            {result.pros.map((p, i) => <div key={i} className="pro-item"><span>▸</span>{p}</div>)}
                          </div>
                        )}
                        {result.cons?.length > 0 && (
                          <div className="con-box">
                            <div className="procon-title con-title">⚠️ Cons</div>
                            {result.cons.map((c, i) => <div key={i} className="con-item"><span>▸</span>{c}</div>)}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  {result.key_points?.slice(0, 3).map((kp, i) => (
                    <div key={i} className="kp">
                      <span className="kp-n">{String(i+1).padStart(2,'0')}</span>
                      <div>
                        <div className="kp-title">{kp.point}</div>
                        <div className="kp-detail">{kp.detail}</div>
                      </div>
                    </div>
                  ))}
                  {result.key_points?.length > 3 && (
                    <button className="btn btn-ghost btn-sm" onClick={() => setTab('points')}
                      style={{width:'100%',marginTop:4}}>
                      View {result.key_points.length - 3} more key points →
                    </button>
                  )}
                </>
              )}

              {/* ── Key Points Tab ── */}
              {activeTab === 'points' && (
                <div className="sec">
                  <div className="sec-head">
                    <div className="sec-title">🎯 Key Points</div>
                    <span className="sec-badge">{result.key_points?.length || 0} points</span>
                  </div>
                  {(result.key_points || []).map((kp, i) => (
                    <div key={i} className="kp">
                      <span className="kp-n">{String(i+1).padStart(2,'0')}</span>
                      <div>
                        <div className="kp-title">{kp.point}</div>
                        <div className="kp-detail">{kp.detail}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* ── Chapters Tab ── */}
              {activeTab === 'chapters' && (
                <div className="sec">
                  <div className="sec-head">
                    <div className="sec-title">📑 Video Chapters</div>
                    <span className="sec-badge">{result.chapters?.length || 0} chapters</span>
                  </div>
                  {(result.chapters || []).map((c, i) => (
                    <div key={i} className="chapter">
                      <span className="ch-time">{c.time}</span>
                      <div>
                        <div className="ch-title">{c.title}</div>
                        <div className="ch-sum">{c.summary}</div>
                      </div>
                    </div>
                  ))}
                  {(!result.chapters || result.chapters.length === 0) && (
                    <p style={{color:T.ink2,fontSize:13}}>No chapters were detected for this video.</p>
                  )}
                </div>
              )}

              {/* ── Quotes Tab ── */}
              {activeTab === 'quotes' && (
                <div className="sec">
                  <div className="sec-head">
                    <div className="sec-title">💬 Notable Quotes</div>
                    <span className="sec-badge">{result.important_quotes?.length || 0} quotes</span>
                  </div>
                  {(result.important_quotes || []).map((q, i) => (
                    <div key={i} className="quote" onClick={() => copy(q)}>
                      "{q}"
                      <span style={{fontSize:10,color:T.ink3,marginLeft:7,fontStyle:'normal'}}>(click to copy)</span>
                    </div>
                  ))}
                  {(!result.important_quotes || result.important_quotes.length === 0) && (
                    <p style={{color:T.ink2,fontSize:13}}>No notable quotes were found for this video.</p>
                  )}
                </div>
              )}

              {/* ── Actions Tab ── */}
              {activeTab === 'actions' && (
                <div className="sec">
                  <div className="sec-head">
                    <div className="sec-title">✅ Action Items</div>
                    <span className="sec-badge">{result.action_items?.length || 0} items</span>
                  </div>
                  {(result.action_items || []).map((a, i) => (
                    <div key={i} className="action-item">
                      <span className="ai-dot">☑</span>{a}
                    </div>
                  ))}
                </div>
              )}

              {/* ── Verdict Tab ── */}
              {activeTab === 'verdict' && (
                <>
                  <div className="verdict-box">
                    <div className="verdict-score">{result.rating || '?'}</div>
                    <div className="verdict-short">{result.verdict_short}</div>
                    <div className="verdict-text">{result.verdict}</div>
                  </div>
                  {result.target_audience && (
                    <div className="sec" style={{marginTop:12}}>
                      <div className="sec-title">👥 Who should watch this?</div>
                      <p style={{fontSize:14,color:T.ink2,marginTop:10,lineHeight:1.75}}>{result.target_audience}</p>
                    </div>
                  )}
                </>
              )}

              {/* ── Chat Tab ── */}
              {activeTab === 'chat' && (
                <div className="sec">
                  <div className="sec-head">
                    <div className="sec-title">💬 Chat about this Video</div>
                    <span className="sec-badge">Gemini AI</span>
                  </div>

                  <div className="chat-ctx">
                    🎬 Ask anything about <strong style={{color:T.ink}}>{result.title}</strong>
                  </div>

                  <div className="chat-wrap">
                    <div className="chat-msgs">
                      {msgs.map((m, i) => (
                        <div key={i} className={`msg msg-${m.role}`}>
                          <div className="msg-bubble"
                            dangerouslySetInnerHTML={{ __html: fmt(m.text) }}/>
                          {m.time && <div className="msg-time">{m.time}</div>}
                        </div>
                      ))}
                      {chatLoad && (
                        <div className="msg msg-ai">
                          <div className="typing">
                            <div className="tdot"/><div className="tdot"/><div className="tdot"/>
                          </div>
                        </div>
                      )}
                      <div ref={msgsEnd}/>
                    </div>

                    {msgs.length <= 1 && (
                      <div className="chat-sugs">
                        {SUGGESTIONS.map((s, i) => (
                          <button key={i} className="chat-sug" onClick={() => sendChat(s)}>{s}</button>
                        ))}
                      </div>
                    )}

                    <div className="chat-bar">
                      <textarea ref={chatRef} className="chat-inp" rows={1}
                        placeholder="Ask anything about this video…"
                        value={chatInp}
                        onChange={e => setChatInp(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); } }}
                        style={{minHeight:42,maxHeight:110}}
                      />
                      <button className="chat-send" onClick={() => sendChat()}
                        disabled={!chatInp.trim() || chatLoad}>
                        {chatLoad ? <div className="spin"/> : '➤'}
                      </button>
                    </div>
                    <div style={{fontSize:11,color:T.ink3,marginTop:6}}>Enter to send · Shift+Enter for new line</div>
                  </div>
                </div>
              )}

            </div>
          )}
        </main>

        {toast && <div className="toast">✅ {toast}</div>}
      </div>
    </>
  );
}