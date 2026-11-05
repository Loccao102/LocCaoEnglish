# Reward and rank boundary audit

Audit date: 2026-11-05  
Scope: CORE-005 active HTTP routes and persistence on `dd0f05f`.  
Baseline acceptance: merged main `c601292` from [PR 35](https://github.com/Loccao102/LocCaoEnglish/pull/35), source `651c946`, [CI 201 run 41970949503](https://github.com/Loccao102/LocCaoEnglish/actions/runs/41970949503).

This audit is a software-boundary review. It does not claim production deployment,
anti-cheat competition, or human calibration of learning/rank quality.

## Conclusion

The active software boundary meets the CORE-005 security slice: a browser cannot
submit an arbitrary accuracy or score and receive trusted learning XP or checked
practice rank. Learning XP is produced by server-owned attempts and an atomic
daily ledger; the public board derives its totals from eligible receipts rather
than from lifetime `users.xp`. Fair, story/adventure, mission, lesson, placement,
IELTS estimates, and provider feedback remain separate evidence/reward domains.

Adventure provenance is included in the accepted main baseline, not pending
unmerged code. This audit closes the active software-boundary criteria of
CORE-005 in [ROADMAP](ROADMAP.md#core-005--reward-và-competitive-integrity).
Calibration, independent competitive verification and production rollout remain
outside that acceptance; the other roadmap items retain their own criteria.

## Active route and store rules

| Surface | Allow rule | Reject/exclusion rule | Evidence |
| --- | --- | --- | --- |
| Legacy `/v1/attempts` | None | Authenticated score writes return `409`; invalid auth is rejected, no client accuracy is written | [`legacy_attempt.go`](../backend/internal/httpapi/legacy_attempt.go#L5-L11), [`reward_boundary_test.go`](../backend/internal/httpapi/reward_boundary_test.go#L17-L73) |
| Learning attempts | Server creates the attempt snapshot, selects supported catalog content/rules, and grades the submitted answer | Client `score`/`accuracy` is not a verdict; foreign owner, invalid answer format, or mismatched versions is rejected; valid wrong answers receive a wrong verdict | [`learning_attempt.go`](../backend/internal/httpapi/learning_attempt.go#L22-L265), [`learning_attempt.go`](../backend/internal/store/learning_attempt.go#L155-L263), [`learning_recovery_test.go`](../backend/internal/httpapi/learning_recovery_test.go#L17-L84) |
| Learning XP ledger | A correct, server-graded attempt may claim its fixed reward once | Retry returns the recorded result; duplicate/concurrent claims do not add XP twice | [`learning_attempt.go`](../backend/internal/store/learning_attempt.go#L185-L260), [`learning_attempt_test.go`](../backend/internal/store/learning_attempt_test.go#L9-L32) |
| Checked leaderboard | Completed, correct, progression-applied attempt; exact supported activity/rules and content version; matching `learning_daily_rewards` receipt | Legacy attempts, `users.xp`, wrong/unapplied attempts, Fair, story/mission, lesson/placement, and provider estimates are excluded | [`social.go`](../backend/internal/store/social.go#L11-L51), [`leaderboard_window_test.go`](../backend/internal/store/leaderboard_window_test.go#L11-L77), [`reward_boundary.go`](../backend/internal/httpapi/reward_boundary.go#L43-L58) |
| Daily chest | Server-owned dated plan plus actual supported completed attempts; fixed reward and one claim receipt | Caller cannot choose reward; wrong/replay effort can complete the daily plan but does not create checked XP; duplicate claims are idempotent | [`daily.go`](../backend/internal/store/daily.go#L118-L175), [`daily.go`](../backend/internal/store/daily.go#L256-L328), [`daily_practice_test.go`](../backend/internal/httpapi/daily_practice_test.go#L21-L154) |
| Lesson and placement | Self-reported bookmark/progress may be saved for continuity | Client score is advisory only; no learning XP, mastery, or rank | [`reward_boundary.go`](../backend/internal/httpapi/reward_boundary.go#L11-L41), [`reward_boundary_test.go`](../backend/internal/httpapi/reward_boundary_test.go#L55-L71) |
| Duel/challenge submit | Practice invitations may remain visible | Public client-reported duel score always returns `409`; no competitive result is inferred | [`reward_boundary.go`](../backend/internal/httpapi/reward_boundary.go#L60-L66), [`reward_boundary_test.go`](../backend/internal/httpapi/reward_boundary_test.go#L46-L53) |
| Fair | Fair session/save contract remains independent | Fair keepsakes do not update learning XP or checked rank | [`fair.go`](../backend/internal/store/fair.go#L53-L124), [`fair_test.go`](../backend/internal/store/fair_test.go#L16-L100) |
| Adventure/story | Server catalog answer comparison and first-clear transaction | Story reward is separate from learning evidence and checked practice rank; retry does not repeat reward | [`adventure.go`](../backend/internal/adventure/adventure.go#L138-L178), [`adventure.go`](../backend/internal/store/adventure.go#L45-L125), [`adventure_test.go`](../backend/internal/store/adventure_test.go#L10-L51) |
| Campaign missions | Server conversation/evaluation receipt and owner-scoped first-clear transaction | Mission chest/reward is not a checked learning receipt | [`mission_evidence.go`](../backend/internal/store/mission_evidence.go#L70-L227), [`mission_evidence_test.go`](../backend/internal/store/mission_evidence_test.go#L19-L196) |
| Campaign preparation | Correct shared receipts under the declared activity/rules, after the prior chapter; preserve old earned clears | Seeded/legacy confidence cannot satisfy new practice evidence; no invented backfill of preparation | [`campaign_preparation.go`](../backend/internal/store/campaign_preparation.go), [`campaign_preparation_test.go`](../backend/internal/store/campaign_preparation_test.go) |
| Vocabulary unlocks/loadout | Immutable grants identify checked-practice, personal-XP or preserved legacy source; equipment is account owned | Neither personal XP nor grandfathered access is certified mastery; cutover freezes positive and negative decisions instead of granting new seeded accounts | [`vocabulary_unlock.go`](../backend/internal/store/vocabulary_unlock.go), [`vocabulary_unlock_migration_test.go`](../backend/internal/store/vocabulary_unlock_migration_test.go) |
| Review/course/profile | Review ratings schedule repetition; enrollment/bookmarks/settings keep continuity | No XP/rank award from a self-rating, enrollment, bookmark or selected level/target | [`review_schedule.go`](../backend/internal/store/review_schedule.go), [`course.go`](../backend/internal/store/course.go), [`player_profile.go`](../backend/internal/httpapi/player_profile.go) |
| IELTS/AI/acoustic | Provider or server evidence is returned/stored under its own contract | Client IELTS overall helper and provider estimates do not award XP/rank; retired objective-score routes reject client-only evidence | [`ielts.go`](../backend/internal/httpapi/ielts.go#L6-L56), [`ielts_reading_test.go`](../backend/internal/httpapi/ielts_reading_test.go#L19-L245) |

## Existing verification evidence

The relevant regression and persistence tests are already present in the merged
software baseline:

- [`TestAllClientScoreAliasesRetired`](../backend/internal/httpapi/reward_boundary_test.go#L17-L73)
  covers arbitrary legacy activity names, lesson/placement payloads, duel score
  submission, unauthorized writes, leaderboard provenance, and no XP/skill/review
  mutation.
- [`TestVerifiedLearningRecoveryHTTP`](../backend/internal/httpapi/learning_recovery_test.go#L17-L84)
  covers server grading, rejection of a client score field, retry behavior, and
  exactly one learning XP award.
- [`TestLearningAttemptServerGradesAndIsIdempotent`](../backend/internal/store/learning_attempt_test.go#L9-L32)
  and the learning activity HTTP suites cover server verdicts, wrong-answer review
  evidence, owner/version checks, and replay idempotency.
- [`TestDailyHTTPFrozenPlanAndAtomicClaim`](../backend/internal/httpapi/daily_practice_test.go#L21-L154)
  and [`TestDailyPracticeMemoryAndPostgres`](../backend/internal/store/daily_practice_test.go#L18-L313)
  cover fixed rewards, actual dated evidence, stale/foreign evidence, concurrent
  claims, restart/readback, and exclusion of wrong-answer bonus from checked rank.
- [`TestCheckedLeaderboardWindowDoesNotEraseOwnerReceipt`](../backend/internal/store/leaderboard_window_test.go#L11-L77)
  covers derived checked totals, deterministic ties, finite public windows, and
  preservation of the owner receipt/personal XP outside the window.
- [Campaign preparation regressions](../backend/internal/store/campaign_preparation_test.go)
  cover owner/version/order and preserved old clears without fabricated evidence.
  [Vocabulary migration regressions](../backend/internal/store/vocabulary_unlock_migration_test.go)
  cover frozen positive/negative cutover decisions, concurrent initializers,
  transaction rollback and standalone migration replay.
- [`TestFairPersistenceAndIdempotency`](../backend/internal/store/fair_test.go#L16-L100),
  [`TestAdventureConcurrentRewardsAndIsolation`](../backend/internal/store/adventure_test.go#L10-L51),
  and the PostgreSQL Adventure tests cover separate-domain persistence and no
  duplicate first-clear rewards.
- [`TestSEC002PublicRegistrationCannotSelfElevateRole`](../backend/internal/httpapi/roles_test.go#L19-L104)
  and [`TestSEC002RolesUsePersistedAssignmentsOnly`](../backend/internal/store/roles_test.go#L13-L193)
  belong to the separate SEC-002 role-boundary hardening and are not evidence that
  CORE-005 is complete.

CI evidence anchored to the accepted main baseline:

- PR 35 / `c601292` merged the slice from `651c946`; CI 201 run
  [41970949503](https://github.com/Loccao102/LocCaoEnglish/actions/runs/41970949503)
  passed all six jobs, including 242 E2E tests in 44.3 minutes. The run included
  actual Adventure answers (`e91b0b6`), PostgreSQL verification of all 42 original
  quest answers after partial clears/improved replays, and learning E2E coverage.
- Earlier supporting PRs were also green: [PR 32](https://github.com/Loccao102/LocCaoEnglish/pull/32)
  (teacher fixture, CI 187), [PR 33](https://github.com/Loccao102/LocCaoEnglish/pull/33)
  (CI 188, 210 E2E), [PR 36](https://github.com/Loccao102/LocCaoEnglish/pull/36)
  (CI 193, 232 E2E), and [PR 37](https://github.com/Loccao102/LocCaoEnglish/pull/37)
  (CI 200, 242 E2E in 45.5 minutes).

## Explicit limits and cleanup debt

1. The accepted reward code is already merged through PR 35; this documentation
   reconciles stale slice statuses instead of treating an unmerged change as done.
2. `backend/internal/realtime.Service.Submit` still contains an internal method
   that accepts an arbitrary score, and `lib/api.ts` retains dead
   `recordAttempt`/`submitChallenge` helpers. No active production route/import was
   found for these paths, and they are not trusted API evidence. They remain cleanup
   debt and must not be exposed again without a server-owned competitive session.
3. `/v1/ielts/overall` accepts values to calculate a non-persistent helper result;
   it is explicitly not a reward, rank, or certified IELTS result.
4. No production deployment, real-player calibration, branch-protection policy, or
   whole-project completion is claimed.
5. SEC-002 explicit role assignment is separate pending PR 45. Before deployment,
   the operator role workflow and existing privileged accounts require review; this
   audit does not treat configured email lists as an authorization mechanism.

No local tests, build, application, or services were run for this document. The
verification claims above refer to the cited source tests and recorded GitHub CI
runs only.
