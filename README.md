# Multi-Provider TTS AI Blog Reader - Python, React, Tailwind CSS, FastAPI, SSE Streaming, Multi-Agent Pipeline, Text Chunking, Conversion History FullStack Project

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python](https://img.shields.io/badge/Python-3.12+-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-19.2.0-blue?logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9.3-blue?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-7.3.2-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.2.2-38B2AC?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js&logoColor=white)](https://nodejs.org/)

A **full-stack learning and portfolio project** that turns long-form text and blog URLs into downloadable **MP3** audio. You can run everything on your machine: a **FastAPI** backend coordinates multiple text-to-speech (**TTS**) engines, optional **SSE** (Server-Sent Events) streaming for a visible “multi-agent” pipeline, and a **React + TypeScript + Vite** frontend with **Tailwind CSS** for layout and theming. Beginners can start with **zero API keys** using **Edge TTS** or **gTTS**; advanced users can plug in **OpenAI**, **ElevenLabs**, or **Replicate** and compare quality, latency, and cost. The codebase is structured so you can read `main.py` for HTTP contracts and `frontend/src` for UI composition patterns you can reuse elsewhere.

- **Live Demo:** [https://blog-reader-tts.vercel.app/](https://blog-reader-tts.vercel.app/)
- **Backend Live Demo:** [https://blog-audio-backend.arnobmahmud.com](https://blog-audio-backend.arnobmahmud.com)

![Image 1](https://github.com/user-attachments/assets/5fa54496-b3b5-40d9-9a35-43022733f97b)
![Image 2](https://github.com/user-attachments/assets/3a4b492d-d2ee-4d17-94c8-0a861771f886)
![Image 3](https://github.com/user-attachments/assets/19a46233-3a3d-4fa1-959a-a998abfce408)
![Image 4](https://github.com/user-attachments/assets/23d3878b-7d08-4bbd-9f54-40c5a93789f4)
![Image 5](https://github.com/user-attachments/assets/f8f5bbda-e4f7-4128-82d2-2643edf85467)
![Image 6](https://github.com/user-attachments/assets/e1a08f27-2e38-4d8b-96c5-c890f97a0e02)
![Image 7](https://github.com/user-attachments/assets/0accac96-7637-4a65-b667-6b775ec579b5)

## Table of contents

1. [Keywords at a glance](#keywords-at-a-glance)
2. [Provider comparison](#provider-comparison)
3. [Architecture](#architecture)
4. [Features](#features)
5. [Technology stack and dependencies](#technology-stack-and-dependencies)
6. [Project structure](#project-structure)
7. [Frontend routes, pages, and components](#frontend-routes-pages-and-components)
8. [Backend overview](#backend-overview)
9. [API reference](#api-reference)
10. [Environment variables (.env)](#environment-variables-env)
11. [Getting started](#getting-started)
12. [How to run (development)](#how-to-run-development)
13. [Build, preview, and lint](#build-preview-and-lint)
14. [Learner walkthrough](#learner-walkthrough)
15. [Reusing pieces in other projects](#reusing-pieces-in-other-projects)
16. [Code snippets](#code-snippets)
17. [Multi-agent pipeline (SSE)](#multi-agent-pipeline-sse)
18. [Further documentation](#further-documentation)
19. [Conclusion](#conclusion)

---

## Keywords at a glance

| Keyword           | Short meaning in this project                                                                |
| ----------------- | -------------------------------------------------------------------------------------------- |
| **TTS**           | Text-to-speech: synthesizing spoken audio from text.                                         |
| **SSE**           | Server-Sent Events: one-way stream from server to browser (used for pipeline progress).      |
| **FastAPI**       | Modern Python web framework; auto OpenAPI docs at `/docs`.                                   |
| **Vite**          | Fast dev server and bundler for the React frontend.                                          |
| **Chunking**      | Splitting long text into sentence-safe segments, synthesizing each, then merging audio.      |
| **Provider**      | A concrete TTS engine (e.g. Edge TTS, OpenAI) selected by the user.                          |
| **Pipeline mode** | Optional multi-step flow with streamed status updates per “agent” stage.                     |
| **Simple mode**   | Single `POST /api/convert` request returning an MP3 file.                                    |
| **CORS**          | Cross-Origin Resource Sharing; required when the SPA and API are on different origins.       |
| **Sentry**        | Optional error monitoring for the browser (see `frontend/src/sentry.ts` and `.env.example`). |

---

## Provider comparison

| Provider         | Status      | Free Tier         | API Key  | Quality            | Speed Control |
| ---------------- | ----------- | ----------------- | -------- | ------------------ | ------------- |
| **Edge TTS**     | Working     | Unlimited         | No       | Neural (very good) | Yes           |
| **gTTS**         | Working     | Unlimited         | No       | Basic              | No            |
| **ElevenLabs**   | Partial     | 10k credits/mo    | Yes      | Premium            | No            |
| **Hugging Face** | Unavailable | N/A               | Optional | N/A                | No            |
| **Replicate**    | Paid        | Limited free runs | Yes      | High               | No            |
| **OpenAI**       | Paid        | $5 new account    | Yes      | Premium            | Yes           |

> See [docs/API_KEY_LIMITATION_AND_SITUATION.md](docs/API_KEY_LIMITATION_AND_SITUATION.md) for detailed provider status, billing notes, and troubleshooting.

---

## Architecture

```bash
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

**Data flow (mental model):** the browser loads the SPA. For API calls it uses either a **relative** `/api/...` (local dev: Vite **proxies** to `http://localhost:8000`) or an **absolute** origin from `VITE_API_BASE_URL` (typical production: static site on Vercel + API on a VPS). The backend writes temporary files under `audio_files/` and exposes them via `/api/audio/{file_id}`.

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

## Technology stack and dependencies

### Python (`requirements.txt`)

| Package / area                                                 | Role in this project                                  |
| -------------------------------------------------------------- | ----------------------------------------------------- |
| **fastapi**, **uvicorn**                                       | HTTP API, async-capable server.                       |
| **python-dotenv**                                              | Loads `.env` next to `main.py` for API keys and CORS. |
| **python-multipart**, **aiofiles**                             | Form uploads and file streaming for audio.            |
| **requests**, **beautifulsoup4**                               | URL fetch and HTML parsing for `/api/extract-text`.   |
| **edge-tts**, **gTTS**                                         | Free TTS providers (no keys).                         |
| **openai**, **elevenlabs**, **replicate**, **huggingface_hub** | Paid or optional providers.                           |
| **pydub** (+ **audioop-lts** on Python 3.13+)                  | Audio concatenation and format handling.              |

### Frontend (`frontend/package.json`)

| Package                                                    | Role in this project                                                 |
| ---------------------------------------------------------- | -------------------------------------------------------------------- |
| **react**, **react-dom**                                   | UI library (React 19).                                               |
| **react-router-dom**                                       | Client routes: `/`, `/app`, `/health`.                               |
| **typescript**                                             | Static typing for safer refactors.                                   |
| **vite**, **@vitejs/plugin-react**                         | Dev server, HMR, production build.                                   |
| **tailwindcss**, **@tailwindcss/vite**                     | Utility-first styling.                                               |
| **@radix-ui/react-\***                                     | Accessible primitives (tabs, select, dialog, etc.).                  |
| **class-variance-authority**, **clsx**, **tailwind-merge** | Variant styling and conditional `className` merging (`cn()` helper). |
| **framer-motion**                                          | Motion on landing and UI polish.                                     |
| **lucide-react**                                           | Icon set.                                                            |
| **sonner**                                                 | Toast notifications.                                                 |
| **@sentry/react**                                          | Optional client error reporting.                                     |

---

## Project structure

```bash
blog-to-audio/
├── main.py                      # FastAPI: routes, TTS, pipeline, health, monitoring tunnel
├── requirements.txt             # Python dependencies
├── .env.example                 # Backend env template (copy → `.env`)
├── Dockerfile                   # Backend container image
├── package.json                 # Root: `npm run lint` → frontend ESLint
├── README.md                    # This file
├── docs/
│   ├── API_KEY_LIMITATION_AND_SITUATION.md   # Provider matrix & troubleshooting
│   ├── COOLIFY_PUBLIC_BACKEND_GUIDE.md
│   ├── DOCKER_VPS_BACKEND_PLAYBOOK.md
│   ├── Redis_Sentry_PostHog_INTEGRATION_GUIDE.md
│   ├── UI_STYLING_GUIDE.md
│   ├── VERCEL_PRODUCTION_GUARDRAILS.md
│   ├── SAFE_IMAGE_REUSABLE_COMPONENT.md
│   └── RIPPLE_BUTTON_EFFECT.md
└── frontend/
    ├── index.html               # SPA shell + SEO meta
    ├── vite.config.ts           # React plugin, Tailwind, `/api` proxy → :8000
    ├── package.json
    ├── public/                  # favicon, fonts, images, robots.txt
    └── src/
        ├── main.tsx             # React root + Sentry init
        ├── App.tsx              # Router + ErrorBoundary
        ├── sentry.ts            # Sentry browser SDK wiring
        ├── index.css            # Tailwind entry + global utilities
        ├── pages/
        │   ├── IntroPage.tsx    # Landing / portfolio intro
        │   ├── ReaderPage.tsx   # Main TTS tool (tabs, SSE, history)
        │   └── HealthPage.tsx   # Provider health view
        ├── components/
        │   ├── layout/          # RootLayout, Footer, PageBackground, BackendDocLinks
        │   ├── ui/              # Button, Card, Tabs, Select, … (Radix + CVA)
        │   └── audio/           # AudioPlayerWithVisualizer
        ├── hooks/               # usePrefersReducedMotion
        └── lib/                 # utils.ts (`cn`), api-base.ts (`apiUrl`, `getApiBaseUrl`)
```

---

## Frontend routes, pages, and components

| Route         | Page             | Purpose                                                                               |
| ------------- | ---------------- | ------------------------------------------------------------------------------------- |
| **`/`**       | `IntroPage.tsx`  | Portfolio-style landing; links into the app.                                          |
| **`/app`**    | `ReaderPage.tsx` | Full TTS experience: URL/text input, provider selection, simple vs pipeline, history. |
| **`/health`** | `HealthPage.tsx` | Reads backend health / provider status for debugging or demos.                        |
| **`*`**       | redirect → `/`   | Unknown paths fall back to home.                                                      |

**Important files for learners**

- **`frontend/src/lib/api-base.ts`** — Central place for API URLs. In dev, leave `VITE_API_BASE_URL` unset so `fetch('/api/...')` hits the Vite proxy.
- **`frontend/src/pages/ReaderPage.tsx`** — Largest UI module: forms, SSE client, state for provider and audio.
- **`frontend/src/components/ui/*`** — Small, composable pieces (e.g. `Button`, `Tabs`) you can copy into another design system with minimal changes if you keep the same Radix + `cn()` pattern.

---

## Backend overview

- **`FastAPI` app** is created in `main.py` with title **“Blog to Audio API”**.
- **CORS** reads `CORS_ORIGINS` (comma-separated). If unset, it allows `*` (fine for local experiments; tighten for production).
- **Static audio** is stored under `audio_files/` and served through `/api/audio/{file_id}`.
- **Heavy or blocking TTS** work may use `run_in_threadpool` so the event loop stays responsive while still exposing async routes.
- **Interactive docs:** run the backend and open **`/docs`** (Swagger UI) to try every endpoint with forms.

---

## API reference

| Method | Endpoint                 | Description                                                                                               |
| ------ | ------------------------ | --------------------------------------------------------------------------------------------------------- |
| `GET`  | `/api/providers`         | Provider configs with status, badges, and notes.                                                          |
| `GET`  | `/api/provider-health`   | Per-provider health (green / yellow / red).                                                               |
| `GET`  | `/api/voices/{provider}` | Voice list for a provider (optional `api_key` query for key-in-browser flows).                            |
| `GET`  | `/api/sample-texts`      | Built-in sample paragraphs for quick tests.                                                               |
| `GET`  | `/api/health`            | Liveness JSON (useful for uptime checks).                                                                 |
| `GET`  | `/api/audio/{file_id}`   | Download or stream a generated file by id.                                                                |
| `POST` | `/api/extract-text`      | Extract readable text from a blog URL.                                                                    |
| `POST` | `/api/estimate`          | Estimate duration / cost hints before conversion.                                                         |
| `POST` | `/api/convert`           | **Simple mode:** multipart form → MP3 `FileResponse`.                                                     |
| `POST` | `/api/convert-pipeline`  | **Pipeline mode:** `StreamingResponse` (SSE) with staged progress.                                        |
| `POST` | `/api/monitoring`        | **Sentry tunnel** (optional): browser envelopes forwarded to Sentry when configured (see `.env.example`). |

**Simple convert (curl):**

```bash
curl -X POST http://localhost:8000/api/convert \
  -F "text=Hello world" \
  -F "provider=edge-tts" \
  -F "voice=en-US-AriaNeural" \
  --output audio.mp3
```

**Pipeline convert (SSE stream):**

```bash
curl -N -X POST http://localhost:8000/api/convert-pipeline \
  -F "text=Hello world" \
  -F "provider=edge-tts"
```

---

## Environment variables (.env)

You **do not need any `.env` file** to try the project with **Edge TTS** or **gTTS**—those providers use no API keys.

### Backend — copy `.env.example` → `.env` (same folder as `main.py`)

| Variable                    | Required?                 | Purpose                                                                                                                  |
| --------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `OPENAI_API_KEY`            | Only for OpenAI TTS       | From [OpenAI API keys](https://platform.openai.com/api-keys).                                                            |
| `ELEVENLABS_API_KEY`        | Only for ElevenLabs       | From [ElevenLabs settings](https://elevenlabs.io/app/settings).                                                          |
| `REPLICATE_API_TOKEN`       | Only for Replicate        | From [Replicate account tokens](https://replicate.com/account/api-tokens).                                               |
| `HF_API_KEY`                | Optional                  | Hugging Face token; provider currently unavailable for TTS here—safe to skip.                                            |
| `SENTRY_TUNNEL_PROJECT_IDS` | Optional                  | Comma-separated numeric project ids allowed to post to `/api/monitoring`.                                                |
| `CORS_ORIGINS`              | Recommended in production | e.g. `https://blog-reader-tts.vercel.app` — required if the SPA POSTs to your API from another origin (tunnel, fetches). |

### Frontend — copy `frontend/.env.example` → `frontend/.env.local` (optional)

| Variable                                                    | Required?        | Purpose                                                                                                                                         |
| ----------------------------------------------------------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `VITE_API_BASE_URL`                                         | Optional locally | Full API origin **without** trailing slash. **Unset in dev** so Vite proxies `/api` to port 8000. **Set on Vercel** to your public FastAPI URL. |
| `VITE_SENTRY_DSN`                                           | Optional         | Browser DSN from Sentry.                                                                                                                        |
| `VITE_SENTRY_RELEASE` / `VERCEL_GIT_COMMIT_SHA`             | Optional         | Release name for Sentry (Vercel often provides the SHA).                                                                                        |
| `VITE_SENTRY_ENVIRONMENT`, `VITE_SENTRY_TRACES_SAMPLE_RATE` | Optional         | Fine-tuning Sentry behavior.                                                                                                                    |

**How to obtain keys (quick path):** create accounts on the provider sites above, generate a **secret** key, paste into `.env`, restart `uvicorn`. Never commit `.env` or `.env.local`—they are gitignored patterns in normal setups.

---

## Getting started

**Prerequisites:** Python **3.12+**, Node.js **18+**, `pip`, and `npm`.

```bash
git clone https://github.com/arnobt78/blog-to-audio.git
cd blog-to-audio

# Backend dependencies
pip install -r requirements.txt

# Frontend dependencies
cd frontend && npm install && cd ..
```

---

## How to run (development)

**Terminal 1 — backend**

```bash
cd blog-to-audio
uvicorn main:app --reload --port 8000
```

**Terminal 2 — frontend**

```bash
cd blog-to-audio/frontend
npm run dev
```

Open **[http://localhost:5173](http://localhost:5173)**. Navigate to **`/app`** for the reader. API calls use **`/api/...`**, which Vite forwards to **`http://localhost:8000`** (see `frontend/vite.config.ts`).

**Optional:** visit **`http://localhost:8000/docs`** for interactive API documentation.

---

## Build, preview, and lint

```bash
# Production build (frontend)
cd frontend
npm run build
npm run preview    # local preview of dist/

# ESLint
npm run lint       # in frontend/
# or from repo root:
cd ..
npm run lint
```

---

## Learner walkthrough

1. **Start both servers** (backend first is a good habit so `/api` never 502s during page load).
2. Open **`/app`**, choose **Edge TTS**, pick a voice, paste short text, click convert — **no `.env` required**.
3. Open **`/docs`** on the backend and execute the same `POST /api/convert` to see the raw HTTP contract.
4. Toggle **pipeline mode** in the UI and watch **SSE** chunks arrive (the app uses `fetch` + `response.body.getReader()`, not `EventSource`; in DevTools → Network, inspect the `convert-pipeline` request response stream).
5. Try **URL extraction**: paste an article URL and confirm cleaned text appears before synthesis.
6. Add **one** provider key to `.env`, restart uvicorn, and compare **OpenAI** vs **Edge** quality on the same paragraph.
7. Read **`ReaderPage.tsx`** in small chunks: find `fetch` for `/api/convert-pipeline`, follow the `ReadableStream` reader loop, and map each block to an API row in the table above.

---

## Reusing pieces in other projects

| Piece                              | How to reuse                                                                                                                                                                     |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`apiUrl()` / `getApiBaseUrl()`** | Copy `frontend/src/lib/api-base.ts` into any Vite + React app that talks to a separate API; set `VITE_API_BASE_URL` in production.                                               |
| **`cn()` helper**                  | Copy `frontend/src/lib/utils.ts` pattern (`clsx` + `tailwind-merge`) for conflict-free Tailwind classes.                                                                         |
| **UI primitives**                  | `components/ui/button.tsx`, `card.tsx`, etc. follow shadcn-style APIs—port them with Radix installed and your theme tokens.                                                      |
| **FastAPI patterns**               | Provider abstraction, `StreamingResponse` for SSE, and `FileResponse` for downloads are self-contained in `main.py`—split into routers/modules if you fork for a larger service. |
| **Dockerfile**                     | Use as-is or extend for Coolify / VPS deploys (see `docs/DOCKER_VPS_BACKEND_PLAYBOOK.md`).                                                                                       |

---

## Code snippets

**Call the API from React (uses proxy in dev):**

```ts
import { apiUrl } from "@/lib/api-base";

const res = await fetch(apiUrl("/api/providers"));
const providers = await res.json();
```

**Minimal Python client (simple convert):**

```python
import requests

r = requests.post(
    "http://localhost:8000/api/convert",
    data={"text": "Hello from Python", "provider": "edge-tts", "voice": "en-US-AriaNeural"},
)
open("out.mp3", "wb").write(r.content)
```

---

## Multi-agent pipeline (SSE)

The pipeline mode processes text through **seven** stages (each can emit SSE events for the UI):

1. **Extractor** — Resolves URL or validates pasted text.
2. **Analyzer** — Language / length / rough duration estimates.
3. **Preprocessor** — Cleans noise, prepares chunks.
4. **Optimizer** — Picks provider parameters and chunk strategy.
5. **Synthesizer** — Calls TTS per chunk with retries where applicable.
6. **Validator** — Sanity-checks generated audio.
7. **Assembler** — Concatenates chunks (with small gaps if configured) into one MP3.

The frontend shows a **stepper** driven by these events so learners can see how **async workflows** are modeled as a state machine.

---

## Further documentation

| Document                                                                                         | Topic                      |
| ------------------------------------------------------------------------------------------------ | -------------------------- |
| [docs/API_KEY_LIMITATION_AND_SITUATION.md](docs/API_KEY_LIMITATION_AND_SITUATION.md)             | Providers, billing, errors |
| [docs/DOCKER_VPS_BACKEND_PLAYBOOK.md](docs/DOCKER_VPS_BACKEND_PLAYBOOK.md)                       | Docker / VPS deployment    |
| [docs/COOLIFY_PUBLIC_BACKEND_GUIDE.md](docs/COOLIFY_PUBLIC_BACKEND_GUIDE.md)                     | Coolify + public API       |
| [docs/VERCEL_PRODUCTION_GUARDRAILS.md](docs/VERCEL_PRODUCTION_GUARDRAILS.md)                     | Frontend production notes  |
| [docs/Redis_Sentry_PostHog_INTEGRATION_GUIDE.md](docs/Redis_Sentry_PostHog_INTEGRATION_GUIDE.md) | Observability integrations |
| [docs/UI_STYLING_GUIDE.md](docs/UI_STYLING_GUIDE.md)                                             | Styling conventions        |

---

## Conclusion

**Blog-to-audio** is a practical bridge between **web scraping**, **REST + streaming APIs**, and **audio ML services**. Working through it teaches how to combine **React** state management with **long-running server tasks**, how to design **multipart** and **SSE** endpoints in **FastAPI**, and how to offer **progressive enhancement**: free providers by default, paid providers when keys exist. Use the live demos as reference behavior, then fork and simplify (e.g. strip pipeline mode) if you want a smaller codebase for teaching.

---

## License

This project is licensed under the [MIT License](https://opensource.org/licenses/MIT). Feel free to use, modify, and distribute the code as per the terms of the license.

## Happy Coding! 🎉

This is an **open-source project** - feel free to use, enhance, and extend this project further!

If you have any questions or want to share your work, reach out via GitHub or my portfolio at [https://www.arnobmahmud.com](https://www.arnobmahmud.com).

**Enjoy building and learning!** 🚀

Thank you! 😊

---
