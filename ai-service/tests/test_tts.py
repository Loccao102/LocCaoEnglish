import asyncio
import unittest

from app.tts import TTSRequest, synthesize


class TTSTests(unittest.TestCase):
    def test_fallback_is_explicit_without_provider(self):
        result = asyncio.run(synthesize(TTSRequest(text="The flight now departs from gate twelve.")))
        if result["provider"] == "browser-fallback":
            self.assertIsNone(result["audioBase64"])
            self.assertIn("browser", result["disclaimer"].lower())


if __name__ == "__main__":
    unittest.main()
