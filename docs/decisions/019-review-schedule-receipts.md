# ADR 019: Idempotent authenticated review scheduling receipts

Status: Accepted
Date: 2026-11-05
Roadmap: CORE-006

## Context

The legacy review endpoint accepted only a quality value. A lost response could
leave the client unsure whether the spaced-repetition item was updated, while a
retry could apply the SRS transition twice. The legacy queue also remains
available for anonymous demo reads, so review writes need a separate ownership
contract.

## Decision

Add authenticated `POST /v1/review/{itemKey}/grades` with
`{requestId, quality, rulesVersion}` and the fixed `review-schedule.v1` rules
version. `requestId` is required and at most 120 runes; quality is an integer
from 0 through 5. The response is an immutable, owner-scoped receipt:

```json
{
  "requestId": "review-123",
  "itemKey": "word-link:happy",
  "quality": 4,
  "rulesVersion": "review-schedule.v1",
  "expectedDueAt": "2026-11-05T00:00:00Z",
  "scheduledAt": "2026-11-05T00:00:00Z",
  "dueAt": "2026-11-08T00:00:00Z",
  "intervalDays": 3,
  "ease": 2.58,
  "failures": 0
}
```

The exact same owner/request/item/quality returns the stored receipt without a
second SRS transition. The request must also carry the queue item's
`expectedDueAt`; a stale tab or lost local request receives `409` without a
transition, while a fresh due snapshot may schedule again. Reusing a request ID for another item or quality is a
`409`; the old quality-only request is also a `409` safe-upgrade response, and
unknown rules versions are rejected with `409`. Unknown or foreign items are
`404` and do not create receipts. `GET /v1/review/grades/{requestId}` recovers
only the signed-in owner's receipt; foreign and missing receipts are `404`.

The memory store serializes the receipt and review update under its existing
store lock. PostgreSQL performs the same update and receipt insert in one
transaction, locking the review row and rechecking the receipt after lock
waits. The additive receipt table has an owner `ON DELETE CASCADE` foreign key
only, so receipts remain recoverable if a queue item is removed. No XP,
confidence, mastery, or answer data is written by this contract.

The existing `GET /v1/review` demo-compatible queue remains unchanged. The API
also accepts `GET /v1/review?dueOnly=true` for the authenticated due-only
projection; that response carries `dueOnly: true` and the
`review-schedule.v1` marker. The legacy `POST /v1/review/{itemKey}` path is
reserved and returns `409` so an older client cannot silently perform a
non-idempotent grade. The API ships before the web client; rollback keeps v1
receipt reads and scheduling available, while clients must continue using
request IDs for writes.

## Consequences

Review scheduling can be safely retried after a timeout and the UI can recover
pending grades after account changes. The receipt table adds a small durable
record per authenticated grade. The legacy quality-only client must upgrade
before writing again.

This is the first unreleased receipt schema: migration 023 and startup DDL both
create `expected_due_at` with the original table. No precondition is fabricated
from a result's later due date, and existing review rows are not rewritten.
