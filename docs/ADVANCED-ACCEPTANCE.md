# Advanced functions: acceptance and limits

Date: 2026-11-05. Scope: repository implementation and GitHub-only verification.
Accepted source: `82871ea`, [PR 51](https://github.com/Loccao102/LocCaoEnglish/pull/51),
merged as main `59cf031e4c28a6809c5eb159106c7d5929df4d75` after all six gates.
This record does not claim the whole project is complete. ROADMAP remains the task-status
source, SYSTEM-VALIDATION retains revision-specific evidence, and PROJECT-RULES
remains the only project-rule source.

## Active software surfaces

| Function | Active implementation and contract | Acceptance boundary |
| --- | --- | --- |
| Account sign-in and role | [AuthPanel](../components/AuthPanel.tsx), [ADR 021](decisions/021-auth-intent-fencing.md), [ADR 022](decisions/022-explicit-account-roles.md) | Late requests cannot replace a new account/guest intent. New accounts are learner; privileged roles require an operator-confirmed account ID. Existing role rows are preserved and need operator review before production. |
| Checked learning | [Shared round hook](../components/learning/useVerifiedLearningRound.ts), [ADR 003](decisions/003-learning-recovery.md) | Server-owned versioned attempts, original answers, owner/retry/replay boundaries; nine objective activities plus separate guided transcript practice. |
| Reward/rank | [Boundary audit](REWARD-BOUNDARY-AUDIT.md), [ADR 010](decisions/010-checked-practice-ranking.md) | Retired client-score ingress, atomic claims, checked rank from eligible receipts; Fair/story/personal/legacy/provider evidence stays separate. |
| Conversation and campaign | [TravelMission](../components/TravelMission.tsx), [ADR 005](decisions/005-mission-evidence.md), [ADR 012](decisions/012-campaign-practice-gates.md) | Ordered versioned guided rubric, preparation/first-clear receipts, actual messages and old v2 recovery. It is not general semantic understanding or certified mastery. |
| Writing | [Writing recovery](../components/learning/useWritingSession.ts), [ADR 008](decisions/008-writing-receipts.md) | Saved owner drafts, immutable revisions, lease/generation-bound provider results, honest provider failures and lost-response recovery. |
| Speaking/acoustic | [Speaking assessment](../components/learning/SpeakingAssessment.tsx), [ADR 009](decisions/009-acoustic-receipts.md) | Transcript matching and acoustic feedback are distinct. Saved sample hashes/results do not retain raw audio or grant pronunciation XP/band. Physical microphone/provider quality is unverified. |
| IELTS Reading/Listening | [ADR 006](decisions/006-ielts-reading-evidence.md), [ADR 007](decisions/007-ielts-listening-evidence.md) | Original choices, server grading/versioned history and playback journal. Practice estimates remain distinct from official/calibrated bands; the camp does not infer an overall from legacy data. |
| Daily and profile | [ADR 011](decisions/011-daily-practice-recovery.md), [ADR 015](decisions/015-profile-owner-recovery.md) | Stable dated plan, actual completion effort, one chest receipt; account-owned settings/drafts and uncertain-save readback. |
| Courses | [CourseDetail](../components/CourseDetail.tsx), [Course projection](../backend/internal/store/course_catalog.go), [ADR 018](decisions/018-course-owner-recovery.md) | Public catalog, separate account enrollment/progress; hidden bookmarks preserved, only published lessons counted, empty catalog explicit. Single-snapshot reads do not change owner or rewards. |
| Review | [Review recovery](../components/learning/useReviewSession.ts), [ADR 019](decisions/019-review-schedule-receipts.md) | Owner-scoped scheduling operation/receipt, exact retry and expected-due conflict; self-ratings schedule repetition only. |
| Teacher/content tools | [ADR 017](decisions/017-teacher-practice-analytics.md), [ADR 020](decisions/020-content-studio-owner-fence.md) | Stored teacher/admin access, current-token editor/report, no late account leakage; checked guided/transcript activity is not seeded confidence or mastery. |
| Fair and advanced Bridge | [FestivalSession](../lib/game/festival-session.ts), [ADR 023](decisions/023-fair-conflict-recovery.md), [ADR 024](decisions/024-bridge-topology-versions.md) | Session-owned rules, genuine old-version resume, new seeded topology, immutable first result and non-destructive conflicting-copy recovery; personal keepsakes only. |
| Performance | [Measured scopes](PERFORMANCE.md) | Constant-query catalogs, bounded per-worker AI connection pool, skipped unchanged label layout; measurements do not establish whole-app production capacity. |

Compatibility exports and inactive client-score helpers are not independent
trusted result paths. The audit follows actual imports/routes and their current
server gates rather than taking dead code as evidence of active behavior.

## CORE-006 cross-system recovery coverage

This index covers the existing recovery criteria rather than requiring every
possible combination of every route. CORE-006 is accepted in its software/contract
scope after CI 229; PostgreSQL evidence is distinct from temporary memory mode.

| Boundary | Implementation/checks in the accepted parent and candidate | Expected behavior |
| --- | --- | --- |
| Lost response and reload | [Shared round recovery](../tests/e2e/learning-recovery.spec.ts), [pending input](../tests/e2e/learning-recovery-ui.spec.ts), [Writing](../tests/e2e/writing.spec.ts), [Review](../tests/e2e/review-recovery.spec.ts) | Read committed results or retry the exact pending ID/payload; do not issue another reward-bearing attempt to recover a response. |
| Leaving a page/tab | [Shared lifecycle](../components/learning/useVerifiedLearningRound.ts), [Writing lifecycle](../components/learning/useWritingSession.ts), [Fair lifecycle](../components/game/FestivalGame.tsx), [audio cleanup](../components/learning/useListeningPlayback.ts) | Invalidate old response generations on unmount and stop playback; Fair saves on page exit and pauses on blur/hidden. |
| Account/guest change | [Learning](../tests/e2e/learning-recovery.spec.ts), [auth intent](../tests/e2e/auth-intent.spec.ts), [profile](../tests/e2e/profile-owner.spec.ts), [course](../tests/e2e/course-owner.spec.ts), [Fair conflict](../tests/e2e/fair-conflict.spec.ts) | Captured-owner results/drafts/queues cannot be applied using the next account's token; guest state is separate. |
| Offline, failed auth and expiry | [Recovery UI](../tests/e2e/learning-recovery-ui.spec.ts), [store expiry/retry](../backend/internal/store/learning_recovery_test.go), [daily](../tests/e2e/daily-practice.spec.ts), [Review](../tests/e2e/review-recovery.spec.ts) | Preserve pending input on network failure, reject expired active attempts, recover completed receipts and offer an explicit next action. |
| PostgreSQL reopening | [Learning](../backend/internal/store/learning_recovery_test.go), [story](../backend/internal/store/story_attempt_test.go), [Review](../backend/internal/store/review_schedule_test.go), [Fair receipt](../backend/internal/store/fair_receipt_test.go) | A new store/connection reads the same saved snapshot/receipt; memory mode is not durable storage. This does not claim a live deployment restart was performed. |
| Rules/content upgrade | [Learning store](../backend/internal/store/learning_attempt.go), [HTTP version checks](../backend/internal/httpapi/learning_attempt.go), [story old content](../backend/internal/store/story_attempt_test.go), [Bridge v1/v2](../tests/e2e/bridge-topology.spec.ts) | Retain the saved version or refuse safely; never silently grade an old attempt under new rules. Genuine Bridge v1 fixtures remain playable. |
| Corrupt/unsupported recovery across active surfaces | [IELTS recovery](../tests/e2e/ielts-reading.spec.ts), [Review recovery](../tests/e2e/review-recovery.spec.ts), [profile recovery](../tests/e2e/profile-owner.spec.ts), [Bridge copy](../tests/e2e/bridge-topology.spec.ts), [Fair archive](../tests/e2e/fair-conflict.spec.ts) | Keep raw data/pending identity for explicit recovery or download; unavailable storage does not become a false save confirmation. |
| Reward replay | [Atomic learning retries](../backend/internal/store/learning_recovery_test.go), [dated daily claims](../backend/internal/store/daily_practice_test.go), [reward boundary audit](REWARD-BOUNDARY-AUDIT.md), [Fair no-XP assertion](../tests/e2e/fair-conflict.spec.ts) | Retry/concurrency has one immutable result/claim; Fair keepsakes and review scheduling do not grant learning rank/XP. |
| Cloud Hop atlas scope | [Current contract](GAMEPLAY-FOUNDATION.md), [course source](../lib/game/fair-courses.ts), [browser checks](../tests/e2e/fair-courses.spec.ts) | Course badges/times remain shared between difficulty modes. Separate atlas records would be a future versioned migration, not an implicit change here. |

## Accepted evidence

- Accepted main `ff7ef88` / PR 49 source `94998a8`: all six CI jobs, 256 browser
  cases (40.7m), PostgreSQL/race/vet, actual API integration and inspected Fair
  recovery images. This does not accept later runtime changes automatically.
- Source `82871ea`, [CI 229](https://github.com/Loccao102/LocCaoEnglish/actions/runs/42002431910):
  all six jobs passed, including backend/PostgreSQL/race/vet, frontend/build/assets,
  AI, Compose, integration and 263 browser cases (46.1m). Focused
  [run 14](https://github.com/Loccao102/LocCaoEnglish/actions/runs/42002431903)
  passed 38 cases (2.0m), without a
  flaky/retry acceptance. All four final Bridge phone images were inspected
  and show the 3D board, bank labels, objective and reachable controls.
- Both 250ms Adventure/Challenge stationary label samples recorded zero repeated
  attribute writes. Independent resize/selection/live-timer/moving-box checks
  passed. This is DOM-work evidence, not an FPS/GPU/battery benchmark.
- CI 229 measured course list 49→1 database calls and 23.791→0.858ms per operation
  on 24 published courses. Lesson list measured 80→2 calls and 27.459→1.127ms on
  26 published lessons. Both paths used the same isolated test fixture/counter;
  see PERFORMANCE for allocation costs and timing limits.
- A separate source review found no concrete owner/version/recovery/reward,
  catalog or label-memo blocker. Agent review is not independent human approval.
- Fresh PR head/reviews/threads were unchanged/empty. The combined main tree
  matched the tested source tree `ae9fb4fe5a9b413dac254fa36fd12c62663f59f6`.
  An ordinary expected-head merge preserved PR 50/51 ancestry; no bypass or
  force push was used. Source CI has no failed/flaky summary or retry execution.

All execution is in disposable GitHub CI stacks/test databases. No local app,
tests, build, benchmark, services, physical microphone or user save/queue/database
reset was used. No production deployment was authorized or performed.

## Remaining external evidence

- CORE-004: real-provider/acoustic/Writing quality and calibration have not been
  measured. Guided heuristic/transcript results and IELTS practice estimates do
  not become certified language ability from passing software tests. Any future
  broader semantic rubric needs its own versioned scope and validation.
- CORE-007: the [playtest protocol](PLAYTEST-PROTOCOL.md) is prepared, but no real
  participants, observed results or data-based parameter tuning are recorded.
  Solvable generated puzzles do not establish human difficulty/replay quality.
- DEP-001: production/staging target, live migration/version/rollback verification
  remain separate. GitHub-only work does not imply deployment.
- CONTENT-001 remains planned behind core/playtest readiness. No new character,
  map or game is added merely to increase counts.

These limits must stay visible at handoff. They are not solved by another build,
synthetic volunteers, fabricated provider scores or deleting saved data.
