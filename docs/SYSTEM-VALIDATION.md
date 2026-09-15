# System validation — 2026-09-15

Implementation was completed before running the suites below. Failures found during validation were fixed and the affected suites were rerun.

## Delivered system

- `/journey` connects seven story chapters, fourteen quests, eight fair games, all twenty-four companions, learning recommendations and companion selection.
- Account fair records are stored in PostgreSQL. A completion ledger makes retries idempotent, including a lost HTTP response. Guest data remains separate. Account-specific browser queues survive navigation and reload.
- Each companion has three reachable friendship milestones derived from story and fair records. No separate friendship counter can drift from the underlying saves.
- Shared authentication events update the adventure, scrapbook and account panel. Verified identity checks stop queued results being attributed to another account.
- The local stack starts the Go API and Python AI service alongside Next.js. Dependency lockfiles are used by Docker and CI. CI now includes game logic, 3D asset validation and PostgreSQL integration tests.

## Results

| Check | Result | Scope |
| --- | --- | --- |
| `npm run build` | Pass | TypeScript compilation and 57 generated pages |
| `npm run test:game` | 15 passed | Full completion/restart of all 8 fair games; hearts/cooldowns; echo replay; jump gates; invalid input; guest migration; duplicate run IDs; all 24 friendships; out-of-order saves |
| `go test ./...` with `TEST_DATABASE_URL` | Pass | Backend packages, authenticated fair HTTP contract and real PostgreSQL storage |
| PostgreSQL whole-story integration | Pass | All 14 quests, 42 learning attempts, 14 mistake-review items, first-clear-only rewards, replay improvement and companion purchases; reopening the store retains the save |
| PostgreSQL fair integration | Pass | 16 concurrent identical submissions create 1 visit; conflicting retries rejected; distinct runs improve records; no account XP from fair keepsakes; account isolation and durable reload |
| `go vet ./...` | Pass | Backend static analysis |
| AI `unittest discover -s tests -v` | 13 passed | Deterministic writing, conversation, exercise, pronunciation and TTS fallback behavior |
| Browser core + asset cases | 10 passed | Existing learning routes, playable Word Link, catalogs, live unlocks/loadout, offline recovery and downloads |
| Browser journey cases | 9 passed | Actual Tea Time, Bubble Meadow and Colour Studio playthroughs; pause; account registration; offline/reload/retry; lost response; account switching; full storage; mobile 24-friend selection and saved equipment |
| Browser fair playfields (September 15) | 6 passed across targeted runs | Full 3D Little Garden, Parcel Trail, Echo Pond, Bridge Builder and Cloud Hop playthroughs; Cloud Hop at controlled 32 ms and 160 ms render intervals; correct scores and saved guest memories |
| Browser movement regressions (September 15) | 3 passed | Tea Time, Bubble Meadow and Colour Studio after the shared arena changes, including pause and save/reload |
| `npm run test:assets` on desktop + mobile | 8 passed | Map, offline layout/retry, 41-asset collection and reward gates at both viewport sizes; overlaps four cases above |
| `npm run assets:verify` | Pass | 41 original illustration assets and 23 file hashes |
| `npm run assets:verify:3d` | Pass | 45 GLBs/checksums, 24 characters with 14 unique clips each, exported fair metadata matches the canonical catalog |
| CI YAML + Git whitespace checks | Pass | PostgreSQL service wiring and clean diffs |

Browser checks used the actual local Go API and PostgreSQL unless an individual test explicitly intercepted requests to simulate an outage or a fixed map state. Generated test accounts use `example.test` addresses. SQL integration tests use the dedicated `loccao_system_test` database and remove the users they create.

## Readability and account-save follow-up — September 15

- Four readability browser cases pass: all eight arenas at 460×551 and 390×844; resizing and zooming with a partial tea recipe; maximum zoom at 390×551. Assertions check readable labels, minimum hit areas, viewport containment, separated labels, and space between the playfield, objective and feedback. Screenshots were also inspected.
- Eight full browser playthroughs pass with the new camera and labels: Garden, Parcel, Echo, Bridge, Cloud Hop at controlled 160 ms render intervals, Tea, Bubble and Colour. The tea case checks a saved guest memory after reloading; Colour includes pause and keyboard input.
- The 15 game-logic checks pass again. The final build, including the account-save fix, passes with 57 generated pages.
- The local web/API/AI processes had stopped before the follow-up save checks. PostgreSQL recovered its existing data directory, and the stack was restarted on 3102/8080/8090. Initial connection-refused test results were service availability failures, not completed save checks.
- A new two-tab browser case reproduced a delayed scrapbook response overwriting a newer confirmed memory in the visible scrapbook and its browser cache. Account refresh, completion and storage-event paths now preserve confirmed records for the same owner.
- All six targeted account/save browser cases pass after the fix: offline queue and reload, lost response retry, form sign-in, account isolation, blocked guest storage, and the delayed two-tab response. The new regression plays a real Tea Time game in the second tab and verifies exactly one visit in PostgreSQL. Together with the readability/playthrough cases above, 18 browser cases passed across the targeted runs.

## Fixes found while testing

- Reset Cloud Hop hazard immunity and bridge state on a new run.
- Ignore invalid object IDs and invalid timer deltas without losing hearts or corrupting a game.
- Simulate movement, jumping, collision checks and round timers in steps no larger than 1/60 second. Slow rendered frames no longer shorten jumps. Pause/resume resets the frame clock.
- Route click-to-walk around other interactables and keep the chosen destination. This fixes Little Garden stopping at the empty bed en route to a seed, and prevents incidental pickups during a click route. Keyboard/touch movement still interacts on contact.
- Keep click-to-walk active when Space triggers a jump.
- Make ring centres clickable and exclude hidden collected objects from ray picking. A click inside a ring no longer selects the distant ground behind it.
- Clear held movement controls when restarting a run.
- Increase fair object label readability and disable costly shadows on software renderers.
- Preserve confirmed progress when responses from different tabs arrive out of order.
- Offer retry and an explicit discard-and-replay action when guest storage is full.
- Complete the Go dependency lockfile so the backend builds from the checked-in dependency graph.

## Runtime and limits

The verified Windows session uses PostgreSQL 17 portable binaries on loopback port 55432, with data in `.cache/postgres-data`. The application database is `loccao_english`; integration tests use `loccao_system_test`. API and AI run on 8080/8090, and the existing Next development server runs on 3102. Portable binaries came from the [embedded-postgres package](https://www.npmjs.com/package/@embedded-postgres/windows-x64); they are development tooling, outside the shipped game assets.

Docker Desktop's Linux engine did not become available on this machine, so a container build was not executed locally. The local realtime service reports its in-memory fallback; Redis persistence/pub-sub were not independently verified locally; Linux container execution was verified by remote CI. External paid LLM and speech providers were not exercised; their explicit local fallback paths were tested. Remote CI run [76](https://github.com/Loccao102/LocCaoEnglish/actions/runs/34772270278) succeeded on commit `09af9b7`: frontend, backend (including PostgreSQL and the race detector), AI, Compose, container integration and browser E2E jobs all passed. This run predates the September 15 movement fixes. The integration job starts Redis but is not a dedicated Redis persistence or failover test.

Fair completions are personal client-reported keepsakes, not server-replayed competitive scores. In-progress fair rounds remain in memory; completed queued results survive reload, but unfinished rounds do not. Deleting browser data removes unsynced memories. All eight arenas now have complete browser playthrough coverage as well as logic coverage. Cloud Hop tests advance a controlled clock while sending normal mouse/keyboard input; they do not inject game state or results. Mobile viewport and synthetic slow-render checks are not real-device performance benchmarks.

## Reproduce

Use the local startup steps in README. With the services running:

```bash
npm run build
npm run test:game
npm run assets:verify
npm run assets:verify:3d
E2E_BASE_URL=http://127.0.0.1:3102 npm run test:e2e -- --reporter=line
E2E_BASE_URL=http://127.0.0.1:3102 npm run test:assets
cd backend
TEST_DATABASE_URL=postgres://loccao:loccao@127.0.0.1:5432/loccao_system_test?sslmode=disable go test ./...
go vet ./...
cd ../ai-service
python -m unittest discover -s tests -v
```

On PowerShell, assign each variable using `$env:NAME='value'` before invoking the command. Point `TEST_DATABASE_URL` at a dedicated database named `loccao_system_test`. The portable Windows session uses port 55432; the Docker development defaults use port 5432.
