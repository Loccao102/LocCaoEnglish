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

Fair completions are personal client-reported keepsakes, not server-replayed competitive scores. In-progress fair rounds now use owner-scoped local checkpoints, retained for seven days; completed account results sync separately. Deleting browser data removes checkpoints and unsynced memories. All eight arenas have complete browser playthrough coverage as well as logic coverage. Cloud Hop tests advance a controlled clock while sending normal mouse/keyboard input; they do not inject game state or results. Mobile viewport and synthetic slow-render checks are not real-device performance benchmarks.

## Core progression follow-up — September 16

- Twenty-one game logic cases pass across the suite and a targeted follow-up, including all six course unlocks, replay badge union, best-time merging, airborne feathers, JSON checkpoint restoration for all eight games, and owner-isolated course queues that unlock the next course offline without changing retry metadata.
- Four new browser cases pass: a real-input playthrough of all six Cloud Hop courses with sequential unlocks retained after reload; a partial tea recipe resumed and completed exactly once; a feather/checkpoint recovered at 390×551; and a lost game clearing its earlier checkpoint. The course playthrough runs with 160 ms render intervals and includes recovery from a puddle in the final course.
- Six browser regressions pass: readable labels across all eight arenas at two screen sizes, resize/zoom preservation, short-screen maximum zoom, Tea Time saving and Colour Studio keyboard/pause play. Together with the new cases, ten targeted browser scenarios passed locally.
- The production build passes and generates 57 pages. Course and checkpoint controls were inspected in desktop and short-screen screenshots.
- Windows Chromium's default software graphics initialization failed before gameplay. The installed full Chromium succeeds with Direct3D 11; set `E2E_GL_BACKEND=d3d11` for that local test environment. `E2E_GL_BACKEND=swiftshader` selects the documented ANGLE software driver on compatible machines. These switches affect test browsers only.
- Go course unit tests pass and the API compiles. Windows Application Control blocked the new store-test executable, and automatic tool approval rejected launching the updated local API, including an isolated-port attempt. The running local API remains on the earlier implementation. [Linux CI run 79](https://github.com/Loccao102/LocCaoEnglish/actions/runs/35011520460), on implementation commit `224ce55`, passes all six jobs: backend with PostgreSQL and the race detector, frontend, AI, Compose, container integration and all 34 browser cases. This includes the HTTP course retry/unlock contract, all six courses, partial recipe and feather recovery, and the existing eight-game playthroughs.

## Journey continuation follow-up — September 16

- The journey now links atlas pages, badges and the next course/replay goal; the fair and journey list owner-scoped unfinished games. Course URLs, saved-course recovery and locked-link fallback share one selection rule.
- Two additional logic cases pass, bringing coverage to 23 cases across the suite and targeted runs. They verify story-before-replay recommendations, badge targets, checkpoint ownership, malformed/expired checkpoint rejection and explicit-versus-resume course entry.
- Two new browser cases pass: a full first flight leads to Paper Trail through the journey, a partial second course resumes from the fair, a locked URL cannot skip progression, and the mobile atlas fits at 390 px; account creation and sign-out keep guest resume cards and partial recipes separate.
- Four affected browser regressions pass again after the entry-flow change: the entire six-course campaign, partial recipe recovery, full guest storage with retry/discard, and the delayed two-tab account-save response.
- The updated production build passes with 57 pages. The mobile atlas screenshot was inspected. This UI follow-up is newer than CI run 79; that CI result is evidence for the shared core/API implementation, not a claim that the later UI revision ran there.

## Café gameplay and navigation follow-up — September 27

- Tea Time adds visiting-friend shifts with three different customers from six authored characters, distinct ordered recipes, three timed strength bands, free recipe hints and cup resets. Brewing, serving, incorrect orders and replay all use the existing three-heart game and completion ledger.
- Twenty-eight game logic cases pass, including queue variety, all three orders, input locking during brewing, oversteeping, incorrect recipes/strengths, checkpoint validation, legacy recipe compatibility and exact brewing recovery.
- The production build passes with 57 pages. Seven browser scenarios pass on that build: the six-course Cloud Hop campaign, journey/course continuation including live URL and Back navigation, classic partial-recipe recovery, all eight playfields at 460×551 and 390×844, a complete three-customer shift saving once, and pause/reload/oversteep recovery at 390×551. The short-screen screenshot was inspected; the recipe card replaces the longer order text and ingredient labels remain separate.
- All 45 GLBs and their checksums pass verification. The exported fair metadata and downloadable ZIP were refreshed to match the Tea Time instructions; no character meshes or image assets were replaced.
- Remote run 81 completed with five successful jobs and one failed browser case (36 browser cases passed). That failure was a frozen-clock navigation assertion when opening Paper Trail from Journey. Navigation now waits for the destination with the clock running, then pauses for physics inputs. Course entry also subscribes to query changes instead of reading the URL only once per account. CI retains browser failure screenshots/traces for seven days to support future diagnosis.
- These local checks used a production frontend on port 3102 and the installed Chromium with `E2E_GL_BACKEND=d3d11`. No backend service was restarted or account database migrated for this feature; shifts use the existing Tea Time completion payload. The remote CI result for this revision is reported on PR #3.

## Shared difficulty foundation — September 27

- Practice preserves the original rules; Adventure is the default; Challenge
  adds stricter memory, timing, routing and turn constraints. All eight fair
  games use seeded, versioned challenge state and separate per-level records.
- 50 game logic cases pass. The 16 full advanced-mode runs cover every game at
  both new levels, alongside assistance, clocks, checkpoints and solvable bridges.
- 17 affected browser scenarios pass locally: four difficulty scenarios (including
  full garden/delivery runs via actual 3D movement), journey continuation, six
  original playfield scenarios, four readability/zoom scenarios and two café
  scenarios. All eight Challenge arenas retain readable, non-overlapping labels
  at 390 × 551. The mobile café was also inspected using normal rendering.
- The final production build passes (57 pages). `go test ./...` and `go vet ./...`
  pass locally; the expanded HTTP validation test also passes. These local Go
  tests used the memory store, not PostgreSQL. The new account API E2E and
  PostgreSQL/race checks run in CI against the updated backend.
- CI run 82 passed five jobs and 38 browser scenarios, with one journey-link
  failure. Its click helper used smooth scrolling followed immediately by screen
  coordinates. The helper now scrolls instantly; the continuation scenario passes
  locally. The current commit still needs its own CI result.
- Corrected nearby click/contact handling so one activation cannot be counted
  again by the next collision frame. This matters for exact watering counts.
- The production frontend on port 3102 includes this foundation. The local API
  was not restarted or migrated; deploy the API/schema update before relying on
  advanced-mode account sync. Failed uploads remain queued under their owner.
- Design contracts, limitations and the next core priorities are documented in
  `GAMEPLAY-FOUNDATION.md` and `GAMEPLAY-AUDIT.md`. The audit distinguishes active
  routes from old unused components and does not claim the 12 learning activities
  have already received the new fair engine.

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

## Learning recovery · 2026-09-28

Scope: CORE-001/002, branch `codex/learning-recovery`, based on main `8aa9e06`.
Preserves the main branch A1–C2 catalogs and both active learning games.

- `npm run build`: 57 pages and TypeScript passed.
- `go test ./internal/learning ./internal/httpapi`: passed, including new HTTP
  snapshot, owner, version, guest and legacy-bypass checks.
- `go vet ./...`: passed.
- `learning-recovery-ui.spec.ts`: 3 Playwright fault-injection scenarios passed
  locally on production frontend/Chromium D3D11: creation retry identity, locked
  answer across reload, expired-round recovery and persistent CEFR selection.
- Visually inspected `.cache/learning-mobile.png` at 390 × 844; readable options
  without horizontal overflow. This image uses a UI fixture, not a real API round.
- Added memory/PostgreSQL tests for same-ID and distinct-ID concurrency, daily
  progression, actual answer versus review answer, expiry, reconnect and transaction
  rollback after an evidence write fails. Added four real API/browser scenarios for
  guest sets, both activities' lost committed responses, auth isolation and replay.
  All of these passed on Linux CI run 94 for runtime `cf13e2f`.
- Windows Application Control blocked the local store executable; earlier API
  launch was denied by automatic policy review. No bypass was attempted. The updated
  API/schema have not been verified running locally or deployed to production.

Contract and rollout: [API](API.md), [ADR 003](decisions/003-learning-recovery.md).

Final evidence: [CI run 94](https://github.com/Loccao102/LocCaoEnglish/actions/runs/36450327003)
passed all six jobs. E2E logged **52 passed (15.4m)**, including all four real API
learning flows and three recovery UI fixtures. PostgreSQL/race tests, frontend,
AI, compose and integration passed. [PR #4](https://github.com/Loccao102/LocCaoEnglish/pull/4)
merged as `238c931` on 2026-09-28. The subsequent roadmap/evidence update changes
documentation only; runtime remains exactly the tested revision. Its document
links and diff are checked without rerunning application tests for prose changes.
