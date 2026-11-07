import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';

export default function About() {
  const navigate = useNavigate();

  // ── MK AI palette — emerald / mint / sky-blue / saffron, on white. Same as Home. ──
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
  };

  const features = [
    { icon: '🚀', title: '22+ Powerful AI Utilities', desc: 'From cinematic video editing pipelines to automated pitch deck generators and smart code assistants.' },
    { icon: '🔒', title: 'Privacy-Centric Design', desc: 'Your personal conversations and data are never stored. Your work stays yours, always.' },
    { icon: '⚡', title: 'Lightning Fast Inference', desc: 'Industry-leading models for real-time responses across search, chat, and creation tasks.' },
    { icon: '🌐', title: 'Built for the Modern Web', desc: 'Optimized for Chrome and laptop users for a seamless, professional-grade experience.' },
  ];

  const stats = [
    { num: '22+', label: 'AI Tools' },
    { num: '∞',   label: 'Free Usage' },
    { num: '0',   label: 'Data Stored' },
    { num: '1',   label: 'Platform' },
  ];

  const [menuOpen, setMenuOpen] = React.useState(false);

  return (
    <div style={{ background:T.bg, minHeight:'100vh', color:T.ink, fontFamily:"Inter,ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif" }}>

      <Helmet>
        <title>About MK AI — Our Mission & Story</title>
        <meta name="description" content="Learn about MK AI's mission to bring 22+ AI tools together on one free platform, built for students, creators, and professionals." />
      </Helmet>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;650;700;800&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
        html{scroll-behavior:smooth;}
        html, body{overflow-x:hidden;width:100%;max-width:100%;}
        body{background:radial-gradient(circle at 15% 10%, rgba(15,169,104,.10), transparent 26rem), ${T.bg};}
        a{text-decoration:none;color:inherit;}
        img{max-width:100%;display:block;}
        ::-webkit-scrollbar{width:4px;}
        ::-webkit-scrollbar-track{background:transparent;}
        ::-webkit-scrollbar-thumb{background:${T.mint};border-radius:4px;}
        :focus-visible{outline:2px solid ${T.emerald};outline-offset:2px;}
        .wrap{width:min(1220px,calc(100% - 56px));margin:auto;overflow-x:hidden;}

        .grad-text{
          background:linear-gradient(135deg,${T.emerald2},${T.sky2});
          -webkit-background-clip:text;background-clip:text;color:transparent;display:inline;
        }

        /* ── Header (same as Home) ── */
        .site-header{display:flex;align-items:center;gap:clamp(8px,2vw,24px);padding:clamp(14px,4vw,36px) 0 clamp(12px,3vw,32px);}
        .brand{
          width:clamp(46px,12vw,72px);height:clamp(46px,12vw,72px);flex:0 0 auto;border-radius:50%;
          display:grid;place-items:center;
          background:linear-gradient(150deg,${T.emerald2},${T.sky2});
          box-shadow:0 10px 26px rgba(15,90,70,.22), inset 0 1px 0 rgba(255,255,255,.18);
          cursor:pointer;overflow:hidden;flex-shrink:0;
        }
        .brand-logo{width:60%;height:60%;object-fit:contain;object-position:center;display:block;filter:drop-shadow(0 1px 2px rgba(0,0,0,.15));}
        .brand-name{
          font-size:clamp(15px,2.6vw,20px);font-weight:800;letter-spacing:-.01em;
          background:linear-gradient(135deg,${T.emerald2},${T.sky2});
          -webkit-background-clip:text;background-clip:text;color:transparent;white-space:nowrap;
        }
        nav.pillnav{
          height:76px;flex:1;display:flex;align-items:center;justify-content:center;
          gap:clamp(20px,5vw,64px);padding:0 24px;border-radius:50px;
          background:rgba(228,243,234,.84);box-shadow:0 10px 30px rgba(15,90,70,.08);
          backdrop-filter:blur(12px);
        }
        .pillnav button.navlink{
          font-size:15.5px;color:#233530;position:relative;padding:26px 0;
          background:none;border:none;cursor:pointer;font-family:inherit;font-weight:500;
        }
        .pillnav button.navlink.active{color:${T.emerald2};font-weight:650;}
        .pillnav button.navlink.active:after{content:"";position:absolute;bottom:12px;left:50%;width:30px;height:3px;border-radius:10px;background:${T.sky};transform:translateX(-50%);}
        .nav-cta{
          background:linear-gradient(135deg,${T.emerald},${T.sky});color:#fff!important;
          padding:13px 24px!important;border-radius:40px;box-shadow:0 12px 24px rgba(15,150,120,.22);
          border:none;font-size:14.5px;font-weight:650;cursor:pointer;font-family:inherit;
          display:inline-flex;align-items:center;gap:8px;transition:transform .2s;
        }
        .nav-cta:hover{transform:translateY(-2px);}
        .hamburger{
          display:none;background:rgba(228,243,234,.9);border:1px solid ${T.line};
          border-radius:10px;cursor:pointer;width:40px;height:40px;flex-shrink:0;
          flex-direction:column;align-items:center;justify-content:center;gap:4px;
        }
        .hamburger span{width:17px;height:2px;background:${T.ink};border-radius:2px;transition:transform .25s,opacity .25s;}
        .hamburger.open span:nth-child(1){transform:translateY(6px) rotate(45deg);}
        .hamburger.open span:nth-child(2){opacity:0;}
        .hamburger.open span:nth-child(3){transform:translateY(-6px) rotate(-45deg);}
        .mobile-menu{max-height:0;overflow:hidden;background:${T.white};border-radius:20px;transition:max-height .35s cubic-bezier(.22,1,.36,1);}
        .mobile-menu.open{max-height:280px;margin-top:10px;box-shadow:${T.shadow};}
        .mobile-menu-inner{display:flex;flex-direction:column;padding:8px 18px 16px;gap:2px;}
        .mml{background:none;border:none;text-align:left;padding:12px 4px;font-size:15px;font-weight:600;color:${T.ink};cursor:pointer;border-bottom:1px solid ${T.line};font-family:inherit;width:100%;}

        /* ── Hero ── */
        .about-hero{
          position:relative;overflow:hidden;border:1px solid rgba(15,60,45,.06);
          border-radius:34px;
          background:radial-gradient(circle at 74% 45%, rgba(21,150,214,.16), transparent 20rem),
                     radial-gradient(circle at 88% 78%, rgba(242,169,59,.10), transparent 16rem),
                     linear-gradient(145deg,#eaf5ee,#f4faf6);
          box-shadow:${T.shadow};padding:96px 52px 72px;text-align:center;
        }
        .about-hero:before,.about-hero:after{content:"";position:absolute;border-radius:50%;filter:blur(2px);opacity:.5;pointer-events:none;}
        .about-hero:before{width:300px;height:300px;right:-80px;top:30px;background:rgba(255,255,255,.5);}
        .about-hero:after{width:220px;height:220px;left:8%;bottom:-130px;background:rgba(205,238,221,.4);}
        .eyebrow{
          position:relative;z-index:2;display:inline-flex;align-items:center;gap:8px;padding:8px 18px;border-radius:100px;
          background:rgba(255,255,255,.68);box-shadow:0 7px 20px rgba(15,90,70,.06);
          color:#3c4a44;font-size:12px;font-weight:700;letter-spacing:.6px;margin-bottom:26px;
        }
        .eyebrow .dot{width:6px;height:6px;border-radius:50%;background:${T.sky};box-shadow:0 0 7px ${T.sky};display:inline-block;flex-shrink:0;}
        h1.about-title{position:relative;z-index:2;font-size:clamp(32px,4.4vw,58px);line-height:1.06;letter-spacing:-.04em;margin:0 0 20px;font-weight:750;max-width:760px;margin-inline:auto;word-break:break-word;}
        .about-lead{position:relative;z-index:2;font-size:17px;line-height:1.75;color:#586059;max-width:560px;margin:0 auto 34px;}
        .hero-actions{position:relative;z-index:2;display:flex;gap:14px;justify-content:center;flex-wrap:wrap;}
        .btn{display:inline-flex;align-items:center;gap:10px;padding:14px 26px;border-radius:35px;font-weight:650;font-size:14.5px;border:1px solid rgba(15,120,90,.22);cursor:pointer;font-family:inherit;transition:.2s transform,.2s box-shadow,.2s background;}
        .btn:hover{transform:translateY(-2px);}
        .btn.primary{background:linear-gradient(135deg,${T.emerald},${T.sky});color:#fff;border:0;box-shadow:0 14px 30px rgba(15,150,120,.24);}
        .btn.secondary{background:rgba(255,255,255,.62);color:${T.emerald2};}

        /* ── Stats row ── */
        .stats-row{display:grid;grid-template-columns:repeat(4,1fr);max-width:820px;margin:52px auto 0;border-radius:22px;overflow:hidden;background:${T.glassBg};backdrop-filter:blur(16px) saturate(150%);border:1px solid ${T.glassBorder};box-shadow:${T.glassShadow};}
        .stat-cell{text-align:center;padding:28px 16px;border-right:1px solid ${T.line};}
        .stat-cell:last-child{border-right:none;}
        .stat-num{font-size:2.1rem;font-weight:800;color:${T.emerald2};letter-spacing:-1px;line-height:1;}
        .stat-label{font-size:12.5px;color:${T.muted};margin-top:6px;font-weight:600;}

        /* ── Main content ── */
        .about-main{padding:78px 0;}
        .about-grid{display:grid;grid-template-columns:1fr 1fr;gap:48px;align-items:start;margin-bottom:64px;}
        .badge-sm{display:inline-flex;align-items:center;gap:7px;background:rgba(15,169,104,.10);border:1px solid rgba(15,169,104,.22);color:${T.emerald2};padding:4px 14px;border-radius:100px;font-size:11px;font-weight:700;letter-spacing:.6px;margin-bottom:16px;}
        h2.section-title{font-size:1.8rem;font-weight:800;color:${T.ink};margin-bottom:14px;letter-spacing:-.02em;line-height:1.2;}
        .body-text{color:${T.muted};font-size:15px;line-height:1.9;}
        .mission-box{background:${T.panel2};border:1px solid ${T.line};border-radius:16px;padding:22px 24px;margin-top:28px;}
        .mission-label{font-size:12.5px;font-weight:700;color:${T.emerald2};letter-spacing:.5px;margin-bottom:8px;text-transform:uppercase;}
        .mission-text{font-size:15px;color:${T.ink};line-height:1.8;}

        .dev-card{background:${T.glassBg};backdrop-filter:blur(18px) saturate(150%);-webkit-backdrop-filter:blur(18px) saturate(150%);border:1px solid ${T.glassBorder};border-radius:22px;padding:30px;box-shadow:${T.glassShadow};}
        .dev-icon{width:64px;height:64px;border-radius:16px;background:linear-gradient(135deg,${T.emerald},${T.sky});display:flex;align-items:center;justify-content:center;font-size:28px;margin-bottom:18px;box-shadow:0 10px 26px rgba(15,150,120,.24);}
        .dev-name{font-size:1.4rem;font-weight:800;color:${T.ink};margin-bottom:4px;}
        .dev-role{font-size:13px;color:${T.emerald2};font-weight:650;margin-bottom:16px;}
        .dev-bio{color:${T.muted};font-size:14px;line-height:1.85;margin-bottom:18px;}
        .skill-chip{background:rgba(255,255,255,.6);border:1px solid ${T.glassBorder};color:${T.ink};padding:5px 13px;border-radius:9px;font-size:12px;font-weight:650;box-shadow:inset 0 1px 0 rgba(255,255,255,.8);}

        /* Features grid */
        .feat-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:16px;}
        .feat-card{
          background:${T.glassBg};backdrop-filter:blur(16px) saturate(150%);-webkit-backdrop-filter:blur(16px) saturate(150%);
          border:1px solid ${T.glassBorder};border-radius:18px;padding:24px 22px;box-shadow:${T.glassShadow};
          transition:transform .28s cubic-bezier(.22,1,.36,1),box-shadow .28s;
        }
        .feat-card:hover{transform:translateY(-5px);box-shadow:0 18px 42px rgba(15,90,70,.2), inset 0 1px 0 rgba(255,255,255,.7);}
        .feat-icon{width:48px;height:48px;border-radius:13px;background:rgba(255,255,255,.6);display:flex;align-items:center;justify-content:center;font-size:22px;margin-bottom:14px;box-shadow:inset 0 1px 0 rgba(255,255,255,.8);}
        .feat-title{font-size:15px;font-weight:700;color:${T.ink};margin-bottom:7px;}
        .feat-desc{font-size:13.5px;color:${T.muted};line-height:1.7;}

        /* CTA strip */
        .cta-strip{background:${T.panel2};border:1px solid ${T.line};border-radius:24px;padding:52px 40px;text-align:center;}
        .cta-strip h2{font-size:1.9rem;font-weight:800;color:${T.ink};letter-spacing:-.02em;margin-bottom:12px;}
        .cta-strip p{font-size:15px;color:${T.muted};margin-bottom:28px;line-height:1.7;max-width:520px;margin-inline:auto;}

        footer{padding:26px 0 50px;color:#6a746d;text-align:center;font-size:14px;}
        .foot-inner{display:flex;flex-direction:column;align-items:center;gap:10px;}
        .foot-brand{width:26px;height:26px;border-radius:50%;background:linear-gradient(150deg,${T.emerald2},${T.sky2});display:grid;place-items:center;flex-shrink:0;overflow:hidden;}
        .foot-brand img{width:60%;height:60%;object-fit:contain;}
        .foot-links{display:flex;gap:22px;}
        .foot-links a{font-size:13px;color:${T.muted};transition:color .2s;}
        .foot-links a:hover{color:${T.emerald2};}

        @media(max-width:900px){
          .site-header{padding:18px 0;gap:10px;}
          .pillnav{display:none;}
          .hamburger{display:flex;}
          .about-grid{grid-template-columns:1fr;gap:36px;}
        }
        @media(max-width:640px){
          .wrap{width:calc(100% - 28px);}
          .about-hero{border-radius:24px;padding:60px 22px 44px;}
          h1.about-title{font-size:2.1rem;}
          .stats-row{grid-template-columns:repeat(2,1fr);}
          .stat-cell:nth-child(2){border-right:none;}
          .feat-grid{grid-template-columns:1fr;}
          .brand-name{display:none;}
        }
      `}</style>

      <div className="wrap">
        {/* ══ HEADER ══ */}
        <header className="site-header">
          <a className="brand" onClick={() => navigate('/')} title="MK AI">
            <img src="/whitelogo.webp" alt="MK AI" className="brand-logo" />
          </a>
          <span className="brand-name" style={{ marginRight:'auto', marginLeft:'-6px' }}>MK AI</span>

          <nav className="pillnav" aria-label="Main navigation">
            <button className="navlink" onClick={() => navigate('/')}>Home</button>
            <button className="navlink" onClick={() => navigate('/')}>Tools</button>
            <button className="navlink" onClick={() => navigate('/chat')}>Chat</button>
            <button className="navlink active" onClick={() => navigate('/about')}>About us</button>
            <button className="nav-cta" onClick={() => navigate('/chat')}>Get Started <span>→</span></button>
          </nav>

          <button className={`hamburger${menuOpen ? ' open' : ''}`} onClick={() => setMenuOpen(p => !p)} aria-label="Toggle menu" aria-expanded={menuOpen}>
            <span /><span /><span />
          </button>
        </header>

        <div className={`mobile-menu${menuOpen ? ' open' : ''}`}>
          <div className="mobile-menu-inner">
            <button className="mml" onClick={() => { setMenuOpen(false); navigate('/'); }}>🏠 Home</button>
            <button className="mml" onClick={() => { setMenuOpen(false); navigate('/chat'); }}>💬 Chat</button>
            <button className="mml" onClick={() => { setMenuOpen(false); navigate('/about'); }}>ℹ️ About us</button>
            <button className="nav-cta" style={{ marginTop:'8px', justifyContent:'center' }} onClick={() => { setMenuOpen(false); navigate('/chat'); }}>Get Started <span>→</span></button>
          </div>
        </div>

        <main>
          {/* ══ HERO ══ */}
          <section className="about-hero">
            <div className="eyebrow"><span className="dot" /> OUR STORY &nbsp;·&nbsp; OUR VISION</div>
            <h1 className="about-title">
              Elevating Human Potential with <span className="grad-text">MK AI</span>
            </h1>
            <p className="about-lead">
              A comprehensive ecosystem of 22+ intelligent tools designed to automate your workflow and spark next-level creativity — completely free.
            </p>
            <div className="hero-actions">
              <button className="btn primary" onClick={() => navigate('/')}>Explore Tools →</button>
              <button className="btn secondary" onClick={() => navigate('/chat')}>Start Chatting 💬</button>
            </div>

            <div className="stats-row">
              {stats.map((s, i) => (
                <div key={i} className="stat-cell">
                  <div className="stat-num">{s.num}</div>
                  <div className="stat-label">{s.label}</div>
                </div>
              ))}
            </div>
          </section>

          {/* ══ MAIN CONTENT ══ */}
          <section className="about-main">
            <div className="about-grid">
              {/* Left: Story */}
              <div>
                <div className="badge-sm">OUR STORY</div>
                <h2 className="section-title">The Vision Behind MK AI</h2>
                <p className="body-text">
                  In an era where technology moves at lightning speed, MK AI was born out of a simple necessity: making high-end AI capabilities accessible without complexity or cost. We believe that intelligence should be decentralized and available to every student, creator, and professional.
                </p>
                <p className="body-text" style={{ marginTop:'14px' }}>
                  Our platform isn't just a collection of tools — it's a productivity engine built on the philosophy of <strong style={{ color:T.ink }}>"Zero Investment"</strong> for the user. Powerful AI, zero paisa.
                </p>

                <div className="mission-box">
                  <div className="mission-label">Our Mission</div>
                  <p className="mission-text">
                    To build the world's most accessible AI suite — where every student, freelancer, and creator has the tools they need to compete at the highest level.
                  </p>
                </div>
              </div>

              {/* Right: Developer Card */}
              <div className="dev-card">
                <div className="badge-sm">MEET THE DEVELOPER</div>
                <div className="dev-icon">👨‍💻</div>
                <div className="dev-name">Mohd Mushab Khan</div>
                <div className="dev-role">Founder &amp; Developer</div>
                <p className="dev-bio">
                  An aspiring software developer and entrepreneur currently pursuing a B.Tech in VLSI Design and Technology. Combining technical expertise in Python and React.js with a vision for a "Digital AI Empire."
                </p>
                <div style={{ display:'flex', flexWrap:'wrap', gap:'8px' }}>
                  {['React.js', 'Python', 'AI/ML', 'VLSI', 'Entrepreneur'].map(skill => (
                    <span key={skill} className="skill-chip">{skill}</span>
                  ))}
                </div>
              </div>
            </div>

            {/* Features Grid */}
            <div style={{ marginBottom:'64px' }}>
              <div style={{ textAlign:'center', marginBottom:'36px' }}>
                <h2 className="section-title" style={{ marginBottom:'8px' }}>
                  Why Choose <span className="grad-text">MK AI?</span>
                </h2>
                <p className="body-text" style={{ display:'inline' }}>Everything you need, nothing you don't</p>
              </div>

              <div className="feat-grid">
                {features.map((f, i) => (
                  <div key={i} className="feat-card">
                    <div className="feat-icon">{f.icon}</div>
                    <div className="feat-title">{f.title}</div>
                    <div className="feat-desc">{f.desc}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* CTA Strip */}
            <div className="cta-strip">
              <h2>Ready to Supercharge Your Workflow?</h2>
              <p>Whether you're researching, building, or creating — MK AI is here to make your life easier through automation.</p>
              <div style={{ display:'flex', gap:'12px', justifyContent:'center', flexWrap:'wrap' }}>
                <button className="btn primary" onClick={() => navigate('/')}>Explore the Tools →</button>
                <button className="btn secondary" onClick={() => navigate('/chat')}>Try AI Chat 💬</button>
              </div>
            </div>
          </section>
        </main>

        {/* ══ FOOTER ══ */}
        <footer>
          <div className="foot-inner">
            <div style={{ fontWeight:700, color:T.emerald2, fontSize:'15px', display:'flex', alignItems:'center', gap:'8px' }}>
              <span className="foot-brand"><img src="/whitelogo.webp" alt="" /></span>
            </div>
            <div>© 2026 MK AI. support.mkai@gmail.com</div>
            <div className="foot-links">
              <Link to="/about">About Us</Link>
              <Link to="/privacy">Privacy Policy</Link>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}