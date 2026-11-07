import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';

export default function Privacy() {
  const navigate = useNavigate();

  // ─── Single fixed theme — matched to Home.jsx (emerald / sky / gold on white) ───
  const T = {
    pageBg: '#f6faf7',
    navBg: 'rgba(246,250,247,0.9)',
    navBorder: 'rgba(18,54,42,0.10)',
    heroBg: 'linear-gradient(175deg,#f6faf7 0%,#eaf5ee 100%)',
    sectionBg: '#eef8f2',
    footerBg: '#e4f3ea',
    cardBg: '#fffefb',
    cardBorderH: '#0FA968',
    cardBorder: 'rgba(18,54,42,0.10)',
    cardShadow: '0 2px 20px rgba(15,90,70,0.08)',
    iconBg: 'rgba(15,169,104,0.09)',
    iconBorder: 'rgba(15,169,104,0.20)',
    text: '#122420',
    textMuted: '#5c6b64',
    textSub: 'rgba(18,36,32,0.42)',
    badgeBg: 'rgba(15,169,104,0.09)',
    badgeBorder: 'rgba(15,169,104,0.24)',
    badgeColor: '#0C8457',
    dotColor: '#0FA968',
    outlineBg: 'rgba(18,54,42,0.04)',
    outlineText: 'rgba(18,54,42,0.65)',
    outlineBorder: 'rgba(18,54,42,0.14)',
    blob1: 'rgba(15,169,104,0.10)',
    blob2: 'rgba(21,150,214,0.08)',
    blob3: 'rgba(242,169,59,0.08)',
    grid: 'rgba(15,169,104,0.05)',
    logoGlow: 'drop-shadow(0 0 20px rgba(15,169,104,0.35))',
    accentSolid: '#0FA968',
    accentGrad: 'linear-gradient(135deg,#0FA968 0%,#1596D6 100%)',
    btnShadow: '0 14px 30px rgba(15,150,120,.24)',
    btnShadowH: '0 18px 36px rgba(15,150,120,.34)',
    scroll: 'rgba(15,169,104,0.2)',
    divider: 'rgba(18,54,42,0.08)',
    sectionNumBg: 'rgba(15,169,104,0.08)',
    sectionNumBorder: 'rgba(15,169,104,0.22)',
    highlightBg: 'rgba(15,169,104,0.06)',
    highlightBorder: 'rgba(15,169,104,0.18)',
    bulletColor: '#0FA968',
    emailBg: 'rgba(15,169,104,0.07)',
    emailBorder: 'rgba(15,169,104,0.22)',
  };

  const logo = '/whitelogo.webp';

  const sections = [
    {
      num: '01',
      icon: '🛡️',
      title: 'Introduction',
      content: (
        <>
          <p style={{ color: T.textMuted, lineHeight: '1.85', fontSize: '15px', marginBottom: '14px' }}>
            Welcome to <strong style={{ color: T.text }}>MK AI</strong>. We understand that your privacy is paramount. This policy outlines how we handle information across our suite of <strong style={{ color: T.accentSolid }}>14+ AI tools</strong>. Our core philosophy is built on automation and user empowerment, ensuring a "Zero-Footprint" experience.
          </p>
          <p style={{ color: T.textMuted, lineHeight: '1.85', fontSize: '15px' }}>
            By using MK AI, you agree to the practices described in this document. We've written this in plain language so you always know exactly what happens with your data.
          </p>
        </>
      ),
    },
    {
      num: '02',
      icon: '🚫',
      title: "Information We Don't Collect",
      content: (
        <>
          <p style={{ color: T.textMuted, lineHeight: '1.85', fontSize: '15px', marginBottom: '18px' }}>
            Unlike traditional platforms, <strong style={{ color: T.text }}>MK AI does not store your personal conversations, uploaded files, or generated content.</strong> Our system processes your requests in real-time — once your session ends, all temporary data is purged.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[
              'No permanent storage of chat logs or conversation history.',
              'No tracking of individual user identities for data mining.',
              'No selling or sharing of your inputs with third parties.',
              'Automated processing with no manual human intervention.',
            ].map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '12px 16px', background: T.highlightBg, border: `1px solid ${T.highlightBorder}`, borderRadius: '10px' }}>
                <span style={{ color: T.accentSolid, fontSize: '16px', flexShrink: 0, marginTop: '1px' }}>✓</span>
                <span style={{ color: T.textMuted, fontSize: '14px', lineHeight: '1.6' }}>{item}</span>
              </div>
            ))}
          </div>
        </>
      ),
    },
    {
      num: '03',
      icon: '⚙️',
      title: 'How We Use Your Data',
      content: (
        <>
          <p style={{ color: T.textMuted, lineHeight: '1.85', fontSize: '15px', marginBottom: '14px' }}>
            Any data you input into our tools — such as text for <strong style={{ color: T.text }}>Resume Maker</strong>, prompts for <strong style={{ color: T.text }}>Image Generation</strong>, or documents for <strong style={{ color: T.text }}>Work Flow</strong> — is used strictly to provide the specific output you requested.
          </p>
          <p style={{ color: T.textMuted, lineHeight: '1.85', fontSize: '15px' }}>
            We utilize secure APIs including <strong style={{ color: T.text }}>Together AI</strong>, <strong style={{ color: T.text }}>Google Gemini</strong>, and <strong style={{ color: T.text }}>Groq</strong> to ensure fast and accurate results. Your data passes through these services only to generate your requested output and is not retained by us afterward.
          </p>
        </>
      ),
    },
    {
      num: '04',
      icon: '🔒',
      title: 'Security Measures',
      content: (
        <>
          <p style={{ color: T.textMuted, lineHeight: '1.85', fontSize: '15px', marginBottom: '14px' }}>
            We implement industry-standard encryption to protect your data during transit. All API calls are made over HTTPS, and no sensitive user data is logged or stored on our servers beyond the lifecycle of a single request.
          </p>
          <p style={{ color: T.textMuted, lineHeight: '1.85', fontSize: '15px' }}>
            For the best and most secure experience, we recommend using an up-to-date Chrome browser while using MK AI. Your browser's built-in protections work alongside ours.
          </p>
        </>
      ),
    },
    {
      num: '05',
      icon: '📬',
      title: 'Contact Us',
      content: (
        <>
          <p style={{ color: T.textMuted, lineHeight: '1.85', fontSize: '15px', marginBottom: '20px' }}>
            If you have any questions regarding this policy or how your data is handled, feel free to reach out to our team. We aim to respond within 48 hours.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '18px 22px', background: T.emailBg, border: `1px solid ${T.emailBorder}`, borderRadius: '12px' }}>
            <span style={{ fontSize: '22px' }}>✉️</span>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: T.textSub, letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: '4px' }}>Support Email</div>
              <a href="mailto:support.mkai@gmail.com" style={{ color: T.accentSolid, fontSize: '15px', fontWeight: 600, textDecoration: 'none' }}>
                support.mkai@gmail.com
              </a>
            </div>
          </div>
        </>
      ),
    },
  ];

  return (
    <div style={{ background: T.pageBg, minHeight: '100vh', color: T.text, fontFamily: "'Inter',ui-sans-serif,system-ui,sans-serif", overflowX: 'hidden' }}>

      <Helmet>
        <title>Privacy Policy — MK AI</title>
        <meta name="description" content="Read MK AI's privacy policy to understand how we handle your data, in plain language." />
      </Helmet>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;650;700;800&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
        ::-webkit-scrollbar{width:4px;}
        ::-webkit-scrollbar-track{background:transparent;}
        ::-webkit-scrollbar-thumb{background:${T.scroll};border-radius:4px;}

        .grad-text{
          background:${T.accentGrad};
          -webkit-background-clip:text;
          -webkit-text-fill-color:transparent;
          background-clip:text;
          display:inline;
        }

        .pb{
          border:none;cursor:pointer;border-radius:12px;
          padding:11px 22px;font-size:13px;font-weight:700;
          font-family:'Inter',sans-serif;
          background:${T.accentGrad};color:#fff;
          box-shadow:${T.btnShadow};
          transition:transform 0.2s,box-shadow 0.2s;
          white-space:nowrap;
        }
        .pb:hover{transform:translateY(-2px);box-shadow:${T.btnShadowH};}

        .nb{
          background:none;border:none;font-size:13px;font-weight:500;
          font-family:'Inter',sans-serif;
          padding:7px 12px;border-radius:8px;
          cursor:pointer;color:${T.textMuted};transition:color 0.2s;
        }
        .nb:hover{color:${T.accentSolid};}

        .sec-card{transition:transform 0.22s cubic-bezier(.22,1,.36,1),box-shadow 0.22s,border-color 0.22s;}
        .sec-card:hover{transform:translateY(-3px);}

        .hi{animation:hi 0.65s cubic-bezier(.22,1,.36,1) both;}
        @keyframes hi{from{opacity:0;transform:translateY(26px)}to{opacity:1;transform:translateY(0)}}

        .bf{animation:bf 3.8s ease-in-out infinite;}
        @keyframes bf{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}

        .nw{padding:10px 52px;}

        @media(max-width:640px){
          .nw{padding:8px 14px!important;}
          .hw{padding:44px 16px 52px!important;}
          .pw{padding:32px 14px 60px!important;}
          .fw{padding:30px 18px!important;}
          .nl{display:none!important;}
          .mk-title{font-size:40px!important;letter-spacing:-2px!important;}
          .sec-num{display:none!important;}
          .pb{padding:9px 16px!important;font-size:12px!important;}
          .nb{padding:6px 10px!important;font-size:12px!important;}
        }
      `}</style>

      {/* ══ NAVBAR ══ */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 100, background: T.navBg, backdropFilter: 'blur(20px)', borderBottom: `1px solid ${T.navBorder}` }}>
        <div className="nw" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: '1400px', margin: '0 auto' }}>
          <div onClick={() => navigate('/')} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', flexShrink: 0 }}>
            <img src={logo} alt="MK AI" style={{ height: '32px', width: 'auto', filter: T.logoGlow, display: 'block' }} />
            <span style={{ fontSize: '17px', fontWeight: 900, fontFamily: "'Inter',sans-serif", color: T.accentSolid, letterSpacing: '-0.5px' }}>MK AI</span>
          </div>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <button className="nb nl" onClick={() => navigate('/chat')}>Chat</button>
            <button className="nb nl" onClick={() => navigate('/')}>Tools</button>
            <button className="pb" onClick={() => navigate('/chat')}>Get Started →</button>
          </div>
        </div>
      </nav>

      {/* ══ HERO ══ */}
      <section style={{ position: 'relative', overflow: 'hidden', background: T.heroBg }}>
        <div style={{ position: 'absolute', width: '580px', height: '580px', borderRadius: '50%', top: '-160px', left: '-200px', background: T.blob1, filter: 'blur(100px)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', width: '420px', height: '420px', borderRadius: '50%', top: '80px', right: '-130px', background: T.blob2, filter: 'blur(85px)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', backgroundImage: `linear-gradient(${T.grid} 1px,transparent 1px),linear-gradient(90deg,${T.grid} 1px,transparent 1px)`, backgroundSize: '56px 56px' }} />

        <div className="hw hi" style={{ position: 'relative', zIndex: 1, textAlign: 'center', padding: '76px 52px 84px', maxWidth: '720px', margin: '0 auto' }}>
          <div className="bf" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: T.badgeBg, border: `1px solid ${T.badgeBorder}`, color: T.badgeColor, padding: '6px 18px', borderRadius: '100px', fontSize: '11.5px', fontWeight: 700, marginBottom: '28px', letterSpacing: '0.7px' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: T.dotColor, boxShadow: `0 0 7px ${T.dotColor}`, display: 'inline-block', flexShrink: 0 }} />
            LAST UPDATED · MAY 2026
          </div>

          <h1 className="mk-title grad-text" style={{ fontFamily: "'Inter',sans-serif", fontSize: '68px', fontWeight: 900, letterSpacing: '-3px', lineHeight: '1', marginBottom: '18px' }}>
            Privacy Policy
          </h1>

          <p style={{ fontSize: '16px', color: T.textMuted, lineHeight: '1.8', maxWidth: '420px', margin: '0 auto' }}>
            We believe privacy is a right, not a feature. Here's exactly how MK AI handles your data — in plain language, no legal jargon.
          </p>
        </div>
      </section>

      {/* ══ CONTENT ══ */}
      <section style={{ background: T.sectionBg }}>
        <div className="pw" style={{ padding: '64px 52px 80px', maxWidth: '820px', margin: '0 auto' }}>

          {/* Quick summary strip */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '12px', marginBottom: '56px' }}>
            {[
              { icon: '🚫', label: 'Zero Data Storage' },
              { icon: '🔒', label: 'Encrypted Transit' },
              { icon: '👁️', label: 'No Tracking' },
            ].map((item, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '18px 12px', background: T.cardBg, border: `1px solid ${T.cardBorder}`, borderRadius: '14px', textAlign: 'center' }}>
                <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: T.iconBg, border: `1px solid ${T.iconBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>{item.icon}</div>
                <span style={{ fontSize: '12px', fontWeight: 700, color: T.text }}>{item.label}</span>
              </div>
            ))}
          </div>

          {/* Policy sections */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {sections.map((sec, i) => (
              <div key={i} className="sec-card" style={{ background: T.cardBg, border: `1px solid ${T.cardBorder}`, borderRadius: '18px', padding: '32px', boxShadow: T.cardShadow }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', marginBottom: '20px' }}>
                  <div className="sec-num" style={{ flexShrink: 0, width: '36px', height: '36px', borderRadius: '9px', background: T.sectionNumBg, border: `1px solid ${T.sectionNumBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 800, color: T.accentSolid, letterSpacing: '0.5px', marginTop: '2px' }}>
                    {sec.num}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                      <span style={{ fontSize: '20px' }}>{sec.icon}</span>
                      <h2 style={{ fontFamily: "'Inter',sans-serif", fontSize: '20px', fontWeight: 800, color: T.text, letterSpacing: '-0.5px' }}>{sec.title}</h2>
                    </div>
                    <div style={{ height: '2px', width: '40px', background: T.accentGrad, borderRadius: '2px', opacity: 0.7 }} />
                  </div>
                </div>
                <div>{sec.content}</div>
              </div>
            ))}
          </div>

          {/* Bottom note */}
          <div style={{ marginTop: '40px', padding: '20px 24px', background: T.highlightBg, border: `1px solid ${T.highlightBorder}`, borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '14px' }}>
            <span style={{ fontSize: '20px', flexShrink: 0 }}>📌</span>
            <p style={{ color: T.textMuted, fontSize: '13px', lineHeight: '1.7', margin: 0 }}>
              This policy may be updated from time to time. Any significant changes will be reflected in the "Last Updated" date at the top of this page. Continued use of MK AI after updates implies acceptance of the revised policy.
            </p>
          </div>

          {/* Back link */}
          <div style={{ textAlign: 'center', marginTop: '52px' }}>
            <Link
              to="/"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: T.textSub, textDecoration: 'none', fontSize: '14px', fontWeight: 500, padding: '10px 20px', borderRadius: '10px', border: `1px solid ${T.outlineBorder}`, background: T.outlineBg, transition: 'color 0.2s,border-color 0.2s' }}
              onMouseEnter={e => { e.currentTarget.style.color = T.accentSolid; e.currentTarget.style.borderColor = T.accentSolid; }}
              onMouseLeave={e => { e.currentTarget.style.color = T.textSub; e.currentTarget.style.borderColor = T.outlineBorder; }}
            >
              ← Return to Home
            </Link>
          </div>

        </div>
      </section>

      {/* ══ FOOTER ══ */}
      <footer style={{ background: T.footerBg, borderTop: `1px solid ${T.navBorder}` }}>
        <div className="fw" style={{ textAlign: 'center', padding: '40px', maxWidth: '700px', margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}>
            <img src={logo} alt="MK AI" style={{ height: '38px', width: 'auto', filter: T.logoGlow, display: 'block' }} />
          </div>
          <div style={{ fontSize: '16px', fontWeight: 900, fontFamily: "'Inter',sans-serif", color: T.accentSolid, marginBottom: '10px', letterSpacing: '-0.3px' }}>MK AI</div>
          <p style={{ color: T.textSub, fontSize: '13px', marginBottom: '6px' }}>
            Developed by <span style={{ fontWeight: 700, color: T.accentSolid }}>MK AI</span> &nbsp;·&nbsp; © 2026
          </p>
          <p style={{ color: T.textSub, fontSize: '13px', marginBottom: '18px' }}>support.mkai@gmail.com</p>
          <div style={{ width: '32px', height: '1.5px', background: T.accentSolid, margin: '0 auto 16px', borderRadius: '2px', opacity: 0.4 }} />
          <div style={{ display: 'flex', gap: '24px', justifyContent: 'center' }}>
            {[['About Us', '/about'], ['Privacy Policy', '/privacy']].map(([label, path]) => (
              <Link key={path} to={path}
                style={{ color: T.textSub, textDecoration: 'none', fontSize: '13px', fontWeight: 500, transition: 'color 0.2s' }}
                onMouseEnter={e => e.target.style.color = T.accentSolid}
                onMouseLeave={e => e.target.style.color = T.textSub}
              >{label}</Link>
            ))}
          </div>
        </div>
      </footer>

    </div>
  );
}