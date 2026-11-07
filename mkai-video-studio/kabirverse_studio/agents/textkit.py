"""Shared text helpers for renderer + meme cards (fonts, emoji stripping, wrapping, fit-to-box)."""
from __future__ import annotations

import os
import re
from functools import lru_cache
from pathlib import Path
from typing import List, Tuple

from PIL import ImageDraw, ImageFont


@lru_cache(maxsize=96)
def font(size: int, assets: str) -> ImageFont.ImageFont:
    cands: List[str] = []
    fdir = Path(assets) / "fonts"
    if fdir.exists():
        cands += [str(p) for p in sorted(fdir.glob("*.ttf")) + sorted(fdir.glob("*.otf"))]
    cands += [
        "C:/Windows/Fonts/impact.ttf",
        "C:/Windows/Fonts/arialbd.ttf",
        "/System/Library/Fonts/Supplemental/Impact.ttf",
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    ]
    for c in cands:
        if os.path.exists(c):
            try:
                return ImageFont.truetype(c, size)
            except OSError:
                continue
    try:
        return ImageFont.load_default(size)
    except TypeError:
        return ImageFont.load_default()


def clean(s: str) -> str:
    """Drop emoji / symbols the bold fonts cannot draw."""
    return re.sub(r"[^\x20-\x7E\u00A0-\u024F\u2018-\u201D\u2026\u2013\u2014]", "", str(s)).strip()


def wrap(d: ImageDraw.ImageDraw, text: str, f: ImageFont.ImageFont, max_w: int) -> List[str]:
    lines, cur = [], ""
    for word in text.split():
        trial = f"{cur} {word}".strip()
        if cur and d.textlength(trial, font=f) > max_w:
            lines.append(cur)
            cur = word
        else:
            cur = trial
    if cur:
        lines.append(cur)
    return lines


def fit(d: ImageDraw.ImageDraw, text: str, assets: str, box_w: int, box_h: int, max_size: int, min_size: int = 22, spacing: float = 1.16) -> Tuple[ImageFont.ImageFont, List[str], int]:
    """Biggest font (<= max_size) whose wrapped text fits the box. Returns (font, lines, size)."""
    size = max_size
    while True:
        f = font(size, assets)
        lines = wrap(d, text, f, box_w)
        if (len(lines) * size * spacing <= box_h and all(d.textlength(l, font=f) <= box_w for l in lines)) or size <= min_size:
            return f, lines, size
        size -= 4
