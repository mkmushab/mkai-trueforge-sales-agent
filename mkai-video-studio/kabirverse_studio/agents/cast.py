"""
Original 3D/Cartoon Cast Engine — 1,000 Unique Fictional Characters (v5 Mega-Cast).

Features:
- Core signature cast (`hero`, `mummy`, `bunty`, `uncle`, `rocky`, `meera`, `guru`, `riya`, `arjun`, `chintu`, `dada`, `boss`, `priya`, `vikram`, `neha`)
- Deterministic procedural catalog of 1,000 unique characters (`CAST` has 1,000 entries!)
- Every character has:
    * `id`, `name`, `gender` ('M' or 'F'), `archetype`, `persona`
    * `voice` (Hindi/Indian English neural TTS voices: Madhur, Swara, Prabhat, Neerja)
    * `rate` (-14% to +28%) and `pitch` (-18Hz to +18Hz) for distinct vocal identity
    * `color` (caption highlight + name tag badge)
    * `look` (`Look` with skin tone, hair style, outfit style, colors, accessories, lip tint)
- Dynamic multi-character selection (`cast_for`) supporting:
    * `solo` (1 char — male or female lead)
    * `couple_roast` / `duet` (2 chars — boy + girl or best friends)
    * `dialogue` (3-4 or 5-6 chars talking/roasting)
    * `talent_roast` (India's Got Latent style panel: 3-4 judges + 1-2 contestants/hosts = 4 to 6 chars)
    * `podcast_panel` (3-5 chars around podcast mics)
    * Custom count `cast_size` (1 to 6 characters) or custom outfit/gender matching for YouTube Cloner (Mode 4).
"""
from __future__ import annotations

import hashlib
import random
from dataclasses import dataclass, replace
from typing import Dict, List, Optional, Sequence, Tuple

RGB = Tuple[int, int, int]


@dataclass(frozen=True)
class Look:
    skin: RGB
    skin_sh: RGB
    hair: RGB
    hair_style: str  # quiff | bun | long | bald | cap | curly | ponytail | turban | spikes | bob
    outfit: RGB
    outfit_dk: RGB
    outfit_style: str  # hoodie | shirt | saree | blazer | kurta | gym_vest | leather_jacket | tshirt
    accent: RGB
    acc: Tuple[str, ...] = ()  # headphones glasses sunglasses moustache beard bindi earrings chain mic_headset cap_badge
    lip: RGB = (24, 20, 34)


@dataclass(frozen=True)
class Character:
    id: str
    name: str
    persona: str
    voice: str
    rate: int  # speaking-rate offset in %
    pitch: int  # Hz offset
    color: RGB  # caption highlight + name tag
    look: Look
    gender: str = "M"  # 'M' | 'F'
    archetype: str = "creator"

    @property
    def tag(self) -> str:
        return self.name.upper()


MADHUR = "hi-IN-MadhurNeural"
SWARA = "hi-IN-SwaraNeural"
PRABHAT = "en-IN-PrabhatNeural"
NEERJA = "en-IN-NeerjaNeural"

# ---------------------------------------------------------------------------
# 1. Core Curated Cast (16 signature personalities, backward-compatible with v4)
# ---------------------------------------------------------------------------
CORE_CAST: Dict[str, Character] = {
    "hero": Character(
        "hero", "Kabir", "the hero: 22-year-old Gen-Z creator, witty, savage, relatable, narrates and reacts",
        MADHUR, 12, 2, (255, 226, 0),
        Look((240, 187, 143), (214, 156, 116), (26, 24, 40), "quiff", (98, 52, 214), (64, 32, 150), "hoodie", (0, 232, 255), ("headphones",)),
        gender="M", archetype="genz_boy",
    ),
    "riya": Character(
        "riya", "Riya", "savage Gen-Z girl creator: aesthetic queen, roasts boys' delusion, brutally honest bestie",
        SWARA, 14, 6, (255, 105, 220),
        Look((244, 194, 152), (218, 162, 122), (32, 18, 24), "long", (220, 48, 135), (160, 28, 96), "hoodie", (0, 245, 212), ("earrings", "headphones"), (210, 45, 95)),
        gender="F", archetype="genz_girl",
    ),
    "mummy": Character(
        "mummy", "Mummy", "dramatic desi mummy: loving but taunting, compares everyone to Sharma ji ka beta, weaponises guilt",
        SWARA, 4, 0, (255, 120, 170),
        Look((232, 176, 132), (205, 146, 106), (40, 22, 22), "bun", (190, 40, 90), (130, 24, 64), "saree", (255, 200, 60), ("bindi", "earrings"), (190, 30, 70)),
        gender="F", archetype="desi_parent",
    ),
    "bunty": Character(
        "bunty", "Bunty", "over-confident best friend with terrible startup ideas, says 'bhai' in every line, never admits he is wrong",
        MADHUR, 22, 14, (80, 255, 160),
        Look((198, 140, 100), (170, 115, 80), (20, 20, 20), "cap", (30, 160, 110), (18, 110, 76), "hoodie", (255, 214, 10), ()),
        gender="M", archetype="best_friend",
    ),
    "uncle": Character(
        "uncle", "Uncle", "know-it-all uncle: 'hamare zamane mein', unsolicited advice, WhatsApp-forward expert, shaky tech knowledge",
        MADHUR, -4, -14, (140, 200, 255),
        Look((222, 170, 128), (196, 140, 100), (170, 170, 178), "bald", (80, 110, 160), (52, 76, 120), "shirt", (240, 240, 240), ("glasses", "moustache")),
        gender="M", archetype="desi_uncle",
    ),
    "rocky": Character(
        "rocky", "Rocky", "strict talent judge: brutally honest, hates cringe, loves the red buzzer, short savage verdicts",
        MADHUR, -2, -10, (255, 90, 90),
        Look((214, 160, 118), (186, 134, 96), (24, 20, 20), "quiff", (40, 40, 52), (24, 24, 34), "blazer", (220, 40, 40), ("sunglasses", "beard")),
        gender="M", archetype="judge",
    ),
    "meera": Character(
        "meera", "Meera", "sarcastic talent judge: killer one-liners, eye-roll queen, compliments that are secretly insults",
        SWARA, 10, 8, (255, 170, 60),
        Look((236, 182, 140), (208, 150, 110), (30, 16, 16), "long", (30, 110, 200), (20, 76, 150), "blazer", (255, 255, 255), ("earrings",), (200, 40, 90)),
        gender="F", archetype="judge",
    ),
    "guru": Character(
        "guru", "Guru", "chill comic judge: speaks fake-deep one-liners then drops a savage roast with a calm face",
        MADHUR, -6, -4, (120, 255, 220),
        Look((190, 134, 96), (160, 110, 78), (190, 190, 200), "quiff", (20, 150, 160), (14, 104, 112), "hoodie", (255, 255, 255), ("beard",)),
        gender="M", archetype="judge",
    ),
    "zoya": Character(
        "zoya", "Zoya", "witty guest judge & standup comic: deadpan dark humor, roasts both contestants and fellow judges",
        SWARA, 8, -4, (190, 140, 255),
        Look((238, 186, 145), (210, 155, 115), (22, 18, 28), "bob", (110, 36, 170), (76, 22, 120), "leather_jacket", (255, 215, 0), ("glasses", "earrings"), (180, 35, 80)),
        gender="F", archetype="judge",
    ),
    "arjun": Character(
        "arjun", "Arjun", "gym bro & protein shake addict: solves every problem with deadlifts and pre-workout",
        MADHUR, 16, -6, (255, 140, 66),
        Look((208, 150, 108), (180, 124, 86), (18, 18, 22), "spikes", (220, 70, 30), (155, 45, 18), "gym_vest", (255, 220, 40), ("chain", "beard")),
        gender="M", archetype="gym_bro",
    ),
    "priya": Character(
        "priya", "Priya", "HR manager & corporate queen: speaks in 'circle back' and 'synergy' while cutting bonuses",
        SWARA, 6, 4, (100, 230, 255),
        Look((234, 180, 138), (206, 150, 110), (36, 20, 18), "ponytail", (38, 88, 168), (24, 58, 118), "blazer", (255, 200, 80), ("glasses", "earrings"), (195, 45, 85)),
        gender="F", archetype="corporate",
    ),
    "chintu": Character(
        "chintu", "Chintu", "19-year-old gaming & coding hustler: runs 4 Discord servers, sleeps at 5 AM, speaks in memes",
        MADHUR, 24, 16, (120, 255, 100),
        Look((228, 174, 132), (200, 144, 104), (28, 22, 38), "curly", (44, 170, 70), (28, 115, 46), "tshirt", (255, 240, 0), ("headphones", "glasses")),
        gender="M", archetype="gamer",
    ),
    "dada": Character(
        "dada", "Dada", "swag grandpa: savage old-school wisdom, roasts Gen-Z while secretly scrolling Reels all night",
        MADHUR, -10, -16, (255, 210, 120),
        Look((216, 164, 122), (188, 136, 98), (225, 225, 232), "turban", (210, 140, 45), (155, 98, 26), "kurta", (255, 245, 200), ("glasses", "moustache", "beard")),
        gender="M", archetype="elder",
    ),
    "boss": Character(
        "boss", "Boss", "toxic startup founder: promises ESOPs instead of salary, calls Sunday a 'sprint day'",
        MADHUR, 8, -8, (255, 110, 110),
        Look((220, 166, 124), (192, 138, 98), (22, 22, 28), "quiff", (32, 42, 68), (18, 26, 44), "blazer", (0, 210, 255), ("glasses", "beard")),
        gender="M", archetype="corporate",
    ),
    "neha": Character(
        "neha", "Neha", "South Delhi / Bandra vlogger: mixes dramatic English with desi chaos, obsessed with iced coffee & aesthetics",
        SWARA, 16, 10, (255, 160, 230),
        Look((246, 198, 158), (220, 168, 128), (48, 26, 18), "long", (235, 90, 160), (175, 55, 115), "tshirt", (255, 240, 150), ("sunglasses", "earrings"), (215, 50, 105)),
        gender="F", archetype="influencer",
    ),
    "vikram": Character(
        "vikram", "Vikram", "podcast bro: asks 'par iske peeche ki psychology kya hai?' on every topic, leans into the mic",
        MADHUR, 2, -6, (90, 220, 255),
        Look((212, 158, 116), (184, 130, 92), (20, 18, 24), "curly", (28, 28, 36), (16, 16, 22), "tshirt", (255, 180, 0), ("headphones", "beard")),
        gender="M", archetype="podcaster",
    ),
}

# ---------------------------------------------------------------------------
# 2. Procedural 1,000-Character Generator (Deterministic, Fast, Zero-Repeat)
# ---------------------------------------------------------------------------
_MALE_NAMES = [
    "Aarav", "Vivaan", "Aditya", "Vihaan", "Arjun", "Sai", "Reyansh", "Ayaan", "Krishna", "Ishaan",
    "Shaurya", "Atharv", "Advik", "Pranav", "Advaith", "Aaryan", "Dhruv", "Kabir", "Ritvik", "Aarush",
    "Kian", "Darsh", "Veer", "Harsh", "Rohan", "Kartik", "Kunal", "Nikhil", "Rahul", "Siddharth",
    "Yash", "Varun", "Tushar", "Gaurav", "Ankit", "Manish", "Deepak", "Pankaj", "Sachin", "Vikas",
    "Mohit", "sumit", "Rajat", "Abhishek", "Mayank", "chirag", "Harshit", "Lakshya", "Dev", "Rishi",
    "Karan", "Naman", "Parth", "Samar", "Tanmay", "Uday", "Zaid", "Farhan", "Armaan", "Sameer",
    "Babloo", "Guddu", "Pappu", "Munna", "Monty", "Sunny", "Rinku", "Tinku", "Lucky", "Prince",
    "Rajveer", "Ranveer", "Surya", "Tejas", "Vedant", "Yuvraj", "Akash", "Bhavesh", "Chetan", "Dinesh",
    "Eshan", "Gagan", "Hemant", "Jatin", "Kapil", "Lalit", "Mukesh", "Naveen", "Omkar", "Prateek",
    "Raghav", "Sandeep", "Tarun", "Utkarsh", "Vineet", "Wasim", "Yogesh", "Zubin", "Aakash", "pranay",
]

_FEMALE_NAMES = [
    "Aadhya", "Ananya", "Diya", "Pari", "Saanvi", "Myra", "Kiara", "Aaradhya", "Anika", "Avni",
    "Navya", "Ira", "Ahana", "Ishita", "Riya", "Shreya", "Tanvi", "Pooja", "Neha", "Sneha",
    "Kavya", "Nisha", "Kritika", "Simran", "Anjali", "Divya", "Swati", "Megha", "Nikita", "Priyanka",
    "Sakshi", "Shruti", "Tanya", "Urvashi", "Vani", "Zoya", "Alia", "Bhumi", "Chhavi", "Damini",
    "esha", "Falguni", "Gauri", "Hina", "Isha", "Jhanvi", "Komal", "Lavanya", "Mansi", "Nandini",
    "Ojaswi", "Palak", "Radhika", "Sanya", "Trisha", "Upasana", "Vidya", "Yashika", "Zara", "Muskaan",
    "Payal", "Roshni", "Sonali", "Twinkle", "Pinky", "Sweety", "Babli", "Guddi", "Chinki", "Minki",
    "Aarti", "Bhavna", "Charu", "Deepika", "Ekta", "Garima", "Himani", "Jyoti", "Karishma", "Kirti",
    "Madhu", "Meenakshi", "Monika", "Neelam", "Pallavi", "Preeti", "Rachna", "Rekha", "Richa", "Ritu",
    "Rupali", "Sangeeta", "Sapna", "Shikha", "Shilpa", "Smriti", "Sonal", "Sunita", "Vandana", "Varsha",
]

_ARCHETYPES: List[Tuple[str, str, Tuple[str, ...], Tuple[str, ...]]] = [
    ("genz_creator", "savage Gen-Z reel creator who roasts fake trends with deadpan punchlines", ("hoodie", "tshirt", "leather_jacket"), ("headphones", "sunglasses")),
    ("college_student", "engineering/college student surviving on 74.9% attendance, Maggi and last-night PDFs", ("hoodie", "tshirt", "shirt"), ("headphones", "glasses")),
    ("judge", "sharp talent-show judge on the panel who loves hitting the red buzzer on cringe acts", ("blazer", "leather_jacket", "saree"), ("sunglasses", "glasses", "earrings")),
    ("startup_bro", "delusional pitch-deck founder talking about AI valuation while borrowing 20 rupees for chai", ("blazer", "shirt", "hoodie"), ("glasses",)),
    ("desi_relative", "nosy Desi relative who asks about package, shaadi and Sharma ji ka beta at every function", ("saree", "kurta", "shirt"), ("glasses", "moustache", "bindi", "earrings")),
    ("gym_freak", "fitness influencer measuring protein in mummy's dal and flexing in every mirror", ("gym_vest", "tshirt", "hoodie"), ("chain", "beard")),
    ("gamer_streamer", "hyper RGB streamer who reacts at 200 BPM and treats real life like a Battle Royale lobby", ("hoodie", "tshirt"), ("headphones", "glasses")),
    ("corporate_emp", "sleep-deprived IT employee attending 9 PM standup calls while secretly interviewing elsewhere", ("shirt", "blazer"), ("glasses",)),
    ("podcast_host", "deep-voice podcast host asking guests if aliens built the metro station", ("tshirt", "blazer", "kurta"), ("headphones", "beard")),
    ("street_smart", "jugaadu desi hustler who knows a guy for everything and negotiates 50% off everywhere", ("shirt", "kurta", "leather_jacket"), ("sunglasses", "chain", "moustache")),
]

_SKIN_PALETTES: List[Tuple[RGB, RGB]] = [
    ((246, 198, 158), (220, 168, 128)),
    ((240, 187, 143), (214, 156, 116)),
    ((232, 176, 132), (205, 146, 106)),
    ((222, 168, 124), (195, 138, 96)),
    ((210, 154, 112), (182, 125, 86)),
    ((198, 140, 100), (170, 115, 80)),
    ((184, 126, 88), (156, 102, 68)),
    ((168, 112, 76), (140, 88, 56)),
]

_HAIR_COLORS: List[RGB] = [
    (20, 18, 26), (32, 22, 18), (46, 28, 20), (18, 24, 38),
    (70, 36, 22), (165, 165, 175), (90, 25, 55), (25, 65, 95),
]

_OUTFIT_PALETTES: List[Tuple[RGB, RGB, RGB]] = [
    ((98, 52, 214), (64, 32, 150), (0, 232, 255)),
    ((220, 48, 115), (155, 26, 78), (255, 214, 10)),
    ((30, 160, 110), (18, 110, 76), (255, 220, 40)),
    ((36, 105, 210), (22, 68, 148), (100, 240, 255)),
    ((215, 75, 35), (150, 45, 18), (255, 230, 80)),
    ((40, 42, 58), (22, 24, 36), (255, 70, 90)),
    ((155, 40, 185), (105, 22, 130), (0, 255, 180)),
    ((20, 145, 165), (12, 96, 112), (255, 200, 50)),
    ((190, 130, 30), (135, 88, 16), (255, 245, 190)),
    ((180, 32, 52), (122, 18, 34), (255, 215, 0)),
]

_BADGE_COLORS: List[RGB] = [
    (255, 226, 0), (255, 105, 220), (80, 255, 160), (100, 220, 255),
    (255, 140, 66), (255, 95, 95), (185, 135, 255), (120, 255, 220),
    (255, 190, 70), (150, 255, 110),
]

_MALE_HAIR_STYLES = ("quiff", "cap", "curly", "spikes", "turban", "bald")
_FEMALE_HAIR_STYLES = ("long", "bun", "ponytail", "bob", "curly")


def _generate_1000_cast() -> Dict[str, Character]:
    catalog: Dict[str, Character] = dict(CORE_CAST)
    idx = 1
    while len(catalog) < 1000:
        is_female = (idx % 2 == 0)
        gender = "F" if is_female else "M"
        base_names = _FEMALE_NAMES if is_female else _MALE_NAMES
        base_name = base_names[(idx // 2) % len(base_names)].capitalize()
        cid = f"char_{idx:04d}_{base_name.lower()}"
        if cid in catalog:
            idx += 1
            continue

        arch_key, arch_desc, outfits, acc_pool = _ARCHETYPES[idx % len(_ARCHETYPES)]
        skin, skin_sh = _SKIN_PALETTES[(idx * 3) % len(_SKIN_PALETTES)]
        hair_col = _HAIR_COLORS[(idx * 5) % len(_HAIR_COLORS)]
        outfit_col, outfit_dk, accent_col = _OUTFIT_PALETTES[(idx * 7) % len(_OUTFIT_PALETTES)]
        badge_col = _BADGE_COLORS[(idx * 11) % len(_BADGE_COLORS)]

        if is_female:
            h_style = _FEMALE_HAIR_STYLES[(idx * 3) % len(_FEMALE_HAIR_STYLES)]
            o_choices = [o for o in outfits if o != "gym_vest"] or ["hoodie", "saree", "blazer", "tshirt", "kurta"]
            if arch_key == "desi_relative":
                o_style = "saree"
                h_style = "bun"
            else:
                o_style = o_choices[idx % len(o_choices)]
            accs: List[str] = ["earrings"]
            if o_style == "saree" or (idx % 5 == 0):
                accs.append("bindi")
            if "headphones" in acc_pool and idx % 3 == 0:
                accs.append("headphones")
            elif "glasses" in acc_pool and idx % 4 == 0:
                accs.append("glasses")
            elif "sunglasses" in acc_pool and idx % 6 == 0:
                accs.append("sunglasses")
            lip_col = (200, 40, 90) if idx % 3 != 0 else (175, 35, 70)
            voice = SWARA if idx % 4 != 0 else NEERJA
        else:
            h_style = _MALE_HAIR_STYLES[(idx * 3) % len(_MALE_HAIR_STYLES)]
            o_choices = [o for o in outfits if o != "saree"] or ["hoodie", "shirt", "blazer", "tshirt", "kurta", "gym_vest"]
            o_style = o_choices[idx % len(o_choices)]
            accs = []
            if idx % 3 == 0:
                accs.append("beard")
            if idx % 5 == 0:
                accs.append("moustache")
            if "headphones" in acc_pool and idx % 4 == 0:
                accs.append("headphones")
            elif "sunglasses" in acc_pool and idx % 5 == 1:
                accs.append("sunglasses")
            elif "glasses" in acc_pool and idx % 4 == 2:
                accs.append("glasses")
            if "chain" in acc_pool and idx % 3 == 1:
                accs.append("chain")
            lip_col = (24, 20, 34)
            voice = MADHUR if idx % 4 != 0 else PRABHAT

        rate = -10 + ((idx * 9) % 36)  # -10% to +25%
        pitch = -14 + ((idx * 7) % 30)  # -14Hz to +15Hz
        display_name = f"{base_name}" if idx <= 200 else f"{base_name}{idx}"
        persona = f"{base_name} ({arch_key.replace('_', ' ')}): {arch_desc}"

        catalog[cid] = Character(
            id=cid,
            name=display_name,
            persona=persona,
            voice=voice,
            rate=rate,
            pitch=pitch,
            color=badge_col,
            look=Look(
                skin=skin,
                skin_sh=skin_sh,
                hair=hair_col,
                hair_style=h_style,
                outfit=outfit_col,
                outfit_dk=outfit_dk,
                outfit_style=o_style,
                accent=accent_col,
                acc=tuple(dict.fromkeys(accs)),
                lip=lip_col,
            ),
            gender=gender,
            archetype=arch_key,
        )
        idx += 1
    return catalog


CAST: Dict[str, Character] = _generate_1000_cast()


def build_cast(hero_name: str = "Kabir 3D") -> Dict[str, Character]:
    """Return full 1,000-character pool with 'hero' carrying the configured character name."""
    cast = dict(CAST)
    first = (hero_name.split() or ["Kabir"])[0]
    cast["hero"] = replace(CAST["hero"], name=first)
    return cast


def search_cast(
    query: str = "",
    gender: str = "",
    archetype: str = "",
    outfit_style: str = "",
    limit: int = 50,
    hero_name: str = "Kabir 3D",
) -> List[Character]:
    """Filter the 1,000-character pool by query, gender ('M'/'F'), archetype, or outfit_style."""
    pool = build_cast(hero_name)
    q = query.strip().lower()
    g = gender.strip().upper()
    a = archetype.strip().lower()
    o = outfit_style.strip().lower()
    out: List[Character] = []
    for ch in pool.values():
        if g and ch.gender != g:
            continue
        if a and a not in ch.archetype.lower():
            continue
        if o and ch.look.outfit_style.lower() != o:
            continue
        if q and q not in ch.id.lower() and q not in ch.name.lower() and q not in ch.persona.lower():
            continue
        out.append(ch)
        if len(out) >= limit:
            break
    return out


def _unique_tag_cast(chars: Sequence[Character]) -> List[Character]:
    """Ensure every selected character in an episode has a distinct uppercase speaker TAG."""
    seen: set = set()
    out: List[Character] = []
    for i, c in enumerate(chars):
        clean_name = "".join(ch for ch in c.name if ch.isalpha()) or c.name
        cand = clean_name
        if cand.upper() in seen:
            cand = f"{clean_name}{i + 1}"
        seen.add(cand.upper())
        out.append(replace(c, name=cand))
    return out


def cast_for(
    fmt: str,
    kind: str,
    hero_name: str = "Kabir 3D",
    rng: random.Random | None = None,
    cast_size: Optional[int] = None,
    gender_lead: str = "",
    custom_ids: Optional[Sequence[str]] = None,
) -> List[Character]:
    """
    Select 1 to 6 characters from the 1,000-character pool depending on format, kind, and preferences.
    - Backward-compatible defaults for v4 tests when `cast_size` is not overridden:
      * `solo` -> 1 character (Kabir or female lead Riya if gender_lead=='F')
      * `dialogue` + `short` -> 2 characters (or `cast_size` up to 6)
      * `dialogue` + `long` -> 3-4 characters (or 5-6 when `cast_size` or `panel_5_6` is used)
      * `talent_roast` -> `["rocky", "meera", "guru", "hero"]` on long, `["rocky", "meera", "hero"]` on short (or up to 6 with Zoya/contestants)
      * `panel_5_6` -> 5 or 6 characters from the 1000-character pool!
      * `couple_roast` -> Boy + Girl lead (`hero` + `riya` + optional extra characters)
    """
    rng = rng or random.Random()
    pool = build_cast(hero_name)

    if custom_ids:
        picked = [pool[cid] for cid in custom_ids if cid in pool]
        if picked:
            return _unique_tag_cast(picked[:6])

    lead_id = "riya" if gender_lead.upper() == "F" else "hero"

    if fmt == "solo" and not (cast_size and cast_size > 1):
        if gender_lead.upper() == "RANDOM":
            all_leads = ["hero", "riya"] + [k for k in list(pool.keys())[16:120]]
            return [pool[rng.choice(all_leads)]]
        return [pool[lead_id]]

    if fmt == "couple_roast":
        n = cast_size or (2 if kind == "short" else rng.choice([2, 3, 4]))
        base = [pool["hero"], pool["riya"]]
        if n > 2:
            extras = [c for k, c in pool.items() if k not in ("hero", "riya")]
            base.extend(rng.sample(extras[:200], min(n - 2, 4)))
        return _unique_tag_cast(base[:6])

    if fmt == "panel_5_6":
        n = cast_size if (cast_size and 3 <= cast_size <= 6) else rng.choice([5, 6])
        judges = [pool["rocky"], pool["meera"], pool["guru"], pool["zoya"]]
        contestants = [pool[lead_id]] + rng.sample([pool[k] for k in list(pool.keys())[16:300]], 3)
        combined = judges[:3] + contestants[: n - 3]
        return _unique_tag_cast(combined[:n])

    if fmt == "talent_roast":
        if cast_size is None:
            ids = ["rocky", "meera", "guru", "hero"] if kind == "long" else ["rocky", "meera", "hero"]
            return [pool[i] for i in ids]
        n = max(3, min(6, cast_size))
        base_ids = ["rocky", "meera", "guru", "zoya", lead_id, "bunty"]
        extras = [k for k in list(pool.keys())[16:250] if k not in base_ids]
        while len(base_ids) < n:
            base_ids.append(rng.choice(extras))
        return _unique_tag_cast([pool[i] for i in base_ids[:n]])

    if fmt == "dialogue":
        if cast_size is None:
            n_extra = rng.choice([2, 3]) if kind == "long" else 1
            ids = [lead_id] + rng.sample(["mummy", "bunty", "uncle"], n_extra)
            return [pool[i] for i in ids]
        n = max(2, min(6, cast_size))
        core_choices = ["mummy", "bunty", "uncle", "riya", "arjun", "priya", "chintu", "dada", "neha", "vikram"]
        procedural_choices = list(pool.keys())[16:400]
        mixed_pool = [k for k in core_choices + rng.sample(procedural_choices, 20) if k != lead_id]
        picked_ids = [lead_id] + rng.sample(mixed_pool, n - 1)
        return _unique_tag_cast([pool[i] for i in picked_ids])

    # fallback or custom cast_size
    n = max(1, min(6, cast_size or 1))
    if n == 1:
        return [pool[lead_id]]
    candidates = [k for k in list(pool.keys())[:300] if k != lead_id]
    return _unique_tag_cast([pool[lead_id]] + [pool[k] for k in rng.sample(candidates, n - 1)])


def match_cast_from_youtube_metadata(
    title: str,
    description: str,
    transcript: str,
    hero_name: str = "Kabir 3D",
    target_count: Optional[int] = None,
) -> Tuple[List[Character], str, str]:
    """
    Inspect a reference YouTube video's title/description/transcript to infer:
    1) Best matching format ('talent_roast', 'dialogue', 'panel_5_6', 'couple_roast', 'solo')
    2) Best matching background scene ('talent_stage', 'podcast_studio', 'home_room', 'jungle', 'street_chai', 'college_canteen', 'office_boardroom', 'gym')
    3) Character lineup (1 to 6 characters from our 1000-character pool with matching outfits/vibes).
    """
    blob = f"{title} {description} {transcript}".lower()
    pool = build_cast(hero_name)
    seed = int(hashlib.md5(blob.encode("utf-8", errors="ignore")).hexdigest()[:8], 16)
    rng = random.Random(seed)

    # Detect background & setup vibe
    if any(w in blob for w in ("latent", "judge", "panel", "contestant", "audition", "talent", "roast show", "standup", "stage", "buzzer")):
        bg = "talent_stage"
        fmt = "talent_roast"
        n = target_count or rng.choice([4, 5])
        chars = [pool["rocky"], pool["meera"], pool["guru"], pool["zoya"], pool["hero"], pool["bunty"]][:n]
    elif any(w in blob for w in ("podcast", "interview", "episode", "guest", "mic", "conversation", "talk show")):
        bg = "podcast_studio"
        fmt = "dialogue"
        n = target_count or rng.choice([3, 4])
        chars = [pool["vikram"], pool["hero"], pool["riya"], pool["guru"]][:n]
    elif any(w in blob for w in ("jungle", "forest", "camping", "safari", "wild", "mountain", "trek", "island", "adventure")):
        bg = "jungle"
        fmt = "dialogue"
        n = target_count or rng.choice([3, 4])
        chars = [pool["hero"], pool["bunty"], pool["riya"], pool["arjun"]][:n]
    elif any(w in blob for w in ("gym", "workout", "protein", "fitness", "bodybuilding", "diet")):
        bg = "gym"
        fmt = "dialogue"
        n = target_count or 3
        chars = [pool["arjun"], pool["hero"], pool["riya"], pool["bunty"]][:n]
    elif any(w in blob for w in ("office", "manager", "corporate", "salary", "hr", "boss", "meeting", "startup", "shark")):
        bg = "office_boardroom"
        fmt = "dialogue"
        n = target_count or 4
        chars = [pool["boss"], pool["priya"], pool["hero"], pool["bunty"]][:n]
    elif any(w in blob for w in ("college", "exam", "hostel", "canteen", "attendance", "professor", "class", "school")):
        bg = "college_canteen"
        fmt = "dialogue"
        n = target_count or 4
        chars = [pool["hero"], pool["riya"], pool["bunty"], pool["chintu"]][:n]
    elif any(w in blob for w in ("chai", "tapri", "street", "market", "traffic", "auto", "road", "dost")):
        bg = "street_chai"
        fmt = "dialogue"
        n = target_count or 3
        chars = [pool["hero"], pool["bunty"], pool["uncle"], pool["dada"]][:n]
    elif any(w in blob for w in ("girlfriend", "boyfriend", "couple", "date", "crush", "pyaar", "relationship", "shaadi")):
        bg = "home_room"
        fmt = "dialogue"
        n = target_count or 3
        chars = [pool["hero"], pool["riya"], pool["mummy"], pool["neha"]][:n]
    else:
        bg = rng.choice(["home_room", "talent_stage", "podcast_studio", "street_chai", "college_canteen"])
        fmt = "dialogue" if (target_count or 3) > 1 else "solo"
        n = target_count or rng.choice([3, 4])
        extra_pool = [pool[k] for k in list(pool.keys())[16:180]]
        chars = [pool["hero"], pool["riya"]] + rng.sample(extra_pool, max(1, n - 2))
        chars = chars[:n]

    return _unique_tag_cast(chars), fmt, bg


def cast_from_plan(plan_cast: Sequence[dict], hero_name: str = "Kabir 3D") -> List[Character]:
    pool = build_cast(hero_name)
    out: List[Character] = []
    for c in plan_cast:
        cid = c.get("id")
        if cid in pool:
            ch = pool[cid]
            if c.get("name"):
                ch = replace(ch, name=str(c["name"]))
            out.append(ch)
    return out or [pool["hero"]]
