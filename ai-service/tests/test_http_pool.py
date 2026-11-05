import asyncio
import base64
import json
import unittest
from unittest.mock import patch

import httpx

from app import main, tts


class OutboundPoolingTests(unittest.TestCase):
    def test_lifespan_allocates_and_closes_one_pool(self):
        async def scenario():
            async with main.lifespan(main.app):
                shared = main.app.state.outbound_http
                self.assertIsInstance(shared, httpx.AsyncClient)
                self.assertFalse(shared.is_closed)
            self.assertTrue(shared.is_closed)
            self.assertFalse(hasattr(main.app.state, "outbound_http"))
        asyncio.run(scenario())

    def test_llm_requests_use_shared_client_without_opening_real_connections(self):
        calls = []

        def handler(request):
            calls.append(request.url.path)
            self.assertEqual(request.headers["content-type"], "application/json")
            return httpx.Response(200, json={
                "choices": [{"message": {"content": json.dumps({"ok": True, "provider": "test"})}}]
            })

        async def scenario():
            async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
                main.app.state.outbound_http = client
                try:
                    with patch.object(main, "LLM_CHAT_URL", "https://fake-llm.test/chat"), \
                         patch.object(main, "LLM_MODEL", "test-model"):
                        first = await main.llm_json("system", {"attempt": 1})
                        second = await main.llm_json("system", {"attempt": 2})
                    self.assertEqual(first["provider"], "test")
                    self.assertTrue(second["ok"])
                finally:
                    del main.app.state.outbound_http
        asyncio.run(scenario())
        self.assertEqual(calls, ["/chat", "/chat"])

    def test_tts_reuses_injected_pool_and_preserves_fallback(self):
        calls = []

        def handler(request):
            calls.append(request.url.path)
            self.assertIn(b"<speak", request.content)
            return httpx.Response(200, content=b"ID3demo-mp3")

        async def scenario():
            async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
                with patch.object(tts, "AZURE_SPEECH_KEY", "test-only"), \
                     patch.object(tts, "AZURE_SPEECH_REGION", "testregion"):
                    result = await tts.synthesize(tts.TTSRequest(text="Hello world"), client)
                    self.assertEqual(result["provider"], "azure-speech-neural-tts")
                    self.assertEqual(base64.b64decode(result["audioBase64"]), b"ID3demo-mp3")

                    with patch.object(tts, "AZURE_SPEECH_KEY", ""):
                        fallback = await tts.synthesize(tts.TTSRequest(text="Hello world"), client)
                        self.assertEqual(fallback["provider"], "browser-fallback")
                        self.assertIsNone(fallback["audioBase64"])
        asyncio.run(scenario())
        self.assertEqual(calls, ["/cognitiveservices/v1"])


if __name__ == "__main__":
    unittest.main()
