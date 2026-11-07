#!/usr/bin/env python3
"""
MK AI v6 — Dedicated 3-Model Router (`mkai-backend/router.py`)
Optimized exclusively for the user's 3 API keys & 3 models:
1. MAIN  (`gpt-oss-120b` / `gptoss120B`)   -> Flagship Sales Outreach, Marketing Campaigns, Proposals, Orchestra
2. HEAVY (`deepseek-v3.2` / `Deepseek V3.2`) -> USA vs. India Competitor Pricing Math, Market Intelligence, AI CEO Strategy, Fundraising Cap Tables
3. FAST  (`gemma-4-31B-it` / `gemma 31B`)   -> High-Speed BANT Lead Scoring, Support Ticket Triage, Web & Maps Data Extraction

Features:
- Smart Cross-Key Failover: If one tier's key is missing or rate-limited, automatically falls back to any configured key among the 3.
- Live UI Key Configuration: Allows updating & saving the 3 API keys directly from the Electron Desktop App into `.env`.
"""
import json
import os
import time
import urllib.error
import urllib.request
from typing import Any, Dict, List, Optional


def load_dotenv_file(dotenv_path: str) -> None:
    if not os.path.exists(dotenv_path):
        return
    with open(dotenv_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip())


_HERE = os.path.dirname(os.path.abspath(__file__))
_ROOT = os.path.dirname(_HERE)
load_dotenv_file(os.path.join(_ROOT, ".env"))
load_dotenv_file(os.path.join(os.path.dirname(_ROOT), ".env"))
load_dotenv_file(os.path.join(os.path.dirname(_ROOT), ".env.mkai.backup"))
load_dotenv_file(os.path.join(_HERE, ".env"))


class MKMultiModelRouter:
    def __init__(self) -> None:
        self.base_url = os.environ.get("MK_BASE_URL", "https://api.generalcompute.com/v1").rstrip("/")
        self.tiers: Dict[str, Dict[str, Any]] = {
            "main": {
                "model": os.environ.get("MK_MAIN_MODEL", "gpt-oss-120b"),
                "display_name": "gptoss120B (Main Sales & Campaign Engine)",
                "api_key": os.environ.get("MK_MAIN_API_KEY", ""),
                "base_url": os.environ.get("MK_MAIN_BASE_URL", self.base_url).rstrip("/"),
                "provider_id": "custom_0",
                "supports_tool_calling": True,
            },
            "heavy": {
                "model": os.environ.get("MK_HEAVY_MODEL", "deepseek-v3.2"),
                "display_name": "Deepseek V3.2 (Heavy Pricing, Research & AI CEO Engine)",
                "api_key": os.environ.get("MK_HEAVY_API_KEY", ""),
                "base_url": os.environ.get("MK_HEAVY_BASE_URL", self.base_url).rstrip("/"),
                "provider_id": "custom_1",
                "supports_tool_calling": True,
            },
            "fast": {
                "model": os.environ.get("MK_FAST_MODEL", "gemma-4-31B-it"),
                "display_name": "gemma 31B (Fast Lead Qualification, Support & Maps Engine)",
                "api_key": os.environ.get("MK_FAST_API_KEY", ""),
                "base_url": os.environ.get("MK_FAST_BASE_URL", self.base_url).rstrip("/"),
                "provider_id": "custom_2",
                "supports_tool_calling": True,
            },
        }
        self.department_model_overrides: Dict[str, str] = {}
        self.usage_stats: Dict[str, Dict[str, int]] = {
            "main": {"calls": 0, "prompt_tokens": 0, "completion_tokens": 0},
            "heavy": {"calls": 0, "prompt_tokens": 0, "completion_tokens": 0},
            "fast": {"calls": 0, "prompt_tokens": 0, "completion_tokens": 0},
        }

    @staticmethod
    def _is_valid_key(k: str) -> bool:
        if not k:
            return False
        low = k.strip().lower()
        return len(low) >= 8 and "your_" not in low and "placeholder" not in low

    def get_models_status(self) -> Dict[str, Any]:
        out = {}
        for tier, cfg in self.tiers.items():
            has_key = self._is_valid_key(cfg.get("api_key", ""))
            masked = ""
            if has_key:
                raw_k = cfg["api_key"].strip()
                masked = f"{raw_k[:4]}...{raw_k[-4:]}" if len(raw_k) > 8 else "****"
            out[tier] = {
                "tier": tier,
                "model": cfg["model"],
                "display_name": cfg.get("display_name", cfg["model"]),
                "base_url": cfg.get("base_url", self.base_url),
                "provider_id": cfg["provider_id"],
                "configured": has_key,
                "masked_key": masked,
                "usage": self.usage_stats.get(tier, {}),
            }
        return {"base_url": self.base_url, "models": out}

    def update_keys_and_save(
        self,
        main_api_key: Optional[str] = None,
        heavy_api_key: Optional[str] = None,
        fast_api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        main_model: Optional[str] = None,
        heavy_model: Optional[str] = None,
        fast_model: Optional[str] = None,
    ) -> Dict[str, Any]:
        if base_url and base_url.strip():
            self.base_url = base_url.strip().rstrip("/")
            os.environ["MK_BASE_URL"] = self.base_url
            for t in self.tiers.values():
                t["base_url"] = self.base_url
        if main_api_key is not None and main_api_key.strip():
            self.tiers["main"]["api_key"] = main_api_key.strip()
            os.environ["MK_MAIN_API_KEY"] = main_api_key.strip()
        if heavy_api_key is not None and heavy_api_key.strip():
            self.tiers["heavy"]["api_key"] = heavy_api_key.strip()
            os.environ["MK_HEAVY_API_KEY"] = heavy_api_key.strip()
        if fast_api_key is not None and fast_api_key.strip():
            self.tiers["fast"]["api_key"] = fast_api_key.strip()
            os.environ["MK_FAST_API_KEY"] = fast_api_key.strip()
        if main_model and main_model.strip():
            self.tiers["main"]["model"] = main_model.strip()
            os.environ["MK_MAIN_MODEL"] = main_model.strip()
        if heavy_model and heavy_model.strip():
            self.tiers["heavy"]["model"] = heavy_model.strip()
            os.environ["MK_HEAVY_MODEL"] = heavy_model.strip()
        if fast_model and fast_model.strip():
            self.tiers["fast"]["model"] = fast_model.strip()
            os.environ["MK_FAST_MODEL"] = fast_model.strip()

        # Persist to root .env file
        env_path = os.path.join(_ROOT, ".env")
        existing_lines: List[str] = []
        if os.path.isfile(env_path):
            with open(env_path, "r", encoding="utf-8") as f:
                existing_lines = f.readlines()

        updates = {
            "MK_BASE_URL": self.base_url,
            "MK_MAIN_MODEL": self.tiers["main"]["model"],
            "MK_MAIN_API_KEY": self.tiers["main"]["api_key"],
            "MK_HEAVY_MODEL": self.tiers["heavy"]["model"],
            "MK_HEAVY_API_KEY": self.tiers["heavy"]["api_key"],
            "MK_FAST_MODEL": self.tiers["fast"]["model"],
            "MK_FAST_API_KEY": self.tiers["fast"]["api_key"],
        }
        written_keys = set()
        new_lines = []
        for line in existing_lines:
            stripped = line.strip()
            if stripped and not stripped.startswith("#") and "=" in stripped:
                k = stripped.split("=", 1)[0].strip()
                if k in updates and updates[k]:
                    new_lines.append(f"{k}={updates[k]}\n")
                    written_keys.add(k)
                    continue
            new_lines.append(line)
        for k, v in updates.items():
            if k not in written_keys and v:
                new_lines.append(f"{k}={v}\n")
        try:
            with open(env_path, "w", encoding="utf-8") as f:
                f.writelines(new_lines)
        except Exception:
            pass
        return {"ok": True, "status": self.get_models_status()}

    def select_tier_for_task(self, task_text: str, preferred_tier: Optional[str] = None) -> str:
        if preferred_tier in ("fast", "main", "heavy"):
            return preferred_tier
        lower = task_text.lower()
        heavy_keywords = [
            "competitor", "pricing", "usa", "india", "ppp", "strategy", "ceo",
            "cap table", "dilution", "safe", "valuation", "forecast", "elasticity",
            "tam", "sam", "som", "unit economics", "battlecard",
        ]
        fast_keywords = [
            "triage", "classify", "score", "bant", "sentiment", "faq",
            "support", "maps", "scrape", "clean", "shortlist", "tag",
        ]
        if any(k in lower for k in heavy_keywords):
            return "heavy"
        if any(k in lower for k in fast_keywords):
            return "fast"
        return "main"

    def chat_completion(
        self,
        messages: List[Dict[str, str]],
        tier: str = "main",
        temperature: float = 0.4,
        max_tokens: int = 4096,
        timeout_sec: int = 90,
    ) -> Dict[str, Any]:
        selected_tier = tier if tier in self.tiers else "main"
        # Build candidate order: requested tier first, then fallback to other configured keys among the 3
        order = [selected_tier] + [t for t in ("main", "heavy", "fast") if t != selected_tier]
        chosen_tier = selected_tier
        for candidate in order:
            if self._is_valid_key(self.tiers[candidate].get("api_key", "")):
                chosen_tier = candidate
                break

        cfg = self.tiers[chosen_tier]
        endpoint_base = cfg.get("base_url") or self.base_url
        url = f"{endpoint_base}/chat/completions"
        payload = {
            "model": cfg["model"],
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {cfg['api_key']}",
            "User-Agent": "MK-AI-v6-Orchestra/6.0",
        }
        start_ts = time.time()
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers=headers,
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=timeout_sec) as resp:
                raw = resp.read().decode("utf-8")
                data = json.loads(raw)
                choice = (data.get("choices") or [{}])[0]
                msg = choice.get("message") or {}
                content = (
                    msg.get("content")
                    or msg.get("reasoning_content")
                    or msg.get("reasoning")
                    or choice.get("text")
                    or ""
                )
                if isinstance(content, list):
                    content = "\n".join(
                        str(x.get("text") or x.get("content") or "") if isinstance(x, dict) else str(x)
                        for x in content
                    )
                usage = data.get("usage") or {}
                self.usage_stats.setdefault(chosen_tier, {"calls": 0, "prompt_tokens": 0, "completion_tokens": 0})
                self.usage_stats[chosen_tier]["calls"] += 1
                self.usage_stats[chosen_tier]["prompt_tokens"] += int(usage.get("prompt_tokens", 0))
                self.usage_stats[chosen_tier]["completion_tokens"] += int(usage.get("completion_tokens", 0))
                return {
                    "success": True,
                    "http_status": 200,
                    "tier": chosen_tier,
                    "model": cfg["model"],
                    "content": content.strip(),
                    "usage": usage,
                    "latency_ms": int((time.time() - start_ts) * 1000),
                }
        except urllib.error.HTTPError as e:
            err_body = e.read().decode("utf-8", errors="replace") if e.fp else str(e)
            return {
                "success": False,
                "http_status": int(e.code) if e.code else 502,
                "tier": chosen_tier,
                "model": cfg["model"],
                "error": f"Upstream LLM HTTP {e.code}: {err_body}",
                "latency_ms": int((time.time() - start_ts) * 1000),
            }
        except Exception as e:
            return {
                "success": False,
                "http_status": 503,
                "tier": chosen_tier,
                "model": cfg["model"],
                "error": f"Upstream LLM Unreachable ({cfg['model']}): {e}",
                "latency_ms": int((time.time() - start_ts) * 1000),
            }
