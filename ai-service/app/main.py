import json
import os
import re
from collections import Counter
from typing import Any

import httpx
from fastapi import FastAPI
from pydantic import BaseModel, Field

from app.roleplay import roleplay_reply
from app.writing import WritingRequest, writing_score

app = FastAPI(title="LocCaoEnglish AI Service", version="0.4.0")

LLM_CHAT_URL = os.getenv("LLM_CHAT_URL", "").strip()
LLM_API_KEY = os.getenv("LLM_API_KEY", "").strip()
LLM_MODEL = os.getenv("LLM_MODEL", "").strip()

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

def local_speaking_feedback(req: SpeakingRequest) -> dict[str, Any]:
    spoken=tokenize(req.transcript);target=tokenize(req.target);overlap=0.0
    if target:
        target_counts=Counter(target);spoken_counts=Counter(spoken);matched=sum(min(target_counts[w],spoken_counts[w]) for w in target_counts);overlap=matched/max(1,len(target))
    fillers=sum(spoken.count(x) for x in ["um","uh","like","actually"]);fluency=clamp(5.0+min(2.0,len(spoken)/35)-min(1.0,fillers*.2),4,9);pronunciation=clamp(4.5+overlap*4.0 if target else 6.0,4,9);vocabulary=clamp(5.0+min(2.5,len(set(spoken))/max(12,len(spoken))*3),4,9);grammar=clamp(5.2+(0.8 if len(spoken)>=12 else 0.2),4,9);overall=half((fluency+pronunciation+vocabulary+grammar)/4)
    return {"provider":"local-transcript-analysis","overall":overall,"scores":{"fluency":half(fluency),"pronunciationProxy":half(pronunciation),"vocabulary":half(vocabulary),"grammar":half(grammar)},"match":round(overlap*100),"coaching":["Repeat the sentence in thought groups instead of word by word.","Stress content words and reduce function words for a more natural rhythm.","Record a second attempt and try to keep the meaning while changing the wording slightly."],"disclaimer":"Pronunciation is approximated from speech-recognition text until an acoustic scoring provider is connected."}

def local_exercises(req: ExerciseRequest) -> dict[str, Any]:
    weak=req.weak_items or ["clarity","accuracy"];templates=[("word-link","Connect a key word to its strongest synonym, antonym, collocation, or word-family form."),("dictation","Listen, reconstruct the sentence, then compare every changed word."),("sentence-builder","Reorder chunks into a natural sentence and explain the grammar choice."),("micro-writing","Write 2-3 sentences using the target language in a real situation."),("speak","Answer aloud for 30-45 seconds, then repeat with one stronger collocation.")];items=[]
    for i in range(req.count):
        kind,instruction=templates[i%len(templates)];items.append({"id":f"generated-{i+1}","type":kind,"skill":req.skill,"topic":req.topic,"level":req.level,"instruction":instruction,"focus":weak[i%len(weak)]})
    return {"provider":"adaptive-template-engine","items":items}

def local_conversation(req: ConversationRequest) -> dict[str, Any]:
    return roleplay_reply(req.message, req.scenario, req.history)

async def llm_json(system: str, user: dict[str, Any]) -> dict[str, Any] | None:
    if not LLM_CHAT_URL or not LLM_MODEL: return None
    headers={"Content-Type":"application/json"}
    if LLM_API_KEY: headers["Authorization"]=f"Bearer {LLM_API_KEY}"
    payload={"model":LLM_MODEL,"temperature":0.2,"response_format":{"type":"json_object"},"messages":[{"role":"system","content":system},{"role":"user","content":json.dumps(user,ensure_ascii=False)}]}
    try:
        async with httpx.AsyncClient(timeout=35) as client:
            response=await client.post(LLM_CHAT_URL,headers=headers,json=payload);response.raise_for_status();data=response.json();content=data["choices"][0]["message"]["content"];return json.loads(content)
    except Exception: return None

@app.get("/health")
async def health() -> dict[str, Any]: return {"status":"ok","llmConfigured":bool(LLM_CHAT_URL and LLM_MODEL)}

app.post("/v1/writing/score")(writing_score)

@app.post("/v1/speaking/feedback")
async def speaking_feedback(req: SpeakingRequest) -> dict[str, Any]:
    system="You are an English speaking coach. Analyze only the transcript evidence supplied. Return JSON with overall, scores (fluency, pronunciationProxy, vocabulary, grammar), coaching, match, disclaimer. Never claim acoustic pronunciation accuracy when no audio is provided.";remote=await llm_json(system,req.model_dump())
    if remote: remote["provider"]="configured-llm";return remote
    return local_speaking_feedback(req)

@app.post("/v1/exercises/generate")
async def exercises(req: ExerciseRequest) -> dict[str, Any]:
    system="Create short, varied English-learning exercises from the learner weakness data. Return JSON with an items array. Each item needs id, type, skill, topic, level, instruction, focus.";remote=await llm_json(system,req.model_dump())
    if remote: remote["provider"]="configured-llm";return remote
    return local_exercises(req)

@app.post("/v1/conversation/reply")
async def conversation(req: ConversationRequest) -> dict[str, Any]:
    system="Role-play a realistic English conversation for a learner. Stay in scenario, use concise natural English, adapt to the stated level, and return JSON with reply, objective, correction. Correct only errors that materially block natural communication.";remote=await llm_json(system,req.model_dump())
    if remote: remote["provider"]="configured-llm";return remote
    return local_conversation(req)
