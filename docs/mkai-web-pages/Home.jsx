import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';

const DOWNLOAD_URL = '/downloads/MKAI.exe';

export default function Home() {
  const navigate = useNavigate();

  const [query, setQuery]         = useState('');
  const [heroQuery, setHeroQuery] = useState('');
  const [focused, setFocused]     = useState(false);
  const [menuOpen, setMenuOpen]   = useState(false);
  const [showComingSoon, setShowComingSoon] = useState(false);
  const toolsSectionRef = useRef(null);

  const openComingSoon = () => setShowComingSoon(true);
  const closeComingSoon = () => setShowComingSoon(false);

  useEffect(() => {
    if (!showComingSoon) return;
    const onKey = (e) => { if (e.key === 'Escape') closeComingSoon(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showComingSoon]);

  const tools = [
    { name: 'AI Chat',          icon: '💬', path: '/chat',         desc: 'Smart AI conversation partner',               tags: ['chat','ai','conversation'] },
    { name: 'PPT Maker',        icon: '📊', path: '/ppt',          desc: 'Create high-impact slides in seconds',        tags: ['ppt','presentation','slides'] },
    { name: 'PDF Maker',        icon: '📄', path: '/pdf',          desc: 'Edit live & export pixel-perfect PDFs',       tags: ['pdf','document','export'] },
    { name: 'ResumeX',          icon: '📋', path: '/resume',       desc: 'Auto-generate ATS resumes & cover letters',   tags: ['resume','cv','ats','job'] },
    { name: 'Image Generation', icon: '🎨', path: '/image',        desc: 'Generate stunning multi-style AI images',     tags: ['image','art','generate'] },
    { name: 'Web Search',       icon: '🔍', path: '/search',       desc: 'Search the live web for accurate answers',    tags: ['search','web','internet'] },
    { name: 'YouTube Summary',  icon: '🎥', path: '/youtube',      desc: 'Instant YouTube summaries with AI chat',      tags: ['youtube','video','summary'] },
    { name: 'Code Helper',      icon: '💻', path: '/code',         desc: 'Write, debug & review code instantly',        tags: ['code','programming','debug'] },
    { name: 'Grammar Studio',   icon: '✏️', path: '/grammar',      desc: '22-in-1 AI toolkit to fix & rewrite text',   tags: ['grammar','writing','text'] },
    { name: 'Smart Study',      icon: '📚', path: '/study',        desc: '8 AI tools to master notes & exams',         tags: ['study','notes','exam','learn'] },
    { name: 'Entrepreneur Hub', icon: '💼', path: '/entrepreneur', desc: 'Validate, Analyze & Build — All in One',     tags: ['business','startup'] },
    { name: 'Creator Studio',   icon: '🎬', path: '/social',       desc: 'AI tools for viral posts, blogs & scripts',  tags: ['content','creator','blog'] },
    { name: 'Work Flow',        icon: '⚡', path: '/meeting',      desc: 'AI automation for emails, legal & meetings', tags: ['workflow','email','meeting'] },
    { name: 'Prompt Engineer',  icon: '🧠', path: '/prompt',       desc: 'Master AI prompt engineering workspace',      tags: ['prompt','engineering','ai'] },
    { name: 'Data Structurer',   icon: '⚙️',  path: '/data-structurer',   desc: 'Messy JSON or text → clean structured Excel',            tags: ['data','excel','json','structure'] },
    { name: 'Scheme Finder',     icon: '🇮🇳', path: '/scheme-finder',     desc: 'Find & auto-fill eligible govt scheme applications',      tags: ['government','scheme','subsidy','india'] },
    { name: 'Risk Predictor',    icon: '🧠',  path: '/risk-predictor',    desc: 'Detect risk & anomalies, auto-build PPT + email report',  tags: ['risk','prediction','analytics','ppt'] },
    { name: 'Burnout Predictor', icon: '🫂',  path: '/burnout-predictor', desc: 'Spot team workload burnout signals, auto-alert HR',       tags: ['hr','burnout','team','wellbeing'] },
    { name: 'AURA-Transform', icon: '🔮', path: '/aura-transform', desc: 'Verified, cited AI content transformation', tags: ['transform','summary','citation','research'] }, 
    { name: 'Web Scraping',   icon: '🌐', path: '/web-scraping', desc: 'Capture any webpage & auto-build reports, PPTs & graphs', tags: ['scraping','extension','web','data'] },
    { name: 'Margdarshak AI', icon: '🧭', path: '/margdarshak', desc: 'Diagnose learning gaps, get an adaptive study plan & multilingual career guidance', tags: ['education', 'skilling', 'career', 'study', 'ai mentor'] },
    { name: 'Kaushal AI', icon: '🧑‍🔧', path: '/kaushal-ai', desc: 'Diagnose employability & vocational skill gaps across 64+ skills, build a practice plan & roleplay mock interviews', tags: ['skilling', 'employability', 'vocational', 'career', 'nsqf', 'practice'] },
    
  ];




  // Split into two rows for the opposite-direction sliding marquee
  const rowA = tools.filter((_, i) => i % 2 === 0);
  const rowB = tools.filter((_, i) => i % 2 === 1);

  const filtered = useMemo(() => {
    if (!query.trim()) return tools;
    const q = query.toLowerCase();
    return tools.filter(t =>
      t.name.toLowerCase().includes(q) ||
      t.desc.toLowerCase().includes(q) ||
      t.tags.some(tag => tag.includes(q))
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  // ── MK AI palette — emerald / mint / sky-blue / saffron, on white. No pink. ──
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

  const handleHeroSearch = (e) => {
    if (e.key === 'Enter' && heroQuery.trim()) {
      setQuery(heroQuery.trim());
      toolsSectionRef.current?.scrollIntoView({ behavior:'smooth', block:'start' });
    }
  };

  // ── Scroll-reveal for grid cards ──
  const cardRefs = useRef(new Map());
  const setCardRef = useCallback((el, key) => {
    if (el) cardRefs.current.set(key, el);
    else cardRefs.current.delete(key);
  }, []);

  useEffect(() => {
    const nodes = Array.from(cardRefs.current.values());
    if (!nodes.length) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    nodes.forEach(n => io.observe(n));
    return () => io.disconnect();
  }, [filtered]);

  return (
    <div style={{ background:T.bg, minHeight:'100vh', color:T.ink, fontFamily:"Inter,ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif" }}>

      <Helmet>
        <title>MK AI — Chat, Create & Build with 22+ AI Tools</title>
        <meta name="description" content="MK AI brings 22+ AI tools together — chat, presentations, PDFs, resumes, images, grammar & more, all free on one platform." />
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

        /* ── Header ── */
        .site-header{display:flex;align-items:center;gap:clamp(8px,2vw,24px);padding:clamp(14px,4vw,36px) 0 clamp(12px,3vw,32px);}
        .brand{
          width:clamp(46px,12vw,72px);height:clamp(46px,12vw,72px);flex:0 0 auto;border-radius:50%;
          display:grid;place-items:center;
          background:linear-gradient(150deg,${T.emerald2},${T.sky2});
          box-shadow:0 10px 26px rgba(15,90,70,.22), inset 0 1px 0 rgba(255,255,255,.18);
          cursor:pointer;overflow:hidden;flex-shrink:0;
        }
        .brand-logo{
          width:60%;height:60%;object-fit:contain;object-position:center;display:block;
          filter:drop-shadow(0 1px 2px rgba(0,0,0,.15));
        }
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
        .hero{
          position:relative;overflow:hidden;min-height:640px;border:1px solid rgba(15,60,45,.06);
          border-radius:34px;
          background:radial-gradient(circle at 74% 45%, rgba(21,150,214,.16), transparent 20rem),
                     radial-gradient(circle at 88% 78%, rgba(242,169,59,.10), transparent 16rem),
                     linear-gradient(145deg,#eaf5ee,#f4faf6);
          box-shadow:${T.shadow};padding:100px 76px 46px;
        }
        .hero:before,.hero:after{content:"";position:absolute;border-radius:50%;filter:blur(2px);opacity:.5;pointer-events:none;}
        .hero:before{width:300px;height:300px;right:-80px;top:30px;background:rgba(255,255,255,.5);}
        .hero:after{width:220px;height:220px;left:22%;bottom:-130px;background:rgba(205,238,221,.4);}
        .copy{position:relative;z-index:2;max-width:540px;width:100%;}
        .eyebrow{
          display:inline-flex;align-items:center;gap:8px;padding:8px 14px;border-radius:22px;
          background:rgba(255,255,255,.68);box-shadow:0 7px 20px rgba(15,90,70,.06);
          color:#3c4a44;font-size:14px;margin-bottom:24px;
        }
        .eyebrow b{color:${T.emerald2};}
        h1.hero-title{font-size:clamp(34px,4.6vw,60px);line-height:1.02;letter-spacing:-.04em;margin:0 0 22px;font-weight:750;word-break:break-word;}
        h1.hero-title em{font-style:normal;color:${T.emerald2};}
        .lead{font-size:17px;line-height:1.6;color:#586059;max-width:460px;margin:0 0 30px;}
        .actions{display:flex;gap:14px;flex-wrap:wrap;}
        .btn{display:inline-flex;align-items:center;gap:12px;padding:15px 26px;border-radius:35px;font-weight:650;font-size:15px;border:1px solid rgba(15,120,90,.22);cursor:pointer;font-family:inherit;transition:.2s transform,.2s box-shadow,.2s background;}
        .btn:hover{transform:translateY(-2px);}
        .btn.primary{background:linear-gradient(135deg,${T.emerald},${T.sky});color:#fff;border:0;box-shadow:0 14px 30px rgba(15,150,120,.24);}
        .btn.secondary{background:rgba(255,255,255,.52);color:${T.emerald2};}
        .arrow{font-size:18px;line-height:1;}

        /* ── Liquid-glass orb (hero visual) ── */
        .orbital{position:absolute;right:6%;top:110px;width:360px;height:360px;z-index:1;animation:orbitalDrift 14s ease-in-out infinite;max-width:80vw;}
        @keyframes orbitalDrift{0%,100%{transform:translateY(0);}50%{transform:translateY(-12px);}}
        .glow-ring{position:absolute;inset:0;border-radius:50%;background:conic-gradient(from 120deg,${T.emerald},${T.sky},${T.gold},${T.emerald});filter:blur(28px);opacity:.35;animation:ringSpin 10s linear infinite;}
        @keyframes ringSpin{to{transform:rotate(360deg);}}
        .glass-sphere{
          position:absolute;inset:36px;border-radius:50%;
          background:linear-gradient(135deg, rgba(255,255,255,.72), rgba(255,255,255,.24));
          backdrop-filter:blur(20px) saturate(160%);-webkit-backdrop-filter:blur(20px) saturate(160%);
          border:1px solid rgba(255,255,255,.75);
          box-shadow:0 25px 55px rgba(15,90,70,.18), inset 0 1px 0 rgba(255,255,255,.8), inset 0 -18px 30px rgba(21,150,214,.08);
          display:grid;place-items:center;
          animation:hubPulse 3.6s ease-in-out infinite;
        }
        @keyframes hubPulse{0%,100%{box-shadow:0 25px 55px rgba(15,90,70,.18), inset 0 1px 0 rgba(255,255,255,.8), inset 0 -18px 30px rgba(21,150,214,.08);}50%{box-shadow:0 30px 64px rgba(15,90,70,.24), inset 0 1px 0 rgba(255,255,255,.9), inset 0 -18px 34px rgba(21,150,214,.13);}}
        .glass-sphere:before{content:"";position:absolute;top:8%;left:14%;width:40%;height:26%;border-radius:50%;background:linear-gradient(135deg,rgba(255,255,255,.9),rgba(255,255,255,0));filter:blur(1px);}
        .glass-sphere svg{width:82px;height:82px;filter:drop-shadow(0 8px 10px rgba(15,90,70,.2));position:relative;z-index:1;}
        .dot{position:absolute;width:10px;height:10px;border-radius:50%;box-shadow:0 0 18px rgba(15,150,120,.35);animation:dotTwinkle 3s ease-in-out infinite;}
        .dot.one{right:31%;top:14%;background:${T.emerald};}
        .dot.two{right:15%;top:70%;width:15px;height:15px;background:${T.sky};animation-delay:.8s;}
        .dot.three{right:46%;top:20%;width:6px;height:6px;background:${T.gold};animation-delay:1.4s;}
        @keyframes dotTwinkle{0%,100%{opacity:.4;transform:scale(.85);}50%{opacity:1;transform:scale(1.1);}}
        @media(prefers-reduced-motion: reduce){
          .orbital,.glow-ring,.glass-sphere,.dot,.slide-track{animation:none !important;}
        }

        /* ── Hero search ── */
        .hsearch{
          position:relative;z-index:4;margin-top:44px;height:70px;max-width:640px;width:100%;
          display:flex;align-items:center;gap:16px;padding:0 24px;border-radius:44px;
          background:rgba(255,253,253,.74);border:1px solid rgba(15,90,70,.08);
          box-shadow:0 17px 34px rgba(15,90,70,.10);backdrop-filter:blur(14px);
        }
        .hsearch svg{width:21px;color:#5c6b64;flex:none;}
        .hsearch input{border:0;outline:0;background:transparent;width:100%;min-width:0;font:inherit;font-size:15px;color:${T.ink};}
        .hsearch input::placeholder{color:#7b877f;}
        .hclear{width:36px;height:36px;border-radius:50%;display:grid;place-items:center;background:#eafaf1;color:${T.emerald2};font-size:20px;border:none;cursor:pointer;flex-shrink:0;}

        /* ── LIQUID GLASS SLIDING TOOLS ── */
        .tools-section{padding:70px 0 90px;}
        .slide-outer{overflow:hidden;position:relative;-webkit-mask-image:linear-gradient(90deg,transparent,#000 6%,#000 94%,transparent);mask-image:linear-gradient(90deg,transparent,#000 6%,#000 94%,transparent);margin-bottom:18px;}
        .slide-track{display:flex;width:max-content;gap:18px;padding:6px 0;}
        .slide-track.left{animation:slideLeft 42s linear infinite;}
        .slide-track.right{animation:slideRight 46s linear infinite;}
        .slide-outer:hover .slide-track{animation-play-state:paused;}
        @keyframes slideLeft{from{transform:translateX(0);}to{transform:translateX(-50%);}}
        @keyframes slideRight{from{transform:translateX(-50%);}to{transform:translateX(0);}}

        .glass-chip{
          flex-shrink:0;width:230px;display:flex;align-items:center;gap:12px;
          padding:16px 18px;border-radius:20px;cursor:pointer;
          background:${T.glassBg};backdrop-filter:blur(18px) saturate(160%);-webkit-backdrop-filter:blur(18px) saturate(160%);
          border:1px solid ${T.glassBorder};box-shadow:${T.glassShadow};
          position:relative;overflow:hidden;transition:transform .3s cubic-bezier(.22,1,.36,1),box-shadow .3s;
        }
        .glass-chip:before{
          content:"";position:absolute;top:0;left:-60%;width:50%;height:100%;
          background:linear-gradient(115deg,transparent,rgba(255,255,255,.55),transparent);
          transform:skewX(-18deg);transition:left .7s ease;
        }
        .glass-chip:hover{transform:translateY(-5px) scale(1.03);box-shadow:0 18px 42px rgba(15,90,70,.22), inset 0 1px 0 rgba(255,255,255,.7);}
        .glass-chip:hover:before{left:130%;}
        .glass-chip-icon{width:40px;height:40px;border-radius:12px;background:rgba(255,255,255,.6);display:flex;align-items:center;justify-content:center;font-size:19px;flex-shrink:0;box-shadow:inset 0 1px 0 rgba(255,255,255,.8);}
        .glass-chip-text{display:flex;flex-direction:column;line-height:1.25;min-width:0;}
        .glass-chip-name{font-size:13.5px;font-weight:700;color:${T.ink};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
        .glass-chip-desc{font-size:10.5px;color:${T.muted};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}

        /* ── Searchable grid (liquid glass, static) ── */
        .grid-title{text-align:center;margin:56px 0 34px;}
        .grid-title h2{font-size:clamp(24px,3vw,32px);letter-spacing:-.03em;margin:0 0 8px;}
        .grid-title p{font-size:15px;color:${T.muted};}
        .gsearch-wrap{position:relative;max-width:460px;width:100%;margin:0 auto 38px;}
        .gsearch{
          width:100%;padding:13px 40px 13px 46px;border-radius:100px;border:1.5px solid ${T.line};
          background:rgba(255,255,255,.72);backdrop-filter:blur(10px);color:${T.ink};font-size:13.5px;
          font-family:inherit;outline:none;transition:border-color .2s,box-shadow .2s;box-shadow:0 4px 16px rgba(15,90,70,.06);
        }
        .gsearch:focus{border-color:${T.emerald};box-shadow:0 0 0 3px rgba(15,169,104,.16);}
        .gsearch-icon{position:absolute;left:16px;top:50%;transform:translateY(-50%);opacity:.45;font-size:14px;pointer-events:none;}
        .gsearch-clear{position:absolute;right:14px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;font-size:15px;color:${T.muted};}

        .gd{display:grid;grid-template-columns:repeat(auto-fill,minmax(216px,1fr));gap:16px;}
        .gcard{
          cursor:pointer;position:relative;overflow:hidden;border-radius:20px;padding:20px 18px 18px;
          background:${T.glassBg};backdrop-filter:blur(16px) saturate(150%);-webkit-backdrop-filter:blur(16px) saturate(150%);
          border:1px solid ${T.glassBorder};box-shadow:${T.glassShadow};
          transition:transform .28s cubic-bezier(.22,1,.36,1),box-shadow .28s;
          opacity:0;transform:translateY(20px);
          display:block;
        }
        .gcard.in-view{opacity:1;transform:translateY(0);}
        .gcard:hover{transform:translateY(-6px) scale(1.015);box-shadow:0 18px 42px rgba(15,90,70,.2), inset 0 1px 0 rgba(255,255,255,.7);}
        .gcard-icon{width:44px;height:44px;border-radius:13px;background:rgba(255,255,255,.6);display:flex;align-items:center;justify-content:center;font-size:20px;margin-bottom:13px;box-shadow:inset 0 1px 0 rgba(255,255,255,.8);}
        .gcard-name{font-size:13.5px;font-weight:700;color:${T.ink};margin-bottom:5px;}
        .gcard-desc{font-size:11.5px;color:${T.muted};line-height:1.55;min-height:34px;margin-bottom:8px;}
        .gcard-cta{font-size:11px;font-weight:700;color:${T.emerald2};opacity:0;transform:translateX(-4px);transition:opacity .2s,transform .2s;}
        .gcard:hover .gcard-cta{opacity:1;transform:translateX(0);}

        footer{padding:26px 0 50px;color:#6a746d;text-align:center;font-size:14px;}
        .foot-inner{display:flex;flex-direction:column;align-items:center;gap:10px;}
        .foot-brand{width:26px;height:26px;border-radius:50%;background:linear-gradient(150deg,${T.emerald2},${T.sky2});display:grid;place-items:center;flex-shrink:0;overflow:hidden;}
        .foot-brand img{width:60%;height:60%;object-fit:contain;}
        .foot-links{display:flex;gap:22px;}
        .foot-links a{font-size:13px;color:${T.muted};transition:color .2s;}
        .foot-links a:hover{color:${T.emerald2};}

        /* ── Coming Soon modal ── */
        .cs-overlay{
          position:fixed;inset:0;z-index:200;display:flex;align-items:center;justify-content:center;
          background:rgba(12,32,26,.42);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);
          padding:20px;animation:csFadeIn .25s ease;
        }
        @keyframes csFadeIn{from{opacity:0;}to{opacity:1;}}
        .cs-card{
          position:relative;width:100%;max-width:380px;padding:38px 30px 30px;border-radius:26px;text-align:center;
          background:linear-gradient(160deg, rgba(255,255,255,.92), rgba(238,248,242,.92));
          border:1px solid rgba(255,255,255,.8);
          box-shadow:0 30px 80px rgba(10,60,45,.30), inset 0 1px 0 rgba(255,255,255,.9);
          animation:csPop .3s cubic-bezier(.22,1,.36,1);
          max-height:calc(100vh - 40px);
          overflow-y:auto;
        }
        @keyframes csPop{from{opacity:0;transform:translateY(14px) scale(.96);}to{opacity:1;transform:translateY(0) scale(1);}}
        .cs-close{
          position:absolute;top:14px;right:14px;width:32px;height:32px;border-radius:50%;border:none;cursor:pointer;
          background:rgba(18,54,42,.06);color:${T.muted};font-size:16px;display:grid;place-items:center;transition:background .2s,color .2s;
        }
        .cs-close:hover{background:rgba(18,54,42,.12);color:${T.ink};}
        .cs-badge{
          width:74px;height:74px;margin:0 auto 20px;border-radius:50%;display:grid;place-items:center;position:relative;
          background:conic-gradient(from 140deg,${T.emerald},${T.sky},${T.gold},${T.emerald});
        }
        .cs-badge:before{content:"";position:absolute;inset:5px;border-radius:50%;background:${T.white};}
        .cs-badge span{position:relative;font-size:30px;line-height:1;}
        .cs-title{font-size:21px;font-weight:750;letter-spacing:-.02em;margin-bottom:8px;color:${T.ink};}
        .cs-text{font-size:14px;line-height:1.6;color:${T.muted};margin-bottom:24px;}
        .cs-text b{color:${T.emerald2};}
        .cs-actions{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;}
        .cs-btn{
          padding:11px 22px;border-radius:30px;font-size:13.5px;font-weight:650;cursor:pointer;font-family:inherit;border:1px solid rgba(15,120,90,.2);transition:transform .2s;
        }
        .cs-btn:hover{transform:translateY(-2px);}
        .cs-btn.primary{background:linear-gradient(135deg,${T.emerald},${T.sky});color:#fff;border:0;box-shadow:0 10px 22px rgba(15,150,120,.24);}
        .cs-btn.ghost{background:rgba(18,54,42,.05);color:${T.emerald2};}

        @media (max-width:900px){
          .site-header{padding:18px 0;gap:10px;}
          .pillnav{display:none;}
          .hamburger{display:flex;}
          .hero{min-height:auto;padding:70px 28px 36px;}
          .orbital{right:50%;transform:translateX(50%) scale(.68);top:300px;}
          .copy{max-width:none;}
          .hsearch{max-width:none;}
          .glass-chip{width:200px;}
        }
        @media (max-width:520px){
          .wrap{width:calc(100% - 28px);}
          h1.hero-title{font-size:36px;}
          .hero{border-radius:24px;padding:56px 20px 28px;}
          .orbital{top:300px;width:280px;height:280px;transform:translateX(50%) scale(.6);}
          .hsearch{height:60px;padding:0 16px;gap:10px;}
          .hsearch input{font-size:13px;}
          .actions{flex-direction:column;align-items:stretch;}
          .actions .btn{justify-content:center;padding:14px 20px;}
          .gd{grid-template-columns:repeat(2,1fr);gap:10px;}
          .glass-chip{width:170px;padding:12px 14px;}
          .glass-chip-desc{display:none;}
          .brand-name{display:none;}
          .lead{font-size:15px;}

          /* Coming Soon modal — mobile */
          .cs-overlay{padding:14px;align-items:flex-end;}
          .cs-card{
            max-width:100%;
            border-radius:24px 24px 18px 18px;
            padding:28px 22px 22px;
            animation:csSlideUp .3s cubic-bezier(.22,1,.36,1);
          }
          .cs-badge{width:60px;height:60px;margin-bottom:14px;}
          .cs-badge span{font-size:24px;}
          .cs-title{font-size:18px;margin-bottom:6px;}
          .cs-text{font-size:13px;margin-bottom:18px;}
          .cs-actions{flex-direction:column;gap:8px;}
          .cs-btn{width:100%;justify-content:center;padding:13px 20px;font-size:13.5px;}
        }
        @keyframes csSlideUp{from{opacity:0;transform:translateY(40px);}to{opacity:1;transform:translateY(0);}}
        @media (max-width:400px){
          .wrap{width:calc(100% - 20px);}
          h1.hero-title{font-size:30px;}
          .hero{padding:48px 16px 24px;border-radius:20px;}
          .eyebrow{font-size:12.5px;padding:7px 12px;}
          .hsearch{height:54px;padding:0 14px;margin-top:32px;}
          .hsearch input{font-size:12.5px;}
          .btn{font-size:13.5px;padding:12px 18px;}
          .gd{grid-template-columns:1fr 1fr;gap:8px;}
          .gcard{padding:16px 14px 14px;}
          .glass-chip{width:150px;}
          .orbital{width:220px;height:220px;top:260px;}
        }
        @media (max-width:360px){
          .brand{width:42px;height:42px;}
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
            <button className="navlink active" onClick={() => navigate('/')}>Home</button>
            <button className="navlink" onClick={() => toolsSectionRef.current?.scrollIntoView({behavior:'smooth'})}>Tools</button>
            <button className="navlink" onClick={() => navigate('/chat')}>Chat</button>
            <button className="navlink" onClick={() => navigate('/about')}>About us</button>
            <button className="navlink" type="button" onClick={openComingSoon}>Download</button>
            <button className="nav-cta" onClick={() => navigate('/chat')}>Get Started <span className="arrow">→</span></button>
          </nav>

          <button className={`hamburger${menuOpen ? ' open' : ''}`} onClick={() => setMenuOpen(p => !p)} aria-label="Toggle menu" aria-expanded={menuOpen}>
            <span /><span /><span />
          </button>
        </header>

        <div className={`mobile-menu${menuOpen ? ' open' : ''}`}>
          <div className="mobile-menu-inner">
            <button className="mml" onClick={() => { setMenuOpen(false); navigate('/'); }}>🏠 Home</button>
            <button className="mml" onClick={() => { setMenuOpen(false); toolsSectionRef.current?.scrollIntoView({behavior:'smooth'}); }}>🧰 Tools</button>
            <button className="mml" onClick={() => { setMenuOpen(false); navigate('/chat'); }}>💬 Chat</button>
            <button className="mml" type="button" onClick={() => { setMenuOpen(false); openComingSoon(); }}>⬇️ Download</button>
            <button className="nav-cta" style={{ marginTop:'8px', justifyContent:'center' }} onClick={() => { setMenuOpen(false); navigate('/chat'); }}>Get Started <span className="arrow">→</span></button>
          </div>
        </div>

        {/* ══ HERO ══ */}
        <main id="home">
          <section className="hero">
            <div className="copy">
              <div className="eyebrow"><b>✧</b> Your AI. Your Way.</div>
              <h1 className="hero-title">One Platform.<br />22+ AI Tools to Chat, Create & Build<span style={{ color:T.emerald2 }}>.</span></h1>
              <p className="lead">Explore 22+ powerful AI tools, resources, and features — all in one place.</p>
              <div className="actions">
                <button className="btn primary" onClick={() => toolsSectionRef.current?.scrollIntoView({behavior:'smooth'})}>Get Started <span className="arrow">→</span></button>
                <button className="btn secondary" type="button" onClick={openComingSoon}>⬇ Download App</button>
              </div>

              <label className="hsearch">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"></circle><path d="m20 20-4-4"></path></svg>
                <input
                  type="search"
                  placeholder="Search anything…"
                  value={heroQuery}
                  onChange={e => setHeroQuery(e.target.value)}
                  onKeyDown={handleHeroSearch}
                  aria-label="Search anything"
                />
                {heroQuery && (
                  <button className="hclear" type="button" aria-label="Clear search" onClick={() => setHeroQuery('')}>×</button>
                )}
              </label>
            </div>

            <div className="orbital" aria-hidden="true">
              <div className="glow-ring"></div>
              <div className="glass-sphere">
                <svg viewBox="0 0 100 100" fill="none">
                  <path d="M50 17C54 34 66 46 83 50C66 54 54 66 50 83C46 66 34 54 17 50C34 46 46 34 50 17Z" fill={T.emerald} />
                </svg>
              </div>
            </div>
            <span className="dot one"></span><span className="dot two"></span><span className="dot three"></span>
          </section>

          {/* ══ TOOLS — liquid glass sliding ══ */}
          <section className="tools-section" id="tools" ref={toolsSectionRef}>
            <div className="section-title" style={{ textAlign:'center',maxWidth:'680px',margin:'0 auto 40px' }}>
              <h2 style={{ fontSize:'clamp(28px,3.4vw,38px)',letterSpacing:'-.03em',margin:'0 0 10px' }}>22+ AI tools, always in motion.</h2>
              <p style={{ fontSize:'16px',color:T.muted,lineHeight:1.6 }}>Tap any tool to jump straight in — or search the full list below.</p>
            </div>

            <div className="slide-outer">
              <div className="slide-track left">
                {[...rowA, ...rowA].map((t, i) => (
                  <Link className="glass-chip" key={`a-${i}`} to={t.path} title={t.name}>
                    <span className="glass-chip-icon">{t.icon}</span>
                    <span className="glass-chip-text">
                      <span className="glass-chip-name">{t.name}</span>
                      <span className="glass-chip-desc">{t.desc}</span>
                    </span>
                  </Link>
                ))}
              </div>
            </div>

            <div className="slide-outer">
              <div className="slide-track right">
                {[...rowB, ...rowB].map((t, i) => (
                  <Link className="glass-chip" key={`b-${i}`} to={t.path} title={t.name}>
                    <span className="glass-chip-icon">{t.icon}</span>
                    <span className="glass-chip-text">
                      <span className="glass-chip-name">{t.name}</span>
                      <span className="glass-chip-desc">{t.desc}</span>
                    </span>
                  </Link>
                ))}
              </div>
            </div>

            {/* ── Searchable liquid-glass grid ── */}
            <div className="grid-title">
              <h2>Browse all tools</h2>
              <p>Everything you need, all in one place</p>
            </div>

            <div className="gsearch-wrap">
              <span className="gsearch-icon">🔍</span>
              <input
                type="text"
                className="gsearch"
                placeholder="Search tools…  e.g. resume, code, image"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
              />
              {query && (
                <button className="gsearch-clear" onClick={() => setQuery('')} aria-label="Clear search">✕</button>
              )}
            </div>

            {filtered.length === 0 ? (
              <div style={{ textAlign:'center',padding:'60px 0',color:T.muted }}>
                <div style={{ fontSize:'44px',marginBottom:'12px' }}>🔍</div>
                <p style={{ fontSize:'14px' }}>No tools found for "<strong>{query}</strong>"</p>
              </div>
            ) : (
              <div className="gd">
                {filtered.map((tool, i) => (
                  <Link
                    key={tool.name}
                    ref={el => setCardRef(el, tool.name)}
                    className="gcard"
                    to={tool.path}
                    style={{ transitionDelay:`${Math.min(i,9)*40}ms` }}
                  >
                    <div className="gcard-icon">{tool.icon}</div>
                    <div className="gcard-name">{tool.name}</div>
                    <div className="gcard-desc">{tool.desc}</div>
                    <div className="gcard-cta">Open tool →</div>
                  </Link>
                ))}
              </div>
            )}
          </section>

          {/* ══ SEO CONTENT SECTION ══ */}
          <section style={{ padding:'40px 0 20px' }}>
            <div className="wrap" style={{ maxWidth:'820px', margin:'0 auto' }}>
              <h2 style={{ fontSize:'26px', marginBottom:'16px', letterSpacing:'-.02em' }}>What is MK AI?</h2>
              <p style={{ fontSize:'15px', lineHeight:1.8, color:T.muted, marginBottom:'14px' }}>
                MK AI is a single platform bringing together 22+ AI-powered tools so you don't have to jump between different apps and subscriptions. Whether you're chatting with an AI assistant, building a presentation, editing a PDF, writing a resume, generating images, or fixing your grammar, MK AI gives you everything in one place, built for speed and simplicity.
              </p>
              <p style={{ fontSize:'15px', lineHeight:1.8, color:T.muted, marginBottom:'14px' }}>
                Students use MK AI's Smart Study tools to organize notes and prepare for exams. Job seekers use ResumeX to build ATS-friendly resumes and cover letters in minutes. Content creators rely on Creator Studio for viral posts, blogs, and scripts, while entrepreneurs use the Entrepreneur Hub to validate and plan their next big idea.
              </p>
              <p style={{ fontSize:'15px', lineHeight:1.8, color:T.muted }}>
                MK AI also includes specialized tools like Data Structurer for cleaning messy data into spreadsheets, Scheme Finder for discovering and applying to Indian government schemes, and Risk Predictor for spotting anomalies in your data. New tools are added regularly, all accessible from a single account, on the web, free to start.
              </p>
            </div>
          </section>
        </main>

        {/* ══ FOOTER ══ */}
        <footer>
          <div className="foot-inner">
            <div style={{ fontWeight:700,color:T.emerald2,fontSize:'15px',display:'flex',alignItems:'center',gap:'8px' }}>
              <span className="foot-brand"><img src="/whitelogo.webp" alt="MK AI logo" /></span>
            </div>
            <div>© 2026 MK AI. support.mkai@gmail.com</div>
            <div className="foot-links">
              <Link to="/about">About Us</Link>
              <Link to="/privacy">Privacy Policy</Link>
            </div>
          </div>
        </footer>
      </div>

      {/* ══ COMING SOON MODAL ══ */}
      {showComingSoon && (
        <div className="cs-overlay" onClick={closeComingSoon}>
          <div className="cs-card" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Download coming soon">
            <button className="cs-close" onClick={closeComingSoon} aria-label="Close">✕</button>
            <div className="cs-badge"><span>⏳</span></div>
            <div className="cs-title">Coming Soon!</div>
            <p className="cs-text">
              The MK AI desktop app is <b>currently in the works</b>. As soon as it's ready, you'll be able to download it right here first — until then, keep using <b>MK AI Chat</b> in your browser.
            </p>
            <div className="cs-actions">
              <button className="cs-btn primary" onClick={() => { closeComingSoon(); navigate('/chat'); }}>Use in Browser</button>
              <button className="cs-btn ghost" onClick={closeComingSoon}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
