import React, { useState, useRef, useCallback } from "react";
import { Helmet } from 'react-helmet-async';

// ─── APP THEME — matched to Home.jsx (emerald / sky / gold, glass on white) ───
const APP_THEME = {
  pageBg: "#f6faf7",
  headerBg: "rgba(246,250,247,0.88)",
  headerBorder: "rgba(18,54,42,0.10)",
  cardBg: "rgba(255,255,255,0.62)",
  cardBorder: "rgba(255,255,255,0.68)",
  inputBg: "rgba(255,255,255,0.85)",
  inputBorder: "rgba(18,54,42,0.14)",
  inputColor: "#122420",
  selectBg: "#fffefb",
  ghostBtnBorder: "rgba(15,169,104,0.30)",
  ghostBtnColor: "#0C8457",
  textPrimary: "#122420",
  textMuted: "#5c6b64",
  textSub: "rgba(18,36,32,0.42)",
  labelColor: "#0C8457",
  labelBg: "rgba(15,169,104,0.09)",
  labelBorder: "rgba(15,169,104,0.24)",
  sideCardBg: "rgba(255,255,255,0.62)",
  sideCardBorder: "rgba(255,255,255,0.68)",
  previewBarBg: "#eef8f2",
  previewBarBorder: "rgba(18,54,42,0.08)",
  topBarBg: "rgba(228,243,234,0.7)",
  topBarBorder: "rgba(18,54,42,0.08)",
  editBanner: "rgba(15,169,104,0.09)",
  editBannerBorder: "rgba(15,169,104,0.26)",
  editBannerColor: "#0C8457",
  errorBg: "rgba(239,68,68,0.08)",
  errorBorder: "rgba(239,68,68,0.22)",
  errorColor: "#B91C1C",
  statBorder: "rgba(18,54,42,0.08)",
  statLabel: "rgba(18,36,32,0.42)",
  bgGradient: "radial-gradient(circle at 15% 10%, rgba(15,169,104,.10), transparent 26rem), radial-gradient(circle at 88% 20%, rgba(21,150,214,.08), transparent 22rem)",
  accentGrad: "linear-gradient(135deg,#0FA968,#1596D6)",
  accentSolid: "#0FA968",
  btnShadow: "0 14px 30px rgba(15,150,120,.24)",
  cardHoverBg: "#f4faf6",
  cardHoverBorder: "#0FA968",
  cardShadowH: "0 18px 42px rgba(15,90,70,.20)",
  grid: "rgba(15,169,104,0.05)",
  glassShadow: "0 10px 34px rgba(15,90,70,.14), inset 0 1px 0 rgba(255,255,255,.55)",
};

// ─── PDF DOCUMENT THEME — single, fixed, best-looking (emerald / sky) ─────────
const PDF_THEME = { primary: "#0C8457", accent: "#1596D6", light: "#E9F7F0", secondary: "#0FA968" };

const DOC_TYPES = ["Research Document", "Business Document", "Academic Paper", "Technical Guide", "General Document"];
const LANGUAGES = ["English", "Hindi", "Hinglish"];
const STYLES    = ["professional", "academic", "simple", "detailed"];

const AUTO_SECTIONS = 10;
const AUTO_CHARTS   = 4;
const AUTO_TABLES   = 2;

// ─── AI PROVIDERS (GeneralCompute first — always tried before anything else) ──
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
    key: 'YOUR_API_KEY_PLACEHOLDER', // <-- apni Groq API key yaha daal de
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

let pdfRRIndex = 0;
const pdfFailCounts = Object.fromEntries(AI_PROVIDERS.map(p => [p.name, 0]));
const PDF_MAX_FAILS = 3;
const PRIMARY_PROVIDER_NAME = 'GeneralCompute'; // <-- ye hamesha sabse pehle try hoga

function getNextProvider() {
  // fallback round-robin among non-primary providers (used only after primary is exhausted)
  const fallbacks = AI_PROVIDERS.filter(p => p.name !== PRIMARY_PROVIDER_NAME);
  const total = fallbacks.length;
  for (let i = 0; i < total; i++) {
    const p = fallbacks[pdfRRIndex % total];
    pdfRRIndex++;
    if (pdfFailCounts[p.name] < PDF_MAX_FAILS) return p;
  }
  AI_PROVIDERS.forEach(p => { pdfFailCounts[p.name] = 0; });
  pdfRRIndex = 0;
  return AI_PROVIDERS[0];
}

async function callProviderOnce(provider, messages) {
  if (provider.type === "railway") {
    const res = await fetch(provider.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: provider.model, messages, max_tokens: 3000, temperature: 0.5 }),
    });
    if (!res.ok) throw new Error(`Railway HTTP ${res.status}`);
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content || data?.content || data?.text || data?.response;
    if (!text) throw new Error("Railway empty response");
    return text;
  }
  if (provider.type === "cohere") {
    const system = messages.find(m => m.role === "system");
    const chat   = messages.filter(m => m.role !== "system");
    const res = await fetch(provider.url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${provider.key}` },
      body: JSON.stringify({
        model: provider.model,
        preamble: system?.content || "",
        chat_history: chat.slice(0, -1).map(m => ({ role: m.role === "user" ? "USER" : "CHATBOT", message: m.content })),
        message: chat[chat.length - 1]?.content || "",
        max_tokens: 3000,
        temperature: 0.5,
      }),
    });
    if (!res.ok) throw new Error(`Cohere HTTP ${res.status}`);
    const data = await res.json();
    const text = data?.text || data?.message?.content?.[0]?.text;
    if (!text) throw new Error("Cohere empty response");
    return text;
  }
  const res = await fetch(provider.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${provider.key}`,
      ...(provider.extraHeaders || {}),
    },
    body: JSON.stringify({ model: provider.model, messages, max_tokens: 3000, temperature: 0.5 }),
  });
  if (!res.ok) throw new Error(`${provider.name} HTTP ${res.status}`);
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error(`${provider.name} empty response`);
  return text;
}

async function callAI(messages, system, setProvider) {
  const allMessages = system
    ? [{ role: "system", content: system }, ...messages]
    : messages;
  const tried = new Set();
  const primary = AI_PROVIDERS.find(p => p.name === PRIMARY_PROVIDER_NAME) || AI_PROVIDERS[0];

  // STEP 1 — GeneralCompute is ALWAYS tried first, every single call,
  // as long as it hasn't hit PDF_MAX_FAILS in a row. Fallback only kicks
  // in once it genuinely stops working.
  if (pdfFailCounts[primary.name] < PDF_MAX_FAILS) {
    tried.add(primary.name);
    try {
      console.log(`[PDF] Trying ${primary.name} (${primary.model}) [PRIMARY]`);
      if (setProvider) setProvider(primary.name);
      const text = await callProviderOnce(primary, allMessages);
      pdfFailCounts[primary.name] = 0;
      console.log(`[PDF] ✅ ${primary.name} success`);
      return text;
    } catch (err) {
      pdfFailCounts[primary.name]++;
      console.warn(`[PDF] ❌ ${primary.name} failed (${pdfFailCounts[primary.name]}): ${err.message}`);
      await new Promise(r => setTimeout(r, 500));
    }
  }

  // STEP 2 — fallback round-robin through the rest of the providers
  for (let attempt = 0; attempt < AI_PROVIDERS.length; attempt++) {
    const provider = getNextProvider();
    if (tried.has(provider.name)) continue;
    tried.add(provider.name);
    try {
      console.log(`[PDF] Trying ${provider.name}`);
      if (setProvider) setProvider(provider.name);
      const text = await callProviderOnce(provider, allMessages);
      pdfFailCounts[provider.name] = 0;
      console.log(`[PDF] ✅ ${provider.name} success`);
      return text;
    } catch (err) {
      pdfFailCounts[provider.name]++;
      console.warn(`[PDF] ❌ ${provider.name} failed: ${err.message}`);
      await new Promise(r => setTimeout(r, 500));
    }
  }

  // STEP 3 — everything failed: reset all counters so next call retries primary again
  AI_PROVIDERS.forEach(p => { pdfFailCounts[p.name] = 0; });
  pdfRRIndex = 0;
  throw new Error("All AI providers failed. Please try again.");
}

// ─── JSON REPAIR ──────────────────────────────────────────────────────────────
function repairJSON(raw) {
  const start = raw.indexOf("{");
  if (start === -1) return null;
  let str = raw.slice(start);
  let depth = 0, inStr = false, esc = false, lastEnd = -1;
  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    if (esc) { esc = false; continue; }
    if (c === "\\" && inStr) { esc = true; continue; }
    if (c === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (c === "{" || c === "[") depth++;
    if (c === "}" || c === "]") { depth--; if (depth === 0) { lastEnd = i; break; } }
  }
  if (lastEnd !== -1) { try { return JSON.parse(str.slice(0, lastEnd + 1)); } catch (_) {} }
  str = str.trim().replace(/,\s*$/, "").replace(/,\s*([}\]])/g, "$1");
  const opens = []; inStr = false; esc = false;
  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    if (esc) { esc = false; continue; }
    if (c === "\\" && inStr) { esc = true; continue; }
    if (c === '"') {
      if (!inStr) opens.push('"');
      else if (opens[opens.length - 1] === '"') opens.pop();
      inStr = !inStr; continue;
    }
    if (inStr) continue;
    if (c === "{") opens.push("{");
    else if (c === "[") opens.push("[");
    else if (c === "}") { if (opens[opens.length - 1] === "{") opens.pop(); }
    else if (c === "]") { if (opens[opens.length - 1] === "[") opens.pop(); }
  }
  let closing = "";
  if (inStr) closing += '"';
  for (let i = opens.length - 1; i >= 0; i--)
    closing += opens[i] === "{" ? "}" : opens[i] === "[" ? "]" : "";
  try { return JSON.parse(str + closing); } catch (_) { return null; }
}

function parseJSON(text) {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) { try { return JSON.parse(fence[1].trim()); } catch (_) {} }
  const direct = text.match(/\{[\s\S]*\}/);
  if (direct) { try { return JSON.parse(direct[0]); } catch (_) {} }
  return repairJSON(text);
}

// ─── SECTION NAMES ────────────────────────────────────────────────────────────
function generateSectionNames(count, docType) {
  const templates = {
    "Research Document":   ["Introduction & Background","Literature Review","Research Methodology","Conceptual Framework","Data Collection","Statistical Analysis","Key Findings","Patterns & Trends","Case Studies","Comparative Analysis","Discussion","Theoretical Implications","Practical Applications","Limitations","Future Research","Policy Recommendations","Socioeconomic Context","Global Perspectives","Technology Integration","Conclusion"],
    "Business Document":   ["Executive Overview","Market Analysis","Industry Landscape","Competitive Intelligence","Financial Performance","Revenue & Growth","Customer Segmentation","Operational Efficiency","Supply Chain","Risk Assessment","Strategic Opportunities","Stakeholder Analysis","Implementation Roadmap","Resource Requirements","KPIs & Metrics","Digital Transformation","Innovation Strategy","Talent & HR","Regulatory Compliance","Future Outlook"],
    "Academic Paper":      ["Abstract & Introduction","Theoretical Framework","Literature Review","Research Design","Methodology","Data Collection","Empirical Analysis","Quantitative Results","Qualitative Insights","Comparative Discussion","Scholarly Implications","Critique & Limitations","Interdisciplinary Perspectives","Societal Context","Policy Relevance","Ethical Considerations","Cross-Cultural Analysis","Longitudinal Dimensions","Future Directions","Conclusion"],
    "Technical Guide":     ["Overview & Purpose","System Architecture","Prerequisites & Setup","Core Concepts","Installation Guide","Configuration Details","Implementation Steps","API Reference","Integration Patterns","Testing & Validation","Performance Optimization","Security Hardening","Monitoring","Troubleshooting","Best Practices","Scalability Planning","High Availability","Disaster Recovery","Advanced Topics","Reference Appendix"],
    "General Document":    ["Introduction","Background & Context","Core Concepts","Historical Overview","Current Landscape","Key Stakeholders","Detailed Analysis","Critical Findings","Data & Evidence","Comparative Perspectives","Practical Applications","Impact Assessment","Challenges & Solutions","Best Practices","Innovation & Technology","Policy Implications","Global Context","Case Examples","Future Considerations","Conclusion"],
  };
  const base = templates[docType] || templates["General Document"];
  const result = [...base];
  let extra = 0;
  while (result.length < count) result.push(`Extended Analysis ${++extra}`);
  return result.slice(0, count);
}

// ─── DEFAULTS ─────────────────────────────────────────────────────────────────
function ensureSection(s, i, topic) {
  return {
    heading: s.heading || `Section ${i + 1}`,
    content: s.content?.length > 100
      ? s.content
      : `This section provides a comprehensive examination of ${s.heading || `Section ${i + 1}`} in the context of ${topic}. The analysis integrates quantitative metrics and qualitative insights from systematic research. Key dimensions are explored with supporting evidence from authoritative sources. Findings reveal important patterns with practical implications for stakeholders.`,
    subsections: Array.isArray(s.subsections) && s.subsections.length > 0
      ? s.subsections.map(sub => ({
          heading: sub.heading || "Analysis",
          content: sub.content?.length > 60
            ? sub.content
            : `Detailed analysis of ${sub.heading || "key aspects"} reveals critical patterns for practitioners.`,
        }))
      : [
          { heading: "Detailed Analysis", content: "A comprehensive examination reveals critical patterns and insights. The analytical process incorporated deductive reasoning to arrive at well-grounded conclusions supported by evidence." },
          { heading: "Key Implications",  content: "Practical implications extend across multiple domains and stakeholder groups. Implementation requires careful attention to contextual factors and resource constraints." },
          { heading: "Future Outlook",    content: "Emerging trends suggest a rapidly evolving landscape. Technological advances will reshape the environment, creating opportunities for proactive organizations." },
        ],
    points: Array.isArray(s.points) && s.points.length >= 3
      ? s.points
      : [
          "Finding 1: Evidence demonstrates significant positive correlations between systematic implementation and improved outcomes across key dimensions.",
          "Finding 2: Organizations investing in comprehensive capability development outperform peers by 15–40% on key performance indicators.",
          "Finding 3: Early adopters of evidence-based approaches experience substantially better long-term outcomes and higher resilience.",
          "Finding 4: Stakeholder engagement is the most critical success factor in implementation efforts.",
          "Finding 5: Technology integration amplifies human capital investments by 2–5× when properly sequenced.",
        ],
    has_table: Boolean(s.has_table),
    table: s.table?.headers?.length > 0 ? s.table : { headers: [], rows: [] },
    has_chart: Boolean(s.has_chart),
    chart_type: s.chart_type || "bar",
    chart_data: s.chart_data?.labels?.length > 0
      ? s.chart_data
      : { labels: ["2020","2021","2022","2023","2024","2025"], values: [28,42,58,71,85,96] },
  };
}

function ensureResult(parsed, topic, docType) {
  if (!parsed || typeof parsed !== "object") return null;
  if (!Array.isArray(parsed.sections)) parsed.sections = [];
  return {
    title: parsed.title || topic,
    subtitle: parsed.subtitle || `A Comprehensive ${docType}`,
    executive_summary: parsed.executive_summary?.length > 100
      ? parsed.executive_summary
      : `This ${docType} presents an exhaustive analysis of ${topic}, synthesizing insights from cutting-edge research. The scope encompasses historical evolution, current state, emerging trends, and strategic imperatives. Methodology combined systematic literature review, quantitative analysis, and expert consultation. Key findings highlight integrated strategies as the primary driver of sustained performance improvements.`,
    sections: parsed.sections.map((s, i) => ensureSection(s, i, topic)),
    conclusion: parsed.conclusion?.length > 100
      ? parsed.conclusion
      : `This analysis of ${topic} generates significant insights for evidence-based decision-making. Evidence supports the central thesis while revealing nuances for practitioners. Findings demonstrate the interconnected nature of variables and underscore the importance of integrated approaches.`,
    recommendations: Array.isArray(parsed.recommendations) && parsed.recommendations.length >= 3
      ? parsed.recommendations
      : [
          "Establish a dedicated cross-functional task force with executive sponsorship and adequate resources to lead the strategic agenda.",
          "Invest in comprehensive capability development through targeted training programs and strategic partnerships.",
          "Implement a robust monitoring framework with quarterly KPI reviews and adaptive management protocols.",
          "Pursue strategic alliances to accelerate innovation cycles and access specialized capabilities.",
          "Develop comprehensive risk management protocols with clear escalation pathways for high-priority scenarios.",
        ],
    references: Array.isArray(parsed.references) && parsed.references.length >= 3
      ? parsed.references
      : [
          `Academic Research Institute (2024). Study on ${topic}. Journal of Advanced Research, 52(3), 201–225.`,
          `Industry Analysis Group (2023). Annual benchmark report: ${topic}. Global Publications.`,
          `Expert Review Panel (2024). ${topic}: Emerging perspectives. International Review Quarterly, 15(2), 78–103.`,
          `National Research Council (2024). Governance frameworks for ${topic}. NRC Technical Report, Vol. 8.`,
        ],
  };
}

// ─── EDITABLE TEXT ────────────────────────────────────────────────────────────
function EditableText({ value, onChange, tag: Tag = "p", style = {}, editMode }) {
  const [active, setActive] = useState(false);
  const ref = useRef(null);
  if (!editMode) return <Tag style={style}>{value}</Tag>;
  return (
    <Tag
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      onFocus={() => setActive(true)}
      onBlur={() => { setActive(false); if (ref.current) onChange(ref.current.innerText); }}
      style={{
        ...style,
        outline: active ? "2px solid #0FA968" : "1px dashed rgba(15,169,104,0.35)",
        borderRadius: 3,
        cursor: "text",
        minHeight: "1em",
      }}
    >
      {value}
    </Tag>
  );
}

// ─── SVG CHARTS ───────────────────────────────────────────────────────────────
function BarChart({ data, color }) {
  if (!data?.labels?.length) return null;
  const max = Math.max(...data.values, 1);
  const W = 480, H = 180, pL = 44, pB = 32, pT = 16, pR = 16;
  const cW = W - pL - pR, cH = H - pB - pT;
  const bW = Math.min(36, (cW / data.labels.length) - 8);
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: "block" }}>
      {[0, 0.25, 0.5, 0.75, 1].map(r => (
        <g key={r}>
          <line x1={pL} x2={W - pR} y1={pT + cH * (1 - r)} y2={pT + cH * (1 - r)} stroke="#e8e8e8" strokeWidth="1" />
          <text x={pL - 6} y={pT + cH * (1 - r) + 4} fontSize="9" fill="#aaa" textAnchor="end">{Math.round(max * r)}</text>
        </g>
      ))}
      {data.labels.map((label, i) => {
        const x = pL + (cW / data.labels.length) * i + (cW / data.labels.length - bW) / 2;
        const bH = (data.values[i] / max) * cH;
        return (
          <g key={i}>
            <rect x={x} y={pT + cH - bH} width={bW} height={bH} fill={color} rx="3" opacity="0.85" />
            <text x={x + bW / 2} y={H - pB + 14} fontSize="9" fill="#666" textAnchor="middle">{label}</text>
          </g>
        );
      })}
    </svg>
  );
}

function LineChart({ data, color }) {
  if (!data?.labels?.length) return null;
  const max = Math.max(...data.values, 1);
  const W = 480, H = 180, pL = 44, pB = 32, pT = 16, pR = 16;
  const cW = W - pL - pR, cH = H - pB - pT;
  const pts = data.values.map((v, i) => `${pL + (cW / (data.labels.length - 1 || 1)) * i},${pT + cH - (v / max) * cH}`);
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: "block" }}>
      {[0, 0.25, 0.5, 0.75, 1].map(r => (
        <line key={r} x1={pL} x2={W - pR} y1={pT + cH * (1 - r)} y2={pT + cH * (1 - r)} stroke="#e8e8e8" strokeWidth="1" />
      ))}
      <polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" />
      {data.values.map((v, i) => {
        const x = pL + (cW / (data.labels.length - 1 || 1)) * i;
        const y = pT + cH - (v / max) * cH;
        return <circle key={i} cx={x} cy={y} r="4" fill={color} />;
      })}
      {data.labels.map((label, i) => (
        <text key={i} x={pL + (cW / (data.labels.length - 1 || 1)) * i} y={H - pB + 14} fontSize="9" fill="#666" textAnchor="middle">{label}</text>
      ))}
    </svg>
  );
}

function PieChart({ data, color }) {
  if (!data?.labels?.length) return null;
  const total = data.values.reduce((a, b) => a + b, 0) || 1;
  const colors = [color, "#1596D6", "#0FA968", "#F2A93B", "#0C8457", "#1A237E"];
  let angle = -Math.PI / 2;
  return (
    <svg width="100%" viewBox="0 0 320 180" style={{ display: "block" }}>
      {data.values.map((v, i) => {
        const slice = (v / total) * 2 * Math.PI;
        const x1 = 90 + 75 * Math.cos(angle), y1 = 90 + 75 * Math.sin(angle);
        const x2 = 90 + 75 * Math.cos(angle + slice), y2 = 90 + 75 * Math.sin(angle + slice);
        const path = `M 90 90 L ${x1} ${y1} A 75 75 0 ${slice > Math.PI ? 1 : 0} 1 ${x2} ${y2} Z`;
        angle += slice;
        return <path key={i} d={path} fill={colors[i % colors.length]} stroke="#fff" strokeWidth="2" />;
      })}
      {data.labels.map((label, i) => (
        <g key={i} transform={`translate(190,${20 + i * 20})`}>
          <rect width="12" height="12" fill={colors[i % colors.length]} rx="2" />
          <text x="16" y="10" fontSize="9" fill="#444">{label} ({Math.round(data.values[i] / total * 100)}%)</text>
        </g>
      ))}
    </svg>
  );
}

function SectionChart({ section, T }) {
  if (!section.has_chart || !section.chart_data?.labels?.length) return null;
  return (
    <div style={{ background: "#fafafa", border: `1px solid ${T.light}`, borderRadius: 8, padding: 14, margin: "14px 0" }}>
      <div style={{ fontSize: 10, color: T.accent, fontWeight: 700, marginBottom: 8, fontFamily: "sans-serif", textTransform: "uppercase", letterSpacing: 1 }}>
        {section.chart_type === "bar" ? "📊 Bar Chart" : section.chart_type === "line" ? "📈 Line Chart" : "🥧 Pie Chart"} — {section.heading}
      </div>
      {section.chart_type === "bar"  && <BarChart  data={section.chart_data} color={T.primary} />}
      {section.chart_type === "line" && <LineChart data={section.chart_data} color={T.primary} />}
      {section.chart_type === "pie"  && <PieChart  data={section.chart_data} color={T.primary} />}
    </div>
  );
}

function SectionTable({ section, T }) {
  if (!section.has_table || !section.table?.headers?.length) return null;
  return (
    <div style={{ margin: "14px 0", borderRadius: 8, overflow: "hidden", border: `1px solid ${T.light}` }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr style={{ background: T.primary }}>
            {section.table.headers.map((h, i) => (
              <th key={i} style={{ padding: "9px 12px", color: "#fff", textAlign: "left", fontWeight: 600 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(section.table.rows || []).map((row, ri) => (
            <tr key={ri} style={{ background: ri % 2 === 0 ? T.light : "#fff" }}>
              {row.map((cell, ci) => (
                <td key={ci} style={{ padding: "8px 12px", color: "#333", borderBottom: `1px solid ${T.light}` }}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function PDFMaker() {
  const previewRef = useRef(null);

  const [step,        setStep]        = useState(1);
  const [inputType,   setInputType]   = useState("1");
  const [topic,       setTopic]       = useState("");
  const [userContent, setUserContent] = useState("");
  const [roughNotes,  setRoughNotes]  = useState("");
  const [docType,     setDocType]     = useState("Research Document");
  const [language,    setLanguage]    = useState("English");
  const [style,       setStyle]       = useState("professional");
  const [result,      setResult]      = useState(null);
  const [error,       setError]       = useState("");
  const [editMode,    setEditMode]    = useState(false);
  const [viewFull,    setViewFull]    = useState(false);
  const [loadingMsg,  setLoadingMsg]  = useState("Initializing…");
  const [loadingPct,  setLoadingPct]  = useState(0);
  const [activeProvider, setActiveProvider] = useState("");

  const A = APP_THEME;
  const T = PDF_THEME;

  const updateResult = useCallback((path, value) => {
    setResult(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      const keys = path.split(".");
      let obj = next;
      for (let i = 0; i < keys.length - 1; i++) {
        const k = keys[i];
        obj = isNaN(k) ? obj[k] : obj[parseInt(k)];
      }
      const last = keys[keys.length - 1];
      obj[isNaN(last) ? last : parseInt(last)] = value;
      return next;
    });
  }, []);

  // ── BUILD PROMPT ───────────────────────────────────────────────────────────
  function buildPrompt(sectionList, isFirst) {
    const langRule = {
      English:  "English only.",
      Hindi:    "Hindi (Devanagari) only.",
      Hinglish: "Hinglish (Roman Hindi+English).",
    }[language];
    const styleRule = {
      professional: "Formal, data-driven, with real statistics.",
      academic:     "Scholarly, rigorous, with citations.",
      simple:       "Clear, accessible, easy to understand.",
      detailed:     "Exhaustive, thorough, in-depth analysis.",
    }[style];
    const chunkSize = Math.ceil(AUTO_SECTIONS / 2);

    const secDefs = sectionList.map((name, i) => {
      const globalIdx = isFirst ? i : chunkSize + i;
      const hasChart  = globalIdx < AUTO_CHARTS;
      const hasTable  = !hasChart && (globalIdx - AUTO_CHARTS) < AUTO_TABLES;
      const chartType = ["bar","line","pie","bar","line"][globalIdx % 5];
      return JSON.stringify({
        heading: name,
        content: `[Write 5-6 detailed sentences about ${name} with real stats, examples, and insights]`,
        subsections: [
          { heading: "Detailed Analysis", content: "[3-4 sentences of rigorous analysis with specific data points]" },
          { heading: "Key Implications",  content: "[3-4 sentences on real-world impact and practical applications]" },
        ],
        points: [
          "[Finding 1 with specific data or percentage]",
          "[Finding 2 with trend or growth metric]",
          "[Finding 3 on best practices with evidence]",
          "[Finding 4 on risks or challenges with context]",
          "[Finding 5 on future outlook with projections]",
        ],
        has_table: hasTable,
        table: hasTable ? {
          headers: ["Category","Value","Growth Rate","Priority"],
          rows: [
            ["Primary Segment","$3.2B","↑22% YoY","High"],
            ["Secondary Segment","$1.8B","↑14% YoY","Medium"],
            ["Emerging Segment","$0.7B","↑48% YoY","High"],
          ],
        } : { headers: [], rows: [] },
        has_chart: hasChart,
        chart_type: chartType,
        chart_data: hasChart ? {
          labels: ["2020","2021","2022","2023","2024","2025"],
          values: [18,28,42,58,74,92],
        } : { labels: [], values: [] },
      });
    });

    if (isFirst) {
      return `Write a comprehensive ${docType} on: "${topic}".
Writing style: ${styleRule}
Language: ${langRule}
${userContent ? `User provided content (use as primary source):\n${userContent.slice(0, 800)}\n` : ""}
${roughNotes  ? `Rough notes to incorporate:\n${roughNotes.slice(0, 400)}\n` : ""}

Return ONLY raw JSON (no markdown, no backticks, no explanation):
{"title":"[specific descriptive title]","subtitle":"[informative subtitle]","executive_summary":"[5-6 sentences covering purpose, methodology, key findings, and implications with specific data]","sections":[${secDefs.join(",")}]}`;
    } else {
      return `Continue the ${docType} on "${topic}".
Style: ${styleRule} Language: ${langRule}

Return ONLY raw JSON:
{"sections":[${secDefs.join(",")}],"conclusion":"[6-7 sentences synthesizing all findings, future outlook, and call to action with specific insights]","recommendations":["[Rec 1: specific actionable step]","[Rec 2: capability building]","[Rec 3: technology investment]","[Rec 4: stakeholder engagement]","[Rec 5: monitoring framework]"],"references":["Author, A. (2024). ${topic}: A systematic review. Journal of Advanced Research, 52(3), 201-225.","Industry Research Group (2024). Annual benchmark report on ${topic}. Global Publications Ltd.","Expert Panel (2023). ${topic}: Emerging perspectives. International Quarterly Review, 15(2), 78-103.","National Research Council (2024). Policy frameworks for ${topic}. NRC Technical Report Series, Vol. 8."]}`;
    }
  }

  // ── GENERATE ───────────────────────────────────────────────────────────────
  async function generateDocument() {
    if (!topic.trim()) { setError("Please enter a topic."); return; }
    setError(""); setStep(2); setLoadingPct(0); setActiveProvider("");

    const sectionNames = generateSectionNames(AUTO_SECTIONS, docType);
    const chunkSize    = Math.ceil(AUTO_SECTIONS / 2);
    const chunk1Names  = sectionNames.slice(0, chunkSize);
    const chunk2Names  = sectionNames.slice(chunkSize);

    const sys = "You are an expert professional document writer. Return ONLY raw valid JSON with no markdown, no backticks, no explanation text. Replace ALL placeholder text in brackets with real, detailed, specific content. Never truncate — always complete the full JSON.";

    let finalResult = null;
    try {
      setLoadingMsg("✍️ Phase 1/2: Writing first half…");
      setLoadingPct(10);
      let part1 = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const t1 = await callAI([{ role: "user", content: buildPrompt(chunk1Names, true) }], sys, setActiveProvider);
          part1 = parseJSON(t1);
          if (part1?.sections?.length) break;
        } catch (e) {
          if (attempt === 2) throw e;
          await new Promise(r => setTimeout(r, 1200 * (attempt + 1)));
        }
      }
      setLoadingPct(55);
      setLoadingMsg(`✍️ Phase 2/2: Writing sections ${chunkSize + 1}–${AUTO_SECTIONS}…`);

      let part2 = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const t2 = await callAI([{ role: "user", content: buildPrompt(chunk2Names, false) }], sys, setActiveProvider);
          part2 = parseJSON(t2);
          if (part2?.sections?.length) break;
        } catch (e) {
          if (attempt === 2) throw e;
          await new Promise(r => setTimeout(r, 1200 * (attempt + 1)));
        }
      }
      setLoadingPct(92);

      const sec1 = (part1?.sections || chunk1Names.map(h => ({ heading: h }))).map(s => ({ ...s }));
      const sec2 = (part2?.sections || chunk2Names.map(h => ({ heading: h }))).map(s => ({ ...s }));

      finalResult = ensureResult({
        title:             part1?.title || topic,
        subtitle:          part1?.subtitle || "",
        executive_summary: part1?.executive_summary || "",
        sections:          [...sec1, ...sec2],
        conclusion:        part2?.conclusion || "",
        recommendations:   part2?.recommendations || [],
        references:        part2?.references || [],
      }, topic, docType);

      setLoadingPct(100);
    } catch (e) {
      setError("Generation failed: " + e.message);
      setStep(1);
      return;
    }

    if (!finalResult) { setError("Could not build document. Try again."); setStep(1); return; }
    setResult(finalResult);
    setStep(3);
    setEditMode(false);
  }

  // ── DOWNLOAD PDF ───────────────────────────────────────────────────────────
  function downloadPDF() {
    if (!previewRef.current) return;
    const win = window.open("", "_blank");
    if (!win) { alert("Popup blocked! Please allow popups and try again."); return; }
    win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>${result?.title || topic}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Georgia,serif;font-size:13.5px;line-height:1.9;color:#1a1a1a;background:#fff}
@media print{
  body{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .no-break{page-break-inside:avoid}
  @page{margin:15mm 20mm}
}
</style>
</head><body>${previewRef.current.innerHTML}</body></html>`);
    win.document.close();
    setTimeout(() => { win.focus(); win.print(); }, 700);
  }

  // ── DOCUMENT PREVIEW ───────────────────────────────────────────────────────
  function DocumentPreview() {
    if (!result) return null;
    return (
      <div ref={previewRef} style={{ background: "#fff", fontFamily: "'Georgia',serif", fontSize: 13.5, lineHeight: 1.9, color: "#1a1a1a" }}>

        {/* Cover */}
        <div style={{ background: T.primary, padding: "52px 48px 44px" }}>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", marginBottom: 12, letterSpacing: 2.5, textTransform: "uppercase", fontFamily: "sans-serif" }}>
            🤖 MK-AI · {docType}
          </div>
          <EditableText tag="h1" value={result.title}
            onChange={v => updateResult("title", v)} editMode={editMode}
            style={{ color: "#fff", fontSize: 30, fontWeight: 700, margin: "0 0 14px", lineHeight: 1.3, fontFamily: "'Georgia',serif" }} />
          {result.subtitle && (
            <EditableText tag="p" value={result.subtitle}
              onChange={v => updateResult("subtitle", v)} editMode={editMode}
              style={{ color: "rgba(255,255,255,0.7)", fontSize: 15, margin: 0, fontFamily: "sans-serif" }} />
          )}
        </div>

        <div style={{ padding: "36px 48px 52px" }}>

          {/* Executive Summary */}
          {result.executive_summary && (
            <div style={{ background: T.light, borderLeft: `5px solid ${T.accent}`, borderRadius: "0 10px 10px 0", padding: "22px 26px", marginBottom: 36 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: T.primary, letterSpacing: 1.8, textTransform: "uppercase", marginBottom: 12, fontFamily: "sans-serif" }}>Executive Summary</div>
              <EditableText tag="p" value={result.executive_summary}
                onChange={v => updateResult("executive_summary", v)} editMode={editMode}
                style={{ margin: 0, color: "#2a2a2a", lineHeight: 2.0, fontSize: 13.5 }} />
            </div>
          )}

          {/* Table of Contents */}
          {result.sections?.length > 0 && (
            <div style={{ border: `1px solid ${T.light}`, borderRadius: 10, overflow: "hidden", marginBottom: 40 }}>
              <div style={{ background: T.primary, padding: "12px 22px" }}>
                <span style={{ color: "#fff", fontSize: 11, fontWeight: 700, letterSpacing: 1.8, textTransform: "uppercase", fontFamily: "sans-serif" }}>Table of Contents</span>
              </div>
              <div style={{ padding: "14px 22px", background: T.light }}>
                {result.sections.map((s, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: i < result.sections.length - 1 ? `1px solid rgba(0,0,0,0.06)` : "none" }}>
                    <span style={{ fontSize: 13, color: T.primary, fontFamily: "sans-serif" }}>{i + 1}. {s.heading}</span>
                    <span style={{ fontSize: 10, color: T.accent, fontFamily: "sans-serif", flexShrink: 0 }}>{s.has_chart ? "📊" : ""}{s.has_table ? "📋" : ""}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sections */}
          {result.sections?.map((section, idx) => (
            <div key={idx} className="no-break" style={{ marginBottom: 48 }}>
              <div style={{ background: T.primary, padding: "13px 22px", borderRadius: 9, marginBottom: 20 }}>
                <EditableText tag="span"
                  value={`${idx + 1}. ${section.heading}`}
                  onChange={v => updateResult(`sections.${idx}.heading`, v.replace(/^\d+\.\s*/, ""))}
                  editMode={editMode}
                  style={{ color: "#fff", fontSize: 15.5, fontWeight: 700, fontFamily: "sans-serif", display: "block" }} />
              </div>
              {section.content && (
                <EditableText tag="p" value={section.content}
                  onChange={v => updateResult(`sections.${idx}.content`, v)} editMode={editMode}
                  style={{ color: "#1e1e1e", lineHeight: 2.05, marginBottom: 22, fontSize: 13.5, textAlign: "justify" }} />
              )}
              {section.subsections?.map((sub, si) => (
                <div key={si} style={{ marginBottom: 20, paddingLeft: 22, borderLeft: `3px solid ${T.accent}` }}>
                  <EditableText tag="div" value={sub.heading}
                    onChange={v => updateResult(`sections.${idx}.subsections.${si}.heading`, v)} editMode={editMode}
                    style={{ fontSize: 14, fontWeight: 700, color: T.primary, marginBottom: 8, fontFamily: "sans-serif" }} />
                  <EditableText tag="p" value={sub.content}
                    onChange={v => updateResult(`sections.${idx}.subsections.${si}.content`, v)} editMode={editMode}
                    style={{ color: "#333", fontSize: 13.5, lineHeight: 1.95, margin: 0, textAlign: "justify" }} />
                </div>
              ))}
              {section.points?.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ background: T.accent, color: "#fff", fontSize: 10, fontWeight: 700, padding: "8px 18px", borderRadius: "7px 7px 0 0", letterSpacing: 1.5, textTransform: "uppercase", fontFamily: "sans-serif" }}>Key Points & Findings</div>
                  <div style={{ background: T.light, borderRadius: "0 0 7px 7px", padding: "16px 20px" }}>
                    {section.points.map((pt, pi) => (
                      <div key={pi} style={{ display: "flex", gap: 12, marginBottom: 12, alignItems: "flex-start" }}>
                        <span style={{ color: T.accent, fontSize: 14, fontWeight: 700, marginTop: 2, flexShrink: 0 }}>▸</span>
                        <EditableText tag="span" value={pt}
                          onChange={v => updateResult(`sections.${idx}.points.${pi}`, v)} editMode={editMode}
                          style={{ fontSize: 13.5, color: "#222", lineHeight: 1.85, display: "block" }} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <SectionChart section={section} T={T} />
              <SectionTable section={section} T={T} />
            </div>
          ))}

          {/* Conclusion */}
          {result.conclusion && (
            <div style={{ marginBottom: 36 }}>
              <div style={{ background: T.primary, padding: "13px 22px", borderRadius: 9, marginBottom: 18 }}>
                <span style={{ color: "#fff", fontSize: 15.5, fontWeight: 700, fontFamily: "sans-serif" }}>Conclusion</span>
              </div>
              <EditableText tag="p" value={result.conclusion}
                onChange={v => updateResult("conclusion", v)} editMode={editMode}
                style={{ color: "#1e1e1e", lineHeight: 2.05, margin: 0, fontSize: 13.5, textAlign: "justify" }} />
            </div>
          )}

          {/* Recommendations */}
          {result.recommendations?.length > 0 && (
            <div style={{ background: T.light, borderRadius: 10, padding: 24, marginBottom: 32 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: T.primary, marginBottom: 16, letterSpacing: 1.8, textTransform: "uppercase", fontFamily: "sans-serif" }}>Strategic Recommendations</div>
              {result.recommendations.map((r, i) => (
                <div key={i} style={{ display: "flex", gap: 16, marginBottom: 16, alignItems: "flex-start" }}>
                  <span style={{ background: T.accent, color: "#fff", borderRadius: "50%", width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flexShrink: 0, fontFamily: "sans-serif" }}>{i + 1}</span>
                  <EditableText tag="span" value={r}
                    onChange={v => updateResult(`recommendations.${i}`, v)} editMode={editMode}
                    style={{ fontSize: 13.5, color: "#222", lineHeight: 1.9, display: "block" }} />
                </div>
              ))}
            </div>
          )}

          {/* References */}
          {result.references?.length > 0 && (
            <div style={{ borderTop: `2px solid ${T.light}`, paddingTop: 22 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: T.primary, marginBottom: 14, letterSpacing: 1.8, textTransform: "uppercase", fontFamily: "sans-serif" }}>References</div>
              {result.references.map((r, i) => (
                <div key={i} style={{ fontSize: 12.5, color: "#444", marginBottom: 9, lineHeight: 1.75, paddingLeft: 20, textIndent: "-20px" }}>[{i + 1}] {r}</div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ borderTop: `3px solid ${T.primary}`, padding: "14px 48px", background: "#fafafa", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 10, color: "#999", fontFamily: "sans-serif" }}>🤖 MK-AI · {new Date().toLocaleDateString("en-IN")}</span>
          <span style={{ fontSize: 10, color: T.accent, fontWeight: 700, fontFamily: "sans-serif" }}>mkai.tech</span>
        </div>
      </div>
    );
  }

  // ── RENDER ─────────────────────────────────────────────────────────────────
  const accentActiveStyle = { background: "rgba(15,169,104,0.10)", outline: "1px solid rgba(15,169,104,0.4)", color: "#0C8457" };
  const accentInactiveStyle = { background: "rgba(18,54,42,0.03)", outline: `1px solid ${A.cardBorder}`, color: A.textSub };

  return (
    <div style={{
      minHeight: "100vh",
      backgroundColor: A.pageBg,
      backgroundImage: A.bgGradient,
      color: A.textPrimary,
      fontFamily: "'Inter',ui-sans-serif,system-ui,sans-serif",
      transition: "background 0.3s,color 0.3s",
    }}>

      <Helmet>
        <title>AI PDF Tools — Edit & Export PDFs | MK AI</title>
        <meta name="description" content="Edit PDFs live and export pixel-perfect documents with MK AI's PDF tools." />
      </Helmet>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;650;700;800&display=swap');
        *{box-sizing:border-box}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
        .btn-mk{transition:transform 0.2s,box-shadow 0.2s,opacity 0.2s;}
        .btn-mk:hover{opacity:0.9;transform:translateY(-2px);}
        .btn-mk:active{transform:translateY(0);}
        .ghost-mk{transition:background 0.2s,border-color 0.2s,color 0.2s;}
        .ghost-mk:hover{background:rgba(15,169,104,0.08)!important;border-color:${A.accentSolid}!important;color:${A.accentSolid}!important;}
        input:focus,select:focus,textarea:focus{border-color:${A.accentSolid}!important;outline:none!important;box-shadow:0 0 0 3px rgba(15,169,104,0.14)!important;}
        ::-webkit-scrollbar{width:4px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:rgba(15,169,104,0.18);border-radius:3px}
        .grid-bg{
          background-image:linear-gradient(${A.grid} 1px,transparent 1px),linear-gradient(90deg,${A.grid} 1px,transparent 1px);
          background-size:52px 52px;
        }
      `}</style>

      {/* HEADER */}
      <header style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "13px 26px",
        borderBottom: `1px solid ${A.headerBorder}`,
        position: "sticky", top: 0,
        backgroundColor: A.headerBg,
        backdropFilter: "blur(20px)",
        zIndex: 100,
      }}>
        <button className="ghost-mk" style={{
          background: "transparent",
          border: `1px solid ${A.ghostBtnBorder}`,
          color: A.ghostBtnColor,
          padding: "7px 16px",
          borderRadius: 9,
          cursor: "pointer",
          fontSize: 13,
          fontFamily: "'Inter',sans-serif",
          fontWeight: 500,
        }}
          onClick={() => window.history.back()}>← Back</button>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 34, height: 34,
            background: A.accentGrad,
            borderRadius: 10,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 17,
            boxShadow: A.btnShadow,
          }}>📄</div>
          <span style={{ fontSize: 15, fontWeight: 700, color: A.textPrimary, fontFamily: "'Inter',sans-serif", letterSpacing: "-0.2px" }}>PDF Maker</span>
          <span style={{
            fontSize: 10, color: A.labelColor,
            background: A.labelBg,
            padding: "2px 10px",
            borderRadius: 20,
            border: `1px solid ${A.labelBorder}`,
            fontWeight: 600,
            letterSpacing: 0.5,
          }}>8 AI Providers</span>
        </div>

        <div style={{ width: 78 }} />
      </header>

      <main style={{ padding: "36px 22px 64px" }}>

        {/* ── STEP 1: FORM ── */}
        {step === 1 && (
          <div style={{ maxWidth: 680, margin: "0 auto", animation: "fadeUp 0.35s ease" }}>
            <div style={{ textAlign: "center", marginBottom: 32 }}>
              <h1 style={{
                fontFamily: "'Inter',sans-serif",
                fontSize: 28,
                fontWeight: 800,
                margin: "0 0 10px",
                color: A.textPrimary,
                letterSpacing: "-0.5px",
              }}>Create Your Document</h1>
              <p style={{ color: A.textMuted, fontSize: 14, margin: 0 }}>Smart AI writing · Charts · Tables · Instant PDF</p>
            </div>

            {error && (
              <div style={{ background: A.errorBg, border: `1px solid ${A.errorBorder}`, borderRadius: 10, padding: "12px 18px", marginBottom: 18, color: A.errorColor, fontSize: 13 }}>⚠ {error}</div>
            )}

            {/* Input Mode */}
            <div style={{ background: A.cardBg, backdropFilter: "blur(16px) saturate(150%)", border: `1px solid ${A.cardBorder}`, boxShadow: A.glassShadow, borderRadius: 18, padding: 20, marginBottom: 12 }}>
              <Label num="01" text="Input Mode" A={A} />
              <div style={{ display: "flex", gap: 8 }}>
                {[["1","Topic Only","AI writes everything"],["2","Your Content","Expand your text"],["3","Topic + Notes","Hybrid approach"]].map(([v, l, sub]) => (
                  <button key={v} className="btn-mk" onClick={() => setInputType(v)} style={{
                    flex: 1, padding: "12px 10px", borderRadius: 12, border: "none", cursor: "pointer", textAlign: "left",
                    ...(inputType === v ? accentActiveStyle : accentInactiveStyle),
                  }}>
                    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 3 }}>{l}</div>
                    <div style={{ fontSize: 10, color: A.textMuted }}>{sub}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Content */}
            <div style={{ background: A.cardBg, backdropFilter: "blur(16px) saturate(150%)", border: `1px solid ${A.cardBorder}`, boxShadow: A.glassShadow, borderRadius: 18, padding: 20, marginBottom: 12 }}>
              <Label num="02" text="Content" A={A} />
              <FieldLabel A={A}>Topic / Title <span style={{ color: "#EF4444" }}>*</span></FieldLabel>
              <input style={{
                width: "100%", background: A.inputBg, border: `1px solid ${A.inputBorder}`,
                borderRadius: 11, padding: "10px 13px", color: A.inputColor,
                fontSize: 13, fontFamily: "'Inter',sans-serif",
              }}
                value={topic} onChange={e => setTopic(e.target.value)}
                onKeyDown={e => e.key === "Enter" && generateDocument()}
                placeholder="e.g. Artificial Intelligence in Healthcare…" />
              {(inputType === "2" || inputType === "3") && (
                <>
                  <FieldLabel A={A} style={{ marginTop: 14 }}>Your Content</FieldLabel>
                  <textarea style={{
                    width: "100%", background: A.inputBg, border: `1px solid ${A.inputBorder}`,
                    borderRadius: 11, padding: "10px 13px", color: A.inputColor,
                    fontSize: 13, fontFamily: "'Inter',sans-serif", resize: "vertical",
                  }}
                    rows={4} value={userContent} onChange={e => setUserContent(e.target.value)} placeholder="Paste your existing content…" />
                </>
              )}
              {inputType === "3" && (
                <>
                  <FieldLabel A={A} style={{ marginTop: 14 }}>Rough Notes</FieldLabel>
                  <textarea style={{
                    width: "100%", background: A.inputBg, border: `1px solid ${A.inputBorder}`,
                    borderRadius: 11, padding: "10px 13px", color: A.inputColor,
                    fontSize: 13, fontFamily: "'Inter',sans-serif", resize: "vertical",
                  }}
                    rows={3} value={roughNotes} onChange={e => setRoughNotes(e.target.value)} placeholder="Bullet points, rough ideas…" />
                </>
              )}
            </div>

            {/* Document Settings */}
            <div style={{ background: A.cardBg, backdropFilter: "blur(16px) saturate(150%)", border: `1px solid ${A.cardBorder}`, boxShadow: A.glassShadow, borderRadius: 18, padding: 20, marginBottom: 12 }}>
              <Label num="03" text="Document Settings" A={A} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 }}>
                <div>
                  <FieldLabel A={A}>Document Type</FieldLabel>
                  <select style={{
                    width: "100%", background: A.selectBg, border: `1px solid ${A.inputBorder}`,
                    borderRadius: 11, padding: "10px 13px", color: A.inputColor,
                    fontSize: 13, fontFamily: "'Inter',sans-serif",
                  }}
                    value={docType} onChange={e => setDocType(e.target.value)}>
                    {DOC_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <FieldLabel A={A}>Language</FieldLabel>
                  <select style={{
                    width: "100%", background: A.selectBg, border: `1px solid ${A.inputBorder}`,
                    borderRadius: 11, padding: "10px 13px", color: A.inputColor,
                    fontSize: 13, fontFamily: "'Inter',sans-serif",
                  }}
                    value={language} onChange={e => setLanguage(e.target.value)}>
                    {LANGUAGES.map(l => <option key={l}>{l}</option>)}
                  </select>
                </div>
              </div>
              <FieldLabel A={A}>Writing Style</FieldLabel>
              <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                {STYLES.map(s => (
                  <button key={s} className="btn-mk" onClick={() => setStyle(s)} style={{
                    padding: "7px 16px", borderRadius: 10, border: "none", cursor: "pointer",
                    fontSize: 12, fontWeight: 600,
                    ...(style === s ? accentActiveStyle : accentInactiveStyle),
                  }}>{s.charAt(0).toUpperCase() + s.slice(1)}</button>
                ))}
              </div>
            </div>

            <button className="btn-mk" onClick={generateDocument} style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
              width: "100%", color: "#fff", border: "none", padding: "15px 20px",
              borderRadius: 16, cursor: "pointer", fontSize: 15, fontWeight: 700,
              fontFamily: "'Inter',sans-serif",
              background: A.accentGrad,
              boxShadow: A.btnShadow,
              marginTop: 6,
              letterSpacing: "0.2px",
            }}>🤖 Generate with MK-AI ✦</button>
          </div>
        )}

        {/* ── STEP 2: LOADING ── */}
        {step === 2 && (
          <div style={{ textAlign: "center", padding: "80px 20px", animation: "fadeUp 0.35s ease" }}>
            <div style={{ width: 64, height: 64, margin: "0 auto 24px", position: "relative" }}>
              <div style={{ position: "absolute", inset: 0, border: `2.5px solid ${A.accentSolid}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.75s linear infinite" }} />
              <div style={{ position: "absolute", inset: 10, border: `2px solid rgba(21,150,214,0.35)`, borderBottomColor: "transparent", borderRadius: "50%", animation: "spin 1.1s linear infinite reverse" }} />
            </div>
            <h2 style={{ fontFamily: "'Inter',sans-serif", fontSize: 20, fontWeight: 700, margin: "0 0 10px", color: A.textPrimary, letterSpacing: "-0.3px" }}>{loadingMsg}</h2>
            <div style={{ width: 320, height: 4, background: "rgba(18,54,42,0.08)", borderRadius: 3, margin: "18px auto", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${loadingPct}%`, background: A.accentGrad, borderRadius: 3, transition: "width 0.6s ease" }} />
            </div>
            {activeProvider && (
              <p style={{ color: A.textMuted, fontSize: 12 }}>Using {activeProvider}</p>
            )}
          </div>
        )}

        {/* ── STEP 3: RESULT ── */}
        {step === 3 && result && (
          <div style={{ maxWidth: 1100, margin: "0 auto", animation: "fadeUp 0.35s ease" }}>
            {/* Top Bar */}
            <div style={{
              display: "flex", flexWrap: "wrap", alignItems: "center",
              justifyContent: "space-between", gap: 10, marginBottom: 16,
              background: A.topBarBg, border: `1px solid ${A.topBarBorder}`,
              borderRadius: 14, padding: "12px 18px",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#22C55E", boxShadow: "0 0 6px #22C55E" }} />
                <span style={{ fontSize: 14, fontWeight: 700, color: A.textPrimary }}>Document Ready</span>
                <span style={{ fontSize: 11, color: A.textMuted }}>— {result.sections?.length} sections</span>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button className="ghost-mk" style={{ background: "transparent", border: `1px solid ${A.ghostBtnBorder}`, color: A.ghostBtnColor, padding: "8px 16px", borderRadius: 11, cursor: "pointer", fontSize: 13, fontWeight: 500 }}
                  onClick={() => { setStep(1); setResult(null); setEditMode(false); }}>+ New</button>
                <button className="ghost-mk" onClick={() => setViewFull(v => !v)} style={{
                  background: viewFull ? "rgba(15,169,104,0.08)" : "transparent",
                  border: `1px solid ${A.ghostBtnBorder}`, color: A.ghostBtnColor,
                  padding: "8px 16px", borderRadius: 11, cursor: "pointer", fontSize: 13, fontWeight: 500,
                }}>{viewFull ? "⊟ Compact" : "⊞ Full"}</button>
                <button className="ghost-mk" onClick={() => setEditMode(e => !e)} style={{
                  background: editMode ? "rgba(15,169,104,0.1)" : "transparent",
                  border: editMode ? `1px solid ${A.accentSolid}` : `1px solid ${A.ghostBtnBorder}`,
                  color: editMode ? A.accentSolid : A.ghostBtnColor,
                  padding: "8px 16px", borderRadius: 11, cursor: "pointer", fontSize: 13, fontWeight: 500,
                }}>
                  {editMode ? "✓ Done" : "✏ Edit"}
                </button>
                <button className="btn-mk" onClick={downloadPDF} style={{
                  display: "flex", alignItems: "center", gap: 6,
                  background: A.accentGrad, color: "#fff", border: "none",
                  padding: "8px 18px", borderRadius: 11, cursor: "pointer",
                  fontSize: 13, fontWeight: 700, boxShadow: A.btnShadow,
                }}>⬇ Download PDF</button>
              </div>
            </div>

            {editMode && (
              <div style={{ background: A.editBanner, border: `1px solid ${A.editBannerBorder}`, borderRadius: 11, padding: "10px 16px", marginBottom: 14, fontSize: 12, color: A.editBannerColor }}>
                ✏️ Edit mode active — click any text to modify
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: viewFull ? "1fr" : "1fr 250px", gap: 14, alignItems: "start" }}>
              {/* Preview */}
              <div style={{
                borderRadius: 16, overflow: "hidden",
                boxShadow: "0 20px 64px rgba(15,90,70,0.12)",
                border: `1px solid ${A.topBarBorder}`,
              }}>
                <div style={{ background: A.previewBarBg, borderBottom: `1px solid ${A.previewBarBorder}`, padding: "10px 16px", display: "flex", alignItems: "center", gap: 6 }}>
                  {["#EF4444","#F2A93B","#0FA968"].map(c => <div key={c} style={{ width: 9, height: 9, borderRadius: "50%", background: c }} />)}
                  <span style={{ marginLeft: 8, fontSize: 11, color: A.textMuted }}>Preview · {result.sections?.length} sections</span>
                </div>
                <div style={{ maxHeight: viewFull ? "none" : 740, overflowY: "auto" }}>
                  <DocumentPreview />
                </div>
              </div>

              {/* Sidebar */}
              {!viewFull && (
                <div style={{ display: "flex", flexDirection: "column", gap: 11, position: "sticky", top: 72 }}>
                  <div style={{ background: A.sideCardBg, backdropFilter: "blur(16px) saturate(150%)", border: `1px solid ${A.sideCardBorder}`, boxShadow: A.glassShadow, borderRadius: 16, padding: 14 }}>
                    <SideLabel A={A}>Document Stats</SideLabel>
                    {[["Sections", result.sections?.length || 0],["Charts", result.sections?.filter(s => s.has_chart).length || 0],["Tables", result.sections?.filter(s => s.has_table).length || 0],["Refs", result.references?.length || 0]].map(([l, v]) => (
                      <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: `1px solid ${A.statBorder}` }}>
                        <span style={{ fontSize: 12, color: A.statLabel }}>{l}</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: A.accentSolid }}>{v}</span>
                      </div>
                    ))}
                  </div>
                  <button className="btn-mk" onClick={downloadPDF} style={{
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                    background: A.accentGrad, color: "#fff", border: "none",
                    padding: 12, borderRadius: 12, cursor: "pointer",
                    fontSize: 13, fontWeight: 700, boxShadow: A.btnShadow,
                  }}>⬇ Download PDF</button>
                  <button className="ghost-mk" style={{
                    background: "transparent", border: `1px solid ${A.ghostBtnBorder}`,
                    color: A.ghostBtnColor, padding: "9px 16px", borderRadius: 11,
                    cursor: "pointer", fontSize: 13, textAlign: "center", width: "100%", fontWeight: 500,
                  }}
                    onClick={() => { setStep(1); setResult(null); setEditMode(false); }}>+ New Document</button>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// ─── HELPER COMPONENTS ────────────────────────────────────────────────────────
function Label({ num, text, A }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 14 }}>
      <span style={{
        fontSize: 10, fontWeight: 700, color: A.labelColor,
        background: A.labelBg, border: `1px solid ${A.labelBorder}`,
        padding: "2px 8px", borderRadius: 5, letterSpacing: 1,
      }}>{num}</span>
      <span style={{ fontSize: 14, fontWeight: 700, color: A.textPrimary }}>{text}</span>
    </div>
  );
}

function FieldLabel({ children, style, A }) {
  return <div style={{ fontSize: 12, color: A.textMuted, marginBottom: 7, ...style }}>{children}</div>;
}

function SideLabel({ children, A }) {
  return <div style={{ fontSize: 10, fontWeight: 700, color: A.textMuted, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 10 }}>{children}</div>;
}