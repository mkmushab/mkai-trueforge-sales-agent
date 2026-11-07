import React, { useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';

// ── Theme Tokens — matches Home.jsx (emerald / mint / sky-blue / saffron, on white) ──
const T = {
  pageBg      : '#f6faf7',
  navBg       : 'rgba(246,250,247,0.92)',
  navBorder   : 'rgba(18,54,42,.10)',
  heroBg      : 'linear-gradient(175deg,#eaf5ee 0%,#f4faf6 100%)',
  sectionBg   : '#eef8f2',
  footerBg    : '#e4f3ea',
  cardBg      : 'linear-gradient(135deg, rgba(255,255,255,.62), rgba(255,255,255,.22))',
  cardBg2     : '#fffefb',
  cardBorderH : '#0FA968',
  cardBorder  : 'rgba(255,255,255,.68)',
  cardShadow  : '0 10px 34px rgba(15,90,70,.10), inset 0 1px 0 rgba(255,255,255,.55)',
  cardShadowH : '0 18px 42px rgba(15,90,70,.2), inset 0 1px 0 rgba(255,255,255,.7)',
  iconBg      : 'rgba(255,255,255,.65)',
  iconBorder  : 'rgba(255,255,255,.85)',
  searchBg    : 'rgba(255,253,253,.78)',
  searchBorder: 'rgba(15,90,70,.16)',
  searchBorderF: '#0FA968',
  searchRing  : 'rgba(15,169,104,.16)',
  text        : '#122420',
  textMuted   : '#5c6b64',
  textSub     : '#8a958e',
  badgeBg     : 'rgba(15,169,104,.12)',
  badgeBorder : 'rgba(15,169,104,.32)',
  badgeColor  : '#0C8457',
  dotColor    : '#0FA968',
  blob1       : 'rgba(21,150,214,.16)',
  blob2       : 'rgba(242,169,59,.10)',
  grid        : 'rgba(15,169,104,.05)',
  accentSolid : '#0FA968',
  accentGrad  : 'linear-gradient(135deg,#0FA968 0%,#1596D6 100%)',
  btnShadow   : '0 14px 30px rgba(15,150,120,.24)',
  btnShadowH  : '0 18px 38px rgba(15,150,120,.34)',
  scroll      : '#cdeedd',
  pillBg      : 'rgba(15,169,104,.07)',
  pillBorder  : 'rgba(15,169,104,.18)',
  pillActive  : 'rgba(15,169,104,.14)',
  pillActiveBorder: '#0FA968',
  pillActiveText  : '#0C8457',
  divider     : 'rgba(18,54,42,.10)',
  catGlow     : 'rgba(15,169,104,.35)',
};

const LOGO = '/whitelogo.webp';

const TOOLS = [
  { name:'AI Chat',          icon:'💬', path:'/chat',         desc:'Smart AI conversation partner',               category:'Communication', tags:['chat','ai','conversation'] },
  { name: 'Work Flow',        icon: '⚡', path: '/meeting',      desc: 'AI automation for emails, legal & meetings', category:'Business', tags: ['workflow','email','meeting'] },
  { name:'PPT Maker',        icon:'📊', path:'/ppt',          desc:'Create high-impact slides in seconds',         category:'Create',        tags:['ppt','presentation','slides'] },
  { name:'PDF Maker',        icon:'📄', path:'/pdf',          desc:'Premium documents with TOC, charts & tables',  category:'Create',        tags:['pdf','document','export'] },
  { name:'Image Generation', icon:'🎨', path:'/image',        desc:'Generate stunning multi-style AI images',      category:'Create',        tags:['image','art','generate'] },
  { name:'ResumeX',          icon:'📋', path:'/resume',       desc:'Auto-generate ATS resumes & cover letters',    category:'Career',        tags:['resume','cv','ats','job'] },
  { name:'Web Search',       icon:'🔍', path:'/search',       desc:'Search the live web for accurate answers',     category:'Research',      tags:['search','web','internet'] },
  { name:'YouTube Summary',  icon:'🎥', path:'/youtube',      desc:'Instant YouTube summaries with AI chat',       category:'Research',      tags:['youtube','video','summary'] },
  { name:'Code Helper',      icon:'💻', path:'/code',         desc:'Write, debug & review code instantly',         category:'Developer',     tags:['code','programming','debug'] },
  { name:'Grammar Studio',   icon:'✏️', path:'/grammar',      desc:'22-in-1 AI toolkit to fix & rewrite text',    category:'Writing',       tags:['grammar','writing','text'] },
  { name:'Smart Study',      icon:'📚', path:'/study',        desc:'8 AI tools to master notes & exams',           category:'Education',     tags:['study','notes','exam','learn'] },
  { name:'Entrepreneur Hub', icon:'💼', path:'/entrepreneur', desc:'Validate, Analyze & Build — All in One',      category:'Business',      tags:['business','startup'] },
  { name:'Creator Studio',   icon:'🎬', path:'/social',       desc:'AI tools for viral posts, blogs & scripts',   category:'Marketing',     tags:['content','creator','blog'] },
  { name:'Prompt Engineer',  icon:'🧠', path:'/prompt',       desc:'Master AI prompt engineering workspace',       category:'AI',            tags:['prompt','engineering','ai'] },
];

const CAT_ICONS = {
  Communication:'🗣️', Create:'✨', Career:'🎯',
  Research:'🔬', Developer:'⚙️', Writing:'📝',
  Education:'🎓', Business:'💡', Marketing:'📣', AI:'🤖',
};

export default function Tools() {
  const navigate = useNavigate();

  const [query, setQuery]     = useState('');
  const [focused, setFocused] = useState(false);
  const [activeTab, setActiveTab] = useState('All');

  const categories = ['All', ...Array.from(new Set(TOOLS.map(t => t.category)))];

  const filtered = useMemo(() => {
    let list = activeTab === 'All' ? TOOLS : TOOLS.filter(t => t.category === activeTab);
    if (!query.trim()) return list;
    const q = query.toLowerCase();
    return list.filter(t =>
      t.name.toLowerCase().includes(q) ||
      t.desc.toLowerCase().includes(q) ||
      t.tags.some(tag => tag.includes(q))
    );
  }, [query, activeTab]);

  return (
    <div style={{ background:T.pageBg, minHeight:'100vh', color:T.text, fontFamily:"'Inter',ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif", overflowX:'hidden' }}>

      <Helmet>
        <title>All AI Tools — Browse 22+ Tools | MK AI</title>
        <meta name="description" content="Browse all 22+ AI tools on MK AI — chat, presentations, PDFs, resumes, images, and more." />
      </Helmet>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;650;700;800;900&display=swap');
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
          border:none;cursor:pointer;border-radius:14px;
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

        .si{outline:none;transition:border-color 0.2s,box-shadow 0.2s;}
        .si::placeholder{opacity:0.5;}

        .tool-card{cursor:pointer;transition:transform 0.25s cubic-bezier(.22,1,.36,1),box-shadow 0.25s,border-color 0.25s,background 0.25s;position:relative;overflow:hidden;border-radius:20px;backdrop-filter:blur(16px) saturate(150%);-webkit-backdrop-filter:blur(16px) saturate(150%);}
        .tool-card:hover{transform:translateY(-6px) scale(1.016);}

        .pill{cursor:pointer;transition:all 0.2s;border-radius:100px;font-size:12.5px;font-weight:600;font-family:'Inter',sans-serif;white-space:nowrap;padding:7px 16px;border:1.5px solid ${T.pillBorder};background:${T.pillBg};color:${T.textMuted};}
        .pill:hover{border-color:${T.accentSolid};color:${T.accentSolid};}
        .pill-active{background:${T.pillActive}!important;border-color:${T.pillActiveBorder}!important;color:${T.pillActiveText}!important;}

        .arrow-icon{opacity:0;transform:translateX(-4px);transition:opacity 0.2s,transform 0.2s;}
        .tool-card:hover .arrow-icon{opacity:1;transform:translateX(0);}

        .hi{animation:hi 0.5s cubic-bezier(.22,1,.36,1) both;}
        @keyframes hi{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        .card-stagger{animation:hi 0.4s cubic-bezier(.22,1,.36,1) both;}

        .nw{padding:10px 52px;}

        @media(max-width:640px){
          .nw{padding:8px 14px!important;}
          .tools-grid{grid-template-columns:1fr!important;}
          .pills-wrap{gap:8px!important;}
          .hero-tools{padding:32px 16px 20px!important;}
          .tools-section{padding:24px 16px 48px!important;}
          .hero-stats{display:none!important;}
          .nl{display:none!important;}
          .pb{padding:9px 16px!important;font-size:12px!important;}
          .nb{padding:6px 10px!important;font-size:12px!important;}
        }
        @media(min-width:641px) and (max-width:1024px){
          .tools-grid{grid-template-columns:repeat(2,1fr)!important;}
          .nw{padding:12px 28px!important;}
        }
      `}</style>

      {/* ══ NAVBAR ══ */}
      <nav style={{ position:'sticky',top:0,zIndex:100,background:T.navBg,backdropFilter:'blur(20px)',borderBottom:`1px solid ${T.navBorder}` }}>
        <div className="nw" style={{ display:'flex',justifyContent:'space-between',alignItems:'center',maxWidth:'1400px',margin:'0 auto' }}>
          <div onClick={() => navigate('/')} style={{ display:'flex',alignItems:'center',gap:'8px',cursor:'pointer',flexShrink:0 }}>
            <img src={LOGO} alt="MK AI" style={{ height:'32px',width:'auto',borderRadius:'50%',display:'block' }} />
            <span style={{ fontSize:'17px',fontWeight:800,color:T.accentSolid,letterSpacing:'-0.5px' }}>MK AI</span>
          </div>
          <div style={{ display:'flex',gap:'6px',alignItems:'center' }}>
            <button className="nb nl" onClick={() => navigate('/chat')}>Chat</button>
            <button className="nb nl" onClick={() => navigate('/')}>Home</button>
            <button className="pb" onClick={() => navigate('/chat')}>Get Started →</button>
          </div>
        </div>
      </nav>

      {/* ══ HERO STRIP ══ */}
      <section style={{ position:'relative',overflow:'hidden',background:T.heroBg,borderBottom:`1px solid ${T.divider}` }}>
        <div style={{ position:'absolute',width:'500px',height:'500px',borderRadius:'50%',top:'-200px',left:'-150px',background:T.blob1,filter:'blur(100px)',pointerEvents:'none' }} />
        <div style={{ position:'absolute',width:'350px',height:'350px',borderRadius:'50%',top:'0',right:'-100px',background:T.blob2,filter:'blur(80px)',pointerEvents:'none' }} />
        <div style={{ position:'absolute',inset:0,pointerEvents:'none',backgroundImage:`linear-gradient(${T.grid} 1px,transparent 1px),linear-gradient(90deg,${T.grid} 1px,transparent 1px)`,backgroundSize:'56px 56px' }} />

        <div className="hero-tools hi" style={{ position:'relative',zIndex:1,padding:'48px 52px 36px',maxWidth:'1280px',margin:'0 auto' }}>
          <div style={{ display:'flex',alignItems:'center',gap:'8px',marginBottom:'20px',fontSize:'13px',color:T.textSub }}>
            <span
              style={{ cursor:'pointer',transition:'color 0.2s' }}
              onMouseEnter={e => e.target.style.color = T.accentSolid}
              onMouseLeave={e => e.target.style.color = T.textSub}
              onClick={() => navigate('/')}
            >Home</span>
            <span style={{ opacity:0.4 }}>›</span>
            <span style={{ color:T.accentSolid,fontWeight:600 }}>All Tools</span>
          </div>

          <div style={{ display:'flex',alignItems:'flex-end',justifyContent:'space-between',flexWrap:'wrap',gap:'16px' }}>
            <div>
              <div style={{ display:'flex',alignItems:'center',gap:'12px',marginBottom:'10px' }}>
                <div style={{ width:'4px',height:'40px',borderRadius:'4px',background:T.accentGrad }} />
                <h1 style={{ fontSize:'40px',fontWeight:800,letterSpacing:'-1.5px',lineHeight:1,color:T.text }}>
                  All Tools
                </h1>
              </div>
              <p style={{ color:T.textMuted,fontSize:'15px',paddingLeft:'16px' }}>
                {TOOLS.length} AI-powered tools — pick your weapon 🚀
              </p>
            </div>

            <div className="hero-stats" style={{ display:'flex',gap:'10px',flexWrap:'wrap' }}>
              {[['14+','Tools'],['8','Categories'],['100%','AI Powered']].map(([num,label]) => (
                <div key={label} style={{ background:T.badgeBg,border:`1px solid ${T.badgeBorder}`,borderRadius:'14px',padding:'10px 18px',textAlign:'center' }}>
                  <div style={{ fontSize:'20px',fontWeight:800,color:T.accentSolid }}>{num}</div>
                  <div style={{ fontSize:'11px',color:T.textSub,fontWeight:600,letterSpacing:'0.5px' }}>{label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══ MAIN CONTENT ══ */}
      <section style={{ background:T.sectionBg }}>
        <div className="tools-section" style={{ padding:'36px 52px 64px',maxWidth:'1280px',margin:'0 auto' }}>

          <div style={{ position:'relative',maxWidth:'420px',marginBottom:'24px' }}>
            <span style={{ position:'absolute',left:'14px',top:'50%',transform:'translateY(-50%)',fontSize:'15px',pointerEvents:'none',opacity:0.45 }}>🔍</span>
            <input
              type="text" className="si"
              placeholder="Search tools… e.g. resume, code"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              style={{ width:'100%',padding:'11px 36px 11px 40px',background:T.searchBg,border:`1.5px solid ${focused ? T.searchBorderF : T.searchBorder}`,borderRadius:'100px',color:T.text,fontSize:'13.5px',fontFamily:"'Inter',sans-serif",boxShadow:focused ? `0 0 0 3px ${T.searchRing}` : '0 4px 16px rgba(15,90,70,.06)',outline:'none',transition:'border-color 0.2s,box-shadow 0.2s' }}
            />
            {query && (
              <button onClick={() => setQuery('')} style={{ position:'absolute',right:'11px',top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',fontSize:'14px',color:T.textMuted,lineHeight:1,padding:'2px 4px' }}>✕</button>
            )}
          </div>

          <div className="pills-wrap" style={{ display:'flex',gap:'10px',flexWrap:'wrap',marginBottom:'32px' }}>
            {categories.map(cat => (
              <button
                key={cat}
                className={`pill${activeTab === cat ? ' pill-active' : ''}`}
                onClick={() => setActiveTab(cat)}
              >
                {cat !== 'All' && (CAT_ICONS[cat] || '📁')} {cat}
                <span style={{ marginLeft:'5px',opacity:0.5,fontSize:'11px' }}>
                  ({cat === 'All' ? TOOLS.length : TOOLS.filter(t => t.category === cat).length})
                </span>
              </button>
            ))}
          </div>

          {query.trim() && (
            <div style={{ marginBottom:'20px',fontSize:'13px',color:T.textSub }}>
              {filtered.length > 0
                ? <>{filtered.length} result{filtered.length !== 1 ? 's' : ''} for "<span style={{ color:T.accentSolid,fontWeight:600 }}>{query}</span>"</>
                : <>No results for "<span style={{ color:T.accentSolid }}>{query}</span>"</>
              }
            </div>
          )}

          {filtered.length === 0 ? (
            <div style={{ textAlign:'center',padding:'80px 0',color:T.textMuted }}>
              <div style={{ fontSize:'52px',marginBottom:'16px' }}>🔍</div>
              <p style={{ fontSize:'16px',fontWeight:700,marginBottom:'8px',color:T.text }}>No tools found</p>
              <p style={{ fontSize:'14px' }}>Try a different keyword or browse by category</p>
              <button className="pb" style={{ marginTop:'24px' }} onClick={() => { setQuery(''); setActiveTab('All'); }}>Clear filters</button>
            </div>
          ) : (
            <>
              {activeTab === 'All' && !query.trim() ? (
                Array.from(new Set(TOOLS.map(t => t.category))).map(cat => {
                  const catTools = TOOLS.filter(t => t.category === cat);
                  return (
                    <div key={cat} style={{ marginBottom:'44px' }}>
                      <div style={{ display:'flex',alignItems:'center',gap:'10px',marginBottom:'18px',paddingBottom:'12px',borderBottom:`1px solid ${T.divider}` }}>
                        <span style={{ fontSize:'20px' }}>{CAT_ICONS[cat] || '📁'}</span>
                        <span style={{ fontSize:'18px',fontWeight:800,color:T.accentSolid,letterSpacing:'-0.5px' }}>{cat}</span>
                        <span style={{ fontSize:'12px',color:T.textSub,fontWeight:600 }}>({catTools.length})</span>
                      </div>
                      <ToolGrid tools={catTools} navigate={navigate} />
                    </div>
                  );
                })
              ) : (
                <ToolGrid tools={filtered} navigate={navigate} />
              )}
            </>
          )}
        </div>
      </section>

      {/* ══ FOOTER ══ */}
      <footer style={{ background:T.footerBg,borderTop:`1px solid ${T.navBorder}` }}>
        <div style={{ textAlign:'center',padding:'36px 40px',maxWidth:'700px',margin:'0 auto' }}>
          <div style={{ display:'flex',justifyContent:'center',marginBottom:'10px' }}>
            <img src={LOGO} alt="MK AI" style={{ height:'34px',width:'auto',borderRadius:'50%',display:'block' }} />
          </div>
          <div style={{ fontSize:'15px',fontWeight:800,color:T.accentSolid,marginBottom:'8px',letterSpacing:'-0.3px' }}>MK AI</div>
          <p style={{ color:T.textSub,fontSize:'12.5px',marginBottom:'4px' }}>
            Developed by <span style={{ fontWeight:700,color:T.accentSolid }}>MK AI</span> &nbsp;·&nbsp; © 2026
          </p>
          <p style={{ color:T.textSub,fontSize:'12.5px',marginBottom:'16px' }}>support.mkai@gmail.com</p>
          <div style={{ width:'28px',height:'1.5px',background:T.accentSolid,margin:'0 auto 14px',borderRadius:'2px',opacity:0.5 }} />
          <div style={{ display:'flex',gap:'22px',justifyContent:'center' }}>
            {[['About Us','/about'],['Privacy Policy','/privacy']].map(([label,path]) => (
              <Link key={path} to={path}
                style={{ color:T.textSub,textDecoration:'none',fontSize:'12.5px',fontWeight:500,transition:'color 0.2s' }}
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

function ToolGrid({ tools, navigate }) {
  return (
    <div
      className="tools-grid"
      style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))', gap:'14px' }}
    >
      {tools.map((tool, i) => (
        <div
          key={tool.path}
          className="tool-card card-stagger"
          style={{ animationDelay:`${i * 40}ms`, background:T.cardBg, border:`1.5px solid ${T.cardBorder}`, padding:'20px 18px 18px', boxShadow:T.cardShadow }}
          onClick={() => navigate(tool.path)}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = T.cardBorderH;
            e.currentTarget.style.boxShadow   = T.cardShadowH;
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = T.cardBorder;
            e.currentTarget.style.boxShadow   = T.cardShadow;
          }}
        >
          <div style={{ width:'48px',height:'48px',borderRadius:'13px',background:T.iconBg,border:`1px solid ${T.iconBorder}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'22px',marginBottom:'13px',flexShrink:0,boxShadow:'inset 0 1px 0 rgba(255,255,255,.8)' }}>
            {tool.icon}
          </div>
          <div style={{ fontSize:'14px',fontWeight:700,color:T.text,marginBottom:'5px',lineHeight:'1.3' }}>{tool.name}</div>
          <div style={{ fontSize:'12px',color:T.textMuted,lineHeight:'1.65',marginBottom:'14px',minHeight:'38px' }}>{tool.desc}</div>
          <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between' }}>
            <span style={{ fontSize:'10.5px',fontWeight:700,color:T.badgeColor,background:T.badgeBg,border:`1px solid ${T.badgeBorder}`,padding:'3px 9px',borderRadius:'100px',letterSpacing:'0.3px' }}>
              {tool.category}
            </span>
            <span className="arrow-icon" style={{ fontSize:'12px',fontWeight:700,color:T.accentSolid }}>Open →</span>
          </div>
        </div>
      ))}
    </div>
  );
}