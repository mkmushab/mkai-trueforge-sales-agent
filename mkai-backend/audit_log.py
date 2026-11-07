import contextlib
#!/usr/bin/env python3
"""
MK AI — Tamper-Evident Hash-Chained Audit Log (Phase 1.5)
Every action across all 30 department agents and 201 sub-agents is recorded in an append-only
SQLite table (`audit_events`) where each row's `entry_hash` is:
    SHA256(prev_hash || seq || timestamp || agent_id || subagent_code || tool_name || action || redacted_params || tier || decision || result_hash)
Any modification or deletion of a historical row breaks the cryptographic hash chain and is
immediately caught by `verify_chain()`.
"""
import hashlib
import json
import os
import re
import sqlite3
import time
from typing import Any, Dict, List, Optional, Tuple

_HERE = os.path.dirname(os.path.abspath(__file__))

SECRET_REDACT_PATTERNS = [
    re.compile(r"\bgc_[A-Za-z0-9_-]{12,}\b"),
    re.compile(r"\bsk-[A-Za-z0-9_-]{16,}\b"),
    re.compile(r"\bghp_[A-Za-z0-9]{20,}\b"),
    re.compile(r"\bAIza[0-9A-Za-z_-]{25,}\b"),
    re.compile(r"\b[A-Z]{5}[0-9]{4}[A-Z]\b"),  # India PAN Card PII
    re.compile(r"\b\d{4}[\s-]\d{4}[\s-]\d{4}\b"),  # 12-digit Aadhaar PII
    re.compile(r"(?i)(api[_-]?key|secret|password|token|authorization)\s*[:=]\s*['\"]?([A-Za-z0-9_.\-~+/=]{8,})['\"]?"),
]


def redact_secrets(value: Any) -> Any:
    """Recursively redacts API keys, tokens, and secrets before writing to audit log."""
    if isinstance(value, str):
        out = value
        for pat in SECRET_REDACT_PATTERNS[:-1]:
            out = pat.sub("[REDACTED_SECRET]", out)
        out = SECRET_REDACT_PATTERNS[-1].sub(r"\1=[REDACTED_SECRET]", out)
        return out
    if isinstance(value, dict):
        redacted: Dict[str, Any] = {}
        for k, v in value.items():
            if any(s in str(k).lower() for s in ("secret", "password", "api_key", "apikey", "authorization", "private_key")):
                redacted[k] = "[REDACTED_SECRET]"
            else:
                redacted[k] = redact_secrets(v)
        return redacted
    if isinstance(value, list):
        return [redact_secrets(item) for item in value]
    return value


class MKAuditLogger:
    """Append-only SHA-256 hash-chained SQLite audit logger."""

    GENESIS_HASH = "0" * 64

    def __init__(self, db_path: Optional[str] = None) -> None:
        data_dir = os.path.join(_HERE, "data")
        os.makedirs(data_dir, exist_ok=True)
        self.db_path = db_path or os.environ.get("MK_AUDIT_DB_PATH", os.path.join(data_dir, "mkai_audit.db"))
        self._init_db()

    @contextlib.contextmanager
    def _connect(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
            conn.commit()
        finally:
            conn.close()

    def _init_db(self) -> None:
        with self._connect() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS audit_events (
                    seq INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp INTEGER NOT NULL,
                    agent_id TEXT NOT NULL,
                    subagent_code TEXT NOT NULL,
                    tool_name TEXT NOT NULL,
                    action TEXT NOT NULL,
                    params_json TEXT NOT NULL,
                    risk_tier TEXT NOT NULL,
                    decision TEXT NOT NULL,
                    approver TEXT NOT NULL,
                    result_hash TEXT NOT NULL,
                    prev_hash TEXT NOT NULL,
                    entry_hash TEXT NOT NULL
                )
                """
            )
            conn.commit()

    @staticmethod
    def _compute_entry_hash(
        prev_hash: str,
        seq: int,
        timestamp: int,
        agent_id: str,
        subagent_code: str,
        tool_name: str,
        action: str,
        params_json: str,
        risk_tier: str,
        decision: str,
        approver: str,
        result_hash: str,
    ) -> str:
        canonical = "|".join([
            prev_hash,
            str(seq),
            str(timestamp),
            agent_id,
            subagent_code,
            tool_name,
            action,
            params_json,
            risk_tier,
            decision,
            approver,
            result_hash,
        ])
        return hashlib.sha256(canonical.encode("utf-8")).hexdigest()

    def log_event(
        self,
        agent_id: str,
        subagent_code: str,
        tool_name: str,
        action: str,
        params: Any,
        risk_tier: str,
        decision: str,
        approver: str = "system_auto",
        result_data: Any = None,
    ) -> Dict[str, Any]:
        safe_params = redact_secrets(params if params is not None else {})
        params_json = json.dumps(safe_params, sort_keys=True, ensure_ascii=False)
        safe_result = redact_secrets(result_data if result_data is not None else "")
        result_hash = hashlib.sha256(json.dumps(safe_result, sort_keys=True, ensure_ascii=False).encode("utf-8")).hexdigest()
        ts = int(time.time())

        with self._connect() as conn:
            last_row = conn.execute("SELECT seq, entry_hash FROM audit_events ORDER BY seq DESC LIMIT 1").fetchone()
            prev_hash = last_row["entry_hash"] if last_row else self.GENESIS_HASH
            next_seq = (last_row["seq"] + 1) if last_row else 1

            entry_hash = self._compute_entry_hash(
                prev_hash=prev_hash,
                seq=next_seq,
                timestamp=ts,
                agent_id=agent_id,
                subagent_code=subagent_code,
                tool_name=tool_name,
                action=action,
                params_json=params_json,
                risk_tier=risk_tier,
                decision=decision,
                approver=approver,
                result_hash=result_hash,
            )

            conn.execute(
                """
                INSERT INTO audit_events (
                    seq, timestamp, agent_id, subagent_code, tool_name, action,
                    params_json, risk_tier, decision, approver, result_hash, prev_hash, entry_hash
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    next_seq,
                    ts,
                    agent_id,
                    subagent_code,
                    tool_name,
                    action,
                    params_json,
                    risk_tier,
                    decision,
                    approver,
                    result_hash,
                    prev_hash,
                    entry_hash,
                ),
            )
            conn.commit()

        return {
            "seq": next_seq,
            "timestamp": ts,
            "agent_id": agent_id,
            "subagent_code": subagent_code,
            "tool_name": tool_name,
            "action": action,
            "risk_tier": risk_tier,
            "decision": decision,
            "approver": approver,
            "prev_hash": prev_hash,
            "entry_hash": entry_hash,
        }

    def verify_chain(self) -> Tuple[bool, str, int]:
        """
        Verifies the entire cryptographic SHA-256 hash chain from genesis.
        Returns (is_valid, message, total_checked_rows).
        """
        with self._connect() as conn:
            rows = conn.execute("SELECT * FROM audit_events ORDER BY seq ASC").fetchall()

        expected_prev = self.GENESIS_HASH
        expected_seq = 1
        for r in rows:
            if r["seq"] != expected_seq:
                return False, f"Sequence gap detected at seq={r['seq']} (expected {expected_seq})", expected_seq - 1
            if r["prev_hash"] != expected_prev:
                return False, f"Broken prev_hash link at seq={r['seq']}", r["seq"]
            recomputed = self._compute_entry_hash(
                prev_hash=r["prev_hash"],
                seq=r["seq"],
                timestamp=r["timestamp"],
                agent_id=r["agent_id"],
                subagent_code=r["subagent_code"],
                tool_name=r["tool_name"],
                action=r["action"],
                params_json=r["params_json"],
                risk_tier=r["risk_tier"],
                decision=r["decision"],
                approver=r["approver"],
                result_hash=r["result_hash"],
            )
            if recomputed != r["entry_hash"]:
                return False, f"Hash tamper detected at seq={r['seq']}: expected {recomputed}, found {r['entry_hash']}", r["seq"]
            expected_prev = r["entry_hash"]
            expected_seq += 1

        return True, f"Audit chain verified ({len(rows)} entries intact)", len(rows)

    def list_recent(self, limit: int = 50) -> List[Dict[str, Any]]:
        with self._connect() as conn:
            rows = conn.execute("SELECT * FROM audit_events ORDER BY seq DESC LIMIT ?", (limit,)).fetchall()
            return [dict(r) for r in rows]
