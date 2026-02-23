# Blog-to-Audio API — FastAPI backend for Coolify (Hetzner VPS)
# Frontend is deployed separately (e.g. Vercel from frontend/)
# Build: docker build -t blog-to-audio-api .
# Run:   docker run -p 5005:3000 -e PORT=3000 blog-to-audio-api

FROM python:3.12-slim

WORKDIR /app

# Install dependencies (TTS libs: edge-tts, openai, elevenlabs, replicate, huggingface_hub, etc.)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Application code (single-file FastAPI app)
COPY main.py .

# Generated MP3s written here at runtime (optional volume mount for persistence)
RUN mkdir -p audio_files

# Port: Coolify default 3000; override with PORT env (e.g. local 8000)
ENV PORT=3000
EXPOSE 3000

# Use PORT so Coolify (3000) and local (e.g. 8000) both work
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT}"]

# Healthcheck: GET /api/providers on same PORT; fails if app not responding
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD sh -c 'python -c "import urllib.request,os; p=os.environ.get(\"PORT\",\"3000\"); urllib.request.urlopen(\"http://127.0.0.1:\"+p+\"/api/providers\")"' || exit 1
