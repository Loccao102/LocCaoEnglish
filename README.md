# LocCao English

A game-first English learning platform that turns every practice attempt into an adaptive learning signal. The product combines vocabulary graphs, mini-games, reading, listening, dictation, speaking, IELTS-style writing feedback, spaced repetition and real-world AI role-play missions.

> IELTS scores shown in the app are **practice estimates only**, not official IELTS results or examiner scores.

## What is playable now

- **Word Link** — synonym, antonym, meaning, word family and collocation links.
- **Word Graph** — interactive knowledge graph with relationship-testing mode.
- **Collocation Factory** — build natural word combinations.
- **Sentence Builder** — reconstruct natural English syntax.
- **Grammar Repair** — diagnose and repair broken sentence patterns.
- **Reading Race** — skim/scan comprehension.
- **Story Choice** — branching reading + pragmatic language scenario.
- **Listen & Pick** — browser-TTS listening comprehension.
- **Dictation Rush** — listen, reconstruct, score accuracy and schedule weak items.
- **Shadow Me** — browser speech recognition plus transcript-based coach feedback.
- **IELTS Writing Lab** — four-criterion practice scoring with AI/local fallback.
- **Airport Boss** — multi-skill mission ending in an AI airline-agent conversation.
- **Adaptive Review** — wrong answers become spaced-review items automatically.

## Architecture

```text
Next.js 16 / React 19
        |
        v
Go HTTP API :8080
  |       |       \
  |       |        -> AI Service (FastAPI) :8090
  |       |               |
  |       |               -> optional OpenAI-compatible LLM endpoint
  |       |
  |       -> adaptive plan + spaced repetition engine
  |
PostgreSQL :5432

Redis :6379 is included for the next realtime/queue layer.
```

The Go API falls back to an in-memory demo store if `DATABASE_URL` is not set. The AI service falls back to deterministic scoring/generation if no model endpoint is configured. This keeps the whole learning flow usable during local development.

## Quick start — frontend only

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. Games still work with local fallback behavior if the backend is offline.

## Full stack with Docker

```bash
cp .env.example .env
docker compose up --build
```

Then open:

- Web: `http://localhost:3000`
- Go API health: `http://localhost:8080/health`
- AI service health: `http://localhost:8090/health`

No external AI key is required for the fallback mode.

## Optional model connection

Set these in `.env`:

```env
LLM_CHAT_URL=https://your-provider.example/v1/chat/completions
LLM_API_KEY=...
LLM_MODEL=...
```

`LLM_CHAT_URL` is intentionally explicit so the AI service is provider-agnostic. It expects an OpenAI-compatible chat-completions request/response shape. When it is blank or fails, the service uses its local engines.

## Adaptive learning loop

```text
Play / write / speak
        ↓
Learning attempt
        ↓
Update skill confidence + XP
        ↓
Weak answer → review queue
        ↓
Spaced repetition schedule
        ↓
Daily adaptive route chooses weakest skills
        ↓
Boss mission applies skills in context
```

Core persistence tables: `users`, `user_skills`, `attempts`, and `review_items`.

## Repository layout

```text
app/                 Next.js routes
components/          game, coach, graph and mission UI
lib/api.ts           frontend API client
backend/             Go API + adaptive engine + PostgreSQL store
ai-service/          FastAPI AI/fallback service
docker-compose.yml   local full stack
.github/workflows/   frontend/backend/AI/Compose CI
```

## Current product boundary

The current version reaches the planned MVP/product loop: all core English skills have a playable surface, attempts feed an adaptive profile, weak items enter spaced review, Writing/Speaking can call an AI coaching layer, and the Airport Boss combines multiple skills in a scenario.

Production expansion can add acoustic pronunciation scoring, richer content authoring, teacher/admin tools, more knowledge graphs, multiplayer/leaderboards, native audio assets, Redis-backed jobs and additional language packs without replacing the current architecture.
