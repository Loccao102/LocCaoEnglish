import asyncio
import base64
import io
import math
import struct
import unittest
import wave

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
        result = asyncio.run(assess_pronunciation(req))
        if result["provider"] == "local-audio-quality":
            self.assertFalse(result["acousticAssessment"])
            self.assertIsNone(result["overall"])
            self.assertGreater(result["scores"]["signalQuality"], 0)
            self.assertEqual(result["scores"]["textMatch"], 100)


if __name__ == "__main__":
    unittest.main()
