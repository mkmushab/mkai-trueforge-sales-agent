import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';

/* ─── inject spinner + slide-up keyframes + font once ─── */
if (typeof document !== 'undefined' && !document.getElementById('__img-spin')) {
  const st = document.createElement('style');
  st.id = '__img-spin';
  st.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;650;700;800&display=swap');
    @keyframes __spin { to { transform: rotate(360deg); } }
    @keyframes __slideUp { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
    @keyframes __fadeIn { from { opacity: 0; } to { opacity: 1; } }
  `;
  document.head.appendChild(st);
}

const STYLES = [
  { id: 'realistic',    label: 'Realistic',   emoji: '📸', model: 'flux-realism' },
  { id: 'anime',        label: 'Anime',        emoji: '🎌', model: 'flux-anime'   },
  { id: 'digital_art',  label: 'Digital Art',  emoji: '🎨', model: 'flux'         },
  { id: '3d_render',    label: '3D Render',    emoji: '🌐', model: 'flux-3d'      },
  { id: 'cyberpunk',    label: 'Cyberpunk',    emoji: '🌆', model: 'any-dark'     },
  { id: 'oil_painting', label: 'Oil Painting', emoji: '🖼️', model: 'flux'         },
  { id: 'watercolor',   label: 'Watercolor',   emoji: '💧', model: 'flux'         },
  { id: 'cartoon',      label: 'Cartoon',      emoji: '🎭', model: 'flux'         },
  { id: 'sketch',       label: 'Sketch',       emoji: '✏️', model: 'flux'         },
  { id: 'fast',         label: 'Fast',         emoji: '⚡', model: 'turbo'        },
];

// ─── GENERAL COMPUTE API (used for prompt enhancement only) ──────────────────
const GC_API_KEY  = "YOUR_API_KEY_PLACEHOLDER";
const GC_BASE_URL = "https://api.generalcompute.com";
const GC_MODEL    = "gpt-oss-120b";

async function enhancePromptAI(raw, styleLabel) {
  const res = await fetch(`${GC_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GC_API_KEY}`,
    },
    body: JSON.stringify({
      model: GC_MODEL,
      max_tokens: 220,
      temperature: 0.7,
      messages: [
        { role: 'system', content: 'You are an expert image prompt engineer. Return ONLY the enhanced prompt — no explanation, no quotes, nothing else.' },
        { role: 'user', content: `Enhance this prompt for a ${styleLabel} style image: "${raw}". Add lighting, mood, composition, and quality details. Keep it under 120 words.` },
      ],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || 'Prompt enhancement failed');
  return data.choices?.[0]?.message?.content?.trim() || raw;
}

/* ─────────────────── Image generation with retry + preload ─────────────────── */
// Preloads an image URL in-memory and only resolves once it has actually
// loaded successfully — this is what lets us silently retry on failure
// instead of showing the user a broken image.
function preloadImage(url, timeoutMs = 25000) {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error('timeout'));
    }, timeoutMs);
    img.onload = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(url);
    };
    img.onerror = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new Error('load error'));
    };
    img.src = url;
  });
}

function buildImageUrl(prompt, model) {
  const enc  = encodeURIComponent(prompt);
  const seed = Math.floor(Math.random() * 999999);
  return `https://image.pollinations.ai/prompt/${enc}?width=1024&height=1024&model=${model}&seed=${seed}&nologo=true`;
}

// Tries the requested style's model first, then falls back through a couple
// of reliable general-purpose models. Each model gets up to 2 attempts
// (different random seed each time) before moving on. Only returns once an
// image has actually finished loading.
async function generateImageWithFallback(prompt, primaryModel, onAttempt) {
  const candidates = [primaryModel, 'flux', 'turbo'].filter((m, i, arr) => arr.indexOf(m) === i);
  let lastErr = null;

  for (const model of candidates) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const url = buildImageUrl(prompt, model);
      onAttempt?.(model, attempt);
      try {
        return await preloadImage(url);
      } catch (err) {
        lastErr = err;
      }
    }
  }
  throw lastErr || new Error('All generation attempts failed');
}

/* ─────────────────── ImageCard ─────────────────── */
function ImageCard({ url, onDownload, T }) {
  const [status, setStatus] = useState('loading');

  return (
    <div style={{
      borderRadius: 16, overflow: 'hidden',
      border: `1px solid ${T.border}`, background: T.srf,
      display: 'flex', flexDirection: 'column',
      boxShadow: T.cardShadow,
      animation: '__fadeIn 0.4s ease',
    }}>
      {status === 'loading' && (
        <div style={{
          minHeight: 280, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 12,
          background: T.skeletonBg,
        }}>
          <div style={{
            width: 28, height: 28,
            border: `2.5px solid ${T.border}`,
            borderTop: `2.5px solid ${T.accent}`,
            borderRadius: '50%', animation: '__spin 0.7s linear infinite',
          }} />
          <span style={{ fontSize: 13, color: T.muted }}>Loading image…</span>
        </div>
      )}

      <img
        src={url} alt="Generated"
        style={{
          width: '100%', objectFit: 'cover',
          display: status === 'ok' ? 'block' : 'none',
          borderRadius: '16px 16px 0 0',
        }}
        onLoad={() => setStatus('ok')}
        onError={() => setStatus('error')}
      />

      {status === 'error' && (
        <div style={{
          minHeight: 280, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 12, background: T.skeletonBg,
        }}>
          <span style={{ fontSize: 32 }}>⚠️</span>
          <span style={{ fontSize: 13, color: T.muted }}>Failed to display — try opening directly</span>
          <a href={url} target="_blank" rel="noreferrer"
            style={{ fontSize: 12, color: T.accent, textDecoration: 'none', marginTop: 4 }}>
            Open directly ↗
          </a>
        </div>
      )}

      {status !== 'loading' && (
        <div style={{
          display: 'flex', gap: 8, padding: '12px 14px',
          borderTop: `1px solid ${T.border}`,
        }}>
          <button style={{
            flex: 1, padding: '12px 0', borderRadius: 10, border: 'none',
            background: T.accentGrad, color: '#fff', fontSize: 15, fontWeight: 650,
            cursor: 'pointer', fontFamily: 'inherit', boxShadow: T.btnShadow,
          }} onClick={() => onDownload(url)}>↓ Download</button>
          <a href={url} target="_blank" rel="noreferrer" style={{
            flex: 1, padding: '12px 0', borderRadius: 10,
            border: `1px solid ${T.border}`, background: T.srf, color: T.muted,
            fontSize: 15, textDecoration: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>↗ Open</a>
        </div>
      )}
    </div>
  );
}

/* ─────────────────── Main component ─────────────────── */
export default function Image() {
  const navigate = useNavigate();

  // ── Single theme — same palette & language as Home.jsx (emerald / sky / gold, on cream) ──
  const T = {
    pageBg: '#f6faf7', navBg: 'rgba(228,243,234,.84)', navBorder: 'rgba(18,54,42,.10)',
    sidebarBg: 'rgba(228,243,234,.35)', previewBg: '#eef8f2',
    srf: '#fffefb', border: 'rgba(18,54,42,.10)',
    muted: '#5c6b64', text: '#122420', subText: 'rgba(18,54,42,.68)',
    accent: '#0FA968', accentGrad: 'linear-gradient(135deg,#0FA968,#1596D6)',
    accentBg: 'rgba(15,169,104,.12)', accentBorder: 'rgba(15,169,104,.45)',
    accentPill: 'rgba(15,169,104,.08)', accentPillBorder: 'rgba(15,169,104,.22)',
    accentBadge: 'rgba(15,169,104,.18)', accentBadgeText: '#0C8457',
    inputBg: '#fffefb',
    errorBg: 'rgba(220,38,38,.08)', errorBorder: 'rgba(220,38,38,.25)', errorText: '#DC2626',
    skeletonBg: 'rgba(15,169,104,.05)',
    backBtnColor: '#5c6b64',
    sheetBg: '#fffefb',
    overlayBg: 'rgba(18,54,42,.35)',
    cardShadow: '0 12px 34px rgba(15,90,70,.10)',
    btnShadow: '0 10px 22px rgba(15,150,120,.24)',
  };

  // detect mobile
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // mobile sheet open state
  const [sheetOpen, setSheetOpen] = useState(false);

  const [prompt,      setPrompt]      = useState('');
  const [style,       setStyle]       = useState('realistic');
  const [step,        setStep]        = useState('idle'); // idle | enhancing | generating | done | error
  const [enhanced,    setEnhanced]    = useState('');
  const [imageUrl,    setImageUrl]    = useState(null);
  const [retryLabel,  setRetryLabel]  = useState('');

  const isRunning = step === 'enhancing' || step === 'generating';

  const downloadImage = useCallback(async (url) => {
    try {
      const res  = await fetch(url);
      const blob = await res.blob();
      const a    = document.createElement('a');
      a.href     = URL.createObjectURL(blob);
      a.download = `ai-image.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
    } catch { window.open(url, '_blank'); }
  }, []);

  const generate = async () => {
    if (!prompt.trim() || isRunning) return;
    setSheetOpen(false);
    setImageUrl(null); setEnhanced(''); setRetryLabel('');

    const st    = STYLES.find(s => s.id === style);
    const model = st?.model || 'flux';

    // 1. Enhance the prompt — if this fails for any reason, just fall back
    //    to the raw prompt instead of blocking the whole generation.
    let finalPrompt = prompt.trim();
    try {
      setStep('enhancing');
      finalPrompt = await enhancePromptAI(finalPrompt, st?.label || style);
      setEnhanced(finalPrompt);
    } catch (err) {
      console.warn('Prompt enhancement failed, using raw prompt:', err);
      setEnhanced('');
    }

    // 2. Generate the image — tries the chosen style's model first, then
    //    automatically falls back through other models/seeds until one
    //    actually loads, so the user rarely sees a failure at all.
    try {
      setStep('generating');
      const url = await generateImageWithFallback(finalPrompt, model, (m, attempt) => {
        if (m !== model || attempt > 0) {
          setRetryLabel(`Trying a different model…`);
        }
      });
      setImageUrl(url);
      setStep('done');
    } catch (err) {
      console.error(err);
      setStep('error');
    }
  };

  const currentStyle = STYLES.find(s => s.id === style);

  /* ═══════════════════════════════════════
     SIDEBAR / SHEET CONTENT (shared)
  ═══════════════════════════════════════ */
  const SidebarContent = () => (
    <>
      {/* Prompt */}
      <div style={{ marginBottom: 20 }}>
        <label style={{
          display: 'block', fontSize: 11, fontWeight: 700, color: T.muted,
          textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 8,
        }}>Describe your image</label>
        <textarea
          style={{
            width: '100%', background: T.inputBg, border: `1px solid ${T.border}`,
            borderRadius: 10, padding: '11px 13px', color: T.text,
            fontSize: 15, lineHeight: 1.6, resize: 'none',
            fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
            transition: 'border-color 0.2s, box-shadow 0.2s',
          }}
          rows={4}
          placeholder="A misty mountain lake at sunrise, golden light…"
          value={prompt}
          onChange={e => setPrompt(e.target.value.slice(0, 500))}
          disabled={isRunning}
        />
        <div style={{ fontSize: 11, color: T.muted, textAlign: 'right', marginTop: 4 }}>
          {prompt.length} / 500
        </div>
      </div>

      {/* Style picker */}
      <div style={{ marginBottom: 24 }}>
        <label style={{
          display: 'block', fontSize: 11, fontWeight: 700, color: T.muted,
          textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 8,
        }}>Style</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 6 }}>
          {STYLES.map(st => (
            <button key={st.id} disabled={isRunning} onClick={() => setStyle(st.id)} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 12px', borderRadius: 10, fontFamily: 'inherit',
              border: style === st.id ? `1px solid ${T.accentBorder}` : `1px solid ${T.border}`,
              background: style === st.id ? T.accentBg : T.srf,
              color: style === st.id ? T.text : T.muted,
              opacity: isRunning ? 0.5 : 1, cursor: isRunning ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s', textAlign: 'left',
            }}>
              <span style={{ fontSize: 18, lineHeight: 1, flexShrink: 0 }}>{st.emoji}</span>
              <span style={{ fontSize: 13, fontWeight: 500 }}>{st.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Generate button */}
      <button onClick={generate} disabled={!prompt.trim() || isRunning} style={{
        width: '100%', background: T.accentGrad, color: '#fff',
        border: 'none', padding: '15px 0', borderRadius: 12,
        fontSize: 16, fontWeight: 700, fontFamily: 'inherit',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        cursor: !prompt.trim() || isRunning ? 'not-allowed' : 'pointer',
        opacity: !prompt.trim() || isRunning ? 0.5 : 1,
        boxShadow: !prompt.trim() || isRunning ? 'none' : T.btnShadow,
        transition: 'opacity 0.2s, box-shadow 0.2s',
      }}>
        {isRunning ? (
          <>
            <span style={{
              width: 16, height: 16, border: '2px solid rgba(255,255,255,0.4)',
              borderTop: '2px solid #fff', borderRadius: '50%',
              animation: '__spin 0.7s linear infinite', flexShrink: 0,
            }} />
            {step === 'enhancing' ? 'Enhancing…' : 'Generating…'}
          </>
        ) : step === 'done' ? '↺ Generate again' : '✨ Generate'}
      </button>

      {step === 'error' && (
        <div style={{
          marginTop: 12, padding: '10px 14px',
          background: T.errorBg, border: `1px solid ${T.errorBorder}`,
          borderRadius: 8, fontSize: 13, color: T.errorText,
        }}>⚠ Could not generate an image right now. Please try again.</div>
      )}
    </>
  );

  /* ═══════════════════════════════════════
     PREVIEW AREA (shared)
  ═══════════════════════════════════════ */
  const PreviewArea = () => (
    <>
      {step === 'idle' && (
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 32,
        }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>🎨</div>
          <p style={{ fontSize: 17, fontWeight: 600, marginBottom: 8, color: T.text }}>Your image will appear here</p>
          <p style={{ fontSize: 14, color: T.muted, maxWidth: 240 }}>
            {isMobile ? 'Tap "Customize" below to get started' : 'Fill in the details on the left and hit Generate'}
          </p>
        </div>
      )}

      {isRunning && (
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 32,
        }}>
          <div style={{
            width: 44, height: 44, border: `3px solid ${T.border}`,
            borderTop: `3px solid ${T.accent}`, borderRadius: '50%',
            animation: '__spin 0.7s linear infinite', marginBottom: 20,
          }} />
          <p style={{ fontSize: 17, fontWeight: 500, marginBottom: 6, color: T.text }}>
            {step === 'enhancing' ? 'Crafting the perfect prompt…' : 'Painting your vision…'}
          </p>
          <p style={{ fontSize: 14, color: T.muted }}>
            {step === 'generating' && retryLabel ? retryLabel : 'This takes 20–40 seconds'}
          </p>
        </div>
      )}

      {step === 'error' && (
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 32,
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <p style={{ fontSize: 17, fontWeight: 600, marginBottom: 8, color: T.text }}>Couldn't generate that image</p>
          <p style={{ fontSize: 14, color: T.muted, maxWidth: 280, marginBottom: 20 }}>
            All attempts failed to load. This is usually temporary — try again in a moment.
          </p>
          <button onClick={generate} style={{
            background: T.accentGrad, color: '#fff', border: 'none',
            padding: '11px 24px', borderRadius: 10, fontSize: 14, fontWeight: 700,
            cursor: 'pointer', fontFamily: 'inherit', boxShadow: T.btnShadow,
          }}>↺ Try Again</button>
        </div>
      )}

      {step === 'done' && imageUrl && (
        <div style={{ flex: 1, padding: isMobile ? '16px 16px 100px' : 20, overflowY: 'auto' }}>
          {enhanced && (
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: 8,
              background: T.accentPill, border: `1px solid ${T.accentPillBorder}`,
              borderRadius: 10, padding: '10px 14px', fontSize: 13,
              color: T.subText, marginBottom: 14, lineHeight: 1.6,
            }}>
              <span style={{
                flexShrink: 0, fontSize: 11, fontWeight: 700,
                padding: '2px 8px', borderRadius: 20,
                background: T.accentBadge, color: T.accentBadgeText, marginTop: 1,
              }}>Enhanced</span>
              {enhanced}
            </div>
          )}
          <ImageCard key={imageUrl} url={imageUrl} onDownload={downloadImage} T={T} />
        </div>
      )}
    </>
  );

  /* ═══════════════════════════════════════
     RENDER — MOBILE
  ═══════════════════════════════════════ */
  if (isMobile) {
    return (
      <div style={{
        minHeight: '100vh', backgroundColor: T.pageBg, color: T.text,
        display: 'flex', flexDirection: 'column',
        fontFamily: "'Inter', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
      }}>

        {/* Mobile Header */}
        <header style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px', borderBottom: `1px solid ${T.navBorder}`,
          backgroundColor: T.navBg, backdropFilter: 'blur(16px)',
          position: 'sticky', top: 0, zIndex: 100,
        }}>
          <button onClick={() => navigate('/')} style={{
            background: 'none', border: `1px solid ${T.border}`,
            color: T.backBtnColor, padding: '7px 14px', borderRadius: 8,
            cursor: 'pointer', fontSize: 13, fontFamily: 'inherit',
          }}>← Back</button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 18 }}>✨</span>
            <span style={{ fontSize: 16, fontWeight: 700, color: T.accentBadgeText }}>Image Generator</span>
          </div>

          <span style={{ width: 62 }} />
        </header>

        {/* Preview */}
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          backgroundColor: T.previewBg, overflowY: 'auto',
        }}>
          {/* Status bar */}
          <div style={{
            padding: '10px 16px', borderBottom: `1px solid ${T.navBorder}`,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span style={{ fontSize: 13, color: T.muted }}>
              {step === 'idle'       && 'Preview'}
              {step === 'enhancing'  && 'Enhancing your prompt…'}
              {step === 'generating' && 'Generating image…'}
              {step === 'done'       && 'Image ready ✓'}
              {step === 'error'      && 'Something went wrong'}
            </span>
            {step === 'done' && (
              <span style={{
                fontSize: 12, padding: '3px 10px', borderRadius: 20,
                background: T.accentBg, border: `1px solid ${T.accentBorder}`,
                color: T.accentBadgeText,
              }}>{currentStyle?.emoji} {currentStyle?.label}</span>
            )}
          </div>

          {PreviewArea()}
        </div>

        {/* ── Bottom Action Bar ── */}
        {(step === 'idle' || step === 'done' || step === 'error') && (
          <div style={{
            position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 90,
            padding: '12px 16px 20px',
            background: T.navBg,
            borderTop: `1px solid ${T.navBorder}`,
            backdropFilter: 'blur(20px)',
            display: 'flex', gap: 10,
          }}>
            <button onClick={() => setSheetOpen(true)} style={{
              flex: 1, padding: '14px 0', borderRadius: 12, fontFamily: 'inherit',
              background: T.srf, border: `1px solid ${T.border}`,
              color: T.text, fontSize: 15, fontWeight: 600, cursor: 'pointer',
            }}>🎛 Customize</button>
            <button onClick={generate} disabled={!prompt.trim()} style={{
              flex: 2, padding: '14px 0', borderRadius: 12, fontFamily: 'inherit',
              background: T.accentGrad, border: 'none',
              color: '#fff', fontSize: 15, fontWeight: 700, cursor: !prompt.trim() ? 'not-allowed' : 'pointer',
              opacity: !prompt.trim() ? 0.5 : 1,
              boxShadow: !prompt.trim() ? 'none' : T.btnShadow,
            }}>{step === 'done' || step === 'error' ? '↺ Generate Again' : '✨ Generate'}</button>
          </div>
        )}

        {/* Running state bottom bar */}
        {isRunning && (
          <div style={{
            position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 90,
            padding: '14px 16px 20px',
            background: T.navBg, borderTop: `1px solid ${T.navBorder}`,
            backdropFilter: 'blur(20px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          }}>
            <div style={{
              width: 16, height: 16, border: `2px solid ${T.border}`,
              borderTop: `2px solid ${T.accent}`, borderRadius: '50%',
              animation: '__spin 0.7s linear infinite',
            }} />
            <span style={{ fontSize: 14, color: T.muted }}>
              {step === 'enhancing' ? 'Enhancing prompt…' : 'Generating your image…'}
            </span>
          </div>
        )}

        {/* ── Bottom Sheet ── */}
        {sheetOpen && (
          <>
            {/* Overlay */}
            <div onClick={() => setSheetOpen(false)} style={{
              position: 'fixed', inset: 0, zIndex: 200,
              background: T.overlayBg, backdropFilter: 'blur(2px)',
            }} />

            {/* Sheet */}
            <div style={{
              position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 201,
              background: T.sheetBg,
              borderRadius: '20px 20px 0 0',
              border: `1px solid ${T.border}`,
              borderBottom: 'none',
              padding: '0 16px 32px',
              maxHeight: '85vh',
              overflowY: 'auto',
              animation: '__slideUp 0.3s cubic-bezier(0.32, 0.72, 0, 1)',
            }}>
              {/* Drag handle */}
              <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 18px' }}>
                <div style={{
                  width: 36, height: 4, borderRadius: 2,
                  background: T.border,
                }} />
              </div>

              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginBottom: 20,
              }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: T.text }}>Customize</span>
                <button onClick={() => setSheetOpen(false)} style={{
                  background: T.srf, border: `1px solid ${T.border}`,
                  color: T.muted, borderRadius: 8, padding: '6px 12px',
                  cursor: 'pointer', fontSize: 13, fontFamily: 'inherit',
                }}>Done</button>
              </div>

              {SidebarContent()}
            </div>
          </>
        )}
      </div>
    );
  }

  /* ═══════════════════════════════════════
     RENDER — DESKTOP (original layout)
  ═══════════════════════════════════════ */
  return (
    <div style={{
      minHeight: '100vh', backgroundColor: T.pageBg, color: T.text,
      display: 'flex', flexDirection: 'column',
      fontFamily: "'Inter', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
    }}>

      <Helmet>
        <title>AI Image Generator — MK AI</title>
        <meta name="description" content="Generate stunning, multi-style AI images from text prompts, free on MK AI." />
      </Helmet>

      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 32px', borderBottom: `1px solid ${T.navBorder}`,
        backgroundColor: T.navBg, backdropFilter: 'blur(16px)',
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        <button onClick={() => navigate('/')} style={{
          background: 'none', border: `1px solid ${T.border}`,
          color: T.backBtnColor, padding: '7px 16px', borderRadius: 8,
          cursor: 'pointer', fontSize: 13, fontFamily: 'inherit',
        }}>← Back</button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 20 }}>✨</span>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: T.accentBadgeText, margin: 0, display: 'inline-block' }}>Image Generator</h1>
        </div>

        <span style={{ width: 78 }} />
      </header>

      <div style={{
        display: 'grid', gridTemplateColumns: '320px 1fr',
        flex: 1, minHeight: 'calc(100vh - 57px)',
      }}>

        <aside style={{
          borderRight: `1px solid ${T.navBorder}`, padding: '24px 20px',
          display: 'flex', flexDirection: 'column', overflowY: 'auto',
          backgroundColor: T.sidebarBg,
        }}>
          {SidebarContent()}
        </aside>

        <main style={{
          display: 'flex', flexDirection: 'column',
          backgroundColor: T.previewBg, overflow: 'hidden',
        }}>
          <div style={{
            padding: '14px 24px', borderBottom: `1px solid ${T.navBorder}`,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            minHeight: 52, flexShrink: 0,
          }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: T.muted }}>
              {step === 'idle'       && 'Preview'}
              {step === 'enhancing'  && 'Enhancing your prompt…'}
              {step === 'generating' && 'Generating image…'}
              {step === 'done'       && 'Image ready'}
              {step === 'error'      && 'Something went wrong'}
            </span>
            {step === 'done' && (
              <span style={{
                fontSize: 12, padding: '3px 10px', borderRadius: 20,
                background: T.accentBg, border: `1px solid ${T.accentBorder}`,
                color: T.accentBadgeText,
              }}>{currentStyle?.emoji} {currentStyle?.label}</span>
            )}
          </div>
          {PreviewArea()}
        </main>
      </div>
    </div>
  );
}