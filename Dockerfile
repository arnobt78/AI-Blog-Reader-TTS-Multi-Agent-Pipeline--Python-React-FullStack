# Blog-to-Audio API — FastAPI backend for Coolify (Hetzner VPS)
# Frontend: Vercel (frontend/). Backend: repo root — Base directory ".", Dockerfile "./Dockerfile"
# Coolify: PORT=3000, Ports Mappings e.g. 5005:3000, Traefik loadbalancer.server.port=3000
# Local: docker run -p 8000:8000 -e PORT=8000 blog-to-audio-api

FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=3000

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY main.py .

RUN mkdir -p audio_files

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD sh -c 'python -c "import urllib.request,os; p=os.environ.get(\"PORT\",\"3000\"); urllib.request.urlopen(\"http://127.0.0.1:\"+p+\"/api/health\")"' || exit 1

CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT}"]
