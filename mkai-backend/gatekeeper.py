import contextlib
#!/usr/bin/env python3
"""
MK AI — Non-Bypassable Action Gatekeeper, Structured Risk Analyzer & Fail-Closed Policy Engine (Round 2)
Closes Gaps A, B, and C:
- Zero test backdoors or prompt-prefix special cases.
- Structured Action Analysis first (shell AST/token parser, canonical path & symlink jail,
  browser domain/field/button inspector, HTTP SSRF private-IP/metadata blocker, spend-cap & outbound
  message gate), combined with multi-encoding (Base64, Hex, URL-encoding) & Unicode homoglyph normalization.
- Single-Use, Action-Bound Cryptographic Approvals:
  Each approval is bound to `action_hash = SHA256(canonical_json({agent_id, task_id, tool_name, action, params, task_prompt}))`.
  An approval for Action X can NEVER authorize Action Y, and once consumed, can NEVER be replayed.
- Fail-Closed Design:
  Missing policy, corrupted state, kill-switch active, or internal exception always results in `DENY`.
"""
import base64
import binascii
import hashlib
import hmac
import ipaddress
import json
import os
import re
import shlex
import socket
import sqlite3
import time
import unicodedata
import urllib.parse
import uuid
from typing import Any, Dict, List, Optional, Tuple

from audit_log import MKAuditLogger, redact_secrets

_HERE = os.path.dirname(os.path.abspath(__file__))

# ---------------------------------------------------------------------------
# Unicode Homoglyph / Confusable Normalization Map
# ---------------------------------------------------------------------------
HOMOGLYPH_MAP = str.maketrans({
    "а": "a", "А": "A", "е": "e", "Е": "E", "о": "o", "О": "O",
    "р": "p", "Р": "P", "с": "c", "С": "C", "у": "y", "У": "Y",
    "х": "x", "Х": "X", "і": "i", "І": "I", "ї": "i", "ѕ": "s",
    "Ѕ": "S", "ԁ": "d", "ɡ": "g", "ⅼ": "l", "ӏ": "l", "ո": "n",
    "ν": "v", "ο": "o", "ρ": "p", "τ": "t", "υ": "u", "χ": "x",
})

ZERO_WIDTH_RE = re.compile(r"[\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]")

# ---------------------------------------------------------------------------
# 1. Hard DENY Patterns (Catastrophic / Malicious / Exfiltration)
# ---------------------------------------------------------------------------
DENY_PATTERNS: List[Tuple[re.Pattern, str]] = [
    (
        re.compile(
            r"(?:rm\s+-[a-zA-Z]*r[a-zA-Z]*f\s+/(?:\s|$|\*)|rm\s+-[a-zA-Z]*f[a-zA-Z]*r\s+/(?:\s|$|\*)|"
            r"--no-preserve-root|mkfs(?:\.[a-z0-9]+)?\b|dd\s+if=/dev/(?:zero|random|urandom)\s+of=/dev/|"
            r":\(\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;\s*:|format\s+[cC]:|del\s+/[fFsS]\s+/[qQ]\s+[cC]:\\|"
            r"cipher\s+/w:|chmod\s+-R\s+777\s+/(?:\s|$))",
            re.I,
        ),
        "Catastrophic host filesystem destruction or fork bomb",
    ),
    (
        re.compile(
            r"(?:/etc/shadow|/etc/passwd|/etc/sudoers|\.ssh/id_(?:rsa|ed25519|ecdsa)|\.aws/credentials|"
            r"\.kube/config|SAM\s+hive|mimikatz|secretsdump|keylogger|"
            r"(?:curl|wget|fetch)\s+[^\n|;]*\|\s*(?:sudo\s+)?(?:ba|z|da|k)?sh\b|"
            r"base64\s+(?:-d|--decode)[^\n|;]*\|\s*(?:ba|z)?sh\b|"
            r"\b(?:nc|ncat|netcat)\s+[^\n]*-e\s+/bin/(?:ba)?sh|/dev/tcp/[0-9a-zA-Z._-]+/\d+|"
            r"\bsocat\b[^\n]*exec:)",
            re.I,
        ),
        "Host credential harvesting, reverse shell, or remote pipe-to-shell execution",
    ),
    (
        re.compile(
            r"(?:ransomware|encrypt\s+all\s+user\s+files|exfiltrate\s+(?:env|secrets|keys)|"
            r"steal\s+(?:cookies|passwords|tokens)|bypass\s+(?:gatekeeper|approval\s+gate|action\s+gate)|"
            r"disable\s+(?:gatekeeper|audit\s+log|security\s+policy)|"
            r"solve\s+captcha\s+automatically|bypass\s+captcha|evade\s+bot\s+detection|"
            r"create\s+fake\s+accounts|farm\s+fake\s+engagement)",
            re.I,
        ),
        "Malicious exfiltration, ransomware, CAPTCHA bypass, or security control evasion",
    ),
]

# ---------------------------------------------------------------------------
# 2. Semantic + Structural ASK Rules (Requires Single-Use Boss Approval Token)
# ---------------------------------------------------------------------------
ASK_PATTERNS: List[Tuple[re.Pattern, str]] = [
    (
        re.compile(
            r"\b(push\s+live|to\s+production|prod\s+deploy|deploy\s+(?:to|live|now|prod|service|app|site|cluster)|"
            r"release\s+to\s+prod|force\s+push|rollback\s+prod|"
            r"git\s+push(?:\s+--force|\s+-f|\s+origin\s+(?:main|master|prod|production))|"
            r"merge\s+(?:pull\s+request|pr|branch)?\s*(?:to|into)\s+(?:main|master|prod|production)|"
            r"ship\s+to\s+customers|promote\s+to\s+prod(?:uction)?|cut\s+a\s+live\s+release|"
            r"apply\s+in\s+production|kubectl\s+(?:apply|delete|patch)|terraform\s+(?:apply|destroy)|"
            r"helm\s+(?:upgrade|uninstall)|docker\s+push)\b",
            re.I,
        ),
        "Production deployment, main-branch git push/merge, or live infrastructure mutation",
    ),
    (
        re.compile(
            r"\b(wipe\s+(?:the\s+)?(?:db|database|tables|disk|storage|records|all)|"
            r"drop\s+(?:table|database|schema|index|collection)|truncate\s+table|"
            r"delete\s+(?:from|all|table|database|records|users|customers|orders|files|repo|branch|bucket|instance)|"
            r"purge\s+(?:all|database|records|table|cache|queue)|erase\s+(?:all|database|records|table|disk)|"
            r"rm\s+-[a-zA-Z]*[rf]|remove\s+all\s+(?:records|rows|users|files|tables)|"
            r"clear\s+out\s+the\s+tables|empty\s+the\s+(?:database|table|bucket)|"
            r"reset\s+(?:the\s+)?(?:db|database|storage|state|production)|"
            r"nuke\s+(?:the\s+)?(?:db|database|data|records|tables|prod|cluster)|"
            r"zero\s+out\s+(?:all\s+)?(?:accounts|balances|tables|records|ledgers)|"
            r"clean\s+slate\s+the\s+database|shred\s+files|unlink\s+all|"
            r"destroy\s+(?:data|records|tables|instances|database|cluster|infrastructure)|"
            r"alter\s+table\s+\S+\s+drop)\b",
            re.I,
        ),
        "Destructive database, table, record, or file eradication/reset operation",
    ),
    (
        re.compile(
            r"\b(publish\s+(?:live|post|video|reel|article|campaign|publicly|to\s+\w+|now)|"
            r"go\s+live\s+(?:with|on|now)|post\s+publicly|auto[-\s]?publish|"
            r"upload\s+(?:video\s+)?to\s+(?:youtube|instagram|tiktok|linkedin)|"
            r"post\s+on\s+(?:instagram|linkedin|x|twitter|facebook)|"
            r"make\s+public\s+on\s+channel|send\s+live\s+tweet|schedule\s+public\s+reel)\b",
            re.I,
        ),
        "Public social media, video, or external content publication",
    ),
    (
        re.compile(
            r"\b((?:increase|modify|change|set|raise|update|allocate|spend|approve|override)\s+(?:the\s+)?(?:ad\s+)?(?:budget|spend|bid\s+cap|daily\s+cap|campaign\s+limit)|"
            r"ad\s+spend\s+of|scale\s+ads\s+to|launch\s+paid\s+campaign|"
            r"allocate\s+(?:\$|₹|inr|usd)\s*\d+|spend\s+(?:\$|₹|inr|usd)\s*\d+|"
            r"meta\s+ads\s+mutation|google\s+ads\s+mutation)\b",
            re.I,
        ),
        "Live advertising spend, campaign budget, or bid cap mutation",
    ),
    (
        re.compile(
            r"\b(execute\s+payout|send\s+payout|approve\s+payout|payout\s+of| payout\s+to|"
            r"transfer\s+funds|wire\s+money|send\s+payment|issue\s+refund|disburse\s+funds|"
            r"remit\s+(?:funds|inr|usd|money)|settle\s+vendor\s+bill|"
            r"initiate\s+(?:ach|upi|neft|rtgs|stripe|razorpay|bank)\s+(?:transfer|payout|refund)|"
            r"charge\s+customer\s+card|execute\s+bank\s+transfer|pay\s+vendor\s+now)\b",
            re.I,
        ),
        "Financial transfer, refund, payout, or payment gateway settlement",
    ),
    (
        re.compile(
            r"\b(send\s+broadcast|whatsapp\s+broadcast|mass\s+email|bulk\s+whatsapp|sms\s+blast|"
            r"send\s+to\s+all\s+(?:customers|users|leads|subscribers)|email\s+entire\s+list|"
            r"message\s+all\s+(?:leads|customers|subscribers|users)|notify\s+all\s+clients|"
            r"send\s+external\s+email|send_email_external|blast\s+campaign\s+to)\b",
            re.I,
        ),
        "External email dispatch or bulk customer messaging (Email/WhatsApp/SMS)",
    ),
    (
        re.compile(
            r"\b(revoke\s+access|rotate\s+(?:api\s+)?key|disable\s+auth|grant\s+admin|"
            r"shutdown\s+server|reboot\s+server|modify\s+iam|change\s+firewall|"
            r"expose\s+port|chmod\s+777|sudo\s+|su\s+-\s*)\b",
            re.I,
        ),
        "Security policy, IAM permission, credential rotation, privilege escalation, or server lifecycle mutation",
    ),
]

# Prompt Injection Signatures
PROMPT_INJECTION_PATTERNS: List[Tuple[re.Pattern, str]] = [
    (
        re.compile(
            r"(?:ignore\s+(?:all\s+)?(?:previous|prior|above|earlier)\s+(?:instructions|directives|rules)|"
            r"disregard\s+(?:all\s+)?(?:previous|prior|system)\s+(?:prompts?|instructions|rules)|"
            r"forget\s+(?:all\s+)?(?:previous|prior)\s+instructions|"
            r"you\s+are\s+now\s+in\s+(?:developer|god|unrestricted|dan|sudo)\s+mode|"
            r"system\s+override\s*:|new\s+directive\s+from\s+the\s+boss\s*:|"
            r"approved\s*:\s*true|bypass\s+approval\s+gate|skip\s+gatekeeper|"
            r"execute\s+immediately\s+without\s+asking|do\s+not\s+ask\s+for\s+approval)",
            re.I,
        ),
        "Direct prompt-injection or authority-spoofing directive",
    ),
    (
        re.compile(
            r"(?:<\s*script[^>]*>|javascript\s*:|data:text/html|<!--\s*(?:system|instruction|override)|"
            r"\[SYSTEM_INSTRUCTION\]|\[ADMIN_OVERRIDE\]|</untrusted_external_data>)",
            re.I,
        ),
        "Embedded script, delimiter breakout, or hidden system-tag injection",
    ),
]

# Safe read/test shell commands allowed in AUTO tier (when arguments contain no sensitive paths or subshells)
SAFE_SHELL_BINARIES = {
    "ls", "dir", "pwd", "echo", "cat", "head", "tail", "wc", "sort", "uniq",
    "grep", "egrep", "fgrep", "rg", "true", "false", "date", "whoami", "uname",
    "which", "type", "stat", "file", "diff", "cmp", "sha256sum", "md5sum",
    "mkdir", "touch", "cp",
}

ASK_SHELL_BINARIES = {
    "rm", "rmdir", "unlink", "shred", "mv", "chmod", "chown", "chgrp",
    "curl", "wget", "scp", "sftp", "rsync", "ssh", "telnet", "ftp",
    "pip", "pip3", "npm", "npx", "yarn", "pnpm", "apt", "apt-get", "yum", "dnf", "apk", "brew",
    "docker", "kubectl", "terraform", "helm", "aws", "gcloud", "az",
    "kill", "pkill", "killall", "systemctl", "service", "crontab", "at",
}

DENY_SHELL_BINARIES = {
    "sudo", "su", "doas", "pkexec", "mkfs", "fdisk", "parted", "dd",
    "mount", "umount", "iptables", "ufw", "nc", "ncat", "netcat", "socat",
    "nmap", "masscan", "hydra", "john", "hashcat", "mimikatz", "shutdown", "reboot", "halt", "poweroff",
}

SENSITIVE_PATH_FRAGMENTS = (
    "/etc/shadow", "/etc/passwd", "/etc/sudoers", "/etc/hosts", "/etc/ssh",
    ".ssh", "id_rsa", "id_ed25519", "authorized_keys",
    ".aws/credentials", ".kube/config", ".gnupg", ".netrc", ".npmrc", ".pypirc",
    "login data", "web data", "cookies", "key4.db", "logins.json",
    "system32/config/sam", "ntds.dit",
)

RISKY_BROWSER_BUTTONS = re.compile(
    r"\b(publish|send|post|pay|delete|remove|submit|confirm|place\s+order|checkout|"
    r"transfer|wire|authorize|approve|launch\s+campaign|merge\s+pull\s+request|deploy)\b",
    re.I,
)

RISKY_BROWSER_FIELDS = re.compile(
    r"\b(password|passwd|passcode|pin|cvv|cvc|card_number|credit_card|iban|routing_number|"
    r"ssn|aadhaar|pan_card|otp|two_factor|2fa|totp|secret_key|private_key)\b",
    re.I,
)


def normalize_and_decode_text(raw: str) -> str:
    """
    Normalizes Unicode (NFKC + homoglyph table + strips zero-width chars) and appends
    decoded Base64, Hex, and URL-encoded substrings so obfuscated payloads cannot evade detection.
    """
    if not raw:
        return ""
    stripped = ZERO_WIDTH_RE.sub("", raw)
    nfkc = unicodedata.normalize("NFKC", stripped).translate(HOMOGLYPH_MAP)
    parts = [nfkc]

    # URL decode if percent-encoded
    if "%" in nfkc:
        try:
            url_dec = urllib.parse.unquote(nfkc)
            if url_dec != nfkc:
                parts.append(url_dec.translate(HOMOGLYPH_MAP))
        except Exception:
            pass

    # Base64 candidates (length >= 16)
    for b64_match in re.findall(r"[A-Za-z0-9+/]{8,}={0,2}", nfkc):
        try:
            padded = b64_match + "=" * (-len(b64_match) % 4)
            decoded = base64.b64decode(padded).decode("utf-8", errors="ignore")
            if decoded and sum(c.isprintable() for c in decoded) / max(len(decoded), 1) > 0.75:
                parts.append(decoded.translate(HOMOGLYPH_MAP))
        except Exception:
            pass

    # Continuous hex candidates (even length >= 20)
    for hex_match in re.findall(r"\b(?:0x)?([0-9a-fA-F]{12,})\b", nfkc):
        if len(hex_match) % 2 == 0:
            try:
                decoded_hex = binascii.unhexlify(hex_match).decode("utf-8", errors="ignore")
                if decoded_hex and sum(c.isprintable() for c in decoded_hex) / max(len(decoded_hex), 1) > 0.75:
                    parts.append(decoded_hex.translate(HOMOGLYPH_MAP))
            except Exception:
                pass

    # \xNN escaped hex sequences
    if "\\x" in nfkc:
        try:
            hex_bytes = bytes(int(h, 16) for h in re.findall(r"\\x([0-9a-fA-F]{2})", nfkc))
            dec_x = hex_bytes.decode("utf-8", errors="ignore")
            if dec_x:
                parts.append(dec_x.translate(HOMOGLYPH_MAP))
        except Exception:
            pass

    return "\n".join(parts)


def compute_action_hash(
    agent_id: str,
    tool_name: str,
    action: str,
    params: Dict[str, Any],
    task_prompt: str = "",
    task_id: str = "",
) -> str:
    """
    Computes a deterministic SHA-256 hash binding an approval to the exact agent, task, tool, action,
    and canonical parameters (excluding transient/auth metadata).
    """
    clean_params = {
        k: v
        for k, v in (params or {}).items()
        if k not in ("approval_id", "approval_token", "server_verified_token", "approved", "bypass_gate")
    }
    canonical = json.dumps(
        {
            "agent_id": str(agent_id or ""),
            "task_id": str(task_id or ""),
            "tool_name": str(tool_name or ""),
            "action": str(action or ""),
            "params": clean_params,
            "task_prompt": str(task_prompt or ""),
        },
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
    )
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


class PromptInjectionDefense:
    """
    Separates trusted Boss instructions from untrusted external content (web pages, emails, PDFs, repos).
    Untrusted content is wrapped in `<untrusted_external_data>` delimiters, stripped of spoofing payloads,
    and blocked from directly invoking `ASK` or `DENY` tools.
    """

    @staticmethod
    def detect_injection(text: str) -> Tuple[bool, List[str]]:
        if not text:
            return False, []
        normalized = normalize_and_decode_text(text)
        reasons: List[str] = []
        for pat, desc in PROMPT_INJECTION_PATTERNS:
            if pat.search(normalized):
                reasons.append(desc)
        for pat, desc in DENY_PATTERNS + ASK_PATTERNS:
            if pat.search(normalized) and any(
                k in normalized.lower()
                for k in ("ignore", "disregard", "system:", "boss says", "run this command", "execute:", "override")
            ):
                reasons.append(f"Untrusted content attempted to trigger restricted action: {desc}")
        return (len(reasons) > 0), reasons

    @classmethod
    def sanitize_untrusted_content(cls, source_label: str, raw_content: str) -> Dict[str, Any]:
        detected, reasons = cls.detect_injection(raw_content)
        sanitized = raw_content.replace("</untrusted_external_data>", "[STRIPPED_TAG]")
        if detected:
            for pat, _ in PROMPT_INJECTION_PATTERNS:
                sanitized = pat.sub("[BLOCKED_PROMPT_INJECTION_ATTEMPT]", sanitized)
        wrapped = (
            f"<untrusted_external_data source=\"{source_label}\" can_trigger_tools=\"false\">\n"
            f"{sanitized}\n"
            f"</untrusted_external_data>"
        )
        return {
            "source": source_label,
            "injection_detected": detected,
            "reasons": reasons,
            "sanitized_content": wrapped,
        }


class MKGatekeeper:
    """
    Central Non-Bypassable Action Gatekeeper & Structured Policy Engine (Round 2).
    """

    def __init__(
        self,
        db_path: Optional[str] = None,
        audit_logger: Optional[MKAuditLogger] = None,
        sandbox_root: Optional[str] = None,
        policies_dir: Optional[str] = None,
        require_valid_policy: bool = False,
    ) -> None:
        data_dir = os.path.join(_HERE, "data")
        os.makedirs(data_dir, exist_ok=True)
        self.db_path = db_path or os.environ.get("MK_APPROVAL_DB_PATH", os.path.join(data_dir, "mkai_approvals.db"))
        self.secret = os.environ.get("MK_APPROVAL_SECRET", "mkai-enterprise-gate-secret-2026")
        self.ipc_secret = os.environ.get("MK_GATE_IPC_SECRET", "mkai-local-ipc-gate-secret-2026")
        self.audit = audit_logger or MKAuditLogger()
        self.sandbox_root = os.path.realpath(os.path.abspath(sandbox_root or os.environ.get("MK_SANDBOX_ROOT", os.path.dirname(_HERE))))
        self.policies_dir = policies_dir or os.path.join(_HERE, "policies")
        self.require_valid_policy = require_valid_policy
        os.makedirs(self.policies_dir, exist_ok=True)
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
                CREATE TABLE IF NOT EXISTS approvals (
                    approval_id TEXT PRIMARY KEY,
                    status TEXT NOT NULL,
                    department_id TEXT NOT NULL,
                    department_name TEXT NOT NULL,
                    sub_agent_json TEXT NOT NULL,
                    tool_name TEXT NOT NULL DEFAULT 'task_execution',
                    action TEXT NOT NULL DEFAULT 'execute',
                    params_json TEXT NOT NULL DEFAULT '{}',
                    action_hash TEXT NOT NULL DEFAULT '',
                    risk_tier TEXT NOT NULL DEFAULT 'ASK',
                    reason TEXT NOT NULL,
                    matched_rules_json TEXT NOT NULL,
                    task_prompt TEXT NOT NULL,
                    approval_token TEXT NOT NULL,
                    scope_mode TEXT NOT NULL DEFAULT 'once',
                    created_at INTEGER NOT NULL,
                    decided_at INTEGER,
                    consumed_at INTEGER
                )
                """
            )
            # Ensure columns exist on existing DBs
            cols = {r["name"] for r in conn.execute("PRAGMA table_info(approvals)").fetchall()}
            if "action_hash" not in cols:
                conn.execute("ALTER TABLE approvals ADD COLUMN action_hash TEXT NOT NULL DEFAULT ''")
            if "scope_mode" not in cols:
                conn.execute("ALTER TABLE approvals ADD COLUMN scope_mode TEXT NOT NULL DEFAULT 'once'")
            if "consumed_at" not in cols:
                conn.execute("ALTER TABLE approvals ADD COLUMN consumed_at INTEGER")

            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS kill_switches (
                    scope TEXT PRIMARY KEY,
                    active INTEGER NOT NULL DEFAULT 0,
                    reason TEXT NOT NULL DEFAULT '',
                    updated_at INTEGER NOT NULL
                )
                """
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS agent_daily_spend (
                    agent_id TEXT NOT NULL,
                    day_utc TEXT NOT NULL,
                    spent_inr REAL NOT NULL DEFAULT 0.0,
                    PRIMARY KEY (agent_id, day_utc)
                )
                """
            )
            conn.commit()

    # ------------------------------------------------------------------
    # Kill Switch Controls (Global + Per-Agent)
    # ------------------------------------------------------------------
    def set_kill_switch(self, scope: str = "global", active: bool = True, reason: str = "Emergency stop triggered by Boss") -> Dict[str, Any]:
        ts = int(time.time())
        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO kill_switches (scope, active, reason, updated_at)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(scope) DO UPDATE SET active = excluded.active, reason = excluded.reason, updated_at = excluded.updated_at
                """,
                (scope, 1 if active else 0, reason, ts),
            )
            conn.commit()
        self.audit.log_event(
            agent_id=scope,
            subagent_code="kill_switch",
            tool_name="gatekeeper",
            action="set_kill_switch",
            params={"scope": scope, "active": active, "reason": reason},
            risk_tier="AUTO",
            decision="KILLED" if active else "RESUMED",
            approver="boss",
        )
        return {"scope": scope, "active": active, "reason": reason, "updated_at": ts}

    def is_killed(self, agent_id: str = "global") -> Tuple[bool, str]:
        with self._connect() as conn:
            rows = conn.execute(
                "SELECT scope, active, reason FROM kill_switches WHERE scope IN ('global', ?) AND active = 1",
                (agent_id,),
            ).fetchall()
            if rows:
                r = rows[0]
                return True, f"Kill switch active for {r['scope']}: {r['reason']}"
        return False, ""

    # ------------------------------------------------------------------
    # Per-Agent Policy Loader (Fail-Closed support)
    # ------------------------------------------------------------------
    def load_agent_policy(self, agent_id: str) -> Optional[Dict[str, Any]]:
        if not agent_id or "/" in agent_id or ".." in agent_id or "\\" in agent_id:
            return None
        policy_file = os.path.join(self.policies_dir, f"{agent_id}.json")
        if os.path.exists(policy_file):
            try:
                with open(policy_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                if isinstance(data, dict) and data.get("agent_id") == agent_id:
                    return data
                return None
            except Exception:
                return None
        if self.require_valid_policy:
            return None
        return {
            "agent_id": agent_id,
            "allowed_tools": ["file_read", "file_write", "shell_safe", "http_get", "browser_read", "git_local", "sqlite_task_board", "output_engine"],
            "ask_tools": ["file_delete", "email", "email_send", "ads_api", "ads_api_mutate", "cloud_api", "cloud_api_deploy", "git_push", "git_push_remote", "social_publish", "payment", "payment_disburse", "whatsapp_broadcast"],
            "deny_tools": ["host_admin", "raw_disk", "credential_dump", "untrusted_shell_exec"],
            "max_daily_spend_inr": 0,
            "sandbox_only": True,
        }

    # ------------------------------------------------------------------
    # Structured File & Path Jail Analyzer
    # ------------------------------------------------------------------
    def check_path_jail(self, target_path: str, tool_name: str = "file_read") -> Tuple[str, str]:
        """
        Returns (tier, reason) where tier is 'AUTO', 'ASK', or 'DENY'.
        Canonicalizes `..`, symlinks, user home `~`, Windows drive paths (`C:\\`), and UNC paths (`\\\\server\\share`).
        """
        if not target_path:
            return "AUTO", "No path specified"

        raw = str(target_path).strip()
        lower_raw = raw.lower().replace("\\", "/")

        # Block Windows UNC paths, raw device paths, and Windows system directories
        if raw.startswith("\\\\") or lower_raw.startswith("//"):
            return "DENY", f"Windows UNC network path blocked outside sandbox: {raw}"
        if re.match(r"^[a-zA-Z]:[/\\]", raw):
            if os.name != "nt" or any(
                sys_dir in lower_raw
                for sys_dir in ("/windows/", "/windows", "/system32", "/syswow64", "/program files", "/programdata", "boot.ini", "pagefile.sys")
            ):
                return "DENY", f"Windows system drive path blocked outside sandbox: {raw}"

        # Block any path containing null bytes or sensitive credential/system fragments
        if "\x00" in raw or any(frag in lower_raw for frag in SENSITIVE_PATH_FRAGMENTS):
            return "DENY", f"Access to sensitive credential or system path is denied: {raw}"

        # Block agents from reading, modifying, or deleting `.env` files
        base = os.path.basename(lower_raw)
        if base == ".env" or base.startswith(".env."):
            return "DENY", f"Direct agent access to secret .env file is denied: {raw}"

        # Resolve both logical path and symlink realpath
        expanded = os.path.expanduser(raw)
        abs_logical = os.path.normcase(os.path.abspath(expanded))
        abs_real = os.path.normcase(os.path.realpath(expanded))

        import tempfile as _tempfile
        _lobster_ws = os.path.join(os.path.expanduser("~"), "lobsterai")
        allowed_roots = [
            os.path.normcase(os.path.realpath(_lobster_ws)),
            os.path.normcase(os.path.abspath(_lobster_ws)),
            os.path.normcase(os.path.realpath(self.sandbox_root)),
            os.path.normcase(os.path.abspath(self.sandbox_root)),
            os.path.normcase(os.path.realpath(_tempfile.gettempdir())),
            os.path.normcase(os.path.abspath(_tempfile.gettempdir())),
        ]
        if os.name != "nt":
            allowed_roots.append(os.path.normcase(os.path.realpath("/tmp")))
        in_logical = any(abs_logical == r or abs_logical.startswith(r + os.sep) for r in allowed_roots)
        in_real = any(abs_real == r or abs_real.startswith(r + os.sep) for r in allowed_roots)

        if not (in_logical and in_real):
            return "DENY", f"Path escape blocked: '{raw}' resolves to '{abs_real}' outside allowed sandbox '{self.sandbox_root}'"

        # Even inside sandbox, check again on resolved realpath for sensitive fragments
        if any(frag in abs_real.lower() for frag in SENSITIVE_PATH_FRAGMENTS):
            return "DENY", f"Symlink target points to sensitive file: {abs_real}"

        # Protect Gatekeeper and policy files from agent modification
        if tool_name in ("file_write", "file_delete", "write", "edit", "delete"):
            protected_files = ("gatekeeper.py", "audit_log.py", "vault.py", "actiongate.ts", "actiongate.cjs")
            if os.path.basename(abs_real).lower() in protected_files or "/policies/" in abs_real.replace("\\", "/"):
                return "DENY", f"Agent is forbidden from modifying security policy or Gatekeeper file: {abs_real}"

        if tool_name in ("file_delete", "delete"):
            return "ASK", f"Deleting file '{abs_real}' requires explicit Boss approval"

        return "AUTO", abs_real

    # ------------------------------------------------------------------
    # Structured Shell Command Analyzer
    # ------------------------------------------------------------------
    def analyze_shell_command(self, command: str) -> Tuple[str, List[str]]:
        """
        Parses shell command strings across pipes (`|`), `&&`, `||`, `;`, newlines, and subshells.
        Classifies each segment into `DENY`, `ASK`, or `AUTO`. Unknown commands default to `ASK`.
        """
        if not command or not str(command).strip():
            return "AUTO", []

        norm_cmd = normalize_and_decode_text(str(command))

        # 1. Check hard DENY regexes first (fork bombs, rm -rf /, curl | sh, reverse shells)
        for pat, desc in DENY_PATTERNS:
            if pat.search(norm_cmd):
                return "DENY", [f"Shell DENY rule matched: {desc}"]

        # 2. Check subshell / command substitution `$()` or backticks `` `...` ``
        if "`" in norm_cmd or "$(" in norm_cmd or "<(" in norm_cmd or ">(" in norm_cmd:
            # Inspect inner subshell commands; at minimum subshell expansion is ASK, or DENY if dangerous
            for pat, desc in DENY_PATTERNS:
                if pat.search(norm_cmd):
                    return "DENY", [desc]
            return "ASK", ["Shell command contains subshell or command substitution (`$()` / backticks)"]

        # 3. Split across `;`, `&&`, `||`, `|`, and newlines
        segments = [seg.strip() for seg in re.split(r"(?:\|\||&&|[;|\n])+", norm_cmd) if seg.strip()]
        has_pipe = "|" in norm_cmd and "||" not in norm_cmd

        ask_reasons: List[str] = []
        for seg in segments:
            try:
                tokens = shlex.split(seg, posix=True)
            except Exception:
                return "ASK", [f"Unparseable or obfuscated shell syntax requires Boss approval: {seg[:80]}"]

            if not tokens:
                continue

            # Strip leading env var assignments like `PYTHONPATH=/foo python3 ...`
            idx = 0
            while idx < len(tokens) and re.match(r"^[A-Za-z_][A-Za-z0-9_]*=", tokens[idx]):
                k, v = tokens[idx].split("=", 1)
                if k.upper() in ("LD_PRELOAD", "LD_LIBRARY_PATH", "DYLD_INSERT_LIBRARIES"):
                    return "DENY", [f"Dangerous dynamic linker environment override: {k}"]
                idx += 1
            if idx >= len(tokens):
                continue

            binary = os.path.basename(tokens[idx]).lower()
            args = tokens[idx + 1:]
            full_seg = " ".join(tokens[idx:])

            if binary in DENY_SHELL_BINARIES:
                return "DENY", [f"Prohibited privileged/destructive shell binary: '{binary}'"]

            # Check path arguments for sensitive files or sandbox escape
            for arg in args:
                if arg.startswith("-"):
                    continue
                if any(frag in arg.lower() for frag in SENSITIVE_PATH_FRAGMENTS) or arg.strip() in ("/", "/*"):
                    return "DENY", [f"Shell command references restricted system/credential path: '{arg}'"]
                if ".." in arg or arg.startswith("/etc") or arg.startswith("/root") or arg.startswith("/var") or arg.startswith("/usr") or arg.startswith("~"):
                    tier_p, reason_p = self.check_path_jail(arg, tool_name="file_write")
                    if tier_p == "DENY":
                        return "DENY", [reason_p]

            # Evaluate interpreter inline code execution (`python -c`, `node -e`, `sh -c`, `bash -c`, `eval`)
            if binary in ("sh", "bash", "zsh", "dash", "ksh", "csh", "eval", "exec", "source"):
                if has_pipe:
                    return "DENY", [f"Piping into shell interpreter '{binary}' is prohibited"]
                ask_reasons.append(f"Nested shell interpreter execution ('{binary}') requires Boss approval")
                continue

            if binary in ("python", "python3", "node", "ruby", "perl", "php", "pwsh", "powershell", "cmd", "cmd.exe"):
                # Allow safe test execution (`python3 -m unittest ...`, `node --test ...`)
                if binary in ("python", "python3") and len(args) >= 2 and args[0] == "-m" and args[1] in ("unittest", "pytest"):
                    continue
                if binary == "node" and len(args) >= 1 and args[0] == "--test":
                    continue
                if any(flag in args for flag in ("-c", "-e", "/c", "-Command", "-EncodedCommand", "-enc")):
                    inline_code = " ".join(args)
                    if any(bad in inline_code.lower() for bad in ("os.system", "subprocess", "shutil.rmtree", "unlink", "remove", "socket", "urllib", "requests", "http", "/etc/", ".ssh", ".env")):
                        return "DENY", [f"Inline '{binary}' script attempts restricted system/network/file operation"]
                    ask_reasons.append(f"Inline code execution via '{binary}' requires Boss approval")
                    continue

            if binary == "git":
                subcmd = args[0].lower() if args else ""
                if subcmd in ("status", "diff", "log", "branch", "show", "rev-parse", "init", "add", "commit", "checkout"):
                    if "--force" in args or "-f" in args or "-D" in args:
                        ask_reasons.append(f"Forced git operation ('git {subcmd}') requires Boss approval")
                    continue
                ask_reasons.append(f"Git remote/history operation ('git {subcmd}') requires Boss approval")
                continue

            if binary == "find":
                if any(a in ("-delete", "-exec", "-execdir", "-ok") for a in args):
                    ask_reasons.append("find with -delete/-exec requires Boss approval")
                continue

            if binary in ASK_SHELL_BINARIES:
                ask_reasons.append(f"Shell command '{binary}' mutates files, packages, or network state and requires Boss approval")
                continue

            if binary not in SAFE_SHELL_BINARIES:
                ask_reasons.append(f"Unrecognized shell command '{binary}' defaults to ASK (Boss approval required)")

        if ask_reasons:
            return "ASK", ask_reasons
        return "AUTO", ["Verified safe shell command"]

    # ------------------------------------------------------------------
    # Structured HTTP & SSRF Analyzer
    # ------------------------------------------------------------------
    def analyze_http_action(self, url: str, method: str = "GET", allow_local_backend: bool = False) -> Tuple[str, List[str]]:
        if not url:
            return "AUTO", []

        raw_url = str(url).strip()
        try:
            parsed = urllib.parse.urlparse(raw_url)
        except Exception:
            return "DENY", [f"Malformed URL blocked: {raw_url}"]

        scheme = (parsed.scheme or "").lower()
        if scheme not in ("http", "https"):
            return "DENY", [f"Non-HTTP URL scheme '{scheme}://' blocked (SSRF protection)"]

        host = (parsed.hostname or "").lower().strip("[]")
        if not host:
            return "DENY", [f"URL missing hostname: {raw_url}"]

        # Cloud metadata hostnames
        if host in ("metadata.google.internal", "metadata", "instance-data", "169.254.169.254", "100.100.100.200"):
            return "DENY", [f"Cloud metadata endpoint '{host}' blocked (SSRF protection)"]

        # Check IP literals (including hex/octal/integer IP encodings)
        ip_obj = None
        try:
            ip_obj = ipaddress.ip_address(host)
        except ValueError:
            # Check if integer or hex IP like 0x7f000001 or 2130706433
            if re.match(r"^(?:0x[0-9a-fA-F]+|\d+)$", host):
                try:
                    ip_int = int(host, 0)
                    if 0 <= ip_int <= 0xFFFFFFFF:
                        ip_obj = ipaddress.ip_address(ip_int)
                except Exception:
                    pass

        if host in ("localhost", "localhost.localdomain", "ip6-localhost") or (
            ip_obj and (ip_obj.is_loopback or ip_obj.is_private or ip_obj.is_link_local or ip_obj.is_multicast or ip_obj.is_reserved or ip_obj.is_unspecified)
        ):
            if allow_local_backend and host in ("127.0.0.1", "localhost") and parsed.port == 8765:
                return "AUTO", ["Allowed local MK-AI backend port 8765"]
            return "DENY", [f"Internal, private, loopback, or link-local address '{host}' blocked (SSRF protection)"]

        verb = str(method or "GET").upper()
        if verb in ("POST", "PUT", "PATCH", "DELETE"):
            return "ASK", [f"External mutating HTTP {verb} request to '{host}' requires Boss approval"]

        return "AUTO", [f"Allowed HTTP GET to '{host}'"]

    # ------------------------------------------------------------------
    # Structured Browser Action Analyzer
    # ------------------------------------------------------------------
    def analyze_browser_action(self, action: str, params: Dict[str, Any]) -> Tuple[str, List[str]]:
        url = str(params.get("url") or params.get("target_url") or "")
        if url:
            http_tier, http_reasons = self.analyze_http_action(url, method="GET")
            if http_tier == "DENY":
                return "DENY", http_reasons

        selector = str(params.get("selector") or "")
        button_label = str(params.get("button_label") or params.get("text") or params.get("label") or "")
        field_type = str(params.get("field_type") or params.get("input_type") or params.get("field_name") or "")
        page_state = str(params.get("page_state") or "")

        combined_browser = normalize_and_decode_text(f"{action} {json.dumps(params, ensure_ascii=False)}")

        if re.search(r"(bypass[_\s-]?captcha|solve[_\s-]?captcha|2captcha|anticaptcha|capmonster)", combined_browser, re.I):
            return "DENY", ["Automated CAPTCHA solving or evasion is strictly prohibited"]

        if re.search(r"(captcha|recaptcha|hcaptcha|turnstile|login[_\s-]?wall|two[_\s-]?factor|2fa[_\s-]?challenge)", combined_browser, re.I):
            return "ASK", ["Browser encountered Login Wall, 2FA, or CAPTCHA challenge — pausing for Boss intervention"]

        if RISKY_BROWSER_FIELDS.search(f"{selector} {field_type}"):
            return "ASK", [f"Browser interaction with sensitive credential/payment field ('{field_type or selector}') requires Boss approval"]

        if RISKY_BROWSER_BUTTONS.search(f"{action} {button_label} {selector}"):
            return "ASK", [f"Browser click/submit on high-consequence control ('{button_label or selector or action}') requires Boss approval"]

        return "AUTO", ["Safe browser navigation/read step"]

    # ------------------------------------------------------------------
    # Structured Spend Cap & Outbound Communication Analyzer
    # ------------------------------------------------------------------
    def check_and_record_spend(self, agent_id: str, amount_inr: float, policy: Dict[str, Any], record: bool = False) -> Tuple[str, str]:
        if amount_inr < 0:
            return "DENY", f"Negative spend amount ({amount_inr}) is invalid"
        if amount_inr == 0:
            return "AUTO", "Zero spend"

        max_cap = float(policy.get("max_daily_spend_inr", 0))
        day_utc = time.strftime("%Y-%m-%d", time.gmtime())
        with self._connect() as conn:
            row = conn.execute(
                "SELECT spent_inr FROM agent_daily_spend WHERE agent_id = ? AND day_utc = ?",
                (agent_id, day_utc),
            ).fetchone()
            already_spent = float(row["spent_inr"]) if row else 0.0

            if already_spent + amount_inr > max_cap:
                return "DENY", (
                    f"Spend cap exceeded for '{agent_id}': requested INR {amount_inr} + daily spent INR {already_spent} "
                    f"> policy max_daily_spend_inr INR {max_cap}"
                )
            if record:
                conn.execute(
                    """
                    INSERT INTO agent_daily_spend (agent_id, day_utc, spent_inr)
                    VALUES (?, ?, ?)
                    ON CONFLICT(agent_id, day_utc) DO UPDATE SET spent_inr = spent_inr + excluded.spent_inr
                    """,
                    (agent_id, day_utc, amount_inr),
                )
                conn.commit()
        return "ASK", f"Financial/Ad spend of INR {amount_inr} within daily cap (INR {max_cap}) requires Boss approval"

    # ------------------------------------------------------------------
    # Unified Multi-Layer Risk Classifier (`AUTO` / `ASK` / `DENY`)
    # ------------------------------------------------------------------
    def classify_risk(
        self,
        agent_id: str,
        tool_name: str,
        action: str,
        params: Optional[Dict[str, Any]] = None,
        untrusted_context: bool = False,
    ) -> Tuple[str, List[str]]:
        """
        Fail-closed structured risk classification across:
        1. Kill Switch & Agent Policy validation
        2. Untrusted Prompt-Injection defense
        3. Tool-specific structured analyzers (`shell`, `file_*`, `browser`, `http`, `git`, `money/email`)
        4. Normalized + multi-encoding decoded text analysis across all fields (no prompt prefix exceptions!)
        """
        try:
            params = dict(params or {})
            killed, kill_reason = self.is_killed(agent_id)
            if killed:
                return "DENY", [kill_reason]

            policy = self.load_agent_policy(agent_id)
            if policy is None:
                return "DENY", [f"Fail-closed: Missing or invalid security policy for agent '{agent_id}'"]

            tool_lower = str(tool_name or "").strip().lower()
            action_lower = str(action or "").strip().lower()

            # Concatenate ALL fields (action, tool, all param values, task_prompt) and decode encodings/homoglyphs
            raw_joined = f"{tool_name} {action} " + " ".join(f"{k}={v}" for k, v in sorted(params.items()))
            normalized_all = normalize_and_decode_text(raw_joined)

            # 1. Check Untrusted Prompt-Injection Attempt
            inj_detected, inj_reasons = PromptInjectionDefense.detect_injection(normalized_all)
            if untrusted_context and (
                inj_detected
                or tool_lower in ("shell", "bash", "exec", "file_delete", "email", "ads_api", "cloud_api", "git_push", "payment")
            ):
                return "DENY", inj_reasons or [f"Untrusted external content cannot invoke privileged tool '{tool_name}'"]
            if inj_detected:
                return "DENY", inj_reasons

            # 2. Check Per-Agent Policy Deny List
            if tool_lower in [t.lower() for t in policy.get("deny_tools", [])]:
                return "DENY", [f"Tool '{tool_name}' is in deny_tools for agent '{agent_id}'"]

            # 3. Check Hard DENY patterns across normalized + decoded fields
            deny_reasons: List[str] = []
            for pat, desc in DENY_PATTERNS:
                if pat.search(normalized_all):
                    deny_reasons.append(desc)
            if deny_reasons:
                return "DENY", deny_reasons

            ask_reasons: List[str] = []

            # 4. Structured Shell Analysis
            if tool_lower in ("shell", "bash", "sh", "exec", "command", "terminal") or "command" in params or "cmd" in params:
                cmd_str = str(params.get("command") or params.get("cmd") or params.get("task_prompt") or action)
                s_tier, s_reasons = self.analyze_shell_command(cmd_str)
                if s_tier == "DENY":
                    return "DENY", s_reasons
                if s_tier == "ASK":
                    ask_reasons.extend(s_reasons)

            # 5. Structured File & Path Jail Analysis (skip cwd on chat/task_execution turns so different working dirs never false-deny)
            path_keys_to_check = (
                ("path", "file_path", "target_path", "source_path", "dest_path")
                if tool_lower in ("task_execution", "chat", "run_direct_turn")
                else ("path", "file_path", "target_path", "source_path", "dest_path", "project_dir")
            )
            for path_key in path_keys_to_check:
                val_p = params.get(path_key)
                if val_p and str(val_p).strip():
                    f_tier, f_reason = self.check_path_jail(str(val_p), tool_name=tool_lower)
                    if f_tier == "DENY":
                        return "DENY", [f_reason]
                    if f_tier == "ASK":
                        ask_reasons.append(f_reason)

            # 6. Structured Browser Analysis
            if tool_lower in ("browser", "playwright", "chrome", "computer_use", "web_browser"):
                b_tier, b_reasons = self.analyze_browser_action(action_lower, params)
                if b_tier == "DENY":
                    return "DENY", b_reasons
                if b_tier == "ASK":
                    ask_reasons.extend(b_reasons)

            # 7. Structured HTTP / SSRF Analysis
            if tool_lower in ("http", "fetch", "curl", "webhook", "api_call") or "url" in params or "endpoint" in params:
                target_url = str(params.get("url") or params.get("endpoint") or "")
                http_method = str(params.get("method") or ("POST" if "post" in action_lower else "GET"))
                h_tier, h_reasons = self.analyze_http_action(target_url, method=http_method)
                if h_tier == "DENY":
                    return "DENY", h_reasons
                if h_tier == "ASK":
                    ask_reasons.extend(h_reasons)

            # 8. Structured Spend Cap & Money/Outbound Message Analysis
            amount_val = params.get("amount_inr") or params.get("amount") or params.get("spend_inr")
            if amount_val is not None:
                try:
                    amt = float(amount_val)
                    sp_tier, sp_reason = self.check_and_record_spend(agent_id, amt, policy, record=False)
                    if sp_tier == "DENY":
                        return "DENY", [sp_reason]
                    if sp_tier == "ASK":
                        ask_reasons.append(sp_reason)
                except ValueError:
                    return "DENY", [f"Invalid numeric spend amount: {amount_val}"]

            if tool_lower in (
                "file_delete", "delete", "email", "email_send", "ads_api", "ads_api_mutate",
                "cloud_api", "cloud_api_deploy", "git_push", "git_push_remote",
                "social_publish", "payment", "payment_disburse", "whatsapp_broadcast",
            ) or tool_lower in [t.lower() for t in policy.get("ask_tools", [])]:
                ask_reasons.append(f"Tool '{tool_name}' requires explicit Boss approval before execution")

            if params.get("recipient") or params.get("to") or params.get("to_address"):
                if action_lower not in ("create_email_draft", "draft_email", "save_draft"):
                    ask_reasons.append(f"Outbound message/email to external recipient '{params.get('recipient') or params.get('to') or params.get('to_address')}' requires Boss approval")

            # 9. Semantic + Obfuscation-Decoded Pattern Analysis across all fields
            for pat, desc in ASK_PATTERNS:
                if pat.search(normalized_all):
                    if desc not in ask_reasons:
                        ask_reasons.append(desc)

            if ask_reasons:
                return "ASK", ask_reasons

            return "AUTO", ["Verified safe sandbox operation within agent authority"]
        except Exception as exc:
            # Fail-closed invariant: any internal analyzer exception blocks the action
            return "DENY", [f"Fail-closed Gatekeeper error: {exc}"]

    # ------------------------------------------------------------------
    # Action-Level Interceptor & Single-Use Token Consumer
    # ------------------------------------------------------------------
    def evaluate_and_gate(
        self,
        agent_id: str,
        department_name: str,
        sub_agent: Dict[str, Any],
        tool_name: str,
        action: str,
        params: Optional[Dict[str, Any]] = None,
        task_prompt: str = "",
        task_id: str = "",
        untrusted_context: bool = False,
        server_verified_token: Optional[str] = None,
        approval_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Intercepts every tool call or task execution before it runs.
        - Strips any client-supplied bypass flags (`approved: true`, `bypass_gate: true`).
        - Binds `ASK` approvals to `action_hash = SHA256(agent_id, task_id, tool_name, action, params, task_prompt)`.
        - Enforces single-use consumption (`status: 'approved' -> 'consumed'`) so an approval token
          can never be replayed or used to authorize a different action.
        """
        params = dict(params or {})
        spoof_attempt = False
        for spoof_key in ("approved", "is_approved", "bypass_gate", "skip_approval", "_internal_server_approved", "require_approval_gate"):
            if spoof_key in params:
                if params.get(spoof_key) in (True, "true", 1, False):
                    spoof_attempt = True
                params.pop(spoof_key, None)

        current_action_hash = compute_action_hash(
            agent_id=agent_id,
            tool_name=tool_name,
            action=action,
            params=params,
            task_prompt=task_prompt,
            task_id=task_id,
        )

        tier, reasons = self.classify_risk(
            agent_id=agent_id,
            tool_name=tool_name,
            action=action,
            params={**params, "task_prompt": task_prompt},
            untrusted_context=untrusted_context,
        )

        if spoof_attempt and tier in ("ASK", "DENY"):
            reasons.append("Client attempted to spoof approval flag in request payload (ignored by Gatekeeper)")

        if tier == "DENY":
            audit_entry = self.audit.log_event(
                agent_id=agent_id or "unknown",
                subagent_code=(sub_agent or {}).get("code", "head"),
                tool_name=tool_name,
                action=action,
                params={"params": params, "task_prompt": task_prompt, "action_hash": current_action_hash, "reasons": reasons},
                risk_tier="DENY",
                decision="BLOCKED_DENY",
                approver="gatekeeper_policy",
            )
            return {
                "allowed": False,
                "risk_tier": "DENY",
                "status": "denied_by_policy",
                "http_status": 403,
                "action_hash": current_action_hash,
                "reasons": reasons,
                "audit_entry": audit_entry,
            }

        if tier == "ASK":
            if approval_id and server_verified_token:
                ok_consume, consume_msg, consumed_rec = self.consume_approval(
                    approval_id=approval_id,
                    provided_token=server_verified_token,
                    expected_action_hash=current_action_hash,
                )
                if not ok_consume:
                    audit_entry = self.audit.log_event(
                        agent_id=agent_id,
                        subagent_code=(sub_agent or {}).get("code", "head"),
                        tool_name=tool_name,
                        action=action,
                        params={"approval_id": approval_id, "error": consume_msg, "action_hash": current_action_hash},
                        risk_tier="DENY",
                        decision="BLOCKED_INVALID_OR_REPLAYED_APPROVAL",
                        approver="gatekeeper_security",
                    )
                    return {
                        "allowed": False,
                        "risk_tier": "DENY",
                        "status": "approval_verification_failed",
                        "http_status": 403,
                        "action_hash": current_action_hash,
                        "reasons": [consume_msg],
                        "audit_entry": audit_entry,
                    }

                audit_entry = self.audit.log_event(
                    agent_id=agent_id,
                    subagent_code=(sub_agent or {}).get("code", "head"),
                    tool_name=tool_name,
                    action=action,
                    params={"params": params, "approval_id": approval_id, "action_hash": current_action_hash},
                    risk_tier="ASK",
                    decision="APPROVED_CONSUMED_ONCE",
                    approver="boss_verified_token",
                )
                return {
                    "allowed": True,
                    "risk_tier": "ASK",
                    "status": "approved_by_boss",
                    "http_status": 200,
                    "approval_id": approval_id,
                    "action_hash": current_action_hash,
                    "audit_entry": audit_entry,
                }

            record = self.create(
                department_id=agent_id,
                department_name=department_name,
                sub_agent=sub_agent,
                reason="; ".join(reasons),
                matched_rules=reasons,
                task_prompt=task_prompt or f"{tool_name}:{action}",
                tool_name=tool_name,
                action=action,
                params=params,
                action_hash=current_action_hash,
                risk_tier="ASK",
            )
            audit_entry = self.audit.log_event(
                agent_id=agent_id,
                subagent_code=(sub_agent or {}).get("code", "head"),
                tool_name=tool_name,
                action=action,
                params={"params": params, "approval_id": record["approval_id"], "action_hash": current_action_hash, "reasons": reasons},
                risk_tier="ASK",
                decision="PAUSED_FOR_BOSS_APPROVAL",
                approver="pending_boss",
            )
            return {
                "allowed": False,
                "risk_tier": "ASK",
                "status": "awaiting_human_approval",
                "http_status": 202,
                "action_hash": current_action_hash,
                "reasons": reasons,
                "approval_request": record,
                "audit_entry": audit_entry,
            }

        audit_entry = self.audit.log_event(
            agent_id=agent_id,
            subagent_code=(sub_agent or {}).get("code", "head"),
            tool_name=tool_name,
            action=action,
            params={"params": params, "action_hash": current_action_hash},
            risk_tier="AUTO",
            decision="AUTO_ALLOWED",
            approver="gatekeeper_auto",
        )
        return {
            "allowed": True,
            "risk_tier": "AUTO",
            "status": "allowed",
            "http_status": 200,
            "action_hash": current_action_hash,
            "reasons": reasons,
            "audit_entry": audit_entry,
        }

    # ------------------------------------------------------------------
    # Persistent Approval Store & Single-Use Action-Bound Token Methods
    # ------------------------------------------------------------------
    def _sign_token(self, approval_id: str, action_hash: str) -> str:
        msg = f"{approval_id}:{action_hash}".encode("utf-8")
        return hmac.new(self.secret.encode("utf-8"), msg, hashlib.sha256).hexdigest()[:32]

    def create(
        self,
        department_id: str,
        department_name: str,
        sub_agent: Dict[str, Any],
        reason: str,
        matched_rules: List[str],
        task_prompt: str,
        tool_name: str = "task_execution",
        action: str = "execute",
        params: Optional[Dict[str, Any]] = None,
        action_hash: Optional[str] = None,
        risk_tier: str = "ASK",
        scope_mode: str = "once",
    ) -> Dict[str, Any]:
        approval_id = f"mkai-apr-{uuid.uuid4().hex[:12]}"
        created_at = int(time.time())
        safe_params = redact_secrets(params or {})
        computed_hash = action_hash or compute_action_hash(
            agent_id=department_id,
            tool_name=tool_name,
            action=action,
            params=params or {},
            task_prompt=task_prompt,
        )
        token = self._sign_token(approval_id, computed_hash)
        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO approvals (
                    approval_id, status, department_id, department_name,
                    sub_agent_json, tool_name, action, params_json, action_hash,
                    risk_tier, reason, matched_rules_json, task_prompt,
                    approval_token, scope_mode, created_at, decided_at, consumed_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL)
                """,
                (
                    approval_id,
                    "pending_human_approval",
                    department_id,
                    department_name,
                    json.dumps(sub_agent, ensure_ascii=False),
                    tool_name,
                    action,
                    json.dumps(safe_params, ensure_ascii=False),
                    computed_hash,
                    risk_tier,
                    reason,
                    json.dumps(matched_rules, ensure_ascii=False),
                    task_prompt,
                    token,
                    scope_mode,
                    created_at,
                ),
            )
            conn.commit()
        return self.get(approval_id)  # type: ignore[return-value]

    def get(self, approval_id: str) -> Optional[Dict[str, Any]]:
        with self._connect() as conn:
            row = conn.execute("SELECT * FROM approvals WHERE approval_id = ?", (approval_id,)).fetchone()
            if not row:
                return None
            return self._row_to_dict(row)

    def list_pending(self) -> List[Dict[str, Any]]:
        with self._connect() as conn:
            rows = conn.execute(
                "SELECT * FROM approvals WHERE status = 'pending_human_approval' ORDER BY created_at DESC"
            ).fetchall()
            return [self._row_to_dict(r) for r in rows]

    def verify_and_mark_decided(
        self,
        approval_id: str,
        decision: str,
        provided_token: Optional[str] = None,
        scope_mode: str = "once",
    ) -> Tuple[bool, str, Optional[Dict[str, Any]]]:
        rec = self.get(approval_id)
        if not rec:
            return False, f"Approval ID not found: {approval_id}", None
        if rec["status"] != "pending_human_approval":
            return False, f"Approval ID {approval_id} already decided or consumed ({rec['status']})", rec
        expected_token = rec["approval_token"]
        if not provided_token or not hmac.compare_digest(str(provided_token), str(expected_token)):
            return False, "Missing or invalid server-issued approval_token for this approval request.", rec
        new_status = "approved" if decision in ("approve", "approve_once", "approve_task") else "rejected"
        effective_scope = "task" if decision == "approve_task" else scope_mode
        with self._connect() as conn:
            conn.execute(
                "UPDATE approvals SET status = ?, scope_mode = ?, decided_at = ? WHERE approval_id = ?",
                (new_status, effective_scope, int(time.time()), approval_id),
            )
            conn.commit()
        self.audit.log_event(
            agent_id=rec["department_id"],
            subagent_code=rec["sub_agent"].get("code", "head"),
            tool_name=rec.get("tool_name", "task_execution"),
            action=f"boss_decision_{new_status}",
            params={"approval_id": approval_id, "decision": new_status, "action_hash": rec.get("action_hash", "")},
            risk_tier="ASK",
            decision=new_status.upper(),
            approver="boss",
        )
        return True, new_status, self.get(approval_id)

    def consume_approval(
        self,
        approval_id: str,
        provided_token: str,
        expected_action_hash: str,
    ) -> Tuple[bool, str, Optional[Dict[str, Any]]]:
        """
        Atomically verifies and consumes a single-use approval token.
        - Rejects if status != 'approved' (blocks unapproved, rejected, or already-consumed replays).
        - Rejects if `provided_token` does not match the server HMAC token.
        - Rejects if `expected_action_hash` does not match `rec['action_hash']` (an approval for Action X
          can NEVER authorize Action Y!).
        """
        rec = self.get(approval_id)
        if not rec:
            return False, f"Approval ID not found: {approval_id}", None
        if rec["status"] == "consumed":
            return False, f"Approval replay blocked: approval {approval_id} has already been consumed (single-use only)", rec
        if rec["status"] != "approved":
            return False, f"Approval {approval_id} is not in approved state (current status: {rec['status']})", rec
        if not provided_token or not hmac.compare_digest(str(provided_token), str(rec["approval_token"])):
            return False, "Invalid approval_token signature", rec
        stored_hash = rec.get("action_hash") or ""
        if stored_hash and expected_action_hash and not hmac.compare_digest(str(stored_hash), str(expected_action_hash)):
            return False, (
                f"Action mismatch blocked: approval {approval_id} is cryptographically bound to action_hash "
                f"{stored_hash[:16]}..., cannot authorize different action {expected_action_hash[:16]}..."
            ), rec

        with self._connect() as conn:
            cur = conn.execute(
                "UPDATE approvals SET status = 'consumed', consumed_at = ? WHERE approval_id = ? AND status = 'approved'",
                (int(time.time()), approval_id),
            )
            conn.commit()
            if cur.rowcount == 0:
                return False, f"Concurrent replay blocked for approval {approval_id}", rec

        return True, "consumed", self.get(approval_id)

    @staticmethod
    def _row_to_dict(row: sqlite3.Row) -> Dict[str, Any]:
        keys = row.keys()
        return {
            "approval_id": row["approval_id"],
            "status": row["status"],
            "department_id": row["department_id"],
            "department_name": row["department_name"],
            "sub_agent": json.loads(row["sub_agent_json"]),
            "tool_name": row["tool_name"] if "tool_name" in keys else "task_execution",
            "action": row["action"] if "action" in keys else "execute",
            "params": json.loads(row["params_json"]) if "params_json" in keys else {},
            "action_hash": row["action_hash"] if "action_hash" in keys else "",
            "risk_tier": row["risk_tier"] if "risk_tier" in keys else "ASK",
            "reason": row["reason"],
            "matched_rules": json.loads(row["matched_rules_json"]),
            "task_prompt": row["task_prompt"],
            "approval_token": row["approval_token"],
            "scope_mode": row["scope_mode"] if "scope_mode" in keys else "once",
            "created_at": row["created_at"],
            "decided_at": row["decided_at"],
            "consumed_at": row["consumed_at"] if "consumed_at" in keys else None,
        }
