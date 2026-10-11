# ADR 004 — Guided transcript evidence and optional speaking feedback

Date: 2026-10-11. Scope: the first CORE-004 slice, `/speaking` and
`/ielts/speaking`. Implementation/acceptance status lives in [ROADMAP](../ROADMAP.md).

## Problem

SpeakingPractice recorded the target phrase instead of the actual transcript and
submitted client accuracy each time Analyze ran. A provider error could fabricate
local coach bands and pronunciation proxies. Recorder lifecycle also lacked
permission-error handling and cleanup on unmount/account changes.

Campaign checkpoints already depend on shadowing practice. Removing all Speaking
progress without a replacement would leave those campaigns without their path.
Audio and recognized text are different evidence; transcript overlap cannot prove
pronunciation, speaking fluency or a valid IELTS band.

## Decision

Use the existing learning-attempt store, snapshot, owner/retry protocol and daily
claim for `shadowing`. Move the 30 existing phrases and ten labels to one catalog;
the compatibility content-pack accessor reads that catalog. Choose three distinct
phrases per set. Preserve the existing mixed content rather than claim CEFR
calibration; B1 is routing metadata until CONTENT-001/CORE-007.

`shadowing.v1` grades the submitted transcript against the visible saved phrase
using retained v1 token edit alignment. It stores the actual response, versions,
alignment and `server-guided-transcript-match` provenance. Typed/edited transcripts
have the same reported-text status as recognition text. They are not authenticated
speech, acoustic judgments, independent recall or competitive evidence.

Retain shared first-check-per-item/version/UTC-day practice progression: normalized
exact matches may earn 20 XP, wrong first checks add review, fractional match feeds
the existing practice confidence model. Guest/daily-repeat rounds have no account
progression. Failed network requests keep the original pending answer and retry
identity; completed attempts are immutable. Generic client-accuracy submissions
for shadowing and pronunciation-assessment are rejected. CORE-005 must separately
decide how all historical and guided evidence enters mastery/ranking.

Coach feedback is a separate optional action. Text-only responses show language
suggestions and their provider, with no numeric fluency/pronunciation/IELTS claim.
Acoustic feedback requires the provider's explicit acoustic flag and a bounded
numeric score. It never changes the attempt grade or XP. A partial provider failure
keeps successful feedback; retry only requests missing feedback. Completion disables
repeat analysis for the same sample. Old asynchronous responses are ignored after
sample, attempt or owner changes; requests are aborted on cleanup.

Record audio only after a microphone action; send it only after a coach action.
Keep WAV bytes in memory, not browser storage, snapshots or logs. Save transcript
drafts under the existing owner key. Stop capture on hide, navigation, account
change and the ten-second limit; release a stream granted after cancellation.
After reload the text remains, but audio/coach results require a new recording/request.

## Compatibility and limits

No SQL schema change. Add optional `transcriptMatch` to results and retain all
older activity snapshots/graders. Deploy API before frontend; a rollback must keep
shadowing.v1 support and legacy rejection or disable new rounds while retaining
resume/grade. Never erase old attempts or reclassify legacy client scores.

This does not implement persistent acoustic/provider receipts, mission dialogue
evaluation, IELTS history versioning or comprehensive rank integrity. Existing AI
endpoints remain advisory; their historical numeric proxy fields are not shown or
used by the new Speaking UI. A configured production acoustic provider and physical
microphone quality require separate validation; simulated browser media does not
establish real pronunciation accuracy.

## Verification

Store tests cover memory and dedicated PostgreSQL (CI), concurrent retry, wrong and
correct transcript, repeated-word omission, immutable actual response, daily cap,
owner/version/expiry and restoration against a retired catalog. Browser tests use
real attempts/grades with simulated microphone/provider events for deterministic
failure and cleanup cases. Check actual input, failed/committed response loss,
cross-owner drafts, no coach rewards, unavailable acoustic provider, delayed coach
responses, hidden/navigation cleanup, distinct campaign phrases and mobile controls.
Acceptance evidence belongs in [SYSTEM-VALIDATION](../SYSTEM-VALIDATION.md).
