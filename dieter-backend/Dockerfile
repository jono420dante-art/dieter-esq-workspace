# Build context MUST be the repository root (the folder that contains BOTH
# mureka-clone/ and dieter-backend/). Example:
#   docker build -f dieter-backend/Dockerfile .
# If your host uses only the Dockerfile’s folder as context, COPY mureka-clone will fail.
# Produces: FastAPI + Gunicorn + React static (mureka-clone/dist → /app/static)

FROM node:20-alpine AS frontend
WORKDIR /src
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
COPY dieter-backend/scripts /app/scripts

RUN mkdir -p /app/data /app/storage

COPY --from=frontend /src/mureka-clone/dist /app/static

EXPOSE 8080

CMD ["sh", "-c", "gunicorn app.main:app -k uvicorn.workers.UvicornWorker -w ${WEB_CONCURRENCY} -b 0.0.0.0:${PORT} --timeout 120 --access-logfile - --error-logfile -"]
