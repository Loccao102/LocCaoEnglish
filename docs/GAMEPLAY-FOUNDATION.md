# Gameplay foundation · 27 September 2026

## What this increment establishes

The eight Friendship Fair games share a deterministic session engine, three rule
sets, pause-aware clocks, assistance accounting, resumable state and independent
difficulty records. Adventure is the default for a new device. Practice preserves
the original rounds; Challenge is stored as `expert` in the data contract.

This is a foundation for deeper games. It does not yet establish that the content
bank or the difficulty curve is sufficient for long-term play.

## Rules and ownership

- `lib/game/challenge.ts`: seeded content selection, difficulty parameters and
  challenge descriptions. `ChallengeState.version` is 1. Bump this version and
  deliberately migrate or reject snapshots before changing the deterministic
  generator contract; do not silently resume a different puzzle.
- `FestivalSession`: sole owner of phase, input gates, round success/failure,
  elapsed time, assistance and scores. React and Three.js consume its state.
  Rendering must not award a completion directly.
- A new run UUID determines its seed. A checkpoint stores the seed, version,
  level, countdown, partial actions and assistance count. Reloading or changing
  the new-run selector must not change a saved run.
- Countdown advances only during active input, excluding pause, help overlays,
  listening demonstrations and success/failure cooldowns. Time away from the
  game does not consume the timer. A timeout costs one heart and resets the
  current round. Cloud Hop uses route goals instead of a countdown.
- Three hearts per run; zero hearts means loss. Stars on a win are
  `max(1, hearts - min(2, assistanceCount))`. Score is completed rounds × 100
  plus result stars × 25. Assistance never removes a heart.
- Recipe/order assistance is charged once per round; optional Echo Pond replays
  each count as assistance. Automatic replay after a mistake only costs the
  mistake's heart. UI discloses assistance before use.
- A bridge is solved only when reciprocal ports form a bank-to-bank path.
  Generated starts must be unsolved; budgets permit the known authored path.

## Per-game changes

| Game | Adventure | Challenge |
| --- | --- | --- |
| Bubble Meadow | Context clues, shuffled choices, 24 s/catch | Closer meanings, moving targets, 16 s/catch |
| Little Garden | Seed → plant → requested watering count → check | Order disappears after 7 s; up to 3 waterings |
| Echo Pond | Fresh 3–7 note sequences | Faster 4–8 note sequences; 12 s to answer |
| Tea Time | Three visitors, ingredient order, 1 s steeping band | Indirect requests, 0.6 s band, 30 s/cup |
| Parcel Trail | Two clue-based stops per parcel | Remember three stops; order disappears after 7 s |
| Cloud Hop | At least one feather before final ring | All feathers, stronger wind and drifting rings |
| Colour Studio | Three measured drops; repeated pigments matter | Four drops for pastel mixtures, 30 s/mix |
| Bridge Builder | Seeded rotations and turn budget | Smaller allowance, 60 s/crossing |

## Save contract and rollout

`FairCompletion.difficulty` is optional for compatibility. An omitted value is
Practice. Every new completion updates `games[id].levels[level]` with best stars
and number of clears. Legacy aggregate records remain visible but are not
retroactively labelled as Adventure or Challenge achievements. Course atlas
badges and course times remain shared across modes; they are not expert-only
certificates.

The ledger key remains `(player, runId)`. Retries must carry identical metadata,
including difficulty. The client queue and server both reject changed metadata;
concurrent identical retries count once. Merging delayed summaries preserves
the maximum confirmed record for each difficulty. Guest data and account queues
retain their existing owner boundaries.

Deploy API/schema support before the web client: migration
`backend/migrations/013_fair_difficulty.sql` and startup `EnsureFair` both add the
ledger column idempotently. Older API versions reject the additional JSON field;
the client retains the account result in its offline queue for retry. Never
remove that queued run to manufacture a successful sync.

Fair completions are personal, client-reported keepsakes. They grant no account
XP, coins, learning evidence or leaderboard points. Competitive verification and
server-owned sessions require a separate contract; difficulty metadata is not
anti-cheat proof.

## Verification

- Logic suite covers complete runs for all eight games at both advanced levels,
  original Practice behavior, seeded variation, round-transition checkpoints,
  assistance, timeout/loss, bridge solvability and difficulty record isolation.
- Browser coverage exercises a complete assisted café run, exact pause/reload
  state, saved-run difficulty independent of the selector, all eight Challenge
  layouts at 390 × 551, plus legacy controls/readability/navigation regressions.
- Go tests cover immutable nested records, concurrent replay protection,
  difficulty conflicts and HTTP validation. PostgreSQL durability/concurrency
  run in CI with `TEST_DATABASE_URL`; local tests without that variable exercise
  the in-memory store. API E2E covers per-level records and retry conflicts.

## Next core work, before more maps or characters

1. Replace client-reported learning accuracy/competitive score with server-issued
   attempts and stable content IDs. Preserve the separate personal-fair contract.
2. Introduce a shared learning-round lifecycle: shuffled presentation, one result
   per attempt, explicit assisted/unassisted evidence and retry semantics.
3. Improve objective evaluators and remove answer-revealing shortcuts identified
   in `GAMEPLAY-AUDIT.md` before increasing content volume.
4. Add measured difficulty tuning: time to solve, error types, hint use, completion
   and voluntary replay. Use playtesting to tune pressure and decision quality;
   do not treat a passing automated test as evidence that a game is fun.
