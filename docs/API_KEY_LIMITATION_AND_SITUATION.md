# Provider Status & Troubleshooting (April 2026)

## Provider Status Summary

| Provider          | Status      | Free Tier             | API Key  | Notes                                                                                                                                                |
| ----------------- | ----------- | --------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Edge TTS**      | Working     | Unlimited (no key)    | No       | Microsoft neural voices via `edge-tts` library. Always works.                                                                                        |
| **gTTS (Google)** | Working     | Unlimited (no key)    | No       | Google Translate TTS endpoint. Basic quality, 100% reliable.                                                                                         |
| **ElevenLabs**    | Partial     | 10k credits/month     | Yes      | Free tier can use premade/default voices. Library voices blocked (402). Use `eleven_flash_v2_5` model for lower cost.                                |
| **Hugging Face**  | Unavailable | N/A                   | Optional | Hub lists **zero** TTS models on `hf-inference` provider as of April 2026. Every call returns 404 from `router.huggingface.co`. Platform limitation. |
| **Replicate**     | Paid only   | Limited free runs     | Yes      | Pay-per-use after free runs. ~$0.002-0.01/generation.                                                                                                |
| **OpenAI**        | Paid only   | $5 new-account credit | Yes      | tts-1: $15/1M chars. tts-1-hd: $30/1M chars. gpt-4o-mini-tts: token-based.                                                                           |

## Detailed Provider Notes

### Edge TTS (Free, Always Works)

- Uses Microsoft's neural TTS service via the `edge-tts` Python library
- No API key, no account, no rate limits for normal use
- 400+ voices across dozens of languages
- Supports speed control (0.5x-2.0x)
- Quality: very good for a free service (neural voices)
- This is the recommended default for all users

### gTTS (Google TTS) (Free, Always Works)

- Uses Google Translate's unofficial TTS endpoint
- No API key required
- Supports 50+ languages
- Quality: basic/robotic compared to neural voices
- Rate limit: ~50-60k characters/hour before potential 429
- Good fallback when Edge TTS is unavailable

### ElevenLabs

- **Free tier**: 10,000 credits/month (~10 min audio with Multilingual v2, ~20 min with Flash)
- **Voice restrictions on free tier**:
  - Premade/default voices: accessible via API
  - Library/community voices: **blocked** (returns 402 `paid_plan_required`)
  - Voice cloning: requires Starter plan ($5/mo) minimum
  - Voice Design (from text description): may work on free tier
- **Models**: `eleven_flash_v2_5` (faster, cheaper), `eleven_multilingual_v2` (higher quality)
- **Default voices expiring**: December 31, 2026
- **Fix applied**: Dynamic voice fetching via `/api/voices/elevenlabs`, flash model as default

### Hugging Face (Currently Unavailable)

- The old `api-inference.huggingface.co` endpoint was deprecated in late 2025
- Replaced by `router.huggingface.co/hf-inference/models/...`
- As of April 2026, the Hub filter `pipeline_tag=text-to-speech&inference_provider=hf-inference` returns **zero models**
- This means no TTS model is served by the `hf-inference` provider
- All calls return HTTP 404 from the router
- **This is a Hugging Face platform limitation, not a code bug**
- The code and fallback chain are correct; HF simply doesn't host TTS on this provider
- Workaround: use other providers (fal-ai, replicate) through HF Hub, but those require billing

### Replicate

- No true free tier; limited free runs for testing
- After free runs: pay-per-second GPU billing
- Models available: StyleTTS2, OpenVoice 2, Chatterbox, MiniMax Speech
- ~$0.002-0.01 per generation depending on model and length
- Need to add billing at replicate.com/account/billing

### OpenAI

- $5 free credits for new accounts (no card required initially)
- tts-1: $15/1M characters (standard quality)
- tts-1-hd: $30/1M characters (high quality)
- gpt-4o-mini-tts: ~$0.60/1M input tokens + $12/1M output tokens
- 6 voices: alloy, echo, fable, onyx, nova, shimmer
- Max 4096 characters per request

## Troubleshooting

### "paid_plan_required" from ElevenLabs

The voice ID you selected is a "library" voice blocked on free tier. Solutions:

1. Use the dynamic voice list (fetched from your account)
2. Switch to a premade/default voice
3. Upgrade to Starter plan ($5/mo)
4. Use Edge TTS instead (free)

### 404 from Hugging Face

All TTS models return 404 on `hf-inference`. This is not fixable from the app side. Check: <https://huggingface.co/models?pipeline_tag=text-to-speech&inference_provider=hf-inference&sort=trending>

### 402 from Replicate

You need billing enabled. Go to replicate.com/account/billing.

### 429 from OpenAI

Quota exceeded. Check usage at platform.openai.com/usage. Wait for reset or add credits.

### Edge TTS fails

Very rare. Usually a transient network issue. Retry in a few seconds.
