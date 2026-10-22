# ADR 011 — Stable daily practice plans and dated completion evidence

Status: Accepted design; CORE-006/005 slice acceptance remains in ROADMAP.
Date: 2026-10-21. Decider/implementer: Codex under the approved core roadmap.

## Context

The daily chest currently rebuilds an adaptive plan after every answer. Memory
mode infers today's practice from lifetime confidence changes; PostgreSQL counts
legacy attempt rows. These sources disagree, can credit earlier practice and can
move the checklist while the learner completes it. Goal tasks can also lead to
ungraded activities whose completions never reach the evidence store.

## Decision

- Account-only daily plans use `daily-plan.v1`, dated in UTC+7. On first access,
  save three distinct, reachable checked-practice activities chosen from the
  existing routes using goal/weak-skill preferences. The server owns this plan;
  profile, confidence and catalog changes do not replace it during that day.
  Goal/level selection is a practice preference, not proof of mastery.
- Count actual, supported shared attempts completed within that day, with exact
  activity matching. Valid wrong answers and fresh replay rounds count as effort;
  correctness/daily learning-XP rules remain independent. An identical completed
  retry retains its original completion time and never becomes a new day's work.
  No confidence inference, legacy attempt accuracy, open lesson, provider estimate,
  self-rating or client-reported completion counts. The chest is personal XP and
  remains excluded from the checked practice board.
- Persist the owned plan and an immutable claim receipt (plan version, date,
  reward, original quest activities and supporting attempt IDs). Claim validation,
  one owner/day ledger entry and the fixed 50 XP update are atomic. Callers cannot
  choose the reward. Concurrent/repeated claims return the existing receipt.
- Claim requests name the displayed date and rules. After a day change, unclaimed
  older requests reject safely; committed older claims remain readable/retryable.
  Existing claimed days/XP/streak survive and are explicitly legacy if they have
  no receipt. Never invent supporting attempts or re-award legacy claims.
- Memory has store-owned plans/claims and completion timestamps, matching SQL
  behavior within its documented temporary lifetime. Independent memory stores
  must not share a process-global daily ledger. PostgreSQL survives restart.
- Browser requests are owner-scoped, ignore late responses after auth changes,
  expose refresh/retry and restore a committed chest through GET after a lost
  response. Guests see a sign-in invitation, never write shared demo progress.

## Options and consequences

Confidence-based inference is cheap but cannot date a completion. Reusing the
changing recommendation list is simple but moves the goalposts. The selected
receipt/day snapshot adds one small schema while keeping activity graders,
learning rewards and existing personal progress intact. Daily checkmarks mean
completed guided practice, not correct mastery or competitive performance.

## Rollout and verification

Additive migration 021/startup schema retains existing daily claims and learning
timestamps. API/schema first, then frontend. Rollback must retain dated evidence,
saved-plan readers, receipt/version guards and claim ledger; never reset user
data or reopen confidence/legacy-based claims. No production deployment.

Verify memory/PostgreSQL day bounds, actual-vs-created time, wrong/replay/legacy
evidence, exact retry across a day boundary, stable plan after profile/skill
changes, ownership, concurrent claims, restart, legacy receipts, stale rules and
missing plan. Browser tests use actual practice, lost claim response, refresh,
account change and 390×551/844 renders. No playtest/calibration claim from fixtures.
