#!/usr/bin/env python3
"""Setup checker: python doctor.py   (add --llm to ping each model with a tiny request)"""
import importlib
import json
import sys
import urllib.request

from config import ROOT, StudioConfig

OK, BAD, WARN = "[ OK ]", "[FAIL]", "[WARN]"


def line(tag, msg):
    print(f"{tag} {msg}")


def main() -> int:
    cfg, bad = StudioConfig(), 0
    line(OK if (3, 10) <= sys.version_info[:2] <= (3, 12) else WARN, f"python {sys.version.split()[0]} (3.10-3.12 recommended)")
    for mod in ("moviepy", "numpy", "PIL", "edge_tts", "requests", "playwright", "yt_dlp", "youtube_transcript_api"):
        try:
            m = importlib.import_module(mod)
            line(OK, f"{mod} {getattr(m, '__version__', '')}")
        except ImportError:
            line(BAD, f"{mod} missing -> pip install -r requirements.txt")
            bad += 1
    try:
        import moviepy.editor  # noqa: F401
        import numpy

        if int(numpy.__version__.split(".")[0]) >= 2:
            line(BAD, "numpy 2.x installed - moviepy 1.0.3 needs numpy<2")
            bad += 1
    except Exception as exc:
        line(BAD, f"moviepy.editor import failed: {exc}")
        bad += 1
    try:
        import imageio_ffmpeg

        line(OK, f"ffmpeg: {imageio_ffmpeg.get_ffmpeg_exe()}")
    except Exception:
        line(BAD, "ffmpeg not found (pip install imageio-ffmpeg)")
        bad += 1

    line(OK, "daily plan: " + ", ".join(f"{k}@{t}" for k, t in cfg.daily_plan()) + f" ({cfg.timezone})")
    line(OK, f"content style: {cfg.content_style} | formats: shorts={cfg.short_format}, long={cfg.long_format}")
    line(OK, f"names: {cfg.youtube_channel_name} | {cfg.instagram_handle} | character '{cfg.character_name}'")
    ready = [m for m in cfg.models.values() if m.ready]
    for m in cfg.models.values():
        line(OK if m.ready else WARN, f"{m.name} key {'set' if m.ready else 'MISSING / placeholder in .env'}")
    if not ready:
        line(BAD, "no council key set - add at least one key to .env (or use --demo)")
        bad += 1

    if "--llm" in sys.argv:
        from agents.multi_llm_brain import LLMClient

        client = LLMClient(cfg)
        for k, m in cfg.models.items():
            if not m.ready:
                continue
            try:
                out = client.chat(k, "Reply with one word.", "Say OK", temperature=0, max_tokens=20)
                line(OK, f"{m.name}: '{client._resolved.get(m.name)}' answered: {out[:30]!r}")
            except Exception as exc:
                line(BAD, f"{m.name}: {str(exc)[:120]}")
                bad += 1

    try:
        data = json.load(urllib.request.urlopen(cfg.chrome_cdp_url.rstrip("/") + "/json/version", timeout=3))
        line(OK, f"Chrome CDP reachable ({data.get('Browser')})")
    except Exception:
        line(WARN, f"Chrome not reachable at {cfg.chrome_cdp_url} - run start_chrome_agent.* (only needed for --upload)")

    line(OK if (ROOT / ".env").exists() else BAD, ".env present")
    print("\nAll good." if not bad else f"\n{bad} problem(s) to fix.")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
