"""
Voice + word timings + procedural meme SFX.

* edge-tts voiceover (WordBoundary events when the voice supports them; otherwise sentence
  events or a proportional estimate - so captions ALWAYS have timings)
* SRT written by us (independent of edge-tts' SubMaker API, which changed between versions)
* five procedural SFX written with NumPy (no copyrighted audio)
* offline "fake voice" for --demo dry-runs without internet
"""
from __future__ import annotations

import asyncio
import logging
import re
import subprocess
import wave
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence, Tuple

import numpy as np

log = logging.getLogger("studio.voice")
SR = 44100
SFX_NAMES = ("vine_boom", "whoosh", "laugh_punch", "censor_beep", "record_scratch")


# --------------------------------------------------------------------- timings
def estimate_word_timings(text: str, duration: float, start: float = 0.0) -> List[Dict[str, Any]]:
    words = text.split()
    if not words:
        return []
    weights = [max(len(w), 2) + (4 if w[-1] in ",.!?;:" else 0) for w in words]
    total = float(sum(weights))
    t, out = start, []
    for w, wt in zip(words, weights):
        d = duration * wt / total
        out.append({"word": w, "start": t, "end": t + d})
        t += d
    return out


def _clean_words(words: List[Dict[str, Any]], duration: float) -> List[Dict[str, Any]]:
    words = sorted((w for w in words if str(w.get("word", "")).strip()), key=lambda w: w["start"])
    for i, w in enumerate(words):
        nxt = words[i + 1]["start"] if i + 1 < len(words) else duration
        w["end"] = max(min(w["end"], nxt), w["start"] + 0.06)
    return words


def format_srt(words: List[Dict[str, Any]], per_cue: int = 4) -> str:
    def ts(sec: float) -> str:
        ms = int(round(sec * 1000))
        return f"{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d},{ms % 1000:03d}"

    cues = []
    for i in range(0, len(words), per_cue):
        grp = words[i : i + per_cue]
        cues.append(f"{len(cues) + 1}\n{ts(grp[0]['start'])} --> {ts(grp[-1]['end'])}\n{' '.join(w['word'] for w in grp)}\n")
    return "\n".join(cues)


# ------------------------------------------------------------------------ wav
def _write_wav(path: Path, samples: np.ndarray, sr: int = SR) -> None:
    samples = np.nan_to_num(np.asarray(samples, dtype=np.float64))
    peak = float(np.max(np.abs(samples))) or 1.0
    pcm = (np.clip(samples / peak * 0.9, -1, 1) * 32767).astype(np.int16)
    with wave.open(str(path), "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sr)
        wf.writeframes(pcm.tobytes())


def _lowpass(x: np.ndarray, n: int) -> np.ndarray:
    return np.convolve(x, np.ones(n) / n, mode="same")


def _t(dur: float) -> np.ndarray:
    return np.linspace(0, dur, int(SR * dur), endpoint=False)


def synth_vine_boom() -> np.ndarray:
    t = _t(0.9)
    freq = 40 + 90 * np.exp(-6 * t)
    phase = 2 * np.pi * np.cumsum(freq) / SR
    body = np.sin(phase) + 0.35 * np.sin(2 * phase) + 0.15 * np.sin(3 * phase)
    env = np.exp(-3.2 * t) * (1 - np.exp(-t * 400))
    click = np.random.default_rng(1).standard_normal(len(t)) * np.exp(-t * 120) * 0.3
    return np.tanh((body * env + click) * 1.8)


def synth_whoosh() -> np.ndarray:
    t = _t(0.45)
    noise = np.random.default_rng(2).standard_normal(len(t))
    band = _lowpass(noise, 6) - _lowpass(noise, 90)
    env = np.sin(np.pi * t / 0.45) ** 2
    return band * env


def synth_laugh_punch() -> np.ndarray:
    out = np.zeros(int(SR * 1.0))
    for i in range(4):
        t = _t(0.14)
        f0 = 260 * (0.93**i)
        saw = 2 * ((t * f0) % 1.0) - 1
        voiced = _lowpass(saw, 28) * np.exp(-9 * t) * (1 - np.exp(-t * 300))
        start = int(SR * 0.17 * i)
        out[start : start + len(voiced)] += voiced * (1.0 - 0.18 * i)
    return out


def synth_censor_beep() -> np.ndarray:
    t = _t(0.55)
    env = np.minimum(1, np.minimum(t * 200, (0.55 - t) * 200))
    return np.sin(2 * np.pi * 1000 * t) * env


def synth_record_scratch() -> np.ndarray:
    t = _t(0.6)
    freq = 2200 * np.exp(-3.2 * t) + 150
    phase = 2 * np.pi * np.cumsum(freq) / SR
    noise = np.random.default_rng(3).standard_normal(len(t))
    sig = np.sign(np.sin(phase)) * 0.5 + _lowpass(noise, 4) * 0.7
    return sig * np.exp(-2.2 * t) * np.minimum(1, t * 80)


_SYNTH = {
    "vine_boom": synth_vine_boom,
    "whoosh": synth_whoosh,
    "laugh_punch": synth_laugh_punch,
    "censor_beep": synth_censor_beep,
    "record_scratch": synth_record_scratch,
}


def ensure_sfx(sfx_dir: Path, force: bool = False) -> Dict[str, Path]:
    sfx_dir.mkdir(parents=True, exist_ok=True)
    paths: Dict[str, Path] = {}
    for name, fn in _SYNTH.items():
        p = sfx_dir / f"{name}.wav"
        if force or not p.exists():
            _write_wav(p, fn())
        paths[name] = p
    return paths


# ------------------------------------------------------------------ audio utils
def decode_mono(path: Path, sr: int = 24000) -> np.ndarray:
    """Decode any audio file to mono float32 via the bundled ffmpeg (moviepy 1.0.3's to_soundarray breaks on new numpy)."""
    import imageio_ffmpeg

    cmd = [imageio_ffmpeg.get_ffmpeg_exe(), "-v", "error", "-i", str(path), "-f", "f32le", "-ac", "1", "-ar", str(sr), "-"]
    raw = subprocess.run(cmd, capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).astype(np.float64)


def is_bleep(word: str) -> bool:
    """The writer puts the single word BEEP where a strong swear would go; we replace it with a censor tone."""
    return re.sub(r"[^a-z]", "", str(word).lower()) in {"beep", "bleep"}


def mark_bleeps(words: List[Dict[str, Any]]) -> List[Tuple[float, float]]:
    out = []
    for w in words:
        w["bleep"] = is_bleep(w["word"])
        if w["bleep"]:
            out.append((w["start"], w["end"]))
    return out


def silence_ranges(audio: np.ndarray, sr: int, ranges: Sequence[Tuple[float, float]], pad: float = 0.03) -> np.ndarray:
    audio = audio.copy()
    for a, b in ranges:
        audio[max(int((a - pad) * sr), 0) : int((b + pad) * sr)] = 0.0
    return audio


# ----------------------------------------------------------------------- voice
def _audio_duration(path: Path) -> float:
    from moviepy.editor import AudioFileClip

    clip = AudioFileClip(str(path))
    try:
        return float(clip.duration)
    finally:
        clip.close()


def _rate_pct(rate: str) -> int:
    m = re.fullmatch(r"\s*([+-]?\d+)\s*%\s*", rate or "")
    return int(m.group(1)) if m else 0


class VoiceEngine:
    def __init__(self, voice: str = "hi-IN-MadhurNeural", rate: str = "+12%", pitch: str = "+2Hz"):
        self.voice, self.rate, self.pitch = voice, rate, pitch

    async def synthesize(self, text: str, out_dir: Path, demo: bool = False, rate: Optional[str] = None) -> Dict[str, Any]:
        out_dir.mkdir(parents=True, exist_ok=True)
        rate = rate or self.rate
        try:
            res = await self._edge(text, out_dir, rate)
            res["rate"], res["fake"] = rate, False
            return res
        except Exception as exc:
            if not demo:
                raise
            log.warning("edge-tts unavailable (%s) - using offline placeholder voice (demo only)", str(exc)[:100])
            (out_dir / "voiceover.mp3").unlink(missing_ok=True)
            res = self._fake(text, out_dir)
            res["rate"], res["fake"] = rate, True
            return res

    async def synthesize_fit(
        self,
        text: str,
        out_dir: Path,
        target: Tuple[float, float],
        demo: bool = False,
        min_rate: int = -8,
        max_rate: int = 32,
    ) -> Dict[str, Any]:
        """Synthesize, and if the audio misses the wanted length (e.g. Shorts must be 20-25 s)
        re-synthesize ONCE with the speaking rate nudged so it lands in the middle of the range."""
        lo, hi = target
        first = await self.synthesize(text, out_dir, demo)
        dur = first["duration"]
        if first.get("fake") or lo <= dur <= hi:
            return first
        cur = _rate_pct(first["rate"])
        new_pct = round(((1 + cur / 100.0) * dur / ((lo + hi) / 2.0) - 1) * 100)
        new_pct = max(min_rate, min(max_rate, new_pct))
        if new_pct == cur:
            log.warning("voice is %.1fs (wanted %d-%ds) and rate cannot change further - shorten the script", dur, lo, hi)
            return first
        second = await self.synthesize(text, out_dir, demo, rate=f"{new_pct:+d}%")
        best = min((first, second), key=lambda r: 0 if lo <= r["duration"] <= hi else min(abs(r["duration"] - lo), abs(r["duration"] - hi)))
        if not lo <= best["duration"] <= hi:
            log.warning("voice is %.1fs after rate tuning (wanted %d-%ds)", best["duration"], lo, hi)
        else:
            log.info("voice fitted to %.1fs with rate %s", best["duration"], best["rate"])
        if best is first:  # the second pass overwrote the files on disk - redo the first so disk matches what we return
            return await self.synthesize(text, out_dir, demo, rate=first["rate"])
        return best

    async def _edge_line(self, text: str, mp3: Path, voice: str, rate: str, pitch: str) -> Tuple[List[Dict[str, Any]], Path]:
        """One TTS call -> mp3 on disk + word timings (relative to the start of this clip)."""
        import edge_tts

        mp3.parent.mkdir(parents=True, exist_ok=True)

        async def run(**extra):
            comm = edge_tts.Communicate(text, voice, rate=rate, pitch=pitch, **extra)
            words, sents = [], []
            with open(mp3, "wb") as fh:
                async for chunk in comm.stream():
                    kind = chunk["type"]
                    if kind == "audio":
                        fh.write(chunk["data"])
                    elif kind == "WordBoundary":
                        words.append(chunk)
                    elif kind == "SentenceBoundary":
                        sents.append(chunk)
            return words, sents

        try:
            words, sents = await run(boundary="WordBoundary")  # edge-tts >= 7 needs this explicitly
        except TypeError:
            words, sents = await run()  # edge-tts 6.x emits WordBoundary by default
        if not mp3.exists() or mp3.stat().st_size < 1000:
            raise RuntimeError("edge-tts returned no audio")

        if words:
            ev = [{"word": w["text"], "start": w["offset"] / 1e7, "end": (w["offset"] + max(w.get("duration", 0), 1e6)) / 1e7} for w in words]
        elif sents:
            ev = []
            for sn in sents:
                ev += estimate_word_timings(sn["text"], sn.get("duration", 0) / 1e7, sn["offset"] / 1e7)
        else:
            ev = []  # caller falls back to a proportional estimate
        return ev, mp3

    async def _edge(self, text: str, out_dir: Path, rate: str) -> Dict[str, Any]:
        mp3 = out_dir / "voiceover.mp3"
        ev, _ = await self._edge_line(text, mp3, self.voice, rate, self.pitch)
        duration = _audio_duration(mp3)
        return self._finish(mp3, ev or estimate_word_timings(text, duration), duration, out_dir)

    @staticmethod
    def _fake_audio(text: str, f0_lo: float = 110, f0_hi: float = 190, seed: int = 7) -> Tuple[np.ndarray, List[Dict[str, Any]], float]:
        words = estimate_word_timings(text, len(text.split()) / 2.7)
        duration = words[-1]["end"] + 0.3
        rng = np.random.default_rng(seed)
        audio = np.zeros(int(SR * duration))
        for w in words:
            t = _t(max(w["end"] - w["start"] - 0.03, 0.05))
            f0 = rng.uniform(f0_lo, f0_hi)
            saw = 2 * ((t * f0) % 1.0) - 1
            span = t[-1] if len(t) > 1 and t[-1] > 0 else 1.0
            burst = _lowpass(saw, 18) * np.clip(np.sin(np.pi * t / span), 0, 1) ** 0.7
            st = int(w["start"] * SR)
            audio[st : st + len(burst)] += burst
        return audio, words, duration

    def _fake(self, text: str, out_dir: Path) -> Dict[str, Any]:
        audio, words, duration = self._fake_audio(text)
        wav = out_dir / "voiceover.wav"
        _write_wav(wav, audio)
        return self._finish(wav, words, duration, out_dir)

    @staticmethod
    def _finish(audio: Path, ev: List[Dict[str, Any]], duration: float, out_dir: Path) -> Dict[str, Any]:
        words = _clean_words(ev, duration)
        bleeps = mark_bleeps(words)
        if bleeps:  # cut the spoken "beep" out of the audio; the renderer lays a censor tone over it
            sr = 24000
            wav = out_dir / "voiceover.wav"
            _write_wav(wav, silence_ranges(decode_mono(audio, sr), sr, bleeps), sr)
            audio = wav
        srt = out_dir / "subtitles.srt"
        srt.write_text(format_srt(words), encoding="utf-8")
        return {"audio_path": audio, "srt_path": srt, "words": words, "duration": duration, "bleeps": bleeps}

    # ------------------------------------------------------------ dialogue (several characters)
    async def _dialogue_pass(self, scenes: List[Dict[str, Any]], chars: Dict[str, Any], out_dir: Path, shift: int, demo: bool, tag: str) -> Dict[str, Any]:
        sem = asyncio.Semaphore(4)
        offline = getattr(self, "_offline", False)

        async def one(i: int, sc: Dict[str, Any]):
            nonlocal offline
            ch = chars[sc["speaker"]]
            rate = f"{max(-30, min(60, ch.rate + shift)):+d}%"
            pitch = f"{ch.pitch:+d}Hz"
            path = out_dir / "lines" / f"{tag}_{i:02d}.mp3"
            async with sem:
                if not offline:
                    try:
                        ev, p = await self._edge_line(sc["spoken_line"], path, ch.voice, rate, pitch)
                        return p, ev, rate
                    except Exception as exc:
                        if not demo:
                            raise
                        offline = True
                        self._offline = True
                        log.warning("edge-tts unavailable (%s) - offline placeholder voices (demo only)", str(exc)[:80])
                audio, words, _ = self._fake_audio(sc["spoken_line"], 100 + ch.pitch * 3, 180 + ch.pitch * 3, seed=i + 1)
                wav = path.with_suffix(".wav")
                path.parent.mkdir(parents=True, exist_ok=True)
                _write_wav(wav, audio)
                return wav, words, rate

        results = await asyncio.gather(*(one(i, sc) for i, sc in enumerate(scenes)))

        sr, gap = 24000, 0.2
        chunks: List[np.ndarray] = []
        words_all: List[Dict[str, Any]] = []
        windows: List[Tuple[float, float]] = []
        cursor = 0.0
        for (path, ev, _rate), sc in zip(results, scenes):
            clip = decode_mono(path, sr)
            dur = len(clip) / sr
            ev = ev or estimate_word_timings(sc["spoken_line"], dur)
            start = cursor
            for w in _clean_words(ev, dur):
                words_all.append({"word": w["word"], "start": start + w["start"], "end": start + w["end"]})
            chunks += [clip, np.zeros(int(gap * sr))]
            cursor += dur + gap
            windows.append((start, cursor))
        return {"audio": np.concatenate(chunks), "sr": sr, "words": words_all, "windows": windows, "duration": cursor, "shift": shift}

    async def synthesize_dialogue(
        self,
        scenes: List[Dict[str, Any]],
        chars: Dict[str, Any],
        out_dir: Path,
        target: Tuple[float, float],
        demo: bool = False,
        min_shift: int = -15,
        max_shift: int = 30,
    ) -> Dict[str, Any]:
        """Every scene is spoken by its own character (own voice/pitch/rate). The whole conversation is stitched
        into one track; if its length misses `target` all voices are sped up / slowed down once."""
        out_dir.mkdir(parents=True, exist_ok=True)
        lo, hi = target
        best = await self._dialogue_pass(scenes, chars, out_dir, 0, demo, "p1")
        if not lo <= best["duration"] <= hi and not getattr(self, "_offline", False):
            used = [chars[sc["speaker"]].rate for sc in scenes]
            avg = sum(used) / len(used)
            factor = best["duration"] / ((lo + hi) / 2.0)
            shift = max(min_shift, min(max_shift, round(((1 + avg / 100.0) * factor - 1) * 100 - avg)))
            if shift != 0:
                second = await self._dialogue_pass(scenes, chars, out_dir, shift, demo, "p2")
                dist = lambda r: 0 if lo <= r["duration"] <= hi else min(abs(r["duration"] - lo), abs(r["duration"] - hi))  # noqa: E731
                best = min((best, second), key=dist)
            if not lo <= best["duration"] <= hi:
                log.warning("dialogue is %.1fs (wanted %d-%ds) - shorten the script", best["duration"], lo, hi)
        words = _clean_words(best["words"], best["duration"])
        bleeps = mark_bleeps(words)
        audio = silence_ranges(best["audio"], best["sr"], bleeps) if bleeps else best["audio"]
        wav = out_dir / "voiceover.wav"
        _write_wav(wav, audio, best["sr"])
        srt = out_dir / "subtitles.srt"
        srt.write_text(format_srt(words), encoding="utf-8")
        return {
            "audio_path": wav, "srt_path": srt, "words": words, "duration": best["duration"],
            "scene_windows": best["windows"], "bleeps": bleeps, "shift": best["shift"], "fake": getattr(self, "_offline", False),
        }
