"""
Trend Spy & YouTube Scene Analyzer (v5 Mega-Spy).

1. `search_reference(query)` -> finds a trending reference Short/video for a theme.
2. `inspect_url(url)` -> pulls title, description, tags, duration, transcript, and analyzes
   the visual/cast setup (estimated number of speakers, setting/background, outfits, and dialogue beats)
   so Mode 4 (`yt_clone_remix`) can recreate the exact vibe & setup with our 1,000 AI characters
   and 100% original AI voices (zero copyrighted audio!).
"""
from __future__ import annotations

import json
import logging
import random
import re
import subprocess
import sys
from typing import Any, Dict, Iterable

from agents.cast import match_cast_from_youtube_metadata

log = logging.getLogger("studio.spy")
_ID = re.compile(r"(?:v=|/shorts/|youtu\.be/)([A-Za-z0-9_-]{11})")


class YouTubeTrendSpy:
    @staticmethod
    def extract_video_id(url: str) -> str:
        m = _ID.search(url)
        if not m:
            raise ValueError(f"Invalid YouTube URL: {url}")
        return m.group(1)

    @staticmethod
    def _yt_dlp(args: list, timeout: int) -> str:
        # `python -m yt_dlp` works even when the yt-dlp script is not on PATH
        cmd = [sys.executable, "-m", "yt_dlp", "--no-warnings", *args]
        res = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
        if res.returncode != 0:
            raise RuntimeError((res.stderr or "yt-dlp failed")[-300:])
        return res.stdout

    def search_reference(self, query: str, avoid_ids: Iterable[str] = ()) -> Dict[str, Any]:
        """Returns {} when nothing usable is found (caller then writes from the theme alone)."""
        avoid = set(avoid_ids)
        try:
            out = self._yt_dlp([f"ytsearch6:{query}", "--flat-playlist", "--dump-json", "--skip-download"], 60)
            entries = [json.loads(l) for l in out.splitlines() if l.startswith("{")]
            entries = [e for e in entries if e.get("id") and e["id"] not in avoid]
            if not entries:
                return {}
            pick = random.choice(entries[:4])
            return self.inspect_url(f"https://www.youtube.com/watch?v={pick['id']}")
        except Exception as exc:  # network, yt-dlp breakage, etc.
            log.warning("trend search failed (%s) - continuing without reference", exc)
            return {}

    def inspect_url(self, url: str, hero_name: str = "Kabir 3D") -> Dict[str, Any]:
        vid = self.extract_video_id(url)
        info: Dict[str, Any] = {
            "video_id": vid,
            "url": url,
            "title": "",
            "description": "",
            "transcript": "",
            "channel": "",
            "duration": 0,
            "detected_setup": {},
        }
        try:
            meta = json.loads(self._yt_dlp(["--dump-single-json", "--skip-download", url], 60))
            info["title"] = meta.get("title", "") or ""
            info["description"] = (meta.get("description") or "")[:800]
            info["channel"] = meta.get("uploader") or meta.get("channel") or ""
            info["duration"] = int(meta.get("duration") or 0)
        except Exception as exc:
            log.warning("metadata fetch failed: %s", exc)
        info["transcript"] = self._transcript(vid) or f"{info['title']} {info['description']}".strip()

        # Analyze setup (cast count, outfits, format, environment) for Mode 4 AI Clone
        matched_cast, matched_fmt, matched_bg = match_cast_from_youtube_metadata(
            info["title"], info["description"], info["transcript"], hero_name=hero_name
        )
        info["detected_setup"] = {
            "recommended_format": matched_fmt,
            "recommended_background": matched_bg,
            "estimated_speakers": len(matched_cast),
            "recommended_cast_ids": [c.id for c in matched_cast],
            "recommended_cast_summary": [
                {"id": c.id, "name": c.name, "gender": c.gender, "outfit": c.look.outfit_style, "archetype": c.archetype}
                for c in matched_cast
            ],
        }
        return info

    @staticmethod
    def _transcript(video_id: str) -> str:
        try:
            from youtube_transcript_api import YouTubeTranscriptApi

            langs = ["hi", "en", "en-IN"]
            api = YouTubeTranscriptApi()
            if hasattr(api, "fetch"):  # youtube-transcript-api >= 1.0
                text = " ".join(s.text for s in api.fetch(video_id, languages=langs))
            else:  # 0.6.x
                text = " ".join(c["text"] for c in YouTubeTranscriptApi.get_transcript(video_id, languages=langs))
            return text[:3200]
        except Exception as exc:
            log.info("no transcript for %s (%s)", video_id, str(exc)[:80])
            return ""
