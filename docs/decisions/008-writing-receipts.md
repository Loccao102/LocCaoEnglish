# ADR 008 — Writing drafts, immutable submissions and evaluation receipts

Status: Accepted design; implementation/acceptance tracked in CORE-004.
Date: 2026-10-18. Decider/implementer: Codex under the owner's approved Writing scope.

## Context

WritingLab keeps only React state and both browser/AI fallback infer bands from
word counts. Late responses can grade a different essay. Objective attempts have
a 2048-byte answer budget and synchronous deterministic grading, unsuitable for
essays and external evaluation. Preserve shared account/auth/IELTS history and
reward boundaries without forcing external work inside a learning transaction.

## Decision

- Dedicated versioned Writing attempts, original Task 2 prompt supplied by server.
  Signed accounts only. Each attempt has request ID, optional parent revision,
  prompt/content/rubric versions, exact essay (maximum 12000 Unicode characters),
  draft version and lifecycle draft → evaluating → completed or failed.
- Draft saves use optimistic version checks; exact retry returns the same draft.
  Local owner-scoped recovery retains unsent changes and pending operations.
  Conflicts never overwrite another tab silently. Submitted essays are immutable;
  editing creates a child revision with the same prompt and a new request ID.
- Submit requires the saved draft version/essay, at least 40 words. A short
  transaction freezes it and claims a 90-second evaluation lease/generation.
  Provider I/O occurs outside the transaction, with a 25-second HTTP timeout;
  completion uses a separate bounded context after client disconnect.
  Concurrent same-payload submits during the lease return the pending attempt.
  Submit names the observed generation; resending an old generation reads the
  resulting state even after failure. Only explicit retry using the current
  generation may call the provider again.
  After expiry an explicit retry may claim a new generation; stale workers cannot
  commit. Failed evaluation can retry the identical frozen essay. No automatic
  provider retry, background polling that invokes scoring, or client band input.
- A crash after provider response but before receipt commit is ambiguous. We
  cannot promise exactly-once provider billing; explicit recovery may repeat the
  provider call after the lease. Only one receipt can commit. The stored generation
  records retries; completed retries never call the provider again.
- Store completion and feedback in one row/transaction. IELTS history derives
  Writing entries from completed receipts (no second independent writer), labels
  them provider estimates, and links to the original essay. No XP/confidence/
  review/daily claim or four-skill overall is created.
- AI service validates finite half-step criteria/overall (including zero), exact
  rubric version and evidence quotations from the supplied essay. Server validates
  the response again, with bounded text/response sizes. Provider/model/evaluator
  versions are attached by the service, not accepted from browser/model output.
  Missing configuration, timeout or malformed output becomes a retryable failure;
  no heuristic band substitutes. Local word/paragraph counts are editing aids only.

## Options considered and trade-offs

1. Extend objective attempts: less plumbing, but mixes external evaluation and
   essay draft concurrency with deterministic short answers/rewards. Rejected.
2. Dedicated Writing store using existing auth/history boundary: moderate complexity,
   PostgreSQL row locks and memory parity; chosen. Drafts retain indefinitely like
   existing learning history; no essay text is logged or exported to telemetry.
3. Job queue/worker: better recovery at scale, extra infrastructure/operations now.
   Defer; explicit retry and bounded leases are sufficient for this slice.

## Rollout, compatibility and verification

Additive migration 019/startup schema before API/frontend. Existing history stays
unchanged; old public score proxy returns 409 after the new flow is available.
Rollback retains schema, receipts, handlers and legacy-write rejection; never
delete drafts to restore older UI. No production deployment in this task.

Verify memory/PostgreSQL migration replay, exact create/save/submit retry, owner
isolation, conflicting drafts, concurrent lease claims, stale generation, provider
failure/malformed/zero, immutable revision/history and no rewards. Browser tests
cover response loss/reload, storage errors, account changes and 390×551/844 layouts.
Acceptance evidence belongs in SYSTEM-VALIDATION; this ADR is not test evidence.
