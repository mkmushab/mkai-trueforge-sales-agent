#!/usr/bin/env python3
"""
MK AI — CycloneDX 1.5 Software Bill of Materials (SBOM) Generator (`scripts/generate_sbom.py`)
Phase R9: Generates `reports/sbom.cdx.json` from `package.json` and `mkai-backend/requirements.txt`.
"""
import json
import os
import time

_SCRIPTS_DIR = os.path.dirname(os.path.abspath(__file__))
_ROOT = os.path.dirname(_SCRIPTS_DIR)


def generate_sbom() -> str:
    pkg_path = os.path.join(_ROOT, "package.json")
    req_path = os.path.join(_ROOT, "mkai-backend", "requirements.txt")
    out_path = os.path.join(_ROOT, "reports", "sbom.cdx.json")
    os.makedirs(os.path.dirname(out_path), exist_ok=True)

    components = []
    if os.path.isfile(pkg_path):
        with open(pkg_path, "r", encoding="utf-8") as f:
            pkg = json.load(f)
        for dep_type in ("dependencies", "devDependencies"):
            for name, ver in sorted(pkg.get(dep_type, {}).items()):
                components.append({
                    "type": "library",
                    "ecosystem": "npm",
                    "name": name,
                    "version": str(ver).lstrip("^~"),
                    "purl": f"pkg:npm/{name}@{str(ver).lstrip('^~')}",
                })

    if os.path.isfile(req_path):
        with open(req_path, "r", encoding="utf-8") as f:
            for line in f:
                raw = line.strip()
                if not raw or raw.startswith("#"):
                    continue
                if "==" in raw:
                    name, ver = raw.split("==", 1)
                elif ">=" in raw:
                    name, ver = raw.split(">=", 1)
                else:
                    name, ver = raw, "latest"
                components.append({
                    "type": "library",
                    "ecosystem": "pypi",
                    "name": name.strip(),
                    "version": ver.strip(),
                    "purl": f"pkg:pypi/{name.strip()}@{ver.strip()}",
                })

    sbom = {
        "bomFormat": "CycloneDX",
        "specVersion": "1.5",
        "version": 1,
        "metadata": {
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "component": {"type": "application", "name": "mkai", "version": "2.0.0"},
        },
        "components": components,
    }
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(sbom, f, indent=2)
    return out_path


if __name__ == "__main__":
    p = generate_sbom()
    print(f"[PASS] Generated CycloneDX SBOM at {p}")
