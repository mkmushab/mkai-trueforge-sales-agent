import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import pptxgen from 'pptxgenjs';
import { Helmet } from 'react-helmet-async';

// ═══════════════════════════════════════════════════════════════════════
//  MULTI-PROVIDER AI — Round-Robin with Auto-Fallback
// ═══════════════════════════════════════════════════════════════════════
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
    key: 'YOUR_API_KEY_PLACEHOLDER',
    model: 'qwen/qwen3-32b',
    type: 'openai',
  },
  {
    name: "Cohere",
    url:  "https://api.cohere.com/v2/chat",
    key:  "YOUR_API_KEY_PLACEHOLDER",
    model:"command-r-plus",
    type: "cohere",
  },
  {
    name: "Mistral",
    url:  "https://api.mistral.ai/v1/chat/completions",
    key:  "YOUR_API_KEY_PLACEHOLDER",
    model:"mistral-large-latest",
    type: "openai",
  },
  {
    name: "Novita",
    url:  "https://api.novita.ai/v3/openai/chat/completions",
    key:  "YOUR_API_KEY_PLACEHOLDER",
    model:"meta-llama/llama-3.3-70b-instruct",
    type: "openai",
  },
  {
    name: "DeepInfra",
    url:  "https://api.deepinfra.com/v1/openai/chat/completions",
    key:  "YOUR_API_KEY_PLACEHOLDER",
    model:"meta-llama/Llama-3.3-70B-Instruct",
    type: "openai",
  },
  {
    name: "SambaNova",
    url:  "https://api.sambanova.ai/v1/chat/completions",
    key:  "YOUR_API_KEY_PLACEHOLDER",
    model:"Meta-Llama-3.3-70B-Instruct",
    type: "openai",
  },
  {
    name: "OpenRouter",
    url:  "https://openrouter.ai/api/v1/chat/completions",
    key:  "YOUR_API_KEY_PLACEHOLDER",
    model:"meta-llama/llama-3.3-70b-instruct",
    type: "openai",
    extraHeaders: { "HTTP-Referer": "https://mkai.tech", "X-Title": "MK-AI" },
  },
  ];

let pptRRIndex = 0;
const pptFailCounts = Object.fromEntries(AI_PROVIDERS.map(p => [p.name, 0]));
const PPT_MAX_FAILS = 3;
const PRIMARY_PROVIDER_NAME = 'GeneralCompute'; // <-- always tried first

function getNextAIProvider() {
  const fallbacks = AI_PROVIDERS.filter(p => p.name !== PRIMARY_PROVIDER_NAME);
  const total = fallbacks.length;
  for (let i = 0; i < total; i++) {
    const p = fallbacks[pptRRIndex % total];
    pptRRIndex++;
    if (pptFailCounts[p.name] < PPT_MAX_FAILS) return p;
  }
  AI_PROVIDERS.forEach(p => { pptFailCounts[p.name] = 0; });
  pptRRIndex = 0;
  return AI_PROVIDERS[0];
}

async function callAIProvider(provider, messages, maxTokens) {
  if (provider.type === 'railway') {
    const res = await fetch(provider.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: provider.model, messages, max_tokens: maxTokens, temperature: 0.6 }),
    });
    if (!res.ok) throw new Error(`Railway HTTP ${res.status}`);
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content;
    if (!text) throw new Error('Railway empty response');
    return text;
  }

  if (provider.type === 'cohere') {
    const system = messages.find(m => m.role === 'system');
    const chat   = messages.filter(m => m.role !== 'system');
    const res = await fetch(provider.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${provider.key}`,
      },
      body: JSON.stringify({
        model: provider.model,
        preamble: system?.content || '',
        chat_history: chat.slice(0, -1).map(m => ({
          role: m.role === 'user' ? 'USER' : 'CHATBOT',
          message: m.content,
        })),
        message: chat[chat.length - 1]?.content || '',
        max_tokens: maxTokens,
        temperature: 0.6,
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
      'Authorization': `Bearer ${provider.key}`,
      ...(provider.extraHeaders || {}),
    },
    body: JSON.stringify({
      model: provider.model,
      messages,
      max_tokens: maxTokens,
      temperature: 0.6,
    }),
  });
  if (!res.ok) throw new Error(`${provider.name} HTTP ${res.status}`);
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error(`${provider.name} empty response`);
  return text;
}

async function callAIWithFallback(messages, maxTokens) {
  const tried = new Set();
  const primary = AI_PROVIDERS.find(p => p.name === PRIMARY_PROVIDER_NAME) || AI_PROVIDERS[0];

  if (pptFailCounts[primary.name] < PPT_MAX_FAILS) {
    tried.add(primary.name);
    try {
      console.log(`[PPT] Trying ${primary.name} (${primary.model}) [PRIMARY]`);
      const text = await callAIProvider(primary, messages, maxTokens);
      pptFailCounts[primary.name] = 0;
      console.log(`[PPT] ✅ ${primary.name} success`);
      return text;
    } catch (err) {
      pptFailCounts[primary.name]++;
      console.warn(`[PPT] ❌ ${primary.name} failed (${pptFailCounts[primary.name]}): ${err.message}`);
    }
  }

  for (let attempt = 0; attempt < AI_PROVIDERS.length; attempt++) {
    const provider = getNextAIProvider();
    if (tried.has(provider.name)) continue;
    tried.add(provider.name);
    try {
      console.log(`[PPT] Trying ${provider.name} (${provider.model})`);
      const text = await callAIProvider(provider, messages, maxTokens);
      pptFailCounts[provider.name] = 0;
      console.log(`[PPT] ✅ ${provider.name} success`);
      return text;
    } catch (err) {
      pptFailCounts[provider.name]++;
      console.warn(`[PPT] ❌ ${provider.name} failed (${pptFailCounts[provider.name]}): ${err.message}`);
    }
  }

  AI_PROVIDERS.forEach(p => { pptFailCounts[p.name] = 0; });
  pptRRIndex = 0;
  throw new Error('All AI providers failed. Please try again in a moment.');
}

// ─── BRAND THEME (single, fixed — matches the MK-AI site palette) ─────────────
// Emerald / sky-blue / saffron on a deep forest base, so every generated deck
// looks like it belongs to mkai.tech. No picker, no randomness.
const BRAND_THEME = { bg: '0A1F17', card: '0F2A1E', accent: '0FA968', accent2: '1596D6', text: 'FFFFFF', sub: '9FD9BE' };
const CARD_ACCENTS = ['0FA968', '1596D6', 'F2A93B', '0C8457', '17B890', '0E77AC'];

const hex = (h) => ({ type: 'solid', color: h });

const SLIDE_SIZES = [
  { key: 'short',  label: '⚡ Short',  desc: 'Quick',     slides: 7,    range: '5-8'   },
  { key: 'medium', label: '📋 Medium', desc: 'Balanced',  slides: 15,   range: '10-20' },
  { key: 'long',   label: '📚 Long',   desc: 'Detailed',  slides: 28,   range: '20-40' },
  { key: 'custom', label: '🎛️ Custom', desc: 'Exact',     slides: null, range: 'You'   },
];

// ─── UI THEME TOKENS — same palette as Home.jsx (emerald / mint / sky / gold) ──
const T = {
  bg:'#f6faf7', panel:'#e4f3ea', panel2:'#eef8f2',
  ink:'#122420', muted:'#5c6b64',
  emerald:'#0FA968', emerald2:'#0C8457',
  sky:'#1596D6', sky2:'#0E77AC',
  gold:'#F2A93B',
  mint:'#cdeedd', white:'#fffefb',
  line:'rgba(18,54,42,.10)',
  shadow:'0 24px 70px rgba(15,90,70,.10)',
  glassBg:'linear-gradient(135deg, rgba(255,255,255,.62), rgba(255,255,255,.22))',
  glassBorder:'rgba(255,255,255,.68)',
  glassShadow:'0 10px 34px rgba(15,90,70,.14), inset 0 1px 0 rgba(255,255,255,.55)',
  errorBg:'rgba(220,60,60,.08)', errorBorder:'rgba(220,60,60,.28)', errorColor:'#B23B3B',
  successBg:'rgba(15,169,104,.08)', successBorder:'rgba(15,169,104,.26)', successColor:'#0C8457',
};

const GRAD_PRIMARY = `linear-gradient(135deg, ${T.emerald}, ${T.sky})`;

// ─── PPTX BUILDER ─────────────────────────────────────────────────────────────
async function buildPPTX(content, topic) {
  const Tm = BRAND_THEME;
  const prs = new pptxgen();
  prs.layout = 'LAYOUT_WIDE';
  const slides = content.slides || [];

  for (let idx = 0; idx < slides.length; idx++) {
    const sd = slides[idx];
    const slide = prs.addSlide();
    const stype = sd.type || 'content';
    slide.background = { fill: Tm.bg };
    slide.addShape(prs.ShapeType.ellipse, { x: -0.8, y: -0.8, w: 3.5, h: 3.5, fill: { type: 'solid', color: Tm.accent, transparency: 85 }, line: { color: Tm.accent, transparency: 85 } });
    slide.addShape(prs.ShapeType.ellipse, { x: 10.5, y: 4.5, w: 3.5, h: 3.5, fill: { type: 'solid', color: Tm.accent2, transparency: 85 }, line: { color: Tm.accent2, transparency: 85 } });

    if (stype === 'title' || idx === 0) {
      slide.addShape(prs.ShapeType.roundRect, { x: 4.3, y: 0.35, w: 4.73, h: 0.42, fill: { type: 'solid', color: Tm.accent, transparency: 70 }, line: { color: Tm.accent, width: 1.5 }, rectRadius: 0.2 });
      slide.addText((sd.badge || content.badge || 'PRESENTATION 2025').toUpperCase(), { x: 4.3, y: 0.35, w: 4.73, h: 0.42, fontSize: 11, bold: true, color: Tm.accent, align: 'center', valign: 'middle', charSpacing: 1.5 });
      slide.addText(content.title || topic, { x: 0.8, y: 1.1, w: 11.73, h: 2.4, fontSize: sd.titleFontSize || 64, bold: true, color: Tm.text, align: 'center', wrap: true, fontFace: 'Calibri' });
      slide.addShape(prs.ShapeType.rect, { x: 5.0, y: 3.55, w: 3.33, h: 0.055, fill: hex(Tm.accent), line: { color: Tm.accent } });
      slide.addText(content.subtitle || ('A Comprehensive Presentation on ' + topic), { x: 1.5, y: 3.75, w: 10.33, h: 0.7, fontSize: 20, color: Tm.accent, align: 'center', italic: true, fontFace: 'Calibri' });
      const badges = sd.badges || content.statBadges || [];
      if (badges.length >= 2) {
        const bw = 2.6;
        const totalW = badges.length * bw + (badges.length - 1) * 0.3;
        const startX = (13.33 - totalW) / 2;
        badges.slice(0, 4).forEach((b, bi) => {
          const bx = startX + bi * (bw + 0.3);
          slide.addShape(prs.ShapeType.roundRect, { x: bx, y: 4.7, w: bw, h: 0.75, fill: { type: 'solid', color: Tm.card }, line: { color: CARD_ACCENTS[bi % CARD_ACCENTS.length], width: 1.5 }, rectRadius: 0.12 });
          slide.addText(b.label || b, { x: bx, y: 4.7, w: bw, h: 0.75, fontSize: 13, bold: true, color: Tm.text, align: 'center', valign: 'middle' });
        });
      }
      slide.addText((content.footer || ('Prepared by MK-AI  •  ' + topic)), { x: 0.5, y: 6.9, w: 12.33, h: 0.35, fontSize: 11, color: Tm.sub, align: 'center' });
    } else if (stype === 'section') {
      slide.addShape(prs.ShapeType.rect, { x: 0, y: 0, w: 0.6, h: 7.5, fill: hex(Tm.accent), line: { color: Tm.accent } });
      slide.addText(String(idx + 1).padStart(2, '0'), { x: 1.2, y: 1.5, w: 4, h: 2.5, fontSize: 100, bold: true, color: Tm.accent, fontFace: 'Calibri', transparency: 15 });
      slide.addText(sd.title || '', { x: 1.2, y: 3.6, w: 11.0, h: 1.8, fontSize: 42, bold: true, color: Tm.text, wrap: true, fontFace: 'Calibri' });
      if (sd.subtitle || sd.description) slide.addText(sd.subtitle || sd.description, { x: 1.2, y: 5.3, w: 10, h: 0.8, fontSize: 18, color: Tm.accent, italic: true });
      slide.addText('MK-AI  •  ' + topic, { x: 0.5, y: 7.1, w: 12.5, h: 0.3, fontSize: 9, color: Tm.sub, align: 'center' });
    } else if (stype === 'cards' || stype === 'features') {
      _addSlideHeader(slide, prs, sd, Tm, idx);
      const cards = sd.cards || sd.points?.map((p, i) => ({
        icon: sd.icons?.[i] || ['💡', '🚀', '⚡', '🎯', '📊', '🔥'][i % 6],
        title: p.split('—')[0].trim().substring(0, 30),
        body: p.split('—')[1]?.trim() || p.substring(0, 120),
        color: CARD_ACCENTS[i % CARD_ACCENTS.length],
      })) || [];
      const n = Math.min(cards.length, 4);
      const cols = n > 2 ? 2 : n;
      const rows = Math.ceil(n / cols);
      const cw = cols === 2 ? 5.9 : 10;
      const ch = rows === 2 ? 2.55 : 5.0;
      const gx = 0.3, gy = 1.35;
      for (let ci = 0; ci < n; ci++) {
        const card = cards[ci];
        const col = ci % cols;
        const row = Math.floor(ci / cols);
        const cx = gx + col * (cw + 0.3);
        const cy = gy + row * (ch + 0.25);
        const ccolor = card.color || CARD_ACCENTS[ci % CARD_ACCENTS.length];
        slide.addShape(prs.ShapeType.roundRect, { x: cx, y: cy, w: cw, h: ch, fill: hex(Tm.card), line: { color: ccolor, width: 2 }, rectRadius: 0.12 });
        slide.addShape(prs.ShapeType.rect, { x: cx, y: cy + 0.12, w: 0.055, h: ch - 0.24, fill: hex(ccolor), line: { color: ccolor } });
        slide.addShape(prs.ShapeType.ellipse, { x: cx + 0.18, y: cy + 0.2, w: 0.7, h: 0.7, fill: { type: 'solid', color: ccolor, transparency: 75 }, line: { color: ccolor, width: 1 } });
        slide.addText(card.icon || '●', { x: cx + 0.18, y: cy + 0.2, w: 0.7, h: 0.7, fontSize: 18, align: 'center', valign: 'middle' });
        slide.addText(card.title || '', { x: cx + 1.05, y: cy + 0.18, w: cw - 1.2, h: 0.5, fontSize: 16, bold: true, color: Tm.text, valign: 'middle' });
        if (card.subtitle) slide.addText(card.subtitle, { x: cx + 1.05, y: cy + 0.66, w: cw - 1.2, h: 0.28, fontSize: 11, color: ccolor, italic: true });
        const bodyLines = (card.body || '').split('•').filter(Boolean);
        if (bodyLines.length > 1) {
          bodyLines.slice(0, 4).forEach((bl, bli) => {
            slide.addText('▸  ' + bl.trim(), { x: cx + 0.15, y: cy + 1.0 + bli * 0.36, w: cw - 0.3, h: 0.35, fontSize: 12, color: Tm.sub, wrap: true });
          });
        } else {
          slide.addText(card.body || '', { x: cx + 0.15, y: cy + 1.0, w: cw - 0.3, h: ch - 1.15, fontSize: 12.5, color: Tm.sub, wrap: true, valign: 'top' });
        }
      }
      _addFooter(slide, Tm, topic, idx);
    } else if (stype === 'stats') {
      _addSlideHeader(slide, prs, sd, Tm, idx);
      const stats = sd.stats || sd.points?.map((p) => {
        const parts = p.split('—');
        return { number: parts[0]?.trim(), label: parts[1]?.trim() || '', sub: parts[2]?.trim() || '' };
      }) || [];
      const n = Math.min(stats.length, 4);
      const sw = n === 4 ? 2.9 : n === 3 ? 3.8 : 5.5;
      const totalW = n * sw + (n - 1) * 0.25;
      const startX = (13.33 - totalW) / 2;
      stats.slice(0, n).forEach((st, si) => {
        const sx = startX + si * (sw + 0.25);
        const ccolor = CARD_ACCENTS[si % CARD_ACCENTS.length];
        slide.addShape(prs.ShapeType.roundRect, { x: sx, y: 1.3, w: sw, h: 2.9, fill: hex(Tm.card), line: { color: ccolor, width: 2 }, rectRadius: 0.15 });
        slide.addShape(prs.ShapeType.rect, { x: sx + 0.3, y: 1.3, w: sw - 0.6, h: 0.07, fill: hex(ccolor), line: { color: ccolor } });
        slide.addText(st.number || '0', { x: sx, y: 1.55, w: sw, h: 1.3, fontSize: 54, bold: true, color: ccolor, align: 'center', fontFace: 'Calibri' });
        slide.addText(st.label || '', { x: sx + 0.1, y: 2.82, w: sw - 0.2, h: 0.5, fontSize: 14, bold: true, color: Tm.text, align: 'center', wrap: true });
        if (st.sub) slide.addText(st.sub, { x: sx + 0.1, y: 3.3, w: sw - 0.2, h: 0.45, fontSize: 11, color: Tm.sub, align: 'center', wrap: true });
      });
      const extra = sd.extra || sd.description;
      if (extra) {
        const pts = Array.isArray(extra) ? extra : [extra];
        pts.slice(0, 3).forEach((p, pi) => {
          slide.addShape(prs.ShapeType.roundRect, { x: 0.3, y: 4.4 + pi * 0.65, w: 12.73, h: 0.58, fill: { type: 'solid', color: Tm.card }, line: { color: Tm.accent, transparency: 70 }, rectRadius: 0.08 });
          slide.addText('✓  ' + p, { x: 0.5, y: 4.4 + pi * 0.65, w: 12.33, h: 0.58, fontSize: 14, color: Tm.text, valign: 'middle' });
        });
      }
      _addFooter(slide, Tm, topic, idx);
    } else if (stype === 'comparison') {
      _addSlideHeader(slide, prs, sd, Tm, idx);
      const left = sd.left || { title: sd.leftTitle || 'Option A', points: sd.points?.slice(0, Math.ceil((sd.points?.length || 0) / 2)) || [], color: Tm.accent, icon: sd.leftIcon || '📌' };
      const right = sd.right || { title: sd.rightTitle || 'Option B', points: sd.points?.slice(Math.ceil((sd.points?.length || 0) / 2)) || [], color: Tm.accent2, icon: sd.rightIcon || '🎯' };
      [left, right].forEach((col, ci) => {
        const cx = 0.25 + ci * 6.7;
        const ccolor = col.color || (ci === 0 ? Tm.accent : Tm.accent2);
        slide.addShape(prs.ShapeType.roundRect, { x: cx, y: 1.25, w: 6.3, h: 6.0, fill: hex(Tm.card), line: { color: ccolor, width: 2.5 }, rectRadius: 0.15 });
        slide.addShape(prs.ShapeType.ellipse, { x: cx + 2.55, y: 1.45, w: 1.2, h: 1.2, fill: { type: 'solid', color: ccolor, transparency: 70 }, line: { color: ccolor, width: 1.5 } });
        slide.addText(col.icon || (ci === 0 ? '◀' : '▶'), { x: cx + 2.55, y: 1.45, w: 1.2, h: 1.2, fontSize: 26, align: 'center', valign: 'middle' });
        slide.addText(col.title, { x: cx + 0.2, y: 2.75, w: 5.9, h: 0.55, fontSize: 18, bold: true, color: ccolor, align: 'center' });
        if (col.subtitle) slide.addText(col.subtitle, { x: cx + 0.2, y: 3.27, w: 5.9, h: 0.38, fontSize: 12, color: col.color || ccolor, italic: true, align: 'center' });
        (col.points || []).slice(0, 5).forEach((pt, pi) => {
          slide.addText('▸  ' + pt, { x: cx + 0.3, y: 3.72 + pi * 0.6, w: 5.7, h: 0.56, fontSize: 13, color: Tm.sub, wrap: true, valign: 'middle' });
        });
      });
      if (sd.vsLabel !== false) {
        slide.addShape(prs.ShapeType.ellipse, { x: 6.16, y: 3.55, w: 1.0, h: 1.0, fill: hex(Tm.card), line: { color: Tm.accent, width: 2 } });
        slide.addText(sd.vsLabel || 'VS', { x: 6.16, y: 3.55, w: 1.0, h: 1.0, fontSize: 16, bold: true, color: Tm.accent, align: 'center', valign: 'middle' });
      }
      _addFooter(slide, Tm, topic, idx);
    } else if (stype === 'quote') {
      slide.addShape(prs.ShapeType.roundRect, { x: 0.8, y: 1.2, w: 11.73, h: 5.2, fill: { type: 'solid', color: Tm.card }, line: { color: Tm.accent, width: 2 }, rectRadius: 0.2 });
      slide.addShape(prs.ShapeType.rect, { x: 0.8, y: 1.2, w: 0.1, h: 5.2, fill: hex(Tm.accent), line: { color: Tm.accent } });
      slide.addText('"', { x: 1.1, y: 0.9, w: 2.5, h: 1.8, fontSize: 120, bold: true, color: Tm.accent, fontFace: 'Georgia', transparency: 30 });
      slide.addText(sd.quote || sd.points?.[0] || '', { x: 1.5, y: 2.2, w: 10.5, h: 2.8, fontSize: 26, bold: true, color: Tm.text, align: 'center', wrap: true, fontFace: 'Georgia', italic: true });
      slide.addText('— ' + (sd.author || topic), { x: 1, y: 5.5, w: 11.33, h: 0.5, fontSize: 16, color: Tm.accent, align: 'right', italic: true });
      _addFooter(slide, Tm, topic, idx);
    } else if (stype === 'chart') {
      _addSlideHeader(slide, prs, sd, Tm, idx);
      const chartType = sd.chartType || sd.chart_type || 'bar';
      const cdata = sd.chartData || _makeChartData(sd, chartType);
      if (chartType === 'pie') {
        slide.addChart(prs.ChartType.pie, [{ name: topic, labels: cdata.labels, values: cdata.values }], { x: 2.2, y: 1.25, w: 8.9, h: 5.8, dataLabelColor: 'FFFFFF', dataLabelFontSize: 14, dataLabelFontBold: true, showLegend: true, legendPos: 'b', legendFontSize: 13, legendColor: Tm.text, chartColors: [Tm.accent, Tm.accent2, 'F2A93B', '17B890', 'FFEAA7', '0E77AC'] });
      } else if (chartType === 'line') {
        slide.addChart(prs.ChartType.line, [{ name: topic, labels: cdata.labels, values: cdata.values }], { x: 0.8, y: 1.25, w: 11.73, h: 5.8, lineSize: 3, lineColor: Tm.accent, lineDataSymbol: 'circle', lineDataSymbolSize: 8, showLegend: false, catAxisLabelColor: Tm.text, valAxisLabelColor: Tm.text, catAxisLabelFontSize: 12, valAxisLabelFontSize: 12, valGridLine: { color: Tm.card, size: 1 }, plotArea: { fill: hex(Tm.card) }, dataLabelColor: Tm.accent, dataLabelFontSize: 11, showDataLabels: true });
      } else {
        slide.addChart(prs.ChartType.bar, [{ name: topic, labels: cdata.labels, values: cdata.values }], { x: 0.8, y: 1.25, w: 11.73, h: 5.8, barDir: 'col', barGrouping: 'clustered', chartColors: [Tm.accent], dataLabelColor: Tm.text, dataLabelFontSize: 13, dataLabelFontBold: true, dataLabelPosition: 'outEnd', showLegend: false, catAxisLabelColor: Tm.text, valAxisLabelColor: Tm.text, catAxisLabelFontSize: 12, valAxisLabelFontSize: 11, valGridLine: { color: Tm.card, size: 1 }, plotArea: { fill: hex(Tm.bg) } });
      }
      _addFooter(slide, Tm, topic, idx);
    } else if (stype === 'flowchart') {
      _addSlideHeader(slide, prs, sd, Tm, idx);
      const steps = sd.steps || sd.points || [];
      const n = Math.min(steps.length, 5);
      if (n > 0) {
        const colW = 12.5 / n;
        for (let i = 0; i < n; i++) {
          const cx = 0.42 + i * colW + colW / 2 - 1.05;
          const ccolor = [Tm.accent, Tm.accent2, ...CARD_ACCENTS][i % 8];
          if (i < n - 1) slide.addShape(prs.ShapeType.rect, { x: cx + 2.15, y: 3.45, w: colW - 2.1, h: 0.07, fill: hex(ccolor), line: { color: ccolor } });
          slide.addShape(prs.ShapeType.roundRect, { x: cx + 0.1, y: 2.7, w: 1.95, h: 1.65, fill: hex(Tm.card), line: { color: ccolor, width: 2.5 }, rectRadius: 0.14 });
          slide.addShape(prs.ShapeType.ellipse, { x: cx + 0.72, y: 1.2, w: 0.7, h: 0.7, fill: hex(ccolor), line: { color: ccolor } });
          slide.addText(String(i + 1), { x: cx + 0.72, y: 1.2, w: 0.7, h: 0.7, fontSize: 16, bold: true, color: 'FFFFFF', align: 'center', valign: 'middle' });
          slide.addShape(prs.ShapeType.rect, { x: cx + 1.05, y: 1.88, w: 0.04, h: 0.83, fill: hex(ccolor), line: { color: ccolor } });
          slide.addText((steps[i] || '').substring(0, 55), { x: cx + 0.12, y: 2.72, w: 1.9, h: 1.6, fontSize: 11.5, color: Tm.text, align: 'center', valign: 'middle', wrap: true });
        }
      }
      _addFooter(slide, Tm, topic, idx);
    } else if (stype === 'mindmap') {
      _addSlideHeader(slide, prs, sd, Tm, idx);
      slide.addShape(prs.ShapeType.ellipse, { x: 5.3, y: 2.9, w: 2.73, h: 1.45, fill: hex(Tm.accent), line: { color: Tm.accent } });
      slide.addText((sd.center || topic).substring(0, 18), { x: 5.3, y: 2.9, w: 2.73, h: 1.45, fontSize: 14, bold: true, color: 'FFFFFF', align: 'center', valign: 'middle' });
      const branches = sd.branches || sd.points || [];
      const positions = [{ x: 0.25, y: 1.7 }, { x: 0.25, y: 4.3 }, { x: 10.35, y: 1.7 }, { x: 10.35, y: 4.3 }, { x: 4.2, y: 0.8 }, { x: 4.2, y: 6.0 }];
      branches.slice(0, 6).forEach((branch, bi) => {
        const pos = positions[bi];
        const bcolor = CARD_ACCENTS[bi % CARD_ACCENTS.length];
        slide.addShape(prs.ShapeType.roundRect, { x: pos.x, y: pos.y, w: 2.6, h: 1.0, fill: hex(Tm.card), line: { color: bcolor, width: 2 }, rectRadius: 0.1 });
        slide.addShape(prs.ShapeType.rect, { x: pos.x, y: pos.y + 0.1, w: 0.06, h: 0.8, fill: hex(bcolor), line: { color: bcolor } });
        slide.addText((branch || '').substring(0, 25), { x: pos.x + 0.1, y: pos.y, w: 2.5, h: 1.0, fontSize: 12, bold: true, color: Tm.text, align: 'center', valign: 'middle', wrap: true });
      });
      _addFooter(slide, Tm, topic, idx);
    } else if (stype === 'timeline') {
      _addSlideHeader(slide, prs, sd, Tm, idx);
      const items = sd.items || sd.points || [];
      items.slice(0, 5).forEach((item, ii) => {
        const iy = 1.4 + ii * 1.04;
        const ccolor = [Tm.accent, Tm.accent2, ...CARD_ACCENTS][ii % 8];
        slide.addShape(prs.ShapeType.ellipse, { x: 0.3, y: iy + 0.08, w: 0.75, h: 0.75, fill: hex(ccolor), line: { color: ccolor } });
        slide.addText(String(ii + 1), { x: 0.3, y: iy + 0.08, w: 0.75, h: 0.75, fontSize: 15, bold: true, color: 'FFFFFF', align: 'center', valign: 'middle' });
        if (ii < items.length - 1) slide.addShape(prs.ShapeType.rect, { x: 0.63, y: iy + 0.83, w: 0.04, h: 0.22, fill: hex(ccolor), line: { color: ccolor } });
        slide.addShape(prs.ShapeType.roundRect, { x: 1.3, y: iy, w: 11.7, h: 0.92, fill: hex(Tm.card), line: { color: ccolor, width: 1.5 }, rectRadius: 0.1 });
        const parts = (typeof item === 'string' ? item : item.text || '').split('—');
        slide.addText(parts[0].trim(), { x: 1.45, y: iy + 0.02, w: 5.5, h: 0.42, fontSize: 14, bold: true, color: Tm.text, valign: 'middle' });
        slide.addText(parts[1]?.trim() || '', { x: 1.45, y: iy + 0.44, w: 11.3, h: 0.42, fontSize: 12, color: Tm.sub, valign: 'middle', wrap: true });
      });
      _addFooter(slide, Tm, topic, idx);
    } else {
      _addSlideHeader(slide, prs, sd, Tm, idx);
      const points = sd.points || [];
      const hasRight = sd.image || sd.stat || sd.highlight;
      if (hasRight) {
        const rightW = 4.3;
        const leftW = 13.33 - rightW - 0.5;
        slide.addShape(prs.ShapeType.roundRect, { x: 0.25, y: 1.25, w: leftW, h: 6.0, fill: hex(Tm.card), line: { color: Tm.accent, transparency: 70 }, rectRadius: 0.12 });
        points.slice(0, 6).forEach((pt, j) => {
          slide.addShape(prs.ShapeType.rect, { x: 0.32, y: 1.35 + j * 0.94, w: 0.06, h: 0.7, fill: hex(CARD_ACCENTS[j % CARD_ACCENTS.length]), line: { color: CARD_ACCENTS[j % CARD_ACCENTS.length] } });
          slide.addText(pt, { x: 0.5, y: 1.33 + j * 0.94, w: leftW - 0.4, h: 0.92, fontSize: 13.5, color: Tm.text, wrap: true, valign: 'middle' });
        });
        slide.addShape(prs.ShapeType.roundRect, { x: leftW + 0.5, y: 1.25, w: rightW, h: 6.0, fill: { type: 'solid', color: Tm.accent, transparency: 80 }, line: { color: Tm.accent, width: 2 }, rectRadius: 0.15 });
        if (sd.stat) {
          slide.addText(sd.stat.number || '', { x: leftW + 0.5, y: 2.5, w: rightW, h: 1.5, fontSize: 60, bold: true, color: Tm.accent, align: 'center' });
          slide.addText(sd.stat.label || '', { x: leftW + 0.5, y: 4.0, w: rightW, h: 0.7, fontSize: 16, bold: true, color: Tm.text, align: 'center', wrap: true });
          if (sd.stat.sub) slide.addText(sd.stat.sub, { x: leftW + 0.5, y: 4.7, w: rightW, h: 0.6, fontSize: 12, color: Tm.sub, align: 'center', wrap: true });
        } else if (sd.highlight) {
          slide.addText(sd.highlight, { x: leftW + 0.55, y: 2.2, w: rightW - 0.2, h: 4.5, fontSize: 16, color: Tm.text, wrap: true, valign: 'middle', align: 'center', italic: true });
        }
      } else if (points.length <= 3) {
        points.slice(0, 3).forEach((pt, j) => {
          const ccolor = CARD_ACCENTS[j % CARD_ACCENTS.length];
          const ch = points.length === 1 ? 5.4 : points.length === 2 ? 2.6 : 1.75;
          const cy = 1.3 + j * (ch + 0.22);
          slide.addShape(prs.ShapeType.roundRect, { x: 0.3, y: cy, w: 12.73, h: ch, fill: hex(Tm.card), line: { color: ccolor, width: 2 }, rectRadius: 0.14 });
          slide.addShape(prs.ShapeType.rect, { x: 0.3, y: cy + 0.1, w: 0.07, h: ch - 0.2, fill: hex(ccolor), line: { color: ccolor } });
          const parts = pt.split('—');
          if (parts.length > 1) {
            slide.addText(parts[0].trim(), { x: 0.55, y: cy + 0.1, w: 12.2, h: ch * 0.38, fontSize: 17, bold: true, color: Tm.text, valign: 'middle', wrap: true });
            slide.addText(parts[1].trim(), { x: 0.55, y: cy + ch * 0.38, w: 12.2, h: ch * 0.58, fontSize: 13.5, color: Tm.sub, valign: 'top', wrap: true });
          } else {
            slide.addText(pt, { x: 0.55, y: cy + 0.1, w: 12.2, h: ch - 0.2, fontSize: 15.5, color: Tm.text, valign: 'middle', wrap: true });
          }
        });
      } else {
        const mid = Math.ceil(points.length / 2);
        const col1 = points.slice(0, mid);
        const col2 = points.slice(mid);
        const totalRows = Math.max(col1.length, col2.length);
        const rowH = Math.min(1.0, 5.9 / totalRows);
        [col1, col2].forEach((col, ci) => {
          const cx = 0.25 + ci * 6.65;
          slide.addShape(prs.ShapeType.roundRect, { x: cx, y: 1.25, w: 6.3, h: totalRows * rowH + 0.15, fill: hex(Tm.card), line: { color: CARD_ACCENTS[ci * 2], transparency: 60 }, rectRadius: 0.12 });
          col.forEach((pt, j) => {
            const ccolor = CARD_ACCENTS[(ci * mid + j) % CARD_ACCENTS.length];
            const py = 1.35 + j * rowH;
            slide.addShape(prs.ShapeType.rect, { x: cx + 0.1, y: py + rowH * 0.15, w: 0.06, h: rowH * 0.7, fill: hex(ccolor), line: { color: ccolor } });
            slide.addText(pt, { x: cx + 0.3, y: py, w: 5.85, h: rowH, fontSize: Math.min(13.5, 10 + rowH * 4), color: Tm.text, wrap: true, valign: 'middle' });
          });
        });
      }
      if (sd.speaker_notes) slide.addNotes(sd.speaker_notes);
      _addFooter(slide, Tm, topic, idx);
    }
  }

  const safeName = (topic || 'presentation').replace(/[^a-z0-9]/gi, '_').substring(0, 30);
  await prs.writeFile({ fileName: safeName + '_MK-AI.pptx' });
}

function _addSlideHeader(slide, prs, sd, Tm, idx) {
  if (sd.section || sd.tag) {
    slide.addText((sd.section || sd.tag).toUpperCase(), { x: 0.3, y: 0.1, w: 12.5, h: 0.35, fontSize: 11, bold: true, color: Tm.accent, charSpacing: 2.5, align: 'left' });
  }
  slide.addText(sd.title || '', { x: 0.3, y: sd.section ? 0.38 : 0.12, w: 12.73, h: 1.0, fontSize: 38, bold: true, color: Tm.text, fontFace: 'Calibri' });
}

function _addFooter(slide, Tm, topic, idx) {
  slide.addText('MK-AI  •  ' + topic, { x: 0.3, y: 7.1, w: 12.73, h: 0.3, fontSize: 9, color: Tm.sub, align: 'center' });
}

function _makeChartData(sd, chartType) {
  if (sd.labels && sd.values) return { labels: sd.labels, values: sd.values };
  if (chartType === 'pie') return { labels: ['Category A', 'Category B', 'Category C', 'Category D'], values: [35, 28, 22, 15] };
  return { labels: ['2021', '2022', '2023', '2024', '2025'], values: [38, 52, 45, 71, 88].map(v => v + Math.floor(Math.random() * 8)) };
}

// ─── JSON AUTO-REPAIR ──────────────────────────────────────────────────────────
function autoFixMissingCommas(json) {
  let result = '';
  let inString = false, escape = false;
  let expectingComma = false;
  const n = json.length;
  let i = 0;
  while (i < n) {
    const ch = json[i];

    if (inString) {
      result += ch;
      if (escape) { escape = false; }
      else if (ch === '\\') { escape = true; }
      else if (ch === '"') { inString = false; expectingComma = true; }
      i++;
      continue;
    }

    if (ch === '"') {
      if (expectingComma) result += ',';
      inString = true;
      expectingComma = false;
      result += ch;
      i++;
      continue;
    }

    if (/\s/.test(ch)) { result += ch; i++; continue; }

    if (ch === ',' || ch === ':') { expectingComma = false; result += ch; i++; continue; }

    if (ch === '{' || ch === '[') {
      if (expectingComma) result += ',';
      expectingComma = false;
      result += ch;
      i++;
      continue;
    }

    if (ch === '}' || ch === ']') {
      result += ch;
      expectingComma = true;
      i++;
      continue;
    }

    if (expectingComma) result += ',';
    let j = i;
    while (j < n && /[-+.eE0-9a-zA-Z]/.test(json[j])) j++;
    result += json.slice(i, j);
    expectingComma = true;
    i = j || i + 1;
  }
  return result;
}

// ─── CONTENT GENERATOR ────────────────────────────────────────────────────────
async function generateContent(inputMode, topic, numSlides, language, style, userContent, roughNotes) {
  const langRule = {
    English:  'Write ALL content in English only.',
    Hindi:    'Write ALL content in Hindi (Devanagari script).',
    Hinglish: 'Mix Hindi + English Roman script naturally (e.g. "AI ne 2024 mein $200B investment attract kiya").',
  }[language] || 'Write in English.';

  const styleGuide = {
    professional: 'Use formal corporate tone. Include real industry statistics, market data, expert insights, and actionable business recommendations.',
    academic:     'Use educational tone. Include research-backed explanations, scientific evidence, methodology details, and scholarly references.',
    creative:     'Use vivid storytelling tone. Create emotional hooks, use analogies and metaphors, build a compelling narrative arc.',
    minimal:      'Be concise but never vague. Each sentence must carry maximum information density. No filler words.',
  }[style] || 'Professional corporate tone.';

  let userSection = '';
  if (inputMode === 'content' && userContent) {
    userSection = '\n\nUSER PROVIDED CONTENT — use this as the PRIMARY source:\n' + userContent.substring(0, 3500);
  } else if (inputMode === 'topic+notes' && roughNotes) {
    userSection = '\n\nROUGH NOTES TO INCORPORATE:\n' + roughNotes.substring(0, 1200);
  }

  const modeInstruction = {
    content:      'Structure the user\'s content into a professional presentation. Extract and expand on key points, data, and insights.',
    'topic+notes':'Use the topic as primary theme, weave in rough notes into relevant slides with additional context.',
    topic:        'Generate expert-level, research-backed content. Think like a domain expert presenting to a senior audience.',
  }[inputMode] || 'Generate professional presentation content.';

  const tokenBudget = Math.min(2200 + numSlides * 300, 11000);

  const typeHints = numSlides <= 7
    ? 'Use: title(1), section(1), cards(1), stats(1), content(2), conclusion(1)'
    : numSlides <= 15
    ? 'Use: title(1), section(2), cards(2), stats(1), chart(1), comparison(1), timeline(1), flowchart(1), quote(1), content(3), conclusion(1)'
    : 'Use ALL types generously. Mix: content, cards, stats, chart, timeline, flowchart, mindmap, comparison, quote, section dividers every 5-6 slides.';

  const messages = [
    {
      role: 'system',
      content: `You are a world-class presentation designer and content strategist for MK-AI.
Your specialty: creating DETAILED, INSIGHTFUL, INFORMATION-RICH presentation content that actually teaches the audience something.

ABSOLUTE RULES:
1. Return ONLY valid JSON — zero markdown, zero backticks, zero text outside JSON.
2. Never put raw newlines or tabs inside JSON string values — use \\n instead.
3. ${langRule}

CONTENT QUALITY NON-NEGOTIABLES:
- Every "points" array item MUST be a complete, informative sentence (not a short label).
  BAD: "Better performance"
  GOOD: "Performance improves by 40-60% because neural networks can process parallel data streams simultaneously, unlike sequential CPU-based methods."
- Include real statistics, percentages, year references, and named examples wherever possible.
- Each point should be 15-40 words — substantive but not rambling.
- The audience should learn something valuable from EVERY single slide.`,
    },
    {
      role: 'user',
      content: `Create a ${style} presentation on: "${topic}"
Total Slides: EXACTLY ${numSlides}
Language Rule: ${langRule}
Style: ${styleGuide}
Task: ${modeInstruction}
Slide Type Distribution: ${typeHints}
${userSection}

DETAILED CONTENT RULES:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[CONTENT slides] Each "points" item = 1-2 full sentences with context, data, or an example.
[STATS slides] Use real/realistic numbers with full context.
[CARDS slides] Each card body = 3-4 bullet sub-points using • separator.
[COMPARISON slides] Each column must have 4-5 specific, meaningful, contrasting points.
[TIMELINE slides] items array: "Year/Event—Detailed description of what happened and why it mattered"
[FLOWCHART slides] steps = specific, action-oriented descriptions (not vague labels)
[QUOTE slides] Use real, famous, relevant quotes with correct attribution.
[MINDMAP slides] branches = specific subtopics or concepts, each as a descriptive phrase

STRUCTURE REQUIREMENTS:
- Slide 1: type "title" always
- Every 5-6 slides: insert a "section" divider
- Last slide: type "content" with title "Key Takeaways & Next Steps"
- Speaker notes: 2-3 sentences on every slide
- statBadges: 3 impressive stats about the topic for the title slide
- Total slide count: EXACTLY ${numSlides}

Return ONLY this JSON (no extra text before or after):
{
  "title": "string",
  "subtitle": "string",
  "badge": "string",
  "footer": "string",
  "statBadges": [{"label": "string"}, {"label": "string"}, {"label": "string"}],
  "slides": [
    {
      "type": "title|section|cards|stats|comparison|quote|chart|flowchart|mindmap|timeline|content",
      "title": "string",
      "section": "optional section tag string",
      "badge": "optional string",
      "points": ["full sentence point 1", "full sentence point 2"],
      "cards": [{"icon":"emoji","title":"string","subtitle":"string","body":"bullet1•bullet2•bullet3","color":"HEX6"}],
      "stats": [{"number":"string","label":"string","sub":"string"}],
      "extra": ["full sentence 1", "full sentence 2"],
      "left": {"title":"string","icon":"emoji","points":["string","string"],"color":"HEX6"},
      "right": {"title":"string","icon":"emoji","points":["string","string"],"color":"HEX6"},
      "vsLabel": "VS",
      "quote": "string",
      "author": "string",
      "steps": ["string","string","string"],
      "branches": ["string","string","string"],
      "center": "string",
      "chartType": "bar|pie|line",
      "labels": ["string"],
      "values": [0,0,0],
      "items": ["Label—Full description"],
      "stat": {"number":"string","label":"string","sub":"string"},
      "highlight": "string",
      "speaker_notes": "string"
    }
  ]
}`,
    },
  ];

  const text = await callAIWithFallback(messages, tokenBudget);
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON found in AI response. Raw: ' + text.substring(0, 400));

  let raw = jsonMatch[0].replace(/```json|```/g, '');
  let depth = 0, lastValidEnd = 0;
  for (let i = 0; i < raw.length; i++) {
    if (raw[i] === '{' || raw[i] === '[') depth++;
    else if (raw[i] === '}' || raw[i] === ']') {
      depth--;
      if (depth === 0) lastValidEnd = i + 1;
    }
  }
  if (lastValidEnd > 0 && lastValidEnd < raw.length) raw = raw.substring(0, lastValidEnd);

  let cleaned = '', inString = false, escaped = false;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (escaped) { cleaned += ch; escaped = false; continue; }
    if (ch === '\\' && inString) { cleaned += ch; escaped = true; continue; }
    if (ch === '"') { inString = !inString; cleaned += ch; continue; }
    if (inString) {
      const code = ch.charCodeAt(0);
      if (code === 0x0A) { cleaned += '\\n'; continue; }
      if (code === 0x0D) { cleaned += '\\r'; continue; }
      if (code === 0x09) { cleaned += '\\t'; continue; }
      if (code < 0x20)  { cleaned += ' ';   continue; }
    }
    cleaned += ch;
  }

  try {
    return JSON.parse(cleaned);
  } catch (e) {
    const fixed = cleaned
      .replace(/,\s*([}\]])/g, '$1')
      .replace(/([}\]])\s*,\s*$/g, '$1');
    try {
      return JSON.parse(fixed);
    } catch (e2) {
      try {
        const repaired = autoFixMissingCommas(fixed)
          .replace(/,\s*([}\]])/g, '$1');
        return JSON.parse(repaired);
      } catch (e3) {
        throw new Error('JSON parse failed: ' + e3.message + '\nSnippet: ' + cleaned.substring(0, 400));
      }
    }
  }
}

// ─── SLIDE TYPE COLOURS (brand palette) ───────────────────────────────────────
const TYPE_COLORS = {
  title: '#0FA968', section: '#F2A93B', quote: '#0C8457', chart: '#B23B3B',
  stats: '#1596D6', flowchart: '#0E77AC', mindmap: '#17B890', comparison: '#F2A93B',
  cards: '#0FA968', features: '#0FA968', timeline: '#1596D6', content: '#122420',
};

// ─── EDITABLE SLIDE CARD ──────────────────────────────────────────────────────
function EditableSlideCard({ slide, index, onChange, onTypeChange }) {
  const [expanded, setExpanded] = useState(false);
  const typeColor = TYPE_COLORS[slide.type] || TYPE_COLORS.content;
  const updatePoint  = (pi, val) => { const p = [...(slide.points || [])]; p[pi] = val; onChange({ ...slide, points: p }); };
  const addPoint     = () => onChange({ ...slide, points: [...(slide.points || []), 'Add your detailed point here with context and data.'] });
  const removePoint  = (pi) => onChange({ ...slide, points: (slide.points || []).filter((_, i) => i !== pi) });

  return (
    <div style={{ background: T.glassBg, backdropFilter:'blur(14px)', border: '1px solid ' + T.glassBorder, borderLeft: '3px solid ' + typeColor, borderRadius: 16, marginBottom: 10, overflow: 'hidden', boxShadow: T.glassShadow }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 16px', cursor:'pointer' }} onClick={() => setExpanded(!expanded)}>
        <div style={{ display:'flex', alignItems:'center', gap: 8 }}>
          <span style={{ background:'rgba(15,169,104,0.16)', width:22, height:22, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:800, color: T.emerald2, flexShrink:0 }}>{index + 1}</span>
          <span style={{ padding:'2px 9px', borderRadius:10, fontSize:10, fontWeight:700, color:'#fff', background: typeColor }}>{slide.type || 'content'}</span>
          <span style={{ fontSize:13, color: T.ink, fontWeight:600 }}>{slide.title?.substring(0, 45) || '(no title)'}{slide.title?.length > 45 ? '...' : ''}</span>
        </div>
        <span style={{ fontSize:12, color: T.muted }}>{expanded ? '▲' : '▼'}</span>
      </div>
      {expanded && (
        <div style={{ padding:'4px 16px 16px' }}>
          <label style={{ display:'block', fontSize:11, color: T.muted, marginTop:10, marginBottom:4, fontWeight:600, textTransform:'uppercase', letterSpacing:0.5 }}>Slide Title</label>
          <input style={{ width:'100%', background: T.white, border:'1.5px solid ' + T.line, borderRadius:10, padding:'9px 12px', color: T.ink, fontSize:13, outline:'none', boxSizing:'border-box', fontFamily:'inherit' }} value={slide.title || ''} onChange={e => onChange({ ...slide, title: e.target.value })} />

          <label style={{ display:'block', fontSize:11, color: T.muted, marginTop:10, marginBottom:4, fontWeight:600, textTransform:'uppercase', letterSpacing:0.5 }}>Slide Type</label>
          <select style={{ width:'100%', background: T.white, border:'1.5px solid ' + T.line, borderRadius:10, padding:'9px 12px', color: T.ink, fontSize:13, outline:'none', fontFamily:'inherit' }} value={slide.type || 'content'} onChange={e => onTypeChange(e.target.value)}>
            {Object.keys(TYPE_COLORS).map(t => <option key={t} value={t}>{t}</option>)}
          </select>

          <label style={{ display:'block', fontSize:11, color: T.muted, marginTop:10, marginBottom:4, fontWeight:600, textTransform:'uppercase', letterSpacing:0.5 }}>Section Tag (optional)</label>
          <input style={{ width:'100%', background: T.white, border:'1.5px solid ' + T.line, borderRadius:10, padding:'9px 12px', color: T.ink, fontSize:13, outline:'none', boxSizing:'border-box', fontFamily:'inherit' }} placeholder="e.g. THE PROBLEM, KEY INSIGHTS" value={slide.section || ''} onChange={e => onChange({ ...slide, section: e.target.value })} />

          {(slide.type === 'content' || slide.type === 'timeline' || !slide.type) && (
            <>
              <label style={{ display:'block', fontSize:11, color: T.muted, marginTop:10, marginBottom:4, fontWeight:600, textTransform:'uppercase', letterSpacing:0.5 }}>Points</label>
              {(slide.points || []).map((pt, pi) => (
                <div key={pi} style={{ display:'flex', gap:6, marginBottom:6 }}>
                  <textarea style={{ flex:1, background: T.white, border:'1.5px solid ' + T.line, borderRadius:8, padding:'7px 9px', color: T.ink, fontSize:12, outline:'none', resize:'vertical', fontFamily:'inherit' }} value={pt} rows={3} onChange={e => updatePoint(pi, e.target.value)} />
                  <button style={{ background:'rgba(178,59,59,0.08)', border:'1px solid rgba(178,59,59,0.22)', color:'#B23B3B', width:30, borderRadius:8, cursor:'pointer', fontSize:12, flexShrink:0 }} onClick={() => removePoint(pi)}>✕</button>
                </div>
              ))}
              <button style={{ background:'rgba(15,169,104,0.1)', border:'1px solid rgba(15,169,104,0.3)', color: T.emerald2, padding:'7px 16px', borderRadius:8, cursor:'pointer', fontSize:12, marginTop:4, fontFamily:'inherit', fontWeight:600 }} onClick={addPoint}>+ Add Point</button>
            </>
          )}

          {slide.type === 'quote' && (
            <>
              <label style={{ display:'block', fontSize:11, color: T.muted, marginTop:10, marginBottom:4, fontWeight:600, textTransform:'uppercase', letterSpacing:0.5 }}>Quote Text</label>
              <textarea style={{ width:'100%', background: T.white, border:'1.5px solid ' + T.line, borderRadius:10, padding:'9px 12px', color: T.ink, fontSize:13, outline:'none', boxSizing:'border-box', fontFamily:'inherit', height:80 }} value={slide.quote || ''} onChange={e => onChange({ ...slide, quote: e.target.value })} />
              <label style={{ display:'block', fontSize:11, color: T.muted, marginTop:10, marginBottom:4, fontWeight:600, textTransform:'uppercase', letterSpacing:0.5 }}>Author</label>
              <input style={{ width:'100%', background: T.white, border:'1.5px solid ' + T.line, borderRadius:10, padding:'9px 12px', color: T.ink, fontSize:13, outline:'none', boxSizing:'border-box', fontFamily:'inherit' }} value={slide.author || ''} onChange={e => onChange({ ...slide, author: e.target.value })} />
            </>
          )}

          <label style={{ display:'block', fontSize:11, color: T.muted, marginTop:10, marginBottom:4, fontWeight:600, textTransform:'uppercase', letterSpacing:0.5 }}>Speaker Notes</label>
          <textarea style={{ width:'100%', background: T.white, border:'1.5px solid ' + T.line, borderRadius:10, padding:'9px 12px', color: T.ink, fontSize:13, outline:'none', boxSizing:'border-box', fontFamily:'inherit', height:60 }} value={slide.speaker_notes || ''} onChange={e => onChange({ ...slide, speaker_notes: e.target.value })} />
        </div>
      )}
    </div>
  );
}

// ─── LABEL COMPONENT ──────────────────────────────────────────────────────────
function Label({ children }) {
  return (
    <label style={{ display:'block', fontSize:12, color: T.muted, marginBottom:8, marginTop:20, fontWeight:700, letterSpacing:'0.4px', textTransform:'uppercase' }}>
      {children}
    </label>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function PPT() {
  const navigate = useNavigate();

  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const [inputMode, setInputMode]   = useState('topic');
  const [topic, setTopic]           = useState('');
  const [userContent, setUserContent] = useState('');
  const [roughNotes, setRoughNotes] = useState('');
  const [numSlides, setNumSlides]   = useState(15);
  const [deckSize, setDeckSize]     = useState('medium');
  const [language, setLanguage]     = useState('English');
  const [style, setStyle]           = useState('professional');
  const [loading, setLoading]       = useState(false);
  const [step, setStep]             = useState('');
  const [preview, setPreview]       = useState(null);
  const [done, setDone]             = useState(false);
  const [error, setError]           = useState('');
  const [editMode, setEditMode]     = useState(false);

  const updateSlide     = useCallback((idx, updated) => { setPreview(prev => { const s = [...(prev.slides || [])]; s[idx] = updated; return { ...prev, slides: s }; }); }, []);
  const changeSlideType = useCallback((idx, newType) => { setPreview(prev => { const s = [...(prev.slides || [])]; s[idx] = { ...s[idx], type: newType }; return { ...prev, slides: s }; }); }, []);
  const addSlide    = () => setPreview(prev => ({ ...prev, slides: [...(prev.slides || []), { type: 'content', title: 'New Slide', points: ['Write your first detailed point with supporting data or context here.', 'Second point — include a specific example, statistic, or insight.', 'Third point — explain the implication or significance to the audience.'] }] }));
  const removeSlide = (idx) => setPreview(prev => ({ ...prev, slides: prev.slides.filter((_, i) => i !== idx) }));
  const moveSlide   = (idx, dir) => {
    setPreview(prev => {
      const slides = [...prev.slides];
      const target = idx + dir;
      if (target < 0 || target >= slides.length) return prev;
      [slides[idx], slides[target]] = [slides[target], slides[idx]];
      return { ...prev, slides };
    });
  };

  const generate = async () => {
    const t = inputMode === 'content'
      ? (userContent.split('\n')[0]?.substring(0, 60) || 'My Presentation')
      : topic;
    if (!t.trim() && !userContent.trim()) return;
    setLoading(true); setDone(false); setError(''); setEditMode(false);
    try {
      setStep('🤖 Connecting to AI providers...');
      const content = await generateContent(inputMode, t, numSlides, language, style, userContent, roughNotes);
      setPreview(content);
      setStep('📦 Building your PPTX file...');
      await buildPPTX(content, t);
      setDone(true); setStep('');
    } catch (err) {
      console.error(err);
      setError('❌ ' + err.message);
      setStep('');
    }
    setLoading(false);
  };

  const downloadEdited = async () => {
    if (!preview) return;
    setLoading(true); setStep('📦 Building edited PPTX...');
    try {
      const t = topic || preview.title || 'Presentation';
      await buildPPTX(preview, t);
      setDone(true); setStep('');
    } catch (err) { setError('❌ ' + err.message); }
    setLoading(false);
  };

  const canGenerate = inputMode === 'content' ? userContent.trim().length > 20 : topic.trim().length > 0;

  const mainPad  = isMobile ? '20px 12px' : '36px 20px';
  const cardPad  = isMobile ? '18px 14px' : '32px';
  const headerPad = isMobile ? '12px 16px' : '16px 36px';

  return (
    <div style={{ minHeight:'100vh', background:T.bg, color: T.ink, fontFamily:"Inter,ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif" }}>

      <Helmet>
        <title>AI Presentation Maker — MK AI</title>
        <meta name="description" content="Create high-impact presentation slides in seconds with MK AI's PPT Maker." />
      </Helmet>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;650;700;800&display=swap');
        .mkppt *,.mkppt *::before,.mkppt *::after{box-sizing:border-box;}
        .mkppt body{background:radial-gradient(circle at 15% 10%, rgba(15,169,104,.10), transparent 26rem), ${T.bg};}
        .mkppt ::-webkit-scrollbar{width:4px;}
        .mkppt ::-webkit-scrollbar-thumb{background:${T.mint};border-radius:4px;}
        .mkppt :focus-visible{outline:2px solid ${T.emerald};outline-offset:2px;}
        @keyframes mkSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .mk-tab, .mk-deck, .mk-style, .mk-lang{ font-family:inherit; cursor:pointer; transition:all .2s; }
        .mk-tab:hover, .mk-deck:hover, .mk-style:hover, .mk-lang:hover{ transform:translateY(-2px); }
        .mk-input:focus, .mk-textarea:focus{ border-color:${T.emerald} !important; box-shadow:0 0 0 3px rgba(15,169,104,.14); }
        .mk-gen-btn:hover:not(:disabled){ transform:translateY(-2px); box-shadow:0 18px 36px rgba(15,150,120,.30); }
        .mk-regen-btn:hover{ transform:translateY(-2px); }
      `}</style>

      <div className="mkppt" style={{ background:`radial-gradient(circle at 15% 0%, rgba(15,169,104,.08), transparent 24rem)` }}>

        {/* ── HEADER ── */}
        <header style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding: headerPad, borderBottom:'1px solid ' + T.line, position:'sticky', top:0, background:'rgba(246,250,247,0.92)', backdropFilter:'blur(14px)', zIndex:100 }}>
          <button style={{ background: T.white, border:'1px solid ' + T.line, color: T.ink, padding: isMobile ? '8px 14px' : '9px 18px', borderRadius:24, cursor:'pointer', fontSize: isMobile ? 12 : 13, fontFamily:'inherit', fontWeight:600, boxShadow:'0 4px 12px rgba(15,90,70,.06)' }} onClick={() => navigate('/')}>← Back</button>
          <div style={{ display:'flex', alignItems:'center', gap: isMobile ? 6 : 10 }}>
            <span style={{ fontSize: isMobile ? 20 : 26 }}>📊</span>
            <h1 style={{ fontSize: isMobile ? 16 : 22, fontWeight:800, margin:0, letterSpacing:'-0.5px', color: T.ink }}>MK PPT Maker</h1>
            {!isMobile && (
              <span style={{ background:'rgba(15,169,104,0.12)', border:'1px solid rgba(15,169,104,0.3)', padding:'3px 10px', borderRadius:12, fontSize:11, color: T.emerald2, fontWeight:600 }}>Charts • Diagrams • 50 Slides</span>
            )}
          </div>
          <span style={{ fontSize:11, color: T.muted, fontStyle:'italic' }}>{isMobile ? '' : 'MK-AI'}</span>
        </header>

        <main style={{ maxWidth:1050, margin:'0 auto', padding: mainPad }}>
          <div style={{ background: T.glassBg, backdropFilter:'blur(18px) saturate(160%)', border:'1px solid ' + T.glassBorder, borderRadius: isMobile ? 20 : 26, padding: cardPad, marginBottom:24, boxShadow: T.glassShadow }}>

            {/* Title */}
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:20 }}>
              <span style={{ fontSize: isMobile ? 20 : 24 }}>✨</span>
              <span style={{ fontSize: isMobile ? 16 : 20, fontWeight:800, color: T.emerald2, letterSpacing:'-0.3px' }}>Create Premium Presentation</span>
            </div>

            {/* ── Input Mode Tabs ── */}
            <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3,1fr)', gap: isMobile ? 8 : 10, marginBottom:20 }}>
              {[
                { key:'topic',       label:'📌 Topic Only',    desc:'AI generates everything' },
                { key:'content',     label:'📝 Your Content',  desc:'Paste your own text'     },
                { key:'topic+notes', label:'🗒️ Topic + Notes', desc:'Topic with rough notes'  },
              ].map(m => (
                <button key={m.key} className="mk-tab" style={{
                  padding: isMobile ? '11px 14px' : '12px 14px',
                  borderRadius:14, fontSize:13,
                  display:'flex',
                  flexDirection: isMobile ? 'row' : 'column',
                  alignItems:'center',
                  justifyContent: isMobile ? 'flex-start' : 'center',
                  gap: isMobile ? 10 : 0,
                  background: inputMode === m.key ? GRAD_PRIMARY : T.white,
                  border: '1px solid ' + (inputMode === m.key ? 'transparent' : T.line),
                  color: inputMode === m.key ? '#fff' : T.ink,
                  boxShadow: inputMode === m.key ? '0 10px 22px rgba(15,150,120,.24)' : 'none',
                }} onClick={() => setInputMode(m.key)}>
                  <span style={{ fontSize:13, fontWeight:700 }}>{m.label}</span>
                  <span style={{ fontSize:10, color: inputMode === m.key ? 'rgba(255,255,255,0.85)' : T.muted, marginTop: isMobile ? 0 : 2 }}>{m.desc}</span>
                </button>
              ))}
            </div>

            {/* ── Input Fields ── */}
            {inputMode === 'topic' && (
              <>
                <Label>📌 Presentation Topic *</Label>
                <input className="mk-input" style={{ width:'100%', background: T.white, border:'1.5px solid ' + T.line, borderRadius:14, padding:'13px 16px', color: T.ink, fontSize: isMobile ? 14 : 15, outline:'none', boxSizing:'border-box', fontFamily:'inherit' }}
                  placeholder="e.g. Artificial Intelligence in Healthcare, Climate Change Solutions..."
                  value={topic} onChange={e => setTopic(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !loading && canGenerate && generate()} />
              </>
            )}
            {inputMode === 'content' && (
              <>
                <Label>📝 Your Content *</Label>
                <textarea className="mk-textarea" style={{ width:'100%', background: T.white, border:'1.5px solid ' + T.line, borderRadius:14, padding:'12px 14px', color: T.ink, fontSize:13, outline:'none', resize:'vertical', fontFamily:'inherit', boxSizing:'border-box', minHeight: isMobile ? 160 : 200 }}
                  placeholder="Paste your full content here. The first line becomes the title."
                  value={userContent} onChange={e => setUserContent(e.target.value)} rows={isMobile ? 7 : 9} />
                {userContent.trim().length > 20 && (
                  <div style={{ marginTop:8, fontSize:12, color: T.emerald2, padding:'6px 12px', background: T.successBg, borderRadius:8, fontWeight:600 }}>
                    {userContent.trim().split(/\s+/).length} words detected{userContent.split('\n')[0] && ' · Title: "' + userContent.split('\n')[0].substring(0, 50) + '"'}
                  </div>
                )}
              </>
            )}
            {inputMode === 'topic+notes' && (
              <>
                <Label>📌 Presentation Topic *</Label>
                <input className="mk-input" style={{ width:'100%', background: T.white, border:'1.5px solid ' + T.line, borderRadius:14, padding:'13px 16px', color: T.ink, fontSize: isMobile ? 14 : 15, outline:'none', boxSizing:'border-box', fontFamily:'inherit' }}
                  placeholder="e.g. Machine Learning in Healthcare, Web3 Revolution..."
                  value={topic} onChange={e => setTopic(e.target.value)} />
                <Label>🗒️ Rough Notes / Key Points</Label>
                <textarea className="mk-textarea" style={{ width:'100%', background: T.white, border:'1.5px solid ' + T.line, borderRadius:14, padding:'12px 14px', color: T.ink, fontSize:13, outline:'none', resize:'vertical', fontFamily:'inherit', boxSizing:'border-box', minHeight: isMobile ? 120 : 160 }}
                  placeholder={'Add rough notes, key points, or data...\n- Market size: $4.5T by 2030\n- Case study: Tesla AI autopilot'}
                  value={roughNotes} onChange={e => setRoughNotes(e.target.value)} rows={isMobile ? 5 : 7} />
              </>
            )}

            {/* ── Deck Size ── */}
            <Label>📑 Presentation Size</Label>
            <div style={{ display:'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: 8 }}>
              {SLIDE_SIZES.map(({ key, label, desc, slides, range }) => (
                <button key={key} className="mk-deck"
                  onClick={() => { setDeckSize(key); if (slides) setNumSlides(slides); }}
                  style={{
                    padding:'12px 8px',
                    borderRadius:16,
                    display:'flex', flexDirection:'column', alignItems:'center', gap:0,
                    background: deckSize === key ? GRAD_PRIMARY : T.white,
                    border: '1px solid ' + (deckSize === key ? 'transparent' : T.line),
                    color: deckSize === key ? '#fff' : T.ink,
                    boxShadow: deckSize === key ? '0 10px 22px rgba(15,150,120,.24)' : 'none',
                  }}>
                  <span style={{ fontSize: isMobile ? 13 : 14, fontWeight:800 }}>{label}</span>
                  <span style={{ fontSize:10, color: deckSize === key ? 'rgba(255,255,255,0.85)' : T.muted, marginTop:2 }}>{desc}</span>
                  <span style={{ marginTop:5, fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:20, background: deckSize === key ? 'rgba(255,255,255,0.25)' : T.panel, color: deckSize === key ? '#fff' : T.emerald2 }}>{range}</span>
                </button>
              ))}
            </div>

            {deckSize === 'custom' && (
              <div style={{ display:'flex', alignItems:'center', gap:12, marginTop:12, padding:'10px 14px', background: T.panel2, borderRadius:14, border:'1px solid ' + T.line }}>
                <input type="range" min={5} max={50} step={1} value={numSlides} onChange={e => setNumSlides(+e.target.value)}
                  style={{ flex:1, accentColor: T.emerald, cursor:'pointer', height:6 }} />
                <span style={{ background: GRAD_PRIMARY, padding:'4px 12px', borderRadius:20, fontSize:15, fontWeight:700, minWidth:36, textAlign:'center', color:'#fff' }}>{numSlides}</span>
                <span style={{ fontSize:11, color: T.muted }}>slides</span>
              </div>
            )}

            {/* ── Language ── */}
            <Label>🌐 Language</Label>
            {isMobile ? (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
                {['English', 'Hindi', 'Hinglish'].map(lang => (
                  <button key={lang} className="mk-lang"
                    onClick={() => setLanguage(lang)}
                    style={{
                      padding:'11px 8px', borderRadius:14,
                      fontSize:13, fontWeight:700,
                      background: language === lang ? GRAD_PRIMARY : T.white,
                      border: '1px solid ' + (language === lang ? 'transparent' : T.line),
                      color: language === lang ? '#fff' : T.ink,
                    }}>
                    {lang === 'English' ? '🇬🇧 EN' : lang === 'Hindi' ? '🇮🇳 HI' : '🤙 HE'}
                  </button>
                ))}
              </div>
            ) : (
              <select style={{ width:'100%', background: T.white, border:'1.5px solid ' + T.line, borderRadius:14, padding:'12px 14px', color: T.ink, fontSize:14, outline:'none', fontFamily:'inherit' }}
                value={language} onChange={e => setLanguage(e.target.value)}>
                <option>English</option>
                <option>Hindi</option>
                <option>Hinglish</option>
              </select>
            )}

            {/* ── Presentation Style ── */}
            <Label>🎯 Presentation Style</Label>
            <div style={{ display:'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: isMobile ? 8 : 10 }}>
              {[
                { key:'professional', label:'💼 Professional', desc:'Corporate, formal'     },
                { key:'academic',     label:'🎓 Academic',     desc:'Educational, detailed' },
                { key:'creative',     label:'🎨 Creative',     desc:'Bold, storytelling'    },
                { key:'minimal',      label:'✦ Minimal',       desc:'Clean, concise'        },
              ].map(({ key, label, desc }) => (
                <button key={key} className="mk-style" style={{
                  padding:'12px 8px', borderRadius:14, fontSize: isMobile ? 12 : 13,
                  display:'flex', flexDirection:'column', alignItems:'center',
                  background: style === key ? GRAD_PRIMARY : T.white,
                  border: '1px solid ' + (style === key ? 'transparent' : T.line),
                  color: style === key ? '#fff' : T.ink,
                  boxShadow: style === key ? '0 10px 22px rgba(15,150,120,.24)' : 'none',
                }} onClick={() => setStyle(key)}>
                  <span style={{ fontSize: isMobile ? 13 : 14, fontWeight:700 }}>{label}</span>
                  <span style={{ fontSize:10, color: style === key ? 'rgba(255,255,255,0.85)' : T.muted, marginTop:2 }}>{desc}</span>
                </button>
              ))}
            </div>

            {/* ── Generate Button ── */}
            <button
              className="mk-gen-btn"
              style={{ width:'100%', background: GRAD_PRIMARY, color:'#fff', border:'none', padding: isMobile ? 15 : 17, borderRadius:40, cursor:'pointer', fontSize: isMobile ? 16 : 18, fontWeight:800, marginTop:26, display:'flex', alignItems:'center', justifyContent:'center', gap:10, fontFamily:'inherit', opacity: loading || !canGenerate ? 0.5 : 1, boxShadow:'0 14px 30px rgba(15,150,120,.24)' }}
              onClick={generate}
              disabled={loading || !canGenerate}
            >
              {loading
                ? <><span style={{ animation:'mkSpin 1s linear infinite', display:'inline-block' }}>⏳</span>{step}</>
                : '🚀 Generate & Download PPTX'}
            </button>

            {loading && (
              <div style={{ marginTop:10, fontSize:11, color: T.muted, textAlign:'center' }}>
                🔄 Auto-switching providers: {AI_PROVIDERS.map(p => p.name).join(' → ')}
              </div>
            )}

            {error && (
              <div style={{ marginTop:14, background: T.errorBg, border:'1px solid ' + T.errorBorder, borderRadius:14, padding:'12px 16px', color: T.errorColor, fontSize:13 }}>
                {error}
              </div>
            )}
          </div>

          {/* ── Success Banner ── */}
          {done && (
            <div style={{ display:'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'flex-start' : 'center', justifyContent:'space-between', gap: isMobile ? 14 : 0, background: T.successBg, border:'1px solid ' + T.successBorder, borderRadius:20, padding: isMobile ? '16px 18px' : '20px 26px', marginBottom:24 }}>
              <div style={{ display:'flex', alignItems:'center', gap:16 }}>
                <span style={{ fontSize: isMobile ? 28 : 36 }}>🎉</span>
                <div>
                  <p style={{ margin:0, fontWeight:800, fontSize: isMobile ? 15 : 17, color: T.successColor }}>PPTX Successfully Downloaded!</p>
                  <p style={{ margin:'8px 0 0', display:'flex', gap:8, flexWrap:'wrap' }}>
                    {['📊 ' + (preview?.slides?.length) + ' Slides', '🌐 ' + language, '🎯 ' + style].map(c => (
                      <span key={c} style={{ background: T.white, border:'1px solid ' + T.line, padding:'3px 10px', borderRadius:20, fontSize:12, color: T.muted, fontWeight:600 }}>{c}</span>
                    ))}
                  </p>
                </div>
              </div>
              <button className="mk-regen-btn" style={{ background: T.white, border:'1px solid ' + T.line, color: T.emerald2, padding:'10px 20px', borderRadius:24, cursor:'pointer', fontSize:14, fontFamily:'inherit', fontWeight:700, width: isMobile ? '100%' : 'auto' }} onClick={generate}>🔄 Regenerate</button>
            </div>
          )}

          {/* ── Preview Panel ── */}
          {preview && (
            <div style={{ background: T.glassBg, backdropFilter:'blur(18px) saturate(160%)', border:'1px solid ' + T.glassBorder, borderRadius: isMobile ? 20 : 26, padding: isMobile ? '18px 14px' : 32, boxShadow: T.glassShadow }}>
              <div style={{ display:'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent:'space-between', alignItems:'flex-start', gap:16, marginBottom:20 }}>
                <div>
                  <h2 style={{ fontSize: isMobile ? 18 : 22, fontWeight:800, margin:0, color: T.ink }}>{preview.title}</h2>
                  <p style={{ color: T.muted, marginTop:6, fontSize:13 }}>{preview.subtitle}</p>
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:10, alignItems: isMobile ? 'flex-start' : 'flex-end', width: isMobile ? '100%' : 'auto' }}>
                  <div style={{ display:'flex', gap:10 }}>
                    {[
                      { n: preview.slides?.length,                                                 l:'Slides'   },
                      { n: preview.slides?.filter(s => s.type==='chart').length,                   l:'Charts'   },
                      { n: preview.slides?.filter(s => ['flowchart','mindmap'].includes(s.type)).length, l:'Diagrams' },
                    ].map(({ n, l }) => (
                      <div key={l} style={{ background: T.panel2, borderRadius:14, padding: isMobile ? '10px 14px' : '12px 18px', textAlign:'center', minWidth: isMobile ? 52 : 60 }}>
                        <span style={{ display:'block', fontSize: isMobile ? 18 : 22, fontWeight:800, color: T.emerald2 }}>{n}</span>
                        <span style={{ display:'block', fontSize:11, color: T.muted, marginTop:2 }}>{l}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ display:'flex', gap:8, width: isMobile ? '100%' : 'auto' }}>
                    <button className="mk-regen-btn" style={{ background: T.white, border:'1px solid ' + T.line, color: T.emerald2, padding:'10px 16px', borderRadius:24, cursor:'pointer', fontSize:13, fontFamily:'inherit', fontWeight:700, flex: isMobile ? 1 : 'unset' }} onClick={() => setEditMode(!editMode)}>
                      {editMode ? '👁️ Hide Editor' : '✏️ Edit Slides'}
                    </button>
                    {editMode && (
                      <button className="mk-regen-btn" style={{ background:'rgba(15,169,104,0.14)', border:'1px solid rgba(15,169,104,0.35)', color: T.emerald2, padding:'10px 16px', borderRadius:24, cursor:'pointer', fontSize:13, fontFamily:'inherit', fontWeight:700, flex: isMobile ? 1 : 'unset' }} onClick={downloadEdited} disabled={loading}>
                        {loading ? '⏳ Building...' : '⬇️ Download Edited'}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Slide type distribution badges */}
              <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:22 }}>
                {Object.entries(
                  preview.slides?.reduce((acc, s) => { const t = s.type || 'content'; acc[t] = (acc[t] || 0) + 1; return acc; }, {}) || {}
                ).map(([type, count]) => (
                  <span key={type} style={{ padding:'4px 12px', borderRadius:20, fontSize:11, fontWeight:700, color:'#fff', background: TYPE_COLORS[type] || TYPE_COLORS.content }}>{type} ×{count}</span>
                ))}
              </div>

              {/* ── EDITOR MODE ── */}
              {editMode ? (
                <div>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:14, alignItems:'center' }}>
                    <span style={{ color: T.emerald2, fontSize:13, fontWeight:700 }}>✏️ Edit, reorder, add or remove slides</span>
                    <button className="mk-regen-btn" style={{ background: T.white, border:'1px solid ' + T.line, color: T.emerald2, padding:'8px 16px', borderRadius:20, cursor:'pointer', fontSize:12, fontFamily:'inherit', fontWeight:700 }} onClick={addSlide}>+ Add Slide</button>
                  </div>
                  {preview.slides?.map((sl, i) => (
                    <div key={i} style={{ position:'relative' }}>
                      <EditableSlideCard slide={sl} index={i} onChange={(updated) => updateSlide(i, updated)} onTypeChange={(newType) => changeSlideType(i, newType)} />
                      <div style={{ position:'absolute', right:50, top:10, display:'flex', gap:4 }}>
                        {['↑','↓'].map((arrow, ai) => (
                          <button key={arrow} style={{ background: T.panel2, border:'none', color: T.muted, width:24, height:24, borderRadius:6, cursor:'pointer', fontSize:13 }} onClick={() => moveSlide(i, ai === 0 ? -1 : 1)}>{arrow}</button>
                        ))}
                        <button style={{ background: T.panel2, border:'none', color:'#B23B3B', width:24, height:24, borderRadius:6, cursor:'pointer', fontSize:13 }} onClick={() => removeSlide(i)}>✕</button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                /* ── PREVIEW GRID ── */
                <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(260px, 1fr))', gap:12 }}>
                  {preview.slides?.map((sl, i) => (
                    <div key={i} style={{ background: T.white, borderRadius:16, padding:16, border:'1px solid ' + T.line, borderLeft:'3px solid ' + (TYPE_COLORS[sl.type] || TYPE_COLORS.content), boxShadow:'0 4px 16px rgba(15,90,70,.05)' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                        <span style={{ background: GRAD_PRIMARY, width:24, height:24, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:800, color:'#fff', flexShrink:0 }}>{i + 1}</span>
                        <span style={{ padding:'2px 9px', borderRadius:10, fontSize:10, fontWeight:700, color:'#fff', background: TYPE_COLORS[sl.type] || TYPE_COLORS.content }}>{sl.type || 'content'}</span>
                      </div>
                      <h3 style={{ fontSize:13, fontWeight:700, color: T.emerald2, margin:'0 0 8px' }}>{sl.title}</h3>
                      {sl.section     && <p style={{ fontSize:10, color: T.gold, margin:'0 0 4px', letterSpacing:1, fontWeight:700 }}>{sl.section}</p>}
                      {sl.type==='quote'      && sl.quote   && <p style={{ fontSize:11, color: T.emerald2, fontStyle:'italic', margin:'0 0 6px' }}>"{sl.quote?.substring(0, 80)}..."</p>}
                      {sl.type==='flowchart'  && <p style={{ fontSize:11, color: T.gold, margin:'0 0 6px', fontWeight:600 }}>🔀 {sl.steps?.length || 0} steps</p>}
                      {sl.type==='mindmap'    && <p style={{ fontSize:11, color: T.gold, margin:'0 0 6px', fontWeight:600 }}>🧠 {sl.branches?.length || 0} branches</p>}
                      {sl.type==='chart'      && <p style={{ fontSize:11, color: T.gold, margin:'0 0 6px', fontWeight:600 }}>📊 {sl.chartType || 'bar'} chart</p>}
                      {sl.type==='stats'      && <p style={{ fontSize:11, color: T.gold, margin:'0 0 6px', fontWeight:600 }}>📈 {sl.stats?.length || 0} stat blocks</p>}
                      {sl.type==='cards'      && <p style={{ fontSize:11, color: T.gold, margin:'0 0 6px', fontWeight:600 }}>🃏 {sl.cards?.length || 0} feature cards</p>}
                      {sl.type==='comparison' && <p style={{ fontSize:11, color: T.gold, margin:'0 0 6px', fontWeight:600 }}>⚖️ {sl.left?.title} vs {sl.right?.title}</p>}
                      {sl.type==='timeline'   && <p style={{ fontSize:11, color: T.gold, margin:'0 0 6px', fontWeight:600 }}>📅 {sl.items?.length || 0} events</p>}
                      <ul style={{ listStyle:'none', padding:0, margin:0 }}>
                        {(sl.points || []).slice(0, 2).map((p, j) => (
                          <li key={j} style={{ fontSize:11, color: T.muted, marginBottom:4, lineHeight:1.5 }}>▸ {p?.substring(0, 80)}{p?.length > 80 ? '...' : ''}</li>
                        ))}
                        {(sl.points?.length || 0) > 2 && <li style={{ fontSize:11, color: T.muted }}>+{sl.points.length - 2} more points...</li>}
                      </ul>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ marginTop:24, background: T.panel2, border:'1px solid ' + T.line, borderRadius:14, padding:'14px 20px', color: T.emerald2, textAlign:'center', fontSize: isMobile ? 12 : 13, fontWeight:600 }}>
                💡 File downloaded to your Downloads folder! Open in <b style={{ color: T.sky2 }}>Google Slides</b> or <b style={{ color: T.sky2 }}>PowerPoint</b> for best results.
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}