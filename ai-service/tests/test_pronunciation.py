import asyncio
import base64
import io
import math
import struct
import unittest
import wave
import copy
import hashlib
import json
from unittest.mock import patch
import httpx

from app.pronunciation import PronunciationRequest, assess_pronunciation


def wav_b64(seconds: float = 1.2, rate: int = 16000) -> str:
    frames = bytearray()
    for i in range(int(seconds * rate)):
        value = int(math.sin(2 * math.pi * 220 * i / rate) * 5000)
        frames.extend(struct.pack("<h", value))
    buf = io.BytesIO()
    with wave.open(buf, "wb") as out:
        out.setnchannels(1)
        out.setsampwidth(2)
        out.setframerate(rate)
        out.writeframes(bytes(frames))
    return base64.b64encode(buf.getvalue()).decode("ascii")


class PronunciationTests(unittest.TestCase):
    def test_fallback_never_claims_acoustic_accuracy_without_provider(self):
        req = PronunciationRequest(audioBase64=wav_b64(), referenceText="Could I have a window seat please", transcript="Could I have a window seat please")
        with patch("app.pronunciation.AZURE_SPEECH_KEY", ""), patch("app.pronunciation.AZURE_SPEECH_REGION", ""):
            result = asyncio.run(assess_pronunciation(req))
            self.assertEqual(result["provider"], "local-audio-quality")
            self.assertFalse(result["acousticAssessment"])
            self.assertIsNone(result["overall"])
            self.assertGreater(result["scores"]["signalQuality"], 0)
            self.assertEqual(result["scores"]["textMatch"], 100)

    def test_invalid_recordings_never_reach_provider(self):
        for audio in [wav_b64(rate=8000), wav_b64(seconds=0), wav_b64(seconds=12.1), "!" * 100]:
            with self.subTest(audio_length=len(audio)), patch("app.pronunciation.httpx.AsyncClient") as client:
                result = asyncio.run(assess_pronunciation(PronunciationRequest(audioBase64=audio, referenceText="Hello")))
                self.assertFalse(result["acousticAssessment"])
                self.assertIsNone(result["overall"])
                client.assert_not_called()


def provider_result():
    return {"RecognitionStatus": "Success", "NBest": [{"PronunciationAssessment": {"PronScore": 0, "AccuracyScore": 0, "FluencyScore": 0, "CompletenessScore": 0}, "Words": [{"Word": "hello", "PronunciationAssessment": {"AccuracyScore": 0, "ErrorType": "Mispronunciation"}, "Phonemes": [{"Phoneme": "h", "PronunciationAssessment": {"AccuracyScore": 0}}]}]}]}


class AcousticProviderTests(unittest.IsolatedAsyncioTestCase):
    async def call(self, handler):
        client = httpx.AsyncClient
        with patch("app.pronunciation.AZURE_SPEECH_KEY", "fixture"), patch("app.pronunciation.AZURE_SPEECH_REGION", "fixture"), patch("app.pronunciation.httpx.AsyncClient", side_effect=lambda **kw: client(transport=httpx.MockTransport(handler), **kw)):
            return await assess_pronunciation(PronunciationRequest(audioBase64=wav_b64(), referenceText="Hello", transcript="hello"))

    async def test_exact_audio_reference_and_real_zero_are_retained(self):
        calls = 0
        def handler(req):
            nonlocal calls
            calls += 1
            self.assertEqual(req.content, base64.b64decode(wav_b64()))
            config = json.loads(base64.b64decode(req.headers["Pronunciation-Assessment"]))
            self.assertEqual(config["ReferenceText"], "Hello")
            self.assertEqual(config["Granularity"], "Phoneme")
            return httpx.Response(200, json=provider_result())
        result = await self.call(handler)
        self.assertEqual(calls, 1)
        self.assertTrue(result["acousticAssessment"])
        self.assertEqual(result["overall"], 0)
        self.assertEqual(result["words"][0]["phonemes"][0]["accuracy"], 0)
        self.assertEqual(result["audioSHA256"], hashlib.sha256(base64.b64decode(wav_b64())).hexdigest())
        self.assertEqual(result["referenceSHA256"], hashlib.sha256(b"Hello").hexdigest())
        self.assertEqual(result["model"], "provider-managed-unspecified")
        self.assertIsNone(result["scores"]["prosody"])
        self.assertNotIn("textMatch", result["scores"])

    async def test_provider_failures_and_invalid_evidence_never_invent_scores(self):
        fixtures = [httpx.Response(503), httpx.Response(200, text="x" * 131073), httpx.Response(200, json={"NBest": []})]
        for change in [lambda d: d.update(RecognitionStatus="NoMatch"), lambda d: d["NBest"][0]["PronunciationAssessment"].update(PronScore=True), lambda d: d["NBest"][0]["PronunciationAssessment"].update(AccuracyScore=None), lambda d: d["NBest"][0]["PronunciationAssessment"].update(FluencyScore=101), lambda d: d["NBest"][0]["PronunciationAssessment"].update(CompletenessScore="80"), lambda d: d["NBest"][0]["Words"][0]["Phonemes"][0]["PronunciationAssessment"].update(AccuracyScore=float("nan"))]:
            data = copy.deepcopy(provider_result()); change(data)
            fixtures.append(httpx.Response(200, text=json.dumps(data)))
        for response in fixtures:
            with self.subTest(response=response):
                result = await self.call(lambda _: response)
                self.assertFalse(result["acousticAssessment"])
                self.assertIsNone(result["overall"])
                self.assertEqual(result["words"], [])

    async def test_timeout_has_no_automatic_provider_retry(self):
        calls = 0
        def handler(req):
            nonlocal calls
            calls += 1
            raise httpx.ReadTimeout("fixture", request=req)
        result = await self.call(handler)
        self.assertEqual(calls, 1)
        self.assertFalse(result["acousticAssessment"])
        self.assertIsNone(result["overall"])


if __name__ == "__main__":
    unittest.main()
