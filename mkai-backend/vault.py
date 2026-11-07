#!/usr/bin/env python3
"""
MK AI — Secrets & Credential Vault (Phase 1.6)
Ensures API keys, OAuth tokens, and webhook secrets are loaded exclusively from environment
variables or an encrypted vault store, never exposed in LLM prompts, tool responses, or logs.
"""
import base64
import hashlib
import hmac
import json
import os
from typing import Dict, List, Optional

_HERE = os.path.dirname(os.path.abspath(__file__))


class MKSecretsVault:
    """
    Centralized Secrets Vault with handle-based injection.
    Agents reference secret handles (e.g. `vault://MK_MAIN_API_KEY`) and the vault injects
    authentication headers at the HTTP boundary without ever exposing raw tokens to the LLM.
    """

    def __init__(self, env_path: Optional[str] = None) -> None:
        self.env_path = env_path or os.path.join(_HERE, ".env")
        self._secrets: Dict[str, str] = {}
        self._master_key = os.environ.get("MK_VAULT_MASTER_KEY", "mkai-local-vault-key-2026").encode("utf-8")
        self._load_env_file()

    def _load_env_file(self) -> None:
        if os.path.exists(self.env_path):
            with open(self.env_path, "r", encoding="utf-8") as f:
                for raw in f:
                    line = raw.strip()
                    if not line or line.startswith("#") or "=" not in line:
                        continue
                    k, v = line.split("=", 1)
                    k = k.strip()
                    v = v.strip().strip('"').strip("'")
                    self._secrets[k] = v
                    if k not in os.environ:
                        os.environ[k] = v

    def get_secret(self, key_name: str, default: str = "") -> str:
        """Internal runtime lookup (for HTTP connector layer only, never returned to LLM prompts)."""
        return os.environ.get(key_name) or self._secrets.get(key_name, default)

    def get_masked_handle(self, key_name: str) -> str:
        """Returns a safe opaque handle and masked fingerprint for UI/logs."""
        raw = self.get_secret(key_name)
        if not raw:
            return f"vault://{key_name}[UNSET]"
        digest = hmac.new(self._master_key, raw.encode("utf-8"), hashlib.sha256).hexdigest()[:8]
        return f"vault://{key_name}[sha256:{digest}]"

    def inject_auth_headers(self, key_name: str, header_name: str = "Authorization", prefix: str = "Bearer ") -> Dict[str, str]:
        """Injects secret directly into outgoing connector HTTP headers at the boundary."""
        raw = self.get_secret(key_name)
        if not raw:
            return {}
        return {header_name: f"{prefix}{raw}" if prefix else raw}

    def list_configured_handles(self) -> List[Dict[str, str]]:
        keys = sorted(set(list(self._secrets.keys()) + [k for k in os.environ if k.startswith("MK_")]))
        return [
            {
                "key": k,
                "handle": self.get_masked_handle(k),
                "configured": bool(self.get_secret(k)),
            }
            for k in keys
        ]

    def encrypt_value(self, plaintext: str) -> str:
        """XOR-HMAC stream encryption for local vault persistence."""
        raw = plaintext.encode("utf-8")
        key_stream = hashlib.pbkdf2_hmac("sha256", self._master_key, b"mkai-vault-salt", 10000, dklen=max(len(raw), 32))
        cipher = bytes(b ^ key_stream[i % len(key_stream)] for i, b in enumerate(raw))
        mac = hmac.new(self._master_key, cipher, hashlib.sha256).hexdigest()[:16]
        return f"encv1:{mac}:{base64.b64encode(cipher).decode('ascii')}"

    def decrypt_value(self, token: str) -> str:
        if not token.startswith("encv1:"):
            return token
        _, mac, b64 = token.split(":", 2)
        cipher = base64.b64decode(b64.encode("ascii"))
        expected_mac = hmac.new(self._master_key, cipher, hashlib.sha256).hexdigest()[:16]
        if not hmac.compare_digest(mac, expected_mac):
            raise ValueError("Vault integrity check failed: invalid MAC")
        key_stream = hashlib.pbkdf2_hmac("sha256", self._master_key, b"mkai-vault-salt", 10000, dklen=max(len(cipher), 32))
        plain = bytes(b ^ key_stream[i % len(key_stream)] for i, b in enumerate(cipher))
        return plain.decode("utf-8")
