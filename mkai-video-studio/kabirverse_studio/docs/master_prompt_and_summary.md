# 🚀 KabirVerse 3D — Autonomous AI Influencer Project Summary & Master AI Prompts

## 1. Idea Summary (Kisi Insaan / Dost / Developer Ko Samjhane Ke Liye)

### A. Hinglish Pitch (30-Second Explanation)
> **"Main ek 100% Autonomous 3D AI Virtual Influencer ('KabirVerse 3D') bana raha hu jo bina kisi paid tool ya महंगे GPU ke khud YouTube Shorts aur Instagram Reels chalaata hai.**
>
> **Ye system kaise kaam karta hai:**
> 1. **Trend Spy:** Mera Python agent roz YouTube se trending videos aur viral topics ka transcript nikaalta hai ([yt-dlp](https://github.com/yt-dlp/yt-dlp) + [youtube-transcript-api](https://github.com/jdepoix/youtube-transcript-api)).
> 2. **3-LLM Brain Council:** Mere paas 3 open-weights models hain—`DeepSeek V3.2` uss topic par 10x funnier Hinglish roast/comedy script likhta hai, `gpt-oss-120b` har line ke liye 3D character expressions, lip-sync cues aur meme cuts decide karta hai, aur `Gemma 4 31B-IT` viral titles aur hashtags banata hai.
> 3. **Voice & 3D Lip-Sync Video Engine:** [edge-tts](https://github.com/rany2/edge-tts) se natural Hinglish voiceover banta hai, aur [MoviePy](https://github.com/zulko/moviepy) + Kaggle/Colab ke free GPUs ([Wan2.2](https://github.com/Wan-Video/Wan2.2), [LivePortrait](https://github.com/KlingAIResearch/LivePortrait), [MuseTalk](https://github.com/TMElyralab/MuseTalk)) se mera 3D Pixar-style character exact audio par lip-sync karta hai, upar meme banner aur niche pop-up captions lagte hain.
> 4. **Laptop Browser Autopilot (3x Daily Upload):** Agent mere hi laptop ke khule hue Chrome browser ([Playwright Python](https://playwright.dev/python/docs/api/class-browsertype) port `9222`) ko control karke roz 3 baar (Subah 11 baje, Shaam 5 baje, Raat 9:30 baje) YouTube Studio aur Instagram par video upload kar deta hai."

### B. Crisp English Executive Summary
**Project Name:** KabirVerse 3D — Zero-Cost Autonomous 3D AI Influencer Studio  
**Goal:** Build a self-driving virtual influencer pipeline that researches trending topics, writes Hinglish comedy scripts, renders 1080x1920 3D lip-synced Reels/Shorts with meme overlays and sound effects, and publishes **3 videos per day** to YouTube Shorts and Instagram Reels using a local laptop Chrome browser plus free Kaggle/Google Colab GPUs.

| Layer | Responsibility | Stack / Resources Used |
| :--- | :--- | :--- |
| **1. Trend & Reference Spy** | Scrapes viral YouTube Shorts & transcripts to remix into original comedy | [yt-dlp](https://github.com/yt-dlp/yt-dlp), [youtube-transcript-api](https://github.com/jdepoix/youtube-transcript-api) |
| **2. 3-Model Brain Council** | Scriptwriting, 3D scene choreography, and SEO titles/hashtags | `DeepSeek V3.2`, `gpt-oss-120b`, `Gemma 4 31B-IT` via GeneralCompute API + Chrome Gemini Web |
| **3. Voice & SFX Synthesizer** | Energetic Hinglish neural TTS + word timestamps + procedural WAV SFX | [edge-tts](https://github.com/rany2/edge-tts) (`hi-IN-MadhurNeural`), NumPy WAV synth |
| **4. 3D Avatar & Meme Editor** | Audio-envelope viseme lip-sync, neural 3D portrait animation & captions | [MoviePy](https://github.com/zulko/moviepy), [Wan2.2](https://github.com/Wan-Video/Wan2.2), [LivePortrait](https://github.com/KlingAIResearch/LivePortrait), [MuseTalk](https://github.com/TMElyralab/MuseTalk) on Kaggle (2x T4 30GB) / Colab (T4 16GB) |
| **5. Browser Autopilot & Daemon** | Controls existing logged-in Chrome session to upload 3 videos/day | [Playwright Python](https://playwright.dev/python/docs/api/class-browsertype) (`connect_over_cdp` on `localhost:9222`), [browser-use](https://github.com/browser-use/browser-use) |

## 2. Master Prompt (Dusre AI — Claude / ChatGPT / Cursor / Windsurf Ko Dene Ke Liye)

Neeche wala box seedha copy karke kisi bhi AI mein paste kar de—usko tere poore project, hardware limits, aur APIs ki 100% samajh ek baar mein aa jayegi:

```text
You are the Lead AI Systems Architect for my project: "KabirVerse 3D — Autonomous 3D AI Virtual Influencer Studio".

### 1. PROJECT GOAL
I am building a 100% free/open-source, end-to-end autonomous AI Influencer pipeline that creates and publishes 3 viral short-form videos every day (11:00 AM, 05:00 PM, and 09:30 PM IST) to both YouTube Shorts and Instagram Reels.

The AI Influencer is a recurring 3D Pixar/DreamWorks-style Indian Gen-Z character ("Kabir 3D" / "@kabirverse.3d") who speaks energetic Hinglish (Hindi written in Latin script mixed with witty English). He watches trending YouTube videos/topics and turns them into 10x funnier, original 45-second comedy roasts with synchronized lip movement, expressive reactions, meme headers, Hormozi-style pop-up subtitles, and sound effects (Vine Boom, Whoosh, Laugh Track).

### 2. STRICT HARDWARE & RESOURCE CONSTRAINTS (DO NOT SUGGEST PAID SAAS)
- Local Machine: Standard laptop WITHOUT a dedicated heavy GPU.
- Browser Automation: The agent must control my ALREADY LOGGED-IN local Chrome browser via Chrome DevTools Protocol (`--remote-debugging-port=9222` using Playwright `connect_over_cdp` or `browser-use`). It can use my logged-in Gemini Web (`https://gemini.google.com/app`), YouTube Studio (`https://studio.youtube.com`), Instagram Web (`https://www.instagram.com`), Kaggle, and Google Colab tabs directly.
- Cloud GPU (Free Tiers Only):
  1. Kaggle Notebooks (Dual T4 GPUs = 30GB VRAM, 30 hrs/week free)
  2. Google Colab (Single T4 GPU = 16GB VRAM free)
- LLM APIs Available (OpenAI-compatible endpoint `https://api.generalcompute.com/v1`):
  1. `DeepSeek V3.2` -> Role: Chief Hinglish Savage Comedy & Roast Scriptwriter
  2. `gpt-oss-120b` -> Role: 3D Scene Director, Lip-Sync Emotion & Meme Cut Choreographer (outputs strict JSON)
  3. `Gemma 4 31B-IT` -> Role: Viral YouTube Shorts & Instagram Reels SEO Title, Caption & Hashtag Optimizer

### 3. SYSTEM ARCHITECTURE (5 AGENTS)
1. `YouTubeTrendSpy`: Uses `yt-dlp` and `youtube-transcript-api` to fetch trending YouTube Shorts/videos and extract their hooks and transcripts.
2. `MultiLLMBrainAgent`: Chains `DeepSeek V3.2` -> `gpt-oss-120b` -> `Gemma 4 31B-IT` (with automatic fallback to Chrome Gemini Web) to transform the reference transcript into a structured `production_plan.json` containing `video_title`, `instagram_caption`, `full_voiceover_script`, and scene-by-scene `spoken_line`, `character_expression`, `wan22_3d_prompt`, `meme_banner`, and `sfx`.
3. `VoiceAndSFXEngine`: Uses `edge-tts` (`hi-IN-MadhurNeural`, rate `+12%`, pitch `+2Hz`) to synthesize natural Hinglish audio (`voiceover.mp3`), extract word-boundary subtitle timings (`.srt`), and synthesize procedural WAV sound effects (`vine_boom.wav`, `whoosh.wav`).
4. `ProVideoEditor` + `Cloud3DEngine`:
   - Local Fast Mode: Computes the 50Hz RMS audio amplitude envelope of `voiceover.mp3` to drive real-time viseme mouth opening/closing, blinking eyes, character bounce, top yellow meme header, and highlighted pop-up subtitles into a 1080x1920 9:16 `.mp4` via `MoviePy`, `Pillow`, and `OpenCV`.
   - Cloud Heavy 3D Mode: Exports and runs a Kaggle/Colab notebook chaining `Wan2.2` (3D motion generation) + `LivePortrait` / `MuseTalk` (real-time lip-sync on the 3D character render) + `MoviePy` meme compositing.
5. `ChromeBrowserAutopilot` & `Scheduler24x7`: Runs a continuous daemon that triggers at 11:00, 17:00, and 21:30 IST, generates the episode, attaches `final_3d_reel.mp4` to YouTube Studio and Instagram Web via Playwright CDP on port 9222, fills in the title/caption/hashtags, and publishes.

### 4. HOW I WANT YOU TO HELP ME NOW
Keep all solutions strictly compatible with my zero-cost stack above (Python, Playwright CDP port 9222, Edge-TTS, MoviePy, Kaggle/Colab T4 GPUs, and my 3 GeneralCompute LLM models). Acknowledge that you understand this architecture and wait for my specific task or code request.
```

## 3. Bonus: Direct Script-Generation Prompt (Agar Kisi Bhi AI Se Turant Viral Episode Likhवाना Ho)

Agar tu kabhi seedha Gemini, ChatGPT, ya DeepSeek ki website par jaakar apne 3D Influencer ke liye **ek naya viral episode** likhwana chahe, toh ye छोटा prompt paste kar dena:

```text
Act as the comedy writer for my 3D Hinglish AI Influencer "Kabir 3D" (@kabirverse.3d).
Topic / Reference Idea: [YAHAN TOPIC YA YOUTUBE LINK DAAL]

Write a 45-second high-energy Hinglish roast script (Hindi in Roman script + punchy English).
- First 3 seconds must be a scroll-stopping relatable Desi hook.
- Break it into 5 scenes (8–9 seconds each).
- For every scene, give me:
  1. Spoken Hinglish Line
  2. 3D Character Expression & Action Prompt (for Wan2.2 / LivePortrait)
  3. Top Yellow Meme Banner Text (max 6 words)
  4. Sound Effect Cue (Vine Boom / Laugh Track / Whoosh / Record Scratch)
- At the end, give me a viral YouTube Short Title (<55 chars) and an Instagram Reel Caption with 10 hashtags.
```
