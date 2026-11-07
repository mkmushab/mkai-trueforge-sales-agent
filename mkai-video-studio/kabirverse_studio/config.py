"""
KabirVerse 3D (v5 Mega-Edition) - central configuration.

Secrets (API keys) are read ONLY from `.env` / real environment variables.
Nothing secret is hardcoded in this file.
"""
from __future__ import annotations

import os
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional, Tuple

ROOT = Path(__file__).resolve().parent
OUTPUTS_DIR = ROOT / "outputs"
ASSETS_DIR = ROOT / "assets"
STATE_DIR = ROOT / "state"
LOGS_DIR = ROOT / "logs"
for _d in (OUTPUTS_DIR, ASSETS_DIR, ASSETS_DIR / "sfx", ASSETS_DIR / "memes", STATE_DIR, LOGS_DIR):
    _d.mkdir(parents=True, exist_ok=True)


# --------------------------------------------------------------------------- env
def _load_env(path: Path) -> None:
    if not path.exists():
        return
    try:
        from dotenv import load_dotenv

        load_dotenv(path, override=False)
        return
    except ImportError:
        pass
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


_load_env(ROOT / ".env")


def env(name: str, default: str = "") -> str:
    return os.getenv(name, default).strip()


def env_bool(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def env_int(name: str, default: int) -> int:
    try:
        return int(env(name, str(default)))
    except ValueError:
        return default


_PLACEHOLDER_HINTS = ("paste", "your_", "xxxx", "changeme", "example")


def is_real_key(key: str) -> bool:
    k = (key or "").strip().lower()
    return len(k) >= 12 and not any(h in k for h in _PLACEHOLDER_HINTS)


# ------------------------------------------------------------------------ models
@dataclass
class ModelEndpoint:
    name: str
    role: str
    api_key: str
    base_url: str
    model: str
    fallbacks: List[str] = field(default_factory=list)

    @property
    def ready(self) -> bool:
        return is_real_key(self.api_key)


def _build_models() -> Dict[str, ModelEndpoint]:
    base = env("OPENAI_BASE_URL", "https://api.generalcompute.com/v1")
    return {
        "deepseek": ModelEndpoint(
            "deepseek",
            "Hinglish script & roast writer",
            env("DEEPSEEK_API_KEY"),
            env("DEEPSEEK_BASE_URL", base),
            env("DEEPSEEK_MODEL", "DeepSeek V3.2"),
            ["deepseek-v3.2", "deepseek-ai/DeepSeek-V3.2", "deepseek-v3.1"],
        ),
        "gpt_oss": ModelEndpoint(
            "gpt_oss",
            "3D scene director & meme choreographer",
            env("GPT_OSS_API_KEY"),
            env("GPT_OSS_BASE_URL", base),
            env("GPT_OSS_MODEL", "gpt-oss-120b"),
            ["openai/gpt-oss-120b", "GPT-OSS-120B"],
        ),
        "gemma": ModelEndpoint(
            "gemma",
            "Viral title / caption / hashtag optimiser",
            env("GEMMA_API_KEY"),
            env("GEMMA_BASE_URL", base),
            env("GEMMA_MODEL", "Gemma 4 31B-IT"),
            ["gemma-4-31b-it", "google/gemma-4-31b-it"],
        ),
    }


def _parse_slots(raw: str) -> List[str]:
    slots: List[str] = []
    for part in raw.split(","):
        part = part.strip()
        m = re.fullmatch(r"(\d{1,2}):(\d{2})", part)
        if m and 0 <= int(m.group(1)) < 24 and 0 <= int(m.group(2)) < 60:
            slots.append(f"{int(m.group(1)):02d}:{m.group(2)}")
    return slots or ["11:00", "17:00", "21:30"]


_STYLES = ("clean", "desi", "bleeped")
_FORMATS = ("solo", "dialogue", "talent_roast", "panel_5_6", "couple_roast", "mix")


def _choice(raw: str, allowed, default: str) -> str:
    raw = (raw or "").strip().lower()
    return raw if raw in allowed else default


def _parse_one(raw: str, default: Optional[str]) -> Optional[str]:
    """One HH:MM value. 'off' / 'none' / '0' disables (returns None)."""
    raw = (raw or "").strip().lower()
    if raw in {"off", "none", "no", "0", "false"}:
        return None
    m = re.fullmatch(r"(\d{1,2}):(\d{2})", raw)
    if m and int(m.group(1)) < 24 and int(m.group(2)) < 60:
        return f"{int(m.group(1)):02d}:{m.group(2)}"
    return default


# ------------------------------------------------------------------------ studio
@dataclass
class StudioConfig:
    character_name: str = field(default_factory=lambda: env("CHARACTER_NAME", "Kabir 3D"))
    youtube_channel_name: str = field(default_factory=lambda: env("CHANNEL_NAME", "MkVerse 3D"))
    instagram_handle: str = field(default_factory=lambda: env("SOCIAL_HANDLE", "@mkverse.3d"))
    # text drawn under the avatar. Unset -> the social handle. Set VIDEO_WATERMARK= (empty) in .env to hide it.
    watermark_text: str = field(
        default_factory=lambda: os.getenv("VIDEO_WATERMARK").strip() if os.getenv("VIDEO_WATERMARK") is not None else env("SOCIAL_HANDLE", "@mkverse.3d")
    )
    language: str = "Hinglish (Hindi in Roman script mixed with punchy English)"

    character_visual_prompt: str = (
        "Pixar and DreamWorks style 3D animated Indian Gen-Z creator, 22 years old, "
        "neon cyber-hoodie, wireless headphones around neck, expressive eyebrows, "
        "charismatic smirk, RGB creator studio background, Unreal Engine 5 render, "
        "ultra-clean lighting"
    )

    # voice
    tts_voice: str = field(default_factory=lambda: env("TTS_VOICE", "hi-IN-MadhurNeural"))
    tts_rate: str = field(default_factory=lambda: env("TTS_RATE", "+12%"))
    tts_pitch: str = field(default_factory=lambda: env("TTS_PITCH", "+2Hz"))

    # scheduling: N shorts/reels per day + (optionally) 1 long YouTube video per day
    short_times: List[str] = field(
        default_factory=lambda: _parse_slots(env("SHORT_TIMES", env("DAILY_UPLOAD_TIMES", "11:00,17:00,21:30")))
    )
    long_time: Optional[str] = field(default_factory=lambda: _parse_one(env("LONG_VIDEO_TIME", "19:00"), "19:00"))
    # content: style = clean | desi (playful slang) | bleeped (desi + BEEP-censored strong words)
    content_style: str = field(default_factory=lambda: _choice(env("CONTENT_STYLE", "bleeped"), _STYLES, "bleeped"))
    # format = solo | dialogue (3-4 chars) | talent_roast (judges + contestant) | panel_5_6 (5-6 chars) | couple_roast (boy+girl) | mix
    short_format: str = field(default_factory=lambda: _choice(env("SHORT_FORMAT", "solo"), _FORMATS, "solo"))
    long_format: str = field(default_factory=lambda: _choice(env("LONG_FORMAT", "mix"), _FORMATS, "mix"))
    default_background: str = field(default_factory=lambda: env("DEFAULT_BACKGROUND", "auto"))
    auto_cut_shorts_from_long: bool = field(default_factory=lambda: env_bool("AUTO_CUT_SHORTS_FROM_LONG", True))
    short_target_sec: Tuple[int, int] = (20, 25)
    long_target_sec: Tuple[int, int] = (120, 150)
    timezone: str = field(default_factory=lambda: env("TIMEZONE", "Asia/Kolkata"))
    grace_minutes: int = field(default_factory=lambda: env_int("GRACE_MINUTES", 45))
    max_retries: int = 2
    web_port: int = field(default_factory=lambda: env_int("WEB_STUDIO_PORT", 8765))

    def format_for(self, kind: str, rng=None) -> str:
        import random as _r

        rng = rng or _r.Random()
        fmt = self.short_format if kind == "short" else self.long_format
        if fmt == "mix":
            fmt = rng.choice(
                ["solo", "dialogue", "talent_roast", "couple_roast"]
                if kind == "short"
                else ["dialogue", "talent_roast", "panel_5_6", "couple_roast"]
            )
        return fmt

    def daily_plan(self) -> List[Tuple[str, str]]:
        """[(kind, 'HH:MM'), ...] sorted by time."""
        plan = [("short", t) for t in self.short_times]
        if self.long_time:
            plan.append(("long", self.long_time))
        return sorted(plan, key=lambda x: x[1])

    # browser upload
    chrome_cdp_url: str = field(default_factory=lambda: env("CHROME_CDP_URL", "http://localhost:9222"))
    publish_youtube: bool = field(default_factory=lambda: env_bool("AUTO_PUBLISH_YOUTUBE", False))
    publish_instagram: bool = field(default_factory=lambda: env_bool("AUTO_PUBLISH_INSTAGRAM", False))
    youtube_visibility: str = field(default_factory=lambda: env("YT_VISIBILITY", "public").upper())
    youtube_disclose_ai: bool = field(default_factory=lambda: env_bool("YT_DISCLOSE_AI", True))

    models: Dict[str, ModelEndpoint] = field(default_factory=_build_models)

    # content pillars (themes). The trend spy finds a reference video per run.
    autonomous_topics: List[str] = field(
        default_factory=lambda: [
            "Desi parents vs AI: jab mummy ko pata chale ChatGPT khana nahi banata",
            "Engineering college 75% attendance rule vs placement package reality",
            "Instagram influencers selling fake hustle courses in 2026",
            "iPhone EMI par lene wale dost vs Android power users",
            "Gym ka pehla din motivation vs teesre din chole bhature relapse",
            "AI replacing software engineers while manager still asks for Excel sheet",
            "Raat ke 2 baje Maggi aur startup ideas jo subah tak bhool jaate hain",
            "Tech reviewers bolte hain budget phone aur price 80 hazaar",
            "Work from home expectation vs ghar pe dhaniya laane ki reality",
            "Exam ke ek raat pehle syllabus dekhne wale topper dost",
            "Shaadi mein relatives ka 'beta kya kar rahe ho' interrogation",
            "Swiggy delivery 10 minute promise vs 45 minute reality",
            "India's Got Latent style talent roast: contestant ka bizarre AI startup pitch",
            "Jungle camping trip expectation vs machhar aur Maggi ki reality",
            "Boyfriend vs Girlfriend: 'kuch nahi hua' ka asli matlab decoding",
            "Podcast bros asking alien psychology questions on every normal topic",
        ]
    )
    trend_queries: List[str] = field(
        default_factory=lambda: [
            "funny indian college life shorts",
            "desi parents vs technology comedy shorts",
            "indian tech roast shorts",
            "relatable indian office humour shorts",
            "hinglish meme roast shorts",
            "indian standup panel roast comedy shorts",
        ]
    )
