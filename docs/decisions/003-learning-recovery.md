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
- Word Link, Grammar Repair, Collocation Factory, Sentence Builder, Word Graph and Reading Race reject generic client-accuracy submissions.
  Other learning/competitive routes remain CORE-003/005 migration debt.
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
