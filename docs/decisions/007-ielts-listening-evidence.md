# ADR 007 — IELTS Listening selections and per-part playback

Date: 2026-10-16. Status: accepted design; implementation acceptance is tracked
in [ROADMAP](../ROADMAP.md), CORE-004.

The current Listening UI submits a client tally and loses answers on reload.
Replace it with signed-in `ielts-listening.v1` shared learning attempts, pack
`ielts-listening`, B2 routing metadata and the existing original four-part paper.
Move its single source catalog to the backend; retain Reading v1 compatibility.

Reuse the objective selection parser/grader and atomic IELTS receipt writer.
Opaque option IDs and ordered `[questionId, optionId]` tuples follow Reading's
2048-byte contract. Blank/wrong answers remain part of the immutable result.
Listening uses its existing raw-score interpolation, explicitly a local practice
estimate. No XP, skill confidence, daily reward or review side effects.

Extend the existing audio journal with optional `partId`: required and validated
for Listening papers, absent for existing short-clip activities. A request ID
binds both part and rate; it cannot be reassigned on retry. Public prompts contain
questions, not transcripts/keys. Audio preparation uses the saved part transcript;
browser synthesis explicitly receives that text as assistance. Completed results
reveal transcripts and original selections. Playback remains client-reported,
never proof of human listening or acoustic assessment.

Learners may read and answer questions before/during playback. Saving requires
at least one completed playback report for each of the four parts. Replay and
slow playback are allowed and recorded; incomplete/failed playback does not satisfy
that requirement. Use the same row lock for audio and grading so completed evidence
cannot change. Cap the paper journal at 128 requests; existing clips retain 32.

Reuse owner-scoped drafts and exact pending-answer retries. Preserve a pending
audio request with its part ID across reload; an interrupted requested playback
can be played again, whereas a completed report retries without playing again.
Hide/stop/unmount abort media. The long-paper caller gets a five-minute playback
budget; short-clip callers keep their existing budget. Handle corrupt references
explicitly and disclose unavailable browser storage.

No new table or destructive migration: migration 018 already supports receipts
and snapshots are additive JSON. Old Reading snapshots, old single-clip audio
events and legacy/client-reported IELTS rows retain their meaning. Reject both
old objective tally writes and `ielts-listening*` legacy learning accuracy once
the replacement exists. Deploy API before frontend; preserve v1 handlers,
snapshots/receipts and legacy rejection on rollback. Never reset user data.

Acceptance includes all 40 selections, per-part audio identity/status/version,
owner isolation, expiry, immutable retry, concurrent audio/submit and rollback,
old snapshots/history, zero rewards, response loss, reload/account switch,
playback failure/abort/long completion, storage errors and 390×551/844 keyboard/
touch review. Full CI must be clean on the final PR head before merge.
