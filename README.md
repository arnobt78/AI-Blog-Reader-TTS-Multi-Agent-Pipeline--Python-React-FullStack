# Multi-Provider TTS AI Blog Reader - Python, React, Tailwind CSS, FastAPI, SSE Streaming, Multi-Agent Pipeline, Text Chunking, Conversion History FullStack Project

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python](https://img.shields.io/badge/Python-3.12+-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-19.2-blue?logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-7.2-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.1-38B2AC?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)

Turn blog posts and text into natural-sounding audio. 6 TTS providers (2 always-free), multi-agent pipeline with real-time progress, text chunking, provider health dashboard, and conversion history.

- **Live Demo:** [https://blog-reader-tts.vercel.app/](https://blog-reader-tts.vercel.app/)
- **Backend Live Demo:** [https://blog-audio-backend.arnobmahmud.com](https://blog-audio-backend.arnobmahmud.com)

---

## Provider Comparison

| Provider         | Status      | Free Tier         | API Key  | Quality            | Speed Control |
| ---------------- | ----------- | ----------------- | -------- | ------------------ | ------------- |
| **Edge TTS**     | Working     | Unlimited         | No       | Neural (very good) | Yes           |
| **gTTS**         | Working     | Unlimited         | No       | Basic              | No            |
| **ElevenLabs**   | Partial     | 10k credits/mo    | Yes      | Premium            | No            |
| **Hugging Face** | Unavailable | N/A               | Optional | N/A                | No            |
| **Replicate**    | Paid        | Limited free runs | Yes      | High               | No            |
| **OpenAI**       | Paid        | $5 new account    | Yes      | Premium            | Yes           |

> See [docs/SITUATION.md](docs/SITUATION.md) for detailed provider status and troubleshooting.

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│                   Frontend (React)               │
│  ReaderPage.tsx: tabs, provider select, pipeline │
│  SSE stepper, history, health indicators         │
└──────────────────────┬──────────────────────────┘
                       │ /api/*
┌──────────────────────▼──────────────────────────┐
│                Backend (FastAPI)                  │
│                                                  │
│  ┌── Simple Mode ──────────────────────────┐    │
│  │  POST /api/convert → TTS → FileResponse │    │
│  └─────────────────────────────────────────┘    │
│                                                  │
│  ┌── Pipeline Mode (SSE) ──────────────────┐    │
│  │  Extractor → Analyzer → Preprocessor    │    │
│  │  → Optimizer → Synthesizer → Validator  │    │
│  │  → Assembler → Audio                    │    │
│  └─────────────────────────────────────────┘    │
│                                                  │
│  TTS Providers:                                  │
│  edge-tts │ gTTS │ ElevenLabs │ HuggingFace     │
│  Replicate │ OpenAI                              │
└──────────────────────────────────────────────────┘
```

---

## Features

| Feature                    | Description                                                                             |
| -------------------------- | --------------------------------------------------------------------------------------- |
| **6 TTS Providers**        | Edge TTS, gTTS (both free), ElevenLabs, Hugging Face, Replicate, OpenAI                 |
| **Multi-Agent Pipeline**   | 7-stage pipeline with SSE real-time progress (Extractor → Assembler)                    |
| **Text Chunking**          | Auto-splits long text at sentence boundaries, concatenates audio chunks                 |
| **Provider Health**        | Green/yellow/red status dots with per-provider notes                                    |
| **Dynamic Voices**         | `/api/voices/{provider}` fetches available voices (Edge: 400+, ElevenLabs: user voices) |
| **Conversion History**     | localStorage-based history with playback and re-download                                |
| **Pipeline Mode Toggle**   | Switch between simple (fast) and pipeline (multi-agent) modes                           |
| **OpenAI Model Selection** | Choose tts-1, tts-1-hd, or gpt-4o-mini-tts                                              |
| **Speed Control**          | 0.5x-2.0x for Edge TTS and OpenAI                                                       |
| **URL Extraction**         | Scrape blog articles and convert to audio                                               |
| **Sample Texts**           | Quick-test presets (news, poetry, technology, story)                                    |
| **Error Handling**         | Provider-specific error messages with actionable suggestions                            |

---

## Project Structure

```
blog-to-audio/
├── main.py                 # FastAPI: routes, TTS providers, pipeline, health
├── requirements.txt        # Python deps (edge-tts, gTTS, openai, elevenlabs, replicate, pydub)
├── .env.example            # Template for API keys
├── Dockerfile              # Backend container
├── docs/
│   ├── SITUATION.md        # Provider status & troubleshooting
│   ├── UI_STYLING_GUIDE.md
│   └── ...
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── ReaderPage.tsx   # Main TTS UI with pipeline, history, health
│   │   │   └── IntroPage.tsx    # Landing page
│   │   ├── components/
│   │   │   ├── ui/              # shadcn-style Radix components
│   │   │   └── layout/          # RootLayout, Footer, PageBackground
│   │   ├── hooks/               # usePrefersReducedMotion
│   │   ├── lib/                 # cn(), apiUrl()
│   │   └── index.css            # Tailwind + glow/scrollbar utilities
│   ├── vite.config.ts           # Vite + /api proxy
│   └── package.json
└── README.md
```

---

## Getting Started

**Prerequisites:** Python 3.12+, Node.js 18+

```bash
git clone https://github.com/arnobt78/blog-to-audio.git
cd blog-to-audio

# Backend
pip install -r requirements.txt

# Frontend
cd frontend && npm install
```

**Environment:** Copy `.env.example` to `.env` and fill in keys you need.

---

## Environment Variables

| Variable              | Required       | Description                                                 | Free?                 |
| --------------------- | -------------- | ----------------------------------------------------------- | --------------------- |
| `OPENAI_API_KEY`      | For OpenAI     | [platform.openai.com](https://platform.openai.com/api-keys) | $5 free credits       |
| `ELEVENLABS_API_KEY`  | For ElevenLabs | [elevenlabs.io](https://elevenlabs.io/app/settings)         | 10k credits/mo        |
| `REPLICATE_API_TOKEN` | For Replicate  | [replicate.com](https://replicate.com/account/api-tokens)   | Limited free runs     |
| `HF_API_KEY`          | Optional       | [huggingface.co](https://huggingface.co/settings/tokens)    | Currently unavailable |

**Edge TTS and gTTS work without any API key.**

---

## How to Run

**Backend:**

```bash
uvicorn main:app --reload --port 8000
```

**Frontend:**

```bash
cd frontend && npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

---

## API Reference

| Method | Endpoint                 | Description                                     |
| ------ | ------------------------ | ----------------------------------------------- |
| `GET`  | `/api/providers`         | Provider configs with status, badges, notes     |
| `GET`  | `/api/provider-health`   | Health status per provider (green/yellow/red)   |
| `GET`  | `/api/voices/{provider}` | Dynamic voice list (query: `api_key`)           |
| `GET`  | `/api/sample-texts`      | Sample texts for quick testing                  |
| `GET`  | `/api/health`            | Liveness check + provider count                 |
| `GET`  | `/api/audio/{file_id}`   | Serve generated audio by ID                     |
| `POST` | `/api/extract-text`      | Extract text from URL                           |
| `POST` | `/api/estimate`          | Estimate audio duration                         |
| `POST` | `/api/convert`           | Simple mode: text → MP3                         |
| `POST` | `/api/convert-pipeline`  | Pipeline mode: SSE stream with 7-agent progress |

**Simple convert:**

```bash
curl -X POST http://localhost:8000/api/convert \
  -F "text=Hello world" -F "provider=edge-tts" \
  -F "voice=en-US-AriaNeural" --output audio.mp3
```

**Pipeline convert (SSE):**
l" --output audio.mp3

````

**Pipeline convert (SSE):**

```bash
curl -N -X POST http://localhost:8000/api/convert-pipeline \
  -F "text=Hello world" -F "provider=edge-tts"
````

---

## Multi-Agent Pipeline

The pipeline mode processes text through 7 specialized agents:

1. **Extractor** — Scrapes URL or validates input text
2. **Analyzer** — Detects language, counts words/sentences, estimates duration
3. **Preprocessor** — Cleans text, removes URLs, splits into optimal chunks
4. **Optimizer** — Selects provider settings, checks availability
5. **Synthesizer** — Calls TTS API for each chunk (with retry/fallback)
6. **Validator** — Checks audio quality (non-empty, valid format)
7. **Assembler** — Concatenates chunks with silence gaps, outputs final MP3

Progress streams via SSE (Server-Sent Events) with real-time stepper UI.

---

## License

[MIT License](https://opensource.org/licenses/MIT)

## Happy Coding

This is an **open-source project** — feel free to use, enhance, and extend!

[https://www.arnobmahmud.com](https://www.arnobmahmud.com)
