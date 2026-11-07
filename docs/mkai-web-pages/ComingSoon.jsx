import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';

// ── Theme Tokens — matches Home.jsx (emerald / mint / sky-blue / saffron, on white) ──
const T = {
  pageBg      : '#f6faf7',
  navBg       : 'rgba(246,250,247,0.92)',
  navBorder   : 'rgba(18,54,42,.10)',
  heroBg      : 'linear-gradient(175deg,#eaf5ee 0%,#f4faf6 100%)',
  footerBg    : '#e4f3ea',
  cardBg      : '#fffefb',
  cardBorder  : 'rgba(15,169,104,.18)',
  cardShadow  : '0 10px 34px rgba(15,90,70,.10)',
  iconBg      : 'rgba(255,255,255,.65)',
  iconBorder  : 'rgba(255,255,255,.85)',
  text        : '#122420',
  textMuted   : '#5c6b64',
  textSub     : '#8a958e',
  badgeBg     : 'rgba(15,169,104,.10)',
  badgeBorder : 'rgba(15,169,104,.28)',
  badgeColor  : '#0C8457',
  dotColor    : '#0FA968',
  outlineBg   : 'rgba(255,255,255,.55)',
  outlineText : '#233530',
  outlineBorder: 'rgba(18,54,42,.16)',
  blob1       : 'rgba(21,150,214,.16)',
  blob2       : 'rgba(242,169,59,.10)',
  blob3       : 'rgba(205,238,221,.5)',
  grid        : 'rgba(15,169,104,.05)',
  accentSolid : '#0FA968',
  accentGrad  : 'linear-gradient(135deg,#0FA968 0%,#1596D6 100%)',
  btnShadow   : '0 14px 30px rgba(15,150,120,.24)',
  btnShadowH  : '0 18px 38px rgba(15,150,120,.34)',
  scroll      : '#cdeedd',
};

const LOGO = '/whitelogo.webp';

export default function ComingSoon() {
  const navigate = useNavigate();
  const location = useLocation();
  const toolName = location.pathname.replace('/', '').replace(/-/g, ' ').toUpperCase();

  return (
    <div style={{ background: T.pageBg, minHeight: '100vh', color: T.text, fontFamily: "'Inter',ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif", overflowX: 'hidden' }}>

      <Helmet>
        <title>Coming Soon — MK AI</title>
        <meta name="description" content="This MK AI feature is coming soon. Explore our other 22+ AI tools in the meantime." />
      </Helmet>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;650;700;800;900&display=swap');
        *,*::before,*::after { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${T.scroll}; border-radius: 4px; }

        .grad-text {
          background: ${T.accentGrad};
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          display: inline;
        }

        .pb {
          border: none; cursor: pointer; border-radius: 14px;
          padding: 11px 22px; font-size: 13px; font-weight: 700;
          font-family: 'Inter', sans-serif;
          background: ${T.accentGrad}; color: #fff;
          box-shadow: ${T.btnShadow};
          transition: transform 0.2s, box-shadow 0.2s;
          white-space: nowrap;
        }
        .pb:hover { transform: translateY(-2px); box-shadow: ${T.btnShadowH}; }

        .ob {
          border-radius: 14px; padding: 11px 22px;
          font-size: 13px; font-weight: 600;
          font-family: 'Inter', sans-serif;
          cursor: pointer; white-space: nowrap;
          background: ${T.outlineBg}; color: ${T.outlineText};
          border: 1.5px solid ${T.outlineBorder};
          transition: transform 0.2s, border-color 0.2s, color 0.2s;
        }
        .ob:hover { transform: translateY(-2px); border-color: ${T.accentSolid}; color: ${T.accentSolid}; }

        .nb {
          background: none; border: none; font-size: 13px; font-weight: 500;
          font-family: 'Inter', sans-serif;
          padding: 7px 12px; border-radius: 8px;
          cursor: pointer; color: ${T.textMuted}; transition: color 0.2s;
        }
        .nb:hover { color: ${T.accentSolid}; }

        .bf { animation: bf 3.8s ease-in-out infinite; }
        @keyframes bf { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }

        .hi { animation: hi 0.65s cubic-bezier(.22,1,.36,1) both; }
        @keyframes hi { from { opacity:0; transform:translateY(26px); } to { opacity:1; transform:translateY(0); } }

        .nw { padding: 10px 52px; }

        @media(max-width:640px) {
          .nw { padding: 8px 14px !important; }
          .cs-title { font-size: 2.4rem !important; }
          .cs-hero { padding: 44px 16px 52px !important; }
          .hb { flex-direction: column !important; align-items: stretch !important; }
          .hb button { width: 100%; text-align: center; }
          .nl { display: none !important; }
          .pb { padding: 9px 16px !important; font-size: 12px !important; }
          .ob { padding: 9px 16px !important; font-size: 12px !important; }
          .nb { padding: 6px 10px !important; font-size: 12px !important; }
        }
      `}</style>

      {/* ══ NAVBAR ══ */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 100, background: T.navBg, backdropFilter: 'blur(20px)', borderBottom: `1px solid ${T.navBorder}` }}>
        <div className="nw" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: '1400px', margin: '0 auto' }}>
          <div onClick={() => navigate('/')} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', flexShrink: 0 }}>
            <img src={LOGO} alt="MK AI" style={{ height: '32px', width: 'auto', borderRadius: '50%', display: 'block' }} />
            <span style={{ fontSize: '17px', fontWeight: 800, color: T.accentSolid, letterSpacing: '-0.5px' }}>MK AI</span>
          </div>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <button className="nb nl" onClick={() => navigate('/chat')}>Chat</button>
            <button className="nb nl" onClick={() => navigate('/')}>Tools</button>
            <button className="pb" onClick={() => navigate('/chat')}>Get Started →</button>
          </div>
        </div>
      </nav>

      {/* ══ HERO ══ */}
      <section style={{ position: 'relative', overflow: 'hidden', background: T.heroBg, minHeight: 'calc(100vh - 57px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>

        {/* Blobs */}
        <div style={{ position: 'absolute', width: '500px', height: '500px', borderRadius: '50%', top: '-150px', left: '-180px', background: T.blob1, filter: 'blur(100px)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', width: '380px', height: '380px', borderRadius: '50%', bottom: '-80px', right: '-100px', background: T.blob2, filter: 'blur(85px)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', width: '280px', height: '280px', borderRadius: '50%', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: T.blob3, filter: 'blur(70px)', pointerEvents: 'none' }} />

        {/* Grid */}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', backgroundImage: `linear-gradient(${T.grid} 1px,transparent 1px),linear-gradient(90deg,${T.grid} 1px,transparent 1px)`, backgroundSize: '56px 56px' }} />

        <div className="hi cs-hero" style={{ position: 'relative', zIndex: 1, textAlign: 'center', padding: '80px 52px', maxWidth: '680px', margin: '0 auto' }}>

          {/* Floating Icon */}
          <div className="bf" style={{ fontSize: '68px', marginBottom: '28px', display: 'block' }}>🚀</div>

          {/* Badge */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: T.badgeBg, border: `1px solid ${T.badgeBorder}`, color: T.badgeColor, padding: '6px 18px', borderRadius: '100px', fontSize: '11px', fontWeight: 700, marginBottom: '24px', letterSpacing: '0.7px' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: T.dotColor, boxShadow: `0 0 7px ${T.dotColor}`, display: 'inline-block', flexShrink: 0 }} />
            COMING SOON
          </div>

          {/* Tool Name */}
          <h1 className="cs-title" style={{ fontSize: '3.2rem', fontWeight: 800, letterSpacing: '-1.5px', lineHeight: 1.1, marginBottom: '16px' }}>
            <span className="grad-text">{toolName}</span>
          </h1>

          <p style={{ fontSize: '16px', color: T.textMuted, lineHeight: 1.8, maxWidth: '440px', margin: '0 auto 12px' }}>
            This tool is currently under development and will be live soon. Stay tuned!
          </p>

          <p style={{ fontSize: '13px', color: T.textSub, marginBottom: '36px' }}>
            In the meantime, check out our other tools or jump into AI Chat.
          </p>

          <div className="hb" style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="pb" onClick={() => navigate('/')}>← Back to Tools</button>
            <button className="ob" onClick={() => navigate('/chat')}>Try AI Chat 💬</button>
          </div>
        </div>
      </section>

      {/* ══ FOOTER ══ */}
      <footer style={{ background: T.footerBg, borderTop: `1px solid ${T.navBorder}` }}>
        <div style={{ textAlign: 'center', padding: '40px', maxWidth: '700px', margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}>
            <img src={LOGO} alt="MK AI" style={{ height: '34px', width: 'auto', borderRadius: '50%', display: 'block' }} />
          </div>
          <div style={{ fontSize: '15px', fontWeight: 800, color: T.accentSolid, marginBottom: '10px', letterSpacing: '-0.3px' }}>MK AI</div>
          <p style={{ color: T.textSub, fontSize: '12px', marginBottom: '6px' }}>
            Developed by <span style={{ fontWeight: 700, color: T.accentSolid }}>MK AI</span> &nbsp;·&nbsp; © 2026
          </p>
          <p style={{ color: T.textSub, fontSize: '12px' }}>support.mkai@gmail.com</p>
        </div>
      </footer>

    </div>
  );
}