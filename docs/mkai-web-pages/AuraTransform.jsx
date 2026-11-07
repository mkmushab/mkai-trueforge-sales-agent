import React, { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';

// ═══════════════════════════════════════════════════════════════════════
//  npm install pdfjs-dist tesseract.js jspdf pptxgenjs
//  (react-router-dom already used elsewhere in MK-AI)
// ═══════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════
//  AI PROVIDERS — same fallback pattern as the rest of the site
// ═══════════════════════════════════════════════════════════════════════
const AI_PROVIDERS = [
  {
    name: 'GeneralCompute',
    url: 'https://api.generalcompute.com/v1/chat/completions',
    key: 'YOUR_API_KEY_PLACEHOLDER',
    model: 'gpt-oss-120b',
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
    name: 'Cohere',
    url: 'https://api.cohere.com/v2/chat',
    key: 'YOUR_API_KEY_PLACEHOLDER',
    model: 'command-r-plus',
    type: 'cohere',
  },
  {
    name: 'Mistral',
    url: 'https://api.mistral.ai/v1/chat/completions',
    key: 'YOUR_API_KEY_PLACEHOLDER',
    model: 'mistral-large-latest',
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
    name: 'DeepInfra',
    url: 'https://api.deepinfra.com/v1/openai/chat/completions',
    key: 'YOUR_API_KEY_PLACEHOLDER',
    model: 'meta-llama/Llama-3.3-70B-Instruct',
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
    name: 'OpenRouter',
    url: 'https://openrouter.ai/api/v1/chat/completions',
    key: 'YOUR_API_KEY_PLACEHOLDER',
    model: 'meta-llama/llama-3.3-70b-instruct',
    type: 'openai',
    extraHeaders: { 'HTTP-Referer': 'https://mkai.tech', 'X-Title': 'MK AI' },
  },
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

async function callProviderOnce(provider, messages, maxTokens) {
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
  const primary = AI_PROVIDERS.find(p => p.name === PRIMARY_PROVIDER_NAME) || AI_PROVIDERS[0];
  if (failCounts[primary.name] < MAX_FAILS) {
    tried.add(primary.name);
    try {
      const text = await callProviderOnce(primary, messages, maxTokens);
      failCounts[primary.name] = 0;
      return text;
    } catch (err) {
      failCounts[primary.name]++;
    }
  }
  for (let attempt = 0; attempt < AI_PROVIDERS.length; attempt++) {
    const provider = getNextProvider();
    if (tried.has(provider.name)) continue;
    tried.add(provider.name);
    try {
      const text = await callProviderOnce(provider, messages, maxTokens);
      failCounts[provider.name] = 0;
      return text;
    } catch (err) {
      failCounts[provider.name]++;
    }
  }
  throw new Error('All AI providers failed. Please try again.');
}

function getGroqKey() {
  return AI_PROVIDERS.find(p => p.name === 'Groq')?.key || '';
}

// ═══════════════════════════════════════════════════════════════════════
//  AUTHENTICATED WEB SEARCH — optional, key-gated
// ═══════════════════════════════════════════════════════════════════════
const WEB_SEARCH_API_KEY = ''; // ← put your Serper.dev key here

async function fetchAuthWebSearch(q) {
  if (!WEB_SEARCH_API_KEY) return [];
  try {
    const r = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: { 'X-API-KEY': WEB_SEARCH_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ q, num: 3 }),
    });
    if (!r.ok) return [];
    const d = await r.json();
    return (d.organic || []).slice(0, 3).map(x => {
      let host = 'Web';
      try { host = new URL(x.link).hostname.replace('www.', ''); } catch {}
      return { title: x.title, url: x.link, source: `Live web · ${host}`, confidence: 'med' };
    });
  } catch { return []; }
}

// ═══════════════════════════════════════════════════════════════════════
//  CITATION ENGINE — 13 no-key sources + optional live web search
// ═══════════════════════════════════════════════════════════════════════
async function fetchWikipedia(q) {
  try {
    const r = await fetch(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(q)}&format=json&origin=*&srlimit=2`);
    const d = await r.json();
    return (d.query?.search || []).map(x => ({ title: x.title, url: `https://en.wikipedia.org/wiki/${encodeURIComponent(x.title.replace(/ /g, '_'))}`, source: 'Wikipedia', confidence: 'med' }));
  } catch { return []; }
}
async function fetchWikidata(q) {
  try {
    const r = await fetch(`https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(q)}&language=en&format=json&origin=*&limit=2`);
    const d = await r.json();
    return (d.search || []).map(x => ({ title: x.label + (x.description ? ' — ' + x.description : ''), url: x.concepturi, source: 'Wikidata', confidence: 'med' }));
  } catch { return []; }
}
async function fetchRestCountries(q) {
  try {
    const r = await fetch(`https://restcountries.com/v3.1/name/${encodeURIComponent(q)}?fields=name,cca2`);
    if (!r.ok) return [];
    const d = await r.json();
    return (Array.isArray(d) ? d : []).slice(0, 2).map(x => ({ title: x.name?.common, url: `https://restcountries.com/v3.1/alpha/${x.cca2}`, source: 'REST Countries', confidence: 'high' }));
  } catch { return []; }
}
async function fetchInternetArchive(q) {
  try {
    const r = await fetch(`https://archive.org/advancedsearch.php?q=${encodeURIComponent(q)}&fl[]=identifier&fl[]=title&rows=2&output=json`);
    const d = await r.json();
    return (d.response?.docs || []).map(x => ({ title: x.title, url: `https://archive.org/details/${x.identifier}`, source: 'Internet Archive', confidence: 'med' }));
  } catch { return []; }
}
async function fetchOpenAlex(q) {
  try {
    const r = await fetch(`https://api.openalex.org/works?search=${encodeURIComponent(q)}&per-page=2`);
    const d = await r.json();
    return (d.results || []).map(x => ({ title: x.display_name, url: x.doi ? `https://doi.org/${x.doi}` : (x.id || '#'), source: (x.primary_location?.source?.display_name || 'OpenAlex') + (x.cited_by_count ? ` · ${x.cited_by_count} citations` : ''), confidence: x.cited_by_count > 20 ? 'high' : 'med' }));
  } catch { return []; }
}
async function fetchSemanticScholar(q) {
  try {
    const r = await fetch(`https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(q)}&limit=2&fields=title,url,citationCount,venue`);
    const d = await r.json();
    return (d.data || []).map(x => ({ title: x.title, url: x.url || '#', source: (x.venue || 'Semantic Scholar') + (x.citationCount ? ` · ${x.citationCount} citations` : ''), confidence: x.citationCount > 20 ? 'high' : 'med' }));
  } catch { return []; }
}
async function fetchCrossRef(q) {
  try {
    const r = await fetch(`https://api.crossref.org/works?query=${encodeURIComponent(q)}&rows=2`);
    const d = await r.json();
    return (d.message?.items || []).map(x => ({ title: Array.isArray(x.title) ? x.title[0] : (x.title || 'Untitled'), url: x.DOI ? `https://doi.org/${x.DOI}` : '#', source: x['container-title']?.[0] || 'CrossRef', confidence: 'high' }));
  } catch { return []; }
}
async function fetchArxiv(q) {
  try {
    const r = await fetch(`https://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(q)}&max_results=2`);
    const text = await r.text();
    const doc = new window.DOMParser().parseFromString(text, 'text/xml');
    return Array.from(doc.getElementsByTagName('entry')).slice(0, 2).map(e => ({
      title: e.getElementsByTagName('title')[0]?.textContent?.trim() || 'Untitled',
      url: e.getElementsByTagName('id')[0]?.textContent?.trim() || '#',
      source: 'arXiv',
      confidence: 'med',
    }));
  } catch { return []; }
}
async function fetchPubMed(q) {
  try {
    const s = await fetch(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(q)}&retmode=json&retmax=2`);
    const sd = await s.json();
    const ids = sd.esearchresult?.idlist || [];
    if (!ids.length) return [];
    const sm = await fetch(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${ids.join(',')}&retmode=json`);
    const smd = await sm.json();
    return ids.map(id => smd.result?.[id]).filter(Boolean).map(x => ({ title: x.title, url: `https://pubmed.ncbi.nlm.nih.gov/${x.uid}/`, source: 'PubMed · ' + (x.source || 'NCBI'), confidence: 'high' }));
  } catch { return []; }
}
async function fetchGdelt(q) {
  try {
    const r = await fetch(`https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(q)}&mode=artlist&maxrecords=2&format=json`);
    const d = await r.json();
    return (d.articles || []).map(x => ({ title: x.title, url: x.url, source: x.domain || 'News (GDELT)', confidence: 'med' }));
  } catch { return []; }
}
function portalSource(name, base) {
  return q => Promise.resolve([{ title: `Search "${q}" on ${name}`, url: base + encodeURIComponent(q), source: name, confidence: 'high' }]);
}
const fetchWorldBank = portalSource('World Bank Open Data', 'https://data.worldbank.org/indicator?tab=all&q=');
const fetchEurostat = portalSource('Eurostat', 'https://ec.europa.eu/eurostat/databrowser/explore/all/all_themes?display=list&sort=category&fullText=');
const fetchWhoGho = portalSource('WHO Global Health Observatory', 'https://www.who.int/data/gho/data/indicators?query=');

const CONNECTORS = {
  wikipedia: fetchWikipedia,
  wikidata: fetchWikidata,
  restCountries: fetchRestCountries,
  internetArchive: fetchInternetArchive,
  openalex: fetchOpenAlex,
  semanticScholar: fetchSemanticScholar,
  crossref: fetchCrossRef,
  arxiv: fetchArxiv,
  pubmed: fetchPubMed,
  worldBank: fetchWorldBank,
  eurostat: fetchEurostat,
  whoGho: fetchWhoGho,
  gdelt: fetchGdelt,
  webSearch: fetchAuthWebSearch,
};

const CATEGORY_SOURCES = {
  academic: ['openalex', 'semanticScholar', 'crossref', 'arxiv', 'pubmed', 'wikipedia', 'webSearch'],
  geo_economic: ['restCountries', 'worldBank', 'eurostat', 'whoGho', 'wikidata', 'wikipedia', 'webSearch'],
  news_current: ['gdelt', 'wikipedia', 'internetArchive', 'wikidata', 'crossref', 'webSearch'],
  general: ['wikipedia', 'wikidata', 'openalex', 'internetArchive', 'gdelt', 'crossref', 'webSearch'],
};
const KEYWORDS = {
  academic: ['research', 'study', 'paper', 'journal', 'experiment', 'hypothesis', 'clinical', 'algorithm', 'analysis', 'dataset'],
  geo_economic: ['gdp', 'economy', 'population', 'country', 'trade', 'census', 'statistics', 'inflation', 'export', 'import'],
  news_current: ['news', 'breaking', 'announced', 'yesterday', 'today', 'election', 'minister', 'policy', 'government', 'attack', 'incident'],
};
function detectCategory(text) {
  const lower = text.toLowerCase();
  let best = 'general', bestScore = 0;
  for (const [cat, words] of Object.entries(KEYWORDS)) {
    const score = words.reduce((s, w) => s + (lower.includes(w) ? 1 : 0), 0);
    if (score > bestScore) { best = cat; bestScore = score; }
  }
  return best;
}
async function buildSourceList(queries, category) {
  const chosen = CATEGORY_SOURCES[category] || CATEGORY_SOURCES.general;
  const fns = chosen.map(k => CONNECTORS[k]);
  const runs = [];
  for (const q of queries.slice(0, 2)) {
    fns.forEach(fn => runs.push(fn(q)));
  }
  const results = (await Promise.all(runs)).flat();
  const seen = new Set();
  const deduped = results.filter(r => {
    if (!r?.title) return false;
    const key = r.title.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return deduped.length ? deduped.slice(0, 8) : [{ title: 'No independent source matched this content', url: '#', source: '—', confidence: 'low' }];
}

// ═══════════════════════════════════════════════════════════════════════
//  DOMAIN TEMPLATES + LANGUAGES
// ═══════════════════════════════════════════════════════════════════════
const TEMPLATES = {
  general: { label: 'General brief', desc: 'a tight, structured executive brief (6-9 sentences or bullet points)' },
  government: { label: 'Govt. policy brief', desc: 'a formal government policy brief with sections: Background, Key Facts, Implications, Recommendation — neutral bureaucratic tone' },
  research: { label: 'Research summary', desc: 'an academic research summary with sections: Objective, Method/Evidence, Findings, Limitations' },
  news_factcheck: { label: 'News fact-check', desc: 'a news fact-check report with sections: Claim, Verdict, Evidence, What Was Missing' },
  corporate: { label: 'Corporate memo', desc: 'a concise corporate memo with sections: Situation, Key Points, Action Items' },
};
const LANGUAGES = {
  English: 'English only.',
  Hindi: 'Hindi (Devanagari) only.',
  Hinglish: 'Hinglish (Roman Hindi+English mix).',
  Tamil: 'Tamil only.',
  Bengali: 'Bengali only.',
  Marathi: 'Marathi only.',
  Telugu: 'Telugu only.',
};

// ═══════════════════════════════════════════════════════════════════════
//  CLIENT-SIDE INPUT EXTRACTORS (PDF / OCR / Audio / YouTube / URL)
// ═══════════════════════════════════════════════════════════════════════
async function extractPdfText(file) {
  const pdfjsLib = await import('pdfjs-dist/build/pdf.mjs');
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  let fullText = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    fullText += content.items.map(it => it.str).join(' ') + '\n';
  }
  if (!fullText.trim()) throw new Error('No extractable text found in this PDF (it may be a scanned image — try the Image tab instead).');
  return fullText.trim();
}

async function extractImageText(file, onProgress) {
  const Tesseract = await import('tesseract.js');
  const { data } = await Tesseract.recognize(file, 'eng', {
    logger: m => { if (onProgress && m.status === 'recognizing text') onProgress(Math.round(m.progress * 100)); },
  });
  const text = (data.text || '').trim();
  if (!text) throw new Error('No readable text found in this image.');
  return text;
}

async function transcribeAudio(file) {
  const groqKey = getGroqKey();
  if (!groqKey) throw new Error('No transcription key configured.');
  const form = new FormData();
  form.append('file', file, file.name);
  form.append('model', 'whisper-large-v3');
  form.append('response_format', 'json');
  const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${groqKey}` },
    body: form,
  });
  if (!res.ok) throw new Error(`Transcription failed (HTTP ${res.status}). File may be too large — keep it under 25MB.`);
  const data = await res.json();
  if (!data.text) throw new Error('Empty transcript returned.');
  return data.text.trim();
}

const READER_PROXY = 'https://r.jina.ai/';

async function fetchUrlContent(url) {
  const clean = url.trim();
  if (!/^https?:\/\//i.test(clean)) throw new Error('Enter a full URL starting with http:// or https://');
  const res = await fetch(READER_PROXY + clean, { headers: { 'X-Return-Format': 'markdown' } });
  if (!res.ok) throw new Error(`Could not fetch that page (HTTP ${res.status}).`);
  const text = (await res.text()).trim();
  if (!text || text.length < 40) throw new Error('No readable text content found on that page.');
  return text.slice(0, 9000);
}

function extractYouTubeId(url) {
  const m = url.match(/(?:v=|\/videos\/|embed\/|youtu\.be\/|\/v\/|\/shorts\/)([^#&?/\s]{11})/);
  if (m) return m[1];
  return /^[\w-]{11}$/.test(url.trim()) ? url.trim() : null;
}

async function fetchYouTubeTranscript(url) {
  const videoId = extractYouTubeId(url);
  if (!videoId) throw new Error('Could not find a valid YouTube video ID in that URL.');
  const NO_CAPTIONS = 'No captions are available for this video, so a real transcript could not be fetched. Try a different video or paste the content manually.';
  let html;
  try {
    const r = await fetch(READER_PROXY + `https://www.youtube.com/watch?v=${videoId}`, { headers: { 'X-Return-Format': 'html' } });
    html = await r.text();
  } catch { throw new Error('Could not reach YouTube right now. Try again in a moment.'); }
  const trackMatch = html.match(/"captionTracks":(\[.*?\])/);
  if (!trackMatch) throw new Error(NO_CAPTIONS);
  let tracks;
  try { tracks = JSON.parse(trackMatch[1].replace(/\\u0026/g, '&')); } catch { throw new Error(NO_CAPTIONS); }
  const track = tracks.find(t => t.languageCode === 'en') || tracks[0];
  if (!track?.baseUrl) throw new Error(NO_CAPTIONS);
  const xmlRes = await fetch(READER_PROXY + track.baseUrl.replace(/\\u0026/g, '&'), { headers: { 'X-Return-Format': 'html' } });
  const xml = await xmlRes.text();
  const text = Array.from(xml.matchAll(/<text[^>]*>([\s\S]*?)<\/text>/g))
    .map(m => m[1].replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/<[^>]+>/g, ''))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) throw new Error(NO_CAPTIONS);
  return { videoId, transcript: text };
}

// ═══════════════════════════════════════════════════════════════════════
//  EXPORT UTILITIES — PDF / PPT / JSON
// ═══════════════════════════════════════════════════════════════════════
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

function exportJSON(record) {
  const blob = new Blob([JSON.stringify(record, null, 2)], { type: 'application/json' });
  downloadBlob(blob, 'aura-brief.json');
}

function splitOutputIntoParas(output) {
  return (output || '').split(/\n+/).map(l => l.trim()).filter(Boolean);
}

async function exportPDFFile({ output, sources, verdict, biasReport, trustScore, template, lang }) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210, M = 16;
  let y = 0;
  const rgb = hex => { const h = hex.replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; };
  const PURPLE = '0FA968', NAVY = '0E77AC', GOLD = 'F2A93B', GREEN = '0C8457', RED = 'B5503F', BG = '0A1712';
  const templateLabel = (TEMPLATES[template] || TEMPLATES.general).label;

  const newPage = () => {
    doc.addPage();
    doc.setFillColor(...rgb(BG)); doc.rect(0, 0, W, 297, 'F');
    doc.setFillColor(...rgb(PURPLE)); doc.rect(0, 0, W, 8, 'F');
    doc.setTextColor(...rgb(GOLD)); doc.setFontSize(7); doc.setFont('helvetica', 'bold');
    doc.text('AURA-TRANSFORM — VERIFIED INTELLIGENCE', M, 6);
    doc.setTextColor(150, 150, 170);
    doc.text(new Date().toLocaleDateString(), W - M, 6, { align: 'right' });
    y = 18;
  };
  const chk = (n = 16) => { if (y + n > 275) newPage(); };
  const heading = (text, color = PURPLE) => {
    chk(12); doc.setFillColor(...rgb(color)); doc.rect(M, y - 4, W - M * 2, 9, 'F');
    doc.setTextColor(255, 255, 255); doc.setFontSize(10); doc.setFont('helvetica', 'bold');
    doc.text(text, M + 4, y + 1.5); y += 13;
  };
  const para = (text, color = 'C7C9DC') => {
    if (!text) return;
    doc.setTextColor(...rgb(color)); doc.setFontSize(10); doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(String(text), W - M * 2);
    chk(lines.length * 5 + 4); doc.text(lines, M, y); y += lines.length * 5 + 4;
  };
  const bullet = (items = [], color = 'C7C9DC', dot = PURPLE) => {
    (items || []).forEach(item => {
      chk(7); doc.setFillColor(...rgb(dot)); doc.circle(M + 2.5, y - 1, 1.2, 'F');
      doc.setTextColor(...rgb(color)); doc.setFontSize(9.5); doc.setFont('helvetica', 'normal');
      const lines = doc.splitTextToSize(String(item), W - M * 2 - 8);
      doc.text(lines, M + 7, y); y += lines.length * 5 + 2;
    }); y += 2;
  };
  const box = (text, bgHex = '0F2A20', borderHex = PURPLE) => {
    if (!text) return;
    doc.setTextColor(...rgb('E2E4F5')); doc.setFontSize(9.5);
    const lines = doc.splitTextToSize(String(text), W - M * 2 - 8);
    chk(lines.length * 5 + 10);
    doc.setFillColor(...rgb(bgHex)); doc.rect(M, y - 4, W - M * 2, lines.length * 5 + 8, 'F');
    doc.setFillColor(...rgb(borderHex)); doc.rect(M, y - 4, 2.5, lines.length * 5 + 8, 'F');
    doc.text(lines, M + 7, y); y += lines.length * 5 + 12;
  };

  doc.setFillColor(...rgb(BG)); doc.rect(0, 0, W, 297, 'F');
  doc.setFillColor(...rgb(PURPLE)); doc.rect(0, 0, 6, 297, 'F');
  doc.setTextColor(...rgb(GOLD)); doc.setFontSize(9); doc.setFont('helvetica', 'bold');
  doc.text('AURA-TRANSFORM  ·  VERIFIED INTELLIGENCE', 16, 35);
  doc.setFillColor(...rgb(GOLD)); doc.rect(16, 38, 80, 0.6, 'F');
  doc.setTextColor(240, 240, 255); doc.setFontSize(28); doc.setFont('helvetica', 'bold');
  const titleLines = doc.splitTextToSize(templateLabel.toUpperCase(), 175);
  doc.text(titleLines, 16, 58);
  const th = titleLines.length * 13;
  doc.setTextColor(...rgb('9C9FC7')); doc.setFontSize(12); doc.setFont('helvetica', 'normal');
  if (trustScore != null) doc.text('Trust score: ' + trustScore + '%', 16, 58 + th + 8);
  doc.text('Language: ' + (lang || 'English'), 16, 58 + th + 18);
  doc.text('Sources checked: ' + (sources?.length || 0), 16, 58 + th + 28);
  doc.setTextColor(...rgb('55597F')); doc.setFontSize(8);
  doc.text('Generated by AURA-Transform | ' + new Date().toLocaleDateString(), 16, 275);

  newPage();
  heading('STRUCTURED BRIEF', PURPLE);
  splitOutputIntoParas(output).forEach(p => para(p));

  if (biasReport) {
    heading('BIAS / CONTRADICTION CHECK', /no contradiction/i.test(biasReport) ? GREEN : GOLD);
    box(biasReport, /no contradiction/i.test(biasReport) ? '0A1F16' : '2A2007', /no contradiction/i.test(biasReport) ? GREEN : GOLD);
  }
  if (verdict) {
    heading('VERIFICATION', GREEN);
    box(verdict, '0A1F16', GREEN);
  }

  heading('SOURCES CHECKED', NAVY);
  (sources || []).forEach((s, i) => {
    const dot = s.confidence === 'high' ? GREEN : s.confidence === 'med' ? GOLD : RED;
    bullet([`[${i + 1}] ${s.title} — ${s.source}`], 'C7C9DC', dot);
  });

  doc.save('aura-brief.pdf');
}

const PPTX_THEME = { bg: '0A1712', card: '112620', accent: '0FA968', accent2: '1596D6', text: 'FFFFFF', sub: 'A8C7BB' };
const PPTX_ACCENTS = ['0FA968', '1596D6', 'F2A93B', '2BC48A', '0E77AC', 'B8842C'];
const pHex = (h) => ({ type: 'solid', color: h });

function splitIntoPointGroups(output, perSlide = 3) {
  const sentences = (output || '').replace(/\[(\d+)\]/g, ' [$1]').split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean);
  const points = [];
  for (let i = 0; i < sentences.length; i += 2) points.push((sentences[i] + ' ' + (sentences[i + 1] || '')).trim());
  const groups = [];
  for (let i = 0; i < points.length; i += perSlide) groups.push(points.slice(i, i + perSlide));
  return groups.length ? groups : [['No content generated.']];
}

function _pptFooter(slide, idx) {
  slide.addText('AURA-Transform  •  Verified Intelligence', { x: 0.3, y: 7.1, w: 12.73, h: 0.3, fontSize: 9, color: PPTX_THEME.sub, align: 'center' });
}

async function exportPPTFile({ output, sources, biasReport, verdict, trustScore, template, lang }) {
  const PptxGenJS = (await import('pptxgenjs')).default;
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';
  const T2 = PPTX_THEME;
  const templateLabel = (TEMPLATES[template] || TEMPLATES.general).label;

  const title = pptx.addSlide();
  title.background = { fill: T2.bg };
  title.addShape(pptx.ShapeType.ellipse, { x: -0.8, y: -0.8, w: 3.5, h: 3.5, fill: { type: 'solid', color: T2.accent, transparency: 85 }, line: { color: T2.accent, transparency: 85 } });
  title.addShape(pptx.ShapeType.ellipse, { x: 10.5, y: 4.5, w: 3.5, h: 3.5, fill: { type: 'solid', color: T2.accent2, transparency: 85 }, line: { color: T2.accent2, transparency: 85 } });
  title.addShape(pptx.ShapeType.roundRect, { x: 4.3, y: 0.4, w: 4.73, h: 0.42, fill: { type: 'solid', color: T2.accent, transparency: 70 }, line: { color: T2.accent, width: 1.5 }, rectRadius: 0.2 });
  title.addText('AURA-TRANSFORM · VERIFIED INTELLIGENCE', { x: 4.3, y: 0.4, w: 4.73, h: 0.42, fontSize: 10, bold: true, color: T2.accent, align: 'center', valign: 'middle', charSpacing: 1 });
  title.addText(templateLabel, { x: 0.8, y: 1.2, w: 11.73, h: 2.2, fontSize: 50, bold: true, color: T2.text, align: 'center', wrap: true, fontFace: 'Calibri' });
  title.addShape(pptx.ShapeType.rect, { x: 5.0, y: 3.35, w: 3.33, h: 0.055, fill: pHex(T2.accent), line: { color: T2.accent } });
  title.addText('Structured, cross-checked, and cited', { x: 1.5, y: 3.55, w: 10.33, h: 0.6, fontSize: 18, color: T2.accent, align: 'center', italic: true });

  const badges = [
    trustScore != null ? { label: `${trustScore}% Trust score` } : null,
    { label: `${(sources || []).length} Sources` },
    { label: lang || 'English' },
  ].filter(Boolean);
  const bw = 2.7, totalW = badges.length * bw + (badges.length - 1) * 0.3, startX = (13.33 - totalW) / 2;
  badges.forEach((b, bi) => {
    const bx = startX + bi * (bw + 0.3);
    title.addShape(pptx.ShapeType.roundRect, { x: bx, y: 4.5, w: bw, h: 0.75, fill: { type: 'solid', color: T2.card }, line: { color: PPTX_ACCENTS[bi % PPTX_ACCENTS.length], width: 1.5 }, rectRadius: 0.12 });
    title.addText(b.label, { x: bx, y: 4.5, w: bw, h: 0.75, fontSize: 13, bold: true, color: T2.text, align: 'center', valign: 'middle' });
  });
  title.addText('Prepared by AURA-Transform  •  ' + new Date().toLocaleDateString(), { x: 0.5, y: 6.9, w: 12.33, h: 0.35, fontSize: 11, color: T2.sub, align: 'center' });

  const groups = splitIntoPointGroups(output, 3);
  groups.forEach((points, gi) => {
    const slide = pptx.addSlide();
    slide.background = { fill: T2.bg };
    slide.addText(gi === 0 ? 'Key Findings' : `Key Findings (cont.)`, { x: 0.3, y: 0.15, w: 12.73, h: 0.7, fontSize: 30, bold: true, color: T2.text, fontFace: 'Calibri' });
    const ch = points.length === 1 ? 5.4 : points.length === 2 ? 2.6 : 1.75;
    points.forEach((pt, j) => {
      const ccolor = PPTX_ACCENTS[j % PPTX_ACCENTS.length];
      const cy = 1.15 + j * (ch + 0.2);
      slide.addShape(pptx.ShapeType.roundRect, { x: 0.3, y: cy, w: 12.73, h: ch, fill: pHex(T2.card), line: { color: ccolor, width: 2 }, rectRadius: 0.14 });
      slide.addShape(pptx.ShapeType.rect, { x: 0.3, y: cy + 0.1, w: 0.07, h: ch - 0.2, fill: pHex(ccolor), line: { color: ccolor } });
      slide.addText(pt, { x: 0.55, y: cy + 0.1, w: 12.2, h: ch - 0.2, fontSize: 15, color: T2.text, valign: 'middle', wrap: true });
    });
    _pptFooter(slide, gi);
  });

  if (biasReport || verdict) {
    const slide = pptx.addSlide();
    slide.background = { fill: T2.bg };
    slide.addText('Bias Check & Verification', { x: 0.3, y: 0.15, w: 12.73, h: 0.7, fontSize: 30, bold: true, color: T2.text, fontFace: 'Calibri' });
    const cols = [
      { title: 'Bias / Contradiction Check', body: biasReport || 'Not run.', color: /no contradiction/i.test(biasReport || '') ? '2BC48A' : 'F2A93B', icon: /no contradiction/i.test(biasReport || '') ? '✓' : '⚠' },
      { title: 'Fact Verification', body: verdict || 'Not run.', color: '2BC48A', icon: '✓' },
    ];
    cols.forEach((col, ci) => {
      const cx = 0.3 + ci * 6.55;
      slide.addShape(pptx.ShapeType.roundRect, { x: cx, y: 1.25, w: 6.25, h: 4.8, fill: pHex(T2.card), line: { color: col.color, width: 2.5 }, rectRadius: 0.15 });
      slide.addShape(pptx.ShapeType.ellipse, { x: cx + 2.7, y: 1.55, w: 0.9, h: 0.9, fill: { type: 'solid', color: col.color, transparency: 70 }, line: { color: col.color, width: 1.5 } });
      slide.addText(col.icon, { x: cx + 2.7, y: 1.55, w: 0.9, h: 0.9, fontSize: 22, align: 'center', valign: 'middle' });
      slide.addText(col.title, { x: cx + 0.2, y: 2.6, w: 5.85, h: 0.5, fontSize: 16, bold: true, color: col.color, align: 'center' });
      slide.addText(col.body, { x: cx + 0.35, y: 3.2, w: 5.55, h: 2.7, fontSize: 12.5, color: T2.sub, align: 'center', valign: 'top', wrap: true });
    });
    _pptFooter(slide, 99);
  }

  const srcList = sources || [];
  for (let i = 0; i < srcList.length; i += 4) {
    const slide = pptx.addSlide();
    slide.background = { fill: T2.bg };
    slide.addText(i === 0 ? 'Sources Checked' : 'Sources Checked (cont.)', { x: 0.3, y: 0.15, w: 12.73, h: 0.7, fontSize: 30, bold: true, color: T2.text, fontFace: 'Calibri' });
    srcList.slice(i, i + 4).forEach((s, j) => {
      const ccolor = s.confidence === 'high' ? '2BC48A' : s.confidence === 'med' ? 'F2A93B' : 'FF8A75';
      const iy = 1.25 + j * 1.28;
      slide.addShape(pptx.ShapeType.ellipse, { x: 0.3, y: iy + 0.1, w: 0.75, h: 0.75, fill: pHex(ccolor), line: { color: ccolor } });
      slide.addText(String(i + j + 1), { x: 0.3, y: iy + 0.1, w: 0.75, h: 0.75, fontSize: 15, bold: true, color: '000000', align: 'center', valign: 'middle' });
      slide.addShape(pptx.ShapeType.roundRect, { x: 1.3, y: iy, w: 11.7, h: 1.1, fill: pHex(T2.card), line: { color: ccolor, width: 1.5 }, rectRadius: 0.1 });
      slide.addText((s.title || '').substring(0, 90), { x: 1.5, y: iy + 0.08, w: 11.3, h: 0.5, fontSize: 14, bold: true, color: T2.text, valign: 'middle' });
      slide.addText(`${s.source || ''}  ·  ${(s.confidence || '').toUpperCase()} CONFIDENCE`, { x: 1.5, y: iy + 0.58, w: 11.3, h: 0.42, fontSize: 11, color: T2.sub, valign: 'middle' });
    });
    _pptFooter(slide, 100 + i);
  }

  const safeName = templateLabel.replace(/[^a-z0-9]/gi, '_').substring(0, 30);
  await pptx.writeFile({ fileName: `AURA_${safeName}.pptx` });
}

async function generateFlashcards(structured) {
  const raw = await callAI([
    { role: 'system', content: 'Generate 8 flashcards (question+answer pairs) testing the key facts, figures, and claims in this brief. Each card needs a short category label, a difficulty of Easy, Medium, or Hard, and an optional one-line hint. Respond ONLY as JSON: {"cards":[{"front":"question","back":"answer","category":"label","difficulty":"Easy","hint":"short hint"}]}. No prose, no markdown fences.' },
    { role: 'user', content: structured },
  ], 900);
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Could not generate flashcards from this brief.');
  const parsed = JSON.parse(match[0]);
  return parsed.cards || [];
}

// ─── ATOMIC CLAIM-BY-CLAIM FACT-CHECK — verdict per sentence, not one blob ───
async function checkClaims(structured, sourceList) {
  const raw = await callAI([
    { role: 'system', content: 'Break the following brief into its individual factual claims (roughly one per sentence). For each claim, using ONLY the given numbered sources, assign a verdict: "verified" (directly supported by a cited source), "misleading" (partially true but missing context or overstated), "false" (contradicted by a source or clearly wrong), or "unverified" (no source ties to it — this is normal for framing/connective sentences). Give a short one-line note explaining why. Respond ONLY as JSON: {"claims":[{"sentence":"exact short sentence or clause copied from the brief","verdict":"verified","note":"short reason"}]}. Copy "sentence" text closely from the brief so it can be matched back. No prose, no markdown fences.' },
    { role: 'user', content: `Sources:\n${sourceList}\n\nBrief:\n${structured}` },
  ], 1300);
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return [];
  try { return JSON.parse(match[0]).claims || []; } catch { return []; }
}

// ─── DEVIL'S ADVOCATE — an adversarial second pass that challenges the brief ───
async function runDevilsAdvocate(structured, sourceList) {
  const raw = await callAI([
    { role: 'system', content: 'You are a skeptical adversarial reviewer, actively trying to poke holes in the brief below. List up to 5 short, sharp critiques: overstated claims, missing context, cherry-picked or weak evidence, one-sided framing, or logical gaps. Be genuinely critical, not diplomatic. If the brief is genuinely solid, say so plainly instead of inventing issues. Respond ONLY as JSON: {"critiques":["point 1","point 2"]}. No prose, no markdown fences.' },
    { role: 'user', content: `Sources:\n${sourceList}\n\nBrief:\n${structured}` },
  ], 500);
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return [];
  try { return JSON.parse(match[0]).critiques || []; } catch { return []; }
}

// ─── WHATSAPP FORWARD CHECKER — misinformation-pattern triage for social forwards ───
async function checkWhatsAppForward(text) {
  const raw = await callAI([
    { role: 'system', content: 'You are a misinformation triage tool for WhatsApp and social-media forwards, a common vector in India. Analyze the message for common fake-forward red flags: urgency or fear-based language, unverifiable appeals to authority ("doctor said", "forwarded as received", "my friend in the government"), absence of a named/checkable source, requests to forward widely, claims that are too sensational or too good/bad to be true, and stories that look outdated or recycled. Respond ONLY as JSON: {"riskLevel":"high|medium|low","redFlags":["flag 1","flag 2"],"summary":"one or two plain-language sentences on the overall verdict","recommendation":"one short actionable tip for the person who received this"}. No prose, no markdown fences.' },
    { role: 'user', content: text.slice(0, 3000) },
  ], 500);
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Could not analyze this message.');
  return JSON.parse(match[0]);
}

// ═══════════════════════════════════════════════════════════════════════
//  THEME — matches the MK AI homepage: emerald / sky-blue / saffron on white
// ═══════════════════════════════════════════════════════════════════════
const T = {
  bg: '#f6faf7',
  bgGrad: 'radial-gradient(ellipse 900px 500px at 10% -10%, rgba(15,169,104,.10), transparent), radial-gradient(ellipse 700px 500px at 100% 10%, rgba(21,150,214,.08), transparent), #f6faf7',
  glass: 'rgba(255,255,255,.62)',
  glassBg: 'linear-gradient(135deg, rgba(255,255,255,.62), rgba(255,255,255,.22))',
  glassBorder: 'rgba(255,255,255,.68)',
  navy: '#0E77AC',
  purple: '#0FA968',
  purpleSoft: 'rgba(15,169,104,.10)',
  navySoft: 'rgba(21,150,214,.08)',
  grad: 'linear-gradient(135deg,#0FA968,#1596D6)',
  ink: '#122420',
  inkSoft: '#3c4a44',
  inkMuted: '#5c6b64',
  border: 'rgba(18,54,42,.10)',
  card: '#FFFEFB',
  emerald: '#0C8457',
  emeraldSoft: 'rgba(12,132,87,.10)',
  amber: '#B8842C',
  amberSoft: 'rgba(242,169,59,.16)',
  red: '#B5503F',
  redSoft: 'rgba(181,80,63,.10)',
  shadow: '0 24px 70px rgba(15,90,70,.10)',
  glassShadow: '0 10px 34px rgba(15,90,70,.14), inset 0 1px 0 rgba(255,255,255,.55)',
};

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;650;700;800&display=swap');
*{box-sizing:border-box;}
@keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
@keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
@keyframes glow{0%,100%{opacity:.35}50%{opacity:.7}}
@keyframes popIn{from{opacity:0;transform:scale(.92)}to{opacity:1;transform:scale(1)}}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes flipIn{from{transform:rotateY(90deg);opacity:0}to{transform:rotateY(0deg);opacity:1}}
.at-orb{position:absolute;border-radius:50%;filter:blur(90px);animation:glow 7s ease-in-out infinite;pointer-events:none;}
.at-card{background:${T.glassBg};backdrop-filter:blur(18px) saturate(160%);-webkit-backdrop-filter:blur(18px) saturate(160%);border:1px solid ${T.glassBorder};border-radius:22px;box-shadow:${T.glassShadow};}
.at-btn{transition:transform .18s ease,box-shadow .18s ease,opacity .18s ease;}
.at-btn:hover{transform:translateY(-2px);}
.at-btn:active{transform:translateY(0) scale(.98);}
.at-src{animation:fadeUp .4s ease both;}
.at-shimmerbar{background:linear-gradient(90deg,${T.purpleSoft},${T.purple},${T.purpleSoft});background-size:200% 100%;animation:shimmer 1.4s linear infinite;}
.at-spin{animation:spin .8s linear infinite;}
.at-tab{padding:8px 14px;border-radius:12px;cursor:pointer;font-size:12.5px;font-weight:600;font-family:inherit;border:1px solid transparent;white-space:nowrap;}
.at-flash{animation:flipIn .35s ease both;perspective:1000px;}
.at-citehl{transition:background .3s ease, box-shadow .3s ease;}
`;

// ═══════════════════════════════════════════════════════════════════════
//  KNOWLEDGE GRAPH — lightweight SVG node-link diagram, no extra library
// ═══════════════════════════════════════════════════════════════════════
function KnowledgeGraph({ nodes = [], edges = [] }) {
  const [hovered, setHovered] = useState(null);
  if (!nodes.length) {
    return <p style={{ color: T.inkMuted, fontSize: 13, textAlign: 'center', padding: 30 }}>No entities extracted for this brief.</p>;
  }
  const size = 460;
  const cx = size / 2, cy = size / 2, r = size / 2 - 70;
  const positions = {};
  nodes.forEach((n, i) => {
    const angle = (2 * Math.PI * i) / nodes.length - Math.PI / 2;
    positions[n.id] = { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
  });
  const isConnected = (id) => hovered && edges.some(e => (e.from === hovered && e.to === id) || (e.to === hovered && e.from === id) || hovered === id);

  return (
    <svg viewBox={`0 0 ${size} ${size}`} style={{ width: '100%', maxWidth: size, display: 'block', margin: '0 auto' }}>
      {edges.map((e, i) => {
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
      {nodes.map(n => {
        const p = positions[n.id];
        if (!p) return null;
        const active = !hovered || isConnected(n.id);
        return (
          <g key={n.id} opacity={active ? 1 : 0.25} style={{ cursor: 'pointer' }}
             onMouseEnter={() => setHovered(n.id)} onMouseLeave={() => setHovered(null)}>
            <circle cx={p.x} cy={p.y} r={26} fill="#fff" stroke={T.navy} strokeWidth={2} />
            <text x={p.x} y={p.y + 42} fontSize={11} fontWeight={600} fill={T.ink} textAnchor="middle">
              {n.label.length > 16 ? n.label.slice(0, 14) + '…' : n.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  FLASHCARD VIEWER — flip cards testing the brief's key facts
// ═══════════════════════════════════════════════════════════════════════
function FlashcardViewer({ cards, onClose }) {
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [showHint, setShowHint] = useState(false);

  if (!cards || !cards.length) return null;
  const card = cards[idx];
  const diffColor = card.difficulty === 'Hard' ? T.red : card.difficulty === 'Medium' ? T.amber : T.emerald;
  const diffBg = card.difficulty === 'Hard' ? T.redSoft : card.difficulty === 'Medium' ? T.amberSoft : T.emeraldSoft;

  const go = (delta) => {
    setFlipped(false); setShowHint(false);
    setIdx(i => Math.max(0, Math.min(cards.length - 1, i + delta)));
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(12,32,26,.42)', backdropFilter: 'blur(4px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={onClose}>
      <div className="at-card" style={{ width: '100%', maxWidth: 520, padding: 26, position: 'relative' }} onClick={e => e.stopPropagation()}>
        <button onClick={onClose} style={{ position: 'absolute', top: 14, right: 16, background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: T.inkMuted }}>✕</button>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: T.inkMuted, letterSpacing: 0.5, textTransform: 'uppercase' }}>Card {idx + 1} / {cards.length}</span>
          <div style={{ display: 'flex', gap: 6 }}>
            {card.category && <span style={{ fontSize: 10.5, fontWeight: 700, padding: '3px 9px', borderRadius: 10, background: T.purpleSoft, color: T.purple }}>{card.category}</span>}
            {card.difficulty && <span style={{ fontSize: 10.5, fontWeight: 700, padding: '3px 9px', borderRadius: 10, background: diffBg, color: diffColor }}>{card.difficulty}</span>}
          </div>
        </div>

        <div className="at-flash" key={idx} onClick={() => setFlipped(f => !f)} style={{
          minHeight: 180, borderRadius: 16, cursor: 'pointer', padding: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center',
          background: flipped ? T.grad : 'rgba(255,255,255,.9)', border: `1.5px solid ${flipped ? 'transparent' : T.border}`,
        }}>
          <p style={{ fontSize: 16.5, fontWeight: 600, color: flipped ? '#fff' : T.ink, lineHeight: 1.6, margin: 0 }}>
            {flipped ? card.back : card.front}
          </p>
        </div>
        <p style={{ textAlign: 'center', fontSize: 11.5, color: T.inkMuted, marginTop: 8 }}>{flipped ? '↺ Click to see question' : '👆 Click card to reveal answer'}</p>

        {card.hint && !flipped && (
          <div style={{ textAlign: 'center', marginTop: 6 }}>
            {showHint
              ? <p style={{ fontSize: 12.5, color: T.amber, fontStyle: 'italic' }}>💡 {card.hint}</p>
              : <button onClick={() => setShowHint(true)} style={{ background: 'none', border: 'none', color: T.purple, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Show hint</button>}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 22 }}>
          <button className="at-btn" onClick={() => go(-1)} disabled={idx === 0} style={{ background: 'rgba(18,54,42,.06)', border: 'none', padding: '8px 16px', borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', color: T.ink, opacity: idx === 0 ? 0.4 : 1 }}>← Prev</button>
          <div style={{ display: 'flex', gap: 4 }}>
            {cards.map((_, i) => (
              <span key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: i === idx ? T.purple : 'rgba(18,54,42,.15)' }} />
            ))}
          </div>
          <button className="at-btn" onClick={() => go(1)} disabled={idx === cards.length - 1} style={{ background: T.grad, border: 'none', padding: '8px 16px', borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', color: '#fff', opacity: idx === cards.length - 1 ? 0.4 : 1 }}>Next →</button>
          </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  INPUT MODES
// ═══════════════════════════════════════════════════════════════════════
const INPUT_MODES = [
  { id: 'text', label: '📝 Text' },
  { id: 'pdf', label: '📄 PDF' },
  { id: 'image', label: '🖼️ Image' },
  { id: 'audio', label: '🎙️ Audio/Video' },
  { id: 'youtube', label: '▶️ YouTube' },
  { id: 'url', label: '🔗 Web URL' },
  { id: 'whatsapp', label: '📱 WhatsApp Forward' },
];

// ── split brief text into rough sentences for the heatmap ──
function splitSentences(text) {
  return (text || '').replace(/\[(\d+)\]/g, ' [$1]').split(/(?<=[.!?])\s+(?=[A-Z"“(])|\n+/).map(s => s.trim()).filter(Boolean);
}
// ── fuzzy word-overlap match between a heatmap sentence and an AI-returned claim sentence ──
function bestClaimMatch(sentence, claims) {
  if (!claims || !claims.length) return null;
  const norm = s => (s || '').toLowerCase().replace(/[^\w\s]/g, ' ').split(/\s+/).filter(w => w.length > 3);
  const target = new Set(norm(sentence));
  if (!target.size) return null;
  let best = null, bestScore = 0;
  claims.forEach(c => {
    const words = norm(c.sentence);
    if (!words.length) return;
    const overlap = words.filter(w => target.has(w)).length;
    const score = overlap / Math.max(words.length, target.size);
    if (score > bestScore) { bestScore = score; best = c; }
  });
  return bestScore >= 0.3 ? best : null;
}
const VERDICT_STYLE = {
  verified: { bg: 'rgba(12,132,87,.14)', border: 'rgba(12,132,87,.35)', color: '#0C8457', label: 'Verified', icon: '✅' },
  misleading: { bg: 'rgba(184,132,44,.16)', border: 'rgba(184,132,44,.4)', color: '#B8842C', label: 'Misleading', icon: '⚠️' },
  false: { bg: 'rgba(181,80,63,.16)', border: 'rgba(181,80,63,.4)', color: '#B5503F', label: 'False', icon: '❌' },
  unverified: { bg: 'transparent', border: 'transparent', color: '#5c6b64', label: 'Unverified', icon: '❓' },
};

// ═══════════════════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════
export default function AuraTransform() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  // input
  const [mode, setMode] = useState('text');
  const [input, setInput] = useState('');
  const [sourceLabel, setSourceLabel] = useState('');
  const [urlValue, setUrlValue] = useState('');
  const [lang, setLang] = useState('English');
  const [template, setTemplate] = useState('general');

  // extraction state (per input mode)
  const [extracting, setExtracting] = useState(false);
  const [extractProgress, setExtractProgress] = useState(0);
  const [extractError, setExtractError] = useState('');

  // pipeline state
  const [stage, setStage] = useState(null); // null | retrieve | structure | bias | verify | graph | done
  const [sources, setSources] = useState([]);
  const [output, setOutput] = useState('');
  const [biasReport, setBiasReport] = useState('');
  const [verdict, setVerdict] = useState('');
  const [trustScore, setTrustScore] = useState(null);
  const [graph, setGraph] = useState({ nodes: [], edges: [] });
  const [viewMode, setViewMode] = useState('brief'); // brief | graph
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState('');

  // ── flashcards ──
  const [flashcards, setFlashcards] = useState(null);
  const [showFlashcards, setShowFlashcards] = useState(false);
  const [flashcardsLoading, setFlashcardsLoading] = useState(false);

  // ── feedback (human-in-the-loop) — per-source thumbs, persisted locally ──
  const [feedback, setFeedback] = useState(() => {
    try { return JSON.parse(localStorage.getItem('aura_feedback') || '{}'); } catch { return {}; }
  });

  // ── performance metrics ──
  const [metrics, setMetrics] = useState(null); // { total, stages: {retrieve: ms, ...} }
  const [highlightedSource, setHighlightedSource] = useState(null);

  // ── claim-by-claim fact-check + heatmap ──
  const [claims, setClaims] = useState([]);
  const [heatmapOn, setHeatmapOn] = useState(true);

  // ── devil's advocate ──
  const [critiques, setCritiques] = useState([]);

  // ── WhatsApp forward quick-checker (separate lightweight flow) ──
  const [waInput, setWaInput] = useState('');
  const [waChecking, setWaChecking] = useState(false);
  const [waResult, setWaResult] = useState(null);
  const [waError, setWaError] = useState('');

  const langRule = LANGUAGES[lang];
  const templateDesc = TEMPLATES[template].desc;

  // ── input-mode handlers ──
  const handleFile = useCallback(async (file) => {
    if (!file) return;
    setExtractError(''); setExtractProgress(0); setExtracting(true);
    try {
      let text;
      if (mode === 'pdf') text = await extractPdfText(file);
      else if (mode === 'image') text = await extractImageText(file, setExtractProgress);
      else if (mode === 'audio') text = await transcribeAudio(file);
      setInput(text);
      setSourceLabel(`${mode === 'pdf' ? 'PDF' : mode === 'image' ? 'Image OCR' : 'Audio transcript'} · ${file.name}`);
    } catch (e) {
      setExtractError(e.message);
    } finally {
      setExtracting(false);
    }
  }, [mode]);

  const handleYouTube = useCallback(async () => {
    if (!urlValue.trim()) { setExtractError('Paste a YouTube link first.'); return; }
    setExtractError(''); setExtracting(true);
    try {
      const { videoId, transcript } = await fetchYouTubeTranscript(urlValue);
      setInput(transcript);
      setSourceLabel(`YouTube transcript · ${videoId}`);
    } catch (e) {
      setExtractError(e.message);
    } finally {
      setExtracting(false);
    }
  }, [urlValue]);

  const handleUrlFetch = useCallback(async () => {
    if (!urlValue.trim()) { setExtractError('Paste a URL first.'); return; }
    setExtractError(''); setExtracting(true);
    try {
      const text = await fetchUrlContent(urlValue);
      setInput(text);
      setSourceLabel(`Web page · ${urlValue.trim()}`);
    } catch (e) {
      setExtractError(e.message);
    } finally {
      setExtracting(false);
    }
  }, [urlValue]);

  // ── WhatsApp forward quick-check (separate lightweight flow, no full pipeline) ──
  const handleWhatsAppCheck = useCallback(async () => {
    if (!waInput.trim()) { setWaError('Paste the forwarded message first.'); return; }
    setWaError(''); setWaChecking(true); setWaResult(null);
    try {
      const result = await checkWhatsAppForward(waInput);
      setWaResult(result);
    } catch (e) {
      setWaError(e.message);
    } finally {
      setWaChecking(false);
    }
  }, [waInput]);

  // ── main pipeline ──
  const run = useCallback(async () => {
    if (!input.trim()) { setError('Kuch content chahiye pehle — text paste karo ya koi file/URL se extract karo.'); return; }
    setError(''); setSources([]); setOutput(''); setBiasReport(''); setVerdict('');
    setTrustScore(null); setGraph({ nodes: [], edges: [] }); setViewMode('brief');
    setMetrics(null); setFlashcards(null); setClaims([]); setCritiques([]);
    const t0 = performance.now();
    const stageTimes = {};
    const mark = (name, start) => { stageTimes[name] = Math.round(performance.now() - start); };

    try {
      let ts = performance.now();
      setStage('retrieve');
      const category = detectCategory(input);
      const queryPlanRaw = await callAI([
        { role: 'system', content: 'Extract 2-3 short, specific search queries (topics, entities, or claims) from the text that should be independently verified. Respond ONLY as a JSON array of strings.' },
        { role: 'user', content: input.slice(0, 3000) },
      ], 300);
      let queries;
      try { queries = JSON.parse(queryPlanRaw.match(/\[[\s\S]*\]/)[0]); } catch { queries = [input.slice(0, 60)]; }

      const found = await buildSourceList(queries, category);
      setSources(found);
      mark('retrieve', ts); ts = performance.now();

      setStage('structure');
      const sourceList = found.map((s, i) => `[${i + 1}] ${s.title} — ${s.source}`).join('\n');
      const structured = await callAI([
        { role: 'system', content: `You transform raw content into ${templateDesc}, written in ${langRule} Every factual claim must end with a citation like [1] or [2] referencing ONLY the numbered sources given. If a claim can't be tied to a given source, state it as unverified context without a citation number. Never invent sources.` },
        { role: 'user', content: `Sources:\n${sourceList}\n\nContent to transform:\n${input.slice(0, 4000)}` },
      ], 1400);
      setOutput(structured);
      mark('structure', ts); ts = performance.now();

      setStage('bias');
      const biasRaw = await callAI([
        { role: 'system', content: 'Compare the numbered sources against each other and against the brief. In 1-3 short sentences, flag any contradicting facts between sources, or say "No contradictions found between the given sources." Do not invent issues that are not present.' },
        { role: 'user', content: `Sources:\n${sourceList}\n\nBrief:\n${structured}` },
      ], 220);
      setBiasReport(biasRaw);
      mark('bias', ts); ts = performance.now();

      setStage('verify');
      const verdictRaw = await callAI([
        { role: 'system', content: 'You are a strict fact-checking pass. Given the brief and the source list, reply in ONE short sentence: how many citation-tagged claims are consistent with their cited source titles, and flag any mismatch.' },
        { role: 'user', content: `Sources:\n${sourceList}\n\nBrief:\n${structured}` },
      ], 200);
      setVerdict(verdictRaw);
      mark('verify', ts); ts = performance.now();

      setStage('claimcheck');
      const claimList = await checkClaims(structured, sourceList);
      setClaims(claimList);
      mark('claimcheck', ts); ts = performance.now();

      setStage('devil');
      const critiqueList = await runDevilsAdvocate(structured, sourceList);
      setCritiques(critiqueList);
      mark('devil', ts); ts = performance.now();

      const highCount = found.filter(s => s.confidence === 'high').length;
      const medCount = found.filter(s => s.confidence === 'med').length;
      const lowCount = found.filter(s => s.confidence === 'low').length;
      const total = found.length || 1;
      setTrustScore(Math.round(((highCount * 1 + medCount * 0.6) / total) * 100));

      setStage('graph');
      try {
        const graphRaw = await callAI([
          { role: 'system', content: 'Extract the key entities (people, organizations, places, concepts — max 8) from the brief and the relationships between them (max 10 edges). Respond ONLY as JSON: {"nodes":[{"id":"n1","label":"..."}],"edges":[{"from":"n1","to":"n2","label":"..."}]}. No prose, no markdown fences.' },
          { role: 'user', content: structured },
        ], 500);
        setGraph(JSON.parse(graphRaw.match(/\{[\s\S]*\}/)[0]));
      } catch { /* graph is optional */ }
      mark('graph', ts);

      setMetrics({
        totalMs: Math.round(performance.now() - t0),
        stages: stageTimes,
        sourceBreakdown: { high: highCount, med: medCount, low: lowCount, total: found.length },
        wordCount: input.trim().split(/\s+/).length,
        claimBreakdown: {
          verified: claimList.filter(c => c.verdict === 'verified').length,
          misleading: claimList.filter(c => c.verdict === 'misleading').length,
          false: claimList.filter(c => c.verdict === 'false').length,
          unverified: claimList.filter(c => c.verdict === 'unverified').length,
        },
      });

      setStage('done');
    } catch (e) {
      setError(e.message);
      setStage(null);
    }
  }, [input, langRule, templateDesc]);

  // ── flashcards ──
  const handleFlashcards = useCallback(async () => {
    if (flashcards) { setShowFlashcards(true); return; }
    setFlashcardsLoading(true); setError('');
    try {
      const cards = await generateFlashcards(output);
      setFlashcards(cards);
      setShowFlashcards(true);
    } catch (e) {
      setError(`Flashcards failed: ${e.message}`);
    } finally {
      setFlashcardsLoading(false);
    }
  }, [output, flashcards]);

  // ── feedback (human-in-the-loop): thumbs up/down per source ──
  const rateSource = useCallback((idx, val) => {
    setFeedback(prev => {
      const key = sources[idx]?.title || String(idx);
      const next = { ...prev, [key]: prev[key] === val ? null : val };
      try { localStorage.setItem('aura_feedback', JSON.stringify(next)); } catch {}
      return next;
    });
  }, [sources]);

  // ── click a [n] citation in the brief → highlight the matching source row ──
  const jumpToSource = useCallback((n) => {
    setHighlightedSource(n - 1);
    const el = document.getElementById(`aura-source-${n - 1}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => setHighlightedSource(null), 2200);
  }, []);

  const doExport = useCallback(async (type) => {
    setExporting(type);
    try {
      if (type === 'json') exportJSON({ input, output, sources, biasReport, verdict, trustScore, graph, lang, template });
      else if (type === 'pdf') await exportPDFFile({ output, sources, verdict, biasReport, trustScore });
      else if (type === 'ppt') await exportPPTFile({ output, sources, trustScore });
    } catch (e) {
      setError(`Export failed: ${e.message}`);
    } finally {
      setExporting('');
    }
  }, [input, output, sources, biasReport, verdict, trustScore, graph, lang, template]);

  function renderCited(text) {
    return text.split(/(\[\d+\])/g).map((part, i) => {
      const m = part.match(/^\[(\d+)\]$/);
      if (m) return (
        <span key={i} title={sources[parseInt(m[1], 10) - 1]?.title || 'Jump to source'} onClick={() => jumpToSource(parseInt(m[1], 10))}
          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: T.purpleSoft, color: T.purple, fontSize: 11, fontWeight: 700, borderRadius: 5, padding: '1px 6px', margin: '0 2px', cursor: 'pointer' }}>
          {m[1]}
        </span>
      );
      return <span key={i}>{part}</span>;
    });
  }

  // ── sentence-level confidence heatmap: colors each sentence by its matched claim verdict ──
  function renderHeatmap(text) {
    const sentences = splitSentences(text);
    return sentences.map((s, i) => {
      const match = bestClaimMatch(s, claims);
      const style = match ? VERDICT_STYLE[match.verdict] : VERDICT_STYLE.unverified;
      return (
        <span key={i} title={match ? `${style.label}: ${match.note}` : 'No matching claim analysis'} style={{
          background: style.bg, borderBottom: match && match.verdict !== 'unverified' ? `2px solid ${style.border}` : 'none',
          borderRadius: 3, padding: match && match.verdict !== 'unverified' ? '1px 3px' : 0, marginRight: 3, lineHeight: 1.9,
        }}>
          {renderCited(s + ' ')}
        </span>
      );
    });
  }

  const badgeStyle = (conf) => {
    if (conf === 'high') return { bg: T.emeraldSoft, color: T.emerald, label: 'HIGH CONF.' };
    if (conf === 'med') return { bg: T.amberSoft, color: T.amber, label: 'MED CONF.' };
    return { bg: T.redSoft, color: T.red, label: 'UNVERIFIED' };
  };

  const stages = [
    { id: 'retrieve', label: 'Retrieve sources' },
    { id: 'structure', label: 'Structure content' },
    { id: 'bias', label: 'Check bias' },
    { id: 'verify', label: 'Verify claims' },
    { id: 'claimcheck', label: 'Atomic fact-check' },
    { id: 'devil', label: "Devil's advocate" },
    { id: 'graph', label: 'Map entities' },
  ];
  const stageIndex = stage ? stages.findIndex(s => s.id === stage) : (stage === 'done' ? stages.length : -1);
  const isDone = stage === 'done';

  const accept = mode === 'pdf' ? '.pdf' : mode === 'image' ? 'image/*' : mode === 'audio' ? 'audio/*,video/*' : undefined;

  return (
    <div style={{ minHeight: '100vh', background: T.bgGrad, color: T.ink, fontFamily: "Inter,ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif", position: 'relative', overflowX: 'hidden' }}>

      <Helmet>
        <title>AURA-Transform — Verified AI Content Transformation | MK AI</title>
        <meta name="description" content="Transform content with verified, cited AI outputs using AURA-Transform, part of the MK AI platform." />
      </Helmet>
      <style>{CSS}</style>
      <div className="at-orb" style={{ width: 460, height: 460, top: -160, left: -140, background: T.purple, opacity: 0.14 }} />
      <div className="at-orb" style={{ width: 360, height: 360, bottom: -120, right: -100, background: T.navy, opacity: 0.10, animationDelay: '3s' }} />

      <header style={{ position: 'sticky', top: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 26px', background: 'rgba(246,250,247,.85)', backdropFilter: 'blur(16px)', borderBottom: `1px solid ${T.border}` }}>
        <button className="at-btn" style={{ background: 'transparent', border: `1px solid ${T.border}`, color: T.inkSoft, padding: '8px 16px', borderRadius: 20, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }} onClick={() => navigate('/')}>← Back</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 20 }}>🔮</span>
          <span style={{ fontFamily: "'Inter',sans-serif", fontSize: 16, fontWeight: 800, background: T.grad, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', letterSpacing: '-.01em' }}>AURA-Transform</span>
        </div>
        <span style={{ fontSize: 11, color: T.inkMuted }}>6 input modes · 13+ sources</span>
      </header>

      <main style={{ maxWidth: 1000, margin: '0 auto', padding: '44px 22px 90px', position: 'relative', zIndex: 1 }}>

        <div style={{ textAlign: 'center', marginBottom: 34, animation: 'fadeUp .5s ease' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: T.purpleSoft, border: `1px solid rgba(15,169,104,.2)`, padding: '6px 16px', borderRadius: 100, fontSize: 12, fontWeight: 600, color: T.emerald, marginBottom: 18 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: T.purple, animation: 'glow 2s ease infinite' }} />
            Gen AI Platform for Automated Content Transformation · SIH26154
          </div>
          <h1 style={{ fontFamily: "'Inter',sans-serif", fontSize: 'clamp(30px,4vw,44px)', fontWeight: 750, margin: '0 0 12px', letterSpacing: '-0.03em' }}>
            Any format in, <span style={{ color: T.emerald }}>proven</span> intelligence out
          </h1>
          <p style={{ color: T.inkSoft, fontSize: 15.5, maxWidth: 580, margin: '0 auto' }}>Text, PDFs, images, audio, YouTube or any web page — AURA pulls real sources, structures the content, checks it for bias, and shows exactly where every claim came from.</p>
        </div>

        {/* Input card */}
        <div className="at-card" style={{ padding: 26, marginBottom: 8, animation: 'fadeUp .5s .05s ease both' }}>

          {/* input mode tabs */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
            {INPUT_MODES.map(m => (
              <button key={m.id} className="at-tab at-btn" onClick={() => { setMode(m.id); setExtractError(''); }} style={{
                background: mode === m.id ? T.grad : 'rgba(18,54,42,.05)', color: mode === m.id ? '#fff' : T.inkSoft,
              }}>{m.label}</button>
            ))}
          </div>

          {/* mode-specific input controls */}
          {mode === 'text' && (
            <textarea
              value={input}
              onChange={e => { setInput(e.target.value); setSourceLabel(''); }}
              placeholder="Paste a report excerpt, article, meeting notes, anything unstructured..."
              style={{ width: '100%', minHeight: 150, background: 'rgba(255,255,255,.7)', border: `1px solid ${T.border}`, borderRadius: 14, padding: 16, fontSize: 14.5, color: T.ink, fontFamily: 'inherit', resize: 'vertical', outline: 'none' }}
            />
          )}

          {(mode === 'pdf' || mode === 'image' || mode === 'audio') && (
            <div style={{ border: `1.5px dashed ${T.border}`, borderRadius: 14, padding: 28, textAlign: 'center', background: 'rgba(255,255,255,.5)' }}>
              <input ref={fileInputRef} type="file" accept={accept} style={{ display: 'none' }}
                onChange={e => handleFile(e.target.files?.[0])} />
              <p style={{ fontSize: 13.5, color: T.inkSoft, marginBottom: 14 }}>
                {mode === 'pdf' && 'Upload a PDF — text is extracted right in the browser.'}
                {mode === 'image' && 'Upload a screenshot or photo — OCR runs right in the browser.'}
                {mode === 'audio' && 'Upload audio or video (under 25MB) — transcribed via Whisper.'}
              </p>
              <button className="at-btn" onClick={() => fileInputRef.current?.click()} disabled={extracting} style={{
                background: T.grad, color: '#fff', border: 'none', padding: '10px 22px', borderRadius: 30, cursor: 'pointer', fontSize: 13.5, fontWeight: 700, fontFamily: 'inherit', opacity: extracting ? 0.6 : 1,
              }}>{extracting ? 'Processing…' : 'Choose file'}</button>
              {mode === 'image' && extracting && (
                <div style={{ marginTop: 14, height: 6, borderRadius: 4, background: 'rgba(18,54,42,.08)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${extractProgress}%`, background: T.grad, transition: 'width .2s ease' }} />
                </div>
              )}
              {sourceLabel && !extracting && <p style={{ fontSize: 12, color: T.emerald, marginTop: 12 }}>✓ {sourceLabel} — {input.length.toLocaleString()} characters extracted</p>}
            </div>
          )}

          {(mode === 'youtube' || mode === 'url') && (
            <div style={{ display: 'flex', gap: 10 }}>
              <input
                value={urlValue}
                onChange={e => setUrlValue(e.target.value)}
                placeholder={mode === 'youtube' ? 'https://www.youtube.com/watch?v=...' : 'https://example.com/article'}
                style={{ flex: 1, background: 'rgba(255,255,255,.7)', border: `1px solid ${T.border}`, borderRadius: 12, padding: '12px 16px', fontSize: 14, color: T.ink, fontFamily: 'inherit', outline: 'none' }}
              />
              <button className="at-btn" onClick={mode === 'youtube' ? handleYouTube : handleUrlFetch} disabled={extracting} style={{
                background: T.grad, color: '#fff', border: 'none', padding: '0 22px', borderRadius: 12, cursor: 'pointer', fontSize: 13.5, fontWeight: 700, fontFamily: 'inherit', opacity: extracting ? 0.6 : 1,
              }}>{extracting ? 'Fetching…' : 'Fetch'}</button>
            </div>
          )}
          {(mode === 'youtube' || mode === 'url') && sourceLabel && !extracting && (
            <p style={{ fontSize: 12, color: T.emerald, marginTop: 10 }}>✓ {sourceLabel} — {input.length.toLocaleString()} characters fetched</p>
          )}
          {extractError && <p style={{ color: T.red, fontSize: 13, marginTop: 10 }}>⚠ {extractError}</p>}

          {mode === 'whatsapp' && (
            <div>
              <p style={{ fontSize: 13, color: T.inkSoft, marginBottom: 10 }}>Paste a WhatsApp/social forward below — this runs a quick, dedicated misinformation-pattern check (separate from the main brief pipeline).</p>
              <textarea
                value={waInput}
                onChange={e => setWaInput(e.target.value)}
                placeholder="Paste the forwarded message here..."
                style={{ width: '100%', minHeight: 120, background: 'rgba(255,255,255,.7)', border: `1px solid ${T.border}`, borderRadius: 14, padding: 16, fontSize: 14, color: T.ink, fontFamily: 'inherit', resize: 'vertical', outline: 'none' }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
                <button className="at-btn" onClick={handleWhatsAppCheck} disabled={waChecking} style={{
                  background: T.grad, color: '#fff', border: 'none', padding: '10px 22px', borderRadius: 30, cursor: 'pointer', fontSize: 13.5, fontWeight: 700, fontFamily: 'inherit', opacity: waChecking ? 0.6 : 1,
                }}>{waChecking ? 'Analyzing…' : '📱 Quick Check'}</button>
              </div>
              {waError && <p style={{ color: T.red, fontSize: 13, marginTop: 10 }}>⚠ {waError}</p>}

              {waResult && (
                <div className="at-card" style={{ marginTop: 18, padding: 20, animation: 'popIn .35s ease' }}>
                  {(() => {
                    const rl = waResult.riskLevel;
                    const rc = rl === 'high' ? T.red : rl === 'medium' ? T.amber : T.emerald;
                    const rbg = rl === 'high' ? T.redSoft : rl === 'medium' ? T.amberSoft : T.emeraldSoft;
                    const icon = rl === 'high' ? '🚨' : rl === 'medium' ? '⚠️' : '✅';
                    return (
                      <>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: rbg, color: rc, padding: '6px 16px', borderRadius: 20, fontSize: 13, fontWeight: 700, marginBottom: 14 }}>
                          {icon} {(rl || 'unknown').toUpperCase()} MISINFORMATION RISK
                        </div>
                        <p style={{ fontSize: 14, color: T.ink, marginBottom: 14, lineHeight: 1.6 }}>{waResult.summary}</p>
                        {waResult.redFlags?.length > 0 && (
                          <>
                            <p style={{ fontSize: 11, fontWeight: 700, color: T.inkMuted, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 8 }}>Red flags detected</p>
                            <ul style={{ margin: '0 0 14px', paddingLeft: 18 }}>
                              {waResult.redFlags.map((f, i) => <li key={i} style={{ fontSize: 13, color: T.inkSoft, marginBottom: 6 }}>{f}</li>)}
                            </ul>
                          </>
                        )}
                        {waResult.recommendation && (
                          <div style={{ padding: '12px 16px', borderRadius: 12, background: T.purpleSoft, fontSize: 13, color: T.emerald, fontWeight: 500 }}>
                            💡 {waResult.recommendation}
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
          )}

          {/* preview of extracted text, editable, shown for non-text modes once populated */}
          {mode !== 'text' && input && (
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              style={{ width: '100%', minHeight: 110, marginTop: 14, background: 'rgba(255,255,255,.7)', border: `1px solid ${T.border}`, borderRadius: 14, padding: 16, fontSize: 13.5, color: T.inkSoft, fontFamily: 'inherit', resize: 'vertical', outline: 'none' }}
            />
          )}

          {/* template + language selectors */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, marginTop: 20 }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: T.inkMuted, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 8 }}>Brief format</p>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {Object.entries(TEMPLATES).map(([id, t]) => (
                  <button key={id} className="at-btn" onClick={() => setTemplate(id)} style={{
                    padding: '5px 12px', borderRadius: 14, cursor: 'pointer', fontSize: 11.5, fontWeight: 600, fontFamily: 'inherit', border: 'none',
                    background: template === id ? T.grad : 'rgba(18,54,42,.05)', color: template === id ? '#fff' : T.inkSoft,
                  }}>{t.label}</button>
                ))}
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 220 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: T.inkMuted, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 8 }}>Output language</p>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {Object.keys(LANGUAGES).map(l => (
                  <button key={l} className="at-btn" onClick={() => setLang(l)} style={{
                    padding: '5px 12px', borderRadius: 14, cursor: 'pointer', fontSize: 11.5, fontWeight: 600, fontFamily: 'inherit', border: 'none',
                    background: lang === l ? T.grad : 'rgba(18,54,42,.05)', color: lang === l ? '#fff' : T.inkSoft,
                  }}>{l}</button>
                ))}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
            <button className="at-btn" onClick={run} disabled={(stage && !isDone) || extracting} style={{
              background: T.grad, color: '#fff', border: 'none', padding: '13px 26px', borderRadius: 40, cursor: 'pointer',
              fontSize: 14.5, fontWeight: 700, fontFamily: 'inherit', boxShadow: '0 10px 24px rgba(15,150,120,.28)',
              opacity: (stage && !isDone) || extracting ? 0.6 : 1,
            }}>{stage && !isDone ? 'Working…' : '🪄 Transform'}</button>
          </div>
          {error && <p style={{ color: T.red, fontSize: 13, marginTop: 12 }}>⚠ {error}</p>}
        </div>

        {/* Pipeline trail */}
        {stage && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0, margin: '30px 0', flexWrap: 'wrap', animation: 'fadeUp .4s ease' }}>
            {stages.map((s, i) => (
              <React.Fragment key={s.id}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <div style={{
                    width: 10, height: 10, borderRadius: '50%',
                    background: i <= stageIndex ? T.purple : 'rgba(18,54,42,.15)',
                    boxShadow: i === stageIndex && !isDone ? `0 0 0 5px ${T.purpleSoft}` : 'none',
                    transition: 'all .3s ease',
                  }} />
                  <span style={{ fontSize: 13, color: i <= stageIndex ? T.ink : T.inkMuted, fontWeight: i === stageIndex ? 700 : 500 }}>{s.label}</span>
                </div>
                {i < stages.length - 1 && <div style={{ width: 34, height: 1, background: T.border, margin: '0 10px' }} />}
              </React.Fragment>
            ))}
          </div>
        )}

        {/* Split view */}
        {stage && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, animation: 'fadeUp .5s .1s ease both' }}>
            <div className="at-card" style={{ padding: 20 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: T.inkMuted, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 12 }}>Original — unstructured</p>
              <p style={{ fontFamily: 'monospace', fontSize: 12.5, color: T.inkSoft, whiteSpace: 'pre-wrap', maxHeight: 380, overflow: 'auto', lineHeight: 1.65 }}>{input}</p>
            </div>
            <div className="at-card" style={{ padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: T.inkMuted, letterSpacing: 0.6, textTransform: 'uppercase', margin: 0 }}>
                  {viewMode === 'brief' ? 'Structured output' : 'Knowledge graph'}
                </p>
                {(graph.nodes || []).length > 0 && (
                  <div style={{ display: 'flex', gap: 4 }}>
                    {['brief', 'graph'].map(v => (
                      <button key={v} className="at-btn" onClick={() => setViewMode(v)} style={{
                        padding: '3px 10px', borderRadius: 10, cursor: 'pointer', fontSize: 10.5, fontWeight: 700, fontFamily: 'inherit', border: 'none',
                        background: viewMode === v ? T.purple : 'rgba(18,54,42,.06)', color: viewMode === v ? '#fff' : T.inkSoft, textTransform: 'uppercase',
                      }}>{v}</button>
                    ))}
                  </div>
                )}
              </div>
              {viewMode === 'brief' && claims.length > 0 && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: T.inkMuted, marginBottom: 10, cursor: 'pointer' }}>
                  <input type="checkbox" checked={heatmapOn} onChange={e => setHeatmapOn(e.target.checked)} style={{ accentColor: T.purple }} />
                  Confidence heatmap (green = verified, amber = misleading, red = false)
                </label>
              )}
              {viewMode === 'graph' ? (
                <KnowledgeGraph nodes={graph.nodes} edges={graph.edges} />
              ) : output ? (
                <div style={{ fontSize: 14.5, lineHeight: 1.9, whiteSpace: 'pre-wrap', maxHeight: 380, overflow: 'auto' }}>
                  {heatmapOn && claims.length > 0 ? renderHeatmap(output) : renderCited(output)}
                </div>
              ) : (
                <div style={{ height: 14, borderRadius: 6, marginBottom: 8 }} className="at-shimmerbar" />
              )}
            </div>
          </div>
        )}

        {/* Bias + verification banners */}
        {(biasReport || verdict) && (
          <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 10, animation: 'popIn .35s ease' }}>
            {biasReport && (
              <div style={{ padding: '14px 18px', borderRadius: 14, background: /no contradiction/i.test(biasReport) ? T.emeraldSoft : T.amberSoft, border: `1px solid ${/no contradiction/i.test(biasReport) ? 'rgba(12,132,87,.22)' : 'rgba(184,132,44,.25)'}`, display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 15 }}>{/no contradiction/i.test(biasReport) ? '✓' : '⚠'}</span>
                <span style={{ fontSize: 13.5, color: /no contradiction/i.test(biasReport) ? T.emerald : T.amber, fontWeight: 500 }}>{biasReport}</span>
              </div>
            )}
            {verdict && (
              <div style={{ padding: '14px 18px', borderRadius: 14, background: isDone ? T.emeraldSoft : T.navySoft, border: `1px solid ${isDone ? 'rgba(12,132,87,.22)' : 'rgba(21,150,214,.18)'}`, display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 15 }}>{isDone ? '✓' : '⏳'}</span>
                <span style={{ fontSize: 13.5, color: isDone ? T.emerald : T.navy, fontWeight: 500 }}>{verdict}</span>
              </div>
            )}
          </div>
        )}

        {/* Claim-by-claim atomic fact-check */}
        {claims.length > 0 && (
          <div className="at-card" style={{ marginTop: 18, padding: 20, animation: 'fadeUp .4s ease' }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: T.inkMuted, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 12 }}>Claim-by-claim fact-check</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {claims.map((c, i) => {
                const st = VERDICT_STYLE[c.verdict] || VERDICT_STYLE.unverified;
                return (
                  <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 12px', borderRadius: 10, background: st.bg || 'rgba(18,54,42,.03)', border: `1px solid ${st.border !== 'transparent' ? st.border : T.border}` }}>
                    <span style={{ fontSize: 14, flexShrink: 0 }}>{st.icon}</span>
                    <div>
                      <p style={{ fontSize: 13, color: T.ink, margin: 0, fontWeight: 500 }}>{c.sentence}</p>
                      <p style={{ fontSize: 11.5, color: st.color, margin: '3px 0 0', fontWeight: 600 }}>{st.label} — {c.note}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Devil's Advocate — adversarial self-critique */}
        {critiques.length > 0 && (
          <div className="at-card" style={{ marginTop: 18, padding: 20, animation: 'fadeUp .4s ease', border: `1px solid rgba(181,80,63,.22)` }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: T.red, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 12 }}>😈 Devil's advocate — what could be wrong with this brief</p>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {critiques.map((c, i) => (
                <li key={i} style={{ fontSize: 13.5, color: T.inkSoft, marginBottom: 8, lineHeight: 1.6 }}>{c}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Trust score + sources */}
        {sources.length > 0 && (
          <div style={{ marginTop: 22, animation: 'fadeUp .5s .15s ease both' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: T.inkMuted, letterSpacing: 0.5, textTransform: 'uppercase', margin: 0 }}>Sources checked</p>
              {trustScore !== null && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: trustScore >= 65 ? T.emeraldSoft : trustScore >= 40 ? T.amberSoft : T.redSoft, color: trustScore >= 65 ? T.emerald : trustScore >= 40 ? T.amber : T.red, padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
                  Trust score {trustScore}%
                </span>
              )}
            </div>
            {metrics?.sourceBreakdown && (
              <p style={{ fontSize: 12, color: T.inkMuted, marginTop: -6, marginBottom: 14 }}>
                Based on <b style={{ color: T.emerald }}>{metrics.sourceBreakdown.high} high-confidence</b>,{' '}
                <b style={{ color: T.amber }}>{metrics.sourceBreakdown.med} medium-confidence</b>
                {metrics.sourceBreakdown.low > 0 && <> and <b style={{ color: T.red }}>{metrics.sourceBreakdown.low} unverified</b></>} source{metrics.sourceBreakdown.total !== 1 ? 's' : ''} — click a [n] citation above to jump to its source.
              </p>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {sources.map((s, i) => {
                const b = badgeStyle(s.confidence);
                const fbKey = s.title || String(i);
                const fb = feedback[fbKey];
                const isHl = highlightedSource === i;
                return (
                  <div key={i} id={`aura-source-${i}`} className="at-src at-citehl" style={{
                    display: 'flex', gap: 12, alignItems: 'flex-start', padding: '12px 14px', borderRadius: 12,
                    background: isHl ? T.purpleSoft : '#fff', border: `1px solid ${isHl ? T.purple : T.border}`,
                    boxShadow: isHl ? `0 0 0 3px ${T.purpleSoft}` : 'none', animationDelay: `${i * 70}ms`,
                  }}>
                    <span style={{ flexShrink: 0, fontSize: 10.5, fontWeight: 700, borderRadius: 6, padding: '3px 8px', fontFamily: 'monospace', background: b.bg, color: b.color }}>[{i + 1}] {b.label}</span>
                    <div style={{ flex: 1 }}>
                      <a href={s.url} target="_blank" rel="noreferrer" style={{ fontSize: 13.5, fontWeight: 600, color: T.ink, textDecoration: 'none' }}>{s.title}</a>
                      <p style={{ fontSize: 12, color: T.inkMuted, margin: '2px 0 0' }}>{s.source}</p>
                    </div>
                    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                      <button title="This source looks accurate" onClick={() => rateSource(i, 'up')} style={{
                        background: fb === 'up' ? T.emeraldSoft : 'transparent', border: `1px solid ${fb === 'up' ? T.emerald : T.border}`,
                        borderRadius: 8, width: 26, height: 26, cursor: 'pointer', fontSize: 12,
                      }}>👍</button>
                      <button title="Flag this source as wrong/irrelevant" onClick={() => rateSource(i, 'down')} style={{
                        background: fb === 'down' ? T.redSoft : 'transparent', border: `1px solid ${fb === 'down' ? T.red : T.border}`,
                        borderRadius: 8, width: 26, height: 26, cursor: 'pointer', fontSize: 12,
                      }}>👎</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Performance metrics */}
        {metrics && (
          <div className="at-card" style={{ marginTop: 18, padding: '16px 20px', animation: 'fadeUp .4s ease' }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: T.inkMuted, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 10 }}>Performance metrics</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              <span style={{ fontSize: 12.5, background: T.navySoft, color: T.navy, padding: '5px 12px', borderRadius: 14, fontWeight: 600 }}>⏱ Total: {(metrics.totalMs / 1000).toFixed(1)}s</span>
              <span style={{ fontSize: 12.5, background: 'rgba(18,54,42,.05)', color: T.inkSoft, padding: '5px 12px', borderRadius: 14 }}>📥 Retrieve: {(metrics.stages.retrieve / 1000).toFixed(1)}s</span>
              <span style={{ fontSize: 12.5, background: 'rgba(18,54,42,.05)', color: T.inkSoft, padding: '5px 12px', borderRadius: 14 }}>🏗 Structure: {(metrics.stages.structure / 1000).toFixed(1)}s</span>
              <span style={{ fontSize: 12.5, background: 'rgba(18,54,42,.05)', color: T.inkSoft, padding: '5px 12px', borderRadius: 14 }}>⚖ Bias: {(metrics.stages.bias / 1000).toFixed(1)}s</span>
              <span style={{ fontSize: 12.5, background: 'rgba(18,54,42,.05)', color: T.inkSoft, padding: '5px 12px', borderRadius: 14 }}>✅ Verify: {(metrics.stages.verify / 1000).toFixed(1)}s</span>
              {metrics.stages.claimcheck != null && <span style={{ fontSize: 12.5, background: 'rgba(18,54,42,.05)', color: T.inkSoft, padding: '5px 12px', borderRadius: 14 }}>🔬 Atomic check: {(metrics.stages.claimcheck / 1000).toFixed(1)}s</span>}
              {metrics.stages.devil != null && <span style={{ fontSize: 12.5, background: 'rgba(18,54,42,.05)', color: T.inkSoft, padding: '5px 12px', borderRadius: 14 }}>😈 Devil's advocate: {(metrics.stages.devil / 1000).toFixed(1)}s</span>}
              {metrics.stages.graph != null && <span style={{ fontSize: 12.5, background: 'rgba(18,54,42,.05)', color: T.inkSoft, padding: '5px 12px', borderRadius: 14 }}>🕸 Graph: {(metrics.stages.graph / 1000).toFixed(1)}s</span>}
              <span style={{ fontSize: 12.5, background: 'rgba(18,54,42,.05)', color: T.inkSoft, padding: '5px 12px', borderRadius: 14 }}>📝 Input: {metrics.wordCount} words</span>
            </div>
            {metrics.claimBreakdown && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: '#0C8457' }}>✅ {metrics.claimBreakdown.verified} verified</span>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: '#B8842C' }}>⚠️ {metrics.claimBreakdown.misleading} misleading</span>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: '#B5503F' }}>❌ {metrics.claimBreakdown.false} false</span>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: '#5c6b64' }}>❓ {metrics.claimBreakdown.unverified} unverified</span>
              </div>
            )}
          </div>
        )}

        {/* Export row */}
        {isDone && (
          <div className="at-card" style={{ marginTop: 24, padding: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, animation: 'fadeUp .4s ease' }}>
            <p style={{ fontSize: 12.5, fontWeight: 700, color: T.inkMuted, letterSpacing: 0.5, textTransform: 'uppercase', margin: 0 }}>Export this brief</p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {[{ id: 'pdf', label: '📄 PDF' }, { id: 'ppt', label: '📊 Slide deck' }, { id: 'json', label: '{ } JSON' }].map(btn => (
                <button key={btn.id} className="at-btn" onClick={() => doExport(btn.id)} disabled={exporting === btn.id} style={{
                  background: 'rgba(18,54,42,.05)', color: T.ink, border: `1px solid ${T.border}`, padding: '9px 18px', borderRadius: 20, cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', opacity: exporting === btn.id ? 0.6 : 1,
                }}>{exporting === btn.id ? 'Exporting…' : btn.label}</button>
              ))}
              <button className="at-btn" onClick={handleFlashcards} disabled={flashcardsLoading} style={{
                background: T.grad, color: '#fff', border: 'none', padding: '9px 18px', borderRadius: 20, cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', opacity: flashcardsLoading ? 0.6 : 1,
              }}>{flashcardsLoading ? 'Generating…' : '🧠 Flashcards'}</button>
            </div>
          </div>
        )}
      </main>

      {showFlashcards && flashcards && (
        <FlashcardViewer cards={flashcards} onClose={() => setShowFlashcards(false)} />
      )}
    </div>
  );
}