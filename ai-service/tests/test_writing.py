import json
import unittest
from unittest.mock import patch

import httpx
from fastapi import HTTPException
from pydantic import ValidationError
from app.writing import Assessment, WritingRequest, writing_score

ESSAY = "Public transport supports workers and reduces congestion. " * 8


def assessment():
    return {"overall": 0, "criteria": {key: {"band": 0, "evidence": "Public transport supports workers", "comment": "Develop the reason with an example."} for key in
            ("taskResponse", "coherenceCohesion", "lexicalResource", "grammarRangeAccuracy")},
            "strengths": ["You identify a relevant topic."], "improvements": ["Develop your position with supporting examples."]}


class WritingValidationTests(unittest.TestCase):
    def test_zero_and_all_four_criteria_survive(self):
        result = Assessment.model_validate(assessment())
        self.assertEqual(result.overall, 0)
        self.assertEqual(len(result.criteria), 4)

    def test_malformed_incomplete_and_nonfinite_are_rejected(self):
        changes = [lambda d: d.update(overall=None), lambda d: d.update(overall=True),
                   lambda d: d.update(overall="6"), lambda d: d.update(overall=float("nan")),
                   lambda d: d.update(overall=6.2), lambda d: d.update(overall=6),
                   lambda d: d["criteria"].pop("taskResponse"),
                   lambda d: d["criteria"]["taskResponse"].update(band=None),
                   lambda d: d.update(improvements=[" "]), lambda d: d.update(provider="pretend")]
        for change in changes:
            with self.subTest(change=change):
                data = assessment(); change(data)
                with self.assertRaises(ValidationError): Assessment.model_validate(data)


class WritingProviderTests(unittest.IsolatedAsyncioTestCase):
    def request(self):
        return WritingRequest(essay=ESSAY, task="Discuss investment in transport infrastructure.", rulesVersion="ielts-writing.v1")

    async def call(self, handler):
        client = httpx.AsyncClient
        transport = httpx.MockTransport(handler)
        with patch.dict("os.environ", {"LLM_CHAT_URL": "https://provider.test/chat", "LLM_MODEL": "fixture-model"}, clear=True), patch("app.writing.httpx.AsyncClient", side_effect=lambda **kw: client(transport=transport, **kw)):
            return await writing_score(self.request())

    async def test_receipt_metadata_comes_from_service_and_exact_essay_is_sent(self):
        def handler(req):
            payload = json.loads(req.content)
            self.assertEqual(json.loads(payload["messages"][1]["content"])["essay"], ESSAY)
            return httpx.Response(200, json={"choices": [{"message": {"content": json.dumps(assessment())}}]})
        result = await self.call(handler)
        self.assertEqual(result["model"], "fixture-model")
        self.assertEqual(result["provider"], "configured-llm")
        self.assertEqual(result["overall"], 0)

    async def test_unconfigured_fails_without_fabricating_a_score(self):
        with patch.dict("os.environ", {}, clear=True):
            with self.assertRaises(HTTPException) as caught: await writing_score(self.request())
        self.assertEqual(caught.exception.status_code, 503)

    async def test_provider_errors_missing_evidence_and_oversized_output_fail(self):
        wrong = assessment(); wrong["criteria"]["taskResponse"]["evidence"] = "An invented quotation."
        for response in [httpx.Response(503), httpx.Response(200, text="not-json"),
                         httpx.Response(200, json={"choices": []}),
                         httpx.Response(200, text="x" * 131073),
                         httpx.Response(200, json={"choices": [{"message": {"content": json.dumps(wrong)}}]})]:
            with self.subTest(response=response):
                with self.assertRaises(HTTPException) as caught: await self.call(lambda _: response)
                self.assertEqual(caught.exception.status_code, 503)

    async def test_timeout_fails_without_retry(self):
        calls = 0
        def timeout(req):
            nonlocal calls
            calls += 1
            raise httpx.ReadTimeout("timeout", request=req)
        with self.assertRaises(HTTPException): await self.call(timeout)
        self.assertEqual(calls, 1)
