import array
import asyncio
import base64
import io
import hashlib
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
    audioBase64: str = Field(min_length=1, max_length=533336)
    referenceText: str = Field(min_length=1, max_length=1000)
    transcript: str = Field(default="", max_length=2048)
    locale: str = "en-US"


def pronunciation_provider() -> str:
    return "azure-speech" if AZURE_SPEECH_KEY and AZURE_SPEECH_REGION else "local-audio-quality"


def _decode_audio(value: str) -> bytes:
    payload = value.split(",", 1)[1] if value.startswith("data:") and "," in value else value
    audio = base64.b64decode(payload, validate=True)
    if len(audio) > 400000:
        raise ValueError("audio is too large")
    return audio


def _wav_metrics(audio: bytes) -> dict[str, Any]:
    if len(audio) > 400000:
        raise ValueError("recording exceeds the short-practice limit")
    with wave.open(io.BytesIO(audio), "rb") as wav:
        channels = wav.getnchannels()
        width = wav.getsampwidth()
        rate = wav.getframerate()
        frames = wav.getnframes()
        raw = wav.readframes(frames)
    if channels != 1 or width != 2 or rate != 16000 or frames < 1 or frames > 16000 * 12 or len(raw) != frames * 2:
        raise ValueError("expected a complete mono 16-bit 16kHz PCM WAV of at most 12 seconds")
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
        async with asyncio.timeout(20), httpx.AsyncClient(timeout=20) as client:
            async with client.stream("POST", url, params=params, headers=headers, content=audio) as response:
                response.raise_for_status()
                body = bytearray()
                async for chunk in response.aiter_bytes():
                    body.extend(chunk)
                    if len(body) > 131072:
                        raise ValueError("provider response too large")
        data = json.loads(body)
        if data.get("RecognitionStatus") != "Success":
            raise ValueError("recognition did not succeed")
        best = data["NBest"][0]
        pa = best["PronunciationAssessment"]
        overall = _score(pa.get("PronScore"))
        scores = {"accuracy": _score(pa.get("AccuracyScore")), "fluency": _score(pa.get("FluencyScore")),
                  "completeness": _score(pa.get("CompletenessScore")), "prosody": _score(pa.get("ProsodyScore"), optional=True)}
        words = _words(best.get("Words", []))
        return {
            "provider": "azure-speech-pronunciation-assessment",
            "model": "provider-managed-unspecified",
            "methodVersion": "guided-pronunciation.v1",
            "locale": req.locale,
            "audioSHA256": hashlib.sha256(audio).hexdigest(),
            "referenceSHA256": hashlib.sha256(req.referenceText.encode("utf-8")).hexdigest(),
            "acousticAssessment": True,
            "overall": overall,
            "scores": scores,
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
    except (httpx.HTTPError, TimeoutError, ValueError, KeyError, IndexError, TypeError, AttributeError):
        return _fallback(req, audio, "acoustic provider unavailable")


def _score(value, optional=False):
    if value is None and optional:
        return None
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or not 0 <= value <= 100:
        raise ValueError("invalid acoustic score")
    return value


def _words(items):
    if not isinstance(items, list):
        raise ValueError("invalid word evidence")
    words = []
    for item in items[:60]:
        word = item.get("Word")
        if not isinstance(word, str) or not word.strip() or len(word) > 100:
            raise ValueError("invalid word")
        pa = item.get("PronunciationAssessment") or {}
        phonemes = item.get("Phonemes") or []
        if not isinstance(phonemes, list) or len(phonemes) > 50:
            raise ValueError("invalid phonemes")
        details = []
        for phoneme in phonemes:
            text = phoneme.get("Phoneme")
            if not isinstance(text, str) or not text.strip() or len(text) > 25:
                raise ValueError("invalid phoneme")
            details.append({"phoneme": text, "accuracy": _score((phoneme.get("PronunciationAssessment") or {}).get("AccuracyScore"), optional=True)})
        error = pa.get("ErrorType", "None")
        if not isinstance(error, str) or len(error) > 100:
            raise ValueError("invalid error type")
        words.append({"word": word, "accuracy": _score(pa.get("AccuracyScore"), optional=True), "errorType": error, "phonemes": details})
    return words


@router.post("/pronunciation/score")
async def pronunciation_score(req: PronunciationRequest) -> dict[str, Any]:
    return await assess_pronunciation(req)
