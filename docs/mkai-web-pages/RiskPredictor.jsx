import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler,
} from 'chart.js';
import {
  LIGHT, DARK, baseCss, logFlowRun,
} from '../lib/mkaiCore';
import { Helmet } from 'react-helmet-async';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler);

const ACCENT = '#EF4444';

// ═══════════════════════════════════════════════════════════════
//  WARNING: API keys are hardcoded here.
//  Before sharing this file or uploading to GitHub,
//  ALWAYS regenerate these keys from their respective dashboards.
//  Keys rotate automatically — if one fails, the next one is used.
// ═══════════════════════════════════════════════════════════════
const PROVIDERS = [
  {
    name: 'GeneralCompute',
    url: 'https://api.generalcompute.com/v1/chat/completions',
    key: 'YOUR_API_KEY_PLACEHOLDER', // <-- General Compute API key
    model: 'gpt-oss-120b', // top GPT model on the platform — used first, always
    type: 'openai',
  },
  {
    name: 'OpenRouter',
    url: 'https://openrouter.ai/api/v1/chat/completions',
    key: 'YOUR_API_KEY_PLACEHOLDER',
    model: 'meta-llama/llama-3.3-70b-instruct',
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
    name: 'DeepInfra',
    url: 'https://api.deepinfra.com/v1/openai/chat/completions',
    key: 'YOUR_API_KEY_PLACEHOLDER',
    model: 'meta-llama/Llama-3.3-70B-Instruct',
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
    name: 'Mistral',
    url: 'https://api.mistral.ai/v1/chat/completions',
    key: 'YOUR_API_KEY_PLACEHOLDER',
    model: 'mistral-large-latest',
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
    name: 'Groq',
    url: 'https://api.groq.com/openai/v1/chat/completions',
    key: 'YOUR_API_KEY_PLACEHOLDER', // <-- apni Groq API key yaha daal de
    model: 'qwen/qwen3-32b',
    type: 'openai',
  },
];

// GeneralCompute is ALWAYS tried first on every call, same pattern as chat.jsx.
// Only if it fails MAX_FAILS times in a row does the round-robin fallback kick in.
const PRIMARY_PROVIDER_NAME = 'GeneralCompute';

let rrIndex = 0;
const failCounts = Object.fromEntries(PROVIDERS.map(p => [p.name, 0]));
const MAX_FAILS = 3;

function getNextProvider() {
  const fallbacks = PROVIDERS.filter(p => p.name !== PRIMARY_PROVIDER_NAME);
  const total = fallbacks.length;
  for (let i = 0; i < total; i++) {
    const p = fallbacks[rrIndex % total];
    rrIndex++;
    if (failCounts[p.name] < MAX_FAILS) return p;
  }
  PROVIDERS.forEach(p => { failCounts[p.name] = 0; });
  rrIndex = 0;
  return fallbacks[0];
}

async function callProvider(provider, messages, signal) {
  let body, headers;

  headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${provider.key}`,
    ...(provider.name === 'OpenRouter' ? {
      'HTTP-Referer': 'https://mkai.tech',
      'X-Title': 'MK-AI',
    } : {}),
  };

  if (provider.type === 'cohere') {
    const system = messages.find(m => m.role === 'system');
    const chat = messages.filter(m => m.role !== 'system');
    body = {
      model: provider.model,
      preamble: system?.content || '',
      chat_history: chat.slice(0, -1).map(m => ({
        role: m.role === 'user' ? 'USER' : 'CHATBOT',
        message: m.content,
      })),
      message: chat[chat.length - 1]?.content || '',
      max_tokens: 2200,
      temperature: 0.6,
    };
  } else {
    body = {
      model: provider.model,
      messages,
      max_tokens: 2200,
      temperature: 0.6,
    };
  }

  const res = await fetch(provider.url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) throw new Error(`${provider.name} HTTP ${res.status}`);
  const data = await res.json();

  if (provider.type === 'cohere') {
    const text = data?.text || data?.message?.content?.[0]?.text;
    if (!text) throw new Error('Cohere empty response');
    return { text, providerName: provider.name };
  } else {
    const text = data?.choices?.[0]?.message?.content;
    if (!text) throw new Error(`${provider.name} empty response`);
    return { text, providerName: provider.name };
  }
}

async function callWithFallback(messages, signal) {
  const tried = new Set();
  const primary = PROVIDERS.find(p => p.name === PRIMARY_PROVIDER_NAME) || PROVIDERS[0];

  // STEP 1 — GeneralCompute always tried first, every single call.
  if (failCounts[primary.name] < MAX_FAILS) {
    tried.add(primary.name);
    try {
      const result = await callProvider(primary, messages, signal);
      failCounts[primary.name] = 0;
      return result;
    } catch (err) {
      if (err.name === 'AbortError') throw err;
      failCounts[primary.name]++;
      console.warn(`[MK-AI] ${primary.name} failed (${failCounts[primary.name]}) [PRIMARY]:`, err.message);
    }
  }

  // STEP 2 — fallback round-robin through the rest of the providers
  for (let attempt = 0; attempt < PROVIDERS.length; attempt++) {
    const provider = getNextProvider();
    if (tried.has(provider.name)) continue;
    tried.add(provider.name);
    try {
      const result = await callProvider(provider, messages, signal);
      failCounts[provider.name] = 0;
      return result;
    } catch (err) {
      if (err.name === 'AbortError') throw err;
      failCounts[provider.name]++;
      console.warn(`[MK-AI] ${provider.name} failed (${failCounts[provider.name]}):`, err.message);
    }
  }

  PROVIDERS.forEach(p => { failCounts[p.name] = 0; });
  rrIndex = 0;
  throw new Error('All providers failed');
}

// Pulls a clean JSON object out of a model response, even if it wrapped
// the JSON in markdown fences or added stray text around it.
function extractJSON(text) {
  let cleaned = text.trim().replace(/```json/gi, '').replace(/```/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) {
    throw new Error('No JSON found in AI response');
  }
  cleaned = cleaned.slice(start, end + 1);
  return JSON.parse(cleaned);
}

function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}

// ══════════════════════════════════════════════════════════════
// CORE FUNCTION — callable directly by MK Flow
// ══════════════════════════════════════════════════════════════
export async function predictRisk(dataText, context = 'business') {
  const system = `You are a risk/anomaly analyst. Given raw numeric or descriptive data (sales figures,
expenses, usage logs, metrics over time), detect patterns and predict risk. Return STRICT JSON only, no
markdown, no preamble:
{
 "riskScore": 0-100,
 "riskLevel": "Low" | "Medium" | "High" | "Critical",
 "trend": [ { "label": "short x-axis label e.g. Week 1", "value": number } ],
 "findings": [ { "title": "short finding", "detail": "1-2 sentence explanation of the pattern/anomaly", "severity": "high|medium|low" } ],
 "recommendation": "2-3 sentence concrete recommendation",
 "emailSubject": "short email subject line reporting this risk to a manager",
 "emailBody": "professional 4-6 sentence email body summarising the risk and recommendation, addressed to 'Team' or 'Boss'"
}
Reconstruct a reasonable numeric trend (8-12 points) from the data even if the input is descriptive text —
extrapolate sensibly. Be specific with numbers where possible.`;

  const userPrompt = `Context: ${context}\n\nData:\n${dataText.slice(0, 5000)}`;

  const messages = [
    { role: 'system', content: system },
    { role: 'user', content: userPrompt },
  ];

  const { text } = await callWithFallback(messages);
  const result = extractJSON(text);
  if (!result.trend || !result.findings) throw new Error('Could not analyze this data');
  result.context = context;
  return result;
}

// ══════════════════════════════════════════════════════════════
// PPT EXPORT — multi-page, designed report (title, exec summary,
// trend, findings, recommendation, email draft, closing)
// ══════════════════════════════════════════════════════════════
const RISK_LEVEL_COLORS = { Low: '22C55E', Medium: 'F59E0B', High: 'EF4444', Critical: 'B91C1C' };
const SEVERITY_COLORS = { high: 'EF4444', medium: 'F59E0B', low: '22C55E' };

export async function exportRiskPPT(result, filename = 'risk-report.pptx') {
  const pptxgen = (await import('pptxgenjs')).default;
  const pres = new pptxgen();
  pres.defineLayout({ name: 'MK', width: 10, height: 5.63 });
  pres.layout = 'MK';

  const NAVY = '0B1220';
  const NAVY2 = '141F35';
  const OFFWHITE = 'F8FAFC';
  const WHITE = 'FFFFFF';
  const MUTED = '64748B';
  const INK = '1E293B';
  const BORDER = 'E2E8F0';
  const HEAD_FONT = 'Cambria';
  const BODY_FONT = 'Calibri';
  const riskColor = RISK_LEVEL_COLORS[result.riskLevel] || 'EF4444';
  const cardShadow = () => ({ type: 'outer', color: '1E293B', opacity: 0.12, blur: 6, offset: 2, angle: 90 });

  const footer = (slide) => {
    slide.addText('Generated automatically by MK Flow  ·  Zero human touch', {
      x: 0.6, y: 5.28, w: 8.8, h: 0.25, fontFace: BODY_FONT, fontSize: 8.5,
      italic: true, color: '94A3B8', margin: 0,
    });
  };

  // ── Slide 1 — Title ──────────────────────────────────────────
  const s1 = pres.addSlide();
  s1.background = { color: NAVY };
  s1.addShape(pres.ShapeType.ellipse, { x: 7.3, y: -1.6, w: 4.4, h: 4.4, fill: { color: NAVY2 }, line: { type: 'none' } });
  s1.addShape(pres.ShapeType.ellipse, { x: -1.8, y: 3.9, w: 3.4, h: 3.4, fill: { color: NAVY2 }, line: { type: 'none' } });
  s1.addText('RISK & ANOMALY REPORT', { x: 0.6, y: 1.35, w: 8.8, fontFace: BODY_FONT, fontSize: 12, bold: true, color: riskColor, charSpacing: 3, margin: 0 });
  s1.addText(`${result.context ? result.context.charAt(0).toUpperCase() + result.context.slice(1) : 'Business'} Risk Analysis`, {
    x: 0.6, y: 1.65, w: 8.8, h: 1.0, fontFace: HEAD_FONT, fontSize: 34, bold: true, color: WHITE, margin: 0,
  });
  s1.addText('AI-generated pattern detection and anomaly scoring', { x: 0.6, y: 2.55, w: 8.8, fontFace: BODY_FONT, fontSize: 13, color: 'CBD5E1', margin: 0 });

  s1.addShape(pres.ShapeType.roundRect, { x: 0.6, y: 3.15, w: 2.7, h: 1.2, rectRadius: 0.12, fill: { color: NAVY2 }, line: { color: riskColor, width: 1 } });
  s1.addText(String(result.riskScore), { x: 0.6, y: 3.22, w: 2.7, h: 0.68, align: 'center', valign: 'middle', fontFace: HEAD_FONT, fontSize: 32, bold: true, color: riskColor, margin: 0 });
  s1.addText('RISK SCORE / 100', { x: 0.6, y: 3.9, w: 2.7, h: 0.32, align: 'center', fontFace: BODY_FONT, fontSize: 9, bold: true, color: 'CBD5E1', margin: 0, charSpacing: 1 });

  s1.addShape(pres.ShapeType.roundRect, { x: 3.5, y: 3.15, w: 2.7, h: 1.2, rectRadius: 0.12, fill: { color: riskColor }, line: { type: 'none' } });
  s1.addText(result.riskLevel.toUpperCase(), { x: 3.5, y: 3.35, w: 2.7, h: 0.6, align: 'center', valign: 'middle', fontFace: HEAD_FONT, fontSize: 18, bold: true, color: WHITE, margin: 0 });
  s1.addText('RISK LEVEL', { x: 3.5, y: 3.9, w: 2.7, h: 0.32, align: 'center', fontFace: BODY_FONT, fontSize: 9, bold: true, color: WHITE, margin: 0, charSpacing: 1 });

  footer(s1);

  // ── Slide 2 — Executive Summary ─────────────────────────────
  const s2 = pres.addSlide();
  s2.background = { color: OFFWHITE };
  s2.addText('Executive Summary', { x: 0.6, y: 0.45, w: 8.8, fontFace: HEAD_FONT, fontSize: 26, bold: true, color: NAVY, margin: 0 });
  s2.addText(`Context: ${result.context || 'Business data'}`, { x: 0.6, y: 0.98, w: 8.8, fontFace: BODY_FONT, fontSize: 12, color: MUTED, margin: 0 });

  const highCount = result.findings.filter((f) => f.severity === 'high').length;
  const stats = [
    { label: 'RISK SCORE', value: String(result.riskScore), color: riskColor },
    { label: 'RISK LEVEL', value: result.riskLevel.toUpperCase(), color: riskColor },
    { label: 'TOTAL FINDINGS', value: String(result.findings.length), color: NAVY },
    { label: 'HIGH SEVERITY', value: String(highCount), color: SEVERITY_COLORS.high },
  ];
  const cardW = 4.0, cardH = 1.5, gapX = 0.4, gapY = 0.32, startX = 0.6, startY = 1.55;
  stats.forEach((st, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = startX + col * (cardW + gapX);
    const y = startY + row * (cardH + gapY);
    s2.addShape(pres.ShapeType.roundRect, { x, y, w: cardW, h: cardH, rectRadius: 0.1, fill: { color: WHITE }, line: { color: BORDER, width: 1 }, shadow: cardShadow() });
    s2.addText(st.value, { x, y: y + 0.2, w: cardW, h: 0.65, align: 'center', fontFace: HEAD_FONT, fontSize: 28, bold: true, color: st.color, margin: 0 });
    s2.addText(st.label, { x, y: y + 0.98, w: cardW, h: 0.32, align: 'center', fontFace: BODY_FONT, fontSize: 10, bold: true, color: MUTED, margin: 0, charSpacing: 1 });
  });
  footer(s2);

  // ── Slide 3 — Trend ──────────────────────────────────────────
  const s3 = pres.addSlide();
  s3.background = { color: WHITE };
  s3.addText('Trend Analysis', { x: 0.5, y: 0.35, w: 9, fontFace: HEAD_FONT, fontSize: 24, bold: true, color: NAVY, margin: 0 });
  s3.addText(`${result.trend.length} data points reconstructed from the input`, { x: 0.5, y: 0.85, w: 9, fontFace: BODY_FONT, fontSize: 11, color: MUTED, margin: 0 });
  s3.addChart(pres.ChartType.line, [
    { name: 'Value', labels: result.trend.map((t) => t.label), values: result.trend.map((t) => t.value) },
  ], {
    x: 0.5, y: 1.35, w: 9.0, h: 3.95,
    chartColors: [riskColor],
    showTitle: false,
    showLegend: false,
    showValue: true,
    dataLabelColor: NAVY,
    dataLabelFontSize: 9,
    dataLabelFontFace: BODY_FONT,
    lineDataSymbol: 'circle',
    lineDataSymbolSize: 6,
    lineSize: 3,
    catAxisLabelColor: MUTED,
    catAxisLabelFontSize: 10,
    catAxisLabelFontFace: BODY_FONT,
    valAxisLabelColor: MUTED,
    valAxisLabelFontSize: 10,
    valAxisLabelFontFace: BODY_FONT,
    valGridLine: { color: BORDER, size: 1 },
    catGridLine: { style: 'none' },
  });

  // ── Findings — chunked 3 per slide, color-coded by severity ──
  const findingChunks = chunkArray(result.findings, 3);
  findingChunks.forEach((chunk, ci) => {
    const s = pres.addSlide();
    s.background = { color: OFFWHITE };
    const heading = findingChunks.length > 1 ? `Key Findings  (${ci + 1}/${findingChunks.length})` : 'Key Findings';
    s.addText(heading, { x: 0.6, y: 0.42, w: 8.8, fontFace: HEAD_FONT, fontSize: 24, bold: true, color: NAVY, margin: 0 });

    let y = 1.15;
    chunk.forEach((f) => {
      const sevColor = SEVERITY_COLORS[f.severity] || MUTED;
      s.addShape(pres.ShapeType.roundRect, { x: 0.6, y, w: 8.8, h: 1.15, rectRadius: 0.1, fill: { color: WHITE }, line: { color: BORDER, width: 1 }, shadow: cardShadow() });
      s.addShape(pres.ShapeType.ellipse, { x: 0.88, y: y + 0.3, w: 0.55, h: 0.55, fill: { color: sevColor }, line: { type: 'none' } });
      s.addText((f.severity || 'low').charAt(0).toUpperCase(), { x: 0.88, y: y + 0.3, w: 0.55, h: 0.55, align: 'center', valign: 'middle', fontFace: HEAD_FONT, fontSize: 16, bold: true, color: WHITE, margin: 0 });
      s.addText(f.title, { x: 1.68, y: y + 0.14, w: 7.55, h: 0.4, fontFace: BODY_FONT, fontSize: 14, bold: true, color: NAVY, margin: 0 });
      s.addText(f.detail, { x: 1.68, y: y + 0.55, w: 7.55, h: 0.55, fontFace: BODY_FONT, fontSize: 11, color: MUTED, margin: 0 });
      y += 1.35;
    });
    footer(s);
  });

  // ── Recommendation ───────────────────────────────────────────
  const sRec = pres.addSlide();
  sRec.background = { color: NAVY };
  sRec.addShape(pres.ShapeType.ellipse, { x: -1.6, y: -1.6, w: 3.8, h: 3.8, fill: { color: NAVY2 }, line: { type: 'none' } });
  sRec.addText('RECOMMENDATION', { x: 0.6, y: 0.75, w: 8.8, fontFace: BODY_FONT, fontSize: 12, bold: true, color: riskColor, charSpacing: 3, margin: 0 });
  sRec.addText(result.recommendation, { x: 0.6, y: 1.35, w: 8.8, h: 3.0, fontFace: HEAD_FONT, fontSize: 22, italic: true, color: WHITE, margin: 0 });
  footer(sRec);

  // ── Suggested Email ──────────────────────────────────────────
  const sEmail = pres.addSlide();
  sEmail.background = { color: OFFWHITE };
  sEmail.addText('Suggested Report Email', { x: 0.6, y: 0.4, w: 8.8, fontFace: HEAD_FONT, fontSize: 24, bold: true, color: NAVY, margin: 0 });
  sEmail.addShape(pres.ShapeType.roundRect, { x: 0.6, y: 1.05, w: 8.8, h: 3.9, rectRadius: 0.12, fill: { color: WHITE }, line: { color: BORDER, width: 1 }, shadow: cardShadow() });
  sEmail.addText('SUBJECT', { x: 0.95, y: 1.3, w: 8.1, fontFace: BODY_FONT, fontSize: 9, bold: true, color: MUTED, margin: 0, charSpacing: 1 });
  sEmail.addText(result.emailSubject, { x: 0.95, y: 1.58, w: 8.1, fontFace: BODY_FONT, fontSize: 15, bold: true, color: NAVY, margin: 0 });
  sEmail.addText('MESSAGE', { x: 0.95, y: 2.15, w: 8.1, fontFace: BODY_FONT, fontSize: 9, bold: true, color: MUTED, margin: 0, charSpacing: 1 });
  sEmail.addText(result.emailBody, { x: 0.95, y: 2.43, w: 8.1, h: 2.4, fontFace: BODY_FONT, fontSize: 12.5, color: INK, margin: 0 });
  footer(sEmail);

  // ── Closing ───────────────────────────────────────────────────
  const sEnd = pres.addSlide();
  sEnd.background = { color: NAVY };
  sEnd.addShape(pres.ShapeType.ellipse, { x: 7.2, y: 3.0, w: 4.2, h: 4.2, fill: { color: NAVY2 }, line: { type: 'none' } });
  sEnd.addText('Thank you', { x: 0.6, y: 2.05, w: 8.8, fontFace: HEAD_FONT, fontSize: 34, bold: true, color: WHITE, margin: 0 });
  sEnd.addText('MK Risk Predictor — turning raw data into decisions, automatically.', { x: 0.6, y: 2.8, w: 8.0, fontFace: BODY_FONT, fontSize: 13, color: 'CBD5E1', margin: 0 });
  footer(sEnd);

  await pres.writeFile({ fileName: filename });
}

// ══════════════════════════════════════════════════════════════
// UI COMPONENT
// ══════════════════════════════════════════════════════════════
export default function RiskPredictor() {
  // ── Single liquid-glass theme — dark mode removed, matches Burnout Predictor ──
  const T = LIGHT;

  const [context, setContext] = useState('Sales / Revenue');
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = baseCss(T, ACCENT);
    document.head.appendChild(style);
    return () => style.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const run = async () => {
    if (!input.trim()) return;
    setLoading(true); setError(''); setResult(null);
    try {
      const r = await predictRisk(input, context);
      setResult(r);
      logFlowRun({ tool: 'Risk Predictor', label: `${r.riskLevel} risk detected (score ${r.riskScore})`, ok: true });
    } catch (err) {
      setError(err.message || 'Could not analyze this data.');
      logFlowRun({ tool: 'Risk Predictor', label: 'Analysis failed', ok: false });
    } finally {
      setLoading(false);
    }
  };

  const copyEmail = () => {
    if (!result) return;
    navigator.clipboard.writeText(`Subject: ${result.emailSubject}\n\n${result.emailBody}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const levelColor = { Low: DARK.green, Medium: DARK.amber, High: ACCENT, Critical: '#B91C1C' };

  const chartData = result ? {
    labels: result.trend.map((t) => t.label),
    datasets: [{
      data: result.trend.map((t) => t.value),
      borderColor: ACCENT, backgroundColor: `${ACCENT}22`, fill: true, tension: 0.35, pointRadius: 3,
    }],
  } : null;

  return (
    <div style={{ minHeight: '100vh', background: T.bg, color: T.text }}>

      <Helmet>
        <title>Risk Predictor — Detect Anomalies & Risk | MK AI</title>
        <meta name="description" content="Detect risk and anomalies in your data, and auto-build PPT and email reports with AI." />
      </Helmet>
      <header style={{ position: 'sticky', top: 0, zIndex: 20, background: 'rgba(246,250,247,.92)', borderBottom: `1px solid ${T.border}`, backdropFilter: 'blur(10px)' }}>
        <div style={{ maxWidth: 1180, margin: '0 auto', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <Link to="/" style={{ fontSize: 13, color: T.muted, fontWeight: 600 }}>← Home</Link>
            <span style={{ fontSize: 18, fontWeight: 800, color: ACCENT }}>🧠 Risk Predictor</span>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 900, margin: '0 auto', padding: '40px 20px 90px' }}>
        <h1 style={{ fontSize: 30, fontWeight: 900, marginBottom: 8 }}>
          Spot risk before it becomes a problem — <span style={{ color: ACCENT }}>then auto-report it</span>
        </h1>
        <p style={{ color: T.muted, fontSize: 14.5, marginBottom: 22, maxWidth: 640, lineHeight: 1.6 }}>
          Paste any numeric/descriptive data. AI detects the pattern, scores the risk, and can turn the
          result into a PPT + email draft automatically — zero human touch reporting.
        </p>

        <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
          {['Sales / Revenue', 'Expenses', 'Website Traffic', 'Server / Uptime', 'Attendance', 'Custom'].map((c) => (
            <button key={c} onClick={() => setContext(c)} style={{
              padding: '7px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer',
              border: `1px solid ${context === c ? ACCENT : T.border}`,
              background: context === c ? `${ACCENT}18` : T.inputBg,
              color: context === c ? ACCENT : T.muted,
            }}>{c}</button>
          ))}
        </div>

        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={7}
          placeholder="e.g. Week 1: ₹42,000  Week 2: ₹39,500  Week 3: ₹31,000  Week 4: ₹28,200 — or describe the situation in plain text"
          style={{ width: '100%', padding: 16, borderRadius: 12, background: T.inputBg, border: `1px solid ${T.border}`, color: T.text, fontSize: 13.5, resize: 'vertical', outline: 'none', marginBottom: 14 }}
        />

        <button onClick={run} disabled={loading} style={{ padding: '13px 24px', borderRadius: 12, border: 'none', fontWeight: 800, fontSize: 13.5, background: ACCENT, color: '#fff', cursor: 'pointer', opacity: loading ? .6 : 1, marginBottom: 24 }}>
          {loading ? 'Analyzing…' : 'Predict Risk 🧠'}
        </button>

        {error && (
          <div style={{ padding: 16, borderRadius: 12, background: `${DARK.red}15`, border: `1px solid ${DARK.red}44`, color: DARK.red, fontSize: 13.5, marginBottom: 20 }}>
            ⚠️ {error}
          </div>
        )}

        {result && (
          <div>
            <div style={{ display: 'flex', gap: 14, marginBottom: 20, alignItems: 'center' }}>
              <div style={{ background: T.s1, border: `1px solid ${T.border}`, borderRadius: 14, padding: '16px 22px', textAlign: 'center' }}>
                <div style={{ fontSize: 30, fontWeight: 900, color: levelColor[result.riskLevel] || ACCENT }}>{result.riskScore}</div>
                <div style={{ fontSize: 10.5, color: T.muted, fontWeight: 700 }}>RISK SCORE</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: T.muted, fontWeight: 700, marginBottom: 4 }}>RISK LEVEL</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: levelColor[result.riskLevel] || ACCENT }}>{result.riskLevel}</div>
              </div>
            </div>

            <div style={{ background: T.s1, border: `1px solid ${T.border}`, borderRadius: 14, padding: 18, marginBottom: 18, height: 240 }}>
              <Line data={chartData} options={{
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                  x: { ticks: { color: T.muted, font: { size: 10 } }, grid: { color: T.border2 } },
                  y: { ticks: { color: T.muted, font: { size: 10 } }, grid: { color: T.border2 } },
                },
              }} />
            </div>

            <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 10 }}>KEY FINDINGS</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 18 }}>
              {result.findings.map((f, i) => (
                <div key={i} style={{ background: T.s1, border: `1px solid ${T.border}`, borderRadius: 12, padding: 14 }}>
                  <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 3 }}>{f.title}</div>
                  <div style={{ fontSize: 12.5, color: T.muted }}>{f.detail}</div>
                </div>
              ))}
            </div>

            <div style={{ background: `${ACCENT}0F`, border: `1px solid ${ACCENT}33`, borderRadius: 14, padding: 18, marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: ACCENT, marginBottom: 6 }}>RECOMMENDATION</div>
              <div style={{ fontSize: 14, lineHeight: 1.6 }}>{result.recommendation}</div>
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button onClick={() => exportRiskPPT(result)} style={{ padding: '12px 20px', borderRadius: 12, border: 'none', background: ACCENT, color: '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>
                📊 Auto-Generate PPT Report
              </button>
              <button onClick={copyEmail} style={{ padding: '12px 20px', borderRadius: 12, border: `1px solid ${T.border}`, background: T.inputBg, color: T.text, fontWeight: 800, fontSize: 13 }}>
                {copied ? '✓ Copied!' : '✉️ Copy Boss Email Draft'}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}