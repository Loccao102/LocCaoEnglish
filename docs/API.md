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
- `GET /v1/player/questline` (goal-aware practice suggestions)
- `POST /v1/attempts`

`GET /v1/skills` and dashboard `skills` add a `practice` summary to every skill:
`{method:"skill-practice.v1",sampleCount,correctCount,windowSize:20,lastCompletedAt,
evidenceKind}`. `lastCompletedAt` is nullable. See [ADR 013](decisions/013-skill-practice-summary.md).
For each skill, the latest completion of each different `(activity,itemKey,
contentVersion)` is selected, then the 20 most recent items are counted. Only
owned, completed shared attempts with supported activity/rules/skill, item/content
and a real completion time qualify. Wrong answers count practice; capped fresh
replays replace an item's result, while exact retries do not add an item or time.
Speaking is `transcript-match`; other supported skills are `guided-practice`;
Writing is `not-supported` here and keeps its separate feedback history. These
counts do not establish mastery, pronunciation quality or CEFR.

Existing `confidence`, `level` and `updatedAt` remain compatibility fields with
seeded/mixed historical values. They are **not** checked evidence. Camp displays
the new summary and a safe unavailable state with older API responses. It requests
personal progress only while signed in; legacy demo access to the API remains.
Questline returns `method: skill-practice.v1`; the new camp refuses missing or
unsupported plan methods rather than present a legacy diagnosis. Recommendations
prioritize observed errors, then unsampled skills,
then all-correct review, with stable name ties. They use direct activity routes
and put the chosen profile goal after due reviews/observed errors but before
exploration, so a short minute budget cannot hide the feedback action. They
keep compatibility `xp`/`potentialXp` at zero rather than quote rewards. The
actual activity decides its rewards. Existing daily snapshots/selection and
personal world/cosmetic gates are unchanged by this read projection.

Attempt payload:

`POST /v1/attempts` is retired for **all** activities, including unknown names,
lesson/placement and case/whitespace aliases. It returns 409 after normal identity
checks and never changes XP, confidence or review state. Use server-owned attempts
below. The old payload is shown only for migration; do not resubmit it or rename
an activity to bypass the receipt flow. Old records and personal XP are preserved.

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

## Personal world and vocabulary rewards

- `GET /v1/player/progression` returns worlds, achievements and inventory. It
  atomically records eligible vocabulary grants before returning; it awards no
  XP. Legacy anonymous demo reads remain available where configured, while the
  current personal-progress UI requires a signed-in account.
- `PUT /v1/player/loadout` requires an account (guest 401), with `{cosmeticId}`.
  It verifies ownership and the same immutable grant policy used by GET, then
  upserts the chosen slot. Retry is idempotent and never grants XP. A lost reply
  can be confirmed by refreshing progression; failed equip does not erase an
  independently earned grant.
- Word Network and Wordsmith achievement/pin add optional `unlock` metadata:
  `{method:"vocabulary-unlocks.v1",correctItems,targetItems,activityCount,
  targetActivities,receipt?}`. Targets are 3 items / 1 activity for Word Network,
  7 items / 2 activities for Wordsmith; Word Network also retains its 300-personal-XP
  alternative. Other world and cosmetic policies retain their existing rules.
- Eligible practice is owned completed/correct Vocabulary shared receipts with
  supported Word Link/Collocation/Word Graph rules, item/content and completion
  time. Count each `(activity,itemKey)` once across versions, using its earliest
  correct receipt. New capped correct replays qualify, duplicates do not add an
  item. This is an accumulated guided-practice milestone, distinct from the
  journal's latest-20 window; later mistakes do not revoke a recorded grant.
- Immutable receipt: `{unlockId,method,source,recordedAt,evidence?,personalXp?}`;
  source is `legacy-personal`, `checked-practice` or `personal-xp`. Evidence has
  attempt ID, activity, item key, content/rules versions and completedAt. New
  grants prefer checked practice when both paths qualify. A source never changes
  after recording. No grant establishes mastery, CEFR or checked competitive rank.
- Migration 022/startup cutover preserves prior confidence/XP eligibility and an
  equipped Wordsmith pin exactly once before new demo/registrations. It freezes
  negative decisions as well, so rerunning startup cannot grandfather new seeded
  accounts. Legacy receipts have no invented attempt proof or historical earned
  time; `recordedAt` is the actual capture time. See [ADR 014](decisions/014-vocabulary-unlock-grants.md).
  Backend precedes frontend; drain old writers before cutover. No destructive
  rollback or data reset is required.
- Direct `/word-graph` study/practice remains public. The world grant recognizes
  progress in menus; it is not a content authorization boundary. New UI presents
  item/activity counts and source, not `% explored` from old confidence. Missing
  metadata from an older API is shown as unavailable rather than verified proof.

## Saved daily practice

All daily endpoints require an account; guests receive 401 and cannot change the
shared demo learner. See [ADR 011](decisions/011-daily-practice-recovery.md).

- `GET /v1/player/daily` creates/reads the owned UTC+7 day snapshot: `date`,
  `rulesVersion: daily-plan.v1`, `method: completed-practice.v1`, three distinct
  `quests`, `completed`, `total`, `chestXp`, `claimable`, `claimed`, optional `receipt`.
  Goal/weak-skill preferences choose reachable activities once; later profile or
  confidence changes do not move that day's checklist.
- Only supported shared attempts completed in that day count, matching each
  quest activity. Valid wrong answers and newly completed replay rounds count
  effort. Exact retries keep their original completion timestamp. Legacy rows,
  lifetime confidence, local lessons, provider feedback and client accuracy do
  not count. This is personal guided practice, not proof of unaided mastery.
- `POST /v1/player/daily/claim` requires exactly `{date, rulesVersion}`. The server
  verifies its saved plan/evidence and atomically records one owner/day receipt
  with fixed **50 personal XP**. Caller-chosen rewards/unknown fields return 400;
  missing plan, incomplete checklist, unsupported version or a new claim for an
  earlier/future day return 409. Concurrent/exact retries return the existing
  receipt without another award, including previously committed older days.
- `GET /v1/player/daily/claims/{YYYY-MM-DD}` reads only the caller's receipt;
  missing is 404, invalid date 400, unknown/corrupt saved version 409, uncertain
  storage failure 503. Receipt fields: `date`, `rulesVersion`, `rewardXp`,
  `claimedAt`, `legacy`, saved `plan`, and `evidence[{questId,activity,attemptId}]`.
  Earlier claims without evidence remain explicitly `legacy-unverified`, with
  their original reward retained and no invented proof or additional XP.

The browser saves only an owner/date/version recovery reference before claiming.
Reload/refresh uses GET to confirm; no automatic reward POST. An unconfirmed
reference keeps the same date/rules for explicit retry, even after the day changes;
leaving it is explicit and never deletes account history. Expired sessions, corrupt
references, blocked browser storage and late replies after account changes have
visible recovery paths. Chest XP is excluded from the checked-practice board.
Migration 021/startup schema is additive. Deploy API/schema before web; rollback
must retain snapshot/receipt readers, dated checks and claim guards. Do not reset
user data or restore confidence-based eligibility.

## Verified learning attempts

### Checked practice community board

`GET /v1/social/leaderboard?limit=20` returns `{items,onlineCount,method,disclaimer}`.
Method is `server-checked-practice.v1`. Rank XP derives from completed, correct,
progression-applied learning receipts with their matching daily claim, recorded
20 XP and a supported activity/rules pair. No lifetime-counter or legacy-accuracy
backfill. Ties use user ID ascending in both store modes; accounts with no eligible
receipts are unranked. This includes guided transcript practice, not a claim of
pronunciation mastery, unaided ability or anti-cheat competition. Story, mission,
chest, Fair, local lesson/placement, IELTS estimates and acoustic feedback do not
enter this board. Personal lifetime XP and earned chapter clears remain unchanged;
current campaign checkpoint readiness follows ADR 012 below.

`POST /v1/social/challenges/{id}/submit` requires sign-in and returns 409: arbitrary
client scores are retired. Existing entries remain unverified archive; create/list
routes serve practice invitations only. Opening an invitation starts ordinary
Word Link practice, with no inferred winner or competitive result.

`POST /v1/lessons/{slug}/complete` requires sign-in and records a self-reported
bookmark only, with response `evidence:"client-reported-bookmark"` and no learning
XP/mastery/rank. Completed count must be in 0..exercise count and score in 0..1.
Guest lesson checks stay local.
Local placement chooses a practice-level preference without posting accuracy or
changing skill confidence. See [ADR 010](decisions/010-checked-practice-ranking.md)
for rollout/rollback and remaining legacy-evidence limits. No SQL migration.

Deployment/validation status: [ROADMAP](ROADMAP.md). Contract: [ADR 003](decisions/003-learning-recovery.md).

| Method and route | Request / result |
| --- | --- |
| `POST /v1/learning/attempts` | `{requestId: UUIDv4, activity, cefrLevel, pack?, excludeItemKeys?: string[]}` → 201 new or 200 identical retry |
| `GET /v1/learning/attempts/{id}` | 200 saved prompt/options and optional committed result |
| `POST /v1/learning/attempts/{id}/submit` | `{answer, contentVersion, rulesVersion}` → 200 immutable verdict |

Activities: `word-link`, `grammar-repair`, `collocation-factory`, `sentence-builder`, `word-graph`, `reading-race`, `story-choice`, `listen-pick`, `dictation`, `shadowing`, `ielts-reading`, `ielts-listening`.

### IELTS Academic Reading

`ielts-reading` requires a signed-in account; it does not use the shared demo
learner or guest practice. Start with pack `ielts-academic-reading`, `cefrLevel:
"B2"`, rules `ielts-reading.v1`. B2 is routing metadata, not a calibrated level.
The current content version is `2026-10-12.1`: three original passages, 40
questions preserved from the former frontend catalog.

`prompt.reading` contains `{title, sections: [{id, title, passage, questions:
[{id, prompt, options: [{id, text}]}]}]}`. Option IDs are opaque and shuffled;
the snapshot preserves them. The grading key is not returned on active attempts.

Submit `answer` as a JSON string containing question/option tuples in paper
order, e.g. `[["R1","issued-option-id"],["R3","issued-option-id"]]`.
Omissions are unanswered; `[]` is valid and scores zero. Unknown IDs, duplicate
questions, out-of-order tuples, options from another question and malformed
arrays return 400. The shared 2048-byte maximum applies. Submit the issued
content/rules versions, never a score or provider. Owner mismatch is 404,
invalid versions are 400, changed completed submissions conflict with 409,
and active expiry is 410.

Completed `result.ielts` contains `{section, testType, rawScore, maxScore, band,
percentage, method, methodVersion, provider, disclaimer, answers}`. Each answer
is `{questionId, optionId, correctOptionId, correct}`; an empty `optionId` denotes
unanswered. `actualAnswer` preserves the submitted serialized choices. Evidence
is `server-objective-practice`, provider `loccao-objective`, method version
`ielts-anchors-interpolation.v1`. The band is an internal practice estimate from
an uncalibrated question set, not an official score or a four-skill overall.

Completion and the IELTS history receipt commit together, keyed by the learning
attempt ID. Same-payload retries return the saved result; changed payloads do
not overwrite it. This is an evidence-only path: no XP, confidence/level,
learning daily claim, review item or legacy learning-attempt write. Generic
`/v1/attempts` rejects `ielts-reading*` accuracy submissions with 409.

### IELTS Listening

`ielts-listening` also requires sign-in, pack `ielts-listening`, B2 routing
metadata, rules `ielts-listening.v1` and catalog `2026-10-16.1`. It uses the
same ordered selection parser, 2048-byte answer budget, ownership/version checks,
24-hour expiry and atomic evidence-only history writer as Reading. The original
four-part/40-question catalog lives on the backend. `prompt.listeningPaper`
has the same section/question/option structure without `passage` or transcripts.
Submit issued `L1`–`L40` question IDs and option IDs, not a correct-answer count.

The shared `POST /v1/learning/attempts/{id}/audio` request adds `partId` for
this activity, alongside `requestId`, `rate`, `status`, optional `provider` and
content/rules versions. A valid saved part ID is required; existing short clips
reject a nonempty part ID. An audio request ID binds its part and rate permanently.
The journal accepts at most 128 requests per paper (32 for existing short clips);
an existing request can still finish or retry when the journal is full.

Each of the four parts needs a `completed` report before submit; `requested` or
`failed` reports do not satisfy this gate (409). Answers may be selected before
or during playback. Replay and slow playback are allowed and recorded. The
audio and submit writers share a lock: a completed result freezes all evidence;
identical retries remain valid. `result.listening` includes the saved events and
`transcripts` keyed by part ID. Its source is `client-reported-playback`; the
server checks selections, not whether a human listened. Browser synthesis
explicitly receives the saved transcript as assistance. No transcript/key is
returned in the active public prompt. The paper player has a five-minute budget;
short-clip callers retain their 90-second default. Stop/hide/unmount cancel media.

Drafts, pending submissions and part-specific pending audio requests recover
across reload. A completed audio report retries without playing again. Invalid
audio references require explicit discard; storage failure is disclosed and
keeps in-memory work usable. Account changes cancel media and ignore late replies.
See [ADR 007](decisions/007-ielts-listening-evidence.md).

### IELTS history and legacy endpoints

- `GET /v1/ielts/history` requires sign-in and reads only that account. Rows add
  `evidence`, `legacy` and optional `attemptId`, content/rules/method versions
  and provider. Previous rows keep their scores/source text and report
  `legacy:true`, `evidence:"legacy-unverified"`; no answers are invented.
  Completed Writing receipts appear as `section:"writing"`,
  `evidence:"provider-estimate"`, `source:"provider-practice-estimate"` and link
  `attemptId` to their saved essay. These are derived from the completed Writing
  snapshot, never an independent client band write. Failed evaluations add no band.
- `POST /v1/ielts/objective-score` requires sign-in. Both Reading and Listening
  tally writes return 409. Previous `client-reported` rows keep their evidence
  and `client-reported-practice-estimate` source; they are not upgraded to
  server-graded selections. Generic `/v1/attempts` rejects both
  `ielts-reading*`, `ielts-listening*` and `ielts-writing*` accuracy submissions with 409.
- `POST /v1/ielts/band` rejects new arbitrary band/source writes with 409 after
  authentication. Existing Writing/Speaking estimates are preserved in history.
- `POST /v1/ielts/overall` remains a calculation helper; it does not persist or
  verify its client-supplied inputs. The active dashboard does not treat it as
  an evidenced four-skill result.
- `GET /v1/dashboard` returns nullable `ieltsBand`/`targetBand`. Overall remains
  null until supported evidence exists; a chosen target comes from the saved
  onboarded profile. The old fixed 6.0/7.0 values are removed.

Deploy additive migration 018/startup schema and API before frontend. Preserve
old rows, new receipts, snapshots and v1 grading on rollback. See
[ADR 006](decisions/006-ielts-reading-evidence.md) for recovery and rollout limits.

### Writing drafts and saved feedback

All routes require a signed account; unknown/other-owner IDs return 404. Contract
`ielts-writing.v1`, original Task 2 prompt/catalog `2026-10-18.1`. Essay limits are
12000 Unicode characters, no NUL; JSON save/submit bodies are limited to 100000
bytes. At least 40 whitespace-separated words are required for feedback; 250 is
the practice target. Only the server supplies task/content/rubric versions.

- `POST /v1/ielts/writing/attempts`: `{requestId,parentId?}`. Request IDs contain
  16–64 alphanumeric/hyphen characters. Same owner/request ID and parent returns
  the same attempt (201); a changed parent returns 409. A completed/failed parent
  creates an editable child revision preserving its prompt and original essay.
- `GET /v1/ielts/writing/attempts`: latest 50 account drafts/submissions ordered
  by update time. `GET /v1/ielts/writing/attempts/{id}` retrieves an older revision
  directly, including exact essay and its saved feedback if complete.
- `PUT /v1/ielts/writing/attempts/{id}/draft`:
  `{version,essay,rulesVersion}`. Saves only editable drafts and increments version.
  Same payload at the immediately preceding version returns the saved draft;
  other stale writes return 409. Saving after submission returns 409.
- `POST /v1/ielts/writing/attempts/{id}/submit`:
  `{version,essay,rulesVersion,generation}`. Essay/version must match the saved
  draft. Generation starts at zero; the claim freezes the essay and increments
  generation under a row lock. Same/older generation reads its resulting state;
  deliberate retry after failure or expired lease names the observed current
  generation. Completed retries return the immutable result without provider I/O.
  Changed essay/version or future/negative generation returns 409.

Attempts expose `status` (`draft`, `evaluating`, `failed`, `completed`), `version`,
`generation`, optional `leaseUntil`, parent/revision, timestamps and optional
`feedback`/`failure`. Pending returns 202; completed or saved failure returns 200.
Failure means the essay is stored but no valid assessment was obtained; it does
not manufacture a score. Provider I/O runs outside transactions with a 25-second
HTTP timeout and a 90-second claim lease. A disconnected client can recover via
GET. Dead-worker recovery requires explicit retry; stale generations cannot commit.
Ambiguous provider success before a failed commit may repeat billing on explicit
recovery; exactly-once receipt persistence does not promise exactly-once provider I/O.

Feedback includes service-owned `provider:"configured-llm"`, `model`,
`evaluatorVersion:"writing-feedback.v1"`, rules version, finite half-step `overall`
and all four criteria: `taskResponse`, `coherenceCohesion`, `lexicalResource`,
`grammarRangeAccuracy`. Each has `band`, an exact essay quotation in `evidence`
and a bounded explanatory `comment`. Overall must match rounded criterion mean;
zero is valid. Strengths/improvements and a practice disclaimer accompany it.
AI and Go both validate the response; no provider configuration, timeout, invalid
schema or invented quotation leaves a retryable failure. Word counts are editor
information, never substitute bands. No XP, confidence, review or daily claim.

Browser recovery is owner-scoped. It preserves unsent edits and exact pending
operations; save/submit locks editing. Conflicts retain local text until explicit
account-copy selection. Account changes ignore late responses; corrupt storage
requires explicit discard, and unavailable storage has a visible warning.
Drafts sync to the account through Save draft; unsaved edits remain browser-only.

Deploy additive migration 019/startup schema and API before frontend. Both must
retain Writing handlers/snapshots and legacy rejection on rollback; preserve
existing Reading/Listening and old estimates. See [ADR 008](decisions/008-writing-receipts.md).

### Guided transcript practice

Shadowing uses `shadowing.v1`, catalog `2026-10-11.1` with the existing 30 phrases
across core and nine campaigns. These mixed practice phrases retain `B1` as routing
metadata; it is not calibrated item difficulty. The public prompt intentionally
shows the reference phrase and pack label. This is guided practice, not recall.
Submit actual recognized, edited or typed transcript as `answer`; do not send the
reference on behalf of the learner. Rules retain the v1 token alignment described
for Dictation below, without its audio-playback gate. `result.transcriptMatch`
has the same alignment shape; `evidence` is `server-guided-transcript-match`.
The server verifies the text comparison, not that a person spoke those words.

Owner, snapshot, 24-hour expiry, exact trimmed retry, daily claim and first-check
practice XP/confidence/review follow the shared contract. Rechecking a completed
attempt cannot change its transcript or grant another reward. No acoustic score
enters the grade or ledger. Both `shadowing` and `pronunciation-assessment` now
reject generic `/v1/attempts` accuracy with 409, including case/whitespace variants.
Old history is preserved, not upgraded to verified acoustic evidence.

The UI offers optional, independent text-coach and acoustic requests using the
existing AI proxy endpoints. Text coaching renders suggestions and provider,
never a pronunciation proxy or IELTS band. An acoustic score is shown only for
an explicitly acoustic response with a finite 0–100 overall. Failed/unconfigured
providers never create a substitute score; retry retains the other successful
feedback. Coach results are transient, not server-owned learning evidence.
The app's WAV recording is in-memory only, sent on explicit coach request and lost
on reload/owner change/navigation. Separately, browser speech recognition started
by the Record action may stream audio to the browser vendor's online service;
the pre-record UI explains this and does not promise offline/on-device recognition.
Text drafts and pending submissions use the
shared owner-scoped browser reference; committed text is stored by the server.
Capture stops on hide, unmount, account change or ten seconds, including late
permission grants. See [ADR 004](decisions/004-speaking-evidence.md) for limits.
No SQL migration; API before web. Preserve the v1 decoder/grader and legacy
rejection on rollback; refresh old clients instead of restoring client rewards.

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
the current catalog. No answer key/feedback is sent before completion in the
objective activities; Shadowing intentionally shows its guided reference phrase.

Result contains `correct`, `actualAnswer`, `correctAnswer`, `feedback`, `xpDelta`,
`newConfidence`, `level`, `reviewAdded`, `progressionApplied`, `evidence:
server-objective` (or the guided listening/dictation/transcript provenance above),
attempt/status and versions. Choice activities accept only offered answers;
Sentence Builder accepts a complete chunk permutation; Dictation and Shadowing accept bounded
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
learning routes remain CORE-004/005 work.

The shared browser lifecycle owns permission to change level (`canChangeLevel`).
Creation/loading and unresolved submission errors retain their original reference
and keep level selectors disabled. The action itself checks the pending payload,
operation lock and owner token, so a stale control cannot overwrite recovery state.
After feedback, normal level changes work again. Expired/invalid rounds retain the
explicit new-round recovery action. This adds no API or local-reference version.

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

### Saved pronunciation assessments

Signed accounts use `speaking-acoustic.v1`; guest previews remain temporary.

- `POST /v1/speaking/assessments`: `{requestId,attemptId,transcript,
  contentVersion,transcriptRulesVersion,rulesVersion,audioBase64}`. The account's
  shadowing snapshot supplies the reference. Accept PCM mono 16-bit 16kHz WAV,
  1 sample–12 seconds, at most 400000 decoded bytes; JSON limit 600000 bytes.
- `GET /v1/speaking/assessments`: latest 30, optionally `?attemptId=...`.
- `GET /v1/speaking/assessments/{id}` and
  `GET /v1/speaking/assessments/by-request/{requestId}` restore saved state.
- `POST /v1/speaking/assessments/{id}/retry`: `{generation,audioBase64?}`.
  Old generations, completed and live pending requests only read state. Acquiring
  a failed/ready/expired generation requires the original matching WAV. A hash
  alone cannot trigger scoring. Initial exact duplicates never re-evaluate.

Receipts contain reference, reported transcript, sample hash/format/duration,
content/rules versions, status/generation and validated provider feedback. State
is `ready`, `evaluating`, `failed` or `completed`; active evaluation returns 202,
finished outcomes 200. Wrong owner is 404, invalid input 400, conflicting payload,
generation or missing original recording 409. Unknown status/storage failure is
503 and must retain the local request identity. No raw audio is stored or logged.
Browser recovery stores owner/attempt/request identity only. Releasing a local
reference does not delete account history; after reload another evaluation needs
a new recording. Explicit same-recording retry may repeat external billing if
an earlier provider response could not be committed.

The provider result must bind audio/reference hashes and expose finite 0–100
scores, mandatory accuracy/fluency/completeness, optional prosody and bounded
word/phoneme details. Zero is valid. Provider/configuration/schema failure saves
failure with no acoustic score. Model revision is recorded as unspecified, not
invented. Acoustic receipts award no XP, confidence, review, rank or IELTS band.
Migration 020/startup schema is additive; deploy AI/API before web and keep saved
receipt handlers on rollback. See [ADR 009](decisions/009-acoustic-receipts.md).

- `POST /v1/ai/writing-score` requires sign-in and returns 409; use the saved
  Writing submission flow above. The internal AI `/v1/writing/score` endpoint
  accepts server-supplied `{essay,task,rulesVersion}`, returns validated feedback
  or 503, and has no heuristic band fallback.
- `POST /v1/ai/speaking-feedback`
- `POST /v1/ai/exercises`
- `POST /v1/conversation/reply`

## Missions

- `GET /v1/missions/airport`

### Guided campaign dialogue (`conversation.v2`)

All three endpoints require an authenticated account; guest demo requests return
401. Nine `/missions/*` routes use this contract. The reply/coverage comes from
an ordered server rubric; it is not a fluency or acoustic score.

- `POST /v1/player/bosses/{id}/evaluate`: `{messages: string[], rulesVersion:
  "conversation.v2"}`. An unlocked chapter is required. Returns `bossId`, stage,
  objective-coverage score, complete, completed/missing objectives, per-turn
  `{index, accepted, objective, feedback}`, next partner `reply`, rulesVersion and
  evidence `server-rule-based-reported-dialogue`. Evaluation does not save rewards.
- `POST /v1/player/bosses/{id}/complete`: same payload; returns `{progression,
  receipt}`. Receipt contains `bossId`, original `messages`, immutable `evaluation`,
  `legacy` and optional `preparation`. Completion recomputes the rubric server-side,
  rechecks campaign prerequisites inside the reward transaction, then atomically
  stores receipt and existing first-clear campaign XP. Identical retry returns
  stored evidence; changed messages/version return 409. `score` is rejected (400).
- `GET /v1/player/bosses/{id}/receipt`: the current account's receipt, or 404.
  Earlier clears return `legacy:true`, empty messages and no evaluation; they
  receive no retroactive transcript or additional reward.

At most 24 turns and 1024 UTF-8 bytes per nonblank turn. Empty arrays are valid
only for requesting the initial prompt, not for earning a new completion. A turn
must address the current objective; repeated/irrelevant turns do not advance it.
No per-turn learning XP/confidence is recorded. `/v1/attempts` rejects normalized
`npc-conversation*` activities (409). Rubric limits, migration 017, startup schema,
API-before-frontend rollout and data-preserving rollback are specified in
[ADR 005](decisions/005-mission-evidence.md). Campaign preparation follows
[ADR 012](decisions/012-campaign-practice-gates.md); broader legacy confidence/world
unlock policy remains CORE-005. Only successful completion receipts are stored on server;
unfinished dialogue and draft/pending operations stay in account-scoped browser
storage, with no tokens in the saved draft. No dialogue is added to logs.

### Campaign preparation (`campaign-practice.v1`)

GET progression and first-clear completion use the same nine-chapter policy.
Each checkpoint needs a correct, completed shared attempt belonging to the account,
with nonempty content version, supported activity/rules and actual `completed_at`.
Legacy accuracy rows, confidence changes, wrong answers, unfinished rounds, other
owners, unsupported pronunciation providers and missing completion times do not count.
Later chapters require the previous clear plus all three rounds completed strictly
after its saved completion time. An identical submit retry retains its old time;
a new correct round counts even with zero additional daily XP. Version 1 matches
activity, not pack/CEFR or unassisted mastery. Shadow Me remains guided transcript
matching, not pronunciation assessment.

New clear receipts include `preparation:{rulesVersion,previousBossId?,
previousCompletedAt?,checkpoints}`. Each checkpoint records `{checkpointId,attemptId,
activity,contentVersion,rulesVersion,completedAt}` selected at first clear. Further
practice/retries do not replace it. Existing clears stay cleared/unlocked and retain
their dialogue/XP/cosmetics; receipts without preparation are not backfilled.
Goal/lifetime XP still opens personal worlds. No new schema: use existing evidence
JSON and migration 021's completion timestamps; deploy API before UI, keep old data.

Allowed browser origins receive CORS headers on rate-limit errors too, including
an exposed `Retry-After` header. The existing request limits remain unchanged;
429 must be readable as a service response rather than an opaque fetch failure.
