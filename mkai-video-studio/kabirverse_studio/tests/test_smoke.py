"""Offline smoke tests (v5 Mega-Suite):  python -m unittest discover -s tests -v   (run from project root)"""
import asyncio
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import agents.voice_and_lipsync as V
from agents.avatar_art import draw_avatar
from agents.backgrounds import BACKGROUNDS, infer_background_from_text, render_background
from agents.cast import CAST, CORE_CAST, build_cast, cast_for, match_cast_from_youtube_metadata, search_cast
from agents.clip_cutter import select_highlight_windows
from agents.meme_cards import CARD_TYPES, ensure_default_meme_assets, make_meme_card, normalize_card
from agents.multi_llm_brain import (
    KIND_SPECS,
    BrainCouncil,
    LLMClient,
    LLMUnavailable,
    clean_script,
    extract_json,
    normalize_plan,
    parse_dialogue,
    parse_user_custom_script,
    split_into_scenes,
    strip_beeps,
    style_rules,
)
from agents.pro_video_editor import KIND_LAYOUT, LAYOUTS, caption_chunks, scene_windows, slots
from agents.voice_and_lipsync import VoiceEngine, estimate_word_timings, format_srt, is_bleep, mark_bleeps
from config import ASSETS_DIR, StudioConfig, _parse_one, is_real_key

SHORT_SCRIPT = "\n\n".join(
    [
        "Bhai 2026 aa gaya par mummy ka fan band kar wala logic abhi bhi update nahi hua.",
        "Dost bol raha hai startup kholega, jabki uske phone mein data khatam aur wifi padosi ka chal raha hai.",
        "ChatGPT ne business plan likh diya, par mummy puchti hain beta khana khaya, AI ke paas jawab nahi.",
        "Moral of the story, startup baad mein, pehle bartan dho le bhai, warna mummy dhoondh legi tujhe.",
    ]
)
_SHORT_LINES = [
    ("KABIR", "Mummy WiFi ka password kya hai bolo na please."),
    ("MUMMY", "Pehle kamra saaf kar phir bataungi beta samjha."),
    ("KABIR", "Ye toh seedha blackmail hai mummy sach mein yaar."),
    ("MUMMY", "Sharma ji ka beta bina puche saaf karta hai."),
    ("KABIR", "Toh Sharma ji ke bete se hi WiFi maang lo BEEP."),
    ("MUMMY", "Haan haan jaa maang le woh dega nahi."),
]
DIALOGUE_SHORT = "\n".join(f"{t}: {l}" for t, l in _SHORT_LINES)
_LONG_TAGS = ["KABIR", "MUMMY", "BUNTY", "UNCLE"]
DIALOGUE_LONG = "\n".join(
    f"{_LONG_TAGS[i % 4]}: Bhai ye wala scene dekho mummy bolti hain fan band kar aur hum AI se plan likhwate hain kya zamana aa gaya yaar number {i}."
    for i in range(16)
)
BIT = "Bhai ye wala scene dekho, mummy bolti hain fan band kar, aur hum AI se business plan likhwate hain, kya zamana aa gaya yaar, sach mein."
LONG_SCRIPT = "\n\n".join([f"{BIT} Part {i}." for i in range(10)])


class Resp:
    def __init__(self, data, status=200):
        self._d, self.status_code = data, status

    def json(self):
        return self._d

    def raise_for_status(self):
        if self.status_code >= 400:
            raise RuntimeError(f"HTTP {self.status_code}")


class FakeSession:
    """Pretends to be GeneralCompute: /models + /chat/completions."""

    def __init__(self, script=SHORT_SCRIPT, bad_key=False):
        self.script, self.bad_key, self.posts = script, bad_key, []

    def get(self, url, **kw):
        return Resp({"data": [{"id": "deepseek-v3.2"}, {"id": "gpt-oss-120b"}, {"id": "gemma-4-31b-it"}]})

    def post(self, url, headers=None, json=None, timeout=0):
        import json as _j

        self.posts.append(json["model"])
        if self.bad_key:
            return Resp({}, 401)
        system = json["messages"][0]["content"]
        if "comedy writer" in system:
            return Resp({"choices": [{"message": {"content": self.script}}]})
        if "animation" in system:
            n = len(self.script.split("\n\n"))
            scenes = [{"character_expression": "shocked", "camera_motion": "zoom_in", "meme_banner": f"banner {i}", "sfx": "vine_boom"} for i in range(n)]
            return Resp({"choices": [{"message": {"content": "Sure!\n```json\n" + _j.dumps({"scenes": scenes}) + "\n```"}}]})
        seo = {
            "video_title": "Mummy Ka Fan Logic",
            "instagram_caption": "Tag karo! #a #b #c #d #e #f",
            "youtube_tags": ["funny", "desi"],
            "youtube_summary": "Mummy vs AI ka roast.",
            "thumbnail_text": "mummy vs ai",
        }
        return Resp({"choices": [{"message": {"content": _j.dumps(seo)}}]})


def cfg_with_keys():
    cfg = StudioConfig()
    for m in cfg.models.values():
        m.api_key = "gc_" + "x1y2z3" * 5
    return cfg


class Tests(unittest.TestCase):
    def test_helpers(self):
        self.assertFalse(is_real_key("paste_your_new_key_here"))
        self.assertTrue(is_real_key("gc_AbCdEf123456789"))
        self.assertEqual(extract_json('hi ```json\n{"a": {"b": 1}}\n``` bye'), {"a": {"b": 1}})
        self.assertEqual(clean_script("**Scene 1:** Bhai (pause) sun!").strip(), "Bhai sun!")
        self.assertEqual(_parse_one("off", "19:00"), None)
        self.assertEqual(_parse_one("20:30", "19:00"), "20:30")

    def test_daily_plan_is_3_shorts_plus_1_long(self):
        plan = StudioConfig().daily_plan()
        self.assertEqual([k for k, _ in plan].count("short"), 3)
        self.assertEqual([k for k, _ in plan].count("long"), 1)

    def test_scripts_have_right_length(self):
        lo, hi = KIND_SPECS["short"]["words"]
        self.assertTrue(lo <= len(SHORT_SCRIPT.split()) <= hi)
        lo, hi = KIND_SPECS["long"]["words"]
        self.assertTrue(lo <= len(LONG_SCRIPT.split()) <= hi)

    def test_short_council(self):
        cfg, sess = cfg_with_keys(), FakeSession()
        plan = BrainCouncil(cfg, LLMClient(cfg, sess)).create_episode({"theme": "mummy"}, kind="short")
        self.assertEqual(plan["kind"], "short")
        self.assertEqual(len(plan["scenes"]), 4)
        self.assertIn("#Shorts", plan["youtube_description"])
        self.assertIn("shorts", plan["youtube_tags"])
        self.assertEqual(plan["full_voiceover_script"], " ".join(s["spoken_line"] for s in plan["scenes"]))
        self.assertEqual(sess.posts[0], "deepseek-v3.2")

    def test_long_council(self):
        cfg, sess = cfg_with_keys(), FakeSession(script=LONG_SCRIPT)
        plan = BrainCouncil(cfg, LLMClient(cfg, sess)).create_episode({"theme": "mummy"}, kind="long")
        self.assertEqual(plan["kind"], "long")
        self.assertEqual(len(plan["scenes"]), 10)
        self.assertNotIn("#Shorts", plan["youtube_description"])
        self.assertIn("subscribe", plan["youtube_description"].lower())
        self.assertEqual(plan["thumbnail_text"], "MUMMY VS AI")

    def test_wrong_length_script_is_rejected_per_kind(self):
        cfg = cfg_with_keys()
        with self.assertRaises(LLMUnavailable):  # a long script is invalid for a short
            BrainCouncil(cfg, LLMClient(cfg, FakeSession(script=LONG_SCRIPT))).create_episode({"theme": "x"}, kind="short")
        with self.assertRaises(LLMUnavailable):  # and a short script is invalid for the long video
            BrainCouncil(cfg, LLMClient(cfg, FakeSession(script=SHORT_SCRIPT))).create_episode({"theme": "x"}, kind="long")

    def test_rejected_key_raises(self):
        cfg = cfg_with_keys()
        with self.assertRaises(LLMUnavailable):
            BrainCouncil(cfg, LLMClient(cfg, FakeSession(bad_key=True))).create_episode({"theme": "x"})

    def test_demo_plans(self):
        cfg = StudioConfig()
        self.assertEqual(len(BrainCouncil(cfg).create_episode({"theme": "x"}, demo=True, kind="short")["scenes"]), 4)
        self.assertEqual(len(BrainCouncil(cfg).create_episode({"theme": "x"}, demo=True, kind="long")["scenes"]), 8)
        with self.assertRaises(ValueError):
            normalize_plan({"scenes": [{"spoken_line": "one"}]}, cfg)

    def test_timing_windows_and_layouts(self):
        words = estimate_word_timings(" ".join(["word"] * 20), 10.0)
        self.assertAlmostEqual(words[-1]["end"], 10.0, places=3)
        plan = {"scenes": [{"spoken_line": "a b c d e"}] * 4}
        win = scene_windows(plan, words, 10.0)
        self.assertEqual(win[0][0], 0.0)
        self.assertTrue(all(a < b for a, b in win))
        self.assertIn("-->", format_srt(words))
        self.assertTrue(all(len(c) <= 4 for c in caption_chunks(words, 4)))
        self.assertEqual((LAYOUTS[KIND_LAYOUT["short"]].w, LAYOUTS[KIND_LAYOUT["short"]].h), (1080, 1920))
        self.assertEqual((LAYOUTS[KIND_LAYOUT["long"]].w, LAYOUTS[KIND_LAYOUT["long"]].h), (1920, 1080))

    def test_voice_fit_adjusts_speed(self):
        class FakeTTS(VoiceEngine):  # duration = words / (2.4 * speed)
            async def _edge(self, text, out_dir, rate):
                dur = len(text.split()) / (2.4 * (1 + V._rate_pct(rate) / 100))
                f = out_dir / "voiceover.mp3"
                f.write_bytes(b"x" * 2000)
                return self._finish(f, estimate_word_timings(text, dur), dur, out_dir)

        with tempfile.TemporaryDirectory() as td:
            r = asyncio.run(FakeTTS().synthesize_fit(" ".join(["w"] * 66), Path(td), (20, 25)))
            self.assertEqual(r["rate"], "+12%")
            r = asyncio.run(FakeTTS().synthesize_fit(" ".join(["w"] * 72), Path(td), (20, 25)))
            self.assertTrue(20 <= r["duration"] <= 25, r["duration"])
            self.assertGreater(V._rate_pct(r["rate"]), 12)

    def test_offline_voice(self):
        with tempfile.TemporaryDirectory() as td:
            res = VoiceEngine()._fake("Bhai sun na yaar kya scene hai.", Path(td))
            self.assertGreater(res["duration"], 1.0)
            self.assertTrue(Path(res["audio_path"]).exists())

    # ------------------------------------------------------------ v4 + v5: 1000 cast, formats, spice, memes, backgrounds, 4 modes
    def test_1000_character_pool_and_cast_sizes(self):
        self.assertEqual(len(CAST), 1000)
        self.assertGreater(len(search_cast(gender="F", limit=100)), 40)
        self.assertGreater(len(search_cast(gender="M", limit=100)), 40)
        self.assertEqual(len(cast_for("solo", "short")), 1)
        self.assertEqual(cast_for("solo", "short", gender_lead="F")[0].gender, "F")
        self.assertEqual(len(cast_for("dialogue", "short")), 2)
        self.assertIn(len(cast_for("dialogue", "long")), (3, 4))
        self.assertIn(len(cast_for("panel_5_6", "long")), (5, 6))
        self.assertEqual(len(cast_for("dialogue", "long", cast_size=6)), 6)
        self.assertEqual([c.id for c in cast_for("talent_roast", "long")], ["rocky", "meera", "guru", "hero"])
        self.assertEqual(build_cast("MK 3D")["hero"].name, "MK")

    def test_every_core_and_sampled_character_draws_every_expression(self):
        sample_chars = list(CORE_CAST.values()) + [CAST[k] for k in list(CAST.keys())[16:36]]
        for ch in sample_chars:
            for expr in ("shocked", "smirking", "laughing", "facepalm", "angry_roast"):
                im = draw_avatar(expr, 0.6, False, ch.look)
                self.assertEqual(im.size, (820, 900))

    def test_all_10_backgrounds_render(self):
        for bg in BACKGROUNDS:
            im = render_background(bg, 1080, 1920, 1150, (120, 330, 960, 1170), draw_ring=True, assets_dir=str(ASSETS_DIR))
            self.assertEqual(im.size, (1080, 1920))
        self.assertEqual(infer_background_from_text("Welcome to Latent talent judge buzzer", "talent_roast"), "talent_stage")
        self.assertEqual(infer_background_from_text("Hum jungle safari mein sher dekhne gaye", "dialogue"), "jungle")
        self.assertEqual(infer_background_from_text("Mummy ne bola kamra saaf kar aur fan band kar", "solo"), "home_room")

    def test_parse_dialogue_and_custom_script_mode3(self):
        tm = {"KABIR": "hero", "MUMMY": "mummy"}
        turns = parse_dialogue("KABIR: Bhai kya scene hai.\n**MUMMY**: Beta (hasti hai) suno.\nrandom stage direction\nSTRANGER: ignored", tm)
        self.assertEqual(turns, [("hero", "Bhai kya scene hai."), ("mummy", "Beta suno.")])

        cfg = StudioConfig()
        cast = cast_for("talent_roast", "short")
        custom_txt = "ROCKY: Welcome to Talent Hunt!\nKABIR: Sir mera startup idea suno.\nMEERA: Buzzer dabao yaar!\nROCKY: Bilkul khatam!"
        plan = BrainCouncil(cfg).create_episode(
            {"theme": "Custom Roast"}, kind="short", fmt="talent_roast", cast=cast, mode="custom_script_upload", custom_script=custom_txt, demo=True
        )
        self.assertEqual(plan["mode"], "custom_script_upload")
        self.assertEqual(len(plan["scenes"]), 4)
        self.assertEqual(plan["background"], "talent_stage")

    def test_youtube_clone_setup_matcher_mode4(self):
        chars, fmt, bg = match_cast_from_youtube_metadata(
            "India's Got Latent Ep 5 | Judges Roast Contestant on Stage",
            "Panel of 4 judges with buzzer roasting standup contestants",
            "Welcome to the show judges press the buzzer",
        )
        self.assertEqual(bg, "talent_stage")
        self.assertEqual(fmt, "talent_roast")
        self.assertGreaterEqual(len(chars), 4)

    def test_dialogue_council_short_and_long(self):
        pool = build_cast("Kabir 3D")
        cfg = cfg_with_keys()
        short_cast = [pool["hero"], pool["mummy"]]
        lo, hi = KIND_SPECS["short"]["words"]
        self.assertTrue(lo <= len(DIALOGUE_SHORT.replace("KABIR:", "").replace("MUMMY:", "").split()) <= hi)
        plan = BrainCouncil(cfg, LLMClient(cfg, FakeSession(script=DIALOGUE_SHORT))).create_episode({"theme": "x"}, kind="short", fmt="dialogue", cast=short_cast)
        self.assertEqual(plan["format"], "dialogue")
        self.assertEqual(len(plan["scenes"]), 6)
        self.assertEqual({s["speaker"] for s in plan["scenes"]}, {"hero", "mummy"})
        self.assertEqual([c["id"] for c in plan["cast"]], ["hero", "mummy"])

        long_cast = [pool[i] for i in ("hero", "mummy", "bunty", "uncle")]
        plan = BrainCouncil(cfg, LLMClient(cfg, FakeSession(script=DIALOGUE_LONG))).create_episode({"theme": "x"}, kind="long", fmt="dialogue", cast=long_cast)
        self.assertEqual(len(plan["scenes"]), 16)
        self.assertEqual(len({s["speaker"] for s in plan["scenes"]}), 4)

    def test_dialogue_validation_rejects_single_speaker(self):
        pool = build_cast("Kabir 3D")
        cfg = cfg_with_keys()
        mono = "\n".join(f"KABIR: {l}" for _, l in _SHORT_LINES)
        with self.assertRaises(LLMUnavailable):
            BrainCouncil(cfg, LLMClient(cfg, FakeSession(script=mono))).create_episode({"theme": "x"}, kind="short", fmt="dialogue", cast=[pool["hero"], pool["mummy"]])

    def test_spice_levels(self):
        self.assertEqual(strip_beeps("Wah BEEP yaar", "clean"), "Wah yaar yaar")
        self.assertEqual(strip_beeps("Wah BEEP yaar", "bleeped"), "Wah BEEP yaar")
        self.assertIn("BEEP", style_rules("bleeped"))
        self.assertNotIn("BEEP", style_rules("desi"))
        self.assertIn("saala", style_rules("desi"))
        self.assertNotIn("saala", style_rules("clean"))
        cfg = StudioConfig()
        cfg.content_style = "clean"
        plan = normalize_plan({"scenes": [{"spoken_line": f"Line {i} BEEP hai"} for i in range(4)]}, cfg)
        self.assertNotIn("BEEP", plan["full_voiceover_script"])

    def test_bleep_marking(self):
        words = [{"word": "Wah", "start": 0.0, "end": 0.3}, {"word": "BEEP.", "start": 0.3, "end": 0.6}]
        self.assertTrue(is_bleep("BEEP,"))
        self.assertEqual(mark_bleeps(words), [(0.3, 0.6)])
        self.assertTrue(words[1]["bleep"] and not words[0]["bleep"])

    def test_slots_and_layout_up_to_6_characters(self):
        for kind in ("short", "long"):
            L = LAYOUTS[KIND_LAYOUT[kind]]
            for n in (1, 2, 3, 4, 5, 6):
                xs = [x for x, _, _ in slots(L, n)]
                self.assertEqual(len(xs), n)
                self.assertEqual(xs, sorted(xs))

    def test_all_10_meme_cards_and_default_assets(self):
        self.assertIsNone(normalize_card({"type": "expectation_reality", "text_a": "only one side"}))
        self.assertIsNone(normalize_card({"type": "bogus", "text_a": "x"}))
        for ctype in CARD_TYPES:
            card = {"type": ctype, "text_a": "SAVAGE ROAST", "text_b": "REALITY CHECK"}
            norm = normalize_card(card)
            self.assertIsNotNone(norm, ctype)
            self.assertEqual(make_meme_card(norm, None, ASSETS_DIR, (400, 300)).size, (400, 300))
        assets = ensure_default_meme_assets(ASSETS_DIR)
        self.assertGreaterEqual(len(assets), 6)

    def test_auto_clip_highlight_selector(self):
        cfg = StudioConfig()
        plan = BrainCouncil(cfg).create_episode({"theme": "Talent Hunt"}, demo=True, kind="long", fmt="talent_roast")
        n = len(plan["scenes"])
        wins = [(i * 12.0, (i + 1) * 12.0) for i in range(n)]
        clips = select_highlight_windows(plan, wins, n * 12.0, max_clips=2)
        self.assertEqual(len(clips), 2)
        self.assertTrue(all(c["end"] > c["start"] for c in clips))

    def test_dialogue_voice_offline(self):
        class Offline(VoiceEngine):
            async def _edge_line(self, *a, **k):
                raise RuntimeError("no network in tests")

        pool = build_cast("Kabir 3D")
        chars = {"hero": pool["hero"], "mummy": pool["mummy"]}
        scenes = [{"speaker": "hero" if i % 2 == 0 else "mummy", "spoken_line": line} for i, (_, line) in enumerate(_SHORT_LINES)]
        with tempfile.TemporaryDirectory() as td:
            res = asyncio.run(Offline().synthesize_dialogue(scenes, chars, Path(td), (20, 25), demo=True))
            wins = res["scene_windows"]
            self.assertEqual(len(wins), len(scenes))
            self.assertTrue(all(a < b for a, b in wins) and all(wins[i][1] == wins[i + 1][0] for i in range(len(wins) - 1)))
            self.assertEqual(len(res["bleeps"]), 1)
            self.assertTrue(Path(res["audio_path"]).exists())


if __name__ == "__main__":
    unittest.main()
