# ADR 010 — Retire client scores and rank checked practice receipts

Status: Accepted design; CORE-005 slice acceptance remains in ROADMAP.
Date: 2026-10-21. Decider/implementer: Codex under the approved core roadmap.

## Context

The legacy accuracy endpoint rejects migrated activity names but accepts arbitrary
other names, including lesson/placement clients. Renaming an activity can still
award XP/confidence and insert arbitrary review content. The social board ranks
the mixed lifetime user XP counter, and legacy duels accept arbitrary client
scores even though Word Link no longer submits them. Neither is verified competition.

## Decision

- Retire all public `/v1/attempts` writes with 409. Activity-name blacklists cannot
  make a client-supplied accuracy trustworthy. Keep old history/personal XP and
  skill state intact; never retroactively label that data verified or reset it.
- Lesson and placement local practice stop submitting accuracy/target answers as
  learning evidence. Local checks are explicitly advisory. Open-ended lesson
  responses have no automatic correctness verdict. Completion bookmarks remain
  self-reported with no XP/mastery/rank; they are not proof of language ability.
- Social XP is derived from completed, correct, progression-applied shared
  learning attempts with the matching daily claim and exact supported activity/
  rules pair. Each eligible receipt contributes its recorded 20 XP once. Do not
  derive checked XP from `users.xp`, legacy `attempts`, fair, story/mission chests,
  self-reported lessons/placement, coach/IELTS estimates or acoustic feedback.
  Existing receipts already have immutable state and the atomic claim ledger;
  derive the view rather than introduce a second mutable total or backfill.
- Expose the board method and limitations. This is checked guided practice,
  not an unaided skill ranking, CEFR certification or anti-cheat competition.
  Accounts without eligible receipts do not receive a rank. Personal lifetime XP
  remains available separately for existing progress/unlocks.
- Retire public arbitrary duel-score submission with 409. Keep old entries as
  explicitly unverified archive and allow practice invitations. Joining opens
  normal practice; no winner or competitive result is inferred from that run.
  A future competitive mode needs an owned server session and atomic result store.

## Options and consequences

An expanded blacklist still permits renaming bypasses. Resetting all legacy XP
would destroy player progress without recovering missing evidence. A new reward
counter/ledger duplicates shared attempt claims. The chosen derived board closes
new untrusted writes and keeps receipt provenance while preserving legacy data.
Older clients receive explicit migration errors rather than silently earning XP.

Existing mixed skill confidence and campaign prerequisites need a separately
versioned evidence policy; this slice does not reclassify legacy mastery or
certify prior mission unlocks. Review self-ratings schedule repetition only.

## Rollout, rollback and verification

No SQL migration or destructive backfill. Deploy API retirement and derived board
before web labels/clients. Rollback retains score rejections and checked receipt
filtering; do not reopen arbitrary score endpoints or erase player history.
Verify memory/PostgreSQL parity, legacy XP preserved/excluded, valid/wrong/replay
and daily-claim receipts, unsupported rule versions, owner/auth and concurrent
retry. Browser exercises lesson, placement and social labels plus actual checked
practice contributing once. Existing objective and mission behavior must remain.
No production deployment or real-player calibration is implied.
