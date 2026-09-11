import array
import base64
import io
import json
import math
import os
import sys
import wave
from collections import Counter
from typing import Any

import httpx
from fastapi import APIRouter
from pydantic import BaseModel, Field

router = APIRouter(prefix="/v1", tags=["pronunciation"])

AZURE_SPEECH_KEY = os.getenv("AZURE_SPEECH_KEY", "").strip()
AZURE_SPEECH_REGION = os.getenv("AZURE_SPEECH_REGION", "").strip()


class PronunciationRequest(BaseModel):
    audioBase64: str = Field(min_length=100, max_length=12_000_000)
    referenceText: str = Field(min_length=1, max_length=1000)
    transcript: str = Field(default="", max_length=2000)
    locale: str = "en-US"


def pronunciation_provider() -> str:
    return "azure-speech" if AZURE_SPEECH_KEY and AZURE_SPEECH_REGION else "local-audio-quality"


def _decode_audio(value: str) -> bytes:
    payload = value.split(",", 1)[1] if value.startswith("data:") and "," in value else value
    audio = base64.b64decode(payload, validate=True)
    if len(audio) > 8 * 1024 * 1024:
        raise ValueError("audio is too large")
    return audio


def _wav_metrics(audio: bytes) -> dict[str, Any]:
    with wave.open(io.BytesIO(audio), "rb") as wav:
        channels = wav.getnchannels()
        width = wav.getsampwidth()
        rate = wav.getframerate()
        frames = wav.getnframes()
        raw = wav.readframes(frames)
    if channels != 1 or width != 2:
        raise ValueError("expected mono 16-bit PCM WAV")
    samples = array.array("h")
    samples.frombytes(raw)
    if sys.byteorder == "big":
        samples.byteswap()
    if not samples:
        return {"durationSec": 0.0, "sampleRate": rate, "rms": 0.0, "silenceRatio": 1.0, "signalQuality": 0}
    duration = len(samples) / max(1, rate)
    square_mean = sum(float(v) * float(v) for v in samples) / len(samples)
    rms = math.sqrt(square_mean) / 32768.0
    silent = sum(1 for v in samples if abs(v) < 650)
    silence_ratio = silent / len(samples)
    duration_penalty = 25 if duration < 0.7 else 10 if duration < 1.2 else 0
    level_penalty = 25 if rms < 0.01 else 10 if rms < 0.025 else 0
    clipping = sum(1 for v in samples if abs(v) > 32000) / len(samples)
    quality = max(0, min(100, round(100 - silence_ratio * 35 - duration_penalty - level_penalty - clipping * 300)))
    return {
        "durationSec": round(duration, 2),
        "sampleRate": rate,
        "rms": round(rms, 4),
        "silenceRatio": round(silence_ratio, 3),
        "signalQuality": quality,
    }


def _text_match(reference: str, transcript: str) -> int | None:
    expected = [x.lower() for x in reference.split() if x.strip()]
    spoken = [x.lower() for x in transcript.split() if x.strip()]
    if not expected or not spoken:
        return None
    a, b = Counter(expected), Counter(spoken)
    matched = sum(min(a[word], b[word]) for word in a)
    return round(matched / len(expected) * 100)


def _fallback(req: PronunciationRequest, audio: bytes, reason: str | None = None) -> dict[str, Any]:
    metrics = _wav_metrics(audio)
    match = _text_match(req.referenceText, req.transcript)
    return {
        "provider": "local-audio-quality",
        "acousticAssessment": False,
        "overall": None,
        "scores": {
            "accuracy": None,
            "fluency": None,
            "completeness": None,
            "prosody": None,
            "textMatch": match,
            "signalQuality": metrics["signalQuality"],
        },
        "words": [],
        "audio": metrics,
        "providerError": reason,
        "coaching": [
            "The recording quality is checked locally, but pronunciation accuracy needs the configured acoustic provider.",
            "Keep the microphone 15–25 cm away and speak at a natural pace.",
            "Use the transcript match only as a completeness hint, not as a pronunciation score.",
        ],
        "disclaimer": "No acoustic pronunciation score is claimed because Azure Speech Pronunciation Assessment is not configured or was unavailable.",
    }


async def assess_pronunciation(req: PronunciationRequest) -> dict[str, Any]:
    try:
        audio = _decode_audio(req.audioBase64)
        metrics = _wav_metrics(audio)
    except Exception as exc:
        return {
            "provider": "invalid-audio",
            "acousticAssessment": False,
            "overall": None,
            "scores": {},
            "words": [],
            "audio": {},
            "coaching": ["Record again using the in-browser PCM recorder."],
            "disclaimer": f"Audio could not be analyzed: {str(exc)}",
        }

    if not AZURE_SPEECH_KEY or not AZURE_SPEECH_REGION:
        return _fallback(req, audio)

    config = {
        "ReferenceText": req.referenceText,
        "GradingSystem": "HundredMark",
        "Granularity": "Phoneme",
        "Dimension": "Comprehensive",
        "EnableMiscue": True,
        "EnableProsodyAssessment": True,
    }
    assessment = base64.b64encode(json.dumps(config).encode("utf-8")).decode("ascii")
    url = f"https://{AZURE_SPEECH_REGION}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1"
    headers = {
        "Ocp-Apim-Subscription-Key": AZURE_SPEECH_KEY,
        "Pronunciation-Assessment": assessment,
        "Content-Type": "audio/wav; codecs=audio/pcm; samplerate=16000",
        "Accept": "application/json;text/xml",
    }
    params = {"language": req.locale, "format": "detailed"}
    try:
        async with httpx.AsyncClient(timeout=35) as client:
            response = await client.post(url, params=params, headers=headers, content=audio)
            response.raise_for_status()
            data = response.json()
        best = (data.get("NBest") or [{}])[0]
        pa = best.get("PronunciationAssessment") or {}
        words = []
        for item in best.get("Words") or []:
            word_pa = item.get("PronunciationAssessment") or {}
            phonemes = []
            for phoneme in item.get("Phonemes") or []:
                phoneme_pa = phoneme.get("PronunciationAssessment") or {}
                phonemes.append({"phoneme": phoneme.get("Phoneme"), "accuracy": phoneme_pa.get("AccuracyScore")})
            words.append({
                "word": item.get("Word"),
                "accuracy": word_pa.get("AccuracyScore"),
                "errorType": word_pa.get("ErrorType", "None"),
                "phonemes": phonemes,
            })
        return {
            "provider": "azure-speech-pronunciation-assessment",
            "acousticAssessment": True,
            "overall": pa.get("PronScore"),
            "scores": {
                "accuracy": pa.get("AccuracyScore"),
                "fluency": pa.get("FluencyScore"),
                "completeness": pa.get("CompletenessScore"),
                "prosody": pa.get("ProsodyScore"),
                "textMatch": _text_match(req.referenceText, req.transcript),
                "signalQuality": metrics["signalQuality"],
            },
            "words": words[:60],
            "audio": metrics,
            "recognitionText": best.get("Display") or data.get("DisplayText"),
            "coaching": [
                "Open the lowest-scoring word and repeat it slowly, then return to full-sentence speed.",
                "Compare accuracy with prosody: clear sounds and natural rhythm are separate skills.",
                "Repeat the same sentence once more and aim to improve the weakest dimension, not every score at once.",
            ],
            "disclaimer": "Acoustic scores are produced by Azure Speech Pronunciation Assessment and are learning feedback, not an official IELTS score.",
        }
    except Exception as exc:
        return _fallback(req, audio, "acoustic provider unavailable")


@router.post("/pronunciation/score")
async def pronunciation_score(req: PronunciationRequest) -> dict[str, Any]:
    return await assess_pronunciation(req)
