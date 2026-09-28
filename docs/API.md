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
Client-reported accuracy remains a limitation for unmigrated activities. Word Link
and Grammar Repair reject this route with 409; use server-owned attempts below.
Do not extend the legacy trust model to new rewards/ranking.

```json
{
  "skill": "Vocabulary",
  "activity": "collocation-factory",
  "itemKey": "collocation:example",
  "prompt": "significant — choose the closest synonym",
  "answer": "substantial",
  "accuracy": 1,
  "durationSec": 8
}
```

## Verified learning attempts — Word Link and Grammar Repair

Deployment/validation status: [ROADMAP](ROADMAP.md). Contract: [ADR 003](decisions/003-learning-recovery.md).

| Method and route | Request / result |
| --- | --- |
| `POST /v1/learning/attempts` | `{requestId: UUIDv4, activity, cefrLevel, pack?, excludeItemKeys?: string[]}` → 201 new or 200 identical retry |
| `GET /v1/learning/attempts/{id}` | 200 saved prompt/options and optional committed result |
| `POST /v1/learning/attempts/{id}/submit` | `{answer, contentVersion, rulesVersion}` → 200 immutable verdict |

Activities: `word-link`, `grammar-repair`; CEFR A1–C2. Default pack `cefr-core`.
Word Link also accepts `travel-airport` (B1). Grammar accepts `travel-hotel`,
`conversation-clarity` (B1), `work-requirements`, `work-deadline` (B2). Unsupported
level/pack pairs return 400. Exclusion lists are limited to 20 item keys; when a
bank is exhausted, practice can repeat. Catalogs remain server-only JSON files in
`backend/internal/learning`; content versions must change with material bank edits.

Start/GET return `attemptId`, `activity`, `pack`, `itemKey`, `cefrLevel`,
`contentVersion`, `rulesVersion`, `status`, `prompt` (word/relation or question,
plus options), `mode: guest|account`, `expiresAt` and optional `result`. The public
prompt/order and private answer are snapshotted together; replay does not re-read
the current catalog. No answer key/feedback is sent before completion.

Result contains `correct`, `actualAnswer`, `correctAnswer`, `feedback`, `xpDelta`,
`newConfidence`, `level`, `reviewAdded`, `progressionApplied`, `evidence:
server-objective`, attempt/status and versions. Only offered answers are accepted;
comparison ignores surrounding whitespace and case. Wrong answers are retained as
actual responses, while review teaches the correct answer. Guests and daily repeats
have no progression update; confidence/level in those results are zero placeholders,
not an account assessment. The UI must not display them as account skill levels.

Missing Authorization means guest practice; no XP, confidence, review or shared
demo mutations. Guest IDs and creation UUIDs are capabilities; keep them private.
Account identity comes from Bearer auth; invalid tokens get 401, inaccessible
attempts 404. Sign-in does not adopt guest rounds. Different normalized creation
input under the same request ID or changed completed answers get 409. Invalid
versions/options/extra score fields get 400. Active attempts expire after 24 hours
(410 on submit); identical completed submissions remain retryable after expiry.

First completion per account/item/content-version/UTC day applies progression:
correct +20 XP, incorrect +0 XP and review, using existing confidence rules.
Further new rounds remain playable with no additional progression that day.
Identical submit retry returns the original XP delta; it does **not** award it
again. Verdict, claim, compatibility attempt evidence, XP, confidence and review
commit atomically in PostgreSQL. Memory mode is temporary. These are practice
results, not evidence of unaided competitive mastery; generic rank/other legacy
learning routes remain CORE-003/005 work.

Migration 016 extends 014/015 without deleting history. Deploy API/schema before
the frontend. Old clients missing submit versions receive a refresh-required 400.
Old active rounds without a prompt snapshot require a fresh round; completed rows
remain stored and answer retries remain idempotent. Do not re-enable client accuracy
on rollback. The shared frontend preserves owner/activity/pack-scoped references,
pending answers and set context; stale responses cannot populate another account.

## Review queue

- `GET /v1/review?limit=30`
- `POST /v1/review/{itemKey}` with `{ "quality": 0..5 }`

## AI proxy

- `POST /v1/ai/writing-score`
- `POST /v1/ai/speaking-feedback`
- `POST /v1/ai/exercises`
- `POST /v1/conversation/reply`

## Missions

- `GET /v1/missions/airport`
