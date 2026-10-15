# ADR 006 — IELTS Reading selections and evidence-only results

Date: 2026-10-12. Scope: CORE-004, `/ielts/reading` and IELTS history provenance.
Implementation and verification status live in [ROADMAP](../ROADMAP.md).

## Problem

The existing Reading component ships its answer keys, counts correct answers in
the browser and posts a tally. The server cannot reconstruct what was answered.
Each retry creates another history row. IELTS history also accepts arbitrary
client band/source labels and shares a demo account when used anonymously.
The tower suggests a complete four-skill result although active Writing and
Speaking screens do not save corresponding bands. The common dashboard returns
a hardcoded overall 6.0 regardless of practice evidence.

## Decision

Move the existing three original passages and 40 questions into one versioned
backend catalog. Preserve their text and IDs. This is practice content, not a
calibrated official test. Issue `ielts-reading` through the shared learning
attempt start/get/submit lifecycle, with pack `ielts-academic-reading` and rules
`ielts-reading.v1`. Its B2 request value is routing metadata; it does not establish
CEFR difficulty or IELTS band calibration. An account is required.

The persisted snapshot contains the whole paper and grading key. The public
prompt contains passages, question IDs and shuffled options with random opaque
IDs; it omits the key until grading. Keep the issued IDs/order stable across
reload, creation retries and content updates. The shared 24-hour attempt expiry
applies to active work; a completed result remains readable.

The submitted `answer` string is a JSON array of `[questionId, optionId]` pairs.
Each question appears at most once. Omitted questions are unanswered; `[]` is a
valid blank submission. Reject unknown IDs, an option from a different question,
duplicates, malformed tuples and oversized input. The frontend serializes pairs
in paper order, within the shared 2048-byte answer boundary. The server preserves
the original submission, including omitted questions in the result review.

## One result, no learning reward

Use the existing attempt identity, owner checks and row locking. Completing the
attempt and appending its IELTS history must commit in one transaction. History
uses the attempt ID as its unique idempotency key, so identical retries return the same completed result and
different submissions conflict. A committed result stores the score and method;
do not silently recompute it using a later catalog or band conversion.

The server selects an evidence-only path for this activity. Do not write a daily
learning reward, legacy learning attempt, XP, skill confidence/level or review
item. This policy is not a client flag. Generic legacy `ielts-reading*` accuracy
submissions are rejected so they cannot bypass that boundary. Verify both correct
and incorrect submissions and concurrent claims in PostgreSQL and memory.

The result records `server-objective-practice`, provider `loccao-objective`,
content/rules versions and method version `ielts-anchors-interpolation.v1`.
The raw score counts actual correct selections out of 40. Retain the existing
interpolated band estimate, explicitly labeled as an internal practice estimate;
these questions and this interpolation do not establish an official IELTS score.
Server grading proves the selection-to-score calculation, not human authorship,
unaided knowledge or the psychometric quality of the paper.

## Recovery and presentation

Reuse the shared account-scoped attempt reference, draft and immutable pending
submission. Lock answer changes while a submit is pending and after feedback.
A failed request retries the same attempt and payload; switching accounts clears
visible results and ignores stale responses. Explicit new practice creates a new
attempt after the current result is resolved. Storage failure is disclosed;
in-memory recovery cannot survive a full refresh when browser storage is blocked.

Show actual selections, unanswered questions and correct choices only after
grading. Keep passage navigation and keyboard/touch controls readable on both
390×551 and 390×844. History distinguishes server-graded Reading from client
reports; it does not combine unsupported four-skill evidence into an overall.
The common dashboard shows an empty overall state rather than the old 6.0 and
uses a persisted, chosen target when available.

## Legacy data and rollout

Migration 018 and startup schema changes are additive. Preserve previous rows
and source labels; rows without the new provenance metadata remain
`legacy-unverified`, with `legacy: true`. Never reconstruct answers or upgrade
an old source string to verified evidence.

Reading tally writes return 409 once the replacement is available. Listening
retains its existing tally flow temporarily, authenticated and explicitly
`client-reported`; its playback and answer lifecycle remain a separate task.
New arbitrary band writes return 409 (there is no active UI caller). IELTS history
and writes require an account; do not expose or merge the shared demo history.
Writing/Speaking coach feedback remains separate from persisted IELTS receipts.

Deploy migration/API before frontend. Preserve snapshots, receipts, the v1 grader
and legacy rejection on rollback; do not restore the tally-based Reading save.
Do not drop evidence columns or reset user data. No production deployment is
included in this slice.

## Acceptance

Test all 40 answers and catalog identity; correct, wrong, blank, duplicate and
foreign IDs; no pre-grade key; owner/version/expiry; immutable retry and concurrent
submission; atomic history and zero progression side effects; migration replay
and old history; browser draft, response loss, account switch, unavailable/corrupt
storage, feedback locks and both mobile viewports. Record local and CI results
separately in [SYSTEM-VALIDATION](../SYSTEM-VALIDATION.md).
