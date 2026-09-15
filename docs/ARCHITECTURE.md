# Architecture

## Principles

1. **Game content and learner state are separate.** A mini-game emits attempts; the adaptive engine decides what those attempts mean for the learner.
2. **AI is an enhancement, not a single point of failure.** Writing, speaking, generation and NPC endpoints all have deterministic fallback behavior.
3. **IELTS scoring is framed as practice estimation.** The product never labels model/heuristic output as an official IELTS result.
4. **Wrong answers become future curriculum.** Review scheduling is part of the core domain instead of an optional flashcard feature.

## Runtime services

### Web
Next.js App Router UI. Browser-native speech synthesis and speech recognition provide a zero-cost development path for listening/shadowing.

### API
Go `net/http` service. Owns accounts, skill confidence, XP, attempts, reviews, daily-plan construction, adventure saves and idempotent fair completions. It can use PostgreSQL or in-memory demo mode.

### AI service
FastAPI service with four contracts:

- `/v1/writing/score`
- `/v1/speaking/feedback`
- `/v1/exercises/generate`
- `/v1/conversation/reply`

It can call a configured OpenAI-compatible chat endpoint or use local deterministic engines.

### PostgreSQL
Durable learner state. Schema is created idempotently by the API and also documented under `backend/migrations`.

### Redis
Stores presence, challenge state, pub/sub and rate limits. The realtime service reports an explicit in-memory fallback when Redis is unavailable; PostgreSQL-backed player progress remains durable.

## Skill confidence

Each attempt contains a normalized accuracy from `0..1`. Confidence uses a simple EWMA:

```text
new_confidence = old_confidence * 0.75 + accuracy * 0.25
```

This is intentionally interpretable for the MVP. A later Bayesian/IRT model can replace it behind the same store/API contracts.

## Review scheduling

Answers under 85% accuracy enter the review queue. Review grading uses a small SM-2-inspired interval/ease update so repeated failures return quickly and easy recall expands the interval.

## Security notes

- Passwords use a PBKDF2-HMAC-SHA256 implementation with per-password random salt.
- Session tokens use HMAC-SHA256 signed JWT-shaped tokens with expiry.
- The repository default secret is development-only and must be changed for deployment.
- Raw speaking audio is not uploaded in the current browser transcript mode.

## Player journey

See [ADR 001](decisions/001-unified-player-journey.md) for the shared catalog, guest/account boundary, offline completion queue, transactional ledger and derived companion friendship milestones.
