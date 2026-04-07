"""
Blog-to-Audio API — FastAPI backend.
Multi-provider TTS with multi-agent pipeline, text chunking,
provider health checks, and dynamic voice loading.
"""
import json
import re
import time
import requests
from bs4 import BeautifulSoup
from fastapi import FastAPI, Form, HTTPException, Query
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import uuid
import os
import asyncio
import edge_tts
from pathlib import Path
from typing import Optional
import aiofiles
from dotenv import load_dotenv

_ROOT = Path(__file__).resolve().parent
load_dotenv(_ROOT / ".env")


def _resolved_api_key(form_value: Optional[str], env_name: str) -> Optional[str]:
    raw = (form_value or os.getenv(env_name) or "").strip()
    return raw or None


app = FastAPI(title="Blog to Audio API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

AUDIO_DIR = "audio_files"
os.makedirs(AUDIO_DIR, exist_ok=True)

# ============== Error Helpers ==============

ERROR_MESSAGES = {
    429: {"title": "Too Many Requests", "message": "You've hit the rate limit.", "suggestion": "Wait a moment or try a different provider."},
    500: {"title": "Service Error", "message": "The AI service encountered an error.", "suggestion": "Please try again or switch provider."},
    503: {"title": "Service Unavailable", "message": "The AI service is currently unavailable.", "suggestion": "Please try again in a moment."},
    401: {"title": "Invalid API Key", "message": "Your API key is invalid or expired.", "suggestion": "Check your API key and try again."},
    403: {"title": "Access Denied", "message": "Your API key doesn't have access.", "suggestion": "Check your API key permissions."},
    402: {"title": "Paid plan required", "message": "This provider needs a paid subscription.", "suggestion": "Upgrade or use Edge TTS / gTTS (free)."},
}


def _elevenlabs_api_error_message(err: Exception) -> str:
    body = getattr(err, "body", None)
    if isinstance(body, dict):
        detail = body.get("detail")
        if isinstance(detail, dict):
            return str(detail.get("message") or detail.get("code") or "") or str(detail)
        if isinstance(detail, str):
            return detail
    return str(err)


def get_friendly_error(status_code: int, provider: str, raw_error: str = "") -> dict:
    if status_code in ERROR_MESSAGES:
        info = ERROR_MESSAGES[status_code]
        return {"error": True, "title": info["title"], "message": f"{info['message']} ({provider})", "suggestion": info["suggestion"], "status_code": status_code, "provider": provider}
    return {"error": True, "title": "Something Went Wrong", "message": f"An error occurred with {provider}.", "suggestion": "Please try again or use a different provider.", "status_code": status_code, "provider": provider, "details": raw_error[:300] if raw_error else None}


# ============== Provider Voice Configs ==============

EDGE_TTS_VOICES = {
    "en-US-AriaNeural": "Aria (Female, US)",
    "en-US-GuyNeural": "Guy (Male, US)",
    "en-US-JennyNeural": "Jenny (Female, US)",
    "en-GB-SoniaNeural": "Sonia (Female, UK)",
    "en-GB-RyanNeural": "Ryan (Male, UK)",
}

GTTS_VOICES = {
    "en": "English",
    "en-us": "English (US)",
    "en-uk": "English (UK)",
    "en-au": "English (Australia)",
    "fr": "French",
    "de": "German",
    "es": "Spanish",
    "pt": "Portuguese",
    "it": "Italian",
    "ja": "Japanese",
    "ko": "Korean",
    "zh-CN": "Chinese (Simplified)",
    "hi": "Hindi",
    "ar": "Arabic",
    "ru": "Russian",
}

ELEVENLABS_VOICES = {
    "21m00Tcm4TlvDq8ikWAM": "Rachel (Female, Calm)",
    "AZnzlk1XvdvUeBnXmlld": "Domi (Female, Strong)",
    "EXAVITQu4vr4xnSDxMaL": "Bella (Female, Soft)",
    "ErXwobaYiN019PkySvjV": "Antoni (Male, Well-Rounded)",
    "MF3mGyEYCl7XYWbV9V6O": "Elli (Female, Young)",
    "TxGEqnHWrfWFTfGW9XjX": "Josh (Male, Young)",
    "VR6AewLTigWG4xSOukaG": "Arnold (Male, Crisp)",
    "pNInz6obpgDQGcFmaJgB": "Adam (Male, Deep)",
    "yoZ06aMxZJJ28mfd3POQ": "Sam (Male, Raspy)",
}

OPENAI_VOICES = {
    "alloy": "Alloy (Neutral)",
    "echo": "Echo (Male)",
    "fable": "Fable (British)",
    "onyx": "Onyx (Deep Male)",
    "nova": "Nova (Female)",
    "shimmer": "Shimmer (Soft Female)",
}

OPENAI_MODELS = {
    "tts-1": "TTS Standard ($15/1M chars)",
    "tts-1-hd": "TTS HD ($30/1M chars)",
    "gpt-4o-mini-tts": "GPT-4o Mini TTS (newest)",
}

HUGGINGFACE_MODELS = {
    "espnet/kan-bayashi_ljspeech_vits": "ESPnet VITS (LJSpeech)",
    "microsoft/speecht5_tts": "Microsoft SpeechT5",
    "facebook/fastspeech2-en-ljspeech": "Facebook FastSpeech2",
    "suno/bark-small": "Suno Bark (Small)",
    "facebook/mms-tts-eng": "Facebook MMS (English)",
}

HUGGINGFACE_FALLBACK_MODELS: list[str] = list(HUGGINGFACE_MODELS.keys())

REPLICATE_MODELS = {
    "adirik/styletts2": "StyleTTS2 (Fast & Natural)",
    "ttsds/openvoice_2": "OpenVoice 2 (~$0.002/run)",
    "minimax/speech-2.6-turbo": "MiniMax Speech 2.6 Turbo",
}

# ============== Provider Status Metadata ==============

PROVIDER_STATUS = {
    "edge-tts": {"status": "working", "badge": "FREE", "badge_color": "green", "note": "Microsoft neural TTS. Free, no API key needed. Always works."},
    "gtts": {"status": "working", "badge": "FREE", "badge_color": "green", "note": "Google Translate TTS. Free, no API key. Basic quality but 100% reliable."},
    "elevenlabs": {"status": "partial", "badge": "FREEMIUM", "badge_color": "pink", "note": "Free tier: 10k credits/month. Some voices may require paid plan. Uses Flash model for free tier."},
    "huggingface": {"status": "unavailable", "badge": "UNAVAILABLE", "badge_color": "red", "note": "Hub lists zero TTS models on hf-inference provider (April 2026). All calls return 404. This is a HuggingFace platform limitation."},
    "replicate": {"status": "paid", "badge": "PAID", "badge_color": "orange", "note": "Requires billing. ~$0.002-0.01 per generation after limited free runs."},
    "openai": {"status": "paid", "badge": "PAID", "badge_color": "blue", "note": "$5 free credits for new accounts. tts-1: $15/1M chars."},
}

# ============== TTS_PROVIDERS (single source of truth for frontend) ==============

TTS_PROVIDERS = {
    "edge-tts": {
        "name": "Edge TTS (Free)",
        "description": "Microsoft neural TTS - Free, no API key needed. Always works.",
        "requires_api_key": False,
        "voices": EDGE_TTS_VOICES,
        "default_voice": "en-US-AriaNeural",
        "max_chars": 100000,
        "supports_speed": True,
        "is_ai": False,
        **PROVIDER_STATUS["edge-tts"],
    },
    "gtts": {
        "name": "Google TTS (Free)",
        "description": "Google Translate TTS - Free, no API key. Basic quality, 100% reliable.",
        "requires_api_key": False,
        "voices": GTTS_VOICES,
        "default_voice": "en",
        "max_chars": 50000,
        "supports_speed": False,
        "is_ai": False,
        **PROVIDER_STATUS["gtts"],
    },
    "elevenlabs": {
        "name": "ElevenLabs",
        "description": "Premium AI voices. Free tier: 10k credits/month with Flash model. Some voices may need paid plan.",
        "requires_api_key": True,
        "voices": ELEVENLABS_VOICES,
        "default_voice": "21m00Tcm4TlvDq8ikWAM",
        "max_chars": 5000,
        "supports_speed": False,
        "is_ai": True,
        **PROVIDER_STATUS["elevenlabs"],
    },
    "huggingface": {
        "name": "Hugging Face",
        "description": "Hub hf-inference router. Currently lists zero TTS models (April 2026). All calls 404. Platform limitation.",
        "requires_api_key": False,
        "voices": HUGGINGFACE_MODELS,
        "default_voice": "espnet/kan-bayashi_ljspeech_vits",
        "max_chars": 2000,
        "supports_speed": False,
        "is_ai": True,
        **PROVIDER_STATUS["huggingface"],
    },
    "replicate": {
        "name": "Replicate",
        "description": "High-quality AI TTS. Requires billing (~$0.002-0.01/run). Multiple model options.",
        "requires_api_key": True,
        "voices": REPLICATE_MODELS,
        "default_voice": "adirik/styletts2",
        "max_chars": 5000,
        "supports_speed": False,
        "is_ai": True,
        **PROVIDER_STATUS["replicate"],
    },
    "openai": {
        "name": "OpenAI TTS",
        "description": "High-quality AI voices. $5 free credits for new accounts. Multiple models available.",
        "requires_api_key": True,
        "voices": OPENAI_VOICES,
        "default_voice": "nova",
        "max_chars": 4096,
        "supports_speed": True,
        "is_ai": True,
        "models": OPENAI_MODELS,
        **PROVIDER_STATUS["openai"],
    },
}


# ============== Helper Functions ==============

def extract_text_from_url(url: str) -> str:
    headers = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"}
    response = requests.get(url, timeout=15, headers=headers)
    response.raise_for_status()
    soup = BeautifulSoup(response.text, "html.parser")
    for element in soup(["script", "style", "nav", "footer", "header", "aside"]):
        element.decompose()
    main_content = soup.find("article") or soup.find("main") or soup.find("body")
    paragraphs = (main_content or soup).find_all("p")
    return " ".join(p.get_text(strip=True) for p in paragraphs if p.get_text(strip=True))


def estimate_duration(text: str, speed: float = 1.0) -> dict:
    words = len(text.split())
    chars = len(text)
    duration_seconds = int((words / (150 * speed)) * 60)
    return {"words": words, "characters": chars, "estimated_seconds": duration_seconds, "formatted": f"{duration_seconds // 60}:{duration_seconds % 60:02d}"}


def _split_into_chunks(text: str, max_chars: int) -> list[str]:
    """Split text at sentence boundaries respecting max_chars per chunk."""
    if len(text) <= max_chars:
        return [text]
    sentences = re.split(r'(?<=[.!?])\s+', text)
    chunks: list[str] = []
    current = ""
    for sent in sentences:
        if len(current) + len(sent) + 1 <= max_chars:
            current = f"{current} {sent}".strip() if current else sent
        else:
            if current:
                chunks.append(current)
            if len(sent) > max_chars:
                for i in range(0, len(sent), max_chars):
                    chunks.append(sent[i:i + max_chars])
                current = ""
            else:
                current = sent
    if current:
        chunks.append(current)
    return chunks or [text]


def _concat_audio_files(paths: list[str], output_path: str, silence_ms: int = 400):
    """Concatenate MP3 files with optional silence between them."""
    try:
        from pydub import AudioSegment
        combined = AudioSegment.empty()
        silence = AudioSegment.silent(duration=silence_ms)
        for i, p in enumerate(paths):
            seg = AudioSegment.from_file(p)
            if i > 0:
                combined += silence
            combined += seg
        combined.export(output_path, format="mp3")
    except Exception:
        with open(output_path, "wb") as out:
            for p in paths:
                with open(p, "rb") as f:
                    out.write(f.read())


# ============== TTS Implementations ==============

async def text_to_audio_edge(text: str, output_path: str, voice: str = "en-US-AriaNeural", speed: float = 1.0):
    try:
        rate_percent = int((speed - 1.0) * 100)
        rate_str = f"+{rate_percent}%" if rate_percent >= 0 else f"{rate_percent}%"
        communicate = edge_tts.Communicate(text, voice, rate=rate_str)
        await communicate.save(output_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=get_friendly_error(500, "Edge TTS", str(e)))


def text_to_audio_gtts(text: str, output_path: str, lang: str = "en"):
    """gTTS: Google Translate TTS. Free, no key. Basic quality."""
    from gtts import gTTS
    try:
        tld = "com"
        if lang.startswith("en-"):
            suffix = lang.split("-", 1)[1].lower()
            tld_map = {"us": "com", "uk": "co.uk", "au": "com.au"}
            tld = tld_map.get(suffix, "com")
            lang = "en"
        tts = gTTS(text=text, lang=lang, tld=tld)
        tts.save(output_path)
    except Exception as e:
        error_str = str(e).lower()
        if "429" in error_str or "too many" in error_str:
            raise HTTPException(status_code=429, detail={"error": True, "title": "Rate Limited", "message": "Google TTS rate limit hit.", "suggestion": "Wait a moment or use Edge TTS.", "status_code": 429, "provider": "gTTS"})
        raise HTTPException(status_code=500, detail=get_friendly_error(500, "gTTS", str(e)))


async def text_to_audio_huggingface(text: str, output_path: str, model: str = "espnet/kan-bayashi_ljspeech_vits", api_key: Optional[str] = None):
    from huggingface_hub import InferenceClient
    from huggingface_hub.errors import HfHubHTTPError, InferenceTimeoutError

    hf_token = _resolved_api_key(api_key, "HF_API_KEY")
    seen: set[str] = set()
    models_to_try = []
    for m in [model, *HUGGINGFACE_FALLBACK_MODELS]:
        if m not in seen:
            seen.add(m)
            models_to_try.append(m)

    last_error: Optional[BaseException] = None
    tried: list[str] = []
    client = InferenceClient(token=hf_token, timeout=120, provider="hf-inference")

    for mid in models_to_try:
        tried.append(mid)
        max_c = 200 if "bark" in mid.lower() else 2000
        chunk = text[:max_c]
        print(f"[HuggingFace] Trying: {mid}, len={len(chunk)}")
        try:
            audio_bytes = client.text_to_speech(chunk, model=mid)
            if not audio_bytes or len(audio_bytes) < 100:
                raise ValueError("Empty audio")
            async with aiofiles.open(output_path, "wb") as f:
                await f.write(audio_bytes)
            print(f"[HuggingFace] OK: {mid}")
            return
        except Exception as e:
            last_error = e
            print(f"[HuggingFace] {mid} failed: {type(e).__name__}: {e}")
            st = getattr(getattr(e, "response", None), "status_code", None)
            if st in (401, 403, 429):
                break
            if isinstance(e, StopIteration) or st in (404, 410, 503) or isinstance(e, (InferenceTimeoutError, TimeoutError)):
                continue
            s = str(e).lower()
            if "not supported" in s or "empty" in s:
                continue
            break

    models_str = ", ".join(tried)
    raise HTTPException(status_code=404, detail={
        "error": True,
        "title": "Hugging Face: no TTS on hf-inference",
        "message": f"All models returned errors. Tried: {models_str}. The hf-inference provider currently lists zero TTS models.",
        "suggestion": "This is a HuggingFace platform limitation. Use Edge TTS or gTTS for free TTS.",
        "status_code": 404,
        "provider": "Hugging Face",
    })


def text_to_audio_openai(text: str, output_path: str, voice: str = "nova", api_key: Optional[str] = None, speed: float = 1.0, model: str = "tts-1"):
    from openai import OpenAI, APIError, RateLimitError, AuthenticationError

    openai_key = _resolved_api_key(api_key, "OPENAI_API_KEY")
    if not openai_key:
        raise HTTPException(status_code=401, detail={"error": True, "title": "API Key Required", "message": "OpenAI TTS requires an API key.", "suggestion": "Get from platform.openai.com. New accounts get $5 free credits.", "status_code": 401, "provider": "OpenAI"})

    if model not in OPENAI_MODELS:
        model = "tts-1"

    try:
        client = OpenAI(api_key=openai_key)
        response = client.audio.speech.create(model=model, voice=voice, input=text, speed=speed)
        with open(output_path, "wb") as f:
            f.write(response.content)
    except AuthenticationError:
        raise HTTPException(status_code=401, detail={"error": True, "title": "Invalid API Key", "message": "Your OpenAI API key is invalid or expired.", "suggestion": "Generate a new key at platform.openai.com", "status_code": 401, "provider": "OpenAI"})
    except RateLimitError:
        raise HTTPException(status_code=429, detail={"error": True, "title": "Rate Limit / Quota", "message": "OpenAI quota exceeded.", "suggestion": "Check usage at platform.openai.com/usage or add credits.", "status_code": 429, "provider": "OpenAI"})
    except APIError as e:
        raise HTTPException(status_code=e.status_code or 500, detail=get_friendly_error(e.status_code or 500, "OpenAI", str(e)))


def text_to_audio_elevenlabs(text: str, output_path: str, voice_id: str = "21m00Tcm4TlvDq8ikWAM", api_key: Optional[str] = None):
    from elevenlabs import ElevenLabs, VoiceSettings
    from elevenlabs.core.api_error import ApiError

    eleven_key = _resolved_api_key(api_key, "ELEVENLABS_API_KEY")
    if not eleven_key:
        raise HTTPException(status_code=401, detail={"error": True, "title": "API Key Required", "message": "ElevenLabs requires an API key.", "suggestion": "Get free key from elevenlabs.io", "status_code": 401, "provider": "ElevenLabs"})

    try:
        client = ElevenLabs(api_key=eleven_key)
        audio_generator = client.text_to_speech.convert(
            voice_id=voice_id,
            text=text,
            model_id="eleven_flash_v2_5",
            voice_settings=VoiceSettings(stability=0.5, similarity_boost=0.75, style=0.0, use_speaker_boost=True),
        )
        with open(output_path, "wb") as f:
            for chunk in audio_generator:
                f.write(chunk)
    except HTTPException:
        raise
    except ApiError as e:
        sc = e.status_code or 500
        api_msg = _elevenlabs_api_error_message(e)
        low = (api_msg + str(getattr(e, "body", ""))).lower()
        if sc == 402 or "paid_plan" in low or "payment_required" in low or "library voice" in low:
            raise HTTPException(status_code=402, detail={"error": True, "title": "ElevenLabs: voice requires paid plan", "message": api_msg or "This voice requires a paid plan.", "suggestion": "Try a different voice from the dropdown, or use the dynamic voice list. Edge TTS and gTTS are free alternatives.", "status_code": 402, "provider": "ElevenLabs"})
        if sc == 401:
            raise HTTPException(status_code=401, detail={"error": True, "title": "Invalid API Key", "message": api_msg or "ElevenLabs API key invalid.", "suggestion": "Check key at elevenlabs.io/app/settings.", "status_code": 401, "provider": "ElevenLabs"})
        if sc == 429:
            raise HTTPException(status_code=429, detail={"error": True, "title": "Quota Exceeded", "message": api_msg or "ElevenLabs credits used up.", "suggestion": "Wait for monthly reset or upgrade. Edge TTS is free.", "status_code": 429, "provider": "ElevenLabs"})
        print(f"[ElevenLabs] ApiError {sc}: {e}", flush=True)
        raise HTTPException(status_code=sc if sc in (400, 403, 404, 422) else 500, detail=get_friendly_error(sc if sc in (400, 403, 404, 422) else 500, "ElevenLabs", api_msg))
    except Exception as e:
        error_str = str(e).lower()
        if any(k in error_str for k in ("unauthorized", "invalid", "authentication", "api key", "401", "403", "forbidden")):
            raise HTTPException(status_code=401, detail={"error": True, "title": "Invalid API Key", "message": "ElevenLabs API key issue.", "suggestion": "Check ELEVENLABS_API_KEY in .env or paste in app.", "status_code": 401, "provider": "ElevenLabs"})
        if any(k in error_str for k in ("quota", "limit", "429")):
            raise HTTPException(status_code=429, detail={"error": True, "title": "Quota Exceeded", "message": "ElevenLabs credits used up.", "suggestion": "Wait for reset or use Edge TTS.", "status_code": 429, "provider": "ElevenLabs"})
        print(f"[ElevenLabs] {type(e).__name__}: {e}", flush=True)
        raise HTTPException(status_code=500, detail=get_friendly_error(500, "ElevenLabs", str(e)))


def text_to_audio_replicate(text: str, output_path: str, model: str = "adirik/styletts2", api_key: Optional[str] = None):
    import replicate

    replicate_key = _resolved_api_key(api_key, "REPLICATE_API_TOKEN")
    if not replicate_key:
        raise HTTPException(status_code=401, detail={"error": True, "title": "API Key Required", "message": "Replicate requires an API token.", "suggestion": "Get token from replicate.com/account/api-tokens", "status_code": 401, "provider": "Replicate"})

    try:
        os.environ["REPLICATE_API_TOKEN"] = replicate_key
        max_chars = 5000
        if len(text) > max_chars:
            text = text[:max_chars]

        print(f"[Replicate] Running: {model}, len={len(text)}")

        model_configs = {
            "adirik/styletts2": {"ref": "adirik/styletts2", "input": {"text": text, "output_sample_rate": 24000, "diffusion_steps": 10}},
            "ttsds/openvoice_2": {"ref": "ttsds/openvoice_2", "input": {"text": text, "speed": 1.0}},
            "minimax/speech-2.6-turbo": {"ref": "minimax/speech-2.6-turbo", "input": {"text": text}},
        }
        cfg = model_configs.get(model, model_configs["adirik/styletts2"])

        output = replicate.run(cfg["ref"], input=cfg["input"])
        print(f"[Replicate] Output type: {type(output)}")

        if hasattr(output, "read"):
            with open(output_path, "wb") as f:
                f.write(output.read())
        elif isinstance(output, (str, bytes)):
            audio_url = output if isinstance(output, str) else output.decode()
            if audio_url.startswith("http"):
                resp = requests.get(audio_url, timeout=120)
                resp.raise_for_status()
                with open(output_path, "wb") as f:
                    f.write(resp.content)
            else:
                with open(output_path, "wb") as f:
                    f.write(output if isinstance(output, bytes) else output.encode())
        else:
            audio_url = str(output)
            if audio_url.startswith("http"):
                resp = requests.get(audio_url, timeout=120)
                resp.raise_for_status()
                with open(output_path, "wb") as f:
                    f.write(resp.content)
            else:
                raise Exception(f"Unexpected output: {type(output)}")

        print(f"[Replicate] Saved: {output_path}")
    except HTTPException:
        raise
    except Exception as e:
        error_str = str(e).lower()
        print(f"[Replicate] Error: {e}")
        if "unauthorized" in error_str or "authentication" in error_str:
            raise HTTPException(status_code=401, detail={"error": True, "title": "Invalid Token", "message": "Replicate API token invalid.", "suggestion": "Check at replicate.com/account", "status_code": 401, "provider": "Replicate"})
        if any(k in error_str for k in ("billing", "payment", "spending", "insufficient credit")):
            raise HTTPException(status_code=402, detail={"error": True, "title": "Billing Required", "message": "Replicate requires billing.", "suggestion": "Add billing at replicate.com/account/billing (~$0.002-0.01/run)", "status_code": 402, "provider": "Replicate"})
        if any(k in error_str for k in ("version", "not exist", "permission")):
            raise HTTPException(status_code=404, detail={"error": True, "title": "Model Unavailable", "message": f"Model '{model}' unavailable on Replicate.", "suggestion": "Try a different model or use Edge TTS.", "status_code": 404, "provider": "Replicate"})
        raise HTTPException(status_code=500, detail={"error": True, "title": "Replicate Error", "message": f"Error: {str(e)[:200]}", "suggestion": "Try Edge TTS or gTTS (free).", "status_code": 500, "provider": "Replicate"})


# ============== Multi-Agent Pipeline ==============

class PipelineAgent:
    """Base class for pipeline agents."""
    name: str = "Agent"

    def process(self, ctx: dict) -> dict:
        raise NotImplementedError


class ExtractorAgent(PipelineAgent):
    name = "Extractor"

    def process(self, ctx: dict) -> dict:
        if ctx.get("url") and not ctx.get("raw_text"):
            ctx["raw_text"] = extract_text_from_url(ctx["url"])
            ctx["logs"].append(f"Extracted {len(ctx['raw_text'])} chars from URL")
        elif ctx.get("raw_text"):
            ctx["logs"].append(f"Using provided text ({len(ctx['raw_text'])} chars)")
        return ctx


class AnalyzerAgent(PipelineAgent):
    name = "Analyzer"

    def process(self, ctx: dict) -> dict:
        text = ctx.get("raw_text", "")
        words = len(text.split())
        sentences = len(re.split(r'[.!?]+', text))
        lang = "en"
        ctx["metadata"] = {
            "word_count": words,
            "char_count": len(text),
            "sentence_count": sentences,
            "detected_language": lang,
            "estimated_duration_sec": int((words / 150) * 60),
            "content_type": "article" if words > 200 else "short_text",
        }
        ctx["logs"].append(f"Analyzed: {words} words, {sentences} sentences, ~{ctx['metadata']['estimated_duration_sec']}s")
        return ctx


class PreprocessorAgent(PipelineAgent):
    name = "Preprocessor"

    def process(self, ctx: dict) -> dict:
        text = ctx.get("raw_text", "")
        text = re.sub(r'\s+', ' ', text).strip()
        text = re.sub(r'https?://\S+', '', text)
        text = re.sub(r'[^\w\s.,!?;:\'"()\-–—/]', '', text)
        ctx["cleaned_text"] = text

        provider = ctx.get("provider", "edge-tts")
        max_chars = TTS_PROVIDERS.get(provider, {}).get("max_chars", 5000)
        chunk_size = min(max_chars, 4000)
        ctx["chunks"] = _split_into_chunks(text, chunk_size)
        ctx["logs"].append(f"Preprocessed: {len(text)} chars -> {len(ctx['chunks'])} chunk(s)")
        return ctx


class OptimizerAgent(PipelineAgent):
    name = "Optimizer"

    def process(self, ctx: dict) -> dict:
        provider = ctx.get("provider", "edge-tts")
        pstatus = PROVIDER_STATUS.get(provider, {}).get("status", "unknown")
        if pstatus == "unavailable":
            ctx["logs"].append(f"Warning: {provider} is currently unavailable. Will attempt anyway.")
        ctx["logs"].append(f"Optimized for provider: {provider} (status: {pstatus})")
        return ctx


class SynthesizerAgent(PipelineAgent):
    name = "Synthesizer"

    async def process_async(self, ctx: dict) -> dict:
        chunks = ctx.get("chunks", [ctx.get("cleaned_text", ctx.get("raw_text", ""))])
        provider = ctx.get("provider", "edge-tts")
        voice = ctx.get("voice", TTS_PROVIDERS.get(provider, {}).get("default_voice", ""))
        api_key = ctx.get("api_key")
        speed = ctx.get("speed", 1.0)
        audio_paths: list[str] = []

        for i, chunk in enumerate(chunks):
            chunk_id = uuid.uuid4().hex[:8]
            chunk_path = os.path.join(AUDIO_DIR, f"chunk_{chunk_id}.mp3")
            ctx["logs"].append(f"Synthesizing chunk {i+1}/{len(chunks)} ({len(chunk)} chars)")

            if provider == "edge-tts":
                await text_to_audio_edge(chunk, chunk_path, voice, speed)
            elif provider == "gtts":
                text_to_audio_gtts(chunk, chunk_path, voice)
            elif provider == "elevenlabs":
                text_to_audio_elevenlabs(chunk, chunk_path, voice, api_key)
            elif provider == "huggingface":
                await text_to_audio_huggingface(chunk, chunk_path, voice, api_key)
            elif provider == "replicate":
                text_to_audio_replicate(chunk, chunk_path, voice, api_key)
            elif provider == "openai":
                tts_model = ctx.get("tts_model", "tts-1")
                text_to_audio_openai(chunk, chunk_path, voice, api_key, speed, tts_model)

            audio_paths.append(chunk_path)

        ctx["audio_segments"] = audio_paths
        ctx["logs"].append(f"Synthesized {len(audio_paths)} chunk(s)")
        return ctx


class ValidatorAgent(PipelineAgent):
    name = "Validator"

    def process(self, ctx: dict) -> dict:
        valid = []
        for path in ctx.get("audio_segments", []):
            if os.path.exists(path) and os.path.getsize(path) > 100:
                valid.append(path)
            else:
                ctx["logs"].append(f"Warning: invalid/empty chunk {path}")
        ctx["audio_segments"] = valid
        ctx["logs"].append(f"Validated: {len(valid)} valid chunk(s)")
        if not valid:
            raise HTTPException(status_code=500, detail={"error": True, "title": "No Audio Generated", "message": "All audio chunks were empty or invalid.", "suggestion": "Try a different provider or shorter text.", "status_code": 500, "provider": ctx.get("provider", "unknown")})
        return ctx


class AssemblerAgent(PipelineAgent):
    name = "Assembler"

    def process(self, ctx: dict) -> dict:
        segments = ctx.get("audio_segments", [])
        output_path = ctx["output_path"]
        if len(segments) == 1:
            os.rename(segments[0], output_path)
        else:
            _concat_audio_files(segments, output_path)
            for p in segments:
                try:
                    os.remove(p)
                except OSError:
                    pass
        ctx["final_audio"] = output_path
        ctx["logs"].append(f"Assembled final audio: {output_path}")
        return ctx


PIPELINE_AGENTS = [
    ExtractorAgent(),
    AnalyzerAgent(),
    PreprocessorAgent(),
    OptimizerAgent(),
    SynthesizerAgent(),
    ValidatorAgent(),
    AssemblerAgent(),
]


async def run_pipeline(ctx: dict) -> dict:
    for agent in PIPELINE_AGENTS:
        ctx["current_agent"] = agent.name
        start = time.time()
        if isinstance(agent, SynthesizerAgent):
            ctx = await agent.process_async(ctx)
        else:
            ctx = agent.process(ctx)
        elapsed = round(time.time() - start, 2)
        ctx["agent_timings"] = ctx.get("agent_timings", {})
        ctx["agent_timings"][agent.name] = elapsed
    return ctx


# ============== API Endpoints ==============

@app.get("/api/providers")
async def get_providers():
    return TTS_PROVIDERS


@app.get("/api/provider-health")
async def provider_health():
    """Returns status for each provider (green/yellow/red)."""
    health = {}
    for pid, pconf in TTS_PROVIDERS.items():
        st = pconf.get("status", "unknown")
        if st == "working":
            health[pid] = {"status": "green", "label": "Working", "detail": pconf.get("note", "")}
        elif st == "partial":
            health[pid] = {"status": "yellow", "label": "Partial", "detail": pconf.get("note", "")}
        elif st == "paid":
            health[pid] = {"status": "yellow", "label": "Paid", "detail": pconf.get("note", "")}
        elif st == "unavailable":
            health[pid] = {"status": "red", "label": "Unavailable", "detail": pconf.get("note", "")}
        else:
            health[pid] = {"status": "gray", "label": "Unknown", "detail": ""}
    return health


@app.get("/api/voices/{provider}")
async def get_voices(provider: str, api_key: Optional[str] = Query(None)):
    """Dynamic voice loading per provider."""
    if provider == "edge-tts":
        try:
            voices = await edge_tts.list_voices()
            result = {}
            for v in voices:
                vid = v["ShortName"]
                gender = v.get("Gender", "")
                locale = v.get("Locale", "")
                result[vid] = f"{v.get('FriendlyName', vid)} ({gender}, {locale})"
            return {"voices": result, "count": len(result)}
        except Exception as e:
            return {"voices": EDGE_TTS_VOICES, "count": len(EDGE_TTS_VOICES), "error": str(e)}

    elif provider == "elevenlabs":
        key = _resolved_api_key(api_key, "ELEVENLABS_API_KEY")
        if not key:
            return {"voices": ELEVENLABS_VOICES, "count": len(ELEVENLABS_VOICES), "note": "Provide API key for your account's available voices."}
        try:
            from elevenlabs import ElevenLabs
            client = ElevenLabs(api_key=key)
            voices_resp = client.voices.get_all()
            result = {}
            for v in voices_resp.voices:
                labels = getattr(v, "labels", {}) or {}
                gender = labels.get("gender", "")
                accent = labels.get("accent", "")
                desc = f"{v.name}"
                if gender or accent:
                    desc += f" ({', '.join(filter(None, [gender, accent]))})"
                result[v.voice_id] = desc
            return {"voices": result, "count": len(result)}
        except Exception as e:
            return {"voices": ELEVENLABS_VOICES, "count": len(ELEVENLABS_VOICES), "error": str(e)}

    elif provider == "openai":
        return {"voices": OPENAI_VOICES, "count": len(OPENAI_VOICES), "models": OPENAI_MODELS}

    elif provider == "gtts":
        return {"voices": GTTS_VOICES, "count": len(GTTS_VOICES)}

    elif provider == "huggingface":
        return {"voices": HUGGINGFACE_MODELS, "count": len(HUGGINGFACE_MODELS), "note": "Currently unavailable on hf-inference (all return 404)."}

    elif provider == "replicate":
        return {"voices": REPLICATE_MODELS, "count": len(REPLICATE_MODELS)}

    return {"voices": {}, "count": 0}


@app.post("/api/extract-text")
async def extract_text_endpoint(url: str = Form(...)):
    try:
        text = extract_text_from_url(url)
        if not text:
            raise HTTPException(status_code=400, detail={"error": True, "title": "No Text Found", "message": "Could not extract text from this URL.", "suggestion": "Try pasting the text directly."})
        duration = estimate_duration(text)
        return {"text": text, **duration}
    except requests.exceptions.Timeout:
        raise HTTPException(status_code=504, detail={"error": True, "title": "Timeout", "message": "The website took too long.", "suggestion": "Try pasting text directly."})
    except HTTPException:
        raise
    except requests.RequestException:
        raise HTTPException(status_code=400, detail={"error": True, "title": "Could Not Fetch URL", "message": "Failed to retrieve content.", "suggestion": "Check URL or paste text directly."})


@app.post("/api/estimate")
async def estimate(text: str = Form(...), speed: float = Form(1.0)):
    return estimate_duration(text, speed)


@app.post("/api/convert")
async def convert(
    text: str = Form(...),
    provider: str = Form("edge-tts"),
    voice: str = Form(None),
    api_key: Optional[str] = Form(None),
    speed: float = Form(1.0),
    tts_model: Optional[str] = Form(None),
):
    if provider not in TTS_PROVIDERS:
        raise HTTPException(status_code=400, detail={"error": True, "title": "Invalid Provider", "message": f"Provider '{provider}' not supported.", "suggestion": "Select a valid provider."})

    if not text.strip():
        raise HTTPException(status_code=400, detail={"error": True, "title": "No Text", "message": "Please provide text to convert.", "suggestion": "Enter text or extract from URL."})

    max_chars = TTS_PROVIDERS[provider].get("max_chars", 10000)
    if len(text) > max_chars:
        raise HTTPException(status_code=400, detail={"error": True, "title": "Text Too Long", "message": f"Text exceeds {max_chars:,} char limit for {TTS_PROVIDERS[provider]['name']}.", "suggestion": "Shorten text, use Pipeline mode for auto-chunking, or try Edge TTS (100k limit)."})

    speed = max(0.5, min(2.0, speed))
    if not voice:
        voice = TTS_PROVIDERS[provider]["default_voice"]

    file_id = uuid.uuid4().hex[:12]
    output_path = os.path.join(AUDIO_DIR, f"audio_{file_id}.mp3")

    try:
        if provider == "edge-tts":
            await text_to_audio_edge(text, output_path, voice, speed)
        elif provider == "gtts":
            text_to_audio_gtts(text, output_path, voice)
        elif provider == "elevenlabs":
            text_to_audio_elevenlabs(text, output_path, voice, api_key)
        elif provider == "huggingface":
            await text_to_audio_huggingface(text, output_path, voice, api_key)
        elif provider == "replicate":
            text_to_audio_replicate(text, output_path, voice, api_key)
        elif provider == "openai":
            text_to_audio_openai(text, output_path, voice, api_key, speed, tts_model or "tts-1")

        return FileResponse(output_path, media_type="audio/mpeg", filename=f"blog_audio_{file_id}.mp3")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=get_friendly_error(500, provider, str(e)))


@app.post("/api/convert-pipeline")
async def convert_pipeline(
    text: str = Form(None),
    url: str = Form(None),
    provider: str = Form("edge-tts"),
    voice: str = Form(None),
    api_key: Optional[str] = Form(None),
    speed: float = Form(1.0),
    tts_model: Optional[str] = Form(None),
):
    """Multi-agent pipeline: returns SSE stream with progress, then final audio URL."""
    if not text and not url:
        raise HTTPException(status_code=400, detail={"error": True, "title": "No Input", "message": "Provide text or URL.", "suggestion": "Enter text or a blog URL."})

    if provider not in TTS_PROVIDERS:
        raise HTTPException(status_code=400, detail={"error": True, "title": "Invalid Provider", "message": f"Provider '{provider}' not supported.", "suggestion": "Select a valid provider."})

    speed = max(0.5, min(2.0, speed))
    if not voice:
        voice = TTS_PROVIDERS[provider]["default_voice"]

    file_id = uuid.uuid4().hex[:12]
    output_path = os.path.join(AUDIO_DIR, f"pipeline_{file_id}.mp3")

    ctx = {
        "raw_text": text or "",
        "url": url or "",
        "provider": provider,
        "voice": voice,
        "api_key": api_key,
        "speed": speed,
        "tts_model": tts_model or "tts-1",
        "output_path": output_path,
        "logs": [],
        "agent_timings": {},
    }

    async def event_stream():
        try:
            for agent in PIPELINE_AGENTS:
                ctx["current_agent"] = agent.name
                yield f"data: {json.dumps({'event': 'agent_start', 'agent': agent.name})}\n\n"
                start = time.time()

                if isinstance(agent, SynthesizerAgent):
                    result = await agent.process_async(ctx)
                else:
                    result = agent.process(ctx)

                elapsed = round(time.time() - start, 2)
                ctx.update(result) if isinstance(result, dict) and result is not ctx else None
                yield f"data: {json.dumps({'event': 'agent_done', 'agent': agent.name, 'time': elapsed, 'logs': ctx['logs'][-3:]})}\n\n"

            yield f"data: {json.dumps({'event': 'complete', 'audio_url': f'/api/audio/{file_id}', 'timings': ctx.get('agent_timings', {}), 'metadata': ctx.get('metadata', {})})}\n\n"
        except HTTPException as e:
            agent_name = ctx.get("current_agent") or "Synthesizer"
            yield f"data: {json.dumps({'event': 'agent_error', 'agent': agent_name})}\n\n"
            detail = e.detail if isinstance(e.detail, dict) else {"message": str(e.detail)}
            yield f"data: {json.dumps({'event': 'error', **detail})}\n\n"
        except Exception as e:
            agent_name = ctx.get("current_agent") or "Synthesizer"
            yield f"data: {json.dumps({'event': 'agent_error', 'agent': agent_name})}\n\n"
            yield f"data: {json.dumps({'event': 'error', 'message': str(e)[:300]})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@app.get("/api/audio/{file_id}")
async def get_audio(file_id: str):
    """Serve generated audio by file ID (used by pipeline SSE)."""
    output_path = os.path.join(AUDIO_DIR, f"pipeline_{file_id}.mp3")
    if not os.path.exists(output_path):
        output_path = os.path.join(AUDIO_DIR, f"audio_{file_id}.mp3")
    if not os.path.exists(output_path):
        raise HTTPException(status_code=404, detail="Audio not found")
    return FileResponse(output_path, media_type="audio/mpeg", filename=f"audio_{file_id}.mp3")


@app.get("/api/sample-texts")
async def get_sample_texts():
    return {
        "samples": [
            {"title": "Quick Test", "text": "Hello! This is a test of the AI text-to-speech system. The voice you're hearing is generated by artificial intelligence."},
            {"title": "Technology", "text": "Artificial intelligence is transforming how we interact with technology. From virtual assistants to autonomous vehicles, AI systems are becoming increasingly sophisticated. Machine learning models can now understand context, generate creative content, and even hold natural conversations."},
            {"title": "Story", "text": "Once upon a time, in a small village nestled between rolling hills, there lived a curious young inventor. Every day, she would tinker with gears and springs, dreaming of machines that could change the world. Little did she know, her greatest invention was just around the corner."},
            {"title": "News Article", "text": "Scientists announced today a breakthrough in quantum computing that could revolutionize data processing. The new chip, developed at a leading research university, operates at room temperature and achieves processing speeds previously thought impossible. Industry experts say this could accelerate AI development by decades."},
            {"title": "Poetry", "text": "The autumn leaves fall gently down, painting golden paths through town. A whisper of the wind reminds us all, that beauty lives in every fall. Through misty mornings, crisp and clear, we welcome in the turning year."},
        ]
    }


@app.get("/api/health")
async def health_check():
    return {"status": "ok", "providers": len(TTS_PROVIDERS), "working": sum(1 for p in PROVIDER_STATUS.values() if p["status"] in ("working", "partial"))}


if os.path.exists("frontend/dist"):
    app.mount("/", StaticFiles(directory="frontend/dist", html=True), name="frontend")
