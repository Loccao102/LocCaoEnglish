# API surface

Base development URL: `http://localhost:8080`

Some legacy learning routes support a seeded demo learner without `Authorization`.
Authenticated routes, including account Fair saves/completions, require identity;
do not assume every endpoint accepts anonymous requests. Registered users send
`Authorization: Bearer <token>`.

## Auth

- `POST /v1/auth/register`
- `POST /v1/auth/login`

## Learner state

- `GET /v1/dashboard`
- `GET /v1/skills`
- `GET /v1/plan/today`
- `POST /v1/attempts`

Attempt payload:

This is the **current legacy contract**, not the planned trusted grading model.
Client-reported accuracy is a known limitation for unmigrated activities. Word Link
now rejects this route with 409; use its server-owned contract below. Do not copy
the legacy trust model into new reward or ranking features.

```json
{
  "skill": "Vocabulary",
  "activity": "grammar-repair",
  "itemKey": "grammar:example",
  "prompt": "Example legacy prompt",
  "answer": "Example response",
  "accuracy": 1,
  "durationSec": 8
}
```

## Word Link server-owned attempts (CORE-001 pilot)

Implemented contract; deployment/validation status is in [ROADMAP](ROADMAP.md).
The authoritative bank is `backend/internal/learning/word_link.json`: `default`
and `travel-airport`, five questions each, content version 1 and rules version 1.
Changing a bank requires a version bump. In-flight questions retain their snapshot.

| Method and route | Body / response |
| --- | --- |
| `POST /v1/learning/word-link/attempts` | `{requestId: UUIDv4, pack: string, round: zero-based integer}` → 201 public attempt |
| `GET /v1/learning/word-link/attempts/{id}` | 200 public attempt, including result if completed |
| `POST /v1/learning/word-link/attempts/{id}/submit` | `{choiceId: string, contentVersion: integer, rulesVersion: integer}` → 200 verdict |

Public attempt: `id`, `contentId`, `contentVersion`, `rulesVersion`, `pack`, `label`,
`round`, `total`, `word`, `prompt`, `choices: [{id,label}]`, `mode: guest|account`,
`expiresAt`, optional `result`. Choice IDs/order are generated once by the server.
No answer key or explanation is returned before grading.

Verdict: `correct`, `actualAnswer`, `correctAnswer`, `note`, `xpDelta`, `reviewAdded`,
`progressionApplied`, `evidence: server-objective`, `assisted: false`, `submittedAt`.
The pilot has no hint action; `assisted` describes this round's UI, not proof the
player has never seen this content. It does not qualify results for ranked play.

Bearer identity owns account attempts. No Authorization creates guest practice;
invalid tokens get 401. Guests never update demo/account XP or skill confidence.
Guest IDs and creation UUIDs are capabilities: keep them private. Signing in starts
or resumes that account's own round; it does not adopt the guest round.

Creation retries use the same owner/request UUID. Identical submit retries return
the saved verdict (including its original XP delta, **not another award**), even
after expiry. Changed pack/round under the same creation key or changed submitted
answer produces 409. Invalid fields/options/versions produce 400, inaccessible
attempts 404, unsubmitted attempts older than 24 hours 410. Server errors are 500;
retry the same request/answer. Unknown extra fields such as `score` are rejected.

First completion per content/version/account/UTC day updates progression once:
30 XP correct, 10 XP incorrect under the existing learning reward convention.
Subsequent new attempts remain playable with zero XP/confidence updates. Wrong
answers put the **correct** answer into review; actual responses remain in the
attempt snapshot/result. The verdict, reward claim, compatibility attempt log,
skill update and review update commit atomically in PostgreSQL. Memory mode is
temporary. Account changes invalidate pending browser responses; failed submissions
retain the same locked choice locally for retry/reload.

Rollout: deploy API with migration `014_learning_attempts.sql` (also applied by
`EnsureLearningAttempts`) before this frontend. Keep existing history/schema on
rollback; do not re-enable Word Link client-reported accuracy. Old clients receive
409 and need refresh. Other learning and competitive endpoints still require
CORE-003/005 migration. See [ADR 003](decisions/003-server-owned-word-link.md).

## Review

- `GET /v1/review?limit=30`
- `POST /v1/review/{itemKey}` with `{ "quality": 0..5 }`

## AI proxy

- `POST /v1/ai/writing-score`
- `POST /v1/ai/speaking-feedback`
- `POST /v1/ai/exercises`
- `POST /v1/conversation/reply`

## Missions

- `GET /v1/missions/airport`
