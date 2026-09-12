# LocCao English

An English adventure in Sunlit Village, with a playable character, NPCs, a seven-chapter story and a separate learning journal for deeper practice.

## The Seven Sun Pages

Open `/` or `/play` to begin. Move with WASD, arrow keys, touch controls, or click a destination to walk there. Speak to a nearby guide with **E** and complete English challenges to restore the village’s lost story.

- Seven places, fourteen sequential quests and forty-two authored challenges.
- Choice, sentence building, typed answers and listening with optional transcripts.
- At least two correct answers out of three to pass; failed quests can be retried.
- First-clear XP and sun coins, best-star replays, seven collectible Sun Pages and four companions.
- Journal (**J**), map (**M**), bag (**B**), and pause/resume (**Esc**).
- Guest saves stay on the device. Signed-in saves use the Go API and PostgreSQL; guest progress is separate from account progress.

See [adventure architecture and handoff](docs/ADVENTURE.md) for the game loop, routes, persistence, controls and current validation status.

## Sunlit Village art pack

The original **Làng Nắng / Sunlit Village** collection brings 41 reusable assets into the playable world, learning journal, profiles, onboarding and rewards. Browse `/art-studio` or download `public/assets/sunlit-village-pack.zip`. The learning progress map at `/progress` retains live unlocks and an explicit offline preview.

See [art direction and integration](docs/SUNLIT-VILLAGE.md) for the manifest, exact generation prompts, provenance, source files, and validation commands. A complete standalone illustrated SVG map is included.

## Player loop

Explore → Meet a guide → Complete three challenges → Earn stars and first-clear rewards → Restore a Sun Page → Unlock the next chapter.

The learning journal at `/camp` also retains adaptive daily quests, review, practice campaigns, achievements and account cosmetics. These use the existing learning progression system; adventure chapter unlocks depend on story completion, and adventure XP is labelled separately in the game HUD.

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
