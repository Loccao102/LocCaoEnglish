# System validation — 2026-09-14

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
| `npm run test:assets` on desktop + mobile | 8 passed | Map, offline layout/retry, 41-asset collection and reward gates at both viewport sizes; overlaps four cases above |
| `npm run assets:verify` | Pass | 41 original illustration assets and 23 file hashes |
| `npm run assets:verify:3d` | Pass | 45 GLBs/checksums, 24 characters with 14 unique clips each, exported fair metadata matches the canonical catalog |
| CI YAML + Git whitespace checks | Pass | PostgreSQL service wiring and clean diffs |

Browser checks used the actual local Go API and PostgreSQL unless an individual test explicitly intercepted requests to simulate an outage or a fixed map state. Generated test accounts use `example.test` addresses. SQL integration tests use the dedicated `loccao_system_test` database and remove the users they create.

## Fixes found while testing

- Reset Cloud Hop hazard immunity and bridge state on a new run.
- Ignore invalid object IDs and invalid timer deltas without losing hearts or corrupting a game.
- Advance round timers by elapsed time independently of capped movement physics; reset the frame clock when pausing/resuming.
- Route bubble click-to-walk through a clear lane so a correct destination does not collect intervening wrong bubbles.
- Increase fair object label readability and disable costly shadows on software renderers.
- Preserve confirmed progress when responses from different tabs arrive out of order.
- Offer retry and an explicit discard-and-replay action when guest storage is full.
- Complete the Go dependency lockfile so the backend builds from the checked-in dependency graph.

## Runtime and limits

The verified Windows session uses PostgreSQL 17 portable binaries on loopback port 55432, with data in `.cache/postgres-data`. The application database is `loccao_english`; integration tests use `loccao_system_test`. API and AI run on 8080/8090, and the existing Next development server runs on 3102. Portable binaries came from the [embedded-postgres package](https://www.npmjs.com/package/@embedded-postgres/windows-x64); they are development tooling, outside the shipped game assets.

Docker Desktop's Linux engine did not become available on this machine, so a container build was not executed locally. The local realtime service reports its in-memory fallback; Redis persistence/pub-sub and Linux container execution remain covered by the repository's CI workflow, not by a claim of local verification. External paid LLM and speech providers were not exercised; their explicit local fallback paths were tested. The new CI workflow has been configured, but local test results do not imply a successful remote CI run.

Fair completions are personal client-reported keepsakes, not server-replayed competitive scores. In-progress fair rounds remain in memory; completed queued results survive reload, but unfinished rounds do not. Deleting browser data removes unsynced memories. Mobile browser viewport checks are not real-device performance benchmarks, and the five other arenas have complete logic coverage rather than full physical browser playthrough coverage.

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
