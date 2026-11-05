# ADR 023 — Recover different Fair results from the same run

Date: 2026-11-05. Roadmap: CORE-006. Status: implemented, new-head CI pending.

## Problem

Two tabs can resume the same checkpoint/run ID and finish with different stars,
elapsed time or feathers. The first committed result correctly wins. A different
copy left in the owner's offline queue then receives 409 forever, while the UI
previously suggested only reconnecting and retrying. A 409 can also mean a locked
course, so an aggregate scrapbook or error status cannot prove this exact run
has been saved.

## Contract

Add account-only `GET /v1/fair/completions/{runId}`. It reads the existing immutable
ledger under owner + UUID and returns `{method:"fair-keepsake.v1",playerId,
completion,save}`. The completion is the exact stored payload, including legacy
empty difficulty. Save is the current aggregate and can include later runs.
Invalid IDs return 400; missing/foreign receipts 404; guest/invalid auth 401;
server failures return a generic 500. There is no schema, scoring, reward,
generator or checkpoint change and no new write endpoint.

After a queued POST receives 409, the browser reads the owned receipt with the
captured token. It validates owner/run/method/payload and the matching aggregate.
A valid receipt allows review of the saved result beside the queued copy.
Locked/missing receipts, old API 404, invalid shape, expired auth or network failure
keep the original queue pending without offering an unsupported resolution.
Other valid queued runs can still sync past a conflicting entry.

The explicit “Keep local copy and use saved result” action reads the receipt
again, verifies the same immutable result and unchanged local copy, then caches
the canonical save and records an owner-scoped local archive. It does not POST
another completion, assign a new run ID, modify the first result, or add visits,
XP, coins, rank or learning evidence.

## Non-destructive local resolution

Existing queue/save/checkpoint namespaces and versions remain unchanged. An
additive key `loccao.fair.v2.<owner>.resolved.<runId>` stores version 1,
method `fair-conflict-archive.v1`, the exact original queued JSON bytes, parsed
queued/saved results and archive time. The original `run.<runId>` key is never
deleted or overwritten by resolution. Only a byte-for-byte matching archived
copy is excluded from pending uploads/provisional course projection. A different
or changed queued copy becomes pending again; the archive cannot silently cover
it. Storage failure preserves the original queue and does not claim resolution.

Keeping the run key also avoids an unsafe cross-tab compare-then-delete operation
on localStorage, which has no atomic compare-and-swap. An existing incompatible
archive is kept and reported; it is never overwritten to make recovery succeed.
Archives are visible under “Kept local copies”, with a JSON download containing
the original bytes and both results. They stay in this browser for this account,
with the same device lifetime as existing offline memories; no extra server
retention, telemetry or automatic guest import is introduced.

Owner/token/generation checks discard late reads after logout/account change.
Resolution is serialized with queue sync. Another tab's archive updates the
visible review without deleting either copy. Corrupt/unknown archives are kept
and reported rather than cleared. A direct alternate result that never entered
the queue continues to show the existing explicit unsaved-result UI; this slice
does not turn it into a new server completion.

## Rollout and verification

API receipt reads before frontend recovery. Older frontends ignore the new
archive namespace and may retry the intact duplicate; server idempotency/409
still protects the ledger. Updated clients can reopen their archive and stop
that exact duplicate again. Keep receipt reads and existing ledger on rollback;
never reset queues/database or reopen reward ingress.

Memory/PostgreSQL tests cover immutable receipts, owner isolation, legacy
difficulty, later aggregate updates, restart, malformed IDs and unchanged XP.
Browser tests isolate outputs of the two-tab/offline handoff using labelled
queued fixtures plus real registration/completion APIs, then exercise actual
reconciliation, cross-tab/account changes, storage failure, reload and phone
controls. Existing 3D full-clear/checkpoint tests remain independent. All runtime
checks run on GitHub Actions; no local app/build/tests/services or production
deployment are performed.
