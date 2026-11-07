#!/usr/bin/env python3
"""
Hybrid mode: re-render an existing episode using a talking-head video made in the
Kaggle/Colab notebook (SadTalker) as the avatar layer.

    python composite.py outputs/episode_20261025_110000 /path/to/talking_head.mp4
"""
import json
import sys
from pathlib import Path

from agents.pro_video_editor import KIND_LAYOUT, ReelRenderer
from agents.voice_and_lipsync import ensure_sfx
from config import ASSETS_DIR, StudioConfig


def main() -> None:
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    ep, head = Path(sys.argv[1]), Path(sys.argv[2])
    plan = json.loads((ep / "production_plan.json").read_text(encoding="utf-8"))
    meta = json.loads((ep / "words.json").read_text(encoding="utf-8"))
    voice = {"audio_path": ep / meta["audio"], "words": meta["words"], "duration": meta["duration"],
             "scene_windows": meta.get("scene_windows"), "bleeps": meta.get("bleeps", [])}
    out = ReelRenderer(ASSETS_DIR, StudioConfig().watermark_text, KIND_LAYOUT.get(plan.get("kind", "short"), "vertical"), StudioConfig().character_name).render(
        plan, voice, ensure_sfx(ASSETS_DIR / "sfx"), ep / "final_3d_reel_talkinghead.mp4", avatar_video=head
    )
    print("done:", out)


if __name__ == "__main__":
    main()
