"""
Copyright-free Viral Meme Pop-Ups & Custom Meme Assets (v5 Mega-Pack).

Supports 10 procedural copyright-free meme card templates:
1. `expectation_reality` : Split panel (EXPECTATION vs REALITY)
2. `nobody_me`           : Classic "Nobody: / Me:" viral format
3. `stamp`               : Slanted red rubber stamp ("KHATAM TATA BYE BYE", "EMOTIONAL DAMAGE", etc.)
4. `breaking_news`       : TV Breaking News alert box with live badge
5. `red_buzzer`          : India's Got Latent / Talent Show giant RED BUZZER card ("BUZZER PRESSED!")
6. `scorecard`           : Judge Panel Scorecard (e.g., "0 / 10 — CRINGE LEVEL MAX")
7. `brain_levels`        : 2-tier Small Brain vs Galaxy Brain comparison
8. `chat_bubble`         : Desi WhatsApp / DM chat screen notification card
9. `viral_tweet`         : Social post / X-style hot take card
10. `vs_battle`          : Side-by-side VS clash card (e.g., "DESI MUMMY VS CHATGPT")

Plus custom images dropped into `assets/memes/` (png, jpg, jpeg, webp).
"""
from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from PIL import Image, ImageDraw, ImageOps

from agents.textkit import clean, fit, font

CARD_TYPES = (
    "expectation_reality",
    "nobody_me",
    "stamp",
    "breaking_news",
    "red_buzzer",
    "scorecard",
    "brain_levels",
    "chat_bubble",
    "viral_tweet",
    "vs_battle",
)
IMG_EXT = {".png", ".jpg", ".jpeg", ".webp"}

_TWO_PART_CARDS = {"expectation_reality", "brain_levels", "chat_bubble", "vs_battle"}


def list_meme_assets(assets: Path) -> List[str]:
    d = Path(assets) / "memes"
    return sorted(p.name for p in d.iterdir() if p.suffix.lower() in IMG_EXT) if d.exists() else []


def normalize_card(card: Any) -> Optional[Dict[str, str]]:
    if not isinstance(card, dict):
        return None
    kind = str(card.get("type", "")).strip().lower()
    if kind not in CARD_TYPES:
        return None
    a = " ".join(str(card.get("text_a", "")).split())[:70]
    b = " ".join(str(card.get("text_b", "")).split())[:70]
    if not a or (kind in _TWO_PART_CARDS and not b):
        return None
    return {"type": kind, "text_a": a, "text_b": b}


def _panel(
    d: ImageDraw.ImageDraw,
    box: Tuple[int, int, int, int],
    fill,
    label: str,
    text: str,
    assets: str,
    label_fill,
    text_fill=(15, 15, 15),
) -> None:
    x0, y0, x1, y1 = box
    d.rounded_rectangle(box, radius=26, fill=fill)
    lf = font(34, assets)
    d.rounded_rectangle([x0 + 20, y0 + 16, x0 + 40 + d.textlength(label, font=lf), y0 + 66], radius=14, fill=label_fill)
    d.text((x0 + 30, y0 + 20), label, font=lf, fill=(255, 255, 255))
    f, lines, size = fit(d, text.upper(), assets, (x1 - x0) - 60, (y1 - y0) - 100, 76, 28)
    y = y0 + 78 + ((y1 - y0 - 90) - len(lines) * size * 1.16) / 2
    for ln in lines:
        d.text((x0 + 30, y), ln, font=f, fill=text_fill)
        y += size * 1.16


def make_meme_card(
    card: Optional[Dict[str, str]],
    asset_name: Optional[str],
    assets: Path,
    size: Tuple[int, int],
) -> Optional[Image.Image]:
    w, h = size
    a = str(assets)
    if asset_name:
        p = Path(assets) / "memes" / Path(asset_name).name  # .name blocks path tricks
        if p.exists():
            try:
                img = ImageOps.fit(Image.open(p).convert("RGBA"), (w, h), Image.LANCZOS)
                mask = Image.new("L", (w, h), 0)
                ImageDraw.Draw(mask).rounded_rectangle([0, 0, w - 1, h - 1], radius=28, fill=255)
                img.putalpha(mask)
                return img
            except Exception:
                pass
    if not card:
        return None
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    kind, ta, tb = card["type"], clean(card["text_a"]), clean(card.get("text_b", ""))

    if kind == "expectation_reality":
        gap = 14
        _panel(d, (0, 0, w, h // 2 - gap // 2), (255, 255, 255, 255), "EXPECTATION", ta, a, (30, 150, 90))
        _panel(d, (0, h // 2 + gap // 2, w, h), (255, 255, 255, 255), "REALITY", tb, a, (210, 40, 50))
    elif kind == "brain_levels":
        gap = 14
        _panel(d, (0, 0, w, h // 2 - gap // 2), (235, 242, 255, 255), "NORMAL BRAIN", ta, a, (60, 100, 190))
        _panel(d, (0, h // 2 + gap // 2, w, h), (30, 16, 56, 255), "ULTRA LEGEND BRAIN", tb, a, (220, 40, 140), text_fill=(255, 230, 80))
    elif kind == "chat_bubble":
        d.rounded_rectangle([0, 0, w, h], radius=28, fill=(18, 28, 24, 250), outline=(40, 200, 110, 255), width=5)
        d.rounded_rectangle([24, 24, w - 140, h // 2 - 12], radius=22, fill=(38, 48, 44, 255))
        f1, l1, s1 = fit(d, ta, a, w - 200, h // 2 - 55, 52, 24)
        y = 40
        for ln in l1:
            d.text((44, y), ln, font=f1, fill=(240, 245, 240))
            y += s1 * 1.15
        d.rounded_rectangle([140, h // 2 + 12, w - 24, h - 24], radius=22, fill=(0, 135, 95, 255))
        f2, l2, s2 = fit(d, tb, a, w - 200, h // 2 - 55, 52, 24)
        y = h // 2 + 28
        for ln in l2:
            d.text((160, y), ln, font=f2, fill=(255, 255, 255))
            y += s2 * 1.15
    elif kind == "vs_battle":
        mid = w // 2
        d.rounded_rectangle([0, 0, mid - 10, h], radius=26, fill=(28, 60, 160, 250), outline=(255, 255, 255, 255), width=4)
        d.rounded_rectangle([mid + 10, 0, w, h], radius=26, fill=(185, 28, 50, 250), outline=(255, 255, 255, 255), width=4)
        f1, l1, s1 = fit(d, ta.upper(), a, mid - 60, h - 80, 68, 26)
        y = (h - len(l1) * s1 * 1.16) / 2
        for ln in l1:
            tw = d.textlength(ln, font=f1)
            d.text(((mid - 10 - tw) / 2, y), ln, font=f1, fill=(255, 255, 255))
            y += s1 * 1.16
        f2, l2, s2 = fit(d, tb.upper(), a, mid - 60, h - 80, 68, 26)
        y = (h - len(l2) * s2 * 1.16) / 2
        for ln in l2:
            tw = d.textlength(ln, font=f2)
            d.text((mid + 10 + (mid - 10 - tw) / 2, y), ln, font=f2, fill=(255, 230, 80))
            y += s2 * 1.16
        d.ellipse([mid - 58, h // 2 - 58, mid + 58, h // 2 + 58], fill=(255, 214, 10), outline=(14, 14, 14), width=6)
        vf = font(48, a)
        vtw = d.textlength("VS", font=vf)
        d.text((mid - vtw / 2, h // 2 - 28), "VS", font=vf, fill=(14, 14, 14))
    elif kind == "nobody_me":
        d.rounded_rectangle([0, 0, w, h], radius=28, fill=(255, 255, 255, 255))
        d.text((36, 24), "Nobody:", font=font(52, a), fill=(120, 120, 130))
        d.line([(36, 100), (w - 36, 100)], fill=(225, 225, 232), width=3)
        d.text((36, 118), "Me:", font=font(52, a), fill=(15, 15, 15))
        f, lines, size = fit(d, ta, a, w - 72, h - 230, 84, 30)
        y = 196
        for ln in lines:
            d.text((36, y), ln, font=f, fill=(15, 15, 15))
            y += size * 1.16
    elif kind == "breaking_news":
        d.rounded_rectangle([0, 0, w, h], radius=26, fill=(18, 22, 48, 250), outline=(255, 214, 10, 255), width=6)
        d.rounded_rectangle([24, 24, w - 24, 104], radius=16, fill=(220, 24, 40, 255))
        bf = font(46, a)
        d.text((48, 38), "BREAKING NEWS", font=bf, fill=(255, 255, 255))
        f, lines, size = fit(d, ta.upper(), a, w - 80, h - 150, 78, 28)
        y = 124 + ((h - 144) - len(lines) * size * 1.16) / 2
        for ln in lines:
            d.text((40, y), ln, font=f, fill=(255, 235, 120))
            y += size * 1.16
    elif kind == "red_buzzer":
        d.rounded_rectangle([12, 12, w - 12, h - 12], radius=32, fill=(44, 10, 18, 248), outline=(255, 50, 70, 255), width=10)
        d.ellipse([w // 2 - 90, 28, w // 2 + 90, 196], fill=(235, 20, 40, 255), outline=(255, 210, 210, 255), width=8)
        xf = font(92, a)
        xtw = d.textlength("X", font=xf)
        d.text((w / 2 - xtw / 2, 56), "X", font=xf, fill=(255, 255, 255))
        f, lines, size = fit(d, ta.upper(), a, w - 90, h - 235, 76, 28)
        y = 215 + ((h - 235) - len(lines) * size * 1.16) / 2
        for ln in lines:
            tw = d.textlength(ln, font=f)
            d.text(((w - tw) / 2, y), ln, font=f, fill=(255, 226, 0))
            y += size * 1.16
    elif kind == "scorecard":
        d.rounded_rectangle([16, 16, w - 16, h - 16], radius=28, fill=(255, 248, 225, 255), outline=(25, 25, 25, 255), width=8)
        sf = font(42, a)
        hdr = "PANEL SCORECARD"
        htw = d.textlength(hdr, font=sf)
        d.text(((w - htw) / 2, 34), hdr, font=sf, fill=(180, 30, 50))
        d.line([(50, 96), (w - 50, 96)], fill=(200, 180, 140), width=4)
        f, lines, size = fit(d, ta.upper(), a, w - 100, h - 140, 96, 32)
        y = 115 + ((h - 135) - len(lines) * size * 1.16) / 2
        for ln in lines:
            tw = d.textlength(ln, font=f)
            d.text(((w - tw) / 2, y), ln, font=f, fill=(20, 20, 30))
            y += size * 1.16
    elif kind == "viral_tweet":
        d.rounded_rectangle([0, 0, w, h], radius=28, fill=(22, 24, 32, 252), outline=(80, 160, 255, 255), width=4)
        d.ellipse([36, 32, 100, 96], fill=(98, 52, 214))
        hf = font(36, a)
        d.text((118, 42), "VIRAL ROAST POST  •  1.2M Views", font=hf, fill=(160, 195, 255))
        f, lines, size = fit(d, ta, a, w - 80, h - 150, 68, 26)
        y = 118
        for ln in lines:
            d.text((40, y), ln, font=f, fill=(255, 255, 255))
            y += size * 1.16
    else:  # stamp
        text = ta.upper()
        f, lines, size = fit(d, text, a, w - 120, h - 120, 120, 36)
        d.rounded_rectangle([20, 20, w - 20, h - 20], radius=24, outline=(230, 30, 40, 255), width=14, fill=(255, 255, 255, 235))
        y = (h - len(lines) * size * 1.16) / 2
        for ln in lines:
            tw = d.textlength(ln, font=f)
            d.text(((w - tw) / 2, y), ln, font=f, fill=(230, 30, 40, 255))
            y += size * 1.16
        img = img.rotate(-6, resample=Image.BICUBIC, expand=False)
    return img


def ensure_default_meme_assets(assets: Path) -> List[str]:
    """Generate 6 copyright-free desi viral reaction cards inside assets/memes/ if not present."""
    meme_dir = Path(assets) / "memes"
    meme_dir.mkdir(parents=True, exist_ok=True)
    presets = [
        ("khatam_tata_bye.png", {"type": "stamp", "text_a": "KHATAM! TATA! BYE BYE!"}),
        ("emotional_damage.png", {"type": "red_buzzer", "text_a": "EMOTIONAL DAMAGE 100%"}),
        ("paisa_barbaad.png", {"type": "breaking_news", "text_a": "PAISA BARBAAD BC!"}),
        ("sharma_ji_approved.png", {"type": "scorecard", "text_a": "SHARMA JI BETA: 10/10 | YOU: 0/10"}),
        ("system_hang.png", {"type": "red_buzzer", "text_a": "BHAI SYSTEM HANG HO GAYA!"}),
        ("expectation_vs_reality.png", {"type": "expectation_reality", "text_a": "MILLIONAIRE STARTUP PLAN", "text_b": "19 RS DATA LOAN ACTIVE"}),
    ]
    for fname, spec in presets:
        p = meme_dir / fname
        if not p.exists():
            im = make_meme_card(spec, None, assets, (900, 520))
            if im is not None:
                im.save(p)
    return list_meme_assets(assets)
