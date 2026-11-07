FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    MK_BACKEND_HOST=0.0.0.0 \
    MK_BACKEND_PORT=8765

COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY agents_registry.json /app/agents_registry.json
COPY router.py /app/router.py
COPY open_source_engines.py /app/open_source_engines.py
COPY crew_orchestrator.py /app/crew_orchestrator.py
COPY n8n_bridge.py /app/n8n_bridge.py
COPY server.py /app/server.py
COPY mkai_mcp_server.py /app/mkai_mcp_server.py
COPY verify_setup.py /app/verify_setup.py
COPY n8n_workflows /app/n8n_workflows

EXPOSE 8765

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD python3 -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8765/health', timeout=3)" || exit 1

CMD ["python3", "server.py"]
