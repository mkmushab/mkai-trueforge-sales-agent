#!/usr/bin/env python3
"""
KabirVerse 3D (v5 Mega-Studio) - Episode Producer + 4-Mode Engine + 24x7 Daemon.

4 Production Modes (`--mode`):
  1. `auto_upload`          : AI writes script, selects 1-6 chars (from 1,000), renders video + thumbnail + SEO, and uploads!
  2. `auto_no_upload`       : AI writes script, renders video + high-CTR thumbnail + full description/tags, NO upload.
  3. `custom_script_upload` : You give the script (`--script` or `--script-file`), AI assigns characters/voices/scenes, renders & uploads!
  4. `yt_clone_remix`       : You give a YouTube link (`--youtube-url`) + optional half-script (`--script`), AI clones the video's setup
                              (speaker count, outfits, stage/background, dialogue flow) with our 3D AI characters & AI voices!

Examples:
  python scheduler_24x7.py --now --mode auto_upload
  python scheduler_24x7.py --now --mode auto_no_upload --kind long --format panel_5_6 --background talent_stage
  python scheduler_24x7.py --now --mode custom_script_upload --script "KABIR: Bhai sun! RINKU: Kya hua?"
  python scheduler_24x7.py --now --mode yt_clone_remix --youtube-url https://www.youtube.com/watch?v=XXXX --script "Half script seed..."
  python scheduler_24x7.py --daemon --upload
"""
from __future__ import annotations

import argparse
import asyncio
import datetime as dt
import json
import logging
import random
from logging.handlers import RotatingFileHandler
from pathlib import Path
from typing import List, Optional, Sequence

from agents.backgrounds import BACKGROUNDS
from agents.browser_autopilot import ChromeAutopilot
from agents.cast import cast_for, match_cast_from_youtube_metadata
from agents.clip_cutter import cut_vertical_clips_ffmpeg
from agents.cloud_notebook import export_notebook
from agents.multi_llm_brain import FORMATS, MODES, BrainCouncil
from agents.pro_video_editor import KIND_LAYOUT, ReelRenderer
from agents.voice_and_lipsync import VoiceEngine, ensure_sfx
from agents.youtube_trend_spy import YouTubeTrendSpy
from config import ASSETS_DIR, LOGS_DIR, OUTPUTS_DIR, StudioConfig
from studio_state import StudioState

log = logging.getLogger("studio")


def setup_logging() -> None:
    fmt = logging.Formatter("%(asctime)s %(levelname)-7s %(name)s: %(message)s", "%H:%M:%S")
    root = logging.getLogger()
    root.setLevel(logging.INFO)
    if root.handlers:
        return
    sh = logging.StreamHandler()
    sh.setFormatter(fmt)
    fh = RotatingFileHandler(LOGS_DIR / "studio.log", maxBytes=2_000_000, backupCount=3, encoding="utf-8")
    fh.setFormatter(fmt)
    root.addHandler(sh)
    root.addHandler(fh)


def get_tz(name: str) -> dt.tzinfo:
    try:
        from zoneinfo import ZoneInfo

        return ZoneInfo(name)
    except Exception:
        log.warning("timezone '%s' unavailable (pip install tzdata) - using fixed UTC+05:30", name)
        return dt.timezone(dt.timedelta(hours=5, minutes=30))


async def produce_episode(
    cfg: StudioConfig,
    state: StudioState,
    *,
    kind: str = "short",
    fmt: str = "",
    mode: str = "",
    youtube_url: str = "",
    topic: str = "",
    custom_script: str = "",
    background: str = "",
    cast_size: Optional[int] = None,
    gender_lead: str = "",
    custom_cast_ids: Optional[Sequence[str]] = None,
    cut_clips: Optional[bool] = None,
    render: bool = True,
    upload: Optional[bool] = None,
    demo: bool = False,
) -> Path:
    # Resolve mode & upload behavior
    if not mode:
        if youtube_url and custom_script:
            mode = "yt_clone_remix"
        elif custom_script:
            mode = "custom_script_upload"
        elif upload:
            mode = "auto_upload"
        else:
            mode = "auto_no_upload"
    if mode not in MODES:
        mode = "auto_no_upload"

    if upload is None:
        upload = mode in ("auto_upload", "custom_script_upload")

    ep_dir = OUTPUTS_DIR / f"episode_{dt.datetime.now():%Y%m%d_%H%M%S}_{kind}"
    ep_dir.mkdir(parents=True, exist_ok=True)

    # ---- 1. theme + reference + setup detection
    recent_topics = state.recent("topic")
    pool = [t for t in cfg.autonomous_topics if t not in recent_topics] or cfg.autonomous_topics
    theme = topic or random.choice(pool)
    source = {"theme": theme, "title": theme, "transcript": "", "video_id": "", "detected_setup": {}}

    if youtube_url:
        try:
            inspected = await asyncio.to_thread(YouTubeTrendSpy().inspect_url, youtube_url, cfg.character_name)
            source.update(inspected)
            if not topic and inspected.get("title"):
                theme = inspected["title"]
                source["theme"] = theme
        except Exception as exc:
            log.warning("YouTube URL inspection failed (%s) - using offline metadata matcher", exc)
            m_cast, m_fmt, m_bg = match_cast_from_youtube_metadata(youtube_url, topic, custom_script, cfg.character_name, cast_size)
            source["detected_setup"] = {
                "recommended_format": m_fmt,
                "recommended_background": m_bg,
                "recommended_cast_ids": [c.id for c in m_cast],
            }
    elif not topic and not demo and mode in ("auto_upload", "auto_no_upload"):
        ref = await asyncio.to_thread(YouTubeTrendSpy().search_reference, random.choice(cfg.trend_queries), state.recent("video_id", 60))
        source.update(ref)

    det = source.get("detected_setup") or {}
    if mode == "yt_clone_remix" and not fmt and det.get("recommended_format"):
        fmt = det["recommended_format"]
    fmt = fmt if fmt in FORMATS else cfg.format_for(kind)

    if mode == "yt_clone_remix" and not custom_cast_ids and det.get("recommended_cast_ids"):
        custom_cast_ids = det["recommended_cast_ids"]
    if not background or background == "auto":
        background = det.get("recommended_background") or (cfg.default_background if cfg.default_background in BACKGROUNDS else "")

    cast = cast_for(
        fmt,
        kind,
        cfg.character_name,
        cast_size=cast_size,
        gender_lead=gender_lead,
        custom_ids=custom_cast_ids,
    )
    if len(cast) > 1 and fmt == "solo":
        fmt = "dialogue"

    log.info(
        "[%s/%s/mode=%s] theme: %s | cast (%d): %s | bg: %s | ref: %s",
        kind, fmt, mode, theme, len(cast), ", ".join(c.tag for c in cast),
        background or "auto", source.get("title") or "none",
    )

    # ---- 2. council -> plan
    plan = await asyncio.to_thread(
        BrainCouncil(cfg).create_episode,
        source,
        state.recent("title"),
        demo,
        kind,
        fmt,
        cast,
        mode,
        custom_script,
        background,
    )
    plan["topic"] = theme
    plan["mode"] = mode
    (ep_dir / "production_plan.json").write_text(json.dumps(plan, indent=2, ensure_ascii=False), encoding="utf-8")
    export_notebook(plan, ep_dir / "kaggle_colab_3d_lipsync_engine.ipynb")
    log.info("[%s] plan saved: %s (%d scenes, bg=%s)", kind, plan["video_title"], len(plan["scenes"]), plan.get("background"))

    video = ep_dir / ("final_3d_reel.mp4" if kind == "short" else "final_long_video.mp4")
    cut_clips_paths: List[Path] = []
    if render:
        # ---- 3. voice (speed auto-tuned so Shorts land in 20-25 s and the long video in 2:00-2:30) + sfx
        target = cfg.short_target_sec if kind == "short" else cfg.long_target_sec
        engine = VoiceEngine(cfg.tts_voice, cfg.tts_rate, cfg.tts_pitch)
        if fmt == "solo" and len(cast) == 1:
            lead = cast[0]
            engine = VoiceEngine(lead.voice, f"{lead.rate:+d}%", f"{lead.pitch:+d}Hz")
            voice = await engine.synthesize_fit(plan["full_voiceover_script"], ep_dir, target, demo=demo)
        else:  # every character speaks with its own voice
            voice = await engine.synthesize_dialogue(plan["scenes"], {c.id: c for c in cast}, ep_dir, target, demo=demo)
        log.info("[%s/%s] voiceover %.1fs (target %d-%ds)", kind, fmt, voice["duration"], *target)
        (ep_dir / "words.json").write_text(
            json.dumps(
                {
                    "audio": Path(voice["audio_path"]).name,
                    "duration": voice["duration"],
                    "words": voice["words"],
                    "scene_windows": voice.get("scene_windows"),
                    "bleeps": voice.get("bleeps", []),
                },
                ensure_ascii=False,
            ),
            encoding="utf-8",
        )
        sfx = ensure_sfx(ASSETS_DIR / "sfx")
        # ---- 4. render (vertical for shorts, 16:9 for the long video)
        renderer = ReelRenderer(ASSETS_DIR, cfg.watermark_text, KIND_LAYOUT[kind], cfg.character_name)
        await asyncio.to_thread(renderer.render, plan, voice, sfx, video)

        # ---- 4b. auto-cut vertical 9:16 Shorts/Reels from long 16:9 video!
        should_cut = cfg.auto_cut_shorts_from_long if cut_clips is None else cut_clips
        if kind == "long" and should_cut:
            cut_clips_paths = await asyncio.to_thread(cut_vertical_clips_ffmpeg, video, ep_dir, plan, voice, 2)

    clips_note = (
        "\nAUTO-CUT VERTICAL SHORTS:\n" + "\n".join(str(p.name) for p in cut_clips_paths) + "\n"
        if cut_clips_paths
        else ""
    )
    (ep_dir / "post_info.txt").write_text(
        f"MODE: {mode} | KIND: {kind} | FORMAT: {fmt} | BACKGROUND: {plan.get('background')}\n"
        f"CAST ({len(cast)}): {', '.join(f'{c.tag} ({c.gender}/{c.look.outfit_style})' for c in cast)}\n\n"
        f"TITLE:\n{plan['video_title']}\n\n"
        f"THUMBNAIL TEXT:\n{plan.get('thumbnail_text', '')}\n\n"
        f"YOUTUBE DESCRIPTION:\n{plan['youtube_description']}\n\n"
        f"INSTAGRAM CAPTION:\n{plan['instagram_caption']}\n\n"
        f"TAGS: {', '.join(plan['youtube_tags'])}\n"
        f"{clips_note}",
        encoding="utf-8",
    )
    state.add_history(theme, plan["video_title"], source.get("video_id", ""))

    # ---- 5. upload: shorts -> YouTube + Instagram Reels ; long video -> YouTube only
    if upload and render:
        results = await ChromeAutopilot(cfg).upload(video, plan, ep_dir, youtube=True, instagram=(kind == "short"), kind=kind)
        (ep_dir / "upload_result.json").write_text(json.dumps(results, indent=2), encoding="utf-8")
    log.info("[%s] episode ready: %s", kind, ep_dir)
    return ep_dir


async def run_daemon(cfg: StudioConfig, state: StudioState, upload: bool, demo: bool) -> None:
    tz = get_tz(cfg.timezone)
    plan_txt = ", ".join(f"{k}@{t}" for k, t in cfg.daily_plan())
    log.info(
        "daemon started | %s (%s) | grace %d min | publish YT=%s IG=%s",
        plan_txt, cfg.timezone, cfg.grace_minutes, cfg.publish_youtube, cfg.publish_instagram,
    )
    while True:
        now = dt.datetime.now(tz)
        today = now.date().isoformat()
        for kind, slot in cfg.daily_plan():
            key = f"{kind}@{slot}"
            hh, mm = map(int, slot.split(":"))
            late = (now - now.replace(hour=hh, minute=mm, second=0, microsecond=0)).total_seconds()
            if 0 <= late <= cfg.grace_minutes * 60 and not state.slot_done(today, key):
                state.mark_slot_done(today, key)  # mark first: a crash must never cause a double-post loop
                log.info("slot %s triggered", key)
                for attempt in range(1, cfg.max_retries + 1):
                    try:
                        await produce_episode(cfg, state, kind=kind, upload=upload, demo=demo)
                        break
                    except Exception:
                        log.exception("slot %s attempt %d/%d failed", key, attempt, cfg.max_retries)
                        await asyncio.sleep(90)
        await asyncio.sleep(30)


def main() -> None:
    ap = argparse.ArgumentParser(description="KabirVerse 3D v5 Mega-Studio")
    ap.add_argument("--now", action="store_true", help="produce one episode now")
    ap.add_argument("--kind", choices=["short", "long"], default="short", help="short = Short/Reel (20-25 s), long = daily YouTube video (2:00-2:30)")
    ap.add_argument("--mode", choices=list(MODES), default="", help="1: auto_upload | 2: auto_no_upload | 3: custom_script_upload | 4: yt_clone_remix")
    ap.add_argument("--daemon", action="store_true", help="run the daily schedule forever")
    ap.add_argument("--upload", "--upload-browser", dest="upload", action="store_true", default=None, help="drive your Chrome (CDP) to upload")
    ap.add_argument("--no-upload", dest="no_upload", action="store_true", help="force skip upload even in upload modes")
    ap.add_argument("--format", dest="fmt", choices=list(FORMATS), default="", help="solo | dialogue | talent_roast | panel_5_6 | couple_roast")
    ap.add_argument("--background", choices=["auto", *BACKGROUNDS], default="auto", help="scene environment (talent_stage, jungle, home_room, etc.)")
    ap.add_argument("--cast-size", type=int, default=None, help="number of characters in video (1 to 6)")
    ap.add_argument("--gender-lead", choices=["", "M", "F", "RANDOM"], default="", help="lead character gender (M, F, or RANDOM)")
    ap.add_argument("--script", default="", help="custom full script (Mode 3) or half-script seed (Mode 4)")
    ap.add_argument("--script-file", default="", help="path to text file containing custom script or half-script")
    ap.add_argument("--demo", action="store_true", help="offline: canned script, placeholder voice if TTS unreachable")
    ap.add_argument("--no-video", action="store_true", help="plan + notebook only, skip rendering")
    ap.add_argument("--no-clips", action="store_true", help="skip auto-cutting vertical shorts from a long video")
    ap.add_argument("--topic", default="", help="custom theme")
    ap.add_argument("--youtube-url", default="", help="reference video URL (or target video to clone in Mode 4)")
    args = ap.parse_args()

    setup_logging()
    cfg, state = StudioConfig(), StudioState()
    custom_script = args.script
    if args.script_file and Path(args.script_file).exists():
        custom_script = Path(args.script_file).read_text(encoding="utf-8")

    upload_flag: Optional[bool] = False if args.no_upload else (True if args.upload else None)

    try:
        if args.daemon:
            asyncio.run(run_daemon(cfg, state, bool(upload_flag), args.demo))
        elif args.now:
            asyncio.run(
                produce_episode(
                    cfg,
                    state,
                    kind=args.kind,
                    fmt=args.fmt,
                    mode=args.mode,
                    youtube_url=args.youtube_url,
                    topic=args.topic,
                    custom_script=custom_script,
                    background=args.background,
                    cast_size=args.cast_size,
                    gender_lead=args.gender_lead,
                    cut_clips=False if args.no_clips else None,
                    render=not args.no_video,
                    upload=upload_flag,
                    demo=args.demo,
                )
            )
        else:
            ap.print_help()
    except KeyboardInterrupt:
        log.info("stopped by user")


if __name__ == "__main__":
    main()
