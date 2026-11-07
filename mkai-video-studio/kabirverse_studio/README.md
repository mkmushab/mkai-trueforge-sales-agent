# MkVerse 3D — Autonomous AI Influencer Studio (v5 Mega-Edition)

**Ab isme kya-kya naya hai (v5 Mega Upgrade):**
1. **1,000 Unique AI Characters Pool (`agents/cast.py` + `agents/avatar_art.py`)**:
   - Sirf 1 ya 4 character nahi — ab **1,000 alag-alag original characters** (Ladke, Ladkiyan, Judges, Mummy, Uncle, Dada, Gym Bro, Startup Founder, College Students, Podcast Host, Gamers) hain!
   - Har video mein **kabhi 1 (Solo Male/Female)**, **kabhi 2 (Boy + Girl Couple Roast)**, **kabhi 3–4 (Dialogue / India's Got Latent Style Panel)**, aur **kabhi 5–6 characters (`panel_5_6`)** ek saath aate hain!
   - Har character ki apni **alag AI voice (Madhur, Swara, Prabhat, Neerja + custom Pitch & Speed)**, alag kapde (`hoodie`, `saree`, `blazer`, `kurta`, `leather_jacket`, `gym_vest`, `tshirt`, `shirt`), aur alag lip-sync hai.
2. **10 Dynamic Scene Backgrounds & Stage Setups (`agents/backgrounds.py`)**:
   - Ab ek hi static background nahi dikhega! Scene aur topic ke hisaab se background khud badalta hai:
     - `talent_stage` — **India's Got Latent / Roast Panel setup** (Red curtains, brick & neon wall, spotlights, judge desk ke upar **Red Buzzers**, aur contestant ka standing mic!)
     - `jungle` — **Wild Jungle / Safari setup** (Ped, vines, fireflies, bushes)
     - `home_room` — **Desi Ghar ka Kamra** (Upar chhat ka pankha/fan, khidki, photo frame)
     - `podcast_studio` — **Dark Viral Podcast Studio** (Acoustic foam, neon lights, ON AIR sign, podcast boom mics)
     - `street_chai` — **Desi Chai Tapri / Night Street** (Building skyline, tapri string lights)
     - `college_canteen` — **College Classroom / Canteen** ("75% ATTENDANCE COMPULSORY" board)
     - `office_boardroom` — **Corporate / Shark Boardroom** (KPI bar chart screen, glass windows)
     - `gym` — **Fitness Gym** ("NO EXCUSES • LIGHTWEIGHT BABY" neon)
     - `news_room` — **Breaking News Studio**
     - `cyber_studio` — **RGB Creator Studio**
3. **10 Copyright-Free Viral Meme Templates (`agents/meme_cards.py`)**:
   - Built-in viral meme pop-up cards jinpe **kabhi copyright claim nahi aayega**:
     `expectation_reality`, `nobody_me`, `stamp`, `breaking_news`, `red_buzzer`, `scorecard`, `brain_levels`, `chat_bubble`, `viral_tweet`, `vs_battle` + `assets/memes/` mein 6 pre-built Desi viral meme PNGs (`khatam_tata_bye.png`, `emotional_damage.png`, `paisa_barbaad.png`, etc.).
4. **Auto Clip Cutter (`agents/clip_cutter.py`)**:
   - Jab bhi badi 16:9 YouTube video (`final_long_video.mp4`) banegi, AI khud uske sabse best punchlines dhoondh ke **9:16 vertical Shorts/Reels (`viral_shorts_clips/viral_short_clip_01.mp4`, `02.mp4`)** automatically kaat dega!
5. **4-Mode Production + Local Web Studio UI (`web_studio.py`)**:
   - Ab aapke paas **Web Dashboard (`http://localhost:8765`)** aur CLI dono mein **4 Options (Modes)** hain:
     - **Option 1 (`auto_upload`)**: AI khud trend dhoondhe, khud script likhe, video + thumbnail + captions banaye aur khud YouTube/Instagram pe upload kare.
     - **Option 2 (`auto_no_upload`)**: AI khud script likhe, full video + high-CTR thumbnail + full YouTube description & Instagram caption bana ke folder mein de, par upload na kare.
     - **Option 3 (`custom_script_upload`)**: Aap khud full script do (`--script` ya Web UI mein paste karo), AI uss par characters, lip-sync, backgrounds, memes, thumbnail lagaye aur upload kare.
     - **Option 4 (`yt_clone_remix`)**: Aap koi **YouTube video link** do + apni **half-script/notes** do — AI uss video ka setup (kitne log hain, kaise kapde hain, stage/room kaisa hai, dialogue ka flow kaisa hai) inspect karke humare 3D AI characters aur AI voice mein **100% copyright-safe remake** bana dega!

---

## Apna Purana `.venv` aur `.env` Kaise Lagayein (Zero Re-install!)
1. Iss folder (`kabirverse_studio`) ko extract karo.
2. Apna pehle wala **`.venv`** folder aur **`.env`** file seedha iss folder ke andar copy-paste kar do (humne koi naya heavy package add nahi kiya hai, sab aapke existing `.venv` mein chalega!).
3. Test karne ke liye:
   - `doctor_windows.bat` (check karega ki `.venv` aur `.env` sahi hain)
   - **Web Studio UI kholne ke liye:** `run_web_studio_windows.bat` (Browser mein `http://localhost:8765` khul jayega!)

---

## Commands Cheat Sheet (Windows & CLI)

| Kaam | Command |
|---|---|
| **Web Studio Dashboard kholo (4 Modes UI)** | `run_web_studio_windows.bat` (ya `python web_studio.py`) |
| **Option 1**: Full Auto (Script + Video + Upload) | `python scheduler_24x7.py --now --mode auto_upload` |
| **Option 2**: Full Auto (Script + Video + Thumbnail + Description, NO Upload) | `python scheduler_24x7.py --now --mode auto_no_upload` |
| **Option 3**: Aapki Script -> Full Video + Upload | `python scheduler_24x7.py --now --mode custom_script_upload --script "KABIR: Bhai sun! RINKU: Kya hua?"` |
| **Option 4**: YouTube Link + Half Script -> AI Setup Clone | `python scheduler_24x7.py --now --mode yt_clone_remix --youtube-url "https://www.youtube.com/watch?v=XXXX" --script "Half script idea..."` |
| **India's Got Latent Setup (5-6 Characters + Stage)** | `python scheduler_24x7.py --now --kind long --format panel_5_6 --background talent_stage --cast-size 6` |
| **Jungle / Ghar / Podcast Background Force Karo** | `python scheduler_24x7.py --now --background jungle --cast-size 4` |
| **Boy + Girl Trend Reel (Kabir + Riya)** | `python scheduler_24x7.py --now --format couple_roast` |
| **Female Lead Reel (Ladki wala character)** | `python scheduler_24x7.py --now --gender-lead F` |
| **24x7 Autopilot Daemon (3 Shorts + 1 Long + Auto Clips)** | `run_daemon_windows.bat` |
