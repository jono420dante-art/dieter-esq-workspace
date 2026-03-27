# Slim lyrics→song worker (Mureka API). No CUDA / Audiocraft / RVC in this image.
FROM python:3.11-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY engine.py .

RUN mkdir -p /app/output /app/voices

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD curl -fsS http://127.0.0.1:3001/health || exit 1

CMD ["uvicorn", "engine:app", "--host", "0.0.0.0", "--port", "3001"]
