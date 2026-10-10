# ADR 003 — Durable verified learning rounds

Accepted for implementation, 2026-09-27; CORE-001/CORE-002.

The A1–C2 Word Link and Grammar Repair implementations on main are the base.
Extend their existing `/v1/learning/attempts` contract and shared hook; do not add
a parallel Word Link-only engine or replace their catalogs with a smaller bank.

## Invariants

- Persist the public prompt/options and normalized creation input with the private
  answer. GET by attempt ID restores this snapshot, even after catalog edits.
- A creation UUID belongs to one owner and immutable input. Completed retries
  return the committed result, not another reward. Conflicting payloads get 409.
- Anonymous rounds are guest practice with no demo/account progression. Invalid
  Bearer tokens get 401. Guest IDs/creation UUIDs are private capabilities.
- Active attempts expire after 24 hours; completed retries remain retrievable.
  Unsupported/old active snapshots require a new round, without deleting history.
- Submit accepts only an offered answer and matching content/rules versions.
  Actual answer is stored separately from the answer taught in review.
- First completion per account/content/version/UTC day updates confidence and
  review once; correct answers earn the existing 20 XP, wrong answers earn 0.
  Further attempts remain playable practice. Verdict, evidence and claim commit
  in one PostgreSQL transaction. This is practice evidence, not anti-cheat/rank.
- All nine CORE-003 activities reject generic client-accuracy submissions,
  including Listen & Pick and Dictation Rush. Speaking, conversation, IELTS and
  competitive routes remain CORE-004/005 migration debt.
- The shared frontend hook stores an owner/activity/pack-scoped round reference,
  selected answer and set context. Network retries preserve IDs and locked input.
  Account, route, level and unmount changes invalidate old responses synchronously.

## Rollout

Migration 016 is additive except allowing guest rows with null owner. Preserve
014/015 and existing history. API/schema first, web second. Missing submit versions
from an old web client get a refresh-required validation error; completed results
remain stored. Active pre-snapshot rounds expire safely. Roll back to an explicit
unavailable state if needed, not to client-reported XP. No production deployment
is implied by this ADR. Memory mode remains temporary.

## Verification

Use HTTP, memory/PostgreSQL concurrency tests and real browser/API flows. Cover
lost committed responses, invalid owner/version, daily replay, correct review
answers, auth changes, level/pack transitions and reload. Mocked browser transport
tests validate recovery UI only and are reported separately from integration.

## Collocation extension — 2026-10-06

Reuse the optional snapshot question field for a situation that disambiguates the
word pair. No new grading engine, schema or assistance mode is introduced. The
versioned server catalog is the only Collocation answer source; the old browser
catalog and scoring implementation are removed. The UI supports old pair-only
snapshots, locks choices after submission and blocks level changes while an answer
is awaiting confirmation. This is untimed practice with feedback, not a claim of
unassisted mastery. See API for content-version rollout and daily claim semantics.

## Sentence Builder extension — 2026-10-07

Add optional `chunks: [{id,text}]` to the existing public prompt snapshot. IDs are
opaque and unique per occurrence (including repeated words), and shuffled with a
server-private random seed. The client request UUID must not reveal position IDs.
The stored chunk snapshot reproduces the round. The private correct answer remains natural sentence text. Submit
`answer` as a JSON-encoded array of chunk IDs, each offered ID exactly once. The
server resolves that order from the saved snapshot, compares sentence text, and
stores the submitted ID sequence for immutable retries; result/evidence/review
use readable actual/correct sentences. No current-catalog lookup during grading.

Rules `sentence-builder.v1` use case-insensitive exact sentence comparison; prompts
specify the intended structure where movable phrases permit alternatives. No free
text grading, hint or time bonus. Feedback closes the attempt; reset only edits an
unsubmitted draft. Replaying is practice subject to the existing daily cap, never
a claim of unassisted mastery. Owner-scoped local references gain an optional draft
field; old references and the existing three activities remain compatible.

No SQL schema change: JSON snapshots and submitted-answer text already support
this contract. Deploy API before web. On rollback keep the legacy score rejection
and the v1 sentence grader for existing snapshots, or explicitly disable this
activity; never restore client-reported XP. Existing legacy history is unchanged.

## Cross-activity recovery audit — 2026-10-11

Level selectors must consume the shared hook's `canChangeLevel` permission.
Word Link and Grammar previously disabled them only during network requests;
after a failed submit, changing level replaced the pending reference. Allow level
changes only in active/feedback states without a pending answer or a recovery
error. Also check the synchronous operation lock, pending reference and current
owner inside the action; a stale/enabled control is not authority to discard work.
Keep explicit recovery for expired/invalid rounds. No API/save migration.

All compatibility exports in MiniGames now resolve to the active adapters.
Remove the unused client Word Link/Grammar banks from contentPacks; keep its
Speaking labels and prompts unchanged. The nine objective catalogs/graders
remain server-owned. Public study maps, speaking examples and browser TTS text
remain teaching material, so no claim of secret content or unaided mastery is made.

## Word Graph extension — 2026-10-07

Separate `/word-graph` exploration from `/word-graph/practice` rounds. Exploration
shows definitions and labelled connections but never creates attempts or awards
XP. The server page projects only public nodes/edges from one server-owned graph
catalog; the practice route receives only its issued prompt/options. Do not bundle
the graph answer bank into the practice component or show a connection inspector
during an active round. The same graph catalog derives the private target answer
and relation-specific question, preventing a second independent answer source.

Use `word-graph.v1`, travel-network pack at editorial A2, three-question sets,
the shared verified choice lifecycle and existing daily reward policy. Submit the
chosen node label as the actual answer; the relation is not the player's answer.
No hint/timer/correction mode or schema change. Exploring this publicly available
map is studying, not recall evidence. Practice results never claim unaided mastery:
the system does not prove whether the map was viewed in another tab or earlier.
API before web; on rollback keep the legacy rejection and saved-round support.

## Reading Race extension — 2026-10-07

Add optional title/passage strings to the public prompt JSON, preserving existing
activities and snapshots. One server-owned catalog supplies contextual questions,
four choices, the private correct answer and exact supporting excerpts. Store all
of these at creation; grading and recovery never fetch a newer catalog. Result
feedback combines evidence and explanation only after submission. Review prompts
retain the title, passage and question rather than an isolated question.

Use reading-race.v1 with core A2/B1/B2 (three distinct items each); the existing
choice grader and lifecycle handle selected text, owner, version, retry, expiry
and daily claims. The text remains visible: this assesses comprehension with the
source available, not unaided recall or reading speed. No timer, hint bonus or
schema change. Keep the new prompt fields, saved-round grading and legacy rejection
when rolling back. Old client accuracy receives 409; refresh after API-first rollout.

## Story Choice extension — 2026-10-08

Represent each decision as an ordinary immutable learning attempt, connected by
a server-only parent/child edge. Retain the graph, node, root deadline and committed
history in a private snapshot field. Public prompts contain only the current scene;
public history contains only decisions already made. This keeps the existing
owner checks, atomic grade/progression transaction and daily claims instead of
introducing a second reward engine or SQL table.

Continue accepts a completed parent ID and an empty body. Its persisted choice
selects the next node from the saved definition. The reserved request key
`story-next:<parent ID>` and existing owner/request constraint guarantee one child
under retries/concurrency. Public starts require UUIDv4, so clients cannot preempt
that namespace. A terminal/ungraded parent cannot continue. Existing children are
returned unchanged; fresh children inherit the root deadline, not a renewed TTL.

The story-choice.v1 adapter permits multiple effective options according to the
authored scenario rubric. Result feedback describes the chosen consequence and
an ending when reached. The canonical answer is a review reference listing valid
options, not a separate scoring authority. Practice rewards stay capped per scene;
endings add no bonus. This is distinct from Adventure quest rewards and does not
claim unaided or competitive evidence. Reopening a root is explicit replay.

The shared frontend lifecycle persists an optional parentAttemptId before a
continue request, then stores the returned child ID. Reload/network failure retries
that edge; pending choices and account isolation keep the existing behavior.
Previous reference formats and non-story activities remain compatible. API-first
rollout; retain the story snapshot decoder/grader/continue path and legacy rejection
on rollback. Saved graph versions remain readable; do not delete user progress.

## Listen & Pick extension — 2026-10-08

Keep the transcript in a private listening snapshot; public prompts project only
question and shuffled choices. Audio preparation uses the saved transcript, never
client-supplied text or a newer catalog. The existing AI service is attempted with
an eight-second deadline. Neural bytes are returned without transcript; unavailable
neural audio explicitly falls back to browser synthesis, which requires text.
This fallback is intentional source exposure, so every result is guided practice.

The private snapshot has a bounded audio journal: stable request UUID, rate,
requested/completed/failed state and reported provider. Preparation persists before
calling TTS; media callbacks determine the browser's completion/failure report.
Store audio changes under the same row/memory lock as grade, freezing assistance
with the final verdict. Terminal reports are immutable and idempotent, including
after grade. Repeated preparation does not create another event. Incomplete events
from interruptions remain requested and do not imply playback succeeded.

Persist the pending audio operation by attempt ID before sending; persist a terminal
report before acknowledging it. Reload retries that operation, and a lost committed
report restores from the server without replaying. Cleanup cancels active media on
route/account change and ignores stale responses. Submitted answers continue using
the shared owner-scoped lifecycle. No SQL schema or second reward engine is added.

Grade actual offered choices, require a completed report, reveal transcript and
explanation only in feedback, and reject the legacy accuracy route. Playback
callbacks/provider claims can be forged by a modified client; the gate is a guided
practice interaction, not anti-cheat evidence. Mark result and attempt provenance
`server-objective-guided-listening`; never upgrade it to verified unaided listening.
Replay/slow listening have no bonus or penalty, and existing daily claims remain.
API first; retain snapshot/audio/grader support and legacy rejection on rollback.
Dictation alignment and its scoring contract remain a separate CORE-003 slice.

## Dictation extension — 2026-10-09

Reuse the same listening snapshot/journal, lifecycle and reward transaction.
`dictation.v1` aligns normalized word sequences using unit-cost Levenshtein edits;
an insertion/deletion no longer shifts every following word. Penalize extra tail
words as well. See [API](../API.md) for normalization, tie-break and score rules.
Store the actual typed answer and use fractional accuracy in confidence/history,
but grant XP only for zero edits under the existing first-attempt daily claim.

Derive the alignment report deterministically from the saved reference, actual
answer and retained v1 grader. No catalog lookup on grade/retry and no SQL change.
Future rules must add a versioned grader rather than change v1 behavior. Completed
payloads are immutable even if a later correction normalizes to the same tokens.

The existing owner-scoped draft/pending reference preserves typing and transport
retries. Feedback makes the textarea read-only. Audio support and its limits match
Listen & Pick: source exposure for browser synthesis and client-reported playback
mean `server-objective-guided-dictation`, never independent listening evidence.
Roll out API first; rollback retains snapshot decoding, v1 grader and old-route
rejection. Legacy client-only rounds had no saved server snapshot to migrate.
