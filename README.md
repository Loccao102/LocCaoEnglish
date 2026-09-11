# LocCao English

Game-first English learning platform with adaptive quests, vocabulary graphs, mini-games, listening, dictation, speaking, IELTS-style practice, spaced repetition, AI role-play missions and progression systems.

## Player loop

Onboarding → Daily Quest → XP → Level → World Unlock → Evidence Gate → Boss → Trophy/Cosmetic → next chapter.

## Travel District campaign

Travel District is a sequential campaign rather than a static lesson list:

1. **Airport Crisis — Missed Flight**: Word Link + Listening + Speaking evidence, then an airline-service NPC negotiation.
2. **Hotel Check-in — Reservation Missing**: after Airport clear, earn fresh Story Choice + Grammar Repair + Speaking evidence, then resolve the booking with a receptionist NPC.
3. **City Transit — Last Train Transfer**: after Hotel clear, earn fresh Collocation + Listening + Speaking evidence, then navigate the metro with an information-desk NPC.

Later chapters only count evidence created after the previous boss clear. Boss rewards unlock XP, achievements and wearable profile cosmetics.

## Core experiences

- Word Link
- Word Graph
- Collocation Factory
- Sentence Builder
- Grammar Repair
- Reading Race
- Story Choice
- Listen & Pick
- Dictation Rush
- Shadow Me / acoustic pronunciation assessment
- IELTS Listening / Academic Reading / Writing / Speaking practice
- Adaptive Recovery queue
- Daily Quest Chain + reward chest + streak
- World Map, achievements, loadout and boss progression
- Realtime Arena challenges / leaderboard

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
  |       -> adaptive plan + spaced repetition + progression engine
  |
PostgreSQL :5432

Redis :6379 -> presence, challenges, pub/sub and rate limits
```

## Run locally

```bash
cp .env.example .env
docker compose up --build
```

- Web: `http://localhost:3000`
- API: `http://localhost:8080/health`
- AI: `http://localhost:8090/health`

External LLM configuration is optional. Local deterministic fallback engines keep the learning loop usable without a model API.

## Production boundary

IELTS Writing/Speaking results are practice estimates, not official examiner scores. Acoustic pronunciation scoring is available when the configured speech provider is present; otherwise the product explicitly falls back to non-acoustic signals. Production deployment also supports the standalone Next.js image, Caddy reverse proxy, PostgreSQL, Redis and isolated API/AI services.
