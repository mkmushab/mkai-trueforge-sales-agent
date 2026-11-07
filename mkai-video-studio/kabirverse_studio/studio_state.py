"""Tiny JSON state: which daily slots already ran + recent topics/titles (no repeats)."""
from __future__ import annotations

import datetime as dt
import json
import os
import tempfile
from pathlib import Path
from typing import Any, Dict, List

from config import STATE_DIR


class StudioState:
    def __init__(self, path: Path = STATE_DIR / "state.json"):
        self.path = path
        self.data: Dict[str, Any] = {"done": {}, "history": []}
        if path.exists():
            try:
                self.data.update(json.loads(path.read_text(encoding="utf-8")))
            except (json.JSONDecodeError, OSError):
                pass

    def _save(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        fd, tmp = tempfile.mkstemp(dir=str(self.path.parent), suffix=".tmp")
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            json.dump(self.data, fh, ensure_ascii=False, indent=2)
        os.replace(tmp, self.path)

    # ---- slots
    def slot_done(self, day: str, slot: str) -> bool:
        return slot in self.data["done"].get(day, [])

    def mark_slot_done(self, day: str, slot: str) -> None:
        self.data["done"].setdefault(day, []).append(slot)
        keep = sorted(self.data["done"])[-7:]
        self.data["done"] = {d: self.data["done"][d] for d in keep}
        self._save()

    # ---- history
    def add_history(self, topic: str, title: str, video_id: str = "") -> None:
        self.data["history"].append(
            {"at": dt.datetime.now().isoformat(timespec="seconds"), "topic": topic, "title": title, "video_id": video_id}
        )
        self.data["history"] = self.data["history"][-200:]
        self._save()

    def recent(self, key: str, n: int = 30) -> List[str]:
        return [h.get(key, "") for h in self.data["history"][-n:] if h.get(key)]
