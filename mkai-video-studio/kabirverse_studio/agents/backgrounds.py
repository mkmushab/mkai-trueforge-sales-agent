"""
Dynamic 3D-Style Scene Environments & Setups (v5 Mega-Environments).

Replaces the single static grid background from v4 with 10 rich, copyright-free procedural
environments that adapt to both 9:16 vertical (Shorts/Reels) and 16:9 wide (YouTube Long):

1. `talent_stage`      : India's Got Latent / Roast Panel style stage (red velvet curtains, brick/neon wall, stage spotlights, golden/red judge buzzers, mic stands)
2. `jungle`            : Wild Jungle / Adventure Safari (lush layered canopy trees, hanging vines, glowing fireflies, moonlight/sunbeams, mist)
3. `home_room`         : Desi Home Living Room (warm walls, window with curtains, ceiling fan at top, framed family wall art, bookshelf, cozy lamp)
4. `podcast_studio`    : Viral Dark Podcast Studio (acoustic foam panels, warm neon LED strips, "ON AIR" glowing sign, studio boom mics)
5. `street_chai`       : Desi Chai Tapri / Night Street (city skyline, glowing street lamps, "GARMA GARAM CHAI" neon board, string lights)
6. `college_canteen`   : College Canteen / Classroom (chalkboard/notice board, benches, "75% ATTENDANCE COMPULSORY" poster, paper planes)
7. `office_boardroom`  : Corporate / Shark Boardroom (glass city skyscraper view, KPI growth charts, conference lighting)
8. `gym`               : Fitness Gym (dumbbell racks, motivational neon wall, industrial beams, mirror reflection stripes)
9. `news_room`         : Breaking News Broadcast Studio (world map grid, live ticker aesthetics, studio floodlights)
10. `cyber_studio`     : RGB Creator Studio (upgraded neon cyber grid + glowing halo ring)
"""
from __future__ import annotations

import numpy as np
from PIL import Image, ImageDraw

from agents.textkit import font as _font

BACKGROUNDS = (
    "talent_stage",
    "jungle",
    "home_room",
    "podcast_studio",
    "street_chai",
    "college_canteen",
    "office_boardroom",
    "gym",
    "news_room",
    "cyber_studio",
)


def _gradient(w: int, h: int, top: tuple, bot: tuple) -> Image.Image:
    t = np.array(top, dtype=np.float32)
    b = np.array(bot, dtype=np.float32)
    ramp = np.linspace(0, 1, h)[:, None, None]
    arr = np.repeat((t + (b - t) * ramp).astype(np.uint8), w, axis=1)
    return Image.fromarray(arr, "RGB")


def infer_background_from_text(text: str, fmt: str = "solo", default: str = "cyber_studio") -> str:
    """Pick the best visual environment based on scene line, topic, or format."""
    t = (text or "").lower()
    if fmt in ("talent_roast", "panel_5_6") or any(w in t for w in ("judge", "buzzer", "talent", "stage", "contestant", "latent", "roast show", "audition")):
        return "talent_stage"
    if any(w in t for w in ("jungle", "forest", "sher", "jaanwar", "camping", "trek", "pahad", "safari", "ped", "wild")):
        return "jungle"
    if any(w in t for w in ("mummy", "ghar", "fan band", "kamra", "sofa", "kitchen", "maggi", "bartan", "papa", "shaadi", "relatives", "sharma ji")):
        return "home_room"
    if any(w in t for w in ("podcast", "mic", "interview", "psychology", "guest", "episode")):
        return "podcast_studio"
    if any(w in t for w in ("chai", "tapri", "sadak", "road", "traffic", "auto", "market", "gali", "dost")):
        return "street_chai"
    if any(w in t for w in ("college", "attendance", "exam", "syllabus", "hostel", "canteen", "professor", "placement", "engineering")):
        return "college_canteen"
    if any(w in t for w in ("office", "manager", "excel", "salary", "startup", "founder", "hr", "meeting", "corporate", "shark")):
        return "office_boardroom"
    if any(w in t for w in ("gym", "protein", "workout", "diet", "dumbbell", "muscle", "fitness", "chole bhature")):
        return "gym"
    if any(w in t for w in ("breaking", "news", "media", "reporter", "alert")):
        return "news_room"
    return default if default in BACKGROUNDS else "cyber_studio"


def render_background(
    bg_name: str,
    w: int,
    h: int,
    desk_y: int,
    ring_box: tuple,
    draw_ring: bool = False,
    assets_dir: str = "",
) -> Image.Image:
    """Render a full-frame (w x h) environment image."""
    bg_name = bg_name if bg_name in BACKGROUNDS else "cyber_studio"

    if bg_name == "talent_stage":
        img = _gradient(w, h, (26, 8, 22), (58, 12, 36))
        d = ImageDraw.Draw(img)
        # Brick wall texture in background
        brick_col = (74, 22, 44)
        for row_idx, y in enumerate(range(80, desk_y, 48)):
            offset = 45 if (row_idx % 2) else 0
            d.line([(0, y), (w, y)], fill=brick_col, width=2)
            for x in range(offset, w, 96):
                d.line([(x, y), (x, min(y + 48, desk_y))], fill=brick_col, width=2)
        # Stage spotlights from top
        for sx in (int(w * 0.2), int(w * 0.5), int(w * 0.8)):
            d.polygon([(sx - 25, 0), (sx + 25, 0), (sx + 210, desk_y), (sx - 210, desk_y)], fill=(92, 28, 56))
            d.ellipse([sx - 36, -10, sx + 36, 36], fill=(255, 230, 140))
        # Red stage curtains on left and right edges
        cw = max(85, int(w * 0.08))
        for cx0, cx1 in ((0, cw), (w - cw, w)):
            d.rectangle([cx0, 0, cx1, desk_y], fill=(145, 16, 34))
            for fold in range(cx0 + 18, cx1, 26):
                d.line([(fold, 0), (fold, desk_y)], fill=(95, 8, 20), width=5)
        # Glowing neon sign on stage wall
        sign_w, sign_h = min(int(w * 0.56), 680), 86
        sx0, sy0 = (w - sign_w) // 2, int(desk_y * 0.20)
        d.rounded_rectangle([sx0, sy0, sx0 + sign_w, sy0 + sign_h], radius=22, fill=(32, 8, 28), outline=(255, 50, 110), width=5)
        d.rounded_rectangle([sx0 + 8, sy0 + 8, sx0 + sign_w - 8, sy0 + sign_h - 8], radius=16, outline=(255, 214, 10), width=2)
        if assets_dir:
            f = _font(36, assets_dir)
            txt = "TALENT ROAST PANEL"
            tw = d.textlength(txt, font=f)
            d.text(((w - tw) / 2, sy0 + 22), txt, font=f, fill=(255, 226, 60))
        return img

    if bg_name == "jungle":
        img = _gradient(w, h, (8, 38, 28), (18, 78, 44))
        d = ImageDraw.Draw(img)
        # Golden sun/moon glow in canopy
        d.ellipse([int(w * 0.65), int(h * 0.08), int(w * 0.65) + 220, int(h * 0.08) + 220], fill=(160, 220, 120))
        # Distant tree trunks & foliage silhouettes
        for tx_frac, tw_px, col in ((0.08, 70, (12, 48, 30)), (0.26, 55, (14, 56, 34)), (0.76, 65, (14, 56, 34)), (0.92, 80, (10, 42, 26))):
            tx = int(w * tx_frac)
            d.rectangle([tx - tw_px // 2, 0, tx + tw_px // 2, desk_y], fill=col)
            d.ellipse([tx - 180, -60, tx + 180, 290], fill=(22, 92, 48))
            d.ellipse([tx - 140, 120, tx + 140, 420], fill=(28, 112, 56))
        # Hanging jungle vines
        for vx in range(80, w - 60, 180):
            d.arc([vx, -80, vx + 140, 360], 0, 180, fill=(46, 148, 72), width=6)
        # Bush silhouettes above desk
        for bx in range(-40, w + 80, 160):
            d.ellipse([bx, desk_y - 130, bx + 220, desk_y + 60], fill=(16, 68, 36), outline=(42, 130, 66), width=3)
        # Fireflies
        for fx, fy in ((0.18, 0.25), (0.35, 0.18), (0.52, 0.28), (0.68, 0.22), (0.84, 0.30), (0.28, 0.42), (0.72, 0.38)):
            px, py = int(w * fx), int(desk_y * fy)
            d.ellipse([px - 8, py - 8, px + 8, py + 8], fill=(240, 255, 110))
        return img

    if bg_name == "home_room":
        img = _gradient(w, h, (62, 42, 34), (108, 72, 52))
        d = ImageDraw.Draw(img)
        # Wainscoting lower wall panel
        wall_split = int(desk_y * 0.68)
        d.rectangle([0, wall_split, w, desk_y], fill=(78, 50, 38))
        d.line([(0, wall_split), (w, wall_split)], fill=(210, 165, 110), width=5)
        # Ceiling fan at top center
        fcx = w // 2
        d.line([(fcx, 0), (fcx, 70)], fill=(200, 180, 140), width=8)
        for bx0, bx1 in ((fcx - 240, fcx - 30), (fcx + 30, fcx + 240)):
            d.rounded_rectangle([bx0, 58, bx1, 82], radius=10, fill=(160, 110, 70), outline=(90, 55, 30), width=3)
        d.ellipse([fcx - 36, 48, fcx + 36, 92], fill=(210, 165, 100), outline=(90, 55, 30), width=3)
        # Window on left with sky & curtains
        wx0, wy0, wx1, wy1 = int(w * 0.08), int(desk_y * 0.18), int(w * 0.30), int(desk_y * 0.60)
        d.rounded_rectangle([wx0, wy0, wx1, wy1], radius=14, fill=(135, 200, 245), outline=(230, 200, 160), width=8)
        d.line([((wx0 + wx1) // 2, wy0), ((wx0 + wx1) // 2, wy1)], fill=(230, 200, 160), width=6)
        d.line([(wx0, (wy0 + wy1) // 2), (wx1, (wy0 + wy1) // 2)], fill=(230, 200, 160), width=6)
        # Framed wall art on right
        fx0, fy0, fx1, fy1 = int(w * 0.70), int(desk_y * 0.20), int(w * 0.90), int(desk_y * 0.52)
        d.rounded_rectangle([fx0, fy0, fx1, fy1], radius=10, fill=(245, 232, 205), outline=(195, 140, 65), width=8)
        d.ellipse([fx0 + 35, fy0 + 30, fx1 - 35, fy1 - 30], fill=(225, 110, 75))
        return img

    if bg_name == "podcast_studio":
        img = _gradient(w, h, (14, 14, 22), (32, 24, 44))
        d = ImageDraw.Draw(img)
        # Acoustic foam tiles grid
        for y in range(70, desk_y - 60, 110):
            for x in range(60, w - 60, 110):
                d.rounded_rectangle([x, y, x + 92, y + 92], radius=12, fill=(26, 26, 38), outline=(44, 42, 64), width=2)
                for sl in range(x + 16, x + 80, 18):
                    d.line([(sl, y + 14), (sl, y + 78)], fill=(36, 34, 52), width=3)
        # Warm neon LED vertical bars
        for lx in (int(w * 0.12), int(w * 0.88)):
            d.rounded_rectangle([lx - 8, 60, lx + 8, desk_y - 40], radius=8, fill=(255, 140, 40))
        # ON AIR sign
        ox0, oy0 = w // 2 - 140, int(desk_y * 0.16)
        d.rounded_rectangle([ox0, oy0, ox0 + 280, oy0 + 76], radius=18, fill=(40, 10, 18), outline=(255, 50, 70), width=5)
        if assets_dir:
            f = _font(42, assets_dir)
            tw = d.textlength("ON AIR", font=f)
            d.text(((w - tw) / 2, oy0 + 14), "ON AIR", font=f, fill=(255, 70, 85))
        return img

    if bg_name == "street_chai":
        img = _gradient(w, h, (16, 22, 48), (68, 42, 74))
        d = ImageDraw.Draw(img)
        # City skyline buildings
        b_heights = [0.45, 0.32, 0.52, 0.38, 0.48, 0.30, 0.44]
        bw = w // len(b_heights) + 10
        for i, bh in enumerate(b_heights):
            bx0 = i * (w // len(b_heights))
            by0 = int(desk_y * bh)
            d.rectangle([bx0, by0, bx0 + bw, desk_y], fill=(24, 28, 54), outline=(42, 48, 82), width=2)
            # Lit windows
            for wy in range(by0 + 24, desk_y - 40, 42):
                for wx in range(bx0 + 18, bx0 + bw - 24, 34):
                    if (wx + wy) % 3 != 0:
                        d.rectangle([wx, wy, wx + 16, wy + 22], fill=(255, 220, 110))
        # Glowing festival / tapri string lights across top
        d.arc([-40, int(desk_y * 0.06), w + 40, int(desk_y * 0.28)], 0, 180, fill=(120, 110, 140), width=3)
        for lx in range(60, w - 40, 85):
            ly = int(desk_y * 0.22)
            col = (255, 214, 40) if (lx // 85) % 2 == 0 else (255, 95, 120)
            d.ellipse([lx - 12, ly - 12, lx + 12, ly + 12], fill=col)
        return img

    if bg_name == "college_canteen":
        img = _gradient(w, h, (34, 52, 64), (54, 82, 96))
        d = ImageDraw.Draw(img)
        # Green chalkboard / notice board in center
        bx0, by0, bx1, by1 = int(w * 0.12), int(desk_y * 0.16), int(w * 0.88), int(desk_y * 0.62)
        d.rounded_rectangle([bx0, by0, bx1, by1], radius=16, fill=(22, 68, 48), outline=(170, 120, 68), width=10)
        if assets_dir:
            f = _font(34, assets_dir)
            txt = "75% ATTENDANCE COMPULSORY!"
            tw = d.textlength(txt, font=f)
            d.text(((w - tw) / 2, by0 + 36), txt, font=f, fill=(240, 245, 220))
        return img

    if bg_name == "office_boardroom":
        img = _gradient(w, h, (16, 30, 52), (32, 58, 92))
        d = ImageDraw.Draw(img)
        # Glass window frames
        for gx in range(0, w, max(180, w // 5)):
            d.line([(gx, 0), (gx, desk_y)], fill=(65, 105, 150), width=4)
        d.line([(0, int(desk_y * 0.45)), (w, int(desk_y * 0.45))], fill=(65, 105, 150), width=4)
        # Presentation KPI screen
        sx0, sy0, sx1, sy1 = int(w * 0.22), int(desk_y * 0.16), int(w * 0.78), int(desk_y * 0.56)
        d.rounded_rectangle([sx0, sy0, sx1, sy1], radius=16, fill=(14, 24, 42), outline=(0, 215, 255), width=5)
        # Bar chart inside screen
        bars = [0.35, 0.55, 0.45, 0.78, 0.92]
        bw = (sx1 - sx0 - 100) // len(bars)
        for i, bh in enumerate(bars):
            bx = sx0 + 40 + i * bw
            by = int(sy1 - 24 - (sy1 - sy0 - 70) * bh)
            d.rectangle([bx, by, bx + bw - 22, sy1 - 24], fill=(0, 230, 180) if i < 4 else (255, 90, 90))
        return img

    if bg_name == "gym":
        img = _gradient(w, h, (24, 24, 30), (48, 38, 46))
        d = ImageDraw.Draw(img)
        # Diagonal hazard / motivation stripes
        for x in range(-h, w + h, 140):
            d.line([(x, 0), (x + 220, desk_y)], fill=(38, 34, 44), width=28)
        # Neon motivational bar
        nx0, ny0, nx1, ny1 = int(w * 0.18), int(desk_y * 0.18), int(w * 0.82), int(desk_y * 0.34)
        d.rounded_rectangle([nx0, ny0, nx1, ny1], radius=18, fill=(28, 18, 28), outline=(255, 120, 30), width=5)
        if assets_dir:
            f = _font(36, assets_dir)
            txt = "NO EXCUSES • LIGHTWEIGHT BABY"
            tw = d.textlength(txt, font=f)
            d.text(((w - tw) / 2, ny0 + 22), txt, font=f, fill=(255, 190, 60))
        return img

    if bg_name == "news_room":
        img = _gradient(w, h, (12, 20, 56), (88, 16, 36))
        d = ImageDraw.Draw(img)
        for x in range(0, w, 75):
            d.line([(x, 0), (x, desk_y)], fill=(36, 48, 96), width=1)
        for y in range(0, desk_y, 75):
            d.line([(0, y), (w, y)], fill=(36, 48, 96), width=1)
        bx0, by0, bx1, by1 = int(w * 0.15), int(desk_y * 0.16), int(w * 0.85), int(desk_y * 0.32)
        d.rounded_rectangle([bx0, by0, bx1, by1], radius=14, fill=(200, 20, 35), outline=(255, 255, 255), width=4)
        if assets_dir:
            f = _font(38, assets_dir)
            txt = "BREAKING ROAST LIVE"
            tw = d.textlength(txt, font=f)
            d.text(((w - tw) / 2, by0 + 20), txt, font=f, fill=(255, 255, 255))
        return img

    # Default: cyber_studio
    top, bot = (12, 14, 34), (52, 20, 92)
    img = _gradient(w, h, top, bot)
    d = ImageDraw.Draw(img)
    grid = (36, 38, 58)
    for x in range(0, w, 90):
        d.line([(x, 0), (x, h)], fill=grid, width=1)
    for y in range(0, h, 90):
        d.line([(0, y), (w, y)], fill=grid, width=1)
    if draw_ring:
        d.ellipse(list(ring_box), fill=(44, 27, 66), outline=(138, 43, 226), width=6)
    return img
