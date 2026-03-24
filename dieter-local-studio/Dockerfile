# FFmpeg + Python + Librosa for beat analysis. Mount RVC separately.
FROM python:3.11-slim-bookworm

RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg libsndfile1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
ENV PYTHONUNBUFFERED=1
EXPOSE 8890

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8890"]
