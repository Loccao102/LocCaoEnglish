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
Client-reported accuracy remains a limitation for unmigrated activities. Word Link,
Grammar Repair, Collocation Factory, Sentence Builder and Word Graph reject this route with 409, including
case/whitespace variants; use server-owned attempts below.
Do not extend the legacy trust model to new rewards/ranking.

```json
{
  "skill": "Vocabulary",
  "activity": "reading-race",
  "itemKey": "reading:example",
  "prompt": "What does the passage say?",
  "answer": "The reader's choice",
  "accuracy": 1,
  "durationSec": 8
}
```

## Verified learning attempts

Deployment/validation status: [ROADMAP](ROADMAP.md). Contract: [ADR 003](decisions/003-learning-recovery.md).

| Method and route | Request / result |
| --- | --- |
| `POST /v1/learning/attempts` | `{requestId: UUIDv4, activity, cefrLevel, pack?, excludeItemKeys?: string[]}` → 201 new or 200 identical retry |
| `GET /v1/learning/attempts/{id}` | 200 saved prompt/options and optional committed result |
| `POST /v1/learning/attempts/{id}/submit` | `{answer, contentVersion, rulesVersion}` → 200 immutable verdict |

Activities: `word-link`, `grammar-repair`, `collocation-factory`, `sentence-builder`, `word-graph`.
Core banks support CEFR A1–C2; Word Graph currently supports only the travel-network
pack at A2. Default pack `cefr-core` is not a Word Graph pack.
Word Link also accepts `travel-airport` (B1). Grammar accepts `travel-hotel`,
`conversation-clarity` (B1), `work-requirements`, `work-deadline` (B2).
`collocation-factory` accepts `travel-transit`, `conversation-cafe`,
`conversation-clarity`, `work-standup` and `work-deadline` campaign packs. Unsupported
level/pack pairs return 400. Exclusion lists are limited to 20 item keys; when a
bank is exhausted, practice can repeat. Catalogs remain server-only JSON files in
`backend/internal/learning`; content versions must change with material bank edits.

Collocation catalog `2026-10-06.1` supplies 38 contextual questions. Each core
level and each campaign's starting level has three distinct items for a three-round
set: transit/cafe A2, clarity/standup B1, deadline B2. Additional retained campaign
levels can be requested through the API but are not yet selectable in the UI.
CEFR labels are editorial practice tiers, not measured proficiency certification.
Collocation uses `prompt.question` for the situation and `prompt.word` for the
pair starter. Content/option edits bump the content version; grading remains
`collocation-factory.v1`. A new content version can earn a fresh daily claim under
the existing policy. Three-round exclusion is practice variety, not an anti-cheat
guarantee; the server may repeat once the requested bank is exhausted.

Sentence catalog `2026-10-07.1` supplies 27 questions: three per core CEFR tier,
plus three each for `conversation-plans` (A2), `work-standup` (B1) and
`work-deadline` (B2). The existing campaign topics are retained. CEFR tiers are
editorial and need playtesting, not a certification claim. Prompts specify the
intended clause/phrase placement, with feedback explaining the pattern.

Sentence rules are `sentence-builder.v1`. `prompt.question` gives the task,
`prompt.chunks` contains shuffled `{id,text}` pieces, and `prompt.options` is
empty (clients must tolerate empty/null options for this activity). IDs do not
encode the solution position and each repeated word gets a different ID. A private
server seed generates IDs/order; the public request UUID cannot derive them. The
shown order is never already the solution. Submit the ordered IDs as a JSON
string in the existing `answer` field, for example:

```json
{"answer":"[\"opaque-id-b\",\"opaque-id-a\",\"opaque-id-c\"]","contentVersion":"2026-10-07.1","rulesVersion":"sentence-builder.v1"}
```

Every offered ID must appear exactly once. Missing, duplicate, unknown IDs and
free text receive 400. Server resolves the sequence against the saved snapshot;
case-insensitive exact sentence comparison determines the result. Interchanging
identical-text pieces is valid. The original wire string is kept for retries, so
clients must resend it unchanged; results and compatibility evidence contain the
actual readable sentence, while review contains the correct sentence. Feedback
closes the round: editing/resetting after seeing the answer cannot regrade it.

Word Graph catalog `2026-10-07.1` retains nine travel nodes and nine directed
relations. Rules `word-graph.v1` ask one contextual question about a relation;
the correct answer is derived from its target node in the same catalog. Creation
requires `pack: travel-network`, `cefrLevel: A2`. Other level/pack pairs get 400.
The public prompt contains only `word`, `relation`, `question` and shuffled
`options`. Opaque question keys do not spell out the target word. Submit the
chosen node label in `answer`; no edges, definitions, answer keys or feedback
are included before completion. Three-question sets exclude completed item keys.

`/word-graph` is public study content: the server page projects node descriptions
and labelled edges without private questions/feedback. Selecting nodes never
creates attempts, changes confidence or awards XP. `/word-graph/practice` is a
separate client entry using verified rounds; it does not import the study graph
or show the Connections inspector. These are guided practice results, not proof
of unaided recall: the system cannot prove whether a learner studied the public
map earlier or in another tab. No hint or competitive scoring is added.

Start/GET return `attemptId`, `activity`, `pack`, `itemKey`, `cefrLevel`,
`contentVersion`, `rulesVersion`, `status`, `prompt` (word/relation or question,
plus options or sentence chunks), `mode: guest|account`, `expiresAt` and optional `result`. The public
prompt/order and private answer are snapshotted together; replay does not re-read
the current catalog. No answer key/feedback is sent before completion.

Result contains `correct`, `actualAnswer`, `correctAnswer`, `feedback`, `xpDelta`,
`newConfidence`, `level`, `reviewAdded`, `progressionApplied`, `evidence:
server-objective`, attempt/status and versions. Only offered answers (or a complete
sentence chunk permutation as described above) are accepted;
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

The Collocation update requires no schema migration. Deploy the API before the
web. Existing snapshots keep their original prompt/options/answer/content version;
the web supports older snapshots without a situation by showing the pair prompt.
Retired client-scored Collocation clients must refresh on 409. Rollback must retain
the legacy-route rejection; never restore client-reported progress to recover UI.

Sentence Builder also requires no SQL migration. Deploy API before web and keep
the sentence v1 grader available for saved snapshots on rollback. Old client-score
submissions receive 409 and require refresh; old legacy records are not reclassified
as verified. The shared local reference has an optional `draft` string scoped to
owner/activity/pack. Draft editing is allowed only before submission; pending
order and level changes stay locked until confirmation. No timer, hint reward or
assisted correction submission is introduced. A replay remains capped practice.

Word Graph needs no schema change. API before web; old Link Mode clients receive
409 on the legacy score route and must refresh. Preserve stored rounds and the
legacy rejection on rollback. Existing legacy history is not reclassified.

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
