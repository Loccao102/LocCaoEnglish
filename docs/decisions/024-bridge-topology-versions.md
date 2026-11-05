# ADR 024 — Version Bridge Builder topology without changing old checkpoints

Date: 2026-11-05. Roadmap: CORE-007. New source CI/playthrough review pending.

## Decision

Fresh Adventure/Challenge Bridge Builder uses bridge topology version 2 on the
existing 3×3 board. Adventure chooses canonical routes of 5–6 tiles; Challenge
chooses routes of 7–9 tiles, including a full-grid serpentine. A seeded permutation
of six authored templates and their distinct bank reflections per difficulty
selects three distinct layouts per run. The
fingerprint includes actual ports/bank rows, not only starting rotations.

Ports are derived from neighbouring route cells with reciprocal connections,
plus the outside west entrance/east exit. Seeded off-route decoy connections do
not join the canonical route or open another bank in its canonical orientation.
Tile geometry already supports the port lists; no new game, grid size, renderer
grading, character or server catalog is introduced.

The all-zero canonical orientation provides a known solution. Starting rotations
remain seeded per tile/round, and the entrance is rotated if that state happens
to be solved. The move budget is the clockwise turns required along the actual
canonical route, plus the existing allowance: five Adventure/two Challenge.
Alternative valid reciprocal routes are accepted by the same BFS. Canonical
route length is not a claim that every alternative solution has that minimum
length or that the difficulty has been calibrated with human players.

FestivalSession owns generation selection, turn budget, rotation input, win/loss
and checkpoint behavior. UI/Three.js render its ports and banks and send input;
they do not copy grading or grant rewards. Rounds/hearts/time/stars and Fair
keepsake payloads remain unchanged. No learning XP, mastery or rank is added.

## Compatibility

Outer Fair checkpoint version and ChallengeState version stay 1. The optional
`bridgeTopologyVersion` marker is additive:

- Missing or 1: use the exact old three puzzles, shuffle, rotation seed and
  hard-coded legacy canonical routes/budgets. Practice also stays legacy.
- 2: use the new topology/route budget, preserving marker and seed after reload.
- Unknown marker or a bridge marker on another game: reject restore before
  mutating the session. Keep the original raw checkpoint for explicit recovery.

An unsupported checkpoint is visible as a recovery warning with a download of
the exact original JSON. Loading/declining it does not remove or rewrite it.
Starting a new run remains an explicit replacement of that game's active
checkpoint, disclosed before the choice; the copy can be downloaded first.

Fresh advanced Bridge runs set 2; no stored old run is silently upgraded. New
code keeps the v1 reader rather than backfilling historical snapshots. The final
v2 topology/rotation seed is clamped to the third round after win so it does not
switch to a fourth layout behind the completion view. Existing account save,
queue, completion ID/difficulty contract and database schema do not change.

Rollback must retain the v2 reader or explicitly decline a v2 checkpoint while
keeping it. Never load v2 as v1 or reset browser/account data to recover it.
Server keepsakes continue to accept the same completed-run contract.

## Verification and limits

Unit checks cover seed replay, distinct structural layouts across each run,
reciprocal route solvability, initial unsolved state, route-derived budgets,
whole runs, snapshots/win clamping, genuine legacy fixture compatibility and
unknown-version nonmutation. Browser checks use the actual checkpoint seed and
tile controls for all three rounds at both advanced difficulties; the engine
cannot be forced directly into a win. Phone captures and actual input, old-run
resume and preserved incompatible checkpoints are part of new-head acceptance.

Software solvability/budgets do not prove player difficulty or replay interest.
The manual [playtest protocol](../PLAYTEST-PROTOCOL.md) still requires real
participants and observations before parameter tuning or whole CORE-007 done.
All execution remains on GitHub Actions; no local app/build/tests/services or
production deployment occurs in this task.
