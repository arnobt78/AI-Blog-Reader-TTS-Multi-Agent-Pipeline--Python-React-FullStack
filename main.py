"""
Blog-to-Audio API — FastAPI backend.
Converts blog URLs or pasted text to speech using multiple TTS providers
(Edge TTS, ElevenLabs, Hugging Face, Replicate, OpenAI).
"""
import requests
from bs4 import BeautifulSoup
from fastapi import FastAPI, Form, HTTPException
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import uuid
import os
import asyncio
import edge_tts
from typing import Optional
import aiofiles
from dotenv import load_dotenv

# Load environment variables from .env file (API keys, etc.)
load_dotenv()

# Initialize FastAPI app
app = FastAPI(title="Blog to Audio API")

# CORS: allow frontend (Vite dev or Vercel) to call this API from a different origin
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create audio output directory
AUDIO_DIR = "audio_files"
os.makedirs(AUDIO_DIR, exist_ok=True)

# ============== User-Friendly Error Messages ==============
# Maps HTTP status codes to human-readable titles/messages for the UI

ERROR_MESSAGES = {
    429: {
        "title": "Too Many Requests",
        "message": "You've hit the rate limit. Please wait a moment and try again.",
        "suggestion": "Try using a different provider or wait a few minutes.",
    },
    500: {
        "title": "Service Error",
        "message": "The AI service encountered an error.",
        "suggestion": "Please try again, or switch to a different provider.",
    },
    503: {
        "title": "Service Unavailable",
        "message": "The AI service is currently unavailable.",
        "suggestion": "Please try again in a moment.",
    },
    401: {
        "title": "Invalid API Key",
        "message": "Your API key is invalid or expired.",
        "suggestion": "Please check your API key and try again.",
    },
    403: {
        "title": "Access Denied",
        "message": "Your API key doesn't have access to this service.",
        "suggestion": "Check your API key permissions.",
    },
}

def get_friendly_error(status_code: int, provider: str, raw_error: str = "") -> dict:
    """Build a structured error payload for the frontend (title, message, suggestion)."""
    if status_code in ERROR_MESSAGES:
        error_info = ERROR_MESSAGES[status_code]
        return {
            "error": True,
            "title": error_info["title"],
            "message": f"{error_info['message']} ({provider})",
            "suggestion": error_info["suggestion"],
            "status_code": status_code,
            "provider": provider,
        }
    
    return {
        "error": True,
        "title": "Something Went Wrong",
        "message": f"An error occurred with {provider}.",
        "suggestion": "Please try again or use a different provider.",
        "status_code": status_code,
        "provider": provider,
        "details": raw_error[:300] if raw_error else None,
    }


# ============== TTS Provider Configurations ==============

# Edge TTS (Free, fallback)
EDGE_TTS_VOICES = {
    "en-US-AriaNeural": "Aria (Female, US)",
    "en-US-GuyNeural": "Guy (Male, US)",
    "en-US-JennyNeural": "Jenny (Female, US)",
    "en-GB-SoniaNeural": "Sonia (Female, UK)",
    "en-GB-RyanNeural": "Ryan (Male, UK)",
}

# ElevenLabs AI Voices
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

# OpenAI TTS Voices  
OPENAI_VOICES = {
    "alloy": "Alloy (Neutral)",
    "echo": "Echo (Male)",
    "fable": "Fable (British)",
    "onyx": "Onyx (Deep Male)",
    "nova": "Nova (Female)",
    "shimmer": "Shimmer (Soft Female)",
}

# Hugging Face TTS Models (Free) - These may have limited availability
HUGGINGFACE_MODELS = {
    "suno/bark-small": "Suno Bark (Small)",
    "facebook/mms-tts-eng": "Facebook MMS (English)",
}

# Replicate Models (AI TTS)
REPLICATE_MODELS = {
    "adirik/styletts2": "StyleTTS2 (Fast & Natural)",
}

# Single source of truth: provider id → config (name, voices, limits, etc.). Frontend fetches via /api/providers.
TTS_PROVIDERS = {
    "edge-tts": {
        "name": "Edge TTS (Free)",
        "description": "Microsoft neural TTS - Free, no API key needed",
        "requires_api_key": False,
        "voices": EDGE_TTS_VOICES,
        "default_voice": "en-US-AriaNeural",
        "max_chars": 100000,
        "supports_speed": True,
        "is_ai": False,
    },
    "elevenlabs": {
        "name": "ElevenLabs",
        "description": "Industry-leading AI voice synthesis",
        "requires_api_key": True,
        "voices": ELEVENLABS_VOICES,
        "default_voice": "21m00Tcm4TlvDq8ikWAM",
        "max_chars": 5000,
        "supports_speed": False,
        "is_ai": True,
    },
    "huggingface": {
        "name": "Hugging Face (Limited)",
        "description": "Free but unreliable - May fail or take 60s+ to load",
        "requires_api_key": False,
        "voices": HUGGINGFACE_MODELS,
        "default_voice": "suno/bark-small",
        "max_chars": 200,
        "supports_speed": False,
        "is_ai": True,
    },
    "replicate": {
        "name": "Replicate (Paid)",
        "description": "High-quality AI models - Requires billing",
        "requires_api_key": True,
        "voices": REPLICATE_MODELS,
        "default_voice": "adirik/styletts2",
        "max_chars": 400,
        "supports_speed": False,
        "is_ai": True,
    },
    "openai": {
        "name": "OpenAI TTS",
        "description": "High-quality AI voices by OpenAI",
        "requires_api_key": True,
        "voices": OPENAI_VOICES,
        "default_voice": "nova",
        "max_chars": 4096,
        "supports_speed": True,
        "is_ai": True,
    },
}


# ============== Helper Functions ==============

def extract_text_from_url(url: str) -> str:
    """Fetch a blog URL and extract the main text content. Strips scripts, nav, footer; prefers article/main/body and <p> tags."""
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
    }
    response = requests.get(url, timeout=15, headers=headers)
    response.raise_for_status()
    html = response.text
    soup = BeautifulSoup(html, "html.parser")
    
    for element in soup(["script", "style", "nav", "footer", "header", "aside"]):
        element.decompose()
    
    main_content = soup.find("article") or soup.find("main") or soup.find("body")
    
    if main_content:
        paragraphs = main_content.find_all("p")
    else:
        paragraphs = soup.find_all("p")
    
    text = " ".join(p.get_text(strip=True) for p in paragraphs if p.get_text(strip=True))
    return text


def estimate_duration(text: str, speed: float = 1.0) -> dict:
    """Rough estimate of audio length: words / (150 wpm * speed). Returns words, chars, estimated_seconds, formatted time."""
    words = len(text.split())
    chars = len(text)
    base_wpm = 150
    adjusted_wpm = base_wpm * speed
    duration_minutes = words / adjusted_wpm
    duration_seconds = int(duration_minutes * 60)
    minutes = duration_seconds // 60
    seconds = duration_seconds % 60
    
    return {
        "words": words,
        "characters": chars,
        "estimated_seconds": duration_seconds,
        "formatted": f"{minutes}:{seconds:02d}",
    }


# ============== TTS Provider Implementations ==============

async def text_to_audio_edge(text: str, output_path: str, voice: str = "en-US-AriaNeural", speed: float = 1.0):
    """Edge TTS — free Microsoft neural voices. Supports speed (rate string like +10%)."""
    try:
        rate_percent = int((speed - 1.0) * 100)
        rate_str = f"+{rate_percent}%" if rate_percent >= 0 else f"{rate_percent}%"
        communicate = edge_tts.Communicate(text, voice, rate=rate_str)
        await communicate.save(output_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=get_friendly_error(500, "Edge TTS", str(e)))


async def text_to_audio_huggingface(text: str, output_path: str, model: str = "suno/bark-small", api_key: Optional[str] = None):
    """Hugging Face TTS - Free AI models using official library."""
    from huggingface_hub import InferenceClient
    
    hf_token = api_key or os.getenv("HF_API_KEY")
    
    # Truncate text for HF models (Bark especially has short limits)
    max_chars = 200  # Bark works best with short text
    if len(text) > max_chars:
        text = text[:max_chars]
    
    print(f"[HuggingFace] Running model: {model}, text length: {len(text)}")
    
    try:
        client = InferenceClient(
            token=hf_token,
            timeout=120  # Long timeout for model loading
        )
        
        # Use the text_to_speech method from the official library
        audio_bytes = client.text_to_speech(text, model=model)
        
        if not audio_bytes or len(audio_bytes) < 100:
            raise ValueError("Empty or invalid audio returned")
        
        # Save the audio
        async with aiofiles.open(output_path, "wb") as f:
            await f.write(audio_bytes)
        
        print(f"[HuggingFace] Audio saved to: {output_path}, size: {len(audio_bytes)} bytes")
        return
        
    except Exception as e:
        error_str = str(e).lower()
        print(f"[HuggingFace] Error: {type(e).__name__}: {e}")
        
        if "503" in str(e) or "loading" in error_str or "is currently loading" in error_str:
            raise HTTPException(status_code=503, detail={
                "error": True,
                "title": "Model Loading",
                "message": "The AI model is loading. This can take 20-60 seconds.",
                "suggestion": "Please wait 30 seconds and try again, or use Edge TTS.",
                "status_code": 503,
                "provider": "Hugging Face",
            })
        elif "429" in str(e) or "rate" in error_str:
            raise HTTPException(status_code=429, detail={
                "error": True,
                "title": "Rate Limited",
                "message": "Too many requests to Hugging Face.",
                "suggestion": "Wait a moment and try again, or use Edge TTS.",
                "status_code": 429,
                "provider": "Hugging Face",
            })
        elif "404" in str(e) or "not found" in error_str:
            raise HTTPException(status_code=404, detail={
                "error": True,
                "title": "Model Not Available",
                "message": f"Model '{model}' is not available via free inference.",
                "suggestion": "Hugging Face free TTS is limited. Use Edge TTS instead!",
                "status_code": 404,
                "provider": "Hugging Face",
            })
        elif "timeout" in error_str:
            raise HTTPException(status_code=504, detail={
                "error": True,
                "title": "Timeout",
                "message": "The model took too long to respond.",
                "suggestion": "The model may be loading. Try again in 30 seconds, or use Edge TTS.",
                "status_code": 504,
                "provider": "Hugging Face",
            })
        else:
            raise HTTPException(status_code=500, detail={
                "error": True,
                "title": "Hugging Face Unavailable",
                "message": "Hugging Face free TTS has limited availability.",
                "suggestion": "Use Edge TTS - it's 100% free and always works!",
                "status_code": 500,
                "provider": "Hugging Face",
            })


def text_to_audio_openai(text: str, output_path: str, voice: str = "nova", api_key: Optional[str] = None, speed: float = 1.0):
    """OpenAI TTS (tts-1-hd). Uses form api_key or OPENAI_API_KEY env; maps auth/rate-limit to friendly errors."""
    from openai import OpenAI, APIError, RateLimitError, AuthenticationError
    
    openai_key = api_key or os.getenv("OPENAI_API_KEY")
    
    if not openai_key:
        raise HTTPException(status_code=401, detail={
            "error": True,
            "title": "API Key Required",
            "message": "OpenAI TTS requires an API key.",
            "suggestion": "Get your API key from platform.openai.com",
            "status_code": 401,
            "provider": "OpenAI",
        })
    
    try:
        client = OpenAI(api_key=openai_key)
        response = client.audio.speech.create(
            model="tts-1-hd",
            voice=voice,
            input=text,
            speed=speed
        )
        with open(output_path, "wb") as f:
            f.write(response.content)
            
    except AuthenticationError:
        raise HTTPException(status_code=401, detail={
            "error": True,
            "title": "Invalid API Key",
            "message": "Your OpenAI API key is invalid or expired.",
            "suggestion": "Generate a new key at platform.openai.com",
            "status_code": 401,
            "provider": "OpenAI",
        })
    except RateLimitError:
        raise HTTPException(status_code=429, detail={
            "error": True,
            "title": "Rate Limit Exceeded",
            "message": "You've exceeded your OpenAI quota.",
            "suggestion": "Check your usage at platform.openai.com or wait a bit.",
            "status_code": 429,
            "provider": "OpenAI",
        })
    except APIError as e:
        raise HTTPException(status_code=e.status_code or 500, detail=get_friendly_error(e.status_code or 500, "OpenAI", str(e)))


def text_to_audio_elevenlabs(text: str, output_path: str, voice_id: str = "21m00Tcm4TlvDq8ikWAM", api_key: Optional[str] = None):
    """ElevenLabs API: streams audio chunks, writes to file. Voice settings: stability, similarity_boost, etc."""
    from elevenlabs import ElevenLabs, VoiceSettings
    
    eleven_key = api_key or os.getenv("ELEVENLABS_API_KEY")
    
    if not eleven_key:
        raise HTTPException(status_code=401, detail={
            "error": True,
            "title": "API Key Required",
            "message": "ElevenLabs requires an API key.",
            "suggestion": "Get your free API key from elevenlabs.io",
            "status_code": 401,
            "provider": "ElevenLabs",
        })
    
    try:
        client = ElevenLabs(api_key=eleven_key)
        
        audio_generator = client.text_to_speech.convert(
            voice_id=voice_id,
            text=text,
            model_id="eleven_multilingual_v2",
            voice_settings=VoiceSettings(
                stability=0.5,
                similarity_boost=0.75,
                style=0.0,
                use_speaker_boost=True,
            ),
        )
        
        # Write audio chunks to file
        with open(output_path, "wb") as f:
            for chunk in audio_generator:
                f.write(chunk)
                
    except Exception as e:
        error_str = str(e).lower()
        if "unauthorized" in error_str or "invalid" in error_str:
            raise HTTPException(status_code=401, detail={
                "error": True,
                "title": "Invalid API Key",
                "message": "Your ElevenLabs API key is invalid.",
                "suggestion": "Check your key at elevenlabs.io/app/settings",
                "status_code": 401,
                "provider": "ElevenLabs",
            })
        elif "quota" in error_str or "limit" in error_str:
            raise HTTPException(status_code=429, detail={
                "error": True,
                "title": "Quota Exceeded",
                "message": "You've used all your ElevenLabs credits.",
                "suggestion": "Upgrade your plan or wait for monthly reset.",
                "status_code": 429,
                "provider": "ElevenLabs",
            })
        else:
            raise HTTPException(status_code=500, detail=get_friendly_error(500, "ElevenLabs", str(e)))


def text_to_audio_replicate(text: str, output_path: str, model: str = "lucataco/xtts-v2", api_key: Optional[str] = None):
    """Replicate: runs StyleTTS2 (adirik/styletts2). Returns audio URL; we download and save as MP3. Requires billing."""
    import replicate
    
    replicate_key = api_key or os.getenv("REPLICATE_API_TOKEN")
    
    if not replicate_key:
        raise HTTPException(status_code=401, detail={
            "error": True,
            "title": "API Key Required",
            "message": "Replicate requires an API token.",
            "suggestion": "Get your token from replicate.com/account/api-tokens",
            "status_code": 401,
            "provider": "Replicate",
        })
    
    try:
        # Set the API token
        os.environ["REPLICATE_API_TOKEN"] = replicate_key
        
        # Truncate text if too long
        max_chars = 400
        if len(text) > max_chars:
            text = text[:max_chars]
        
        print(f"[Replicate] Running model: {model}, text length: {len(text)}")
        
        # Use adirik/styletts2 - a reliable, fast TTS model on Replicate
        output = replicate.run(
            "adirik/styletts2:989cb5ea6d2401314eb30685740cb9f6fd1c9001b8940659b406f952837ab5ac",
            input={
                "text": text,
                "output_sample_rate": 24000,
                "diffusion_steps": 10,
            }
        )
        
        print(f"[Replicate] Output: {output}")
        
        # Download the output audio
        if output:
            audio_url = output if isinstance(output, str) else str(output)
            print(f"[Replicate] Downloading audio from: {audio_url}")
            response = requests.get(audio_url, timeout=120)
            response.raise_for_status()
            with open(output_path, "wb") as f:
                f.write(response.content)
            print(f"[Replicate] Audio saved to: {output_path}")
        else:
            raise Exception("No output from model")
                
    except Exception as e:
        error_str = str(e).lower()
        print(f"[Replicate] Error: {e}")
        if "unauthorized" in error_str or "authentication" in error_str:
            raise HTTPException(status_code=401, detail={
                "error": True,
                "title": "Invalid API Token",
                "message": "Your Replicate API token is invalid.",
                "suggestion": "Check your token at replicate.com/account",
                "status_code": 401,
                "provider": "Replicate",
            })
        elif "billing" in error_str or "payment" in error_str or "spending" in error_str:
            raise HTTPException(status_code=402, detail={
                "error": True,
                "title": "Billing Required",
                "message": "Replicate requires a payment method to run models.",
                "suggestion": "Add billing at replicate.com/account/billing (you only pay for what you use)",
                "status_code": 402,
                "provider": "Replicate",
            })
        elif "version" in error_str or "not exist" in error_str or "permission" in error_str:
            raise HTTPException(status_code=404, detail={
                "error": True,
                "title": "Model Unavailable",
                "message": "This AI model is currently unavailable on Replicate.",
                "suggestion": "Try ElevenLabs - it's working and has great quality!",
                "status_code": 404,
                "provider": "Replicate",
            })
        else:
            raise HTTPException(status_code=500, detail={
                "error": True,
                "title": "Replicate Error",
                "message": f"Error: {str(e)[:150]}",
                "suggestion": "Try ElevenLabs instead - it works great!",
                "status_code": 500,
                "provider": "Replicate",
            })


# ============== API Endpoints ==============

@app.get("/api/providers")
async def get_providers():
    """Returns TTS_PROVIDERS so the frontend can build provider/voice dropdowns and show limits."""
    return TTS_PROVIDERS


@app.post("/api/extract-text")
async def extract_text(url: str = Form(...)):
    """Scrapes the given URL; returns extracted text plus word count and estimated duration."""
    try:
        text = extract_text_from_url(url)
        if not text:
            raise HTTPException(status_code=400, detail={
                "error": True,
                "title": "No Text Found",
                "message": "Could not extract text from this URL.",
                "suggestion": "Try pasting the text directly.",
            })
        duration = estimate_duration(text)
        return {"text": text, **duration}
    except requests.exceptions.Timeout:
        raise HTTPException(status_code=504, detail={
            "error": True,
            "title": "Timeout",
            "message": "The website took too long to respond.",
            "suggestion": "Try pasting the text directly.",
        })
    except requests.RequestException:
        raise HTTPException(status_code=400, detail={
            "error": True,
            "title": "Could Not Fetch URL",
            "message": "Failed to retrieve content.",
            "suggestion": "Check the URL or paste text directly.",
        })


@app.post("/api/estimate")
async def estimate(text: str = Form(...), speed: float = Form(1.0)):
    """Estimate audio duration."""
    return estimate_duration(text, speed)


@app.post("/api/convert")
async def convert(
    text: str = Form(...),
    provider: str = Form("edge-tts"),
    voice: str = Form(None),
    api_key: Optional[str] = Form(None),
    speed: float = Form(1.0),
):
    """Main conversion: validates provider/limits, then calls the right TTS function and returns the MP3 file."""
    
    if provider not in TTS_PROVIDERS:
        raise HTTPException(status_code=400, detail={
            "error": True,
            "title": "Invalid Provider",
            "message": f"Provider '{provider}' not supported.",
            "suggestion": "Select a valid provider.",
        })
    
    if not text.strip():
        raise HTTPException(status_code=400, detail={
            "error": True,
            "title": "No Text",
            "message": "Please provide text to convert.",
            "suggestion": "Enter text or extract from URL.",
        })
    
    # Check character limits
    max_chars = TTS_PROVIDERS[provider].get("max_chars", 10000)
    if len(text) > max_chars:
        raise HTTPException(status_code=400, detail={
            "error": True,
            "title": "Text Too Long",
            "message": f"Text exceeds {max_chars:,} character limit for {TTS_PROVIDERS[provider]['name']}.",
            "suggestion": "Shorten the text or use a different provider.",
        })
    
    speed = max(0.5, min(2.0, speed))
    
    if not voice:
        voice = TTS_PROVIDERS[provider]["default_voice"]
    
    file_id = uuid.uuid4().hex[:12]
    output_path = os.path.join(AUDIO_DIR, f"audio_{file_id}.mp3")
    
    try:
        # Route to the correct TTS implementation (async vs sync)
        if provider == "edge-tts":
            await text_to_audio_edge(text, output_path, voice, speed)
        
        elif provider == "elevenlabs":
            text_to_audio_elevenlabs(text, output_path, voice, api_key)
        
        elif provider == "huggingface":
            await text_to_audio_huggingface(text, output_path, voice, api_key)
        
        elif provider == "replicate":
            text_to_audio_replicate(text, output_path, voice, api_key)
        
        elif provider == "openai":
            text_to_audio_openai(text, output_path, voice, api_key, speed)
        
        return FileResponse(
            output_path,
            media_type="audio/mpeg",
            filename=f"blog_audio_{file_id}.mp3",
        )
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=get_friendly_error(500, provider, str(e)))


@app.get("/api/sample-texts")
async def get_sample_texts():
    """Predefined short texts so users can try TTS without pasting content."""
    return {
        "samples": [
            {
                "title": "Quick Test",
                "text": "Hello! This is a test of the AI text-to-speech system. The voice you're hearing is generated by artificial intelligence."
            },
            {
                "title": "Technology",
                "text": "Artificial intelligence is transforming how we interact with technology. From virtual assistants to autonomous vehicles, AI systems are becoming increasingly sophisticated. Machine learning models can now understand context, generate creative content, and even hold natural conversations."
            },
            {
                "title": "Story",
                "text": "Once upon a time, in a small village nestled between rolling hills, there lived a curious young inventor. Every day, she would tinker with gears and springs, dreaming of machines that could change the world. Little did she know, her greatest invention was just around the corner."
            },
        ]
    }


@app.get("/api/health")
async def health_check():
    """Simple liveness check for Coolify/Docker healthchecks."""
    return {"status": "ok"}


# Serve React frontend in production when frontend/dist exists (e.g. after npm run build)
if os.path.exists("frontend/dist"):
    app.mount("/", StaticFiles(directory="frontend/dist", html=True), name="frontend")
