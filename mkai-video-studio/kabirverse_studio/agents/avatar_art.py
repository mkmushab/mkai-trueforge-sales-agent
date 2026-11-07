"""
Anti-aliased 3D-style cartoon avatar engine (v5 Mega-Cast).
Supports all 1,000 characters in `agents.cast.CAST`:
- Hair styles: quiff, bun, long, bald, cap, curly, ponytail, turban, spikes, bob
- Outfit styles: hoodie, shirt, saree, blazer, kurta, gym_vest, leather_jacket, tshirt
- Accessories: headphones, glasses, sunglasses, moustache, beard, bindi, earrings, chain
- Expressions: shocked, smirking, laughing, facepalm, angry_roast
"""
from __future__ import annotations

from PIL import Image, ImageDraw

from agents.cast import Look

AV_W, AV_H, K = 820, 900, 2  # avatar layer (final px) and supersampling factor
DARK = (24, 20, 34)


def mouth_patch(w: int, h: int) -> Image.Image:
    """Open-mouth interior (dark red, tongue, upper teeth) clipped to an ellipse."""
    w, h = max(w, 8), max(h, 8)
    body = Image.new("RGB", (w, h), (118, 16, 40))
    d = ImageDraw.Draw(body)
    d.ellipse([w * 0.18, h * 0.52, w * 0.82, h * 1.25], fill=(232, 96, 116))
    d.rectangle([w * 0.10, 0, w * 0.90, max(h * 0.24, 6)], fill=(250, 250, 250))
    mask = Image.new("L", (w, h), 0)
    ImageDraw.Draw(mask).ellipse([0, 0, w - 1, h - 1], fill=255)
    patch = body.convert("RGBA")
    patch.putalpha(mask)
    return patch


def draw_avatar(expr: str, mouth: float, blink: bool, look: Look) -> Image.Image:
    k = K
    layer = Image.new("RGBA", (AV_W * k, AV_H * k), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)

    def box(x0, y0, x1, y1):
        return [x0 * k, y0 * k, x1 * k, y1 * k]

    def pts(seq):
        return [(x * k, y * k) for x, y in seq]

    skin, sh, hair = look.skin, look.skin_sh, look.hair
    blush = (min(255, skin[0] + 4), max(0, skin[1] - 35), max(0, skin[2] - 9))
    acc = set(look.acc)
    cx = 410

    # ---- body / outfit
    ostyle = look.outfit_style
    if ostyle == "hoodie":
        d.ellipse(box(150, 650, 670, 1060), fill=look.outfit_dk)
        d.rounded_rectangle(box(110, 700, 710, 1100), radius=140 * k, fill=look.outfit)
    elif ostyle == "gym_vest":
        # broad shoulders exposed + tank top
        d.rounded_rectangle(box(115, 700, 705, 1100), radius=135 * k, fill=skin)
        d.polygon(pts([(225, 695), (335, 695), (365, 815), (455, 815), (485, 695), (595, 695), (625, 1100), (195, 1100)]), fill=look.outfit)
        d.line(pts([(225, 695), (365, 815), (455, 815), (595, 695)]), fill=look.accent, width=8 * k)
    else:
        d.rounded_rectangle(box(110, 700, 710, 1100), radius=140 * k, fill=look.outfit)

    # neck
    d.rectangle(box(345, 560, 475, 700), fill=sh)

    # outfit details
    if ostyle == "hoodie":
        d.line(pts([(370, 690), (360, 800)]), fill=look.accent, width=7 * k)
        d.line(pts([(450, 690), (460, 800)]), fill=look.accent, width=7 * k)
        d.arc(box(300, 640, 520, 760), 20, 160, fill=look.accent, width=8 * k)
    elif ostyle == "shirt":
        d.polygon(pts([(370, 690), (410, 775), (450, 690)]), fill=sh)
        d.polygon(pts([(322, 660), (410, 770), (336, 782)]), fill=look.accent)
        d.polygon(pts([(498, 660), (410, 770), (484, 782)]), fill=look.accent)
        for by in (830, 900, 970):
            d.ellipse(box(402, by, 418, by + 16), fill=look.accent)
    elif ostyle == "blazer":
        # inner shirt + tie/lapels
        d.polygon(pts([(330, 690), (490, 690), (445, 1050), (375, 1050)]), fill=(245, 245, 250))
        d.polygon(pts([(396, 720), (424, 720), (434, 960), (410, 1000), (386, 960)]), fill=look.accent)
        d.polygon(pts([(270, 690), (365, 690), (385, 950), (295, 860)]), fill=look.outfit_dk)
        d.polygon(pts([(550, 690), (455, 690), (435, 950), (525, 860)]), fill=look.outfit_dk)
    elif ostyle == "leather_jacket":
        d.polygon(pts([(345, 690), (475, 690), (455, 1060), (365, 1060)]), fill=look.accent)
        d.polygon(pts([(250, 690), (360, 690), (370, 920), (260, 830)]), fill=look.outfit_dk, outline=(190, 195, 210), width=4 * k)
        d.polygon(pts([(570, 690), (460, 690), (450, 920), (560, 830)]), fill=look.outfit_dk, outline=(190, 195, 210), width=4 * k)
    elif ostyle == "kurta":
        d.arc(box(330, 645, 490, 755), 10, 170, fill=look.accent, width=9 * k)
        d.line(pts([(410, 700), (410, 940)]), fill=look.accent, width=8 * k)
        for by in (760, 830, 900):
            d.ellipse(box(398, by, 422, by + 20), fill=look.accent)
    elif ostyle == "tshirt":
        d.chord(box(325, 650, 495, 755), 0, 180, fill=sh)
        d.arc(box(320, 645, 500, 760), 5, 175, fill=look.accent, width=10 * k)
    else:  # saree: pallu draped over the shoulder + gold border
        d.polygon(pts([(150, 712), (270, 690), (700, 1010), (520, 1100), (110, 900)]), fill=look.accent)
        d.polygon(pts([(190, 730), (262, 714), (640, 1020), (560, 1060)]), fill=look.outfit_dk)
        d.arc(box(330, 640, 490, 740), 10, 170, fill=look.accent, width=8 * k)

    if "chain" in acc:
        d.arc(box(315, 655, 505, 835), 15, 165, fill=(255, 215, 0), width=9 * k)

    # ---- hair (back), ears, head
    hs = look.hair_style
    if hs in ("quiff", "cap", "spikes", "curly"):
        d.ellipse(box(190, 90, 630, 420), fill=hair)
    elif hs == "bun":
        d.ellipse(box(190, 100, 630, 420), fill=hair)
        d.ellipse(box(345, 28, 475, 150), fill=hair)
    elif hs == "ponytail":
        d.ellipse(box(190, 95, 630, 420), fill=hair)
        d.ellipse(box(540, 130, 690, 390), fill=hair)
    elif hs == "long":
        d.ellipse(box(160, 95, 660, 640), fill=hair)
    elif hs == "bob":
        d.ellipse(box(168, 95, 652, 520), fill=hair)
    elif hs == "turban":
        d.ellipse(box(165, 55, 655, 385), fill=look.accent)
    elif hs == "bald":
        d.ellipse(box(176, 290, 250, 440), fill=hair)
        d.ellipse(box(570, 290, 644, 440), fill=hair)

    d.ellipse(box(176, 350, 246, 450), fill=sh)
    d.ellipse(box(574, 350, 644, 450), fill=sh)
    d.ellipse(box(212, 130, 608, 600), fill=skin, outline=sh, width=3 * k)

    # ---- hair (front)
    fringe = [
        (212, 340), (236, 220), (300, 150), (410, 120), (520, 150), (584, 220), (608, 340),
        (572, 262), (512, 224), (436, 214), (360, 224), (298, 266),
    ]
    if hs in ("quiff", "bun", "long", "ponytail", "bob"):
        d.polygon(pts(fringe), fill=hair)
    if hs == "quiff":
        d.ellipse(box(318, 58, 508, 170), fill=hair)
    elif hs == "spikes":
        d.polygon(pts(fringe), fill=hair)
        for sx in (260, 330, 405, 480, 545):
            d.polygon(pts([(sx - 38, 150), (sx, 42), (sx + 38, 150)]), fill=hair)
    elif hs == "curly":
        for cx_c, cy_c, r_c in ((250, 190, 58), (320, 140, 65), (410, 122, 70), (500, 140, 65), (570, 190, 58), (225, 265, 48), (595, 265, 48)):
            d.ellipse(box(cx_c - r_c, cy_c - r_c, cx_c + r_c, cy_c + r_c), fill=hair)
    elif hs == "long":
        d.polygon(pts([(212, 330), (226, 470), (262, 596), (248, 400)]), fill=hair)
        d.polygon(pts([(608, 330), (594, 470), (558, 596), (572, 400)]), fill=hair)
    elif hs == "bob":
        d.polygon(pts([(200, 310), (210, 500), (260, 515), (248, 360)]), fill=hair)
        d.polygon(pts([(620, 310), (610, 500), (560, 515), (572, 360)]), fill=hair)
    elif hs == "turban":
        d.chord(box(175, 55, 645, 360), 175, 5, fill=look.outfit)
        d.polygon(pts([(200, 250), (410, 195), (620, 250), (608, 140), (410, 85), (212, 140)]), fill=look.accent)
        d.line(pts([(220, 180), (410, 235), (600, 180)]), fill=look.outfit_dk, width=7 * k)
    elif hs == "cap":
        d.chord(box(204, 70, 616, 400), 180, 360, fill=look.accent)
        d.rounded_rectangle(box(196, 228, 640, 272), radius=22 * k, fill=look.accent, outline=DARK, width=3 * k)

    # ---- headphones
    if "headphones" in acc:
        d.arc(box(184, 60, 636, 560), 188, 352, fill=look.accent, width=20 * k)
        for x0 in (160, 580):
            d.rounded_rectangle(box(x0, 320, x0 + 80, 480), radius=30 * k, fill=(32, 30, 54), outline=look.accent, width=7 * k)

    # ---- cheeks + nose
    d.ellipse(box(262, 420, 330, 470), fill=blush)
    d.ellipse(box(490, 420, 558, 470), fill=blush)
    d.ellipse(box(392, 418, 428, 446), fill=sh)

    # ---- eyes
    ex, ey = (340, 480), 352
    lid = expr in ("smirking", "facepalm")
    for x in ex:
        if blink or expr == "laughing":
            d.arc(box(x - 40, ey - 26, x + 40, ey + 34), 200, 340, fill=DARK, width=11 * k)
            continue
        ry, rx = (54, 46) if expr == "shocked" else (44, 40)
        d.ellipse(box(x - rx, ey - ry, x + rx, ey + ry), fill=(255, 255, 255), outline=DARK, width=3 * k)
        ir = 15 if expr == "shocked" else 22
        d.ellipse(box(x - ir + 4, ey - ir, x + ir + 4, ey + ir), fill=(60, 40, 30))
        d.ellipse(box(x - 4, ey - 8, x + 12, ey + 8), fill=(10, 8, 14))
        d.ellipse(box(x + 6, ey - 14, x + 16, ey - 4), fill=(255, 255, 255))
        if lid:
            d.pieslice(box(x - rx - 2, ey - ry - 2, x + rx + 2, ey + ry + 2), 180, 360, fill=skin)
            d.line(pts([(x - rx, ey), (x + rx, ey)]), fill=DARK, width=7 * k)

    # ---- glasses / sunglasses
    if "glasses" in acc:
        for x in ex:
            d.ellipse(box(x - 54, ey - 54, x + 54, ey + 54), outline=DARK, width=7 * k)
        d.line(pts([(394, ey), (426, ey)]), fill=DARK, width=7 * k)
    if "sunglasses" in acc:
        for x in ex:
            d.rounded_rectangle(box(x - 60, ey - 40, x + 60, ey + 38), radius=20 * k, fill=(14, 12, 20), outline=(60, 60, 80), width=3 * k)
            d.line(pts([(x - 36, ey - 22), (x - 8, ey - 22)]), fill=(120, 120, 160), width=5 * k)
        d.line(pts([(400, ey - 6), (420, ey - 6)]), fill=(14, 12, 20), width=9 * k)

    # ---- brows
    bw = 14 * k
    if expr == "shocked":
        L, R = [(290, 262), (385, 248)], [(435, 248), (530, 262)]
    elif expr == "angry_roast":
        L, R = [(288, 282), (386, 318)], [(434, 318), (532, 282)]
    elif expr == "smirking":
        L, R = [(292, 300), (388, 296)], [(434, 276), (530, 296)]
    elif expr == "facepalm":
        L, R = [(292, 296), (388, 306)], [(434, 306), (530, 296)]
    else:
        L, R = [(292, 290), (388, 286)], [(434, 286), (530, 290)]
    for seg in (L, R):
        d.line(pts(seg), fill=hair, width=bw)
        for px, py in seg:
            d.ellipse([px * k - bw // 2, py * k - bw // 2, px * k + bw // 2, py * k + bw // 2], fill=hair)

    # ---- moustache / beard (before the mouth so the mouth sits on top)
    if "beard" in acc:
        d.pieslice(box(292, 440, 528, 650), 0, 180, fill=hair)
    if "moustache" in acc:
        d.ellipse(box(346, 452, 414, 486), fill=hair)
        d.ellipse(box(406, 452, 474, 486), fill=hair)

    # ---- mouth (audio-driven)
    my = 510
    m = max(0.0, min(1.0, mouth))
    lip = look.lip
    if m < 0.07:
        if expr == "smirking":
            d.arc(box(cx - 50, my - 28, cx + 70, my + 22), 15, 150, fill=lip, width=8 * k)
        elif expr == "angry_roast":
            d.line(pts([(cx - 52, my + 8), (cx + 52, my + 8)]), fill=lip, width=9 * k)
        else:
            d.arc(box(cx - 55, my - 30, cx + 55, my + 24), 20, 160, fill=lip, width=8 * k)
    else:
        if expr == "shocked":
            mw, mh = 26 + 22 * m, 30 + 56 * m
        elif expr == "laughing":
            mw, mh = 66 + 30 * m, 34 + 62 * m
        elif expr == "angry_roast":
            mw, mh = 70 + 22 * m, 18 + 54 * m
        else:
            mw, mh = 40 + 26 * m, 16 + 46 * m
        x0, y0 = int((cx - mw) * k), int((my - mh * 0.35) * k)
        patch = mouth_patch(int(2 * mw * k), int(mh * k))
        layer.alpha_composite(patch, dest=(x0, y0))
        d.ellipse([x0, y0, x0 + patch.width, y0 + patch.height], outline=lip if lip != DARK else DARK, width=5 * k)

    # ---- bindi, earrings
    if "bindi" in acc:
        d.ellipse(box(401, 252, 419, 270), fill=(210, 20, 40))
    if "earrings" in acc:
        for x in (204, 616):
            d.ellipse(box(x - 12, 452, x + 12, 476), fill=(255, 200, 60), outline=(200, 140, 20), width=2 * k)

    # ---- facepalm hand
    if expr == "facepalm":
        d.rounded_rectangle(box(236, 300, 400, 500), radius=70 * k, fill=skin, outline=sh, width=4 * k)
        for fx in (252, 288, 324, 360):
            d.rounded_rectangle(box(fx, 250, fx + 30, 360), radius=15 * k, fill=skin, outline=sh, width=3 * k)

    return layer.resize((AV_W, AV_H), Image.LANCZOS)
