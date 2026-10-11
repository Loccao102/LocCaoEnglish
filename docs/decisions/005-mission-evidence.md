# ADR 005 — Ordered role-play and first-clear evidence

Date: 2026-10-11. Scope: CORE-004, nine `/missions/*` routes.

## Problem

The active `TravelMission` sent arbitrary client accuracy `.85` for every chat
turn. Completion joined all messages and looked for substrings; the PostgreSQL
store also required three unrelated legacy NPC attempt rows, while memory did
not. Neither stored the dialogue used to earn the chapter reward. A failed AI
reply could interrupt the evidence path. The unimported `AirportMission` still
contained an older automatic three-turn claim.

## Decision

Use `conversation.v2`, a deterministic **guided practice rubric**, in the server
engine. Each of nine missions has three ordered objectives and a fixed partner
prompt at each stage. A distinct reply can advance only the current objective;
future-stage text is not credited retroactively. Rules require contextual phrase
groups, at least four words and three distinct words, reject normalized exact
duplicates, and explicitly reject common contradictions for that objective.
Clarification and reporting no blockers deliberately allow relevant negatives.
Bound input to 24 turns, each 1–1024 UTF-8 bytes. Preserve original messages in
the receipt; normalization is used only for evaluation.

This is still pattern-based evaluation: it can miss valid paraphrases or accept
carefully constructed nonsense, and cannot establish semantic understanding,
spontaneity, human authorship, fluency or pronunciation. Provenance is
`server-rule-based-reported-dialogue`. Score is objective coverage, not English
ability. This slice does not close CORE-004's broader semantic evaluation work.

The mission UI uses the rubric's partner prompts instead of the unconstrained AI
conversation endpoint. This keeps displayed objectives and advancement aligned
and makes the chapter playable without a configured AI provider. The independent
conversation API remains available to its other consumers; its responses do not
award mission progress. A future adaptive dialogue engine must version its
prompt/verdict contract rather than silently changing this rubric.

## Persistence and rewards

- Evaluation is read-only and requires sign-in plus an unlocked chapter.
- There are no per-turn learning attempts, XP or Speaking confidence updates.
  All legacy `npc-conversation*` accuracy submissions return 409.
- Completion accepts only original messages and `rulesVersion`. The store runs
  the rubric, checks the existing chapter prerequisites and writes its receipt
  into `player_bosses.evidence` with the existing one-time campaign XP transaction.
- The existing `(user_id,boss_id)` key is the claim identity. A concurrent retry
  returns the stored receipt, with no second reward; different messages or
  version conflict. Scores supplied by clients are rejected as unknown fields.
- Receipt GET is scoped to the authenticated user. Completed verdicts are read
  from storage, not recomputed against future rules. Old clears without evidence
  remain explicitly legacy; they are neither upgraded nor rewarded again.
- The mission draft and immutable pending operation are device-local per account
  and boss. Reload checks the server first, including after a committed response
  is lost. Pending claims cannot be restarted or edited. Auth changes invalidate
  old responses; failed requests keep the pending dialogue. Corrupt storage is
  kept until an explicit restart. Storage failure is disclosed in the UI; in-app
  state reload retains the same owner's in-memory draft/pending claim. A full
  browser refresh or page close cannot recover memory when storage is blocked.

Campaign XP still contributes to the existing total and rankings. Broader trust
policy and migration of legacy prerequisite evidence remain CORE-005. Existing
memory prerequisite checks use skill confidence rather than PostgreSQL's
activity/time criteria; parity and fresh-after-clear checks remain CORE-006.
This slice removes the inconsistent NPC-turn count, not those older gate rules.

## Rollout and rollback

Apply additive migration `017_mission_evidence.sql` (also in `EnsureProgression`)
before the new frontend. It supports old installations and migration-only base
schema initialization. Do not backfill evidence for old scores or remove old
clears. Old clients receive 409 for legacy turn submissions / missing rule version
and must reload; they cannot obtain fixed-accuracy rewards.

For a UI rollback, retain the new server completion handler, v2 rubric, column and
legacy rejection. Do not restore the old score/count reward path. Later rubric
versions must preserve v2 completed receipt reads and identical retries. Never
drop the column or reset learner data as part of rollback. No production rollout
is included in this change.

## Verification

Engine cases cover valid dialogue for all nine missions, reversed order, repeated
stuffing, unrelated input then recovery, common contradictions and bounds. Store
tests use memory and dedicated PostgreSQL on CI: locked/incomplete input, version,
eight concurrent claims across connections, XP once, actual receipt, changed
payload, owner separation, immutable memory reads and old clears. Browser tests
exercise real APIs and prerequisite attempts, drafts, lost evaluation/completion,
reload/retry, auth races, legacy rejection, corrupt storage and two mobile sizes.
Prerequisite playback events are fixtures, not evidence of a human listening.
See [validation](../SYSTEM-VALIDATION.md) for results and [roadmap](../ROADMAP.md)
for status; no playtest or general semantic accuracy is claimed.
