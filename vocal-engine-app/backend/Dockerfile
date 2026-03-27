# Build from repository root:
#   docker build -f vocal-engine-app/backend/Dockerfile .

FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PORT=8080

RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY vocal-engine-app/requirements.txt /tmp/requirements.txt
COPY vocal-engine-app/requirements-rvc.txt /tmp/requirements-rvc.txt
RUN pip install -r /tmp/requirements.txt \
    && pip install -r /tmp/requirements-rvc.txt

COPY vocal-engine-app/backend/ /app/

RUN mkdir -p /app/cache /app/exports /app/models/rvc_voices /app/models/hubert

EXPOSE 8080

CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT}"]
