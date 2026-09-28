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
- Word Link and Grammar Repair reject generic client-accuracy submissions.
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
