# Architecture

Contribution policy: [PROJECT-RULES](PROJECT-RULES.md). Implementation priorities:
[ROADMAP](ROADMAP.md). Word Link and Grammar Repair share server-owned attempts
and a recoverable frontend lifecycle ([ADR 003](decisions/003-learning-recovery.md)).
The generic accuracy endpoint is retired for every activity. Checked community
XP derives from supported completed learning receipts and their daily claim;
legacy personal totals and confidence are preserved without being reclassified.
See [ADR 010](decisions/010-checked-practice-ranking.md) and CORE-005 for remaining
legacy-evidence and competitive-session work.

## Principles

1. **Game content and learner state are separate.** A mini-game emits attempts; the adaptive engine decides what those attempts mean for the learner.
2. **AI failure preserves the learner's work.** Writing saves the original essay and exposes a retryable evaluation failure when valid provider feedback is unavailable; word counts never substitute a band. Speaking, generation and NPC endpoints retain explicitly labeled non-acoustic/template fallbacks where supported.
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

Compatibility skill rows retain seeded/mixed historical values. Eligible graded
attempts update the existing EWMA using server-computed accuracy from `0..1`:

```text
new_confidence = old_confidence * 0.75 + accuracy * 0.25
```

These values are personal compatibility data, not a calibrated mastery measure.
Camp and practice suggestions use the separate `skill-practice.v1` read projection
from completed supported shared receipts: the latest answer for each different
activity/item/content, then the 20 most recent items per skill. They display counts
and evidence kind, including transcript-only Speaking, without inventing proficiency
percentages or reward quotes. See [ADR 013](decisions/013-skill-practice-summary.md).
World/cosmetic gates and the fixed daily-plan v1 selection retain their older
personal policy pending a separate grant ledger/migration.

## Review scheduling

Answers under 85% accuracy enter the review queue. Review grading uses a small SM-2-inspired interval/ease update so repeated failures return quickly and easy recall expands the interval.

## Security notes

- Passwords use a PBKDF2-HMAC-SHA256 implementation with per-password random salt.
- Session tokens use HMAC-SHA256 signed JWT-shaped tokens with expiry.
- The repository default secret is development-only and must be changed for deployment.
- Speaking can record PCM audio locally. Requesting acoustic assessment sends the
  recorded audio to the scoring endpoint; transcript-only fallback is a different
  evidence mode and must not be presented as acoustic pronunciation scoring.
  Account assessments use the saved receipt adapter in [ADR 009](decisions/009-acoustic-receipts.md).
  Reference and versions come from the owned shadowing snapshot. Only metadata
  and validated feedback are persisted; raw recordings stay in memory. Writing
  and acoustic adapters share generation-fenced lease policy, with provider I/O
  outside short transactions. Acoustic feedback changes no learning rewards.

## Player journey

Daily practice saves an account/day checklist once (`daily-plan.v1`, UTC+7).
Supported shared attempts have an immutable actual completion timestamp in both
stores; dated activity matches, including valid mistakes/fresh replays, supply
effort evidence. A fixed personal chest award and immutable plan/evidence receipt
commit together under one owner/day ledger. Exact completed retries never move
to another practice day. Legacy claims stay explicitly unverified; confidence is
never used to infer today's activity. Migration 021 is additive. Browser recovery
retains only owner/date/rules metadata and confirms by GET, with explicit retry
and account-change guards. See [ADR 011](decisions/011-daily-practice-recovery.md).

The community board derives checked practice XP from immutable shared attempts
and their daily claim ledger, not the mixed lifetime user counter. Generic client
accuracy and arbitrary duel-score writes are retired. Lessons/placement remain
explicit local practice/preferences; bookmarks are self-reported. Legacy totals
and confidence remain intact and are not reclassified. See [ADR 010](decisions/010-checked-practice-ranking.md).

See [ADR 001](decisions/001-unified-player-journey.md) for the shared catalog, guest/account boundary, offline completion queue, transactional ledger and derived companion friendship milestones.

See [ADR 002](decisions/002-core-first-development.md) for core-first development
and the distinction between Fair result stars and learning evidence.
