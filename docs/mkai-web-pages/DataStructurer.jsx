import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  LIGHT, DARK, baseCss,
  downloadExcel, logFlowRun,
} from '../lib/mkaiCore';
import { Helmet } from 'react-helmet-async';

// ── MK AI accent — emerald green, matches the platform-wide liquid-glass theme ──
const ACCENT = '#0FA968';

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
      max_tokens: 3000,
      temperature: 0.5,
    };
  } else {
    body = {
      model: provider.model,
      messages,
      max_tokens: 3000,
      temperature: 0.5,
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

// ══════════════════════════════════════════════════════════════
// CORE FUNCTION — takes raw JSON / messy text, returns a clean
// structured table.
// ══════════════════════════════════════════════════════════════
export async function structureData(rawInput) {
  const trimmed = rawInput.trim();

  // If it already parses as JSON, skip the AI call for the parse step —
  // just normalise it into rows/columns directly (faster + cheaper).
  let seedRows = null;
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) seedRows = parsed;
    else if (typeof parsed === 'object') seedRows = [parsed];
  } catch (_) { /* not raw JSON — that's fine, AI will structure it */ }

  const system = `You convert messy/unstructured input (raw text, half-broken JSON, pasted paragraphs,
logs, scraped page text) into a CLEAN structured dataset. Return STRICT JSON only, no markdown, no preamble,
in this exact shape:
{
 "columns": ["Column1","Column2", ...],
 "rows": [ { "Column1": "value", "Column2": "value" }, ... ],
 "warnings": ["short note about anything ambiguous, missing, or inferred"]
}
Rules:
- Every row object must use the EXACT SAME set of keys (the columns).
- If a value is missing for a row, use an empty string "" — never omit the key.
- Infer sensible column names from the content (e.g. Name, Email, Date, Amount, Issue).
- If the input is already an array of similar objects, just clean/normalise it.
- Keep it to at most 50 rows (sample if there's more) and note that in warnings.`;

  const userPrompt = seedRows
    ? `This input already parsed as JSON. Normalise it into a consistent table (same keys on every row), fixing inconsistent keys/casing:\n${JSON.stringify(seedRows).slice(0, 6000)}`
    : `Structure this raw/unstructured input into a table:\n\n${trimmed.slice(0, 6000)}`;

  const messages = [
    { role: 'system', content: system },
    { role: 'user', content: userPrompt },
  ];

  const { text } = await callWithFallback(messages);
  const result = extractJSON(text);
  if (!result.columns || !result.rows) throw new Error('AI did not return a valid table');
  return result;
}

export async function exportStructuredExcel(structured, filename = 'structured-data.xlsx') {
  await downloadExcel(structured.rows, filename, 'Structured Data');
}

// ══════════════════════════════════════════════════════════════
// UI COMPONENT
// ══════════════════════════════════════════════════════════════
export default function DataStructurer() {
  const navigate = useNavigate();
  // ── Single liquid-glass theme — dark mode removed, MK AI emerald accent ──
  const T = LIGHT;

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [structured, setStructured] = useState(null);
  const [seedNote, setSeedNote] = useState('');

  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = baseCss(T, ACCENT);
    document.head.appendChild(style);
    return () => style.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pick up a hand-off from another tool (e.g. MK Web Agent) if present
  useEffect(() => {
    try {
      const seed = JSON.parse(sessionStorage.getItem('mkai-flow-seed') || 'null');
      if (seed?.source === 'WebAgent') {
        setInput(JSON.stringify(seed.payload.skeleton, null, 2));
        setSeedNote('Loaded structural data handed off from MK Web Agent ⚡');
        sessionStorage.removeItem('mkai-flow-seed');
      }
    } catch (_) {}
  }, []);

  const run = async () => {
    if (!input.trim()) return;
    setLoading(true); setError(''); setStructured(null);
    try {
      const result = await structureData(input);
      setStructured(result);
      logFlowRun({ tool: 'Data Structurer', label: `Structured ${result.rows.length} rows`, ok: true });
    } catch (err) {
      setError(err.message || 'Could not structure this input.');
      logFlowRun({ tool: 'Data Structurer', label: 'Failed to structure input', ok: false });
    } finally {
      setLoading(false);
    }
  };

  const exportExcel = () => {
    if (!structured) return;
    exportStructuredExcel(structured, `structured-${Date.now()}.xlsx`);
  };

  const loadSample = () => {
    setInput(`Customer feedback log:\nRahul from Delhi said "app crashes on checkout" on 3 Aug, very angry.\nPriya (Mumbai) loved the new UI, sent on Aug 4, happy.\nAmit K. reported slow loading on Aug 5 from Bangalore, neutral tone, medium priority.`);
  };

  return (
    <div style={{ minHeight: '100vh', background: T.bg, color: T.text }}>

      <Helmet>
        <title>Data Structurer — Messy Data to Clean Excel | MK AI</title>
        <meta name="description" content="Turn messy JSON or text into clean, structured Excel spreadsheets instantly with AI." />
      </Helmet>
      <header style={{ position: 'sticky', top: 0, zIndex: 20, background: 'rgba(246,250,247,.92)', borderBottom: `1px solid ${T.border}`, backdropFilter: 'blur(10px)' }}>
        <div style={{ maxWidth: 1180, margin: '0 auto', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <Link to="/" style={{ fontSize: 13, color: T.muted, fontWeight: 600 }}>← Home</Link>
            <span style={{ fontSize: 18, fontWeight: 800, color: ACCENT }}>⚙️ Data Structurer</span>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 900, margin: '0 auto', padding: '40px 20px 90px' }}>
        <h1 style={{ fontSize: 30, fontWeight: 900, marginBottom: 8 }}>
          Messy data in → <span style={{ color: ACCENT }}>clean Excel out</span>
        </h1>
        <p style={{ color: T.muted, fontSize: 14.5, marginBottom: 20, maxWidth: 640, lineHeight: 1.6 }}>
          Paste raw JSON, a scraped paragraph, chat logs, or anything unstructured. AI figures out the
          columns and gives you a downloadable, structured spreadsheet.
        </p>

        {seedNote && (
          <div style={{ fontSize: 12, fontWeight: 700, color: ACCENT, marginBottom: 12, background: `${ACCENT}12`, border: `1px solid ${ACCENT}33`, borderRadius: 10, padding: '8px 12px' }}>
            🔗 {seedNote}
          </div>
        )}

        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={9}
          placeholder="Paste JSON, raw text, logs, or anything messy…"
          style={{ width: '100%', padding: 16, borderRadius: 12, background: T.inputBg, border: `1px solid ${T.border}`, color: T.text, fontSize: 13.5, fontFamily: "'Space Mono', monospace", resize: 'vertical', outline: 'none', marginBottom: 12 }}
        />

        <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
          <button onClick={run} disabled={loading} style={{ padding: '13px 24px', borderRadius: 12, border: 'none', fontWeight: 800, fontSize: 13.5, background: ACCENT, color: '#fff', cursor: 'pointer', opacity: loading ? .6 : 1 }}>
            {loading ? 'Structuring…' : 'Structure It ⚙️'}
          </button>
          <button onClick={loadSample} style={{ padding: '13px 20px', borderRadius: 12, border: `1px solid ${T.border}`, background: T.inputBg, color: T.muted, fontWeight: 700, fontSize: 13 }}>
            Try Sample Data
          </button>
        </div>

        {error && (
          <div style={{ padding: 16, borderRadius: 12, background: `${DARK.red}15`, border: `1px solid ${DARK.red}44`, color: DARK.red, fontSize: 13.5, marginBottom: 20 }}>
            ⚠️ {error}
          </div>
        )}

        {structured && (
          <div>
            {structured.warnings?.length > 0 && (
              <div style={{ fontSize: 12, color: DARK.amber, marginBottom: 14, background: `${DARK.amber}12`, border: `1px solid ${DARK.amber}33`, borderRadius: 10, padding: '8px 12px' }}>
                ⚠ {structured.warnings.join(' · ')}
              </div>
            )}

            <div style={{ overflowX: 'auto', border: `1px solid ${T.border}`, borderRadius: 14, marginBottom: 18 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                <thead>
                  <tr style={{ background: T.s1 }}>
                    {structured.columns.map((c) => (
                      <th key={c} style={{ textAlign: 'left', padding: '10px 14px', color: ACCENT, fontWeight: 800, whiteSpace: 'nowrap', borderBottom: `1px solid ${T.border}` }}>{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {structured.rows.map((row, i) => (
                    <tr key={i} style={{ background: i % 2 ? T.s1 : 'transparent' }}>
                      {structured.columns.map((c) => (
                        <td key={c} style={{ padding: '10px 14px', color: T.muted, borderBottom: `1px solid ${T.border}`, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis' }}>{String(row[c] ?? '')}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={exportExcel} style={{ padding: '12px 20px', borderRadius: 12, border: 'none', background: ACCENT, color: '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>
                📊 Download Excel ({structured.rows.length} rows)
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}