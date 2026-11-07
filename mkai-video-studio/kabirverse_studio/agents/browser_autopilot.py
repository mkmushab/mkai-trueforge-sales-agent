"""
Chrome autopilot (Playwright over CDP, port 9222) for YouTube Studio + Instagram Web.

SAFE BY DEFAULT: with AUTO_PUBLISH_* = false the agent attaches the video, fills title /
description / caption and leaves the tab open so you press Publish yourself.

Shorts go to YouTube + Instagram Reels; the daily long video goes to YouTube only (with its thumbnail).

Selectors for YouTube Studio / Instagram change without notice. Every step is wrapped and
logged; a failed step never crashes the studio - the video is still saved in outputs/ together
with post_info.txt so you can post manually.
"""
from __future__ import annotations

import logging
import re
import sys
from pathlib import Path
from typing import Any, Dict, List

from config import StudioConfig

log = logging.getLogger("studio.upload")
MOD = "Meta" if sys.platform == "darwin" else "Control"


async def _click_any(locators: List[Any], timeout: int = 8000) -> None:
    last: Exception | None = None
    for loc in locators:
        try:
            await loc.first.click(timeout=timeout)
            return
        except Exception as exc:
            last = exc
    raise RuntimeError(f"none of {len(locators)} locators clickable ({str(last)[:90]})")


_POPUP_BUTTONS = ("Got it", "No thanks", "Not now", "Dismiss", "Maybe later", "Skip", "Close", "Allow all cookies", "Decline optional cookies", "Accept all", "Reject all")


async def _dismiss_popups(page) -> None:
    """Best-effort: close welcome / cookie / 'turn on notifications' dialogs that block clicks."""
    for name in _POPUP_BUTTONS:
        try:
            loc = page.get_by_role("button", name=re.compile(rf"^{re.escape(name)}$", re.I))
            if await loc.count():
                await loc.first.click(timeout=1500)
                await page.wait_for_timeout(500)
        except Exception:
            pass


async def _type_into(page, locator, text: str) -> None:
    await locator.click(timeout=15000)
    await page.keyboard.press(f"{MOD}+A")
    await page.keyboard.press("Backspace")
    await page.keyboard.insert_text(text)  # insert_text handles Hinglish/emoji reliably


class ChromeAutopilot:
    def __init__(self, cfg: StudioConfig):
        self.cfg = cfg

    async def upload(self, video: Path, plan: Dict[str, Any], ep_dir: Path, youtube: bool = True, instagram: bool = True, kind: str = "short") -> Dict[str, str]:
        from playwright.async_api import async_playwright

        results: Dict[str, str] = {}
        async with async_playwright() as pw:
            browser = await pw.chromium.connect_over_cdp(self.cfg.chrome_cdp_url)
            ctx = browser.contexts[0] if browser.contexts else await browser.new_context()
            for name, enabled, fn in (("youtube", youtube, self._youtube), ("instagram", instagram, self._instagram)):
                if not enabled:
                    continue
                page = await ctx.new_page()
                try:
                    results[name] = await fn(page, video, plan, ep_dir, kind)
                except Exception as exc:
                    results[name] = f"error: {str(exc)[:160]}"
                    try:
                        where = f"{page.url} ({await page.title()})"
                    except Exception:
                        where = "?"
                    log.error("%s upload step failed at %s: %s", name, where, exc)
                    try:
                        await page.screenshot(path=str(ep_dir / f"{name}_error.png"))
                    except Exception:
                        pass
                log.info("%s -> %s", name, results[name])
        return results

    # ------------------------------------------------------------ YouTube
    async def _youtube(self, page, video: Path, plan: Dict[str, Any], ep_dir: Path, kind: str = "short") -> str:
        cfg = self.cfg
        # 1) youtube.com/upload redirects straight to the Studio upload dialog (no fragile 'Create' button)
        await page.goto("https://www.youtube.com/upload", wait_until="domcontentloaded")
        await page.wait_for_timeout(6000)
        if "accounts.google.com" in page.url:
            raise RuntimeError("not logged in to YouTube in the agent Chrome profile (log in once, then retry)")
        await _dismiss_popups(page)
        file_input = page.locator("input[type='file']")
        if not await file_input.count():
            # 2) fallback: open Studio and click Create -> Upload videos
            await page.goto("https://studio.youtube.com/", wait_until="domcontentloaded")
            await page.wait_for_timeout(6000)
            await _dismiss_popups(page)
            await _click_any([page.locator("#create-icon"), page.get_by_role("button", name=re.compile(r"^Create$", re.I))], 20000)
            await _click_any([page.locator("#text-item-0"), page.get_by_role("menuitem", name=re.compile(r"Upload videos?", re.I))], 10000)
            await file_input.first.wait_for(state="attached", timeout=20000)
        await file_input.first.set_input_files(str(video.resolve()), timeout=120000)

        title_box = page.locator("#title-textarea #textbox").first
        await title_box.wait_for(timeout=90000)
        await _type_into(page, title_box, plan["video_title"][:100])
        await _type_into(page, page.locator("#description-textarea #textbox").first, plan["youtube_description"][:4900])

        if kind == "long":  # custom thumbnail (needs a phone-verified channel; skipped silently otherwise)
            thumb = ep_dir / "thumbnail.jpg"
            if thumb.exists():
                try:
                    await page.locator("ytcp-thumbnails-compact-editor-uploader input[type='file'], input#file-loader").first.set_input_files(str(thumb), timeout=8000)
                except Exception:
                    log.info("thumbnail upload skipped (channel not verified or UI changed) - set it manually from thumbnail.jpg")

        try:
            await page.locator("[name='VIDEO_MADE_FOR_KIDS_NOT_MFK']").first.click(timeout=6000)
        except Exception:
            log.warning("could not tick 'not made for kids' - check manually")
        if cfg.youtube_disclose_ai:
            try:
                await page.locator("[name='VIDEO_HAS_ALTERED_CONTENT_YES']").first.click(timeout=4000)
            except Exception:
                log.info("AI-disclosure radio not found (YouTube UI may differ) - check manually")
        await page.screenshot(path=str(ep_dir / "youtube_staged.png"))

        if not cfg.publish_youtube:
            return "staged - review the open YouTube Studio tab and press Publish"

        for _ in range(3):
            await page.locator("#next-button").first.click(timeout=20000)
            await page.wait_for_timeout(1800)
        vis = cfg.youtube_visibility if cfg.youtube_visibility in {"PUBLIC", "UNLISTED", "PRIVATE"} else "PUBLIC"
        await page.locator(f"[name='{vis}']").first.click(timeout=15000)
        done = page.locator("#done-button").first
        for _ in range(150 if kind == "long" else 90):  # wait for upload/processing to allow publishing
            if await done.is_enabled():
                break
            await page.wait_for_timeout(2000)
        await done.click(timeout=10000)
        await page.wait_for_timeout(6000)
        await page.screenshot(path=str(ep_dir / "youtube_result.png"))
        await page.close()
        return f"published ({vis.lower()})"

    # ---------------------------------------------------------- Instagram
    async def _instagram(self, page, video: Path, plan: Dict[str, Any], ep_dir: Path, kind: str = "short") -> str:
        cfg = self.cfg
        await page.goto("https://www.instagram.com/", wait_until="domcontentloaded")
        await page.wait_for_timeout(6000)
        await _dismiss_popups(page)
        if (
            "accounts/login" in page.url
            or await page.locator("input[name='username']").count()
            or await page.get_by_role("button", name=re.compile(r"^Log in$", re.I)).count()
        ):
            raise RuntimeError("not logged in to Instagram in the agent Chrome profile (log in once in that window)")

        await _click_any(
            [
                page.get_by_role("link", name=re.compile(r"^(New post|Create)$", re.I)),
                page.locator("svg[aria-label='New post']"),
                page.get_by_text(re.compile(r"^Create$")),
            ],
            15000,
        )
        await page.wait_for_timeout(1200)
        try:  # newer UI shows a Post / Live / Ad submenu
            await _click_any([page.get_by_role("link", name=re.compile(r"^Post$")), page.get_by_text(re.compile(r"^Post$"))], 4000)
        except Exception:
            pass
        await page.wait_for_timeout(1500)
        await page.locator("input[type='file']").first.set_input_files(str(video.resolve()), timeout=60000)
        await page.wait_for_timeout(4000)
        try:  # "Video posts are now shared as reels" notice
            await _click_any([page.get_by_role("button", name=re.compile(r"^OK$", re.I))], 4000)
        except Exception:
            pass
        for _ in range(2):  # crop -> edit
            await _click_any([page.get_by_role("button", name=re.compile(r"^Next$")), page.locator("div[role='button']:text-is('Next')")], 20000)
            await page.wait_for_timeout(1800)

        caption = page.locator("div[aria-label='Write a caption...'], div[role='textbox'][contenteditable='true']").first
        await _type_into(page, caption, plan["instagram_caption"][:2100])

        if not cfg.publish_instagram:
            return "staged - review the open Instagram tab and press Share"
        await _click_any([page.get_by_role("button", name=re.compile(r"^Share$")), page.locator("div[role='button']:text-is('Share')")], 15000)
        await page.get_by_text(re.compile(r"(has been shared|Reel shared)", re.I)).first.wait_for(timeout=240000)
        await page.screenshot(path=str(ep_dir / "instagram_result.png"))
        await page.close()
        return "published"
