# ADR 009 — Saved acoustic feedback without retained recordings

Status: Accepted design; CORE-004 acceptance remains in ROADMAP.
Date: 2026-10-21. Decider/implementer: Codex under the approved core roadmap.

## Context

SpeakingPractice uses shared shadowing attempts for reported transcript practice.
Coach/acoustic responses remain ephemeral. Transcript alignment and recording
quality are not pronunciation evidence. A result must identify the original
reference, actual audio sample and provider without retaining raw microphone data.

## Decision

- Signed-account acoustic receipts use `speaking-acoustic.v1`. The server reads
  the reference/content/rules from the account-owned shadowing snapshot, never
  from client reference text. Capture ID/request ID binds the learning attempt,
  exact reported transcript and SHA-256 of a validated PCM WAV sample.
- Validate mono 16-bit 16kHz WAV, at least one sample, at most 12 seconds and
  400000 decoded bytes. Browser recorder remains user initiated and limited to
  ten seconds. No background capture or automatic upload. Raw bytes exist only
  during capture/provider I/O, never in SQL snapshots, localStorage or logs.
- Store reference, reported transcript, sample hash/format/duration, versions,
  generation/state and validated feedback. Receipts retain like existing learning
  history until account deletion; there is no raw audio replay/download facility.
  Browser recovery stores metadata only. Explain both provider transmission and
  that browser recognition may itself use an online service before recording.
- Dedicated receipt table, shared evaluation lease policy with Writing. Short
  row locks claim 90-second generations; provider I/O stays outside transactions.
  Initial duplicate requests read the same outcome. An explicit retry names the
  latest generation; stale workers cannot commit. Completed receipts never
  re-evaluate. Provider timeout/configuration/invalid output is a saved failure,
  not fabricated pronunciation or a successful acoustic receipt.
- After a lost committed response/reload, GET restores the receipt without audio.
  A failure/dead worker can re-evaluate only with the original matching WAV still
  in memory. After reload bytes are unavailable: keep the failed/pending record,
  allow status checks, and request a new recording for a new assessment. Losing
  an uncommitted upload cannot be repaired from a hash. Never silently send a new
  sample under the old ID. Ambiguous provider success before commit may repeat
  billing on explicit retry; exactly-once external execution is not promised.
- AI validates finite 0–100 scores (zero is valid), bounded word/phoneme feedback,
  provider/method identity and input hashes. Go independently validates before
  commit. Azure's underlying model revision is not supplied by this endpoint:
  record `provider-managed-unspecified`, do not invent a calibrated model version.
- Optional language coach stays separate and advisory. Existing guest acoustic
  previews remain temporary and explicitly labeled; no guest receipt import on
  sign-in. Saved acoustic results do not change transcript grading, XP, confidence,
  review/daily claims, rankings or IELTS band/overall. Raw proxy responses are not
  accepted as persisted evidence. Older shadowing attempts/results remain intact.

## Options and consequences

Persisting audio would enable unattended retry but adds retention/access duties
and contradicts the existing microphone boundary. Chosen metadata-only receipts
preserve feedback with less sensitive data; retry after lost audio requires a new
take. Forcing acoustic evaluation into objective grading would mix evidence and
reward contracts; a separate adapter/store reuses only the shared lease policy.
Provider quality, physical-microphone accuracy and calibrated scoring require
separate validation; synthetic media/provider tests establish software behavior.

## Rollout and verification

Additive migration 020/startup schema, AI/API first, then frontend. Rollback keeps
receipt handlers, hashes, versions and existing shadowing graders; no database or
browser queue reset. No production deployment in this slice.

Verify memory/PostgreSQL migration replay, owner/snapshot binding, WAV bounds,
exact duplicates, concurrent claims, lost responses, stale workers, missing audio,
provider missing/malformed/zero and unchanged rewards. Browser input covers signed
and guest flows, metadata-only recovery, account changes, permission cleanup,
history and 390×551/844 rendering. Evidence belongs in SYSTEM-VALIDATION.

Protocol reference: [Microsoft short-audio REST API](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/rest-speech-to-text-short)
documents the PCM format, assessment header and score/word fields. Provider model
revision is not included in the response contract used here; fixture tests verify
protocol handling, not provider calibration or physical microphone quality.
