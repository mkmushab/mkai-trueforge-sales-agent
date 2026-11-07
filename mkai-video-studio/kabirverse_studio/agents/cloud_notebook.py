"""
Exports a Kaggle / Colab notebook that turns `voiceover.mp3` + a portrait into a REAL
lip-synced talking-head clip (SadTalker). Download `talking_head.mp4`, then run:

    python composite.py outputs/<episode_dir> path/to/talking_head.mp4

and the local renderer adds banners, captions, SFX and exports the final 1080x1920 reel.

NOTE: third-party repos (SadTalker, Wan2.2, MuseTalk, LivePortrait) change often and Colab's
Python/numpy versions drift. Treat this notebook as a starting point and expect to tweak
one or two install lines. It has NOT been run on your account.
"""
from __future__ import annotations

import base64
import json
from pathlib import Path
from typing import Any, Dict, List


def _md(text: str) -> Dict[str, Any]:
    return {"cell_type": "markdown", "metadata": {}, "source": text.strip("\n").splitlines(True)}


def _code(text: str) -> Dict[str, Any]:
    return {"cell_type": "code", "metadata": {}, "execution_count": None, "outputs": [], "source": text.strip("\n").splitlines(True)}


def export_notebook(plan: Dict[str, Any], out_path: Path) -> Path:
    plan_b64 = base64.b64encode(json.dumps(plan, ensure_ascii=False).encode("utf-8")).decode("ascii")
    cells: List[Dict[str, Any]] = [
        _md(
            f"""
# KabirVerse 3D - cloud talking-head
Episode: **{plan.get('video_title', '')}**

1. Runtime -> GPU (Colab: T4 / Kaggle: T4 x2, Internet ON).
2. Upload `voiceover.mp3` and a front-facing portrait `character_3d.png`
   (make one with Gemini / any free image tool using `character_3d_base_prompt` from the plan).
3. Run all cells, download `talking_head.mp4`, then run `composite.py` on your laptop.

> Untested template - repos below change often; fix an install line if one breaks.
"""
        ),
        _code("!nvidia-smi\n!apt-get -qq install -y ffmpeg > /dev/null"),
        _code(
            """
import base64, json, os
PLAN = json.loads(base64.b64decode("%s").decode("utf-8"))
os.makedirs("work", exist_ok=True)
json.dump(PLAN, open("work/plan.json", "w"), ensure_ascii=False, indent=2)
print(PLAN["video_title"]); print(PLAN["character_3d_base_prompt"])
"""
            % plan_b64
        ),
        _code(
            """
# --- inputs: Colab upload, or Kaggle dataset under /kaggle/input
import glob, shutil
try:
    from google.colab import files
    up = files.upload()           # pick voiceover.mp3 and character_3d.png
    for name in up: shutil.move(name, f"work/{name}")
except ImportError:
    for pat in ("voiceover.*", "character_3d.*"):
        for f in glob.glob(f"/kaggle/input/**/{pat}", recursive=True): shutil.copy(f, "work/")
print(os.listdir("work"))
"""
        ),
        _code(
            """
# --- SadTalker: still image + audio -> lip-synced talking head
!git clone -q https://github.com/OpenTalker/SadTalker.git
%cd SadTalker
!pip install -q -r requirements.txt
!bash scripts/download_models.sh
"""
        ),
        _code(
            """
audio = next(f for f in os.listdir("../work") if f.startswith("voiceover"))
image = next(f for f in os.listdir("../work") if f.startswith("character_3d"))
!python inference.py --driven_audio ../work/{audio} --source_image ../work/{image} \\
    --result_dir ../work/results --still --preprocess full --enhancer gfpgan
"""
        ),
        _code(
            """
import glob, shutil
res = sorted(glob.glob("../work/results/**/*.mp4", recursive=True), key=os.path.getmtime)[-1]
shutil.copy(res, "/content/talking_head.mp4" if os.path.isdir("/content") else "/kaggle/working/talking_head.mp4")
print("ready:", res)
try:
    from google.colab import files; files.download("/content/talking_head.mp4")
except ImportError:
    print("Kaggle: download talking_head.mp4 from the Output tab.")
"""
        ),
        _md(
            """
### Optional: Wan2.2 / MuseTalk / LivePortrait
Each scene in `PLAN["scenes"]` has a `wan22_3d_prompt`. Use them with Wan2.2 (image-to-video) to
animate camera/body motion, then run MuseTalk on the result with `voiceover.mp3` for lip-sync.
Heavy and slow on free T4s - SadTalker above is the reliable path.
"""
        ),
    ]
    nb = {
        "cells": cells,
        "metadata": {"kernelspec": {"display_name": "Python 3", "language": "python", "name": "python3"}, "language_info": {"name": "python"}},
        "nbformat": 4,
        "nbformat_minor": 4,
    }
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(nb, indent=1, ensure_ascii=False), encoding="utf-8")
    return out_path
