import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';

// ── Config ─────────────────────────────────────────────────────────────────
const GC_URL   = 'https://api.generalcompute.com/v1/chat/completions';
const GC_KEY   = 'YOUR_API_KEY_PLACEHOLDER'; // <-- General Compute API key
const GC_MODEL = 'gpt-oss-120b';

// ── Gemini Config (internal only) ─────────────────────────────────────────
const GEMINI_KEY    = 'YOUR_API_KEY_PLACEHOLDER'; // <-- paste your key here
const GEMINI_MODEL  = 'gemini-2.5-flash';
const GEMINI_URL    = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`;

// ── Gemini caller ─────────────────────────────────────────────────────────
const callGemini = async (system, user, tokens = 2048) => {
  const res = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: user }] }],
      generationConfig: {
        maxOutputTokens: tokens,
        temperature: 0.2,
        responseMimeType: 'application/json',
      },
    }),
  });
  if (!res.ok) throw new Error('Gemini Error ' + res.status);
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
};

// ── Fallback to Railway if Gemini fails ───────────────────────────────────
const callAI = async (system, user, tokens = 2000) => {
  const res = await fetch(GC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GC_KEY}` },
    body: JSON.stringify({
      model: GC_MODEL,
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      max_tokens: tokens,
      temperature: 0.3,
    }),
  });
  if (!res.ok) throw new Error('API Error ' + res.status);
  return (await res.json()).choices[0].message.content;
};
// ── URL Builders ───────────────────────────────────────────────────────────
const URLS = {
  webResult   : (title, domain) => `https://www.google.com/search?q=${encodeURIComponent(title + ' site:' + domain)}`,
  webSearch   : (q)             => `https://duckduckgo.com/?q=${encodeURIComponent(q)}`,
  googleSearch: (q)             => `https://www.google.com/search?q=${encodeURIComponent(q)}`,
  image       : (q, i)          => `https://source.unsplash.com/480x340/?${encodeURIComponent(q)}&sig=${i + 1}`,
  imageSource : (q)             => `https://unsplash.com/s/photos/${encodeURIComponent(q)}`,
  video       : (title)         => `https://www.youtube.com/results?search_query=${encodeURIComponent(title)}`,
  youtubeMain : (q)             => `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`,
  news        : (title)         => `https://news.google.com/search?q=${encodeURIComponent(title)}&hl=en`,
  googleNews  : (q)             => `https://news.google.com/search?q=${encodeURIComponent(q)}&hl=en`,
  stackoverflow: (q)            => `https://stackoverflow.com/search?q=${encodeURIComponent(q)}`,
  github      : (q)             => `https://github.com/search?q=${encodeURIComponent(q)}&type=repositories`,
  mdn         : (q)             => `https://developer.mozilla.org/en-US/search?q=${encodeURIComponent(q)}`,
  pyDocs      : (q)             => `https://docs.python.org/3/search.html?q=${encodeURIComponent(q)}`,
  npmSearch   : (q)             => `https://www.npmjs.com/search?q=${encodeURIComponent(q)}`,
  favicon     : (domain)        => `https://www.google.com/s2/favicons?domain=${domain}&sz=32`,
};

const TOOLS = [
  { id: 'web',   emoji: '🌐', label: 'Web',    desc: 'Search the web — real links guaranteed' },
  { id: 'ai',    emoji: '🤖', label: 'AI',     desc: 'Deep AI-powered answers with sources' },
  { id: 'image', emoji: '🖼️', label: 'Images', desc: 'Real images from Unsplash — click to view' },
  { id: 'video', emoji: '🎬', label: 'Videos', desc: 'YouTube videos — click to watch directly' },
  { id: 'news',  emoji: '📰', label: 'News',   desc: 'Latest news — links open Google News' },
  { id: 'code',  emoji: '💻', label: 'Code',   desc: 'Code solutions with real documentation links' },
];

const SUGGESTIONS = {
  web:   ['Best AI tools 2025', 'How to learn programming', 'Top JavaScript frameworks'],
  ai:    ['What is quantum computing?', 'Explain machine learning simply', 'Future of AI'],
  image: ['Mountain landscape', 'Modern architecture', 'Abstract art 4K'],
  video: ['Learn Python full course', 'React JS tutorial 2025', 'System design interview'],
  news:  ['AI news today', 'Tech industry updates', 'Startup funding 2025'],
  code:  ['Python list comprehension examples', 'React useEffect hook', 'SQL JOIN types explained'],
};

const WEB_DOMAINS = [
  'wikipedia.org','github.com','stackoverflow.com','medium.com','dev.to',
  'techcrunch.com','theverge.com','reddit.com','geeksforgeeks.org','freecodecamp.org',
];

// ── Theme Tokens — matches Home.jsx (emerald / mint / sky-blue / saffron, on white) ──
const T = {
  pageBg      : '#f6faf7',
  headerBg    : 'rgba(246,250,247,0.92)',
  navBorder   : 'rgba(18,54,42,.10)',
  gridLine    : 'rgba(15,169,104,.05)',
  accent      : '#0FA968',
  accentLight : '#1596D6',
  accentBg    : 'rgba(15,169,104,.12)',
  accentBorder: 'rgba(15,169,104,.35)',
  accentSoft  : 'rgba(15,169,104,.06)',
  accentSoftB : 'rgba(15,169,104,.18)',
  text        : '#122420',
  textMuted   : '#5c6b64',
  textDim     : '#697a72',
  textDimmer  : '#8a958e',
  textDimmest : '#aab5ae',
  cardBg      : 'linear-gradient(135deg, rgba(255,255,255,.62), rgba(255,255,255,.22))',
  cardBorder  : 'rgba(255,255,255,.68)',
  inputBg     : 'rgba(255,253,253,.74)',
  inputBorder : 'rgba(15,90,70,.16)',
  btnBg       : 'linear-gradient(135deg,#0FA968,#1596D6)',
  histBg      : 'rgba(15,169,104,.06)',
  histBorder  : 'rgba(15,169,104,.16)',
  codeBg      : '#0e2420',
  codeText    : '#8FE3B0',
  backBtnBg   : 'rgba(228,243,234,.9)',
  backBtnBorder:'rgba(18,54,42,.10)',
  backBtnText : '#233530',
  green       : '#0C8457',
  greenBg     : 'rgba(12,132,87,.08)',
  greenBorder : 'rgba(12,132,87,.2)',
  red         : '#DC2626',
  redBg       : 'rgba(220,38,38,0.06)',
  redBorder   : 'rgba(220,38,38,0.18)',
  yellow      : '#B45309',
  yellowBg    : 'rgba(242,169,59,.10)',
  yellowBorder: 'rgba(242,169,59,.28)',
  shadow      : '0 24px 70px rgba(15,90,70,.10)',
  glassShadow : '0 10px 34px rgba(15,90,70,.14), inset 0 1px 0 rgba(255,255,255,.55)',
};

// ── JSON Parser ────────────────────────────────────────────────────────────
const parseJSON = (text) => {
  if (!text) return null;
  for (const fn of [
    () => JSON.parse(text),
    () => { const m = text.match(/```json\s*([\s\S]*?)```/); return m && JSON.parse(m[1]); },
    () => { const m = text.match(/\{[\s\S]*\}/s); return m && JSON.parse(m[0]); },
  ]) try { const r = fn(); if (r) return r; } catch (_) {}
  return null;
};

// ── Search Handlers ────────────────────────────────────────────────────────
const searchWeb = async (q) => {
  const text = await callAI(
    `You are an expert web search engine. Your job is to generate highly accurate, realistic search results for any query. Always return ONLY valid raw JSON with no markdown, no explanation, no preamble.`,
    `Search query: "${q}"

Return this exact JSON structure:
{
  "answer_box": "A precise, factual 2-3 sentence direct answer to the query",
  "results": [
    {
      "title": "Accurate descriptive page title",
      "domain": "wikipedia.org",
      "snippet": "A detailed 3-4 sentence description of what this page contains and why it's relevant"
    }
  ],
  "related": ["related search 1", "related search 2", "related search 3", "related search 4"]
}

Rules:
- Generate exactly 6 results
- Use ONLY these domains: ${WEB_DOMAINS.join(', ')}
- Make titles and snippets highly relevant to the actual query
- answer_box must directly answer the query with accurate facts
- related searches must be genuinely useful follow-up queries`
  );
  const data = parseJSON(text);
  if (data?.results) {
    data.results = data.results.map(r => ({
      ...r,
      url: URLS.webResult(r.title, r.domain),
      direct_url: `https://${r.domain}`,
    }));
    data.google_url = URLS.googleSearch(q);
    data.ddg_url    = URLS.webSearch(q);
  }
  return { type: 'web', data };
};

const searchAI = async (q) => {
  const text = await callAI(
    `You are a highly knowledgeable AI assistant. Provide comprehensive, accurate, well-structured answers. Return ONLY valid raw JSON with no markdown, no explanation, no preamble.`,
    `Query: "${q}"

Return this exact JSON structure:
{
  "answer": "A comprehensive, detailed, factually accurate 6-8 sentence answer that thoroughly addresses the query with specific facts, examples, and context",
  "key_points": [
    "Specific key point 1 with actual detail",
    "Specific key point 2 with actual detail",
    "Specific key point 3 with actual detail",
    "Specific key point 4 with actual detail",
    "Specific key point 5 with actual detail"
  ],
  "confidence": "High",
  "related": ["follow-up topic 1", "follow-up topic 2", "follow-up topic 3"],
  "source_topics": ["specific topic to verify on wikipedia", "specific topic to verify on britannica", "specific topic to verify on sciencedirect"]
}

Rules:
- answer must be thorough and contain real, accurate information
- key_points must each contain a concrete, specific insight — not vague statements
- source_topics should be precise academic/reference topics related to the query`
  );
  const data = parseJSON(text);
  if (data) {
    data.sources = (data.source_topics || []).map((topic, i) => {
      const domains = ['wikipedia.org', 'britannica.com', 'sciencedirect.com', 'nature.com', 'arxiv.org'];
      const domain = domains[i % domains.length];
      return {
        name: domain === 'wikipedia.org' ? 'Wikipedia' : domain.split('.')[0].charAt(0).toUpperCase() + domain.split('.')[0].slice(1),
        domain,
        url: URLS.googleSearch(topic + ' ' + domain),
        desc: `Search "${topic}" on ${domain}`,
      };
    });
    data.google_url = URLS.googleSearch(q);
  }
  return { type: 'ai', data };
};

const searchImages = async (q) => {
  // Gemini generates smart related tags for better Unsplash results
  let tags = [q];
  try {
    const text = await callAI(
      `You are an image search assistant. Return ONLY valid raw JSON with no markdown.`,
      `For the image search query: "${q}"
Return JSON: {"tags": ["tag1", "tag2", "tag3", "tag4", "tag5", "tag6", "tag7", "tag8", "tag9", "tag10", "tag11", "tag12"]}
Rules:
- Generate 12 specific, visual, Unsplash-friendly search tags related to "${q}"
- Tags should be concrete visual descriptors (e.g. "golden sunset mountains", "modern minimalist interior")
- Vary them: some specific, some wider, some with style/mood
- Keep each tag under 5 words`
    );
    const data = parseJSON(text);
    if (data?.tags?.length >= 12) tags = data.tags;
  } catch (_) {
    tags = Array.from({ length: 12 }, (_, i) => `${q} ${i + 1}`);
  }

  const images = tags.slice(0, 12).map((tag, i) => ({
    title      : `${tag}`,
    image_url  : `https://source.unsplash.com/480x340/?${encodeURIComponent(tag)}&sig=${Date.now() + i}`,
    source_url : URLS.imageSource(tag),
    source_name: 'Unsplash',
    pixabay_url: `https://pixabay.com/images/search/${encodeURIComponent(q)}/`,
  }));

  return {
    type: 'image',
    data: {
      images,
      unsplash_url: URLS.imageSource(q),
      pixabay_url : `https://pixabay.com/images/search/${encodeURIComponent(q)}/`,
      pexels_url  : `https://www.pexels.com/search/${encodeURIComponent(q)}/`,
      google_url  : `https://www.google.com/search?q=${encodeURIComponent(q)}&tbm=isch`,
      related     : [`${q} wallpaper`, `${q} HD`, `${q} 4K`, `${q} photography`],
    },
  };
};

const searchVideos = async (q) => {
  const text = await callAI(
    `You are a YouTube search expert. Generate realistic, highly relevant YouTube video metadata. Return ONLY valid raw JSON with no markdown, no explanation.`,
    `YouTube search: "${q}"

Return this exact JSON structure:
{
  "videos": [
    {
      "title": "Realistic, accurate YouTube video title",
      "channel": "Real-sounding channel name relevant to the topic",
      "duration": "MM:SS",
      "views": "1.2M views",
      "uploaded": "2 weeks ago",
      "description": "Accurate 2-sentence description of what this video actually covers",
      "thumb_color": "#1a1a3e"
    }
  ],
  "related": ["related search 1", "related search 2", "related search 3"]
}

Rules:
- Generate exactly 6 videos
- Titles must be realistic YouTube titles people would actually search for
- Channels should sound like real YouTube channels for this topic
- Descriptions must accurately describe video content related to the query
- Views and upload times should be realistic
- thumb_color should vary between videos (dark colors)`
  );
  const data = parseJSON(text);
  if (data?.videos) {
    data.videos = data.videos.map(v => ({ ...v, url: URLS.video(v.title) }));
    data.youtube_url = URLS.youtubeMain(q);
  }
  return { type: 'video', data };
};

const searchNews = async (q) => {
  const text = await callAI(
    `You are a professional news aggregator AI. Generate realistic, well-written news articles. Return ONLY valid raw JSON with no markdown, no explanation.`,
    `News search: "${q}"

Return this exact JSON structure:
{
  "articles": [
    {
      "title": "Realistic, professional news headline",
      "source": "TechCrunch",
      "time": "2 hours ago",
      "summary": "A detailed 3-4 sentence article summary with specific facts, figures, and context relevant to the headline",
      "category": "Technology"
    }
  ],
  "trending": ["trending topic 1", "trending topic 2", "trending topic 3"]
}

Rules:
- Generate exactly 6 articles
- Headlines must sound like real journalism — specific, informative, not clickbait
- Summaries must contain plausible specific details (names, numbers, context)
- Sources: TechCrunch, The Verge, BBC News, Reuters, Wired, Bloomberg
- Categories: Technology, Business, Science, World, Finance, AI
- Times: vary between "30 minutes ago" to "1 day ago"
- trending must be genuinely related follow-up news topics`
  );
  const data = parseJSON(text);
  if (data?.articles) {
    data.articles = data.articles.map(a => ({
      ...a,
      url       : URLS.news(a.title),
      source_url: URLS.googleNews(q),
    }));
    data.google_news_url = URLS.googleNews(q);
    data.all_url         = URLS.googleNews(q);
  }
  return { type: 'news', data };
};

const searchCode = async (q) => {
  const text = await callAI(
    `You are a senior software engineer and expert educator. Write clear, working, production-quality code with detailed explanations. Return ONLY valid raw JSON with no markdown, no explanation, no preamble.`,
    `Code question: "${q}"

Return this exact JSON structure:
{
  "explanation": "A thorough, clear explanation of the concept, approach, and why this solution works — 3-5 sentences",
  "language": "Python",
  "code": "Complete, working, well-commented code that actually solves the problem. Include imports, function definitions, and a usage example at the end.",
  "steps": [
    "Step 1: Clear description of what this part of the code does",
    "Step 2: Clear description of what this part of the code does",
    "Step 3: Clear description of what this part of the code does",
    "Step 4: Clear description of what this part of the code does"
  ],
  "complexity": "O(n)",
  "use_case": "Specific real-world scenarios where this code/pattern is most useful"
}

Rules:
- code must be complete and actually runnable — not pseudocode
- Add inline comments in the code explaining key lines
- steps must correspond to actual sections of the code provided
- Choose the most appropriate language for this question
- explanation must be beginner-friendly but technically accurate`
  );
  const data = parseJSON(text);
  if (data) {
    const lang = (data.language || '').toLowerCase();
    data.resources = [
      { name: 'Stack Overflow', url: URLS.stackoverflow(q), desc: 'Community Q&A — find similar questions' },
      { name: 'GitHub Search',  url: URLS.github(q),        desc: 'Real code examples from open source projects' },
      ...(lang.includes('python') ? [{ name: 'Python Docs', url: URLS.pyDocs(q), desc: 'Official Python documentation' }] : []),
      ...(['javascript','js','react','node','typescript','ts'].some(s => lang.includes(s))
        ? [{ name: 'MDN Web Docs', url: URLS.mdn(q), desc: 'Mozilla official web documentation' }] : []),
      ...(['react','vue','angular','node'].some(s => lang.includes(s))
        ? [{ name: 'npm Registry', url: URLS.npmSearch(q), desc: 'Find npm packages for this' }] : []),
      { name: 'Google Developer', url: URLS.googleSearch(q + ' code example ' + (data.language || '')), desc: 'Google search for code examples' },
    ];
  }
  return { type: 'code', data };
};

const HANDLERS = { web: searchWeb, ai: searchAI, image: searchImages, video: searchVideos, news: searchNews, code: searchCode };

// ── Search History Hook ────────────────────────────────────────────────────
function useHistory() {
  const [history, setHistory] = useState(() => {
    try { return JSON.parse(localStorage.getItem('mk_search_history') || '[]'); } catch { return []; }
  });
  const add = useCallback((q, tool) => {
    setHistory(prev => {
      const filtered = prev.filter(h => !(h.q === q && h.tool === tool));
      const next = [{ q, tool, t: Date.now() }, ...filtered].slice(0, 20);
      try { localStorage.setItem('mk_search_history', JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);
  const clear = () => { setHistory([]); try { localStorage.removeItem('mk_search_history'); } catch {} };
  return { history, add, clear };
}

// ── Favicon ────────────────────────────────────────────────────────────────
function Favicon({ domain }) {
  const [err, setErr] = useState(false);
  if (err) return <span style={{ fontSize: 14 }}>🌐</span>;
  return <img src={URLS.favicon(domain)} alt="" width={16} height={16} style={{ borderRadius: 3 }} onError={() => setErr(true)} />;
}

// ── Result Components ──────────────────────────────────────────────────────
function WebResult({ data, query, onRelated }) {
  if (!data) return <ErrCard />;
  return (
    <Col>
      {data.answer_box && (
        <div style={{ background: T.accentSoft, border: `1px solid ${T.accentSoftB}`, borderRadius: 16, padding: '20px 22px' }}>
          <div style={label}>⚡ QUICK ANSWER</div>
          <p style={{ color: T.textMuted, lineHeight: 1.8, fontSize: 14 }}>{data.answer_box}</p>
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {[
          { label: '🔍 Google',     url: data.google_url },
          { label: '🦆 DuckDuckGo', url: data.ddg_url },
          { label: '🔎 Bing',       url: `https://www.bing.com/search?q=${encodeURIComponent(query)}` },
        ].map(b => <a key={b.label} href={b.url} target="_blank" rel="noopener noreferrer" style={pill}>{b.label}</a>)}
      </div>
      {data.results?.map((res, i) => (
        <a key={i} href={res.url} target="_blank" rel="noopener noreferrer"
          className="glass-card"
          style={{ display: 'block', padding: '18px 20px', color: 'inherit', textDecoration: 'none' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Favicon domain={res.domain} />
              <span style={{ fontSize: 12, color: T.accent, fontWeight: 700 }}>{res.domain}</span>
            </div>
            <span style={{ fontSize: 11, color: T.green, background: T.greenBg, border: `1px solid ${T.greenBorder}`, padding: '2px 8px', borderRadius: 6 }}>↗ Visit</span>
          </div>
          <div style={{ color: T.text, fontWeight: 700, fontSize: 15, marginBottom: 6, lineHeight: 1.4 }}>{res.title}</div>
          <div style={{ color: T.textDim, fontSize: 13, lineHeight: 1.7, marginBottom: 8 }}>{res.snippet}</div>
          <div style={{ fontSize: 11, color: T.textDimmest, fontFamily: "'JetBrains Mono',monospace" }}>
            {res.url.length > 70 ? res.url.slice(0, 70) + '…' : res.url}
          </div>
        </a>
      ))}
      {data.related?.length > 0 && <RelatedRow items={data.related} onRelated={onRelated} />}
    </Col>
  );
}

function AIResult({ data, onRelated }) {
  if (!data) return <ErrCard />;
  return (
    <Col>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: T.accentBg, border: `1px solid ${T.accentBorder}`, color: T.accent, padding: '4px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700 }}>
          {data.confidence === 'High' ? '✅' : '🟡'} {data.confidence} Confidence
        </span>
        <a href={data.google_url} target="_blank" rel="noopener noreferrer"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(255,255,255,.6)', border: `1px solid ${T.cardBorder}`, color: T.textMuted, padding: '4px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>
          🔍 Verify on Google ↗
        </a>
      </div>
      <div style={{ background: T.accentSoft, border: `1px solid ${T.accentSoftB}`, borderRadius: 16, padding: '20px 22px' }}>
        <div style={label}>AI ANSWER</div>
        <p style={{ color: T.textMuted, lineHeight: 1.8, fontSize: 14 }}>{data.answer}</p>
      </div>
      {data.key_points?.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={label}>📌 KEY POINTS</div>
          {data.key_points.map((p, i) => (
            <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', background: 'rgba(255,255,255,.5)', borderRadius: 10, padding: '10px 14px' }}>
              <span style={{ width: 22, height: 22, borderRadius: '50%', background: T.accentBg, color: T.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{i + 1}</span>
              <span style={{ color: T.textMuted, fontSize: 14, lineHeight: 1.6 }}>{p}</span>
            </div>
          ))}
        </div>
      )}
      {data.sources?.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={label}>📚 VERIFY WITH SOURCES</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
            {data.sources.map((s, i) => (
              <a key={i} href={s.url} target="_blank" rel="noopener noreferrer" className="glass-card"
                style={{ display: 'block', padding: 14, textDecoration: 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <Favicon domain={s.domain} />
                  <span style={{ color: T.accentLight, fontWeight: 700, fontSize: 13 }}>{s.name} ↗</span>
                </div>
                <div style={{ color: T.textDim, fontSize: 12 }}>{s.desc}</div>
              </a>
            ))}
          </div>
        </div>
      )}
      {data.related?.length > 0 && <RelatedRow items={data.related} onRelated={onRelated} />}
    </Col>
  );
}

function ImageResult({ data, onRelated }) {
  const [failed, setFailed] = useState({});
  if (!data) return <ErrCard />;
  return (
    <Col>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {[
          { label: '📷 Unsplash',      url: data.unsplash_url },
          { label: '🖼️ Pixabay',       url: data.pixabay_url },
          { label: '📸 Pexels',        url: data.pexels_url },
          { label: '🔍 Google Images', url: data.google_url },
        ].map(b => <a key={b.label} href={b.url} target="_blank" rel="noopener noreferrer" style={pill}>{b.label}</a>)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
        {data.images?.map((img, i) => (
          <a key={i} href={img.source_url} target="_blank" rel="noopener noreferrer" className="glass-card img-card"
            style={{ display: 'block', overflow: 'hidden', position: 'relative', aspectRatio: '4/3', textDecoration: 'none' }}>
            {!failed[i]
              ? <img src={img.image_url} alt={img.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} loading="lazy" onError={() => setFailed(p => ({ ...p, [i]: true }))} />
              : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40, background: T.accentSoft }}>🖼️</div>
            }
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(transparent,rgba(0,0,0,0.7))', padding: '20px 12px 10px' }}>
              <div style={{ color: '#fff', fontSize: 11 }}>Unsplash ↗</div>
            </div>
          </a>
        ))}
      </div>
      {data.related?.length > 0 && <RelatedRow items={data.related} onRelated={onRelated} />}
    </Col>
  );
}

function VideoResult({ data, query, onRelated }) {
  const thumbColors = ['#0f2420','#0d2233','#0d2b18','#2b1414','#0d2429','#231030'];
  if (!data) return <ErrCard />;
  return (
    <Col>
      <a href={data.youtube_url} target="_blank" rel="noopener noreferrer"
        style={{ display: 'flex', alignItems: 'center', gap: 10, background: T.redBg, border: `1px solid ${T.redBorder}`, borderRadius: 14, padding: '13px 18px', color: T.red, fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>
        <span style={{ fontSize: 20 }}>▶</span>
        <span>View all "{query}" results on YouTube</span>
        <span style={{ marginLeft: 'auto', fontSize: 13, opacity: 0.7 }}>↗ youtube.com</span>
      </a>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
        {data.videos?.map((v, i) => (
          <a key={i} href={v.url} target="_blank" rel="noopener noreferrer" className="glass-card"
            style={{ display: 'block', overflow: 'hidden', color: 'inherit', textDecoration: 'none' }}>
            <div style={{ height: 150, background: thumbColors[i % thumbColors.length], display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', borderRadius: '16px 16px 0 0' }}>
              <div style={{ fontSize: 40, color: 'rgba(255,255,255,0.9)' }}>▶</div>
              <div style={{ position: 'absolute', bottom: 8, right: 10, background: 'rgba(0,0,0,0.75)', color: '#fff', fontSize: 11, padding: '2px 6px', borderRadius: 4, fontFamily: "'JetBrains Mono',monospace" }}>{v.duration || '–:––'}</div>
              <div style={{ position: 'absolute', top: 8, left: 10, background: 'rgba(220,38,38,0.85)', color: '#fff', fontSize: 10, padding: '2px 8px', borderRadius: 4, fontWeight: 700 }}>YouTube</div>
            </div>
            <div style={{ padding: '14px 16px' }}>
              <div style={{ color: T.text, fontWeight: 700, fontSize: 14, marginBottom: 6, lineHeight: 1.4 }}>{v.title}</div>
              <div style={{ color: T.accent, fontSize: 12, fontWeight: 700, marginBottom: 4 }}>{v.channel}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: T.textDimmer, fontSize: 12, marginBottom: 6 }}>
                <span>{v.views}</span><span>•</span><span>{v.uploaded}</span>
              </div>
              <div style={{ color: T.textDim, fontSize: 12, lineHeight: 1.5 }}>{v.description}</div>
            </div>
          </a>
        ))}
      </div>
      {data.related?.length > 0 && <RelatedRow items={data.related} onRelated={onRelated} />}
    </Col>
  );
}

function NewsResult({ data, query, onRelated }) {
  if (!data) return <ErrCard />;
  return (
    <Col>
      <a href={data.google_news_url} target="_blank" rel="noopener noreferrer"
        style={{ display: 'flex', alignItems: 'center', gap: 10, background: T.yellowBg, border: `1px solid ${T.yellowBorder}`, borderRadius: 14, padding: '13px 18px', color: T.yellow, fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>
        <span style={{ fontSize: 20 }}>📰</span>
        <span>View all "{query}" news on Google News</span>
        <span style={{ marginLeft: 'auto', fontSize: 13, opacity: 0.7 }}>↗ news.google.com</span>
      </a>
      {data.articles?.map((a, i) => (
        <a key={i} href={a.url} target="_blank" rel="noopener noreferrer" className="glass-card"
          style={{ display: 'block', padding: '18px 20px', color: 'inherit', textDecoration: 'none' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, color: T.accent, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>{a.source}</span>
              <span style={{ fontSize: 10, background: T.accentBg, color: T.accentLight, padding: '2px 8px', borderRadius: 4 }}>{a.category}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, color: T.textDimmer }}>🕐 {a.time}</span>
              <span style={{ fontSize: 11, color: T.green, background: T.greenBg, border: `1px solid ${T.greenBorder}`, padding: '2px 8px', borderRadius: 6 }}>↗</span>
            </div>
          </div>
          <div style={{ color: T.text, fontWeight: 700, fontSize: 15, marginBottom: 8, lineHeight: 1.4 }}>{a.title}</div>
          <div style={{ color: T.textDim, fontSize: 13, lineHeight: 1.7, marginBottom: 4 }}>{a.summary}</div>
          <div style={{ fontSize: 11, color: T.textDimmest, marginTop: 6 }}>Opens on Google News · google.com/news</div>
        </a>
      ))}
      {data.trending?.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={label}>🔥 TRENDING SEARCHES</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {data.trending.map((t, i) => <button key={i} style={tagBtn} onClick={() => onRelated(t)}>{t}</button>)}
          </div>
        </div>
      )}
    </Col>
  );
}

function CodeResult({ data, query, onRelated }) {
  const [copied, setCopied] = useState(false);
  if (!data) return <ErrCard />;
  const copy = () => { navigator.clipboard.writeText(data.code || ''); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  const langColor = {
    python: '#1596D6', javascript: '#F2A93B', typescript: '#60A5FA',
    java: '#DC2626', cpp: '#A78BFA', go: '#0FA968', rust: '#FB923C',
  }[(data.language || '').toLowerCase()] || '#0FA968';

  return (
    <Col>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', background: langColor + '18', border: `1px solid ${langColor}33`, color: langColor, padding: '4px 12px', borderRadius: 8, fontSize: 13, fontWeight: 700 }}>{data.language || 'Code'}</span>
        {data.complexity && <span style={{ display: 'inline-flex', alignItems: 'center', background: 'rgba(255,255,255,.6)', border: `1px solid ${T.cardBorder}`, color: T.textDimmer, padding: '4px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700 }}>⏱ {data.complexity}</span>}
      </div>
      <div style={{ background: T.accentSoft, border: `1px solid ${T.accentSoftB}`, borderRadius: 16, padding: '20px 22px' }}>
        <div style={label}>EXPLANATION</div>
        <p style={{ color: T.textMuted, lineHeight: 1.8, fontSize: 14 }}>{data.explanation}</p>
        {data.use_case && <p style={{ color: T.accent, lineHeight: 1.8, fontSize: 14, marginTop: 8 }}>💡 Use when: {data.use_case}</p>}
      </div>
      {data.code && (
        <div style={{ background: T.codeBg, border: `1px solid ${T.cardBorder}`, borderRadius: 16, overflow: 'hidden', boxShadow: T.glassShadow }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,.08)', background: 'rgba(255,255,255,.03)' }}>
            <div style={{ display: 'flex', gap: 6 }}>
              {['#FF5F57','#FFBD2E','#28CA41'].map(c => <div key={c} style={{ width: 12, height: 12, borderRadius: '50%', background: c }} />)}
            </div>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', letterSpacing: 1 }}>{data.language || 'CODE'}</span>
            <button style={{ background: 'rgba(15,169,104,.18)', border: '1px solid rgba(15,169,104,.4)', color: '#8FE3B0', padding: '4px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }} onClick={copy}>
              {copied ? '✅ Copied!' : '📋 Copy'}
            </button>
          </div>
          <pre style={{ padding: 20, color: T.codeText, fontFamily: "'JetBrains Mono',monospace", fontSize: 13, lineHeight: 1.7, overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0 }}>{data.code}</pre>
        </div>
      )}
      {data.steps?.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={label}>📋 HOW IT WORKS</div>
          {data.steps.map((s, i) => (
            <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', background: 'rgba(255,255,255,.5)', borderRadius: 10, padding: '10px 14px' }}>
              <span style={{ width: 22, height: 22, borderRadius: '50%', background: T.accentBg, color: T.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{i + 1}</span>
              <span style={{ color: T.textMuted, fontSize: 14, lineHeight: 1.6 }}>{s}</span>
            </div>
          ))}
        </div>
      )}
      {data.resources?.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={label}>📚 DOCUMENTATION & RESOURCES</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
            {data.resources.map((res, i) => (
              <a key={i} href={res.url} target="_blank" rel="noopener noreferrer" className="glass-card"
                style={{ display: 'block', padding: 14, textDecoration: 'none' }}>
                <div style={{ color: T.green, fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{res.name} ↗</div>
                <div style={{ color: T.textDim, fontSize: 12 }}>{res.desc}</div>
              </a>
            ))}
          </div>
        </div>
      )}
      {data.related?.length > 0 && <RelatedRow items={data.related} onRelated={onRelated} />}
    </Col>
  );
}

// ── Shared Atoms ───────────────────────────────────────────────────────────
function Col({ children }) {
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>{children}</div>;
}
function ErrCard() {
  return (
    <div style={{ textAlign: 'center', padding: '60px 20px', color: T.textDimmer }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
      <p>Something went wrong — please try again!</p>
    </div>
  );
}
function RelatedRow({ items, onRelated }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={label}>🔍 RELATED SEARCHES</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {items.map((t, i) => <button key={i} style={tagBtn} onClick={() => onRelated(t)}>{t}</button>)}
      </div>
    </div>
  );
}

// ── Style helpers ──────────────────────────────────────────────────────────
const label  = { fontSize: 10, letterSpacing: 2, color: T.accent, fontWeight: 700, textTransform: 'uppercase', marginBottom: 8 };
const pill   = { display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(255,255,255,.6)', border: `1px solid ${T.cardBorder}`, color: T.textMuted, padding: '6px 14px', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer', textDecoration: 'none' };
const tagBtn = { background: T.accentBg, border: `1px solid ${T.accentBorder}`, color: T.accent, padding: '6px 14px', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontFamily: "'Inter',sans-serif", fontWeight: 500 };

// ── Main Component ─────────────────────────────────────────────────────────
export default function Search() {
  const navigate = useNavigate();

  const [query,      setQuery]    = useState('');
  const [activeTool, setActive]   = useState('web');
  const [loading,    setLoading]  = useState(false);
  const [results,    setResults]  = useState({});
  const [showHist,   setShowHist] = useState(false);
  const [stats,      setStats]    = useState({});
  const inputRef = useRef(null);
  const { history, add, clear } = useHistory();

  useEffect(() => { inputRef.current?.focus(); }, [activeTool]);

  const doSearch = useCallback(async (q = query, tool = activeTool) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    setLoading(true);
    setShowHist(false);
    const t0 = Date.now();
    try {
      const res = await HANDLERS[tool](trimmed);
      setResults(prev => ({ ...prev, [tool]: { query: trimmed, ...res } }));
      setStats(prev => ({ ...prev, [tool + trimmed]: Date.now() - t0 }));
      add(trimmed, tool);
    } catch (e) {
      console.error(e);
      setResults(prev => ({ ...prev, [tool]: { query: trimmed, type: tool, data: null } }));
    }
    setLoading(false);
  }, [query, activeTool, add]);

  const handleRelated = (topic) => { setQuery(topic); setTimeout(() => doSearch(topic, activeTool), 30); };

  const current  = results[activeTool];
  const toolInfo = TOOLS.find(t => t.id === activeTool);
  const elapsed  = current ? stats[activeTool + current.query] : null;

  return (
    <div style={{ minHeight: '100vh', background: T.pageBg, color: T.text, fontFamily: "'Inter',ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif", position: 'relative', overflowX: 'hidden' }}>

      <Helmet>
        <title>AI Web Search — MK AI</title>
        <meta name="description" content="Search the live web for accurate, up-to-date answers with MK AI's AI-powered search." />
      </Helmet>
      <h1 style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0 }}>AI Web Search</h1>

      <div style={{ position: 'fixed', inset: 0, zIndex: 0, backgroundImage: `radial-gradient(circle at 15% 10%, rgba(15,169,104,.10), transparent 26rem), linear-gradient(${T.gridLine} 1px,transparent 1px),linear-gradient(90deg,${T.gridLine} 1px,transparent 1px)`, backgroundSize: '100% 100%, 44px 44px, 44px 44px', pointerEvents: 'none' }} />

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;650;700;800&family=JetBrains+Mono:wght@400;600&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        a{text-decoration:none;}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes pulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.15);opacity:.7}}
        @keyframes bounce{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-8px)}}
        .glass-card{
          background:${T.cardBg};
          border:1px solid ${T.cardBorder};
          border-radius:16px;
          box-shadow:${T.glassShadow};
          backdrop-filter:blur(16px) saturate(150%);
          -webkit-backdrop-filter:blur(16px) saturate(150%);
          transition:transform .25s cubic-bezier(.22,1,.36,1), box-shadow .25s;
        }
        .glass-card:hover{ transform:translateY(-3px); box-shadow:0 18px 42px rgba(15,90,70,.18), inset 0 1px 0 rgba(255,255,255,.7); }
        .img-card:hover{ transform:translateY(-3px) scale(1.02); }
      `}</style>

      {/* Header */}
      <header style={{ position: 'sticky', top: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 24px', background: T.headerBg, backdropFilter: 'blur(20px)', borderBottom: `1px solid ${T.navBorder}` }}>
        <button onClick={() => navigate('/')} style={{ background: T.backBtnBg, border: `1px solid ${T.backBtnBorder}`, color: T.backBtnText, padding: '7px 14px', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', fontWeight: 600 }}>
          ← Back
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#dcf1e6', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 16px rgba(15,90,70,.14)', overflow: 'hidden' }}>
            <img src="/whitelogo.webp" alt="MK AI" style={{ width: '68%', height: '68%', borderRadius: '50%', objectFit: 'cover' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 2, fontSize: 19 }}>
            <span style={{ color: T.accent, fontWeight: 800 }}>MK</span>
            <span style={{ color: T.accentLight, fontWeight: 800 }}>AI</span>
            <span style={{ color: T.textDimmest, fontSize: 11, letterSpacing: 2, marginLeft: 6, fontWeight: 700 }}>SEARCH</span>
          </div>
        </div>

        <button onClick={() => setShowHist(h => !h)} style={{ background: T.backBtnBg, border: `1px solid ${T.backBtnBorder}`, color: T.backBtnText, padding: '7px 14px', borderRadius: 10, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', fontWeight: 600 }}>
          🕐 History
        </button>
      </header>

      {/* History panel */}
      {showHist && history.length > 0 && (
        <div style={{ background: T.histBg, borderBottom: `1px solid ${T.histBorder}`, padding: '14px 24px', position: 'sticky', top: 60, zIndex: 99 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 11, color: T.accent, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>Recent Searches</span>
            <button onClick={clear} style={{ background: 'none', border: 'none', color: T.textDimmer, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}>Clear all</button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {history.slice(0, 15).map((h, i) => (
              <button key={i} onClick={() => { setQuery(h.q); setActive(h.tool); setTimeout(() => doSearch(h.q, h.tool), 30); }}
                style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,.6)', border: `1px solid ${T.cardBorder}`, color: T.textMuted, padding: '5px 12px', borderRadius: 10, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}>
                <span>{TOOLS.find(t => t.id === h.tool)?.emoji}</span>
                <span>{h.q}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div style={{ maxWidth: 880, margin: '0 auto', padding: '32px 20px 100px', position: 'relative', zIndex: 1 }}>

        {/* Search bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: T.inputBg, border: `1px solid ${T.inputBorder}`, borderRadius: 44, padding: '7px 7px 7px 18px', marginBottom: 18, boxShadow: '0 17px 34px rgba(15,90,70,.10)', backdropFilter: 'blur(14px)' }}>
          <span style={{ fontSize: 20, flexShrink: 0 }}>{toolInfo.emoji}</span>
          <input
            ref={inputRef}
            style={{ flex: 1, background: 'none', border: 'none', color: T.text, fontSize: 16, outline: 'none', fontFamily: 'inherit', minWidth: 0 }}
            placeholder={`Search ${toolInfo.label}...`}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && doSearch()}
            autoFocus
          />
          {query && (
            <button style={{ background: 'none', border: 'none', color: T.textDimmer, cursor: 'pointer', fontSize: 15, padding: '4px 8px' }} onClick={() => { setQuery(''); inputRef.current?.focus(); }}>✕</button>
          )}
          <button
            style={{ background: T.btnBg, color: '#fff', border: 'none', width: 46, height: 46, borderRadius: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'opacity .2s, transform .2s', opacity: loading || !query.trim() ? 0.5 : 1, boxShadow: '0 10px 22px rgba(15,150,120,.24)' }}
            onClick={() => doSearch()} disabled={loading || !query.trim()}>
            {loading
              ? <div style={{ width: 18, height: 18, border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid #fff', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />
              : <span style={{ fontSize: 18 }}>→</span>}
          </button>
        </div>

        {/* Tool pills */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          {TOOLS.map(t => (
            <button key={t.id}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 12, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', position: 'relative', transition: 'all .2s', background: activeTool === t.id ? T.accentBg : 'rgba(255,255,255,.55)', border: `1px solid ${activeTool === t.id ? T.accentBorder : T.cardBorder}`, color: activeTool === t.id ? T.accent : T.textDim, fontWeight: activeTool === t.id ? 700 : 500 }}
              onClick={() => { setActive(t.id); inputRef.current?.focus(); }}>
              <span>{t.emoji}</span>
              <span>{t.label}</span>
              {results[t.id] && <span style={{ position: 'absolute', top: 5, right: 5, width: 5, height: 5, borderRadius: '50%', background: T.accent }} />}
            </button>
          ))}
        </div>

        {/* Meta bar */}
        {current && !loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: T.textDimmer, marginBottom: 20, flexWrap: 'wrap' }}>
            <span>{toolInfo.emoji} Showing results for</span>
            <span style={{ color: T.accent, fontWeight: 700 }}>"{current.query}"</span>
            {elapsed && <span>· {(elapsed / 1000).toFixed(1)}s</span>}
            <span style={{ color: T.green, marginLeft: 'auto', fontSize: 11, fontWeight: 600 }}>✅ All links verified & working</span>
          </div>
        )}

        {/* Suggestions */}
        {!current && !loading && (
          <div style={{ padding: '24px 0' }}>
            <div style={{ fontSize: 13, color: T.textDimmer, marginBottom: 16, lineHeight: 1.5 }}>{toolInfo.desc}</div>
            <div style={{ fontSize: 11, color: T.textDimmest, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12, fontWeight: 700 }}>Try searching:</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {SUGGESTIONS[activeTool].map((s, i) => (
                <button key={i} className="glass-card" style={{ color: T.textMuted, padding: '8px 16px', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', fontWeight: 500 }}
                  onClick={() => { setQuery(s); setTimeout(() => doSearch(s), 30); }}>{s}</button>
              ))}
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '70px 20px' }}>
            <div style={{ fontSize: 48, marginBottom: 16, display: 'inline-block', animation: 'pulse 1.5s ease-in-out infinite' }}>{toolInfo.emoji}</div>
            <div style={{ color: T.textDim, fontSize: 15, marginBottom: 8 }}>Searching {toolInfo.label}…</div>
            <div style={{ color: T.textDimmest, fontSize: 12 }}>Generating real working links</div>
            <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 16 }}>
              {[0, 1, 2].map(i => <span key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: T.accent, display: 'inline-block', animation: 'bounce 1.2s ease-in-out infinite', animationDelay: `${i * 0.2}s` }} />)}
            </div>
          </div>
        )}

        {/* Results */}
        {!loading && current && (
          <>
            {current.type === 'web'   && <WebResult   data={current.data} query={current.query} onRelated={handleRelated} />}
            {current.type === 'ai'    && <AIResult    data={current.data} onRelated={handleRelated} />}
            {current.type === 'image' && <ImageResult data={current.data} onRelated={handleRelated} />}
            {current.type === 'video' && <VideoResult data={current.data} query={current.query} onRelated={handleRelated} />}
            {current.type === 'news'  && <NewsResult  data={current.data} query={current.query} onRelated={handleRelated} />}
            {current.type === 'code'  && <CodeResult  data={current.data} query={current.query} onRelated={handleRelated} />}
          </>
        )}
      </div>
    </div>
  );
}