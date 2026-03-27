# Build context MUST be the repository root (the folder that contains BOTH
# mureka-clone/ and dieter-backend/). Example:
#   docker build -f dieter-backend/Dockerfile .
# If your host uses only the Dockerfile’s folder as context, COPY mureka-clone will fail.
# Produces: FastAPI + Gunicorn + React static (mureka-clone/dist → /app/static)

FROM node:20-alpine AS frontend
WORKDIR /src
# Optional: pass when building for a split layout (static on Vercel, API elsewhere), e.g.
#   docker build -f dieter-backend/Dockerfile --build-arg VITE_API_BASE=https://api.example.com .
ARG VITE_API_BASE=
# With docker-compose + DIETER_TRPC_UPSTREAM, enable tRPC at same host (/trpc proxy).
ARG VITE_USE_TRPC=false
ARG VITE_TRPC_URL=/trpc
ENV VITE_API_BASE=$VITE_API_BASE
ENV VITE_USE_TRPC=$VITE_USE_TRPC
ENV VITE_TRPC_URL=$VITE_TRPC_URL
COPY mureka-clone/package.json mureka-clone/package-lock.json* ./mureka-clone/
WORKDIR /src/mureka-clone
RUN npm ci
COPY mureka-clone/ ./
RUN npm run build

FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PORT=8080 \
    WEB_CONCURRENCY=2

RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY dieter-backend/requirements.txt /app/requirements.txt
RUN pip install -r /app/requirements.txt

COPY dieter-backend/app /app/app
COPY dieter-backend/beat_analysis.py /app/beat_analysis.py
COPY dieter-backend/audio_pro.py /app/audio_pro.py
COPY dieter-backend/mureka_sync.py /app/mureka_sync.py
COPY dieter-backend/voice_clone_pipeline.py /app/voice_clone_pipeline.py
COPY dieter-backend/scripts /app/scripts

RUN mkdir -p /app/data /app/storage

COPY dieter-backend/voices /app/voices

COPY --from=frontend /src/mureka-clone/dist /app/static

EXPOSE 8080

CMD ["sh", "-c", "gunicorn app.main:app -k uvicorn.workers.UvicornWorker -w ${WEB_CONCURRENCY} -b 0.0.0.0:${PORT} --timeout 120 --access-logfile - --error-logfile -"]
