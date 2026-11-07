import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  LIGHT, DARK, baseCss, downloadPDF, logFlowRun,
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
      'X-Title': 'MK AI',
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
      console.warn(`[MK AI] ${primary.name} failed (${failCounts[primary.name]}) [PRIMARY]:`, err.message);
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
      console.warn(`[MK AI] ${provider.name} failed (${failCounts[provider.name]}):`, err.message);
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
// CORE FUNCTION — callable directly by Flow
// ══════════════════════════════════════════════════════════════
export async function predictBurnout(teamActivityText) {
  const system = `You analyze workplace activity patterns (working hours, message tone/frequency, task
completion notes, leave patterns) to flag EARLY signs of employee burnout — purely from behavioural/
workload patterns, not medical or psychological diagnosis. Return STRICT JSON only, no markdown, no preamble:
{
 "teamRiskScore": 0-100,
 "members": [ { "name": "name or role from the input", "riskLevel": "Low|Medium|High", "signals": ["short observed pattern", "..."] } ],
 "alertSubject": "short HR alert email subject",
 "alertBody": "professional 4-6 sentence email to HR/manager summarising the pattern-based concern and suggesting a supportive check-in — NOT a diagnosis, just workload/pattern observations",
 "disclaimer": "one sentence noting this is a workload-pattern signal, not a medical/psychological assessment"
}
Base risk on concrete signals only: consistently late-night activity, shrinking output despite longer hours,
sudden drop in communication, repeated missed deadlines, cancelled leave, terse/curt tone shift. Never
diagnose a condition — only describe the observable pattern.`;

  const messages = [
    { role: 'system', content: system },
    { role: 'user', content: `Team activity log / notes:\n${teamActivityText.slice(0, 5000)}` },
  ];

  const { text } = await callWithFallback(messages);
  const result = extractJSON(text);
  if (!result.members) throw new Error('Could not analyze this activity log');
  return result;
}

export function exportAlertPDF(result) {
  const html = `
    <h1>Team Workload Risk Alert</h1>
    <div class="stat-row">
      <div class="stat"><div class="stat-num">${result.teamRiskScore}</div><div class="stat-label">TEAM RISK SCORE</div></div>
      <div class="stat"><div class="stat-num">${result.members.filter((m) => m.riskLevel === 'High').length}</div><div class="stat-label">HIGH-RISK MEMBERS</div></div>
    </div>
    <h2>Members</h2>
    <table><tr><th>Name/Role</th><th>Risk</th><th>Observed Signals</th></tr>
    ${result.members.map((m) => `<tr><td>${m.name}</td><td><span class="badge badge-${m.riskLevel === 'High' ? 'high' : m.riskLevel === 'Medium' ? 'med' : 'low'}">${m.riskLevel.toUpperCase()}</span></td><td>${m.signals.join(', ')}</td></tr>`).join('')}
    </table>
    <h2>Suggested Alert Email</h2>
    <p><b>Subject:</b> ${result.alertSubject}</p>
    <p>${result.alertBody}</p>
    <p style="margin-top:16px;font-size:11px;color:#94a3b8">${result.disclaimer}</p>
  `;
  downloadPDF(html, 'team-burnout-risk-alert.pdf', ACCENT);
}

// ══════════════════════════════════════════════════════════════
// UI COMPONENT
// ══════════════════════════════════════════════════════════════
export default function BurnoutPredictor() {
  // ── Single liquid-glass theme — dark mode removed, MK AI green/emerald accent ──
  const T = LIGHT;

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
      const r = await predictBurnout(input);
      setResult(r);
      logFlowRun({ tool: 'Burnout Predictor', label: `Team risk score ${r.teamRiskScore}`, ok: true });
    } catch (err) {
      setError(err.message || 'Could not analyze this log.');
      logFlowRun({ tool: 'Burnout Predictor', label: 'Analysis failed', ok: false });
    } finally {
      setLoading(false);
    }
  };

  const copyAlert = () => {
    if (!result) return;
    navigator.clipboard.writeText(`Subject: ${result.alertSubject}\n\n${result.alertBody}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const levelColor = { Low: DARK.green, Medium: DARK.amber, High: DARK.red };
  const loadSample = () => setInput(`Aisha: logging in past midnight all week, output down ~30% vs last sprint, missed 2 standups.\nRohit: normal hours, steady output, on leave next week (planned).\nKabir: cancelled his approved leave twice this month, terse one-word replies on Slack, still hitting deadlines.`);

  return (
    <div style={{ minHeight: '100vh', background: T.bg, color: T.text }}>

      <Helmet>
        <title>Burnout Predictor — Spot Team Workload Risk | MK AI</title>
        <meta name="description" content="Detect early signs of team burnout and workload risk with AI, and auto-generate HR alert emails." />
      </Helmet>
      <header style={{ position: 'sticky', top: 0, zIndex: 20, background: 'rgba(246,250,247,.92)', borderBottom: `1px solid ${T.border}`, backdropFilter: 'blur(10px)' }}>
        <div style={{ maxWidth: 1180, margin: '0 auto', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <Link to="/" style={{ fontSize: 13, color: T.muted, fontWeight: 600 }}>← Home</Link>
            <span style={{ fontSize: 18, fontWeight: 800, color: ACCENT }}>🫂 Burnout Predictor</span>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 900, margin: '0 auto', padding: '40px 20px 90px' }}>
        <h1 style={{ fontSize: 30, fontWeight: 900, marginBottom: 8 }}>
          Catch team burnout <span style={{ color: ACCENT }}>before it costs you your best people</span>
        </h1>
        <p style={{ color: T.muted, fontSize: 14.5, marginBottom: 8, maxWidth: 640, lineHeight: 1.6 }}>
          Paste activity notes — hours, output, tone, leave patterns. AI flags workload-based risk signals
          and drafts a supportive HR check-in, automatically.
        </p>
        <p style={{ color: T.muted2, fontSize: 11.5, marginBottom: 20 }}>
          This reads behavioural/workload patterns only — it is not a medical or psychological diagnosis.
        </p>

        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={7}
          placeholder="e.g. Aisha: logging in past midnight all week, output down, missed standups…"
          style={{ width: '100%', padding: 16, borderRadius: 12, background: T.inputBg, border: `1px solid ${T.border}`, color: T.text, fontSize: 13.5, resize: 'vertical', outline: 'none', marginBottom: 12 }}
        />

        <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
          <button onClick={run} disabled={loading} style={{ padding: '13px 24px', borderRadius: 12, border: 'none', fontWeight: 800, fontSize: 13.5, background: ACCENT, color: '#fff', cursor: 'pointer', opacity: loading ? .6 : 1 }}>
            {loading ? 'Analyzing…' : 'Analyze Team Risk 🫂'}
          </button>
          <button onClick={loadSample} style={{ padding: '13px 20px', borderRadius: 12, border: `1px solid ${T.border}`, background: T.inputBg, color: T.muted, fontWeight: 700, fontSize: 13 }}>
            Try Sample Log
          </button>
        </div>

        {error && (
          <div style={{ padding: 16, borderRadius: 12, background: `${DARK.red}15`, border: `1px solid ${DARK.red}44`, color: DARK.red, fontSize: 13.5, marginBottom: 20 }}>
            ⚠️ {error}
          </div>
        )}

        {result && (
          <div>
            <div style={{ background: T.s1, border: `1px solid ${T.border}`, borderRadius: 14, padding: '16px 22px', textAlign: 'center', width: 160, marginBottom: 20 }}>
              <div style={{ fontSize: 30, fontWeight: 900, color: ACCENT }}>{result.teamRiskScore}</div>
              <div style={{ fontSize: 10.5, color: T.muted, fontWeight: 700 }}>TEAM RISK SCORE</div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 18 }}>
              {result.members.map((m, i) => (
                <div key={i} style={{ background: T.s1, border: `1px solid ${T.border}`, borderRadius: 12, padding: 14, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 10, fontWeight: 800, padding: '4px 8px', borderRadius: 8, background: `${levelColor[m.riskLevel]}22`, color: levelColor[m.riskLevel], flexShrink: 0, marginTop: 2 }}>{m.riskLevel.toUpperCase()}</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 3 }}>{m.name}</div>
                    <div style={{ fontSize: 12.5, color: T.muted }}>{m.signals.join(' · ')}</div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ background: `${ACCENT}0F`, border: `1px solid ${ACCENT}33`, borderRadius: 14, padding: 18, marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: ACCENT, marginBottom: 6 }}>SUGGESTED HR ALERT</div>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{result.alertSubject}</div>
              <div style={{ fontSize: 13.5, lineHeight: 1.6, color: T.muted }}>{result.alertBody}</div>
              <div style={{ fontSize: 11, color: T.muted2, marginTop: 10 }}>{result.disclaimer}</div>
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button onClick={() => exportAlertPDF(result)} style={{ padding: '12px 20px', borderRadius: 12, border: 'none', background: ACCENT, color: '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>
                📄 Export Alert PDF
              </button>
              <button onClick={copyAlert} style={{ padding: '12px 20px', borderRadius: 12, border: `1px solid ${T.border}`, background: T.inputBg, color: T.text, fontWeight: 800, fontSize: 13 }}>
                {copied ? '✓ Copied!' : '✉️ Copy Alert Email'}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}