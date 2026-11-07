# MK-AI TinyFish Web-Agent Connector Integration (`README_TINYFISH_INTEGRATION.md`)

> **Security Notice (Phase 0)**: All real API keys previously exposed in plain text have been removed and replaced with placeholders. Rotate any key that was previously committed or shared in `.env` or documentation before running against live services.

## 1. Architecture: Service Connector, NOT an LLM Model
TinyFish (`https://agent.tinyfish.ai`) is a **web-agent & browser-automation service**, not a chat completion language model.
- **Model Picker (`src/renderer/components/ModelSelector.tsx` & `src/renderer/config.ts`)**: Lists only real language models (`MK Main · gpt-oss-120b`, `MK Heavy · deepseek-v3.2`, `MK Fast · gemma-4-31B-it`, plus optional user-configured provider models). TinyFish is strictly excluded from the Model Picker.
- **MCP Connectors (`src/renderer/data/mcpRegistry.json` & `mkai-backend/tinyfish_bridge.py`)**: TinyFish is registered as an HTTP MCP connector (`https://agent.tinyfish.ai/mcp`) and backend bridge (`mkai-backend/tinyfish_bridge.py`) with credentials read exclusively from environment variables (`TINYFISH_API_KEY`).

## 2. Environment Configuration (`.env.example`)
Configure TinyFish in your local git-ignored `.env` file using placeholders from `.env.example`:

```env
TINYFISH_API_KEY=your_tinyfish_api_key_here
TINYFISH_BASE_URL=https://agent.tinyfish.ai
TINYFISH_SEARCH_URL=https://api.search.tinyfish.io
TINYFISH_FETCH_URL=https://api.fetch.tinyfish.io
TINYFISH_MCP_URL=https://agent.tinyfish.ai/mcp
MK_LIVE_WEB=true
MK_TINYFISH_LIMIT=2
MK_TINYFISH_TIMEOUT=180
MKAI_DEMO_MODE=0
```

## 3. Zero Fake Fallbacks (Rule 3 Compliance)
`mkai-backend/tinyfish_bridge.py` and `mkai-backend/omni_orchestra.py` strictly enforce **Rule 3 (No fake data, ever)**:
- When `TINYFISH_API_KEY` is missing or the TinyFish endpoint is unreachable, the bridge immediately returns a structured error:
  ```json
  {
    "ok": false,
    "error": "TinyFish API unreachable or TINYFISH_API_KEY not configured",
    "hint": "Set a valid TINYFISH_API_KEY in .env and verify network access to https://agent.tinyfish.ai, or set MKAI_DEMO_MODE=1 for explicit demo mode."
  }
  ```
- Deterministic demo data is disabled by default (`MKAI_DEMO_MODE=0`) and is returned **only** when `MKAI_DEMO_MODE=1` is explicitly set, carrying `demo_mode: true` and rendering a visible **`DEMO DATA`** badge in the UI.
