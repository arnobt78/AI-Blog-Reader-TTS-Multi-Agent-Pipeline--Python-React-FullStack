# AI Blog Reader | Convert Blogs & Text to Speech Online - React, Python, FastAPI, TypeScript FullStack Project

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python](https://img.shields.io/badge/Python-3.12+-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-19.2-blue?logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-7.2-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.1-38B2AC?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)

Turn blog posts and text into natural-sounding audio. Paste a URL or text, choose from **Edge TTS** (free), **ElevenLabs**, **Hugging Face**, **Replicate**, or **OpenAI TTS**, and download the MP3. Built for learning and reuse.

**Author:** [Arnob Mahmud](https://www.arnobmahmud.com) · **Contact:** [contact@arnobmahmud.com](mailto:contact@arnobmahmud.com)

---

## Table of Contents

- [Project Overview](#project-overview)
- [Features & Functionality](#features--functionality)
- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables (.env)](#environment-variables-env)
- [How to Run](#how-to-run)
- [API Reference](#api-reference)
- [Frontend Components & Reuse](#frontend-components--reuse)
- [Backend Walkthrough](#backend-walkthrough)
- [Deployment](#deployment)
- [Keywords](#keywords)
- [Conclusion](#conclusion)
- [License](#license)

---

## Project Overview

**AI Blog Reader** is a full-stack app that:

1. **Accepts input** — A blog URL (from which it extracts text) or pasted text.
2. **Converts to speech** — Uses one of several TTS providers (free and paid).
3. **Returns audio** — MP3 file for playback and download.

The backend is a single-file **FastAPI** app; the frontend is a **React + TypeScript + Vite** SPA with **Tailwind CSS** and **shadcn-style** UI. No database; the app is stateless except for temporary audio files on disk.

---

## Features & Functionality

| Feature                    | Description                                                             |
| -------------------------- | ----------------------------------------------------------------------- |
| **Dual input**             | Paste text or enter a blog URL and extract article content.             |
| **Multiple TTS providers** | Edge TTS (free), ElevenLabs, Hugging Face, Replicate, OpenAI TTS.       |
| **Voice selection**        | Per-provider voice/model dropdown (e.g. Aria, Nova, Rachel).            |
| **Speed control**          | Speech rate (0.5x–2x) for providers that support it (Edge TTS, OpenAI). |
| **Character limits**       | Per-provider limits with on-screen count and warning.                   |
| **Estimated duration**     | Approximate audio length from word count and speed.                     |
| **Sample texts**           | Predefined samples to try TTS without pasting content.                  |
| **Dark mode**              | Toggle with persistence in `localStorage`.                              |
| **Error handling**         | User-friendly messages (rate limit, invalid key, billing, etc.).        |
| **Download**               | Save generated MP3 from the in-app player.                              |

---

## Technology Stack

| Layer        | Technology                                                                    |
| ------------ | ----------------------------------------------------------------------------- |
| **Backend**  | Python 3.12, FastAPI, Uvicorn                                                 |
| **TTS**      | edge-tts, OpenAI SDK, ElevenLabs SDK, Replicate SDK, Hugging Face Inference   |
| **Scraping** | requests, BeautifulSoup4                                                      |
| **Frontend** | React 19, TypeScript 5.9, Vite 7                                              |
| **Styling**  | Tailwind CSS 4, Radix UI primitives (Select, Tabs, Label, etc.), Lucide icons |
| **Dev**      | Vite dev server with proxy to backend on port 8000                            |

---

## Project Structure

```bash
blog-to-audio/
├── main.py                 # FastAPI app: routes, TTS logic, text extraction
├── requirements.txt        # Python dependencies
├── .env.example            # Template for environment variables
├── .env                    # Your secrets (never commit; see .gitignore)
├── Dockerfile              # Backend image for Coolify (port 3000)
├── .dockerignore           # Excludes frontend/, .env, __pycache__, etc.
├── DEPLOYMENT.md           # Coolify + Vercel deployment notes
├── audio_files/            # Generated MP3s (created at runtime; in .gitignore)
├── frontend/
│   ├── index.html          # Entry HTML; SEO meta tags
│   ├── package.json        # Node dependencies (React, Vite, Tailwind, Radix)
│   ├── vite.config.ts      # Vite config; /api proxy to localhost:8000
│   ├── tsconfig.*.json     # TypeScript config
│   ├── public/
│   │   └── vite.svg        # Favicon
│   └── src/
│       ├── main.tsx        # React entry; mounts App into #root
│       ├── App.tsx         # Main UI: tabs, forms, provider/voice, convert, player
│       ├── index.css       # Tailwind + theme variables (light/dark)
│       ├── lib/
│       │   └── utils.ts    # cn() for class names (clsx + tailwind-merge)
│       └── components/
│           └── ui/         # Reusable UI: Button, Card, Input, Label, Select, Tabs, Slider
│               ├── button.tsx
│               ├── card.tsx
│               ├── input.tsx
│               ├── label.tsx
│               ├── select.tsx
│               ├── tabs.tsx
│               ├── textarea.tsx
│               └── slider.tsx
├── LICENSE                 # MIT
└── README.md               # This file
```

---

## Getting Started

**Prerequisites:**

- **Python 3.12+** (backend)
- **Node.js 18+** and **npm** (frontend)

**Clone and install:**

```bash
git clone https://github.com/arnobt78/blog-to-audio.git
cd blog-to-audio
```

**Backend:**

```bash
pip install -r requirements.txt
```

**Frontend:**

```bash
cd frontend
npm install
```

**Environment:** Copy `.env.example` to `.env` and fill in the keys you need (see [Environment Variables](#environment-variables-env)).

---

## Environment Variables (.env)

Create a `.env` file in the **project root** (same folder as `main.py`). Use `.env.example` as a template.

| Variable              | Required                | Description         | Where to get it                                                                                 |
| --------------------- | ----------------------- | ------------------- | ----------------------------------------------------------------------------------------------- |
| `OPENAI_API_KEY`      | For OpenAI TTS          | OpenAI API key      | [platform.openai.com/api-keys](https://platform.openai.com/api-keys)                            |
| `ELEVENLABS_API_KEY`  | For ElevenLabs          | ElevenLabs API key  | [elevenlabs.io/app/settings](https://elevenlabs.io/app/settings) (free tier available)          |
| `REPLICATE_API_TOKEN` | For Replicate           | Replicate API token | [replicate.com/account/api-tokens](https://replicate.com/account/api-tokens) (billing required) |
| `HF_API_KEY`          | Optional (Hugging Face) | Hugging Face token  | [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens)                        |

**Notes:**

- **Edge TTS** does not need any key; it works without `.env`.
- You only need to set the variables for the providers you use.
- Never commit `.env`; it is listed in `.gitignore`. Commit `.env.example` only (with placeholders).

**Example `.env`:**

```env
# Blog-to-Audio — API Keys (do not commit this file)

OPENAI_API_KEY=sk-proj-...
ELEVENLABS_API_KEY=sk_...
REPLICATE_API_TOKEN=r8_...
HF_API_KEY=hf_...
```

---

## How to Run

**1. Backend (from project root):**

```bash
uvicorn main:app --reload --port 8000
```

API: [http://localhost:8000](http://localhost:8000). Optional: [http://localhost:8000/docs](http://localhost:8000/docs) for Swagger.

**2. Frontend (in another terminal):**

```bash
cd frontend
npm run dev
```

App: [http://localhost:5173](http://localhost:5173). All `/api/*` requests are proxied to `http://localhost:8000` by Vite.

**3. Use the app:**

- Open [http://localhost:5173](http://localhost:5173).
- Choose **Paste Text** or **Blog URL**; if URL, click **Extract** to load text.
- Select **AI Provider** (e.g. Edge TTS for no key) and **Voice**.
- Optionally adjust **Speed** (for supported providers).
- Click **Generate Audio**, then play or **Download** the MP3.

---

## API Reference

Base URL: `http://localhost:8000` (or your deployed backend).

| Method | Endpoint            | Description                                                                       |
| ------ | ------------------- | --------------------------------------------------------------------------------- |
| `GET`  | `/api/providers`    | List TTS providers and their config (voices, limits, speed support).              |
| `GET`  | `/api/sample-texts` | Predefined sample texts for quick testing.                                        |
| `GET`  | `/api/health`       | Liveness check; returns `{"status":"ok"}`.                                        |
| `POST` | `/api/extract-text` | Form: `url`. Returns extracted text plus word count and estimated duration.       |
| `POST` | `/api/estimate`     | Form: `text`, `speed` (optional). Returns estimated duration.                     |
| `POST` | `/api/convert`      | Form: `text`, `provider`, `voice`, `speed`, optional `api_key`. Returns MP3 file. |

**Example: convert to speech (curl):**

```bash
curl -X POST http://localhost:8000/api/convert \
  -F "text=Hello, this is a test." \
  -F "provider=edge-tts" \
  -F "voice=en-US-AriaNeural" \
  -F "speed=1.0" \
  --output audio.mp3
```

**Example: extract text from URL (curl):**

```bash
curl -X POST http://localhost:8000/api/extract-text \
  -F "url=https://example.com/blog-post"
```

---

## Frontend Components & Reuse

The UI is built from **Radix UI** primitives and a small **Tailwind** layer. You can reuse these in other React + TypeScript + Tailwind projects.

**Location:** `frontend/src/components/ui/`

| Component                                                               | Purpose                                               | Reuse                                                                |
| ----------------------------------------------------------------------- | ----------------------------------------------------- | -------------------------------------------------------------------- |
| `Button`                                                                | Buttons with variants (default, outline, ghost, etc.) | Use `@/components/ui/button` and pass `variant`, `size`.             |
| `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`     | Content sections                                      | Compose for panels and feature blocks.                               |
| `Input`                                                                 | Text/URL input                                        | Controlled with `value` and `onChange`.                              |
| `Textarea`                                                              | Multi-line text                                       | Same pattern as Input.                                               |
| `Label`                                                                 | Accessible labels                                     | Pair with Input/Select via `htmlFor` / `id`.                         |
| `Select`, `SelectTrigger`, `SelectValue`, `SelectContent`, `SelectItem` | Dropdowns                                             | Use for provider/voice selection.                                    |
| `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`                        | Tabbed UI                                             | For “Paste Text” vs “Blog URL”.                                      |
| `Slider`                                                                | Range input (e.g. speed)                              | Use for 0.5–2.0 with `min`, `max`, `step`, `value`, `onValueChange`. |

**Helper:** `frontend/src/lib/utils.ts` exports `cn(...inputs)` (clsx + tailwind-merge) for conditional class names. Use it when building your own components:

```ts
import { cn } from '@/lib/utils'
<div className={cn('base-classes', isActive && 'active-class')} />
```

**Using the same stack elsewhere:** Copy `frontend/src/components/ui/*` and `lib/utils.ts`, ensure Tailwind and Radix are installed, and import components where needed. The app does not depend on project-specific logic inside these UI files.

---

## Backend Walkthrough

**File:** `main.py`

- **Imports & app:** FastAPI app, CORS for frontend, `load_dotenv()`, creation of `audio_files/`.
- **ERROR_MESSAGES / get_friendly_error:** Maps HTTP codes to user-facing title/message/suggestion for the frontend.
- **TTS config:** `EDGE_TTS_VOICES`, `ELEVENLABS_VOICES`, `OPENAI_VOICES`, `HUGGINGFACE_MODELS`, `REPLICATE_MODELS`, and **TTS_PROVIDERS** (single source of truth for provider id, name, voices, limits, speed support).
- **Helpers:**
  - `extract_text_from_url(url)` — GET URL, BeautifulSoup, strip script/nav/footer, get article/main/body and `<p>` text.
  - `estimate_duration(text, speed)` — Approximate duration from word count and speed (e.g. 150 wpm).
- **TTS implementations:**
  - `text_to_audio_edge` — edge-tts (async), supports speed.
  - `text_to_audio_huggingface` — Hugging Face InferenceClient `text_to_speech` (async).
  - `text_to_audio_openai` — OpenAI `audio.speech.create` (sync).
  - `text_to_audio_elevenlabs` — ElevenLabs client, stream to file (sync).
  - `text_to_audio_replicate` — Replicate StyleTTS2, download audio URL to file (sync).
- **Routes:** `/api/providers`, `/api/sample-texts`, `/api/health`, `/api/extract-text`, `/api/estimate`, `/api/convert`.  
  `/api/convert` validates provider and length, picks default voice if needed, generates a unique file id, calls the right TTS function, and returns `FileResponse` with the MP3.
- **Static:** If `frontend/dist` exists, it is mounted at `/` so the same server can serve the built React app.

You can reuse this structure in another FastAPI project: keep the same provider config shape and route layout, and swap or add TTS backends by adding new entries to `TTS_PROVIDERS` and new branches in `/api/convert`.

---

## Deployment

- **Backend:** Deploy the root of the repo (where `main.py` and `Dockerfile` live) to **Coolify** (e.g. on a Hetzner VPS). Container port **3000**; mapping e.g. **5005:3000**. Set `PORT=3000` and API keys in Coolify env. See **DEPLOYMENT.md** and **SUBDOMAIN_ARNOBMAHMUD_SETUP.md** for subdomain and Traefik.
- **Frontend:** Deploy the **frontend** folder to **Vercel** (root directory: `frontend`, build: `npm run build`, output: `dist`). In production, either proxy `/api` to your backend or set `VITE_API_BASE_URL` and use it in `fetch` so the app calls your Coolify backend.

Details (Coolify port, healthcheck, env, Vercel options) are in **DEPLOYMENT.md**.

---

## Keywords

blog to audio, text to speech, TTS, convert blog to audio, read aloud, speech synthesis, Edge TTS, ElevenLabs, OpenAI TTS, Hugging Face TTS, Replicate, FastAPI, React, Vite, TypeScript, Tailwind CSS, MP3, accessibility, AI voices, arnob mahmud

---

## Conclusion

**AI Blog Reader** is a small, full-stack example of multi-provider TTS: FastAPI backend, React frontend, and clear separation between config, helpers, and routes. You can use it as a reference for:

- Multi-provider TTS with a single API surface
- Form-based file generation and download
- React + TypeScript + Vite + Tailwind + Radix UI
- Env-based API keys and optional providers
- Docker and deployment (Coolify + Vercel)

Extend it by adding more providers (new entries in `TTS_PROVIDERS` and new TTS functions), or reuse the UI components and API shape in your own projects.

---

## License

This project is licensed under the [MIT License](https://opensource.org/licenses/MIT). Feel free to use, modify, and distribute the code as per the terms of the license.

## Happy Coding! 🎉

This is an **open-source project** — feel free to use, enhance, and extend this project further!

If you have any questions or want to share your work, reach out via GitHub or my portfolio at [https://www.arnobmahmud.com](https://www.arnobmahmud.com).

**Enjoy building and learning!** 🚀
