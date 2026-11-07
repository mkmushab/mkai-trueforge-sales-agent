#!/usr/bin/env python3
"""
MK AI — Skill & Plugin Cryptographic Signature Verifier (`mkai-backend/skill_signer.py`)
Phase R9: Signs and verifies all `SKILLs/*/SKILL.md` manifests with SHA-256 + HMAC-SHA256
before loading so a tampered or unsigned skill/plugin is rejected (fail-closed).
"""
import hashlib
import hmac
import json
import os
from typing import Any, Dict, List, Tuple

_HERE = os.path.dirname(os.path.abspath(__file__))
_ROOT = os.path.dirname(_HERE)


class MKSkillSigner:
    def __init__(self, skills_dir: str = "", secret: str = "") -> None:
        self.skills_dir = skills_dir or os.path.join(_ROOT, "SKILLs")
        self.secret = (secret or os.environ.get("MK_SKILL_SIGNING_SECRET", "mkai-skill-manifest-key-2026")).encode("utf-8")
        self.manifest_path = os.path.join(self.skills_dir, "skills_manifest.sig.json")

    def _hash_file(self, path: str) -> str:
        h = hashlib.sha256()
        with open(path, "rb") as f:
            h.update(f.read())
        return h.hexdigest()

    def _sign_digest(self, skill_id: str, sha256_hex: str) -> str:
        msg = f"{skill_id}:{sha256_hex}".encode("utf-8")
        return hmac.new(self.secret, msg, hashlib.sha256).hexdigest()

    def generate_manifest(self) -> Dict[str, Any]:
        entries: Dict[str, Dict[str, str]] = {}
        if os.path.isdir(self.skills_dir):
            for name in sorted(os.listdir(self.skills_dir)):
                skill_md = os.path.join(self.skills_dir, name, "SKILL.md")
                if os.path.isfile(skill_md):
                    digest = self._hash_file(skill_md)
                    entries[name] = {
                        "sha256": digest,
                        "signature": self._sign_digest(name, digest),
                    }
        payload = {"version": "2.0", "total_signed_skills": len(entries), "skills": entries}
        with open(self.manifest_path, "w", encoding="utf-8") as f:
            json.dump(payload, f, indent=2, sort_keys=True)
        return payload

    def verify_all_skills(self) -> Tuple[bool, str, int]:
        if not os.path.isfile(self.manifest_path):
            return False, "Skill signature manifest missing (skills_manifest.sig.json)", 0
        with open(self.manifest_path, "r", encoding="utf-8") as f:
            manifest = json.load(f)
        skills_map = manifest.get("skills", {})
        verified_count = 0
        for name in sorted(os.listdir(self.skills_dir)):
            skill_md = os.path.join(self.skills_dir, name, "SKILL.md")
            if not os.path.isfile(skill_md):
                continue
            if name not in skills_map:
                return False, f"Unsigned skill detected: {name}", verified_count
            actual_sha = self._hash_file(skill_md)
            expected_sha = skills_map[name].get("sha256", "")
            expected_sig = skills_map[name].get("signature", "")
            if actual_sha != expected_sha:
                return False, f"Skill file tampered: {name}/SKILL.md", verified_count
            recomputed_sig = self._sign_digest(name, actual_sha)
            if not hmac.compare_digest(recomputed_sig, expected_sig):
                return False, f"Invalid HMAC signature for skill: {name}", verified_count
            verified_count += 1
        return True, f"Verified {verified_count} signed skill packs", verified_count


if __name__ == "__main__":
    signer = MKSkillSigner()
    manifest = signer.generate_manifest()
    ok, msg, count = signer.verify_all_skills()
    print(f"[{'PASS' if ok else 'FAIL'}] {msg}")
