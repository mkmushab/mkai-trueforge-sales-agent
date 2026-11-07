"""
3-Model Council & 4-Mode Production Brain (v5 Mega-Brain).

  1. DeepSeek V3.2 -> writes / completes / clones the Hinglish roast script or multi-character dialogue
  2. gpt-oss-120b  -> directs scenes (expression, reaction, camera, environment background, meme banner, meme card, SFX) as JSON
  3. Gemma 4 31B   -> viral title, high-CTR thumbnail text, SEO description, tags, and Instagram caption

Supports all 4 Studio Modes:
  * Mode 1 (`auto_upload`)         : AI picks trend/topic, writes script, directs 1-6 chars, renders & auto-uploads
  * Mode 2 (`auto_no_upload`)      : AI writes script, directs & renders video + thumbnail + full description/tags without uploading
  * Mode 3 (`custom_script_upload`): User provides full script (`custom_script`); AI parses solo/dialogue turns, directs scenes/memes/backgrounds, generates SEO + thumbnail, renders & uploads
  * Mode 4 (`yt_clone_remix`)      : User provides a YouTube URL (`youtube_url`) + optional half-script (`custom_script`); AI recreates the video's setup (how many people, outfits, stage/environment, dialogue flow/punchlines) using our 3D AI characters & AI voices (zero copyrighted audio!)

Design rules preserved from v4:
  * keys come from .env only; endpoints with a missing/rejected key are skipped
  * model slugs are resolved ONCE per endpoint via /models (fuzzy match)
  * a failed script stage RAISES -> that slot is skipped
  * spoken lines are never rewritten by stage 2/3, so audio, captions and scenes stay in sync
"""
from __future__ import annotations

import datetime as _dt
import json
import logging
import math
import random
import re
import time
from typing import Any, Callable, Dict, List, Optional, Sequence, Tuple

import requests

from agents.backgrounds import BACKGROUNDS, infer_background_from_text
from agents.cast import Character, cast_for
from agents.meme_cards import CARD_TYPES, list_meme_assets, normalize_card
from config import ASSETS_DIR, ModelEndpoint, StudioConfig

log = logging.getLogger("studio.brain")

EXPRESSIONS = ("shocked", "smirking", "laughing", "facepalm", "angry_roast")
CAMERAS = ("zoom_in", "shake", "bounce", "pan_center")
SFX_CHOICES = ("vine_boom", "whoosh", "laugh_punch", "censor_beep", "record_scratch", "none")

# One council, two formats: Shorts/Reels (~22 s) and the daily long YouTube video (~2:15).
# Hinglish TTS runs at roughly 2.6-3.0 words per second, so word counts drive the duration.
KIND_SPECS: Dict[str, Dict[str, Any]] = {
    "short": {"words": (50, 75), "scenes": 4, "solo_cap": 5, "max_scenes": 8, "turns": (3, 8), "title_max": 60, "script_tokens": 900, "dir_tokens": 2200},
    "long": {"words": (280, 450), "scenes": 10, "solo_cap": 14, "max_scenes": 24, "turns": (10, 24), "title_max": 95, "script_tokens": 4000, "dir_tokens": 7000},
}
FORMATS = ("solo", "dialogue", "talent_roast", "panel_5_6", "couple_roast")
MODES = ("auto_upload", "auto_no_upload", "custom_script_upload", "yt_clone_remix")

_STYLE_CYCLE = [
    ("shocked", "zoom_in", "vine_boom"),
    ("smirking", "pan_center", "whoosh"),
    ("laughing", "bounce", "laugh_punch"),
    ("angry_roast", "shake", "record_scratch"),
    ("facepalm", "zoom_in", "vine_boom"),
    ("smirking", "bounce", "whoosh"),
]
_DEFAULT_TAGS = ["mkverse3d", "hinglishcomedy", "desimemes", "indianreels", "aiinfluencer"]


class LLMUnavailable(RuntimeError):
    pass


# ------------------------------------------------------------------ helpers
def extract_json(text: str) -> Dict[str, Any]:
    """First valid JSON object found anywhere in `text` (handles ``` fences and chatter)."""
    text = re.sub(r"```(?:json)?", "", text or "")
    decoder = json.JSONDecoder()
    for m in re.finditer(r"\{", text):
        try:
            obj, _ = decoder.raw_decode(text[m.start():])
        except json.JSONDecodeError:
            continue
        if isinstance(obj, dict):
            return obj
    raise ValueError("no JSON object found in model output")


def _norm(s: str) -> str:
    return re.sub(r"[^a-z0-9]", "", s.lower())


def _clip(text: Any, limit: int) -> str:
    text = " ".join(str(text or "").split())
    return text if len(text) <= limit else text[: limit - 1].rstrip() + "\u2026"


def _clip_words(text: Any, limit: int) -> str:
    text = " ".join(str(text or "").split())
    if len(text) <= limit:
        return text
    cut = text[:limit].rsplit(" ", 1)[0]
    return cut or text[:limit]


def clean_script(text: str) -> str:
    """Strip markdown, scene labels and stage directions the LLM likes to add."""
    text = re.sub(r"(?im)^\s*#+\s.*$", "", text)
    text = re.sub(r"(?im)^\s*(\*\*)?\s*scene\s*\d+[^\n:]*[:\-\u2013]\s*(\*\*)?", "", text)
    text = re.sub(r"\([^)]*\)|\[[^\]]*\]", "", text)
    text = text.replace("**", "").replace("*", "").replace("`", "")
    text = re.sub(r"(?im)^\s*(script|title|hook)\s*:\s*", "", text)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip().strip('"').strip()


def split_into_scenes(script: str, target: int = 5, cap: int = 8) -> List[str]:
    paras = [p.strip().replace("\n", " ") for p in re.split(r"\n\s*\n", script) if p.strip()]
    if len(paras) < 3:
        sents = [x for x in re.split(r"(?<=[.!?])\s+", script.replace("\n", " ").strip()) if x]
        k = max(3, min(target, len(sents)))
        size = max(1, math.ceil(len(sents) / k))
        paras = [" ".join(sents[i : i + size]) for i in range(0, len(sents), size)]
    return paras[:cap]


# ------------------------------------------------------------------ LLM client
class LLMClient:
    def __init__(self, cfg: StudioConfig, session: Optional[requests.Session] = None):
        self.cfg = cfg
        self.http = session or requests.Session()
        self._catalog: Dict[str, List[str]] = {}
        self._resolved: Dict[str, str] = {}
        self._dead: set = set()

    def _headers(self, ep: ModelEndpoint) -> Dict[str, str]:
        return {"Authorization": f"Bearer {ep.api_key}", "Content-Type": "application/json"}

    def _catalog_for(self, ep: ModelEndpoint) -> List[str]:
        if ep.name not in self._catalog:
            try:
                r = self.http.get(f"{ep.base_url.rstrip('/')}/models", headers=self._headers(ep), timeout=12)
                r.raise_for_status()
                self._catalog[ep.name] = [m["id"] for m in r.json().get("data", []) if m.get("id")]
            except Exception as exc:
                log.debug("model discovery failed for %s: %s", ep.name, exc)
                self._catalog[ep.name] = []
        return self._catalog[ep.name]

    def _candidates(self, ep: ModelEndpoint) -> List[str]:
        catalog = self._catalog_for(ep)
        wanted = {_norm(m) for m in [ep.model, *ep.fallbacks]}
        exact = [i for i in catalog if _norm(i) in wanted]
        main = _norm(ep.model)
        fuzzy = [i for i in catalog if i not in exact and main and (main in _norm(i) or _norm(i) in main)]
        ordered = exact + fuzzy + [ep.model, *ep.fallbacks]
        if ep.name in self._resolved:
            ordered.insert(0, self._resolved[ep.name])
        return list(dict.fromkeys(ordered))

    def _post(self, ep: ModelEndpoint, model: str, system: str, user: str, temperature: float, max_tokens: int) -> str:
        url = f"{ep.base_url.rstrip('/')}/chat/completions"
        payload = {
            "model": model,
            "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        for attempt in range(3):
            r = self.http.post(url, headers=self._headers(ep), json=payload, timeout=120)
            if r.status_code in (401, 403):
                raise PermissionError(f"{ep.name}: API key rejected (HTTP {r.status_code})")
            if r.status_code in (429, 500, 502, 503, 504) and attempt < 2:
                time.sleep(3 * (attempt + 1))
                continue
            r.raise_for_status()
            msg = r.json()["choices"][0]["message"]
            return (msg.get("content") or "").strip()
        return ""

    def chat(
        self,
        prefer: str,
        system: str,
        user: str,
        *,
        temperature: float = 0.8,
        max_tokens: int = 2200,
        validate: Optional[Callable[[str], None]] = None,
    ) -> str:
        order = [prefer] + [k for k in self.cfg.models if k != prefer]
        last: Optional[Exception] = None
        for key in order:
            ep = self.cfg.models[key]
            if not ep.ready or ep.name in self._dead:
                continue
            out = ""
            for model in self._candidates(ep):
                try:
                    log.info("council: %s -> '%s'", ep.role, model)
                    out = self._post(ep, model, system, user, temperature, max_tokens)
                    if not out:
                        raise ValueError("empty response")
                    self._resolved[ep.name] = model
                    break
                except PermissionError as exc:
                    self._dead.add(ep.name)
                    last = exc
                    log.error("%s", exc)
                    out = ""
                    break
                except Exception as exc:
                    last = exc
                    log.warning("model '%s' failed: %s", model, str(exc)[:140])
                    out = ""
            if not out:
                continue
            if validate:
                try:
                    validate(out)
                except Exception as exc:  # model works but answer is unusable -> try the next endpoint
                    last = exc
                    log.warning("%s answer rejected: %s", ep.name, exc)
                    continue
            return out
        raise LLMUnavailable(f"all council endpoints failed or no valid key set (last error: {last})")


# ------------------------------------------------------------------ plan building
_BEEP_RE = re.compile(r"\b(?:BEEP|BLEEP)\b", re.I)


def strip_beeps(text: str, style: str) -> str:
    """BEEP tokens are only legal in 'bleeped' style; otherwise they become a harmless filler word."""
    return text if style == "bleeped" else _BEEP_RE.sub("yaar", text)


def style_rules(style: str) -> str:
    base = (
        "- Roast SITUATIONS, habits and marketing claims. Never attack real people, religions, castes, communities, regions, politicians or parties. "
        "Never name real celebrities or real shows. No slurs, no sexual content, and no abuse aimed at anyone's mother, sister or family."
    )
    if style == "clean":
        return base + "\n- No profanity; nothing stronger than 'pagal' or 'bewakoof'."
    desi = (
        base + "\n- Playful desi slang and insults are welcome for the savage tone: saala, kamina, bakchod, bakchodi, pagal, ullu, gadha, nalayak, chhapri, jugaadu. Nothing stronger."
    )
    if style == "desi":
        return desi
    return desi + (
        "\n- For comic timing you may use the single word BEEP (all caps) up to 3 times in the whole video, exactly where a strong swear word would go. "
        "NEVER write the swear word itself; the editor turns BEEP into a censor tone."
    )


def parse_dialogue(script: str, tag_map: Dict[str, str]) -> List[Tuple[str, str]]:
    """'TAG: line' -> [(character_id, line)]. Lines without a known tag (stage directions) are ignored."""
    turns: List[Tuple[str, str]] = []
    for raw in script.splitlines():
        m = re.match(r"^\s*[*_#>\-\s]*([A-Za-z][A-Za-z0-9 ._]{0,22}?)\s*[*_]*\s*[:\u2013-]\s*(.+?)\s*$", raw)
        if not m:
            continue
        tag = m.group(1).strip().upper()
        if tag in tag_map:
            text = clean_script(m.group(2)).replace("\n", " ").strip()
            if text:
                turns.append((tag_map[tag], text))
    return turns


def parse_user_custom_script(script: str, cast: Sequence[Character], fmt: str, kind: str) -> List[Tuple[str, str]]:
    """
    Parse a user-supplied custom script (Mode 3 or Mode 4 fallback):
    - If lines have `SPEAKER: line`, maps speakers to `cast` (matching by name/tag or round-robin).
    - Otherwise splits paragraphs/sentences into scenes and assigns to `cast` (solo or alternating speakers).
    """
    spec = KIND_SPECS[kind]
    tag_map = {c.tag: c.id for c in cast}
    # Also allow generic tags like JUDGE 1, BOY, GIRL, SPEAKER 1, etc.
    turns = parse_dialogue(script, tag_map)
    if len(turns) >= 3:
        return turns[: spec["max_scenes"]]

    # Try generic `ANY_NAME: line` mapping to cast members dynamically
    dyn_map: Dict[str, str] = dict(tag_map)
    dyn_turns: List[Tuple[str, str]] = []
    for raw in script.splitlines():
        m = re.match(r"^\s*[*_#>\-\s]*([A-Za-z][A-Za-z0-9 ._]{0,20}?)\s*[*_]*\s*[:\u2013-]\s*(.+?)\s*$", raw)
        if not m:
            continue
        tag = m.group(1).strip().upper()
        if tag in ("SCENE", "SCRIPT", "TITLE", "HOOK", "NOTE", "BACKGROUND"):
            continue
        if tag not in dyn_map:
            dyn_map[tag] = cast[len(dyn_map) % len(cast)].id
        line = clean_script(m.group(2)).replace("\n", " ").strip()
        if line:
            dyn_turns.append((dyn_map[tag], line))
    if len(dyn_turns) >= 3:
        return dyn_turns[: spec["max_scenes"]]

    # Plain paragraph / sentence script
    cleaned = clean_script(script)
    lines = split_into_scenes(cleaned, spec["scenes"], spec["max_scenes"])
    while len(lines) < 3 and lines:
        lines.append(lines[-1])
    if not lines:
        lines = [
            "Bhai aaj ka scene bilkul next level hone wala hai!",
            "Dekho kaise sab log AI ke peeche bhaag rahe hain par asliyat kuch aur hi hai!",
            "Subscribe karo aur comment mein batao tumhara kya khayal hai!",
        ]
    return [(cast[0].id if fmt == "solo" else cast[i % len(cast)].id, ln) for i, ln in enumerate(lines)]


def normalize_plan(
    plan: Dict[str, Any],
    cfg: StudioConfig,
    topic: str = "",
    kind: str = "short",
    fmt: str = "solo",
    cast: Optional[Sequence[Character]] = None,
    background: str = "",
    mode: str = "auto_upload",
) -> Dict[str, Any]:
    """Make any plan (LLM or demo) safe for the renderer/uploader."""
    spec = KIND_SPECS[kind]
    cast = list(cast or cast_for("solo", kind, cfg.character_name))
    ids = [c.id for c in cast]
    assets_available = list_meme_assets(ASSETS_DIR)
    style = getattr(cfg, "content_style", "bleeped")
    cap = spec["solo_cap"] if fmt == "solo" else spec["max_scenes"]
    ep_bg = background if background in BACKGROUNDS else (plan.get("background") if plan.get("background") in BACKGROUNDS else infer_background_from_text(topic, fmt))

    scenes: List[Dict[str, Any]] = []
    for i, sc in enumerate(plan.get("scenes") or []):
        if not isinstance(sc, dict):
            continue
        line = strip_beeps(" ".join(str(sc.get("spoken_line", "")).split()), style)
        if not line:
            continue
        d_expr, d_cam, d_sfx = _STYLE_CYCLE[i % len(_STYLE_CYCLE)]
        expr, cam, sfx = sc.get("character_expression"), sc.get("camera_motion"), sc.get("sfx")
        speaker = sc.get("speaker") if sc.get("speaker") in ids else (ids[0] if fmt == "solo" else ids[i % len(ids)])
        raw_banner = " ".join(str(sc.get("meme_banner") or "").split())
        banner = _clip_words(raw_banner.upper(), 32)
        if not banner and fmt == "solo":
            banner = _clip_words(" ".join(line.split()[:5]).upper(), 32)
        asset = sc.get("meme_asset") if sc.get("meme_asset") in assets_available else None
        react = sc.get("reaction_expression")
        sc_bg = sc.get("background") if sc.get("background") in BACKGROUNDS else ep_bg
        scenes.append(
            {
                "scene_id": len(scenes) + 1,
                "speaker": speaker,
                "spoken_line": line,
                "character_expression": expr if expr in EXPRESSIONS else d_expr,
                "reaction_expression": react if react in EXPRESSIONS else "smirking",
                "camera_motion": cam if cam in CAMERAS else d_cam,
                "background": sc_bg,
                "wan22_3d_prompt": _clip(sc.get("wan22_3d_prompt") or f"{cfg.character_visual_prompt}, {sc_bg} environment, {d_expr} expression", 300),
                "meme_banner": banner,
                "meme_card": normalize_card(sc.get("meme_card")),
                "meme_asset": asset,
                "sfx": sfx if sfx in SFX_CHOICES else d_sfx,
            }
        )
    if len(scenes) < 3:
        raise ValueError(f"plan needs at least 3 usable scenes, got {len(scenes)}")
    scenes = scenes[:cap]

    title = _clip(plan.get("video_title") or (scenes[0]["meme_banner"] or scenes[0]["spoken_line"]).title(), spec["title_max"])
    tags = [re.sub(r"[^a-z0-9]", "", str(t).lower()) for t in (plan.get("youtube_tags") or [])]
    base_tags = [re.sub(r"[^a-z0-9]", "", cfg.youtube_channel_name.lower())] + _DEFAULT_TAGS
    tags = [t for t in dict.fromkeys(tags + (["shorts"] if kind == "short" else []) + base_tags) if t][:14]

    caption = " ".join(str(plan.get("instagram_caption") or "").split())
    if caption.count("#") < 5:
        caption = (caption + " " + " ".join("#" + t for t in _DEFAULT_TAGS + ["reels", "funny"])).strip()
    caption = _clip(caption, 2000)
    caption_plain = re.sub(r"#\w+", "", caption).strip()

    channel_tag = "#" + re.sub(r"[^A-Za-z0-9]", "", cfg.youtube_channel_name)
    ai_note = "AI-generated characters, voices and visuals. Script written with AI assistance."
    if kind == "short":
        description = f"{title}\n\n{caption_plain}\n\n#Shorts {channel_tag} #HinglishComedy #DesiMemes\n\n{ai_note}"
    else:
        summary = " ".join(str(plan.get("youtube_summary") or caption_plain).split())[:900]
        description = (
            f"{title}\n\n{summary}\n\nRoz naye videos aur shorts: {cfg.youtube_channel_name} ko subscribe karo!\n\n"
            f"{channel_tag} #HinglishComedy #DesiMemes #IndianComedy\n\n{ai_note}"
        )

    thumb_text = _clip_words(str(plan.get("thumbnail_text") or scenes[0]["meme_banner"] or title).upper(), 28)
    return {
        "kind": kind,
        "format": fmt,
        "mode": mode,
        "style": style,
        "background": ep_bg,
        "cast": [{"id": c.id, "name": c.name, "gender": c.gender, "outfit": c.look.outfit_style} for c in cast],
        "topic": topic or plan.get("topic", ""),
        "created_at": _dt.datetime.now().isoformat(timespec="seconds"),
        "video_title": title,
        "thumbnail_text": thumb_text,
        "youtube_description": description,
        "instagram_caption": caption,
        "youtube_tags": tags,
        "character_3d_base_prompt": cfg.character_visual_prompt,
        "full_voiceover_script": " ".join(s["spoken_line"] for s in scenes),
        "scenes": scenes,
    }


def _T(speaker, line, banner="", expr=None, react=None, sfx=None, card=None, bg=None):
    d = {
        "speaker": speaker,
        "spoken_line": line,
        "meme_banner": banner,
        "character_expression": expr,
        "reaction_expression": react,
        "sfx": sfx,
        "meme_card": card,
    }
    if bg:
        d["background"] = bg
    return d


_DEMOS = [
    {
        "video_title": "Mummy vs AI: Fan Band Kar! \U0001F602",
        "instagram_caption": "Tag karo us dost ko jo startup kholne wala hai! #mkverse3d #desimemes #hinglishcomedy #indianreels #techroast #funnyindia",
        "background": "home_room",
        "scenes": [
            _T("hero", "Bhai sach bata, 2026 mein hum sab AI ke bharose baithe hain, par mummy abhi bhi bolti hain, fan band kar!", "AI ERA VS DESI MUMMY LOGIC", bg="home_room"),
            _T("hero", "Udhar dost bol raha hai, bhai naya startup kholenge, aur uske phone mein nineteen rupaye ka data loan chal raha hai!", "SHARK TANK FOUNDER ON 19 RS DATA", bg="street_chai"),
            _T("hero", "ChatGPT ne poora business plan likh diya, par mummy ka ek sawaal, beta khana khaya?", "AI HAS NO ANSWER FOR THIS", bg="home_room"),
            _T("hero", "Zindagi mein sab kuch update ho gaya, bas humari jeb wahi purane version pe atki hai!", "WALLET STILL ON WINDOWS XP", bg="cyber_studio"),
        ],
    },
    {
        "video_title": "2 AM Maggi Startup Ideas \U0001F35C\U0001F92F",
        "instagram_caption": "Raat ke 2 baje ke ideas subah kahan jaate hain? Comment karo! #mkverse3d #maggi #desimemes #hinglishcomedy #startupindia #funnyreels",
        "background": "home_room",
        "scenes": [
            _T("hero", "Raat ke do baje, Maggi bani, aur dimaag ne bola, bhai ek billion dollar idea aaya!", "2 AM BRAIN IS A GENIUS", bg="home_room"),
            _T("hero", "Idea itna bada tha ki maine apne aap ko phone mein note bhi nahi kiya, kyunki yaad toh rahega hi na!", "NARRATOR: IT DID NOT", bg="cyber_studio"),
            _T("hero", "Subah uthe, Maggi ka bartan sink mein, aur idea kahin gayab. Sirf bartan yaad hai.", "MAGGI STAYED. IDEA LEFT.", bg="home_room"),
            _T("hero", "Moral of the story: startup nahi, pehle bartan dho le bhai!", "FOUNDER OF THE SINK", bg="home_room"),
        ],
    },
]

_DEMO_DIALOGUE_SHORT = [
    _T("hero", "Mummy, WiFi ka password kya hai?", "WIFI KA PASSWORD", "shocked", "smirking", bg="home_room"),
    _T("mummy", "Pehle kamra saaf kar, phir bataungi.", "", "angry_roast", "shocked", "record_scratch", bg="home_room"),
    _T("hero", "Ye toh seedha blackmail hai!", "", "laughing", "smirking", "vine_boom",
       {"type": "expectation_reality", "text_a": "Mummy ek password degi", "text_b": "Mummy ne shart rakh di"}, bg="home_room"),
    _T("mummy", "Sharma ji ka beta bina puche saaf karta hai.", "", "smirking", "facepalm", "whoosh", bg="home_room"),
    _T("hero", "Toh Sharma ji ke bete se hi WiFi maang lo BEEP!", "", "facepalm", "laughing", "vine_boom", bg="home_room"),
]
_DEMO_DIALOGUE_LONG = [
    _T("hero", "Bhai aaj ka topic: ghar mein WiFi ka password kisko pata hai, aur kaun uska fayda uthata hai.", "WIFI PASSWORD KA KHEL", "shocked", "smirking", "vine_boom", bg="home_room"),
    _T("mummy", "Password mujhe pata hai beta, par bataungi tab jab tu apna kamra saaf karega.", "", "angry_roast", "shocked", "record_scratch", bg="home_room"),
    _T("bunty", "Aunty ji ye toh seedha blackmail hai, bhai Shark Tank mein bhi aisi deal nahi milti!", "", "laughing", "smirking", "laugh_punch",
       {"type": "expectation_reality", "text_a": "Aunty ek password dengi", "text_b": "Aunty ne shart rakh di"}, bg="home_room"),
    _T("uncle", "Hamare zamane mein WiFi nahi tha, hum signal ke liye padosi ki chhat pe chadh jaate the.", "", "smirking", "laughing", "whoosh", bg="street_chai"),
    _T("hero", "Uncle, aapka phone itna purana hai ki usme BEEP bhi antique lagta hai.", "ANTIQUE PHONE ALERT", "laughing", "shocked", "vine_boom", bg="street_chai"),
    _T("uncle", "Beta ye WhatsApp pe aaya tha, ki naye phone se dimaag kharab hota hai.", "", "smirking", "facepalm", "whoosh", bg="street_chai"),
    _T("bunty", "Bhai maine ek startup socha hai, WiFi password ko locker mein rakhne wala app!", "STARTUP ALERT", "shocked", "smirking", "vine_boom", bg="office_boardroom"),
    _T("mummy", "Pehle maths mein pass hoke dikha, Sharma ji ka beta toh...", "", "facepalm", "laughing", "whoosh",
       {"type": "stamp", "text_a": "Sharma ji ka beta"}, bg="home_room"),
    _T("hero", "Mummy aap har baar Sharma ji ke bete ko le aati ho, wo toh mera WiFi bhi chura raha hoga!", "", "laughing", "shocked", "laugh_punch", bg="home_room"),
    _T("bunty", "Aur raaz ki baat, password hai one two three four five six, bhai sab ko pata hai!", "", "shocked", "facepalm", "vine_boom",
       {"type": "nobody_me", "text_a": "Password rakha 123456 aur bola secure hai"}, bg="home_room"),
    _T("uncle", "Ye toh meri WhatsApp group mein bhi aaya tha, forward as received.", "", "smirking", "laughing", "whoosh", bg="home_room"),
    _T("hero", "Moral: password strong rakho aur mummy se rishta strong, aur MkVerse 3D ko subscribe karo!", "SUBSCRIBE KARO", "laughing", "smirking", "vine_boom", bg="cyber_studio"),
]
_DEMO_TALENT_SHORT = [
    _T("rocky", "Welcome to Talent Hunt, contestant, apna talent dikha.", "TALENT HUNT", "angry_roast", "smirking", "whoosh", bg="talent_stage"),
    _T("hero", "Main AI se pyaar ka gaana gaunga!", "", "shocked", "smirking", "vine_boom", bg="talent_stage"),
    _T("meera", "Pehle gaane se pehle rishta toh theek kar le.", "", "smirking", "laughing", "laugh_punch", bg="talent_stage"),
    _T("rocky", "BUZZER! Ye gaana tha ya server error?", "", "angry_roast", "facepalm", "record_scratch",
       {"type": "red_buzzer", "text_a": "BUZZER! SERVER ERROR"}, bg="talent_stage"),
]
_DEMO_TALENT_LONG = [
    _T("rocky", "Welcome to MkVerse Talent Hunt, jahan talent kam aur confidence zyada hota hai!", "TALENT HUNT 2026", "angry_roast", "smirking", "whoosh", bg="talent_stage"),
    _T("hero", "Namaste judges, main aaj apna talent dikhaunga, AI se pyaar ka gaana!", "", "shocked", "smirking", "vine_boom", bg="talent_stage"),
    _T("meera", "Wah, gaane ke saath saath rishta bhi AI se hi dhoondhna padega kya?", "", "smirking", "laughing", "laugh_punch", bg="talent_stage"),
    _T("hero", "Gaana shuru: tu mera ChatGPT, main tera prompt, humari love story bilkul fine-tuned hai!", "LOVE STORY FINE-TUNED", "laughing", "facepalm", "whoosh",
       {"type": "nobody_me", "text_a": "AI ko propose kar raha hoon raat ke 2 baje"}, bg="talent_stage"),
    _T("rocky", "BUZZER! Bhai ye gaana tha ya server error, mere kaan ki warranty khatam!", "", "angry_roast", "shocked", "record_scratch",
       {"type": "red_buzzer", "text_a": "BUZZER PRESSED!"}, bg="talent_stage"),
    _T("guru", "Beta jo AI se pyaar karta hai, wo ek din apne hi charger ke saamne rota hai.", "", "smirking", "laughing", "whoosh", bg="talent_stage"),
    _T("meera", "Meri taraf se teen star, ek tere gaane ko aur do isliye ki tu aaya toh!", "", "smirking", "facepalm", "laugh_punch",
       {"type": "expectation_reality", "text_a": "Standing ovation", "text_b": "Judges ne kaan band kar liye"}, bg="talent_stage"),
    _T("hero", "Judges, thoda support karo, main toh pura dil lagake gaya BEEP!", "", "shocked", "smirking", "vine_boom", bg="talent_stage"),
    _T("rocky", "Dil lagake gaya, par sur kahin chhod aaya. Verdict: agle saal try karna!", "", "angry_roast", "laughing", "record_scratch", bg="talent_stage"),
    _T("guru", "Aur subscribe karo MkVerse 3D, warna agla gaana hum sab milke gaayenge!", "SUBSCRIBE KARO", "smirking", "shocked", "vine_boom", bg="talent_stage"),
]


def _demo_plan(kind: str, fmt: str) -> Dict[str, Any]:
    if fmt in ("dialogue", "couple_roast"):
        sc = _DEMO_DIALOGUE_LONG if kind == "long" else _DEMO_DIALOGUE_SHORT
        return {"video_title": "WiFi Password Ka Drama: Mummy vs Sab", "thumbnail_text": "WIFI PASSWORD DRAMA", "youtube_summary": "Demo dialogue episode.", "background": "home_room", "scenes": [dict(s) for s in sc]}
    if fmt in ("talent_roast", "panel_5_6"):
        sc = _DEMO_TALENT_LONG if kind == "long" else _DEMO_TALENT_SHORT
        return {"video_title": "AI Se Pyaar Ka Gaana: Talent Hunt Roast", "thumbnail_text": "TALENT HUNT ROAST", "youtube_summary": "Demo talent roast.", "background": "talent_stage", "scenes": [dict(s) for s in sc]}
    if kind == "long":  # stitch both solo demos so the wide layout / multi-scene path can be tested offline
        return {
            "video_title": "MkVerse 3D Special: Mummy vs AI + 2 AM Maggi",
            "youtube_summary": "Demo episode: do roast ek saath. Offline test video.",
            "thumbnail_text": "MUMMY VS AI",
            "background": "home_room",
            "scenes": [dict(sc) for d in _DEMOS for sc in d["scenes"]],
        }
    return dict(random.choice(_DEMOS))


# ------------------------------------------------------------------ council
class BrainCouncil:
    def __init__(self, cfg: StudioConfig, llm: Optional[LLMClient] = None):
        self.cfg = cfg
        self.llm = llm or LLMClient(cfg)

    # ---- validators
    @staticmethod
    def _val_script(kind: str) -> Callable[[str], None]:
        lo, hi = KIND_SPECS[kind]["words"]

        def check(text: str) -> None:
            n = len(clean_script(text).split())
            if not lo <= n <= hi:
                raise ValueError(f"{kind} script has {n} words, expected {lo}-{hi}")

        return check

    @staticmethod
    def _val_dialogue(kind: str, tag_map: Dict[str, str]) -> Callable[[str], None]:
        lo, hi = KIND_SPECS[kind]["words"]
        t_lo, t_hi = KIND_SPECS[kind]["turns"]

        def check(text: str) -> None:
            turns = parse_dialogue(text, tag_map)
            n = sum(len(t[1].split()) for t in turns)
            if not lo <= n <= hi:
                raise ValueError(f"dialogue has {n} words, expected {lo}-{hi}")
            if not t_lo <= len(turns) <= t_hi:
                raise ValueError(f"dialogue has {len(turns)} turns, expected {t_lo}-{t_hi}")
            if len({t[0] for t in turns}) < 2:
                raise ValueError("dialogue needs at least 2 different speakers")

        return check

    @staticmethod
    def _val_json(text: str) -> None:
        extract_json(text)

    # ---- prompts
    def _solo_prompt(self, kind: str, theme: str, reference: str, avoid: str, half_script: str = "") -> str:
        head = f"THEME: {theme}\n{reference}\nRECENT VIDEO TITLES TO AVOID REPEATING: {avoid}\n"
        if half_script.strip():
            head += f"\nUSER'S HALF-SCRIPT / STARTING IDEA (incorporate and expand this seamlessly into the full script):\n{half_script.strip()}\n"
        head += "\n"
        rules = (
            "Rules:\n" + style_rules(self.cfg.content_style) + "\n"
            "- Original jokes only. Do not reuse the reference's exact copyrighted audio.\n"
            "- Spoken words ONLY: no scene labels, no brackets, no emojis, no stage directions, no markdown."
        )
        if kind == "short":
            return head + (
                "Write ONE spoken roast script of 55-65 words (about 22 seconds, MUST stay under 25 seconds) as exactly 4 very short paragraphs, one per scene, separated by a blank line.\n"
                "Paragraph 1 = scroll-stopping hook (one sentence, max 14 words). Paragraphs 2-3 = escalating jokes with a savage twist. Paragraph 4 = punchline + callback.\n"
            ) + rules
        channel = self.cfg.youtube_channel_name
        return head + (
            "Write ONE spoken comedy-roast video script of 330-370 words (about 2 minutes 15 seconds, MUST be between 2:00 and 2:30) "
            "as exactly 10 paragraphs, one per scene, separated by a blank line, 30-40 words each.\n"
            "Structure: P1 = hook that promises what we are about to roast. P2 = relatable setup. P3-P8 = six escalating bits, each with a fresh joke and a concrete Desi example. "
            f"P9 = twist that calls back to the hook. P10 = one-line moral, then ask viewers to subscribe to {channel} for daily videos and shorts.\n"
        ) + rules

    def _dialogue_prompt(
        self,
        kind: str,
        fmt: str,
        theme: str,
        reference: str,
        avoid: str,
        cast: Sequence[Character],
        half_script: str = "",
        clone_mode: bool = False,
    ) -> str:
        channel = self.cfg.youtube_channel_name
        cast_desc = "\n".join(f"- {c.tag} ({c.gender}, wearing {c.look.outfit_style}): {c.persona}" for c in cast)
        hero = cast[-1].tag if fmt in ("talent_roast", "panel_5_6") else cast[0].tag
        head = f"THEME: {theme}\n{reference}\nRECENT VIDEO TITLES TO AVOID REPEATING: {avoid}\n\nCHARACTERS (use ONLY these tags):\n{cast_desc}\n\n"
        if half_script.strip():
            head += f"USER'S HALF-SCRIPT / DIALOGUE SEED (keep these lines/ideas and complete the rest of the conversation naturally):\n{half_script.strip()}\n\n"

        if fmt in ("talent_roast", "panel_5_6"):
            show = (
                f"Setting: a viral talent-roast panel show called '{channel} Latent Hunt' (inspired by edgy panel roast shows). "
                f"{hero} is the contestant on stage with an absurd talent/claim; the panel judges react brutally in their own styles with red buzzers, savage comebacks and a final twist. "
                "Never use real show names or real people.\n"
            )
        elif fmt == "couple_roast":
            show = f"Setting: a high-energy Hinglish banter between a Gen-Z boy and girl ({', '.join(c.tag for c in cast)}) roasting each other's habits around the theme.\n"
        else:
            show = f"Setting: a funny multi-character sketch between these {len(cast)} characters about the theme. {hero} drives the story; the others add escalating, character-true reactions.\n"

        if clone_mode:
            show += (
                "MODE 4 (AI SCENE CLONE): Recreate the exact comedic beat-by-beat energy, timing, and dialogue dynamics of the reference video "
                "adapted for our 3D AI characters and voices so it feels like a 3D AI version of that scene without copying real names.\n"
            )

        if kind == "short":
            size = "Write the dialogue as 5-6 very short turns, 55-65 words in total (about 22 seconds, MUST stay under 25 seconds), each turn 6-16 words. The first turn is a scroll-stopping hook; the last is the punchline.\n"
        else:
            size = (
                "Write the dialogue as 14-18 turns, 330-370 words in total (about 2 minutes 15 seconds, MUST be between 2:00 and 2:30), each turn 10-30 words. "
                f"First turn = hook that promises what we will roast. Middle = escalating bits where every character gets at least 2 turns and {hero} has about a third of the lines. "
                f"Second-last turn = twist that calls back to the hook. Last turn = one-line moral and a call to subscribe to {channel}.\n"
            )
        fmt_rule = "Output format: one line per turn exactly like `TAG: spoken line` (e.g. `" + cast[0].tag + ": Bhai kya scene hai.`). No other text, no stage directions, no brackets, no emojis, no markdown.\n"
        rules = "Rules:\n" + style_rules(self.cfg.content_style)
        return head + show + size + fmt_rule + rules

    def create_episode(
        self,
        source: Dict[str, Any],
        recent_titles: Sequence[str] = (),
        demo: bool = False,
        kind: str = "short",
        fmt: str = "solo",
        cast: Optional[Sequence[Character]] = None,
        mode: str = "auto_upload",
        custom_script: str = "",
        background: str = "",
    ) -> Dict[str, Any]:
        if kind not in KIND_SPECS:
            raise ValueError(f"unknown kind '{kind}'")
        if fmt not in FORMATS:
            raise ValueError(f"unknown format '{fmt}'")
        spec = KIND_SPECS[kind]
        cast = list(cast or cast_for(fmt, kind, self.cfg.character_name))
        theme = source.get("theme") or source.get("title") or "trending Desi topic"
        ep_bg = background or source.get("detected_setup", {}).get("recommended_background") or infer_background_from_text(theme, fmt)

        # If demo mode AND no custom_script provided, return canned demo plan
        if demo and not custom_script.strip():
            return normalize_plan(_demo_plan(kind, fmt), self.cfg, theme, kind, fmt, cast, background=ep_bg, mode=mode)

        ref_title = source.get("title", "")
        ref_text = (source.get("transcript") or "")[:2000]
        is_clone = (mode == "yt_clone_remix")
        if ref_text and ref_title != theme:
            if is_clone:
                reference = (
                    f'Reference YouTube video to recreate in 3D AI (Mode 4 Clone): "{ref_title}"\n'
                    f"Reference transcript / dialogue flow: {ref_text}\n"
                    f"Detected setup: {json.dumps(source.get('detected_setup', {}), ensure_ascii=False)}\n"
                    "Match the scene setup, number of speakers, punchline rhythm, and comedic dialogue flow using our AI characters!"
                )
            else:
                reference = (
                    f'Reference video (INSPIRATION ONLY): "{ref_title}"\nReference transcript: {ref_text}\n'
                    "Silently work out its skeleton (hook type, number of beats, escalation, ending) and reuse ONLY that skeleton with a completely different setting, "
                    "characters and jokes. Never reuse its lines, names or distinctive bits."
                )
        else:
            reference = "No reference video this time - write purely from the theme."

        avoid = "; ".join(recent_titles[-8:]) or "none"
        tag_map = {c.tag: c.id for c in cast}

        # ---- stage 1: script
        if mode == "custom_script_upload" and custom_script.strip():
            # Mode 3: User supplied the full script directly!
            turns = parse_user_custom_script(custom_script, cast, fmt, kind)
        elif demo and custom_script.strip():
            # Offline Mode 4 / custom script test
            turns = parse_user_custom_script(custom_script, cast, fmt, kind)
        elif fmt == "solo":
            script_raw = self.llm.chat(
                "deepseek",
                "You are India's sharpest short-form comedy writer, writing for a 3D Gen-Z character called "
                f"'{self.cfg.character_name}' on the channel '{self.cfg.youtube_channel_name}'. "
                "You write natural Hinglish (Hindi in Roman script + punchy English).",
                self._solo_prompt(kind, theme, reference, avoid, half_script=custom_script),
                temperature=0.85, max_tokens=spec["script_tokens"], validate=self._val_script(kind),
            )
            script = clean_script(script_raw)
            turns = [(cast[0].id, ln) for ln in split_into_scenes(script, spec["scenes"], spec["solo_cap"])]
        else:
            script_raw = self.llm.chat(
                "deepseek",
                "You are India's sharpest comedy writer for multi-character 3D cartoon sketches on the channel "
                f"'{self.cfg.youtube_channel_name}'. You write natural Hinglish (Hindi in Roman script + punchy English).",
                self._dialogue_prompt(kind, fmt, theme, reference, avoid, cast, half_script=custom_script, clone_mode=is_clone),
                temperature=0.85, max_tokens=spec["script_tokens"], validate=self._val_dialogue(kind, tag_map),
            )
            turns = parse_dialogue(script_raw, tag_map)[: spec["max_scenes"]]

        # ---- stage 2: scene direction (soft failure -> deterministic defaults)
        direction: List[Dict[str, Any]] = []
        multi = fmt != "solo"
        if not demo:
            try:
                listing = [{"speaker": next((c.tag for c in cast if c.id == sp), cast[0].tag), "line": ln} for sp, ln in turns] if multi else [ln for _, ln in turns]
                meme_files = list_meme_assets(ASSETS_DIR)
                extra = (
                    f', "background": "one of {list(BACKGROUNDS)} (default {ep_bg})"'
                    f', "reaction_expression": "how the OTHER characters react (one of {list(EXPRESSIONS)})"'
                    f', "meme_card": null or {{"type": "{"|".join(CARD_TYPES)}", "text_a": "...", "text_b": "..."}}'
                    f', "meme_asset": null or one of {meme_files}'
                )
                raw = self.llm.chat(
                    "gpt_oss",
                    "You are a 3D animation and viral video director. Output strictly valid JSON, nothing else.",
                    f"""Direct these {len(turns)} scenes for a 3D cartoon video. DO NOT change or return the spoken lines.
SCENES (in order): {json.dumps(listing, ensure_ascii=False)}

Return ONLY this JSON:
{{"scenes": [{{"character_expression": "the speaker's expression, one of {list(EXPRESSIONS)}",
 "camera_motion": "one of {list(CAMERAS)}",
 "wan22_3d_prompt": "one-line 3D Pixar-style shot description",
 "meme_banner": "UPPERCASE meme header, max 28 characters, no emojis{' (use an empty string for about two thirds of the scenes)' if multi else ''}",
 "sfx": "one of {list(SFX_CHOICES)}"{extra}}}]}}
Exactly {len(turns)} objects, in scene order. Use vine_boom only on the biggest punchlines; vary expressions and camera moves. Use a meme_card on about 1 in 3 scenes where it makes the joke land.""",
                    temperature=0.6, max_tokens=spec["dir_tokens"], validate=self._val_json,
                )
                direction = [d for d in extract_json(raw).get("scenes", []) if isinstance(d, dict)]
            except Exception as exc:
                log.warning("scene direction failed (%s) - using default choreography", exc)

        keys = ("character_expression", "reaction_expression", "camera_motion", "background", "wan22_3d_prompt", "meme_banner", "sfx", "meme_card", "meme_asset")
        scenes = []
        for i, (sp, line) in enumerate(turns):
            d = direction[i] if i < len(direction) else {}
            scenes.append({"speaker": sp, "spoken_line": line, **{k: d.get(k) for k in keys}})
        plan: Dict[str, Any] = {"scenes": scenes, "background": ep_bg}

        # ---- stage 3: SEO (soft failure)
        spoken = " ".join(ln for _, ln in turns)
        if not demo:
            if kind == "short":
                seo_ask = """{"video_title": "clickable Hinglish YouTube Shorts title, max 55 characters, 0-1 emoji, no hashtags",
 "instagram_caption": "2 witty Hinglish lines asking viewers to tag a friend, then 10 niche hashtags",
 "youtube_tags": ["8 to 10 lowercase single-word tags"]}"""
            else:
                seo_ask = """{"video_title": "clickable Hinglish YouTube title, max 80 characters, 0-1 emoji, no hashtags",
 "youtube_summary": "2-3 lines in Hinglish describing the video, with 2 relevant search keywords woven in naturally",
 "thumbnail_text": "2-4 UPPERCASE words for the thumbnail, max 24 characters",
 "youtube_tags": ["10 to 12 lowercase single-word tags"]}"""
            try:
                raw = self.llm.chat(
                    "gemma",
                    "You are a viral social-media growth specialist for Indian Gen-Z. Output strictly valid JSON, nothing else.",
                    f'Script: "{spoken[:3500]}"\nReturn ONLY this JSON:\n{seo_ask}',
                    temperature=0.75, max_tokens=900, validate=self._val_json,
                )
                keep = ("video_title", "instagram_caption", "youtube_tags", "youtube_summary", "thumbnail_text")
                plan.update({k: v for k, v in extract_json(raw).items() if k in keep})
            except Exception as exc:
                log.warning("SEO stage failed (%s) - using generated title/caption", exc)

        return normalize_plan(plan, self.cfg, theme, kind, fmt, cast, background=ep_bg, mode=mode)
