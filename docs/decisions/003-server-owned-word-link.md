# ADR 003 — Server-owned Word Link pilot

Status: accepted for implementation, 2026-09-27. CORE-001; routes below are the
implementation target until validation is recorded, not evidence of deployment.

## Contract

- `POST /v1/learning/word-link/attempts`: `{requestId, pack, round}`. A client UUID
  makes creation retryable; the server issues a separate random attempt ID and
  opaque shuffled choice IDs. Returns prompt/word/options and content/rules
  versions, round/total, mode, expiry; never answer/note before submission.
- `GET /v1/learning/word-link/attempts/{id}`: owner-bound resume. Completed attempts
  include their saved verdict. Guest attempt IDs are unguessable capabilities;
  guest sessions never update the shared demo learner, XP or mastery.
- `POST /v1/learning/word-link/attempts/{id}/submit`:
  `{choiceId, contentVersion, rulesVersion}`. Server grades its private snapshot,
  stores the actual selected label separately from the correct answer and returns
  feedback. Unsupported versions, unknown choices and changed retries are rejected.
- Authenticated ownership uses the existing Bearer identity. An invalid token never
  falls back to guest. An account attempt cannot be retrieved/submitted as guest or
  another account; signing in never adopts a guest attempt.

Creation keys are unique per owner (guest requests use the random request UUID).
The attempt, snapshot and result live in PostgreSQL or explicit temporary memory
mode. Unsubmitted attempts expire after 24 hours. Identical completed submissions
remain retryable after expiry; expiry is not a test of player speed.

## Atomic progression

Submit locks the attempt. The first submission commits its immutable verdict,
actual-answer attempt log, skill/review update and reward claim in one transaction.
Concurrent identical submissions return the same verdict. A content/version earns
progression at most once per account per UTC day; later new attempts can practise
but receive no additional XP/confidence update. Guest attempts receive no XP.
The first graded attempt uses the existing 10/30 XP incorrect/correct convention;
this is disclosed in the result, never computed by the frontend.

The review queue retains the correct answer; the attempt log retains the actual
response. Legacy records keep their meaning. The generic `/v1/attempts` route
rejects Word Link after migration so the old UI cannot grant its own Word Link
accuracy. Other legacy activities remain CORE-003/005 debt.

## Client and rollout

Word Link stores only owner-scoped attempt references and a pending choice for
lost-response retry, not answer keys. It can resume after reload, explicitly retry
network errors and discard stale responses on account/pack changes. It does not
grade locally when the API is unavailable. A saved choice remains locked until
the same submission succeeds or an expiry/conflict is explicitly resolved.

Server-verified duel submission is outside this pilot. Word Link must stop posting
client-computed duel scores and show practice-only messaging on challenge links.
The generic competitive endpoint remains CORE-005 debt; do not claim complete
anti-cheat protection. Publicly learnable content and other legacy endpoints are
not secured merely by opaque option IDs.

Deploy migration/API before the new Word Link client. Roll back the web UI to an
unavailable/retry state if needed; never re-enable self-reported Word Link XP to
hide an outage. Old attempt history remains; no user data is reset.

## Acceptance

Domain/catalog, HTTP and memory/PostgreSQL tests cover invalid payload/owner,
expiry, wrong answers and correct review targets, same/different retry, concurrent
submissions, daily reward deduplication and restart durability. Browser tests must
exercise actual API grading, reload/lost response and guest/account separation.
