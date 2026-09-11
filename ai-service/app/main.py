import json
import math
import os
import re
from collections import Counter
from typing import Any

import httpx
from fastapi import FastAPI
from pydantic import BaseModel, Field

app = FastAPI(title="LocCaoEnglish AI Service", version="0.2.0")

LLM_CHAT_URL = os.getenv("LLM_CHAT_URL", "").strip()
LLM_API_KEY = os.getenv("LLM_API_KEY", "").strip()
LLM_MODEL = os.getenv("LLM_MODEL", "").strip()


class WritingRequest(BaseModel):
    essay: str = Field(min_length=20, max_length=12000)
    task: str = ""
    level: str = "IELTS"


class SpeakingRequest(BaseModel):
    transcript: str = Field(min_length=1, max_length=4000)
    target: str = ""
    topic: str = ""


class ExerciseRequest(BaseModel):
    skill: str
    topic: str = "general English"
    level: str = "B1"
    count: int = Field(default=5, ge=1, le=12)
    weak_items: list[str] = []


class ConversationRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    scenario: str = "airport"
    level: str = "B1"
    history: list[dict[str, str]] = []


def clamp(value: float, low: float = 4.0, high: float = 8.5) -> float:
    return max(low, min(high, value))


def half(value: float) -> float:
    return round(value * 2) / 2


def tokenize(value: str) -> list[str]:
    return re.findall(r"[A-Za-z']+", value.lower())


def local_writing_score(req: WritingRequest) -> dict[str, Any]:
    words = tokenize(req.essay)
    count = len(words)
    paragraphs = [p for p in re.split(r"\n\s*\n", req.essay) if p.strip()]
    sentences = [s.strip() for s in re.split(r"[.!?]+", req.essay) if s.strip()]
    unique_ratio = len(set(words)) / max(1, count)
    avg_sentence = count / max(1, len(sentences))
    lower = req.essay.lower()
    connectors = ["however", "therefore", "moreover", "furthermore", "although", "whereas", "consequently", "nevertheless", "in contrast", "for example"]
    connector_hits = sum(1 for x in connectors if x in lower)
    complex_hits = sum(lower.count(x) for x in ["although", "while", "whereas", "which", "that", "because", "despite", "unless"])

    task = half(clamp(4 + min(2.0, count / 140) + (0.5 if len(paragraphs) >= 4 else 0) + (0.5 if count >= 250 else 0)))
    coherence = half(clamp(4 + min(1.5, connector_hits * 0.22) + (1 if len(paragraphs) >= 4 else 0.4) + (0.5 if 10 <= avg_sentence <= 28 else 0)))
    lexical = half(clamp(4 + (1.6 if unique_ratio >= .52 else 1.1 if unique_ratio >= .42 else .6) + (0.8 if count >= 220 else .3)))
    grammar = half(clamp(4 + min(1.5, complex_hits * .18) + (0.8 if len(sentences) >= 8 else .3) + (0.4 if 10 <= avg_sentence <= 30 else 0)))
    overall = half((task + coherence + lexical + grammar) / 4)

    strengths = []
    improvements = []
    if count >= 250:
        strengths.append("You developed the response to an IELTS Task 2 length.")
    else:
        improvements.append("Develop the argument further; aim for at least 250 words in full Task 2 practice.")
    if connector_hits >= 4:
        strengths.append("Logical linking language is visible across the response.")
    else:
        improvements.append("Make paragraph relationships explicit with selective linking language rather than adding connectors mechanically.")
    if unique_ratio >= .45:
        strengths.append("Vocabulary range is reasonably varied for the sample length.")
    else:
        improvements.append("Reduce repeated high-frequency words by using precise topic vocabulary and natural collocations.")
    if complex_hits < 3:
        improvements.append("Add controlled complex sentences using subordination, relative clauses, or concession.")

    return {
        "provider": "local-heuristic",
        "overall": overall,
        "criteria": {
            "taskResponse": task,
            "coherenceCohesion": coherence,
            "lexicalResource": lexical,
            "grammarRangeAccuracy": grammar,
        },
        "metrics": {"wordCount": count, "paragraphs": len(paragraphs), "uniqueRatio": round(unique_ratio, 3)},
        "strengths": strengths or ["The response contains enough language for targeted feedback."],
        "improvements": improvements or ["Now focus on precision: make each sentence directly support the central position."],
        "rewriteExample": "A stronger revision should state one precise claim, explain why it matters, and support it with a concrete example before linking back to the essay position.",
        "disclaimer": "Practice estimate only; this is not an official IELTS score.",
    }


def local_speaking_feedback(req: SpeakingRequest) -> dict[str, Any]:
    spoken = tokenize(req.transcript)
    target = tokenize(req.target)
    overlap = 0.0
    if target:
        target_counts = Counter(target)
        spoken_counts = Counter(spoken)
        matched = sum(min(target_counts[w], spoken_counts[w]) for w in target_counts)
        overlap = matched / max(1, len(target))
    fillers = sum(spoken.count(x) for x in ["um", "uh", "like", "actually"])
    fluency = clamp(5.0 + min(2.0, len(spoken) / 35) - min(1.0, fillers * .2), 4, 9)
    pronunciation = clamp(4.5 + overlap * 4.0 if target else 6.0, 4, 9)
    vocabulary = clamp(5.0 + min(2.5, len(set(spoken)) / max(12, len(spoken)) * 3), 4, 9)
    grammar = clamp(5.2 + (0.8 if len(spoken) >= 12 else 0.2), 4, 9)
    overall = half((fluency + pronunciation + vocabulary + grammar) / 4)
    return {
        "provider": "local-transcript-analysis",
        "overall": overall,
        "scores": {"fluency": half(fluency), "pronunciationProxy": half(pronunciation), "vocabulary": half(vocabulary), "grammar": half(grammar)},
        "match": round(overlap * 100),
        "coaching": [
            "Repeat the sentence in thought groups instead of word by word.",
            "Stress content words and reduce function words for a more natural rhythm.",
            "Record a second attempt and try to keep the meaning while changing the wording slightly.",
        ],
        "disclaimer": "Pronunciation is approximated from speech-recognition text until an acoustic scoring provider is connected.",
    }


def local_exercises(req: ExerciseRequest) -> dict[str, Any]:
    weak = req.weak_items or ["clarity", "accuracy"]
    templates = [
        ("word-link", "Connect a key word to its strongest synonym, antonym, collocation, or word-family form."),
        ("dictation", "Listen, reconstruct the sentence, then compare every changed word."),
        ("sentence-builder", "Reorder chunks into a natural sentence and explain the grammar choice."),
        ("micro-writing", "Write 2-3 sentences using the target language in a real situation."),
        ("speak", "Answer aloud for 30-45 seconds, then repeat with one stronger collocation."),
    ]
    items = []
    for i in range(req.count):
        kind, instruction = templates[i % len(templates)]
        items.append({"id": f"generated-{i+1}", "type": kind, "skill": req.skill, "topic": req.topic, "level": req.level, "instruction": instruction, "focus": weak[i % len(weak)]})
    return {"provider": "adaptive-template-engine", "items": items}


def local_conversation(req: ConversationRequest) -> dict[str, Any]:
    text = req.message.lower()
    if req.scenario == "airport":
        if any(x in text for x in ["missed", "late", "delay", "miss my"]):
            reply = "I’m sorry about that. I can help you rebook. What was your original destination, and do you prefer the earliest available flight or a later one?"
            objective = "Give your destination and state a clear preference."
        elif any(x in text for x in ["earliest", "next flight", "another flight", "rebook"]):
            reply = "The earliest option leaves at 7:40 p.m. There is one seat left, but it has a short connection. Would you like me to book it?"
            objective = "Accept or reject the option and ask one useful follow-up question."
        elif any(x in text for x in ["yes", "book", "take it"]):
            reply = "Done. Your new boarding pass is ready. Before you go, can you confirm which gate you should head to and when boarding starts?"
            objective = "Confirm the gate and boarding time to finish the mission."
        else:
            reply = "Good afternoon. How can I help you with your flight today?"
            objective = "Explain that you missed your flight and ask to be rebooked."
    else:
        reply = "Tell me a little more so I can respond naturally in this role-play."
        objective = "Continue the conversation with a complete sentence."
    return {"provider": "scenario-engine", "reply": reply, "objective": objective, "correction": None}


async def llm_json(system: str, user: dict[str, Any]) -> dict[str, Any] | None:
    if not LLM_CHAT_URL or not LLM_MODEL:
        return None
    headers = {"Content-Type": "application/json"}
    if LLM_API_KEY:
        headers["Authorization"] = f"Bearer {LLM_API_KEY}"
    payload = {
        "model": LLM_MODEL,
        "temperature": 0.2,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": json.dumps(user, ensure_ascii=False)},
        ],
    }
    try:
        async with httpx.AsyncClient(timeout=35) as client:
            response = await client.post(LLM_CHAT_URL, headers=headers, json=payload)
            response.raise_for_status()
            data = response.json()
            content = data["choices"][0]["message"]["content"]
            return json.loads(content)
    except Exception:
        return None


@app.get("/health")
async def health() -> dict[str, Any]:
    return {"status": "ok", "llmConfigured": bool(LLM_CHAT_URL and LLM_MODEL)}


@app.post("/v1/writing/score")
async def writing_score(req: WritingRequest) -> dict[str, Any]:
    system = "You are a cautious IELTS Writing coach. Return JSON only with overall, criteria (taskResponse, coherenceCohesion, lexicalResource, grammarRangeAccuracy), strengths, improvements, rewriteExample, disclaimer. Scores are practice estimates in 0.5 bands and must not be presented as official examiner scores."
    remote = await llm_json(system, req.model_dump())
    if remote:
        remote["provider"] = "configured-llm"
        remote.setdefault("disclaimer", "Practice estimate only; not an official IELTS score.")
        return remote
    return local_writing_score(req)


@app.post("/v1/speaking/feedback")
async def speaking_feedback(req: SpeakingRequest) -> dict[str, Any]:
    system = "You are an English speaking coach. Analyze only the transcript evidence supplied. Return JSON with overall, scores (fluency, pronunciationProxy, vocabulary, grammar), coaching, match, disclaimer. Never claim acoustic pronunciation accuracy when no audio is provided."
    remote = await llm_json(system, req.model_dump())
    if remote:
        remote["provider"] = "configured-llm"
        return remote
    return local_speaking_feedback(req)


@app.post("/v1/exercises/generate")
async def exercises(req: ExerciseRequest) -> dict[str, Any]:
    system = "Create short, varied English-learning exercises from the learner weakness data. Return JSON with an items array. Each item needs id, type, skill, topic, level, instruction, focus."
    remote = await llm_json(system, req.model_dump())
    if remote:
        remote["provider"] = "configured-llm"
        return remote
    return local_exercises(req)


@app.post("/v1/conversation/reply")
async def conversation(req: ConversationRequest) -> dict[str, Any]:
    system = "Role-play a realistic English conversation for a learner. Stay in scenario, use concise natural English, adapt to the stated level, and return JSON with reply, objective, correction. Correct only errors that materially block natural communication."
    remote = await llm_json(system, req.model_dump())
    if remote:
        remote["provider"] = "configured-llm"
        return remote
    return local_conversation(req)
