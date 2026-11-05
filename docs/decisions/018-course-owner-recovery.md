# ADR 018 — Course progress and enrollment ownership

Status: Accepted, 2026-11-05. Scope: CORE-006.

## Problem

`/courses/[slug]` loads public catalog and personal progress together once. It
keeps account A's enrollment/completions after authentication changes, reads the
shared demo for a guest, and sends enrollment with whichever token is present
later. A personal-read failure also hides the public lesson list.

## Decision

- Keep catalog public and independently recoverable. The personal section is
  keyed by course and current identity, using the shared captured-token resource.
  Guest views do not request personal progress or offer enrollment.
- Capture the owner for both GET progress and POST enrollment. Logout/account
  changes remove previous state immediately; older reads and mutation results
  cannot update the new account's section. Unmounts also invalidate pending UI.
- POST enrollment requires a signed-in account, even with anonymous demo mode.
  GET progress keeps its legacy demo compatibility. Existing owner/course primary
  key upsert remains idempotent; no reward, XP or lesson result is introduced.
- During a write, disable duplicate actions. A lost reply stays unconfirmed;
  explicitly refresh progress or retry the same owner/course enrollment. The
  read may confirm enrollment without another write. Expired identity offers
  sign-in; network failure keeps the catalog and a recovery control.
- Course completion remains a personal lesson report, not checked mastery or an
  independent score. Do not display missing progress as a fabricated zero percent.

## Current published catalog projection

The 2026-11-05 follow-up fixes a read inconsistency: PostgreSQL counted hidden
lesson bookmarks against a published-only denominator, while memory mode kept
seeded course metadata after lesson edits. Both modes now project membership
through current published lessons and refresh their metadata. PostgreSQL counts
the numerator/denominator in one statement; memory uses one catalog/progress
read lock. Publishing cannot produce a mixed count above 100% within a progress
response. This fixes the counts rather than clamping an inconsistent percentage.

Unpublishing neither deletes nor rewrites bookmarks. Republish restores those
personal completions. The legacy averageScore field remains self-reported and
limited to visible started bookmarks, including partial ones as in the existing
PostgreSQL contract; memory now matches it. It is still not shown as checked
mastery or used for XP/rank. Empty courses return lessons as an empty array;
the browser also accepts the old API's null empty list, while invalid/missing
catalog shapes remain errors. No payload/schema/save version changes or backfill.
The API read fix can deploy independently; rollback preserves all stored rows.

## Rollout and compatibility

No migration/save format change. Ship the signed-in API boundary before the
updated browser. Old anonymous clients receive 401 on enrollment; their saves,
demo enrollment and account rows are retained. A browser rollback cannot undo
the API boundary. API rollback may restore anonymous writes, so retain the new
boundary when rolling back unrelated changes. Never migrate guest progress into
an account or erase enrollment rows to recover.

## Validation

HTTP guest/learner-owner/retry/no-XP checks, real account browser enrollment and
reload, guest/demo exclusion, late read/error/write on account switches, lost
response read-back, unavailable/expired recovery and phone captures. User asks
for GitHub-only validation: no local app/build/test execution. CI and visual
inspection must pass before this slice is accepted.
