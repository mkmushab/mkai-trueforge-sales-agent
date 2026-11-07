# tinyfish-squad (Standalone 4-Agent Web Squad)

Standalone Python package under `engines/tinyfish-squad/` providing:
1. `leads` — **Lead Hunter** (`--query`, `--location`, `--limit`, `--dry-run`)
2. `competitors` — **Competitor Watch** (`--urls`, `--limit`, `--dry-run`)
3. `content` — **Content Scout** (`--topic`, `--limit`, `--dry-run`)
4. `radar` — **Opportunity Radar** (`--query`, `--category`, `--limit`, `--dry-run`)

Features built-in credit guards (`--limit`), bounded retries with exponential backoff, `--dry-run` plan verification, and strict Rule 3 compliance (returns structured `{ ok: false, error, hint }` when `TINYFISH_API_KEY` is absent or network is unreachable; never returns fake fallback leads unless `MKAI_DEMO_MODE=1`).
