import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import jsPDF from 'jspdf';
import PptxGenJS from 'pptxgenjs';
import { Helmet } from 'react-helmet-async';

// ═══════════════════════════════════════════════════════════════════════
//  BACKEND — your deployed Render service
// ═══════════════════════════════════════════════════════════════════════
const BACKEND_BASE = 'https://mkai-backend.onrender.com';
const AURA_API = `${BACKEND_BASE}/api/aura`;

// ═══════════════════════════════════════════════════════════════════════
//  AI PROVIDERS — same fallback pattern as AuraTransform.jsx
//  (kept identical so both tools behave the same way in production)
// ═══════════════════════════════════════════════════════════════════════
const AI_PROVIDERS = [
  { name: 'GeneralCompute', url: 'https://api.generalcompute.com/v1/chat/completions', key: 'YOUR_API_KEY_PLACEHOLDER', model: 'gpt-oss-120b', type: 'openai' },
  { name: 'Groq', url: 'https://api.groq.com/openai/v1/chat/completions', key: 'YOUR_API_KEY_PLACEHOLDER', model: 'qwen/qwen3-32b', type: 'openai' },
  { name: 'Cohere', url: 'https://api.cohere.com/v2/chat', key: 'YOUR_API_KEY_PLACEHOLDER', model: 'command-r-plus', type: 'cohere' },
  { name: 'Mistral', url: 'https://api.mistral.ai/v1/chat/completions', key: 'YOUR_API_KEY_PLACEHOLDER', model: 'mistral-large-latest', type: 'openai' },
  { name: 'Novita', url: 'https://api.novita.ai/v3/openai/chat/completions', key: 'YOUR_API_KEY_PLACEHOLDER', model: 'meta-llama/llama-3.3-70b-instruct', type: 'openai' },
  { name: 'DeepInfra', url: 'https://api.deepinfra.com/v1/openai/chat/completions', key: 'YOUR_API_KEY_PLACEHOLDER', model: 'meta-llama/Llama-3.3-70B-Instruct', type: 'openai' },
  { name: 'SambaNova', url: 'https://api.sambanova.ai/v1/chat/completions', key: 'YOUR_API_KEY_PLACEHOLDER', model: 'Meta-Llama-3.3-70B-Instruct', type: 'openai' },
  { name: 'OpenRouter', url: 'https://openrouter.ai/api/v1/chat/completions', key: 'YOUR_API_KEY_PLACEHOLDER', model: 'meta-llama/llama-3.3-70b-instruct', type: 'openai', extraHeaders: { 'HTTP-Referer': 'https://totus.tech', 'X-Title': 'MKAI' } },
];
const PRIMARY_PROVIDER_NAME = 'GeneralCompute';
let rrIndex = 0;
const failCounts = Object.fromEntries(AI_PROVIDERS.map((p) => [p.name, 0]));
const MAX_FAILS = 3;

function getNextProvider() {
  const fallbacks = AI_PROVIDERS.filter((p) => p.name !== PRIMARY_PROVIDER_NAME);
  const total = fallbacks.length;
  for (let i = 0; i < total; i++) {
    const p = fallbacks[rrIndex % total];
    rrIndex++;
    if (failCounts[p.name] < MAX_FAILS) return p;
  }
  AI_PROVIDERS.forEach((p) => { failCounts[p.name] = 0; });
  rrIndex = 0;
  return AI_PROVIDERS[0];
}

async function callProviderOnce(provider, messages, maxTokens) {
  if (provider.type === 'cohere') {
    const system = messages.find((m) => m.role === 'system');
    const chat = messages.filter((m) => m.role !== 'system');
    const res = await fetch(provider.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${provider.key}` },
      body: JSON.stringify({
        model: provider.model,
        preamble: system?.content || '',
        chat_history: chat.slice(0, -1).map((m) => ({ role: m.role === 'user' ? 'USER' : 'CHATBOT', message: m.content })),
        message: chat[chat.length - 1]?.content || '',
        max_tokens: maxTokens,
        temperature: 0.3,
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
    body: JSON.stringify({ model: provider.model, messages, max_tokens: maxTokens, temperature: 0.3 }),
  });
  if (!res.ok) throw new Error(`${provider.name} HTTP ${res.status}`);
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error(`${provider.name} empty`);
  return text;
}

async function callAI(messages, maxTokens = 1200) {
  const tried = new Set();
  const primary = AI_PROVIDERS.find((p) => p.name === PRIMARY_PROVIDER_NAME) || AI_PROVIDERS[0];
  if (failCounts[primary.name] < MAX_FAILS) {
    tried.add(primary.name);
    try {
      const text = await callProviderOnce(primary, messages, maxTokens);
      failCounts[primary.name] = 0;
      return text;
    } catch { failCounts[primary.name]++; }
  }
  for (let attempt = 0; attempt < AI_PROVIDERS.length; attempt++) {
    const provider = getNextProvider();
    if (tried.has(provider.name)) continue;
    tried.add(provider.name);
    try {
      const text = await callProviderOnce(provider, messages, maxTokens);
      failCounts[provider.name] = 0;
      return text;
    } catch { failCounts[provider.name]++; }
  }
  throw new Error('All AI providers failed. Please try again.');
}

// ═══════════════════════════════════════════════════════════════════════
//  THEME — matches the MK AI palette used on Home.jsx (emerald / sky / gold)
// ═══════════════════════════════════════════════════════════════════════
const T = {
  bg: '#f6faf7',
  bgGrad: 'radial-gradient(ellipse 900px 500px at 10% -10%, rgba(15,169,104,.10), transparent), radial-gradient(ellipse 700px 500px at 100% 10%, rgba(21,150,214,.08), transparent), #f6faf7',
  glass: 'rgba(255,254,251,.72)',
  glassBorder: 'rgba(255,255,255,.68)',
  navy: '#0E77AC',
  purple: '#0FA968',
  purpleSoft: 'rgba(15,169,104,.10)',
  navySoft: 'rgba(21,150,214,.08)',
  grad: 'linear-gradient(135deg,#0FA968,#1596D6)',
  ink: '#122420',
  inkSoft: '#5c6b64',
  inkMuted: '#7b877f',
  border: 'rgba(18,54,42,.10)',
  card: '#fffefb',
  emerald: '#0FA968',
  emeraldSoft: 'rgba(15,169,104,.10)',
  amber: '#F2A93B',
  amberSoft: 'rgba(242,169,59,.12)',
  red: '#B5503F',
  redSoft: 'rgba(181,80,63,.10)',
  shadow: '0 24px 70px rgba(15,90,70,.10)',
};

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700&display=swap');
*{box-sizing:border-box;}
@keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
@keyframes glow{0%,100%{opacity:.35}50%{opacity:.7}}
@keyframes popIn{from{opacity:0;transform:scale(.92)}to{opacity:1;transform:scale(1)}}
.ws-orb{position:absolute;border-radius:50%;filter:blur(90px);animation:glow 7s ease-in-out infinite;pointer-events:none;}
.ws-card{background:${T.glass};backdrop-filter:blur(18px) saturate(160%);-webkit-backdrop-filter:blur(18px) saturate(160%);border:1px solid ${T.glassBorder};border-radius:20px;box-shadow:${T.shadow};}
.ws-btn{transition:transform .18s ease,box-shadow .18s ease,opacity .18s ease;}
.ws-btn:hover{transform:translateY(-2px);}
.ws-btn:active{transform:translateY(0) scale(.98);}
.ws-row{animation:fadeUp .4s ease both;}
`;

// ═══════════════════════════════════════════════════════════════════════
//  RELATIONSHIP GRAPH — same node-link SVG style as AuraTransform's KnowledgeGraph
// ═══════════════════════════════════════════════════════════════════════
function RelationshipGraph({ entities = [], relationships = [] }) {
  const [hovered, setHovered] = useState(null);
  if (!entities.length) {
    return <p style={{ color: T.inkMuted, fontSize: 13, textAlign: 'center', padding: 30 }}>No entities extracted from this capture.</p>;
  }
  const size = 420;
  const cx = size / 2, cy = size / 2, r = size / 2 - 70;
  const positions = {};
  entities.forEach((name, i) => {
    const angle = (2 * Math.PI * i) / entities.length - Math.PI / 2;
    positions[name] = { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
  });
  const isConnected = (name) => hovered && relationships.some((e) => (e.from === hovered && e.to === name) || (e.to === hovered && e.from === name) || hovered === name);

  return (
    <svg viewBox={`0 0 ${size} ${size}`} style={{ width: '100%', maxWidth: size, display: 'block', margin: '0 auto' }}>
      {relationships.map((e, i) => {
        const a = positions[e.from], b = positions[e.to];
        if (!a || !b) return null;
        const active = !hovered || hovered === e.from || hovered === e.to;
        return (
          <g key={i} opacity={active ? 1 : 0.15}>
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={T.purple} strokeWidth={1.5} />
            <text x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 - 4} fontSize={9} fill={T.inkMuted} textAnchor="middle">{e.label}</text>
          </g>
        );
      })}
      {entities.map((name) => {
        const p = positions[name];
        const active = !hovered || isConnected(name);
        return (
          <g key={name} opacity={active ? 1 : 0.25} style={{ cursor: 'pointer' }}
             onMouseEnter={() => setHovered(name)} onMouseLeave={() => setHovered(null)}>
            <circle cx={p.x} cy={p.y} r={26} fill="#fff" stroke={T.navy} strokeWidth={2} />
            <text x={p.x} y={p.y + 42} fontSize={11} fontWeight={600} fill={T.ink} textAnchor="middle">
              {name.length > 16 ? name.slice(0, 14) + '…' : name}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  SUMMARIZATION — direct client-side AI call, same pattern as AuraTransform
// ═══════════════════════════════════════════════════════════════════════
async function summarizeCapture(record) {
  const rawText = [
    `Title: ${record.title}`,
    `URL: ${record.url}`,
    `Headings: ${(record.dom?.headings || []).join(' | ')}`,
    `Paragraphs: ${(record.dom?.paragraphs || []).join('\n')}`,
    record.dom?.tables?.length ? `Tables: ${JSON.stringify(record.dom.tables).slice(0, 2000)}` : '',
    record.ocrText ? `OCR Text: ${record.ocrText}` : '',
  ].filter(Boolean).join('\n\n').slice(0, 12000);

  const raw = await callAI([
    { role: 'system', content: 'You are an intelligence analyst reviewing captured web content. Respond ONLY as valid JSON, no markdown fences, no preamble: {"summary":"one paragraph executive summary","keyPoints":["short bullet","short bullet"],"entities":["entity name","entity name"],"relationships":[{"from":"entity A","to":"entity B","label":"relation"}]}' },
    { role: 'user', content: rawText },
  ], 1000);
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Could not parse a summary from this capture.');
  return JSON.parse(match[0]);
}

// ═══════════════════════════════════════════════════════════════════════
//  EXPORTS
// ═══════════════════════════════════════════════════════════════════════
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

function exportJson(record, analysis) {
  downloadBlob(new Blob([JSON.stringify({ record, analysis }, null, 2)], { type: 'application/json' }), `web-scraping-${record.id}.json`);
}

function exportPdf(record, analysis) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210, M = 16;
  let y = 0;
  const rgb = (hex) => { const h = hex.replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; };
  const EMERALD = '0FA968', SKY = '1596D6', GOLD = 'F2A93B', BG = '0B1A15';

  const newPage = () => {
    doc.addPage();
    doc.setFillColor(...rgb(BG)); doc.rect(0, 0, W, 297, 'F');
    doc.setFillColor(...rgb(EMERALD)); doc.rect(0, 0, W, 8, 'F');
    doc.setTextColor(...rgb(GOLD)); doc.setFontSize(7); doc.setFont('helvetica', 'bold');
    doc.text('WEB SCRAPING — MKAI', M, 6);
    doc.setTextColor(150, 150, 170);
    doc.text(new Date().toLocaleDateString(), W - M, 6, { align: 'right' });
    y = 18;
  };
  const chk = (n = 16) => { if (y + n > 275) newPage(); };
  const heading = (text, color = EMERALD) => {
    chk(12); doc.setFillColor(...rgb(color)); doc.rect(M, y - 4, W - M * 2, 9, 'F');
    doc.setTextColor(255, 255, 255); doc.setFontSize(10); doc.setFont('helvetica', 'bold');
    doc.text(text, M + 4, y + 1.5); y += 13;
  };
  const para = (text, color = 'C7D9D2') => {
    if (!text) return;
    doc.setTextColor(...rgb(color)); doc.setFontSize(10); doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(String(text), W - M * 2);
    chk(lines.length * 5 + 4); doc.text(lines, M, y); y += lines.length * 5 + 4;
  };
  const bullet = (items = []) => {
    items.forEach((item) => {
      chk(7); doc.setFillColor(...rgb(EMERALD)); doc.circle(M + 2.5, y - 1, 1.2, 'F');
      doc.setTextColor(...rgb('C7D9D2')); doc.setFontSize(9.5);
      const lines = doc.splitTextToSize(String(item), W - M * 2 - 8);
      doc.text(lines, M + 7, y); y += lines.length * 5 + 2;
    }); y += 2;
  };

  doc.setFillColor(...rgb(BG)); doc.rect(0, 0, W, 297, 'F');
  doc.setFillColor(...rgb(EMERALD)); doc.rect(0, 0, 6, 297, 'F');
  doc.setTextColor(...rgb(GOLD)); doc.setFontSize(9); doc.setFont('helvetica', 'bold');
  doc.text('WEB SCRAPING · MKAI', 16, 35);
  doc.setFillColor(...rgb(GOLD)); doc.rect(16, 38, 80, 0.6, 'F');
  doc.setTextColor(240, 250, 245); doc.setFontSize(24); doc.setFont('helvetica', 'bold');
  const titleLines = doc.splitTextToSize((record.title || 'Captured Page').toUpperCase(), 175);
  doc.text(titleLines, 16, 58);
  doc.setTextColor(...rgb('9CC7B7')); doc.setFontSize(11); doc.setFont('helvetica', 'normal');
  doc.text('Source URL: ' + (record.url || ''), 16, 58 + titleLines.length * 13 + 8);
  doc.setTextColor(...rgb('557F6E')); doc.setFontSize(8);
  doc.text('Generated by MKAI Web Scraping | ' + new Date().toLocaleDateString(), 16, 275);

  newPage();
  heading('SUMMARY', EMERALD);
  para(analysis.summary);
  heading('KEY POINTS', SKY);
  bullet(analysis.keyPoints || []);
  doc.save(`web-scraping-${record.id}.pdf`);
}

async function exportPpt(record, analysis) {
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';
  const bg = '0B1A15', card = '112A22', accent = '2FD98F', sub = 'A8D0C2', text = 'FFFFFF';

  const title = pptx.addSlide();
  title.background = { fill: bg };
  title.addText('WEB SCRAPING · MKAI', { x: 4.3, y: 0.4, w: 4.73, h: 0.42, fontSize: 10, bold: true, color: accent, align: 'center', valign: 'middle' });
  title.addText(record.title || 'Captured Page', { x: 0.8, y: 1.4, w: 11.73, h: 2, fontSize: 40, bold: true, color: text, align: 'center', wrap: true, fontFace: 'Calibri' });
  title.addText(record.url || '', { x: 1, y: 3.4, w: 11.33, h: 0.5, fontSize: 13, color: sub, align: 'center' });

  const summarySlide = pptx.addSlide();
  summarySlide.background = { fill: bg };
  summarySlide.addText('Summary', { x: 0.3, y: 0.15, w: 12.73, h: 0.7, fontSize: 28, bold: true, color: text, fontFace: 'Calibri' });
  summarySlide.addShape(pptx.ShapeType.roundRect, { x: 0.3, y: 1.15, w: 12.73, h: 3, fill: { type: 'solid', color: card }, line: { color: accent, width: 2 }, rectRadius: 0.14 });
  summarySlide.addText(analysis.summary || '', { x: 0.6, y: 1.35, w: 12.13, h: 2.6, fontSize: 15, color: text, valign: 'top', wrap: true });

  const pointsSlide = pptx.addSlide();
  pointsSlide.background = { fill: bg };
  pointsSlide.addText('Key Points', { x: 0.3, y: 0.15, w: 12.73, h: 0.7, fontSize: 28, bold: true, color: text, fontFace: 'Calibri' });
  pointsSlide.addText(
    (analysis.keyPoints || []).map((p) => ({ text: p, options: { bullet: true } })),
    { x: 0.5, y: 1.1, fontSize: 15, color: text, w: 12, h: 4.5 }
  );

  await pptx.writeFile({ fileName: `web-scraping-${record.id}.pptx` });
}

// ═══════════════════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════
export default function WebScraping() {
  const navigate = useNavigate();
  const [captures, setCaptures] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [record, setRecord] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [stage, setStage] = useState(null); // null | loading | analyze | done
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState('');

  const refreshList = useCallback(async () => {
    try {
      const res = await fetch(`${AURA_API}/latest`);
      const data = await res.json();
      setCaptures(data.captures || []);
    } catch { /* backend may be cold-starting on Render free tier */ }
  }, []);

  useEffect(() => {
    refreshList();
    const interval = setInterval(refreshList, 5000);
    return () => clearInterval(interval);
  }, [refreshList]);

  const selectCapture = async (id) => {
    setSelectedId(id);
    setAnalysis(null);
    setError('');
    setStage('loading');
    try {
      const res = await fetch(`${AURA_API}/${id}`);
      const data = await res.json();
      setRecord(data);
      setStage(null);
    } catch (e) {
      setError('Could not load this capture — is the backend awake?');
      setStage(null);
    }
  };

  const generate = async () => {
    if (!record) return;
    setError('');
    setStage('analyze');
    try {
      const result = await summarizeCapture(record);
      setAnalysis(result);
      setStage('done');
    } catch (e) {
      setError(e.message);
      setStage(null);
    }
  };

  const doExport = async (type) => {
    setExporting(type);
    try {
      if (type === 'pdf') exportPdf(record, analysis);
      else if (type === 'ppt') await exportPpt(record, analysis);
      else if (type === 'json') exportJson(record, analysis);
    } catch (e) {
      setError(`Export failed: ${e.message}`);
    } finally {
      setExporting('');
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: T.bgGrad, color: T.ink, fontFamily: "'Inter',sans-serif", position: 'relative', overflowX: 'hidden' }}>

      <Helmet>
        <title>Web Scraping — Auto-Build Reports from Any Page | MK AI</title>
        <meta name="description" content="Capture any webpage and auto-build reports, presentations, and graphs with MK AI's Web Scraping tool." />
      </Helmet>
      <style>{CSS}</style>
      <div className="ws-orb" style={{ width: 460, height: 460, top: -160, left: -140, background: T.purple, opacity: 0.14 }} />
      <div className="ws-orb" style={{ width: 360, height: 360, bottom: -120, right: -100, background: T.navy, opacity: 0.10, animationDelay: '3s' }} />

      <header style={{ position: 'sticky', top: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 26px', background: 'rgba(246,250,247,.85)', backdropFilter: 'blur(16px)', borderBottom: `1px solid ${T.border}` }}>
        <button className="ws-btn" style={{ background: 'transparent', border: `1px solid ${T.border}`, color: T.inkSoft, padding: '8px 16px', borderRadius: 20, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }} onClick={() => navigate('/')}>← Back</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 20 }}>🌐</span>
          <span style={{ fontFamily: "'Sora',sans-serif", fontSize: 16, fontWeight: 700, color: T.ink }}>Web Scraping</span>
        </div>
        <span style={{ fontSize: 11, color: T.inkMuted }}>Powered by AURA extension</span>
      </header>

      <main style={{ maxWidth: 1000, margin: '0 auto', padding: '44px 22px 90px', position: 'relative', zIndex: 1 }}>
        <div style={{ textAlign: 'center', marginBottom: 34, animation: 'fadeUp .5s ease' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: T.purpleSoft, border: '1px solid rgba(15,169,104,.2)', padding: '6px 16px', borderRadius: 100, fontSize: 12, fontWeight: 600, color: T.purple, marginBottom: 18 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: T.purple, animation: 'glow 2s ease infinite' }} />
            SIH26171 · Visual Perception Browser Agent
          </div>
          <h1 style={{ fontFamily: "'Sora',sans-serif", fontSize: 'clamp(30px,4vw,44px)', fontWeight: 700, margin: '0 0 12px', letterSpacing: '-0.02em' }}>
            Capture any page, <span style={{ color: T.purple }}>auto-build</span> the report
          </h1>
          <p style={{ color: T.inkSoft, fontSize: 15.5, maxWidth: 580, margin: '0 auto' }}>
            Use the AURA browser extension on any webpage — it pushes structured data here, where it's summarized into a brief with entities, relationships, and export-ready PDF/PPT/JSON.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 20 }}>
          <div className="ws-card" style={{ padding: 18, alignSelf: 'start' }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: T.inkMuted, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 12 }}>Recent Captures</p>
            {captures.length === 0 && <p style={{ color: T.inkMuted, fontSize: 12.5 }}>No captures yet — open the extension popup on any page and hit "Capture &amp; Send".</p>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {captures.map((c) => (
                <div key={c.id} className="ws-row" onClick={() => selectCapture(c.id)} style={{
                  padding: 12, borderRadius: 12, cursor: 'pointer',
                  background: selectedId === c.id ? T.purpleSoft : 'rgba(255,255,255,.5)',
                  border: `1px solid ${selectedId === c.id ? T.purple : T.border}`,
                }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: T.ink }}>{c.title || c.url}</div>
                  <div style={{ fontSize: 11, color: T.inkMuted, marginTop: 2 }}>{new Date(c.capturedAt).toLocaleString()}</div>
                </div>
              ))}
            </div>
          </div>

          <div>
            {!record && !error && <p style={{ color: T.inkMuted, fontSize: 13.5, textAlign: 'center', marginTop: 40 }}>Select a capture on the left to get started.</p>}
            {error && <p style={{ color: T.red, fontSize: 13, marginBottom: 14 }}>⚠ {error}</p>}

            {record && (
              <div className="ws-card" style={{ padding: 22, animation: 'popIn .35s ease' }}>
                <p style={{ fontSize: 15, fontWeight: 700, color: T.ink, margin: '0 0 4px' }}>{record.title}</p>
                <a href={record.url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: T.purple }}>{record.url}</a>

                <button className="ws-btn" onClick={generate} disabled={stage === 'analyze'} style={{
                  display: 'block', marginTop: 16, background: T.grad, color: '#fff', border: 'none', padding: '11px 22px',
                  borderRadius: 30, cursor: 'pointer', fontSize: 13.5, fontWeight: 700, fontFamily: 'inherit', opacity: stage === 'analyze' ? 0.6 : 1,
                }}>{stage === 'analyze' ? 'Analyzing…' : '🪄 Generate Report'}</button>

                {analysis && (
                  <div style={{ marginTop: 26 }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: T.inkMuted, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 8 }}>Summary</p>
                    <p style={{ fontSize: 14, lineHeight: 1.7, color: T.ink }}>{analysis.summary}</p>

                    <p style={{ fontSize: 11, fontWeight: 700, color: T.inkMuted, letterSpacing: 0.5, textTransform: 'uppercase', margin: '18px 0 8px' }}>Key Points</p>
                    <ul style={{ margin: 0, paddingLeft: 18 }}>
                      {(analysis.keyPoints || []).map((p, i) => (
                        <li key={i} style={{ fontSize: 13.5, color: T.inkSoft, marginBottom: 6, lineHeight: 1.6 }}>{p}</li>
                      ))}
                    </ul>

                    <p style={{ fontSize: 11, fontWeight: 700, color: T.inkMuted, letterSpacing: 0.5, textTransform: 'uppercase', margin: '20px 0 8px' }}>Relationship Graph</p>
                    <RelationshipGraph entities={analysis.entities} relationships={analysis.relationships} />

                    <div style={{ display: 'flex', gap: 10, marginTop: 22, flexWrap: 'wrap' }}>
                      {[{ id: 'pdf', label: '📄 PDF' }, { id: 'ppt', label: '📊 Slide deck' }, { id: 'json', label: '{ } JSON' }].map((btn) => (
                        <button key={btn.id} className="ws-btn" onClick={() => doExport(btn.id)} disabled={exporting === btn.id} style={{
                          background: 'rgba(18,54,42,.05)', color: T.ink, border: `1px solid ${T.border}`, padding: '9px 18px',
                          borderRadius: 20, cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', opacity: exporting === btn.id ? 0.6 : 1,
                        }}>{exporting === btn.id ? 'Exporting…' : btn.label}</button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}