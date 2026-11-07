#!/usr/bin/env python3
"""
MK-AI Source Code & Documentation Secret Scanner (Pre-Commit & CI Gate)
Scans all repository files (.ts, .tsx, .jsx, .py, .js, .cjs, .mjs, .json, .yml, .yaml, .sh, .bat, .md, .env*)
excluding gitignored local .env files, node_modules, and build directories for hardcoded secrets.
Note: .env.example and .env.template ARE scanned to guarantee zero real secrets are committed as examples.
Exits with code 0 if clean, or code 1 if any secret is detected.
"""
import os
import re
import sys
from typing import List, Tuple

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

SECRET_PATTERNS: List[Tuple[str, re.Pattern]] = [
    ("GeneralCompute API Key (gc_*)", re.compile(r"\bgc_[A-Za-z0-9_-]{20,}\b")),
    ("OpenAI / OpenRouter / Novita / TinyFish API Key (sk-*)", re.compile(r"\bsk[-_][A-Za-z0-9_-]{20,}\b")),
    ("Groq API Key (gsk_*)", re.compile(r"\bgsk_[A-Za-z0-9_-]{20,}\b")),
    ("Cohere API Key (cohere_*)", re.compile(r"\bcohere_[A-Za-z0-9_-]{20,}\b")),
    ("Google / Gemini OAuth or API Key (AQ.* / AIza*)", re.compile(r"\b(?:AQ\.[A-Za-z0-9_-]{20,}|AIza[0-9A-Za-z_-]{35})\b")),
    ("GitHub Personal Access Token (ghp_* / github_pat_*)", re.compile(r"\b(?:ghp_[A-Za-z0-9]{25,}|github_pat_[A-Za-z0-9_]{25,})\b")),
    ("Anthropic API Key (sk-ant-*)", re.compile(r"\bsk-ant-[A-Za-z0-9_-]{20,}\b")),
    ("Firecrawl / Tavily Key (fc-* / tvly-*)", re.compile(r"\b(?:fc|tvly)-[A-Za-z0-9_-]{16,}\b")),
    ("AWS Access Key ID (AKIA*)", re.compile(r"\bAKIA[0-9A-Z]{16}\b")),
    ("Slack Webhook / Bot Token (xox[baprs]-*)", re.compile(r"\bxox[baprs]-[A-Za-z0-9-]{18,}\b")),
    ("PEM Private Key Block", re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----")),
]

IGNORED_DIRS = {
    ".git",
    "node_modules",
    "dist",
    "dist-electron",
    "release",
    "__pycache__",
    ".venv",
    "data",
    "vendor",
}
IGNORED_FILES = {
    ".env",
    ".env.local",
    ".env.production",
    "secret_scanner.py",
    "secret_scan",
}
SCANNED_EXTENSIONS = {
    ".ts",
    ".tsx",
    ".jsx",
    ".py",
    ".js",
    ".cjs",
    ".mjs",
    ".json",
    ".yml",
    ".yaml",
    ".sh",
    ".bat",
    ".md",
    ".example",
    ".template",
}

ALLOWLIST_SNIPPETS = {
    "sk-lobsterai-local",
    "sk-source-custom",
    "gc_AbCdEf123456789",
    "sk-or-v1-secret-key-123456",
    "sk-ant-1234567890abcdef",
}


def should_scan_file(fname: str) -> bool:
    if fname in IGNORED_FILES:
        return False
    if fname in (".env.example", ".env.template"):
        return True
    if fname.startswith(".env"):
        return False
    ext = os.path.splitext(fname)[1].lower()
    return ext in SCANNED_EXTENSIONS


def scan_repository(root_dir: str = ROOT) -> List[dict]:
    findings: List[dict] = []
    for dirpath, dirnames, filenames in os.walk(root_dir):
        dirnames[:] = [d for d in dirnames if d not in IGNORED_DIRS]
        for fname in filenames:
            if not should_scan_file(fname):
                continue
            full_path = os.path.join(dirpath, fname)
            rel_path = os.path.relpath(full_path, root_dir)
            try:
                content = open(full_path, "r", encoding="utf-8", errors="ignore").read()
            except Exception:
                continue
            for line_num, line in enumerate(content.splitlines(), 1):
                if any(allowed in line for allowed in ALLOWLIST_SNIPPETS):
                    continue
                for rule_name, pattern in SECRET_PATTERNS:
                    if pattern.search(line):
                        findings.append({
                            "file": rel_path,
                            "line": line_num,
                            "rule": rule_name,
                        })
    return findings


def main() -> int:
    findings = scan_repository(ROOT)
    print("=" * 72)
    print("  MK-AI SOURCE CODE & DOCUMENTATION SECRET SCANNER")
    print("=" * 72)
    if not findings:
        print("[PASS] 0 hardcoded secrets detected across all repository files (.md, .env.example, .ts, .tsx, .jsx, .py, .json).")
        return 0
    print(f"[FAIL] {len(findings)} potential secret(s) detected (values redacted):")
    for f in findings:
        print(f"  - {f['file']}:{f['line']} [{f['rule']}]")
    return 1


if __name__ == "__main__":
    sys.exit(main())
