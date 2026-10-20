# System validation — 2026-09-15

Implementation was completed before running the suites below. Failures found during validation were fixed and the affected suites were rerun.

## Acoustic receipts — 2026-10-21

CORE-004 branch `codex/core004-acoustic-receipts`, based on main `8ce2260`.
Accepted via [PR #20](https://github.com/Loccao102/LocCaoEnglish/pull/20), main
`99c8535`; no production deployment. See [ADR 009](decisions/009-acoustic-receipts.md)
for retention, immutable inputs, generation leases and rollout/rollback.

Local verification on Windows:

- `go test ./...` and `go vet ./...`: pass, memory store. New cases cover strict
  WAV validation, provider identity/input binding/zero, concurrent generation
  claims, stale finish, exact duplicate creation, owner/version/hash conflicts,
  missing original audio and no learning rewards. PostgreSQL/race still needs CI.
- AI compile + `unittest discover -s tests -v`: **22 passed**. The Azure transport
  is synthetic: actual PCM/reference transmission, metadata hashes, zero and
  word/phoneme details, malformed/missing/nonfinite scores, oversized response
  and provider timeout. No live provider calibration or physical-microphone proof.
- Production build/typecheck: pass, **58 routes**. `test:game`: **50 passed**;
  illustration verifier **41 assets/23 hashes** and 3D verifier **45 GLBs/24 companions** pass.
- Speaking + Writing browser/API suite: **25 passed (2.5m)**; the added delayed
  acoustic/account-switch case separately passed **1/1**. These include real
  account API lost-response/reload/exact retry, audio-free recovery storage,
  failed provider state, no XP and existing guest microphone/cleanup flows.
  Two successful acoustic history renders use explicit UI fixtures; real
  success validation/storage is covered by Go HTTP/store and Python transport tests.
- 390×551 and 390×844 rendered histories were inspected: readable scores and
  controls, expandable word/phoneme feedback, no horizontal overflow. Screenshots
  are generated under ignored `test-results/` by the two viewport cases.
- `node scripts/verify-acoustic-api.mjs`: pass against the local Go API with an
  intentionally unreachable AI address. CI additionally runs it through real
  Go/Python containers with an unconfigured acoustic provider and dedicated data.

Initial browser failures were a local launch configuration error (API CORS had
only port 3000 while web used 3102). Restarting the test-only API with the explicit
3102 origins resolved the failures; no application assertion was weakened.
One pre-existing Reading history fixture also exposed equal wall-clock timestamps
on Windows. Its legacy row is now explicitly dated one hour earlier in both store
modes, preserving all provenance/order assertions instead of relying on distinct
consecutive clock reads. No player data or rate limits were changed.

Final runtime head `b38ecf90c629e214c1a79330ca0f0b328a80d067` passed all six jobs
at [CI 149](https://github.com/Loccao102/LocCaoEnglish/actions/runs/39495797778):
backend **118880398365** includes dedicated PostgreSQL/race/vet; AI has 22 passing
tests; frontend verifies 50 logic cases/assets/58 routes; container integration
**118880927123** passes real Go/Python acoustic failure/recovery. E2E job
**118880927292** passes **153/153 (29.5m)** with strict flaky failure enabled and
no retries/flaky tests. Reviews/threads were empty at the expected-head squash
merge. Local final Speaking regression also passed **13/13 (14.8s)**.
Local memory data is temporary. Docker/PostgreSQL/race were not run locally.
No production deployment, live audio quality, IELTS overall calibration or wider
reward/rank policy is claimed by this slice.

## Checked practice rewards — 2026-10-21

CORE-005 branch `codex/core005-reward-boundary`, [ADR 010](decisions/010-checked-practice-ranking.md).
This slice is in review; full CI/merge evidence will follow on the final head.

- Go tests/vet pass locally (memory). New memory/PostgreSQL-parity cases retain
  legacy personal XP while excluding it from rank, derive 20 checked XP once
  through ten concurrent same-attempt completions, exclude wrong/replayed and
  unsupported-rule receipts, and reopen PostgreSQL for durability when CI supplies
  the dedicated test URL. All arbitrary activity names/duel scores reject without
  changing XP/confidence/reviews; bookmark auth/range/provenance are checked.
- Production build/typecheck pass, 58 routes. Actual browser/API core + reward
  tests pass **15/15 (11.6s)**: real Word Link input, lost committed response,
  reload/retries and exactly one checked-board contribution; generic renamed score
  attempts; practice invitation; local placement with no shared-demo mutation;
  lesson open responses/locked checks, failed bookmark and explicit retry.
- `node scripts/verify-reward-boundary.mjs` passes against the final local memory
  API: retired score writes, six concurrent identical real learning submissions,
  one checked-board contribution and signed self-reported bookmark with no XP.
  CI runs the same contract against the PostgreSQL container stack.
- Lesson and community renders at **390×551/844** were inspected. A first render
  exposed old 9–10px social labels; new labels/rows are 16–20px and score/name
  layout wraps without horizontal overflow. Lesson input has an accessible name,
  checked responses lock and controls remain at least 48px.
- The first full lesson run exposed an existing null-options crash on entering
  a free-response item; fixed optional options handling. One new alert assertion
  initially also matched Next's route announcer; it is now scoped to the lesson
  and still requires the actual bookmark failure text. No checks were removed.

No SQL migration/reset/backfill, production deployment or competitive skill
certification. Existing lifetime XP, mixed legacy confidence and campaign unlocks
are preserved, not retroactively verified. Real competitive sessions and legacy
mastery/prerequisite policy remain outside this slice.

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

## Collocation integrity and contextual practice — 2026-10-06

Scope: CORE-003 follow-up to PR #5, branch `codex/collocation-depth`.

- `go test ./...` and `go vet ./...` passed locally. This invocation uses memory
  storage; PostgreSQL/race validation belongs to CI. The earlier Windows blocking
  limitation did not occur in this test run.
- `npm run build` and `npm run typecheck` passed. No dependency changes.
- Three local Playwright UI fault fixtures passed at 1280 × 800, 390 × 551 and
  390 × 844, covering pair-only old snapshots, wrong-answer feedback, keyboard
  input, locked pending answers, retry after reload and matching retry payloads.
  Screenshots in `test-results/collocation-ui-*/collocation.png` were inspected:
  readable choices and feedback, no horizontal overflow. These fixtures simulate
  transport and do not establish real API persistence.
- HTTP tests cover correct/wrong account and guest results, unchanged creation/
  submit retries, snapshot resume, owner isolation, invalid options/versions,
  review teaching the correct answer, daily progression cap and legacy rejection.
- Catalog tests check three distinct questions for each selectable starting level,
  valid unique options, stable shuffle without mutating the bank, varied correct
  answer positions, unsupported pairs and exhausted-bank replay.
- Added real browser/API checks for three campaign rounds, wrong-answer reload,
  two short-phone layouts, and Collocation lost committed response/account isolation.
  These checks passed in CI run 99.

Final evidence, confirmed 2026-10-07 (Asia/Bangkok):
[CI run 99](https://github.com/Loccao102/LocCaoEnglish/actions/runs/37468179572)
passed all six jobs on runtime `56c5715b2d3438592325fe169c4b2e1c0c9d516c`:
backend PostgreSQL/race, frontend build, AI service, compose, integration and E2E.
The browser log reports **59 passed (15.8m)**.
[PR #6](https://github.com/Loccao102/LocCaoEnglish/pull/6) merged as `2efffc4`.
The subsequent roadmap/evidence commit changes documentation only; application
code remains the tested revision. Document links and diff are checked without
rerunning application tests for prose changes.

No store/schema change or production deployment. The API must be updated before
the frontend. CEFR tier calibration and player enjoyment still require playtesting.

## Sentence Builder verified rounds — 2026-10-07

Scope: CORE-003, branch `codex/core003-sentence-builder`, based on main `d286447`.
Adds server-owned chunk permutations and readable actual-answer evidence without
changing SQL schema, rewards or the existing three activity contracts.

- `go test ./...` and `go vet ./...` passed locally, including HTTP guest/account,
  server grading, immutable retry, invalid IDs/version, legacy bypass, catalog
  solvability and repeated-word coverage. Local store tests use memory.
- `npm run build` passed (57 routes), including TypeScript. No dependencies added.
- 16 targeted Playwright scenarios passed against the production frontend and
  local Go API (memory): 10 real API/browser scenarios and six transport fixtures
  covering older activities' recovery UI. The first integration run exposed a
  missing localhost:3102 CORS setting in the test API process; configuring its
  explicit local origins resolved it without changing application CORS policy.
- After switching sentence IDs to a private server seed, the five sentence
  browser/API scenarios passed again, verifying lost committed responses, account isolation,
  draft reload, wrong-order feedback, three different rounds, repeated words,
  keyboard, level persistence, locked pending order and identical retries.
- Screenshots at desktop and 390 × 551 / 390 × 844 are inspected from
  `test-results/sentence-builder-*/sentence-*.png`. Controls use readable text and
  at least 44px targets; mobile has no horizontal overflow.
- Added memory/PostgreSQL tests for same-ID concurrent retries, daily replay,
  actual sentence evidence versus review answer, snapshot copying and store
  reconnection. PostgreSQL/race and the full browser suite passed in CI 103.
- Review follow-up: completed sentence retries now compare the stored ID-array
  string exactly, rather than applying the choice games' case-insensitive text
  comparison. Store/HTTP tests and vet passed again, including changed ID case
  and changed array serialization conflicts. CI 103 targets this follow-up.

Final evidence, 2026-10-07:
[CI 103](https://github.com/Loccao102/LocCaoEnglish/actions/runs/37528956984) passed
all six jobs on runtime `e27f0f086c3039fce6e630f7ca3ba32fb706e8c4`: frontend,
backend PostgreSQL/race, AI service, compose, integration and E2E. The browser log
reports **64 passed (15.6m)**. [PR #7](https://github.com/Loccao102/LocCaoEnglish/pull/7)
merged as `e84c1c1`. The acceptance update changes documentation only; application
code remains the tested revision. Links and diff are checked without rerunning
gameplay tests for prose-only changes.

No production deployment. Local API verification uses temporary memory storage,
not durable account persistence. Deploy API before web; retain the sentence v1
grader and legacy rejection on rollback. Existing snapshots/history remain intact.
CEFR labels need calibration through player trials; automated tests do not prove
that every difficulty tier is balanced or that the entire learning migration is done.

## Word Graph study and verified practice — 2026-10-07

Scope: CORE-003, branch `codex/core003-word-graph`, based on main `f58ddb8`.
Exploration never scores; a separate practice route uses the shared attempt
contract, a server-owned graph catalog and contextual relation questions. No
store/schema/reward-policy changes and no new assets/dependencies.

- `go test ./...` and `go vet ./...` passed locally (memory storage). New catalog
  tests check all nine relations, answer membership, option diversity, independent
  copies, seeded shuffle, exclusion/exhaustion and supported level/pack. HTTP tests
  cover correct/wrong guest/account, private field omission, create/submit retry,
  owner/version/option validation, post-feedback conflict, daily cap, correct
  review answer and legacy bypass rejection.
- `npm run build` passed with 58 routes. No Word Graph feedback text was found in
  compiled client chunks; the server page passes only the exploration projection.
- 11 targeted browser/API tests passed using production web and local Go memory
  API. Coverage includes all five migrated activities' lost committed response /
  account isolation, Word Graph study with zero attempt writes, hidden study UI
  during practice, three distinct questions, wrong feedback/reload and pending
  retry retaining the original payload.
- Desktop and 390 × 551 / 390 × 844 renders inspected. Phone study nodes use a
  grid with no overlap; choices have at least 44px targets and 16px text. Browser
  keyboard submission and horizontal-overflow checks passed. A final layout
  adjustment moves the central study node away from unrelated crossing edges.
  Build and all four Word Graph browser scenarios passed again after that change.
- Full PostgreSQL/race, integration and browser suite passed in CI 106.

Final evidence: [CI 106](https://github.com/Loccao102/LocCaoEnglish/actions/runs/37559631886)
passed all six jobs on runtime `8bbc2f9406d5fb54eb1f45ffc7933d5bdc3e502f`.
The browser log reports **69 passed (15.0m)**. [PR #8](https://github.com/Loccao102/LocCaoEnglish/pull/8)
merged as `cac8c34`. This acceptance follow-up changes documentation only; the
application remains the tested revision. Links and diff are checked without
rerunning gameplay tests for prose-only changes.

No production deployment. Local memory results are not durable account storage.
The public study map is intentionally available for learning; practice does not
prove unaided recall. Only the travel-network A2 tier is supported in this slice;
content depth and CEFR calibration remain open. API first, then web; keep legacy
rejection and saved-round support on rollback.

## Reading Race snapshots and evidence — 2026-10-07

Scope: CORE-003, branch `codex/core003-reading-race`, based on main `80d4133`.
Nine passages across editorial A2/B1/B2, three distinct passages per set, private
grading and post-submit excerpts. The original two passages remain in the B2 bank.
Title and passage are optional public prompt fields; no SQL/schema/reward-policy
change. Reviews retain passage context and actual choices remain separate from
the correct answer. Legacy client accuracy is rejected for Reading Race.

- `go test ./...` and `go vet ./...` passed locally using memory storage. Catalog
  tests validate evidence excerpts, choices, level coverage, seeded selection,
  non-repetition and independent slices. HTTP tests cover correct/wrong outcomes,
  guests/accounts, private-field omission, retries, versions, owner boundaries,
  daily claims, legacy aliases and review context.
- New memory/PostgreSQL snapshot test checks title/passage retention, independent
  returned values, old-version grading, feedback/retry identity and review text.
  The PostgreSQL variant reconnects through a second store; it passed in Linux CI 109.
- `npm run build` passed (58 routes). Private explanation text is absent from
  client chunks; the client does not import the catalog.
- 12 targeted Playwright tests passed (22.5s) on production web + real local Go
  memory API. All six migrated activities retain lost committed responses and
  account isolation. Reading scenarios complete every offered tier, restore a
  pending wrong choice through reload, lock input while retrying, restore final
  feedback/level, and restart a completed set.
- Desktop and 390 × 551 / 390 × 844 screenshots inspected. Passage text is at
  least 18px, options at least 16px with 44px targets; keyboard submission and
  horizontal-overflow checks passed. No assets/dependencies changed.
- Full CI, including PostgreSQL/race and the entire browser suite, passed.

Final evidence: [CI 109](https://github.com/Loccao102/LocCaoEnglish/actions/runs/37578203639)
passed all six jobs on runtime `32e1d68583f01d424a2b99209101b71901919faf`.
The browser log reports **74 passed (12.7m)**. [PR #9](https://github.com/Loccao102/LocCaoEnglish/pull/9)
merged as `ad6a5cf`. The acceptance follow-up changes documentation only; the
application code remains the tested revision. Relative links and diff were
checked without rerunning gameplay tests for documentation-only changes.

No production deployment. Local memory storage is temporary. API before web;
rollback must keep title/passage decoding, saved-round support and legacy
rejection. The source remains available during questions, so results measure
practice comprehension, not unaided recall or reading speed. Wider content,
CEFR calibration and timed modes remain outside this slice.

## Story Choice server-owned branches — 2026-10-08

Scope: CORE-003, branch `codex/core003-story-choice`, based on main `be0f63d`.
Five decision scenes and four endings replace the browser's score/branch graph.
Multiple opening choices can be effective. Each decision is a shared learning
attempt; the next scene is derived from its committed answer and private saved
definition. Continue uses a reserved request key and existing owner/request
uniqueness. No SQL migration, new reward ledger, dependencies or assets.

- `go test ./...` and `go vet ./...` passed locally with memory storage. Domain
  tests traverse every branch, reject cycles/unreachable scenes, verify effective
  alternatives and shuffled options. HTTP tests check private-field omission,
  guest/account wrong choices, version/option checks, start/submit/continue retries,
  rejection of client-selected destinations and legacy aliases.
- Store tests cover parallel continue calls producing one child, account boundary,
  changed-answer conflicts, daily caps, immutable graph/history copies, inherited
  expiry, terminal rejection and saved-version continuation. The PostgreSQL variant
  reconnects through another store; it passed in Linux CI 112.
- `npm run build` passed with 58 routes. Private consequence text was absent from
  client chunks; the old client-side graph and grading code were removed.
- 13 Playwright browser/API scenarios passed locally (initial run 19.6s) using
  production web and real memory API. Coverage includes seven activities' lost
  committed results/account isolation, Story Choice lost continue response/reload,
  immutable pending wrong choice, unresolved and successful endings, branch
  history and explicit replay. Build and these scenarios were repeated after the
  final shared-reference recovery guard.
- Desktop and 390 × 551 / 390 × 844 screenshots inspected. Scene text >=18px,
  option text >=16px, targets >=44px; keyboard and no-horizontal-overflow checks
  passed. The story uses normal scrolling without shrinking the content.
- Full CI including PostgreSQL/race and the full browser suite passed in CI 112.

Final evidence, 2026-10-08 (Asia/Bangkok):
[CI 112](https://github.com/Loccao102/LocCaoEnglish/actions/runs/37667016258)
passed all six jobs on runtime `7d2482ae024c96119508fc2a1919d1be08ac9fb2`.
The browser log reports **79 passed (16.3m)**.
[PR #10](https://github.com/Loccao102/LocCaoEnglish/pull/10) merged as `31d842e`.
The acceptance follow-up changes documentation only; application code remains
the tested revision. Relative links and diff were checked without rerunning
gameplay tests for documentation-only changes.

No production deployment. Local memory results are temporary. API first; retain
story-choice.v1 snapshot decoding, grading, continuation and legacy rejection on
rollback. This is scenario-based guided practice, separate from Adventure rewards;
no unassisted/competitive claim, ending bonus or timer. More scenarios and B1
difficulty calibration need playtesting. CORE-003 is not complete.

## Listen & Pick grading and playback recovery — 2026-10-08

Scope: CORE-003, branch `codex/core003-listen-pick`, based on main `bf25b18`.
Eighteen B1 clips across core and five existing campaign packs; private server
catalog, shuffled choices, actual-answer grading and shared recovery. Removed
the duplicate browser bank and consolidated the obsolete ListeningPick export.
Playback preparation and client completion/failure reports use an idempotent
journal in the existing snapshot JSON, serialized with grading. No SQL migration,
new reward ledger, assets or dependencies.

- `go test ./...` and `go vet ./...` passed locally (memory). Domain checks cover
  all packs, distinct clips, answer membership, shuffle and independent copies.
  HTTP checks cover guest/account, correct/wrong, transcript/key projection,
  private audio source, fallback versus neural response, requested/failed gating,
  input/version/owner, immutable retry/reload, review and legacy rejection.
- Memory/PostgreSQL tests cover concurrent preparation, immutable terminal
  reports, report retry after grade, catalog-independent saved transcript/version,
  independent event copies, expiry, reconnect, daily cap and grading provenance.
  PostgreSQL/race passed in Linux CI 115 and final CI 116.
- `npm run build` passed (58 routes), including TypeScript. Transcript and
  feedback sentinels are absent from compiled client chunks. Browser synthesis
  deliberately receives source text at playback time, so this is guided practice.
- 16 targeted browser/API scenarios passed (35.1s) on production frontend and
  real local Go memory API: existing seven activities' recovery plus listening
  start/end gating, slow replay, both lost-report boundaries, failed audio,
  pending wrong answer, lost committed grade, cross-tab completion recovery, account isolation/media cleanup,
  three non-repeating clips, keyboard and both small-phone sizes. These tests
  simulate speech/media callbacks because headless CI has no installed voice;
  one neural media test also substitutes its audio payload. They are not proof
  of configured Azure synthesis.
- A separate local Chromium check used the native browser speech engine without
  media mocks. It completed a real clip and then unlocked all four choices.
  Desktop and 390 × 551 / 390 × 844 screenshots inspected; choices use 18px text,
  controls at least 48px high and no horizontal overflow.
- CI 115 on `2458345` passed five jobs including PostgreSQL/race; browser suite
  reported 85 passed and one failed campaign label check. The new listening
  toolbar had replaced the established `WORK · REQUIREMENTS` label. Restored
  consistent campaign labels; retained the regression assertion. Build and all
  14 core/listening browser tests passed again locally (27.1s). Full CI on the
  follow-up revision passed as CI 116.

Final evidence, 2026-10-08 (Asia/Bangkok):
[CI 116](https://github.com/Loccao102/LocCaoEnglish/actions/runs/37776731516)
passed all six jobs on runtime `956a11fa96722510dd7fbd3d217cc73c72a53c9b`.
The browser log reports **86 passed (10.1m)**.
[PR #11](https://github.com/Loccao102/LocCaoEnglish/pull/11) merged as `8f69fe0`.
This acceptance update changes documentation only; application code remains the
tested revision. Relative document links and diff are checked without rerunning
gameplay tests for documentation-only changes.

No production deployment. Local memory is temporary; Azure credentials/service
were not configured for the native-audio check. Playback reports can be forged by
a modified client and never prove unaided listening. Results and saved attempt
provenance identify guided listening. API first; keep snapshot/audio/grader support
and legacy rejection on rollback. B1 calibration and more levels require player
trials; Dictation Rush and the rest of CORE-003 remain open.

## CORE-003 Dictation Rush — 2026-10-09

Runtime branch `codex/core003-dictation`; merged through PR #12 as `49eddbd`. The
`/dictation` route now uses server-owned attempts and the existing audio journal.
Nine sentences (including the original five) supply three-round A2/B1/B2 sets.
V1 alignment penalizes missing, extra and substituted tokens, saves the typed
response and locks feedback. Drafts and failed submissions reuse owner-scoped
recovery; the legacy client-accuracy route rejects dictation.

- `go test ./...` and `go vet ./...` passed locally. Alignment cases cover middle
  omission/insertion, extra tail, substitution, repeated words, negation,
  contractions, punctuation/case and zero-clamped accuracy. HTTP checks cover
  private projection, fallback, failure gating, forged accuracy, immutable retry
  and legacy rejection. Store tests cover partial confidence, concurrent submit,
  owner/version/expiry, retired content, daily cap and exact payload retries.
- PostgreSQL cases additionally check reconnect, actual history/accuracy/source
  and a single review mutation. These passed Linux CI 119 with a dedicated test
  DB and race detector; local store verification used memory only.
- `npm run build` passed (58 routes). Twelve real browser/API scenarios passed
  (37.1s): five dictation cases and seven listening regression cases. Coverage
  includes draft reload, failed audio, pending/committed response loss, owner
  separation, cancelled media, three distinct sentences, difficulty retention,
  keyboard controls and 390 × 551 / 390 × 844. Speech callbacks are simulated in
  headless tests; this does not validate Azure voice configuration.
- A separate native Chromium speech check completed a sentence and enabled
  submission without media mocks. Desktop and both phone screenshots inspected;
  input text is 18px, controls at least 48px, no horizontal overflow.

No production deployment, SQL migration or user data reset. API-first rollout;
retain the v1 alignment/audio contract on rollback. Partial accuracy is a server
text comparison under guided practice, not proof of unaided listening. Editorial
tiers and the small bank still need player trials and later content expansion.
Overall CORE-003 remains open pending its cross-activity acceptance audit.

Final evidence, 2026-10-09 (Asia/Bangkok):
[CI 119](https://github.com/Loccao102/LocCaoEnglish/actions/runs/37818092697)
passed all six jobs on runtime `abd2d7aaffb493e5bb25a10e077d506f9040edf2`.
The browser log reports **91 passed (16.1m)**.
[PR #12](https://github.com/Loccao102/LocCaoEnglish/pull/12) merged as `49eddbd`.
This acceptance update only changes documentation; runtime is the tested code.
Relative links and diff checked without repeating gameplay tests for docs-only
changes. No production deployment.

## CORE-003 cross-activity acceptance audit — 2026-10-11

Branch `codex/core003-recovery-audit`, runtime `c604aca`, merged through
[PR #13](https://github.com/Loccao102/LocCaoEnglish/pull/13) as `3beef1f`.
Audit scope is
the nine objective-learning routes, their actual adapters and compatibility
exports; [ROADMAP](ROADMAP.md#ma-trận-nghiệm-thu-core-003) maps every activity to
its grader/store/browser evidence and assistance limits.

Found and fixed: Word Link and Grammar enabled CEFR changes after a transport
failure, allowing a fresh round to overwrite the unconfirmed answer reference.
All six level selectors now consume one hook permission. The action separately
checks pending state, operation lock and account token, including a stale control
that becomes enabled outside normal rendering. Successful feedback restores level
changes; expired-round recovery still works. No API/save/SQL version change.

Removed the obsolete client-graded Grammar compatibility export and unused
Word Link/Grammar banks in contentPacks. An AST-based conversion compared retained
labels and speaking prompt arrays for the base plus all nine campaigns exactly;
only unused objective fields were removed. Speaking behavior is not migrated here.

Local evidence on this runtime:

- Two new browser cases failed against the prior production build with the exact
  expected defect: level selectors stayed enabled after a lost submit.
- `npm run build` passed (58 routes). After the fix, 26 core/recovery/dictation
  browser cases passed (32.8s), including failure/reload, identical retry, forced
  stale control, post-feedback level change, campaign labels and mobile regressions.
- The additional real API matrix passed all nine activities (1.2s), with separate
  learners for right/wrong responses: actual answer, authoritative reference,
  feedback, XP once, review, owner boundary, immutable retry, audio journal gate,
  forged accuracy rejection and legacy-route rejection. Catalogs are test fixtures
  only; the server performs actual grading. Audio reports in this matrix do not
  simulate or prove a human listening; dedicated browser audio tests cover media.
- During matrix development, corrected a test assumption to expect all effective
  Story Choice answers joined by OR, as its established contract requires. A burst
  of test registrations reached the existing 20/minute auth limit; the final
  matrix uses two learners across activities instead of creating eighteen accounts.
  Rate limits and assertions remain intact; no user data or services were reset.
- Obsolete objective bank fields/sentinels are absent from compiled client chunks.
  No layout/assets/backend changes in this audit; the existing browser cases cover
  affected controls. PostgreSQL/race and the full suite passed on CI below.

Final acceptance on 2026-10-11 (Asia/Bangkok):
[CI 122](https://github.com/Loccao102/LocCaoEnglish/actions/runs/38074216860)
passed all six jobs for runtime `c604aca`: frontend/build/assets, backend
PostgreSQL/race and vet, AI service, compose, integration, and E2E. The E2E job
`114277822378` reports **102 passed (16.4m)**, with no failed/flaky summary.
The PR head matched this revision at merge; no review submissions or unresolved
review threads were present. The acceptance follow-up changes docs only.

No deployment. This closes only the CORE-003 migration/grade/recovery scope.
Broader reward trust, speaking/mission evidence, cross-domain
recovery, measured difficulty and expanded content remain their roadmap items.

## CORE-004 Shadow Me transcript evidence — 2026-10-11

Branch `codex/core004-shadowing-evidence`, based on main `f97cbcb`; merged through
[PR #14](https://github.com/Loccao102/LocCaoEnglish/pull/14) as `d8ccd86`.
Shared `/speaking` and `/ielts/speaking` now save actual transcripts through server
attempts. `shadowing.v1` aligns words against the deliberately visible phrase and
returns `server-guided-transcript-match`, not acoustic evidence. One catalog keeps
the 30 existing phrases and ten labels; campaign progression remains accessible
through guided transcript practice. Generic shadowing/pronunciation client-score
submissions are rejected. No SQL migration; deploy API before frontend.

Local evidence:

- `go test ./...` and `go vet ./...` passed. New memory/store tests cover repeated
  word omission, actual answer/source, fractional match, owner/version/expiry,
  concurrent immutable retry, daily cap and saved results against a retired bank.
  The same test uses a second PostgreSQL connection on CI; local did not run PG/race.
- `npm run build` passed all 58 routes; `npx tsc --noEmit` and diff checks passed.
- Playwright `speaking.spec.ts`, `core.spec.ts`, `learning-recovery-ui.spec.ts`:
  **19 passed (29.3s)** on `14b9162`. Real APIs cover pending/committed
  response loss, reload, owner isolation, fake accuracy/legacy rejection and XP once.
- Simulated microphone/recognition and provider responses cover denied/delayed
  permission, partial provider failures, unconfigured/invalid acoustic results,
  a valid zero acoustic score, no coach rewards, stale results after owner change,
  hidden-tab and client-navigation cleanup, and no audio in browser storage.
- The initial navigation test timed out intermittently while entering the 3D
  village. Diagnostics also observed the expected two stopped streams/two closed
  microphone contexts on that route. The final focused cleanup test navigates to
  Review and counts only microphone contexts; identical release assertions passed
  three repeat runs (5.6s) and the full targeted run. This does not establish 3D
  route performance; existing 3D E2E remain in the full CI suite.
- Viewed final full-page captures at 390×551 and 390×844: readable phrase/input,
  19px transcript text, controls at least 48px, no horizontal overflow. Three
  distinct work-deadline phrases and the existing campaign-label regression passed.

The API preview uses temporary memory storage. Microphone/provider fixtures do not
prove physical microphone quality or production acoustic accuracy; neither was
claimed. Coach responses/audio are transient and are not persisted as verified
learning evidence. Existing AI endpoints' legacy numeric proxies are ignored by
this UI. No production deployment. CORE-004 remains in progress for persistent
acoustic receipts, mission dialogue evaluation and IELTS provenance/history;
CORE-005 still owns comprehensive reward/rank integrity and legacy classification.

Pre-merge review corrected the recording notice: the app's WAV is submitted only
for explicit coaching, but browser speech recognition may use an online service.
The UI now states that distinction before recording, with an assertion for the
notice. No speech API behavior or reward rule changed in this copy correction.
The revised UI rebuilt successfully on `5666bc2`; all nine Speaking browser/API
cases passed (12.2s), including the notice assertion and both mobile captures.

Final acceptance on 2026-10-11 (Asia/Bangkok):
[CI 126](https://github.com/Loccao102/LocCaoEnglish/actions/runs/38109616712)
passed all six jobs for runtime `5666bc2`: frontend/build/assets, backend
PostgreSQL/race and vet, AI service, compose, integration, and E2E. Job
`114382385432` reports **111 passed (16.8m)**, with no failed/flaky summary.
The PR head matched this revision at merge; no review submissions or unresolved
review threads were present. This acceptance follow-up changes docs only.
No production deployment; only the guided Shadow Me slice is complete.

## CORE-004 guided mission evidence — 2026-10-11

Branch `codex/core004-mission-evidence`, based on main `e5d8c29`; merged via
[PR #15](https://github.com/Loccao102/LocCaoEnglish/pull/15) as `2abbc36`.
All nine `/missions/*` routes use the ordered `conversation.v2` rubric. No fixed
per-turn learning accuracy remains in the active mission UI or legacy NPC API.
Original messages, coverage verdict and reported-dialogue provenance are saved
atomically with first-clear campaign XP in `player_bosses.evidence`. This is a
guided pattern-based practice result, not semantic/fluency/acoustic assessment.

Local verification of this runtime:

- `go test ./...` and `go vet ./...` passed. Engine tests cover valid conversations
  across all nine missions, reversed order, repeated stuffing, recovery after
  irrelevant text, explicit contradictions and payload bounds. Store tests cover
  locked/incomplete/version errors, eight simultaneous claims, one reward,
  immutable actual messages, changed-payload conflict, other-owner reads and
  legacy clears. Dedicated PostgreSQL, second-connection concurrency and migration
  017 replay twice are wired into CI; local store verification used memory.
- A test initially failed because its error variable retained the preceding
  expected foreign-owner error in the memory-only legacy setup. Reset the fixture
  error before that setup; assertions and runtime behavior were unchanged.
- Final `npm run build` passed all 58 routes, including type checking.
- `missions.spec.ts`, `core.spec.ts`, `speaking.spec.ts`: **24 passed (34.2s)**.
  Eight new mission cases use actual auth, learning, evaluation, claim and receipt
  APIs. Prerequisite answers come from test catalogs; reported audio events are
  fixtures, not evidence of a human listening. No mission grading/claim is mocked.
- Browser faults cover lost evaluation, lost committed and uncommitted claim,
  immutable retry/reload, legacy/forged score rejection, account switch and delayed
  old response, corrupt draft preservation until explicit restart, and unavailable
  storage with a warning and continued in-memory play.
- Viewed final 390×551 and 390×844 captures after enlarging the inherited small
  chat text: 18px chat, 19px input, buttons and checkpoint links at least 48px;
  mobile tests verify no horizontal overflow. Full-page captures include the
  existing fixed navigation overlay; they do not establish every scroll position.
- Removed the unused `AirportMission` and score-only helper only after confirming
  all nine routes import `TravelMission`. No tests were removed or weakened.

Known limits: rubric paraphrases and semantic understanding still need deeper
evaluation; general language quality is not established by these tests. Existing
campaign prerequisite legacy trust, memory activity/time parity and XP/rank
classification remain CORE-005/006. Unfinished dialogue is device-local, while
completion receipts persist in PostgreSQL; the local API preview uses temporary
memory. Roll out migration/API before frontend, preserve receipts and the v2
grader on rollback. No production deployment; CORE-004 remains in progress.

Pre-merge review found that the in-app "Reload saved state" action could discard
the in-memory dialogue when browser storage was blocked. The hook now keeps an
owner-keyed in-memory copy for that action, including an unresolved claim. The
storage warning still applies to full page refresh/closing the page. An expanded
browser case verifies continued turns, lost claim, in-app reload and identical
retry while both storage reads and writes fail. After this correction, build
passed (58 routes) and all eight mission browser/API cases passed (13.7s).
The earlier 24-case result belongs to runtime `02ec29a`; final CI must use the
new PR head containing this correction.

CI 130 on `4e6f116` completed six jobs but its E2E log reported **118 passed and
one flaky** (17.6m): mission 390×844 timed out waiting for the reply input on its
first attempt. This is not clean acceptance. The old failure-only upload step
produced no artifact because Playwright returned success after retry, so the
exact cause of that CI timeout cannot be asserted from the log.

A local combined learning/recovery/listening/mission run produced 36 passes and
two Listening failures (1.5m), with an opaque `Failed to fetch` in saved page
context. Review found a concrete transport defect: rate limiting wrapped CORS,
so 429 responses omitted allowed-origin headers. A new HTTP regression failed
against the old middleware, then passed after moving CORS outside the limiter
for both normal and platform routes. The limits themselves are unchanged;
`Retry-After` is exposed to allowed origins. This defect is confirmed; attributing
the earlier CI timeout specifically to it remains an inference.

Mission fixtures now initialize their token on the first mission document rather
than bootstrapping an unrelated account page, and the two read-only mobile cases
share prerequisite setup across isolated browser contexts. They still use actual
grading/rewards and the same assertions. A new browser case verifies a visible
429 and draft-preserving load retry; its initial selector was scoped to the
mission error after detecting ambiguity with Next's route announcer. Request
throttling diagnostics print paths only. CI now enables `failOnFlakyTests`, so
retry-only passes fail the job and preserve failure artifacts. Final acceptance
requires the new head and a clean full CI run, including Listening regressions.
After these changes, local `go test ./...`, `go vet ./...`, and `npx tsc --noEmit`
passed; all nine mission browser cases passed (11.6s). Frontend runtime remains
the already-built `4e6f116` UI; the latest runtime change is API middleware only.

CI 131 on `96fc1a1` was rejected: **117 passed, two failed and one flaky**
(17.9m). Artifact `11708357465` now preserves the failures. The first mobile
mission snapshot shows `rate limit exceeded`, its original reply and the retry
button; Reading's snapshot shows the same error on attempt creation. The logs
also record a real 429 on mission evaluation and registration. These failures
confirm saturation of the shared source-IP rate budget by sequential fixture
traffic, rather than unreadable mobile text or a different grading verdict.

The mission suite now waits a full 60-second limiter window at its boundaries,
separating its prerequisite-account traffic from neighboring suites. This is
test pacing: production limits, HTTP behavior and all assertions are unchanged;
no Redis/database reset or automatic assertion retry is introduced. The explicit
429 recovery case remains. This adds about two minutes to E2E; this suite is not
a throughput/load test. Clean acceptance still requires the revised CI run.

The combined local Listening/Mission/Reading run completed with all 20 cases
passing after this pacing change (`test-results/.last-run.json`: passed, no
failed tests, written 2026-10-11 16:33:20 UTC). Typecheck and diff checks passed.
The final console duration was unavailable after the terminal session expired;
no duration is asserted. The complete CI suite remains the merge gate.

Review follow-up on 2026-10-12 found a receipt-loading recovery gap: after
progression reported a cleared chapter, a failed receipt GET left no in-app retry
and displayed the saved-dialogue message before receipt data was available.
The completion panel now distinguishes loading, unavailable, legacy and loaded
dialogue, with a retry for the unavailable receipt. Its regression injects a
receipt 503 after a real completion and checks restored original messages,
unchanged XP and no second completion request. Verification is pending below.

Final acceptance on 2026-10-12 (Asia/Bangkok): build/typecheck passed all 58
routes after the receipt fix. The new focused browser case passed once (2.1m,
including the two rate-window waits), without retry. Independent code review
found no further blocker in the receipt transaction, ownership, migration or
CORS changes; documented rubric and gate/rank limitations remain.

[CI 133](https://github.com/Loccao102/LocCaoEnglish/actions/runs/38184889862)
passed all six jobs on head `047e7a5`: frontend/build/game/assets, backend
PostgreSQL/race/vet, AI service, compose, integration and E2E. Job
`114605150718` reports **121 passed (19.2m)**, with no failed/flaky cases under
`failOnFlakyTests`. The PR head matched at merge; no GitHub review submissions
or unresolved review threads were present. PR #15 merged to main `2abbc36`.

The acceptance follow-up changes docs only, records the IELTS audit and marks
only the guided mission slice done. Local documentation checks found 87 valid
file links after that follow-up; `git diff --check` passed. No production deployment. Full CORE-004,
semantic/acoustic assessment and broader reward/rank integrity remain open.

## CORE-004 — IELTS Academic Reading evidence (2026-10-14)

Branch `codex/core004-ielts-reading`, based on main `973b6fc`. Reading now
issues the original three passages/40 questions from a server catalog and grades
actual opaque selections through shared attempts. Atomic result/history receipts
are evidence-only: no XP, confidence, level, daily reward, review or legacy
learning-attempt write. Migration 018 is additive. History is account-only,
preserves unverified old rows and distinguishes Listening's client reports.
The dashboard no longer invents an overall band or a default chosen target.
Contract and rollout details are in [ADR 006](decisions/006-ielts-reading-evidence.md).

Local verification:

- `go test ./...` and `go vet ./...`: passed in memory mode. Focused cases cover
  all 40 questions, strict selection parsing, no pre-grade key, owner/version/
  expiry, immutable retry, concurrency, snapshot/result aliases and zero reward
  side effects. PostgreSQL variants also cover atomic rollback and migration replay.
- `npm run build`: passed, 58 routes, including TypeScript. Existing workspace-root
  warnings remain; no dependency or build configuration was changed.
- The initial eight Reading browser/API cases passed; the terminal session expired
  so no duration is asserted. Four mobile captures were saved and visually reviewed:
  390×551/844 question controls and feedback use readable text and touch targets.
  Added camp nullable-band/history sign-out assertions and a Listening regression
  still require the final run below.

Review on 2026-10-15 found the legacy audio helper resolved when playback started,
so the rewritten Listening screen could incorrectly say the recording finished.
It now reuses the completion-aware player, aborts on hide/unmount, and unlocks
retry on playback failure. A further review found that player's 90-second budget
was too short for a full IELTS passage. This caller now allows up to five minutes;
the shared default stays unchanged. The browser regression advances 91 seconds
before ending a held Part 4 recording. Provider/voice events are simulated;
this does not validate real voice quality or produce server listening evidence.

The first expanded nine-case run passed all eight Reading cases but failed a
new Listening assertion that searched the complete HTML for the transcript.
Listening still intentionally ships its client catalog in Next's serialized
props. The assertion now checks the rendered practice region, matching its
documented presentation-only script hiding; Reading's private-key/API checks
remain unchanged. Final verification is recorded below after rerun.

Final local run on 2026-10-15: `npx playwright test
tests/e2e/ielts-reading.spec.ts --reporter=line` passed **9/9 (2.2m)** with
no retries, against the production build at port 3102 and memory API at 8080.
This includes camp's empty overall state, history sign-out, all eight Reading
scenarios, and Listening failure/hide/retry/actual completion beyond 90 seconds
plus a failed, uncommitted tally retry. Both Reading and Listening mobile
captures were visually inspected at 390×551 and 390×844. Final build/typecheck
passed 58 routes. Documentation checks found 117 valid file links and
`git diff --check` passed. CI acceptance remains pending below.

The local Docker daemon is unavailable and `TEST_DATABASE_URL` is absent, so
local runs do not establish durable PostgreSQL behavior. The CI PostgreSQL/race
job, full browser suite and remaining required jobs must pass on the PR head
before merge. No production deployment. Listening answer receipts, acoustic/
Writing persistence and calibrated overall assessment remain outside this slice.

CI 137 (`38744774983`, head `6f30ac3`) passed frontend, backend PostgreSQL/race/
vet, AI service, compose and integration. E2E was rejected: **129 passed, one
failed (16.0m)**. All nine IELTS cases passed; the existing Listen & Pick account
case failed while waiting for the answer buttons to unlock after audio playback.
Artifact `11980256759` shows `rate limit exceeded` and `Retry audio request` in
the original failure screenshot. The retry trace confirms `/v1/me` and `/v1/fair`
returned **429, Retry-After: 60**, before any attempt could be created. This
confirms shared source-IP budget saturation after the contract/recovery suites.

On 2026-10-16, the Listening browser suite adopts the existing mission/IELTS
boundary pacing: wait one complete 60-second limiter window before and after
the suite. Production limits, assertions and strict flaky-test rejection stay
unchanged. No reload workaround, extra assertion retry, database or bucket reset
is added. Focused combined verification and clean CI on the revised head are
still required below before merge.

The combined local run of `learning-contracts.spec.ts`, `learning-recovery.spec.ts`
and `listening.spec.ts` passed **27/27 (2.4m)** without retries against the same
production frontend/memory API. This reproduces the neighboring suite order and
retains account isolation, lost-response, playback completion and mobile checks.
The only code delta after `6f30ac3` is browser-suite pacing; app runtime is
unchanged. Documentation checks still find 117 valid links; diff check passes.

Final acceptance on 2026-10-16 (Asia/Bangkok):
[CI 138](https://github.com/Loccao102/LocCaoEnglish/actions/runs/38789544231)
passed all six jobs on head `60ae09f`: frontend, backend, AI service, compose,
integration and E2E. The frontend job passed 50 game logic cases, asset checks
(45 GLBs/24 companions and 41 unique assets) and the 58-route production build/
TypeScript. Backend ran `go test -race ./...` and `go vet ./...` with the dedicated
PostgreSQL `loccao_system_test` database. E2E job `116610689994` reports
**130 passed (23.6m)**, with no failed/flaky cases or retries under the strict
`failOnFlakyTests` gate. This includes the previously failing Listening account case.

PR head/base matched the tested revisions before merge; there were no submitted
GitHub reviews or unresolved review threads. [PR #17](https://github.com/Loccao102/LocCaoEnglish/pull/17)
merged to main `6e1a7e5`. The follow-up changes documentation only: marks this
Reading slice done, preserves the earlier failure evidence and defines the next
Listening slice as planned. Full CORE-004 remains in progress. Listening answer
receipts, persistent acoustic/Writing feedback and calibrated overall evidence
remain outside this acceptance. No production deployment.

Documentation-only follow-up validation: 117 internal file links resolve and
`git diff --check` passes. No app rebuild is needed for these three documentation files.

## CORE-004 — IELTS Listening selections and part playback (2026-10-16)

Branch `codex/core004-ielts-listening`, base main `372bb9a`. This replaces the
remaining client-tally paper with signed server-issued Listening attempts and
reuses Reading's ordered selections, grader, exact retries and atomic receipts.
The original catalog now lives on the backend. Active prompts omit transcripts
and keys; browser speech fallback explicitly receives text as assistance.
Four part-specific completed playback reports are required to save. The result
freezes the events, original selections, wrong/blank verdicts and transcripts,
without XP, confidence, review or daily-claim writes. See ADR 007 and API.md.

Local verification before PR, on the implementation working tree:

- `npx tsc --noEmit`, production `npm run build`: passed, 58 routes.
- `go test ./...`, `go vet ./...`: passed in memory mode. Expanded HTTP fixtures
  use separate source IPs to avoid consuming neighboring fixtures' default
  httptest limiter budget; production limits are unchanged.
- Store coverage now runs both Reading/Listening invariants, plus Listening
  requested/failed/completed gating, request part/rate identity, concurrent final
  playback/submit, frozen receipts, 128-event boundary and old client-reported
  history preservation. PostgreSQL/race execution remains a CI requirement:
  local Docker daemon is unavailable; no user database was reset or used.
- `npm run test:game`: 50 passed. Asset checks: 41 unique assets, 45 GLBs and
  24 animated companions. Assets and game rules are unchanged.
- First Listening browser run: 6 passed (2.2m), real local API/memory store and
  production build. Only browser media events are simulated. Covers all 40
  selections, audio failure/hide/long completion, exact audio/answer recovery,
  storage failures, account switch and mobile keyboard controls. The additional
  late audio-preparation response case and shared Reading/Dictation/Listen & Pick
  regression are pending final verification, together with full CI.
- Viewed `.cache/ielts-listening-551.png` and
  `.cache/ielts-listening-feedback-844.png`: readable 18px choices, large controls,
  result provenance and no horizontal overflow at 390px. Both viewport heights
  are covered by browser assertions; artifacts stay ignored locally.
- No Listening catalog identifiers were found in the built static client chunks.
  Documentation check: 121 internal links resolve. No new database migration:
  migration 018 and the additive JSON snapshot/receipt remain authoritative.

The old Listening tally/audio browser case is replaced by the new paper cases,
retaining its failure, hide, long-playback, choice retention and mobile checks.
Old tally endpoints now reject writes, while existing client-reported history
keeps its provenance. No tests are skipped and `failOnFlakyTests` is unchanged.
Full CI, final review and merge are pending; this slice is not yet accepted.
No production deployment or four-skill overall claim.

CI follow-up, 2026-10-17: [CI 141](https://github.com/Loccao102/LocCaoEnglish/actions/runs/38832536352)
on `52c9b30` passed frontend, backend (dedicated PostgreSQL/race/vet), AI service,
compose and integration. Browser job `116754581460` reported **135 passed and
1 flaky (20.0m)**, so the strict gate correctly failed. All seven new Listening
cases passed, including the late audio-preparation response account boundary.
The unrelated Tea Time short-screen case missed the first Tea ingredient and
left Start steeping disabled; its retry passed. Failure artifact `12018622133`
shows the recipe requesting Tea → Honey → Mint but feedback only Honey → Mint.

The Tea test previously sampled a button's bounds and clicked raw coordinates
while opening the recipe could move the responsive playfield. Replace that
helper with Playwright's normal locator click, which checks stability and hit
target, and assert the exact accumulated ingredients after every selection.
This retains real pointer input, frozen game-clock timing, three-customer scoring,
pause/reload/oversteep/save and mobile geometry checks. No forced click, engine
shortcut, retry loop or relaxed assertion. Runtime rules are unchanged.
Local baseline ran 10 short-screen repetitions successfully (1.2m), confirming
the failure is intermittent; the revised full Tea file passed 2/2 (9.5s).
Further repeated validation and a fresh complete CI run are pending acceptance.

Final acceptance on 2026-10-18 (Asia/Bangkok):
[CI 142](https://github.com/Loccao102/LocCaoEnglish/actions/runs/39027387520)
passed all six jobs on final PR head `411163bad7b565ba678fe7e912153f02759a63f6`:
backend, frontend, AI service, compose, integration and E2E. Backend job
`117380950951` ran `go test -race ./...` and `go vet ./...` against dedicated
PostgreSQL `loccao_system_test`. Frontend passed 50 game logic cases, 41 unique
assets, 45 GLBs/24 companions and the 58-route production build/TypeScript.
E2E job `117381111046` reports **136 passed (22.2m)** without failed/flaky cases
or retries under the unchanged strict gate. Failure artifact upload was skipped.
This includes all seven new Listening cases and the previously flaky Tea case.

Local final-head verification also passed Reading/Listening/Listen & Pick/Dictation
**27/27 (6.7m)** and the revised Tea suite **20/20 repetitions (1.9m)**, both with
no retries. New mobile captures `.cache/ielts-listening-844.png` and
`.cache/ielts-listening-feedback-551.png` were visually reviewed alongside the
earlier complementary viewports: readable choices/results, large controls, no
horizontal overflow. Media events remain simulated; these tests do not establish
real voice quality or unaided listening. Local API uses memory; durable/race
evidence comes from CI's dedicated PostgreSQL database, never user data.

Before merge, the PR still matched tested head `411163b` and base `372bb9a`;
submitted reviews and inline review threads were empty. The expected-head guarded
squash merge of [PR #18](https://github.com/Loccao102/LocCaoEnglish/pull/18)
created main `b7b0333e79c0bb7d6f7c984506f5fe1096e87493`. This acceptance follow-up
changes documentation only: marks Listening done, preserves CI 141 failure
evidence and specifies the next Writing receipt slice as planned. Full CORE-004
remains in progress; acoustic/Writing receipts, deeper semantic dialogue grading
and calibrated overall evidence are not claimed complete. No production deployment.

Documentation-only follow-up validation: all 125 internal file links resolve and
`git diff --check` passes. No app rebuild is needed for these three documentation files.

## CORE-004 — Writing drafts and feedback receipts (2026-10-21)

Branch `codex/core004-writing-receipts`, base main `18509ac`. The active
`/ielts/writing` route still imports WritingLab; it now uses `useWritingSession`
and dedicated versioned essay attempts instead of browser-only state and raw AI
proxy scores. See [ADR 008](decisions/008-writing-receipts.md) and [API](API.md).

Account drafts sync through explicit Save draft. An owner-scoped browser copy
retains unsent edits and exact pending requests. Submission freezes the essay;
editing creates a child revision. Row-locked evaluation generations/90-second
leases prevent concurrent claims, fence dead workers and preserve exact retries.
Provider calls occur outside the transaction, with no automatic provider retry.
Completed feedback and the essay commit in one row; IELTS history derives its
provider-estimate entry from that receipt. It grants no learning rewards.

Both AI and Go require four finite half-step criteria (including valid zero),
overall consistent with the criteria, exact essay quotations, bounded advice and
service-owned method/provider/model versions. Browser/service word-count band
fallbacks were removed. Missing/failed/malformed provider feedback retains a saved
failed submission, with no score added to history. No live model calibration is
claimed. All provider success/timeout/malformed cases use deterministic fixtures.

Local working-tree checks:

- `go test ./...`, `go vet ./...`: passed in memory mode. Store tests cover owner,
  exact create/save/submit retry, draft conflicts, long essays, concurrent claims,
  expired leases/stale generations, failure/retry, original revisions, immutable
  receipt aliases, valid zero history and zero XP/confidence/review effects.
  PostgreSQL variants use two independent connections and migration 019 replay;
  those require CI because the local Docker daemon is unavailable. No user DB used.
- AI compile and `python -m unittest discover -s tests -v`: **18 passed**.
  Six Writing tests replace the old heuristic-shape test with actual contract,
  unavailable-provider, timeout, oversized/malformed response, invented quotation,
  provider metadata and finite/zero-band validation. HTTP provider calls are mocked.
- `npm run build`: passed, 58 routes with TypeScript. Game checks: **50 passed**;
  assets: 41 unique assets/23 hashes, 45 GLBs and 24 animated companions.
- `node scripts/verify-writing-api.mjs`: passed against the real local API/memory
  store, including signed-only access, legacy rejection, exact retry, saved failed
  essay and empty result history. Integration CI now runs this replacement for
  the obsolete anonymous heuristic-band smoke check; no checks are skipped.
- The first ten Writing browser cases passed **10/10 (2.3m)**. The final combined
  Reading/Listening/Writing run additionally covers generation identity, lost
  start response, deep links and unsaved text when another tab submits; pending.

The browser tests exercise real account/API storage and failed-provider recovery;
mobile feedback rendering uses an explicitly labeled response fixture. Full Go
HTTP tests separately exercise successful provider feedback through the real
handler/store. This does not establish live provider quality. Migration 019 and
API must deploy before frontend; rollback retains schema, handlers and receipts.
Final review, clean six-job CI and merge are pending. No production deployment.

Additional local protocol verification: a separate memory API at 8082 called the
real Python AI service at 8092, which used a local synthetic LLM HTTP fixture.
Real browser input saved/submitted the essay, received validated 6.0 feedback,
loaded one provider-estimate history entry, reloaded the receipt and created a
child revision. Resending generation zero returned the identical saved result;
the upstream fixture recorded exactly one call. This verifies the complete
browser → Go → Python → provider protocol → receipt path without contacting or
billing a live model. Temporary fixture services were stopped afterward.
Rendered `.cache/writing-stack-feedback-551.png` and `-844.png` were viewed:
18px essay/feedback text, large actions, readable quotations and no horizontal
overflow at 390px. Final browser regression remains separately required.

Final acceptance on 2026-10-21 (Asia/Bangkok):
[CI 145](https://github.com/Loccao102/LocCaoEnglish/actions/runs/39488459649)
passed all six jobs on final PR head `ceb477fdbee1506ed7aa264c0ae1dd07be91df6e`:
backend, frontend, AI service, compose, integration and E2E. Backend job
`118854939165` ran `go test -race ./...` and `go vet ./...` with dedicated
PostgreSQL `loccao_system_test`; Writing migration replay, two-connection
concurrent create/claim, stale generations and immutable history checks passed.
Integration passed the new account/draft/failed-provider recovery script through
the Docker API/AI/PostgreSQL stack. Frontend passed 50 game cases, both asset
verifiers and the 58-route build/TypeScript; AI passed all 18 tests.
E2E job `118855428439` reports **149 passed (22.9m)**, no failed/flaky cases or
test retries under the strict gate. No tests or assertions were relaxed.

Final-head local build/typecheck passed 58 routes; Writing passed **13/13 (2.3m)**
with no retries (`.cache/writing-head-e2e.log`). This includes correction after a
definite validation rejection, loss before/after save and submit, lost create,
account changes, another tab submitting, corrupt/blocked storage and mobile.
The earlier combined Reading/Listening/Writing run passed **27/27 (6.7m)** before
the final validation-rejection refinement; full CI verifies all three on the
final head. The final four draft/feedback captures at 390×551 and 390×844 were
viewed: 18px text, large controls, clear source/quotes and no horizontal overflow.

PR head and main base `18509ac` were unchanged before merge; submitted reviews
and inline review threads were empty. Expected-head guarded squash merge of
[PR #19](https://github.com/Loccao102/LocCaoEnglish/pull/19) created main
`40794e623aaa2c0cf994dc56ae83f5ee0e85dabd`. Local main's tree exactly matched
tested head `ceb477f` before the acceptance documentation follow-up.
This follow-up changes docs only: marks the Writing slice done and defines the
next Speaking acoustic receipt scope as planned. Full CORE-004 remains in
progress; live model calibration, persistent acoustic evidence, deeper semantic
mission grading and calibrated four-skill overall are not claimed complete.
No production deployment. Provider configuration remains required for real
Writing feedback; saved essays survive unavailable/invalid provider results.

Documentation-only acceptance validation: all 143 internal file links resolve
and `git diff --check` passes. No app rebuild is required for these three docs.
