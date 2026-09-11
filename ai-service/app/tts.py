import base64
import html
import os
import re
from typing import Any

import httpx
from fastapi import APIRouter
from pydantic import BaseModel, Field

router = APIRouter(prefix="/v1", tags=["tts"])

AZURE_SPEECH_KEY = os.getenv("AZURE_SPEECH_KEY", "").strip()
AZURE_SPEECH_REGION = os.getenv("AZURE_SPEECH_REGION", "").strip()
VOICE_RE = re.compile(r"^[A-Za-z]{2,3}-[A-Za-z]{2,4}-[A-Za-z0-9-]+$")


class TTSRequest(BaseModel):
    text: str = Field(min_length=1, max_length=3000)
    locale: str = "en-US"
    voice: str = "en-US-JennyNeural"
    rate: float = Field(default=1.0, ge=0.6, le=1.35)


def fallback(req: TTSRequest, reason: str | None = None) -> dict[str, Any]:
    return {
        "provider": "browser-fallback",
        "audioBase64": None,
        "mimeType": None,
        "text": req.text,
        "locale": req.locale,
        "rate": req.rate,
        "providerError": reason,
        "disclaimer": "Server neural TTS is unavailable; the client may use the browser speech engine.",
    }


async def synthesize(req: TTSRequest) -> dict[str, Any]:
    if not AZURE_SPEECH_KEY or not AZURE_SPEECH_REGION:
        return fallback(req)
    voice = req.voice if VOICE_RE.match(req.voice) else "en-US-JennyNeural"
    rate_pct = round((req.rate - 1.0) * 100)
    ssml = (
        f'<speak version="1.0" xml:lang="{html.escape(req.locale)}">'
        f'<voice name="{html.escape(voice)}"><prosody rate="{rate_pct:+d}%">'
        f'{html.escape(req.text)}</prosody></voice></speak>'
    )
    endpoint = f"https://{AZURE_SPEECH_REGION}.tts.speech.microsoft.com/cognitiveservices/v1"
    headers = {
        "Ocp-Apim-Subscription-Key": AZURE_SPEECH_KEY,
        "Content-Type": "application/ssml+xml",
        "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
        "User-Agent": "LocCaoEnglish",
    }
    try:
        async with httpx.AsyncClient(timeout=25) as client:
            response = await client.post(endpoint, headers=headers, content=ssml.encode("utf-8"))
            response.raise_for_status()
        return {
            "provider": "azure-speech-neural-tts",
            "audioBase64": base64.b64encode(response.content).decode("ascii"),
            "mimeType": "audio/mpeg",
            "text": req.text,
            "locale": req.locale,
            "voice": voice,
            "rate": req.rate,
            "disclaimer": "Audio was synthesized by the configured Azure Speech neural voice.",
        }
    except Exception:
        return fallback(req, "neural TTS provider unavailable")


@router.post("/tts/synthesize")
async def tts(req: TTSRequest) -> dict[str, Any]:
    return await synthesize(req)
