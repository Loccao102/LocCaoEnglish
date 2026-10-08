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
Grammar Repair, Collocation Factory, Sentence Builder, Word Graph, Reading Race, Story Choice, Listen & Pick and Dictation Rush reject this route with 409, including
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

Activities: `word-link`, `grammar-repair`, `collocation-factory`, `sentence-builder`, `word-graph`, `reading-race`, `story-choice`, `listen-pick`, `dictation`.

Dictation uses `dictation.v1`, content `dictation-core.2026-10-09.v1`: three
sentences each at A2/B1/B2 in `cefr-core`, including the five original sentences.
These are editorial tiers, not proficiency certification. Start returns a generic
instruction and empty options; only audio preparation receives the saved transcript.
The audio journal/protocol below also applies to dictation. Browser fallback exposes
the reference text for synthesis; results are guided practice, not unaided assessment.

Submit actual typed text (1–2048 UTF-8 bytes, at least one letter/digit token).
V1 lowercases Unicode letters, maps curly apostrophes to straight apostrophes,
keeps internal apostrophes and splits other punctuation/whitespace. It does not
expand contractions, equate digits with spelled numbers or forgive spelling errors.
Unit-cost Levenshtein alignment counts missing, extra and substituted words;
ties prefer match, substitution, missing, extra in reverse traversal. Accuracy is
`max(0, 1 - edits / expectedWords)`. Display floors the percentage; correctness
requires zero edits, never a rounded percentage or the former 80% threshold.
Result `dictation` contains `accuracy`, `expectedWords`, `matched`, `missing`,
`extra`, `substituted`, and ordered `words: [{kind, expected?, actual?}]`.
The actual response is retained separately from `correctAnswer`. Retry compares
the exact trimmed original payload, including case/punctuation; changing it after
feedback returns 409 even when both spellings would grade identically.

Only an exact normalized match can receive 20 XP. Existing first-submission
per-item/content-version/UTC-day claims apply even on an incorrect attempt.
Confidence and persisted history use the server's fractional accuracy; an imperfect
first account answer adds the reference sentence to review. Guest/repeated practice
does not grant progression. Provenance is `server-objective-guided-dictation`.
Draft and pending submit reuse the owner-scoped v1 local reference; saved v1
transcripts and normalization remain supported independently of current catalogs.
No SQL migration. Deploy API first; retain v1 grading/audio and legacy rejection
on rollback. Pre-migration client-only rounds had no durable attempt to migrate.

Listen & Pick uses `listen-pick.v1`, catalog `2026-10-08.1`: B1 only, three clips
each in `cefr-core`, `travel-airport`, `travel-transit`, `conversation-cafe`,
`conversation-plans`, and `work-requirements`. Start/resume prompts contain question
and shuffled choices, never the transcript, key or feedback. Listening metadata is
`{events:[{requestId,rate,status,provider?}],source:"client-reported-playback"}`.

`POST /v1/learning/attempts/{id}/audio` accepts
`{requestId: UUIDv4, rate: 1|0.72, status: "requested"|"completed"|"failed", provider?, contentVersion, rulesVersion}`.
For `requested`, omit provider. The server reserves one event and returns
`{attempt, audio?: {provider,rate,audioBase64?,mimeType?,text?}}`. A configured
neural provider returns audio/mpeg; timeout/unavailability returns the saved
transcript for browser synthesis with provider `browser-speech-synthesis`.
That text is intentional fallback assistance, not a hidden-assessment guarantee.
No answer key or verdict is returned by the audio route. A repeated preparation
for an event already completed/failed returns the attempt without another clip.

The browser reports `completed` only after playback start and end callbacks;
rejection, stop, unsupported voice and playback timeout report `failed`. Reports
include provider `browser-speech-synthesis` or `azure-speech-neural-tts`. Providers
and completion are client observations, not trusted proof of human listening.
Both operations reuse their UUID on transport failure. A terminal event is
immutable; identical report retries work even after grading. Conflicting reports
or rates return 409, wrong owner 404, version/input errors 400, new events on an
expired attempt 410. At most 32 events per round, no renewed TTL. Requested events
may remain unfinished after a closed tab; they never count as completed listens.

At least one completed report is required to submit (otherwise 409). The existing
grade transaction locks the same row as audio updates and freezes the evidence.
Result `listening` includes the transcript plus events; `evidence` and persisted
`grading_source` are `server-objective-guided-listening` for Listen & Pick and
`server-objective-guided-dictation` for Dictation Rush. Completed event count,
`max(0, completed - 1)` replays, completed events at .72, failed events and provider
are retained on reload. These are recorded observations, not exhaustive real-world
listening counts. All rounds are guided practice: no unassisted/competitive claim
or speed bonus. Existing per-item/version/UTC-day XP and review rules apply.
Old saved activities need no migration; listening extends private JSON snapshots.
Deploy API first. Rollback must retain listening snapshot decoding, audio operations,
grading and legacy rejection, or disable new roots while supporting saved rounds.

Word Link, Grammar, Collocation and Sentence core banks support CEFR A1–C2.
Word Graph supports only travel-network at A2. Reading Race supports only
cefr-core at A2/B1/B2. Default pack `cefr-core` is not a Word Graph pack.
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
server-objective` (or the guided listening/dictation provenance above),
attempt/status and versions. Choice activities accept only offered answers;
Sentence Builder accepts a complete chunk permutation and Dictation accepts bounded
typed text under its normalization/retry rules above. Choice comparison ignores
surrounding whitespace and case. Wrong answers are retained as
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

Reading Race adds optional `title` and `passage` strings to the public prompt.
Catalog `2026-10-07.1` contains three distinct passages per A2/B1/B2 level;
rules are `reading-race.v1`. Default UI level is B1; unsupported pack/level
pairs return 400. POST creates a snapshot of title, passage, question and shuffled
options; the private answer and evidence explanation are stored at creation.
Submit the actual option text. Only after grading does `feedback` quote the
supporting sentence(s) and explain the conclusion. The passage itself stays
available while choosing; this is untimed reading comprehension practice, not
a memory test or proof of reading speed. CEFR tiers are editorial, not calibrated.

Review records contain title + passage + question so wrong answers remain
answerable in the review queue. Completed rounds cannot be edited/regraded;
reload and retries use their stored passage, options and feedback even after a
catalog update. Three-question sets avoid repeats until bank exhaustion. Existing
daily claims and 20/0 correct/wrong XP apply; no new reward policy or SQL migration.
Deploy API before web. On rollback keep the new prompt fields, saved-round support
and legacy rejection (including case/whitespace aliases), or disable new rounds;
do not restore client accuracy or reclassify legacy history.

### Story Choice chains

Start with activity `story-choice`, pack `hotel-check-in`, level `B1`, a UUIDv4
requestId and no exclusions. Catalog `2026-10-08.1` / rules `story-choice.v1`
contain five decision scenes and four endings. Multiple opening responses are
effective; validity is the authored scenario rubric, not universal language mastery.
The usual start/get/submit endpoints handle each decision. Submit actual option
text, never a score, destination or complete path. Wrong choices may reach a
recovery scene or an unresolved ending; success depends on confirming both nights.

The prompt contains title/passage/question/options. Top-level `story` contains
runId, one-based step and prior committed history (scene/answer/consequence/xp).
No private definition, destination, per-choice verdict or future scene is sent.
After submission `result.story` contains consequence, canContinue, and optional
ending (`success`/`unresolved`), title and text. `correctAnswer` lists effective
responses with OR; it is a review reference, not a client grading key.

`POST /v1/learning/attempts/{parentId}/continue` with exactly `{}` returns 200
for the unique child of a completed nonterminal Story Choice decision. Ownership
is checked; incomplete, non-story and terminal parents return 409. The private
snapshot determines the destination. A reserved internal request key plus the
existing owner/request uniqueness constraint ensures repeated/concurrent calls
return one child, even if its result is already completed. Public start accepts
only UUIDv4 and cannot occupy this reserved key. Foreign owners receive 404.

Each node retains the root's 24-hour deadline. Creating a child after that deadline
returns 410; an already-created child can still be retrieved and completed-result
retries remain valid. The full graph/version and decision history are stored in
private snapshot JSON. Later nodes use that saved graph even after catalog updates.
Browser references optionally keep parentAttemptId before continuing, so a lost
continue response or reload retries the same edge rather than opening a new root.

The existing daily claim applies per scene/content-version/UTC day: effective
choices give 20 XP when eligible, others 0. There is no ending bonus or separate
reward ledger; these are learning practice rewards, not Adventure story rewards.
Path XP comes from the server's recorded history. Replaying another path may
encounter a new scene but cannot re-award an already claimed scene that day.

No SQL migration; existing snapshots omit the optional story fields. Deploy API
before web. On rollback retain the story-choice.v1 snapshot decoder, grader, continuation
handler and legacy rejection, or disable new story roots while keeping saved
rounds readable. Do not roll back to client accuracy. Old clients need refresh;
legacy history is unchanged. No timer, hints or competitive certification added.

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
