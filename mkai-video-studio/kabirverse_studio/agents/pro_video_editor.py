"""
Video Renderer (v5 Mega-Renderer).

  vertical 1080x1920  -> Shorts & Reels (20-25 s) + vertical thumbnail
  wide     1920x1080  -> the daily long YouTube video (2:00-2:30) + a 1280x720 high-CTR thumbnail

Upgrades in v5:
  * 1 to 6 cartoon characters on screen simultaneously (from the 1,000-character pool):
    the active speaker pops forward (own colour, name tag, audio-driven mouth), while the others dim & react!
  * Dynamic environments per episode or per scene (`talent_stage`, `jungle`, `home_room`, `podcast_studio`,
    `street_chai`, `college_canteen`, `office_boardroom`, `gym`, `news_room`, `cyber_studio`).
  * India's Got Latent / Talent Roast stage props: judge panel desk, golden/red buzzers in front of judges,
    studio microphones in podcast/talent setups.
  * Hormozi-style dynamic captions with active-word colour pop + BEEP censor masking (`*****`).
  * 10 procedural copyright-free viral meme cards + `assets/memes/` image overlays.
  * High-CTR thumbnail generator for BOTH long videos (`thumbnail.jpg` 1280x720) and Shorts (`thumbnail_vertical.jpg` 1080x1920).
"""
from __future__ import annotations

import bisect
import logging
import math
import os
from collections import OrderedDict
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence, Tuple, Union

import numpy as np
from PIL import Image, ImageDraw, ImageEnhance, ImageOps

from agents.avatar_art import AV_H, AV_W, draw_avatar
from agents.backgrounds import BACKGROUNDS, infer_background_from_text, render_background
from agents.cast import Character, cast_from_plan
from agents.meme_cards import ensure_default_meme_assets, make_meme_card
from agents.textkit import clean as _txt
from agents.textkit import font as _font
from agents.textkit import wrap as _wrap
from agents.voice_and_lipsync import decode_mono

log = logging.getLogger("studio.render")

MOUTH_LEVELS = 5
CACHE_MAX = 180


@dataclass(frozen=True)
class Layout:
    name: str
    w: int
    h: int
    av_cx: int
    av_cy: int
    av_scale: float
    ring: Tuple[int, int, int, int]
    banner: Tuple[int, int, int, int]
    banner_font: int
    cap_y: int
    cap_size: int
    cap_max_w: int
    cap_words: int
    desk_y: int
    desk_bottom: int
    handle_y: int
    handle_size: int
    prog_y: int
    logo_xy: Tuple[int, int]
    logo_size: int
    meme: Tuple[int, int, int, int] = (0, 0, 0, 0)  # centre x, centre y, width, height of meme pop-ups


VERTICAL = Layout(
    "vertical", 1080, 1920, 540, 760, 1.0, (120, 330, 960, 1170), (40, 90, 1040, 262), 66,
    1330, 104, 970, 3, 1150, 1290, 1560, 40, 28, (900, 290), 110, meme=(540, 640, 900, 520),
)
WIDE = Layout(
    "wide", 1920, 1080, 960, 480, 0.78, (630, 150, 1290, 810), (60, 26, 1860, 126), 58,
    900, 92, 1740, 4, 840, 1080, 1022, 34, 6, (1730, 160), 130, meme=(960, 400, 880, 500),
)
LAYOUTS = {"vertical": VERTICAL, "wide": WIDE}
KIND_LAYOUT = {"short": "vertical", "long": "wide"}


# --------------------------------------------------------------------- helpers
def audio_envelope(audio_path: Path, rate: int = 50) -> np.ndarray:
    """0..1 loudness curve at `rate` Hz (fast attack, slow release) used to drive the mouth."""
    sr = 22050
    mono = np.abs(decode_mono(audio_path, sr))
    hop = sr // rate
    n = len(mono) // hop
    if n < 2:
        return np.zeros(2)
    frames = mono[: n * hop].reshape(n, hop)
    rms = np.sqrt((frames**2).mean(axis=1))
    ref = max(float(np.percentile(rms, 95)), 1e-6)
    env = np.clip(rms / ref, 0, 1)
    out, v = np.zeros_like(env), 0.0
    for i, x in enumerate(env):
        v = x if x > v else v * 0.80 + x * 0.20
        out[i] = v
    return out


def scene_windows(plan: Dict[str, Any], words: List[Dict[str, Any]], duration: float) -> List[Tuple[float, float]]:
    """Estimate scene windows from word timings (single-narrator videos). Dialogue passes exact windows instead."""
    scenes = plan["scenes"]
    counts = [max(len(s.get("spoken_line", "").split()), 1) for s in scenes]
    total, n, cum, starts = sum(counts), len(words), 0, []
    for c in counts:
        if cum == 0:
            starts.append(0.0)
        elif n:
            starts.append(words[min(int(round(cum / total * n)), n - 1)]["start"])
        else:
            starts.append(duration * cum / total)
        cum += c
    ends = starts[1:] + [duration]
    return list(zip(starts, ends))


def caption_chunks(words: List[Dict[str, Any]], size: int = 3) -> List[List[Dict[str, Any]]]:
    chunks, cur = [], []
    for w in words:
        cur.append(w)
        if len(cur) >= size or w["word"][-1:] in ".!?,;:":
            chunks.append(cur)
            cur = []
    if cur:
        chunks.append(cur)
    return chunks


def slots(L: Layout, n: int) -> List[Tuple[int, int, float]]:
    """(centre x, centre y, scale) for each of n characters (supports 1 to 6 characters!), left to right."""
    if n <= 1:
        return [(L.av_cx, L.av_cy, L.av_scale)]
    scale_map = {
        2: (0.80, 0.80),
        3: (0.70, 0.58),
        4: (0.60, 0.46),
        5: (0.52, 0.38),
        6: (0.45, 0.33),
    }
    scale = scale_map[min(max(n, 2), 6)][0 if L.name == "wide" else 1]
    cy = L.desk_y + 40 - int(AV_H * scale / 2)
    return [(int((i + 0.5) * L.w / n), cy, scale) for i in range(n)]


# ------------------------------------------------------------------- renderer
class ReelRenderer:
    def __init__(
        self,
        assets_dir: Path,
        handle: str = "@mkverse.3d",
        layout: Union[str, Layout] = "vertical",
        hero_name: str = "Kabir 3D",
    ):
        self.assets = Path(assets_dir)
        ensure_default_meme_assets(self.assets)
        self.handle = handle
        self.hero_name = hero_name
        self.L: Layout = layout if isinstance(layout, Layout) else LAYOUTS[layout]
        self._av_cache: "OrderedDict[tuple, Image.Image]" = OrderedDict()
        self._bg_cache: Dict[Tuple[str, bool], Image.Image] = {}
        self._custom = self.assets / "character_3d.png"
        self._logo = self._load_logo()

    # ---- static pieces
    def _load_logo(self) -> Optional[Image.Image]:
        path = self.assets / "logo.png"
        if not path.exists():
            return None
        try:
            size = self.L.logo_size
            img = ImageOps.fit(Image.open(path).convert("RGBA"), (size, size), Image.LANCZOS)
            mask = Image.new("L", (size * 4, size * 4), 0)
            ImageDraw.Draw(mask).ellipse([0, 0, size * 4 - 1, size * 4 - 1], fill=255)
            img.putalpha(mask.resize((size, size), Image.LANCZOS))
            return img
        except Exception as exc:
            log.warning("logo ignored: %s", exc)
            return None

    def _bg(self, bg_Or_idx: Union[str, int], ring: bool) -> Image.Image:
        if isinstance(bg_Or_idx, int):
            bg_name = BACKGROUNDS[bg_Or_idx % len(BACKGROUNDS)]
        else:
            bg_name = bg_Or_idx if bg_Or_idx in BACKGROUNDS else "cyber_studio"
        key = (bg_name, ring)
        if key not in self._bg_cache:
            L = self.L
            self._bg_cache[key] = render_background(
                bg_name, L.w, L.h, L.desk_y, L.ring, draw_ring=ring, assets_dir=str(self.assets)
            )
        return self._bg_cache[key]

    def _avatar(self, ch: Character, expr: str, mouth: float, blink: bool, dim: bool, cache_scale: float) -> Image.Image:
        lvl = int(round(max(0.0, min(1.0, mouth)) * MOUTH_LEVELS))
        key = (ch.id, expr, lvl, blink, dim, cache_scale)
        img = self._av_cache.get(key)
        if img is not None:
            self._av_cache.move_to_end(key)
            return img
        img = draw_avatar(expr, lvl / MOUTH_LEVELS, blink, ch.look)
        if dim:  # listeners are darkened so the speaker stands out
            alpha = img.getchannel("A")
            img = ImageEnhance.Brightness(img.convert("RGB")).enhance(0.72).convert("RGBA")
            img.putalpha(alpha)
        if abs(cache_scale - 1.0) > 1e-3:
            img = img.resize((int(AV_W * cache_scale), int(AV_H * cache_scale)), Image.LANCZOS)
        self._av_cache[key] = img
        if len(self._av_cache) > CACHE_MAX:
            self._av_cache.popitem(last=False)
        return img

    # ---- layout pieces
    def _draw_banner(self, img: Image.Image, text: str, since: float) -> None:
        L = self.L
        x0, y0, x1, y1 = L.banner
        text = _txt(text).upper()
        if not text:
            return
        ease = min(1.0, since / 0.18)
        off = int(-(1 - ease) * (y1 - y0 + 40))
        d = ImageDraw.Draw(img)
        size = L.banner_font
        while size > 30 and d.textlength(text, font=_font(size, str(self.assets))) > (x1 - x0) - 110:
            size -= 4
        f = _font(size, str(self.assets))
        d.rounded_rectangle([x0, y0 + off, x1, y1 + off], radius=28, fill=(255, 214, 10), outline=(255, 255, 255), width=6)
        tw = d.textlength(text, font=f)
        d.text(((L.w - tw) / 2, (y0 + y1) / 2 + off - size * 0.55), text, font=f, fill=(14, 14, 14))

    def _draw_caption(self, img: Image.Image, chunk: List[Dict[str, Any]], t: float, hi: Tuple[int, int, int]) -> None:
        L = self.L
        words = ["*****" if w.get("bleep") else _txt(w["word"]).upper() for w in chunk]
        d = ImageDraw.Draw(img)
        size = L.cap_size
        if t - chunk[0]["start"] < 0.09:
            size = int(size * 1.14)
        floor = int(L.cap_size * 0.5)
        while size > floor:
            f = _font(size, str(self.assets))
            total = sum(d.textlength(w, font=f) for w in words) + d.textlength(" ", font=f) * (len(words) - 1)
            if total <= L.cap_max_w:
                break
            size -= 6
        f = _font(size, str(self.assets))
        sp = d.textlength(" ", font=f)
        total = sum(d.textlength(w, font=f) for w in words) + sp * (len(words) - 1)
        active = max([i for i, w in enumerate(chunk) if w["start"] <= t] or [0])
        x, y = (L.w - total) / 2, L.cap_y
        for i, w in enumerate(words):
            d.text((x, y), w, font=f, fill=hi if i == active else (255, 255, 255), stroke_width=9, stroke_fill=(0, 0, 0))
            x += d.textlength(w, font=f) + sp

    def _name_tag(self, img: Image.Image, text: str, cx: int, active: bool, color: Tuple[int, int, int], n_chars: int = 2) -> None:
        L = self.L
        d = ImageDraw.Draw(img)
        base_sz = 30 if L.name == "wide" else 26
        if n_chars >= 5:
            base_sz = max(20, base_sz - 6)
        f = _font(base_sz, str(self.assets))
        text = _txt(text).upper()
        tw = d.textlength(text, font=f)
        y = L.desk_y + 14
        pad = 14 if n_chars >= 5 else 18
        d.rounded_rectangle(
            [cx - tw / 2 - pad, y, cx + tw / 2 + pad, y + 44],
            radius=14,
            fill=color if active else (52, 46, 84),
            outline=(255, 255, 255) if active else None,
            width=3,
        )
        d.text((cx - tw / 2, y + 5), text, font=f, fill=(14, 14, 14) if active else (200, 196, 230))

    def _draw_desk_props(
        self,
        img: Image.Image,
        bg_name: str,
        fmt: str,
        pos: List[Tuple[int, int, float]],
        chars: Sequence[Character],
        speaker: int,
        sfx_name: str,
    ) -> None:
        """Draw talent-show judge desk buzzers, podcast mics, or environment desk styling."""
        L = self.L
        d = ImageDraw.Draw(img)
        if bg_name == "talent_stage" or fmt in ("talent_roast", "panel_5_6"):
            # Luxury dark crimson + gold judge panel desk
            d.rectangle([0, L.desk_y, L.w, L.desk_bottom], fill=(42, 10, 24))
            d.line([(0, L.desk_y), (L.w, L.desk_y)], fill=(255, 200, 40), width=8)
            # Red buzzers on desk for each judge
            for i, (cx, _, _) in enumerate(pos):
                is_judge = chars[i].archetype == "judge" or i < len(pos) - 1
                if is_judge:
                    bx0, by0 = cx - 34, L.desk_y - 26
                    pressed = (i == speaker and sfx_name in ("record_scratch", "vine_boom"))
                    b_col = (255, 30, 50) if pressed else (195, 20, 35)
                    d.rounded_rectangle([bx0 - 8, L.desk_y - 10, bx0 + 76, L.desk_y + 6], radius=6, fill=(220, 180, 60))
                    d.ellipse([bx0, by0 + (4 if pressed else 0), bx0 + 68, L.desk_y - 2], fill=b_col, outline=(255, 230, 230), width=3)
                else:
                    # Standing microphone for the contestant
                    d.line([(cx, L.desk_y - 95), (cx, L.desk_y)], fill=(190, 195, 210), width=6)
                    d.ellipse([cx - 18, L.desk_y - 125, cx + 18, L.desk_y - 85], fill=(60, 65, 80), outline=(220, 225, 240), width=3)
        elif bg_name == "podcast_studio":
            d.rectangle([0, L.desk_y, L.w, L.desk_bottom], fill=(28, 20, 18))
            d.line([(0, L.desk_y), (L.w, L.desk_y)], fill=(255, 140, 40), width=6)
            for cx, _, _ in pos:
                d.line([(cx + 28, L.desk_y), (cx + 12, L.desk_y - 80)], fill=(50, 50, 60), width=7)
                d.rounded_rectangle([cx - 6, L.desk_y - 115, cx + 26, L.desk_y - 72], radius=10, fill=(30, 30, 38), outline=(255, 165, 50), width=3)
        elif bg_name == "jungle":
            d.rectangle([0, L.desk_y, L.w, L.desk_bottom], fill=(36, 26, 16))
            d.line([(0, L.desk_y), (L.w, L.desk_y)], fill=(76, 165, 68), width=8)
        else:
            d.rectangle([0, L.desk_y, L.w, L.desk_bottom], fill=(20, 16, 44))
            d.line([(0, L.desk_y), (L.w, L.desk_y)], fill=(0, 224, 255), width=6)

    # ---- high-CTR thumbnail
    def thumbnail(
        self,
        plan: Dict[str, Any],
        out_path: Path,
        fallback_frame: Optional[np.ndarray] = None,
        chars: Optional[Sequence[Character]] = None,
    ) -> Path:
        L = self.L
        chars = list(chars or cast_from_plan(plan.get("cast", []), self.hero_name))
        hero = next((c for c in chars if c.id == "hero"), chars[0])
        second_char = next((c for c in chars if c.id != hero.id), None)
        bg_name = plan.get("background") or infer_background_from_text(plan.get("topic", ""), plan.get("format", "solo"))

        if L.name != "wide":
            # Also save a crisp vertical cover frame for Shorts/Reels!
            if fallback_frame is not None:
                Image.fromarray(fallback_frame).save(out_path, quality=92)
            return out_path

        img = self._bg(bg_name, True).copy()
        d = ImageDraw.Draw(img)

        # Draw 1 or 2 expressive characters on the left side for maximum click-through rate
        if second_char is not None:
            av2 = draw_avatar("angry_roast", 0.8, False, second_char.look).resize((int(AV_W * 0.98), int(AV_H * 0.98)), Image.LANCZOS)
            img.paste(av2, (360, L.h - av2.height + 70), av2)
        av = draw_avatar("shocked", 1.0, False, hero.look).resize((int(AV_W * 1.18), int(AV_H * 1.18)), Image.LANCZOS)
        img.paste(av, (10, L.h - av.height + 85), av)

        # Viral badge above text
        badge_txt = "VIRAL AI ROAST" if plan.get("format") != "talent_roast" else "LATENT STYLE ROAST"
        bf = _font(42, str(self.assets))
        btw = d.textlength(badge_txt, font=bf)
        d.rounded_rectangle([940, 110, 940 + btw + 56, 182], radius=20, fill=(235, 24, 45), outline=(255, 255, 255), width=4)
        d.text((968, 122), badge_txt, font=bf, fill=(255, 255, 255))

        text = _txt(plan.get("thumbnail_text") or plan.get("video_title", "")).upper() or "MKVERSE 3D"
        box_w = 900
        for size in range(180, 70, -10):
            f = _font(size, str(self.assets))
            lines = _wrap(d, text, f, box_w)
            if len(lines) <= 3 and all(d.textlength(l, font=f) <= box_w for l in lines):
                break
        y = max(210, (L.h - len(lines) * size * 1.16) / 2 + 20)
        for i, line in enumerate(lines):
            d.text(
                (945, y),
                line,
                font=f,
                fill=(255, 226, 0) if i % 2 == 0 else (255, 255, 255),
                stroke_width=12,
                stroke_fill=(0, 0, 0),
            )
            y += size * 1.16
        if self._logo is not None:
            img.paste(self._logo, (L.w - self._logo.width - 40, 40), self._logo)
        img.resize((1280, 720), Image.LANCZOS).save(out_path, quality=92)
        return out_path

    # ---- main
    def render(
        self,
        plan: Dict[str, Any],
        voice: Dict[str, Any],
        sfx: Dict[str, Path],
        out_mp4: Path,
        fps: int = 24,
        avatar_video: Optional[Path] = None,
        show_progress: bool = True,
    ) -> Path:
        from moviepy.editor import AudioFileClip, CompositeAudioClip, VideoClip, VideoFileClip

        L = self.L
        scenes = plan["scenes"]
        fmt = plan.get("format", "solo")
        default_bg = plan.get("background") or infer_background_from_text(plan.get("topic", ""), fmt)
        chars: List[Character] = cast_from_plan(plan.get("cast", []), self.hero_name)
        vclip = VideoFileClip(str(avatar_video), audio=False) if avatar_video else None
        if vclip is not None:
            chars = chars[:1]
        n = len(chars)
        pos = slots(L, n)
        idx_of = {c.id: i for i, c in enumerate(chars)}

        audio_path = Path(voice["audio_path"])
        words = voice["words"]
        voice_clip = AudioFileClip(str(audio_path))
        duration = float(voice_clip.duration) + 0.45
        env = audio_envelope(audio_path)
        windows = (
            [tuple(w) for w in voice["scene_windows"]]
            if voice.get("scene_windows") and len(voice["scene_windows"]) == len(scenes)
            else scene_windows(plan, words, duration)
        )
        starts = [w[0] for w in windows]
        chunks = caption_chunks(words, L.cap_words)
        chunk_starts = [c[0]["start"] for c in chunks]

        mx, my, mw, mh = L.meme
        memes = [make_meme_card(sc.get("meme_card"), sc.get("meme_asset"), self.assets, (mw, mh)) for sc in scenes]
        scene_bgs = [
            sc.get("background") if sc.get("background") in BACKGROUNDS else infer_background_from_text(sc.get("spoken_line", ""), fmt, default_bg)
            for sc in scenes
        ]

        custom_img = None
        if n == 1 and vclip is None and self._custom.exists():
            custom_img = ImageOps.fit(Image.open(self._custom).convert("RGBA"), (AV_W, AV_W), Image.LANCZOS)

        def make_frame(t: float) -> np.ndarray:
            si = min(max(0, bisect.bisect_right(starts, t) - 1), len(scenes) - 1)
            scene = scenes[si]
            s0, s1 = windows[si]
            prog = min(1.0, max(0.0, (t - s0) / max(s1 - s0, 0.1)))
            mouth = float(env[min(int(t * 50), len(env) - 1)])
            speaker = idx_of.get(scene.get("speaker"), 0)
            bg_name = scene_bgs[si]
            img = self._bg(bg_name, ring=(n == 1)).copy()
            d = ImageDraw.Draw(img)

            if n == 1 and bg_name == "cyber_studio":
                r = int(14 * mouth)
                rx0, ry0, rx1, ry1 = L.ring
                d.ellipse([rx0 - r, ry0 - r, rx1 + r, ry1 + r], outline=(0, 224, 255), width=5)

            cam = scene["camera_motion"]
            zoom, dx, dy = 1.0, 0.0, -10.0 * mouth
            if cam == "zoom_in":
                zoom = 1.0 + 0.10 * prog
            elif cam == "shake":
                dx, dy = 9 * math.sin(t * 47), dy + 7 * math.cos(t * 57)
            elif cam == "bounce":
                dy -= abs(math.sin(t * 9)) * 22
            elif cam == "pan_center":
                dx = 34 * math.sin(t * 1.4)

            order = [i for i in range(n) if i != speaker] + [speaker]  # speaker drawn last = in front
            for i in order:
                ch = chars[i]
                cx, cy, s = pos[i]
                is_sp = i == speaker
                if is_sp:
                    expr, m, blink = scene["character_expression"], mouth, (t % 3.3) > 3.15
                    ddx, ddy, z = dx, dy, zoom * (1.06 if n > 1 else 1.0)
                else:
                    expr, m, blink = scene.get("reaction_expression") or "smirking", 0.0, ((t + i * 0.9) % 3.7) > 3.55
                    ddx, ddy, z = 0.0, 4.0 * math.sin(t * 2.2 + i * 1.7), 1.0
                if vclip is not None:
                    fr = Image.fromarray(vclip.get_frame(min(t, max(vclip.duration - 0.05, 0)))).convert("RGBA")
                    layer = ImageOps.fit(fr, (AV_W, AV_W), Image.LANCZOS)
                    ratio = s * z
                elif custom_img is not None:
                    layer, ratio = custom_img, s * z
                else:
                    cache_scale = round(min(s * 1.18, 1.0), 2)
                    layer = self._avatar(ch, expr, m, blink, (n > 1 and not is_sp), cache_scale)
                    ratio = s * z / cache_scale
                if abs(ratio - 1.0) > 0.004:
                    layer = layer.resize((max(1, int(layer.width * ratio)), max(1, int(layer.height * ratio))), Image.BILINEAR)
                img.paste(layer, (int(cx - layer.width / 2 + ddx), int(cy - layer.height / 2 + ddy)), layer)

            # Desk + stage props (buzzers, mics, etc.)
            self._draw_desk_props(img, bg_name, fmt, pos, chars, speaker, scene.get("sfx", "none"))
            if n > 1:
                for i, ch in enumerate(chars):
                    self._name_tag(img, ch.name, pos[i][0], i == speaker, ch.color, n_chars=n)

            # Meme pop-up (own cards / own images) for ~2.8 s at the start of a scene
            card = memes[si]
            since = t - s0 - 0.25
            if card is not None and 0 <= since <= 2.8:
                k = 0.82 + 0.18 * min(1.0, since / 0.16)
                if since > 2.6:
                    k *= 1 - (since - 2.6) / 0.2 * 0.15
                pic = card if abs(k - 1) < 0.01 else card.resize((int(card.width * k), int(card.height * k)), Image.BILINEAR)
                img.paste(pic, (int(mx - pic.width / 2), int(my - pic.height / 2)), pic)

            self._draw_banner(img, scene.get("meme_banner", ""), t - s0)
            ci = bisect.bisect_right(chunk_starts, t) - 1
            if ci >= 0 and t < duration - 0.1:
                self._draw_caption(img, chunks[ci], t, chars[speaker].color)

            d = ImageDraw.Draw(img)
            if show_progress:
                d.rectangle([0, L.prog_y, int(L.w * min(t / duration, 1.0)), L.prog_y + 12], fill=(255, 214, 10))
            if self.handle:
                hf = _font(L.handle_size, str(self.assets))
                hw = d.textlength(self.handle, font=hf)
                d.text(((L.w - hw) / 2, L.handle_y), self.handle, font=hf, fill=(210, 200, 255), stroke_width=4, stroke_fill=(0, 0, 0))
            if self._logo is not None:
                img.paste(self._logo, L.logo_xy, self._logo)
            return np.asarray(img)

        # audio: voice + scene SFX + censor tones over bleeped words
        tracks = [voice_clip]
        opened = []
        for (s0, _), sc in zip(windows, scenes):
            name = sc.get("sfx", "none")
            if name in sfx:
                c = AudioFileClip(str(sfx[name])).volumex(0.5)
                opened.append(c)
                lead = 0.12 if name == "whoosh" else 0.04
                tracks.append(c.set_start(max(s0 - lead, 0.0)))
        if "censor_beep" in sfx:
            for a, b in voice.get("bleeps", []):
                c = AudioFileClip(str(sfx["censor_beep"])).volumex(0.6)
                opened.append(c)
                tracks.append(c.subclip(0, min(c.duration, max(b - a, 0.25) + 0.05)).set_start(max(a - 0.02, 0.0)))
        mix = CompositeAudioClip(tracks).set_duration(duration)

        out_mp4.parent.mkdir(parents=True, exist_ok=True)
        video = VideoClip(make_frame, duration=duration).set_audio(mix)
        log.info("rendering %.1fs %s video (%d character%s, bg=%s) -> %s", duration, L.name, n, "" if n == 1 else "s", default_bg, out_mp4)
        try:
            video.write_videofile(
                str(out_mp4),
                fps=fps,
                codec="libx264",
                audio_codec="aac",
                preset="medium",
                threads=os.cpu_count() or 4,
                temp_audiofile=str(out_mp4.with_suffix(".temp-audio.m4a")),
                remove_temp=True,
                ffmpeg_params=["-pix_fmt", "yuv420p", "-crf", "20", "-movflags", "+faststart"],
                logger=None,
            )
            self.thumbnail(plan, out_mp4.with_name("thumbnail.jpg"), make_frame(min(1.4, duration / 3)), chars)
        finally:
            for c in [voice_clip, *opened, vclip]:
                try:
                    if c is not None:
                        c.close()
                except Exception:
                    pass
        return out_mp4
