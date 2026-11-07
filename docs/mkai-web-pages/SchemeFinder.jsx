import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  DARK, LIGHT, baseCss,
  downloadPDF, logFlowRun,
} from '../lib/mkaiCore';
import { Helmet } from 'react-helmet-async';

const ACCENT = '#FF9933'; // saffron

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

// GeneralCompute is ALWAYS tried first on every call, same pattern as riskPredictor.jsx / chat.jsx.
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

// ══════════════════════════════════════════════════════════════
// CORE FUNCTIONS — callable directly by MK Flow
// ══════════════════════════════════════════════════════════════
export async function findSchemes(profile) {
  const system = `You are an expert on Indian government welfare schemes (central + state), scholarships,
subsidies, and startup/business schemes. Given a citizen's profile, list schemes they are PLAUSIBLY
eligible for. Be realistic and India-specific. Return STRICT JSON only, no markdown, no preamble:
{
 "profileSummary": "1 sentence recap of the person's situation",
 "schemes": [
   {
     "name": "Scheme name",
     "level": "Central" | "State",
     "category": "Education|Housing|Health|Startup|Agriculture|Employment|Women|Senior Citizen|Other",
     "eligibility": "why this profile likely qualifies, 1 sentence",
     "benefit": "what they actually get",
     "howToApply": "portal/office name + rough steps, 1-2 sentences",
     "requiredDocs": ["doc1","doc2","doc3"],
     "importantDates": "when applications open / recurring cycle / deadline in plain text, e.g. 'Applications accepted year-round' or 'Deadline: 31 March each year'",
     "officialLink": "the real official government portal URL for this scheme, e.g. https://pmaymis.gov.in"
   }
 ]
}
List 4-6 real, well-known schemes (e.g. PM Awas Yojana, PM-KISAN, National Scholarship Portal schemes,
Ayushman Bharat, Stand-Up India, MUDRA Loan, state scholarship portals) that genuinely match the profile.
Do not invent fake scheme names. Only use officialLink URLs you are confident are the real portal for
that scheme — if unsure of the exact URL, point to the closest well-known official domain
(e.g. https://www.india.gov.in or the relevant ministry site) rather than guessing a fake one.`;

  const userPrompt = `Citizen profile:\nState: ${profile.state}\nAge: ${profile.age}\nOccupation: ${profile.occupation}\nAnnual family income: ₹${profile.income}\nCategory: ${profile.category || 'General'}\nSpecific need: ${profile.need || 'general schemes'}`;

  const messages = [
    { role: 'system', content: system },
    { role: 'user', content: userPrompt },
  ];

  const { text } = await callWithFallback(messages);
  const result = extractJSON(text);
  if (!result.schemes) throw new Error('Could not find schemes for this profile');
  return result;
}

export function draftApplicationPDF(scheme, profile) {
  const html = `
    <h1>Application Draft — ${scheme.name}</h1>
    <div class="stat-row">
      <div class="stat"><div class="stat-num">${scheme.level}</div><div class="stat-label">SCHEME LEVEL</div></div>
      <div class="stat"><div class="stat-num">${scheme.category}</div><div class="stat-label">CATEGORY</div></div>
    </div>
    <h2>Applicant Details</h2>
    <table>
      <tr><td><b>State</b></td><td>${profile.state}</td></tr>
      <tr><td><b>Age</b></td><td>${profile.age}</td></tr>
      <tr><td><b>Occupation</b></td><td>${profile.occupation}</td></tr>
      <tr><td><b>Annual Family Income</b></td><td>₹${profile.income}</td></tr>
      <tr><td><b>Category</b></td><td>${profile.category || 'General'}</td></tr>
    </table>
    <h2>Eligibility Basis</h2><p>${scheme.eligibility}</p>
    <h2>Benefit</h2><p>${scheme.benefit}</p>
    <h2>How To Apply</h2><p>${scheme.howToApply}</p>
    <h2>Important Dates</h2><p>${scheme.importantDates || 'Check official portal for current dates.'}</p>
    <h2>Documents You'll Need</h2>
    <ul>${scheme.requiredDocs.map((d) => `<li>${d}</li>`).join('')}</ul>
    ${scheme.officialLink ? `<h2>Official Portal</h2><p><a href="${scheme.officialLink}">${scheme.officialLink}</a></p>` : ''}
    <p style="margin-top:20px;font-size:11px;color:#94a3b8">⚠️ This is an AI-generated draft to speed up your paperwork — always verify current rules and submit through the official government portal/office before relying on it.</p>
  `;
  downloadPDF(html, `${scheme.name.replace(/\W+/g, '-')}-application-draft.pdf`, ACCENT);
}

// ══════════════════════════════════════════════════════════════
// UI COMPONENT
// ══════════════════════════════════════════════════════════════
const STATES = ['Delhi', 'Uttar Pradesh', 'Maharashtra', 'Bihar', 'West Bengal', 'Tamil Nadu', 'Karnataka', 'Rajasthan', 'Gujarat', 'Madhya Pradesh', 'Punjab', 'Kerala', 'Other'];
const CATEGORIES = ['General', 'OBC', 'SC', 'ST', 'EWS'];

export default function SchemeFinder() {
  // ── Single liquid-glass theme — dark mode removed, matches Burnout/Risk predictor ──
  const T = LIGHT;

  const [profile, setProfile] = useState({ state: 'Delhi', age: '', occupation: '', income: '', category: 'General', need: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = baseCss(T, ACCENT);
    document.head.appendChild(style);
    return () => style.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = (k) => (e) => setProfile((p) => ({ ...p, [k]: e.target.value }));

  const run = async () => {
    if (!profile.age || !profile.occupation || !profile.income) return;
    setLoading(true); setError(''); setResult(null);
    try {
      const r = await findSchemes(profile);
      setResult(r);
      logFlowRun({ tool: 'Scheme Finder', label: `Found ${r.schemes.length} schemes`, ok: true });
    } catch (err) {
      setError(err.message || 'Could not fetch schemes right now.');
      logFlowRun({ tool: 'Scheme Finder', label: 'Failed to find schemes', ok: false });
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = { width: '100%', padding: '12px 14px', borderRadius: 10, background: T.inputBg, border: `1px solid ${T.border}`, color: T.text, fontSize: 13.5, outline: 'none' };
  // Native <select>/<option> elements ignore most inline styling from the parent theme and default
  // to the OS-level control rendering — on some laptops that renders white text on a white dropdown.
  // `colorScheme` tells the browser which native palette to use, and we set explicit option colors
  // as a fallback for browsers that do respect it.
  const selectStyle = { ...inputStyle, colorScheme: 'light', cursor: 'pointer' };
  const optionStyle = { background: T.inputBg, color: T.text };
  const labelStyle = { fontSize: 11.5, fontWeight: 700, color: T.muted, marginBottom: 6, display: 'block' };

  return (
    <div style={{ minHeight: '100vh', background: T.bg, color: T.text }}>

      <Helmet>
        <title>Scheme Finder — Indian Government Schemes | MK AI</title>
        <meta name="description" content="Find and auto-fill eligible Indian government scheme applications with MK AI's Scheme Finder." />
      </Helmet>
      <header style={{ position: 'sticky', top: 0, zIndex: 20, background: 'rgba(246,250,247,.92)', borderBottom: `1px solid ${T.border}`, backdropFilter: 'blur(10px)' }}>
        <div style={{ maxWidth: 1180, margin: '0 auto', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <Link to="/" style={{ fontSize: 13, color: T.muted, fontWeight: 600 }}>← Home</Link>
            <span style={{ fontSize: 18, fontWeight: 800, color: ACCENT }}>🇮🇳 Scheme Finder</span>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 900, margin: '0 auto', padding: '40px 20px 90px' }}>
        <h1 style={{ fontSize: 30, fontWeight: 900, marginBottom: 8 }}>
          Find every government scheme <span style={{ color: ACCENT }}>you're eligible for</span>
        </h1>
        <p style={{ color: T.muted, fontSize: 14.5, marginBottom: 26, maxWidth: 620, lineHeight: 1.6 }}>
          Fill your basic profile once. AI matches you to real central & state schemes, then drafts your
          application PDF — no consultant, no fee.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, background: T.s1, border: `1px solid ${T.border}`, borderRadius: 16, padding: 20, marginBottom: 20 }}>
          <div><label style={labelStyle}>State</label>
            <select value={profile.state} onChange={set('state')} style={selectStyle}>
              {STATES.map((s) => <option key={s} value={s} style={optionStyle}>{s}</option>)}
            </select>
          </div>
          <div><label style={labelStyle}>Category</label>
            <select value={profile.category} onChange={set('category')} style={selectStyle}>
              {CATEGORIES.map((c) => <option key={c} value={c} style={optionStyle}>{c}</option>)}
            </select>
          </div>
          <div><label style={labelStyle}>Age</label>
            <input type="number" value={profile.age} onChange={set('age')} placeholder="e.g. 21" style={inputStyle} />
          </div>
          <div><label style={labelStyle}>Annual Family Income (₹)</label>
            <input type="number" value={profile.income} onChange={set('income')} placeholder="e.g. 250000" style={inputStyle} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}><label style={labelStyle}>Occupation / Status</label>
            <input value={profile.occupation} onChange={set('occupation')} placeholder="e.g. Engineering student, farmer, small shop owner…" style={inputStyle} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}><label style={labelStyle}>What are you looking for? (optional)</label>
            <input value={profile.need} onChange={set('need')} placeholder="e.g. scholarship, housing, startup loan…" style={inputStyle} />
          </div>
        </div>

        <button onClick={run} disabled={loading} style={{ padding: '13px 26px', borderRadius: 12, border: 'none', fontWeight: 800, fontSize: 13.5, background: ACCENT, color: '#2B1300', cursor: 'pointer', opacity: loading ? .6 : 1, marginBottom: 24 }}>
          {loading ? 'Searching schemes…' : 'Find My Schemes 🔍'}
        </button>

        {error && (
          <div style={{ padding: 16, borderRadius: 12, background: `${DARK.red}15`, border: `1px solid ${DARK.red}44`, color: DARK.red, fontSize: 13.5, marginBottom: 20 }}>
            ⚠️ {error}
          </div>
        )}

        {result && (
          <div>
            <div style={{ fontSize: 13, color: T.muted, marginBottom: 16, fontStyle: 'italic' }}>{result.profileSummary}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {result.schemes.map((s, i) => (
                <div key={i} style={{ background: T.s1, border: `1px solid ${T.border}`, borderRadius: 14, padding: 18 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
                    <div style={{ fontWeight: 800, fontSize: 15.5 }}>{s.name}</div>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <span style={{ fontSize: 10, fontWeight: 800, padding: '3px 8px', borderRadius: 20, background: `${ACCENT}18`, color: ACCENT }}>{s.level}</span>
                      <span style={{ fontSize: 10, fontWeight: 800, padding: '3px 8px', borderRadius: 20, background: T.inputBg, color: T.muted }}>{s.category}</span>
                    </div>
                  </div>
                  <div style={{ fontSize: 13, color: T.muted, marginBottom: 8 }}><b style={{ color: T.text }}>Why you qualify:</b> {s.eligibility}</div>
                  <div style={{ fontSize: 13, color: T.muted, marginBottom: 8 }}><b style={{ color: T.text }}>Benefit:</b> {s.benefit}</div>
                  <div style={{ fontSize: 13, color: T.muted, marginBottom: 8 }}><b style={{ color: T.text }}>How to apply:</b> {s.howToApply}</div>
                  {s.importantDates && (
                    <div style={{ fontSize: 13, color: T.muted, marginBottom: 12 }}>
                      <b style={{ color: T.text }}>📅 Important dates:</b> {s.importantDates}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <button onClick={() => draftApplicationPDF(s, profile)} style={{ padding: '9px 16px', borderRadius: 10, border: 'none', background: ACCENT, color: '#2B1300', fontWeight: 800, fontSize: 12, cursor: 'pointer' }}>
                      📄 Auto-fill Application PDF
                    </button>
                    {s.officialLink && (
                      <a
                        href={s.officialLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          padding: '9px 16px', borderRadius: 10, border: `1px solid ${ACCENT}`,
                          background: 'transparent', color: ACCENT, fontWeight: 800, fontSize: 12,
                          textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6,
                        }}
                      >
                        🔗 Visit Official Portal
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 11, color: T.muted2, marginTop: 16 }}>
              ⚠️ Always verify current eligibility and dates on the official scheme portal before applying.
            </div>
          </div>
        )}
      </main>
    </div>
  );
}