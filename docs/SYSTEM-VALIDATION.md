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

Runtime branch `codex/core003-dictation`; acceptance is pending full CI. The
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
  and a single review mutation. They await Linux CI with a dedicated test DB;
  local store verification used memory only.
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
