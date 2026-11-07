"""
Auto Viral Clip Cutter (v5 Mega-Feature).

Takes a long-form episode (16:9 `final_long_video.mp4` + `production_plan.json` + `words.json`)
and automatically extracts 1 to 3 high-retention vertical 9:16 Shorts/Reels (`1080x1920`)
around the best punchlines (`vine_boom`, `record_scratch`, `laugh_punch`, or meme card moments),
or re-renders selected scene slices in native 9:16 vertical layout so captions, characters,
and banners fit mobile screens cleanly!
"""
from __future__ import annotations

import json
import logging
import subprocess
from pathlib import Path
from typing import Any, Dict, List, Tuple

log = logging.getLogger("studio.clipper")


def select_highlight_windows(
    plan: Dict[str, Any],
    scene_windows: List[Tuple[float, float]],
    total_duration: float,
    max_clips: int = 2,
    clip_target_sec: Tuple[float, float] = (18.0, 26.0),
) -> List[Dict[str, Any]]:
    """
    Pick up to `max_clips` non-overlapping highlight segments of 18-26s from a long episode.
    Scores scenes based on punchline SFX (`vine_boom`, `record_scratch`, `laugh_punch`),
    meme cards, and BEEP moments.
    """
    scenes = plan.get("scenes") or []
    if not scenes or not scene_windows or len(scenes) != len(scene_windows):
        # Fallback: simple time slices
        clips = []
        t = 0.0
        idx = 1
        while t + 15.0 <= total_duration and len(clips) < max_clips:
            end = min(total_duration, t + 22.0)
            clips.append({
                "clip_index": idx,
                "start": round(t, 2),
                "end": round(end, 2),
                "scene_indices": list(range(len(scenes))),
                "title": f"{plan.get('video_title', 'Highlight')} #Pt{idx}",
            })
            t += 28.0
            idx += 1
        return clips

    lo, hi = clip_target_sec
    n = len(scenes)
    candidates: List[Tuple[float, int, int, float, float]] = []

    for i in range(n):
        s0 = scene_windows[i][0]
        score = 0.0
        for j in range(i, n):
            s1 = scene_windows[j][1]
            dur = s1 - s0
            sc = scenes[j]
            if sc.get("sfx") in ("vine_boom", "record_scratch", "laugh_punch"):
                score += 3.0
            if sc.get("meme_card") or sc.get("meme_asset"):
                score += 2.5
            if "BEEP" in str(sc.get("spoken_line", "")):
                score += 2.0
            if sc.get("character_expression") in ("shocked", "angry_roast"):
                score += 1.0
            if lo <= dur <= hi:
                candidates.append((score, i, j, s0, s1))
            elif dur > hi and j == i:
                # Single long scene
                candidates.append((score, i, j, s0, min(s1, s0 + hi)))
                break

    if not candidates:
        # Group consecutive scenes into ~22s chunks
        s0 = scene_windows[0][0]
        s1 = min(total_duration, s0 + 22.0)
        return [{
            "clip_index": 1,
            "start": round(s0, 2),
            "end": round(s1, 2),
            "scene_indices": list(range(min(4, n))),
            "title": f"{plan.get('video_title', 'Viral Clip')} - Highlight #1",
        }]

    candidates.sort(key=lambda x: x[0], reverse=True)
    picked: List[Dict[str, Any]] = []
    used_ranges: List[Tuple[float, float]] = []

    for score, i, j, s0, s1 in candidates:
        if any(not (s1 <= a or s0 >= b) for a, b in used_ranges):
            continue
        used_ranges.append((s0, s1))
        idx = len(picked) + 1
        banner = scenes[i].get("meme_banner") or scenes[j].get("meme_banner") or f"Highlight #{idx}"
        picked.append({
            "clip_index": idx,
            "start": round(s0, 2),
            "end": round(s1, 2),
            "duration": round(s1 - s0, 2),
            "score": score,
            "scene_indices": list(range(i, j + 1)),
            "title": f"{plan.get('video_title', 'Clip')[:38]} | {banner.title()}",
        })
        if len(picked) >= max_clips:
            break

    return sorted(picked, key=lambda c: c["start"])


def cut_vertical_clips_ffmpeg(
    long_mp4: Path,
    ep_dir: Path,
    plan: Dict[str, Any],
    voice: Dict[str, Any],
    max_clips: int = 2,
) -> List[Path]:
    """
    Fast FFmpeg Smart-Crop + Blurred-BG Vertical 9:16 Cutter (`1080x1920`).
    Extracts highlight windows from `long_mp4` and converts 16:9 -> 9:16 with
    a blurred background canvas + centered sharp action frame so nothing is cut off!
    """
    import imageio_ffmpeg

    if not long_mp4.exists():
        return []

    windows = [tuple(w) for w in (voice.get("scene_windows") or [])]
    duration = float(voice.get("duration") or 60.0)
    highlights = select_highlight_windows(plan, windows, duration, max_clips=max_clips)

    clips_dir = ep_dir / "viral_shorts_clips"
    clips_dir.mkdir(parents=True, exist_ok=True)
    ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
    out_paths: List[Path] = []

    for hl in highlights:
        idx = hl["clip_index"]
        out_mp4 = clips_dir / f"viral_short_clip_{idx:02d}.mp4"
        start = hl["start"]
        dur = max(5.0, hl["end"] - hl["start"])

        # Convert 1920x1080 -> 1080x1920 with blurred dark background + zoomed center subject
        vf = (
            "split[bg][fg];"
            "[bg]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=24:4,eq=brightness=-0.18[bg2];"
            "[fg]scale=1080:-2[fg2];"
            "[bg2][fg2]overlay=(W-w)/2:(H-h)/2"
        )
        cmd = [
            ffmpeg_exe, "-y", "-v", "error",
            "-ss", f"{start:.2f}",
            "-t", f"{dur:.2f}",
            "-i", str(long_mp4),
            "-vf", vf,
            "-c:v", "libx264", "-preset", "fast", "-crf", "21",
            "-c:a", "aac",
            "-movflags", "+faststart",
            str(out_mp4),
        ]
        try:
            subprocess.run(cmd, check=True, capture_output=True)
            meta_file = clips_dir / f"viral_short_clip_{idx:02d}_info.json"
            meta_file.write_text(json.dumps(hl, indent=2, ensure_ascii=False), encoding="utf-8")
            out_paths.append(out_mp4)
            log.info("auto-cut viral short #%d (%.1fs - %.1fs) -> %s", idx, start, hl["end"], out_mp4)
        except Exception as exc:
            log.warning("failed to cut clip #%d: %s", idx, exc)

    return out_paths
