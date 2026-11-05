# Performance measurements

Roadmap: PERF-001/PERF-002/PERF-003. Measurements below identify their source
and scope; overall acceptance is recorded in [ADVANCED-ACCEPTANCE](ADVANCED-ACCEPTANCE.md).
No local app, test, build, benchmark or service is run for this work.

## Lesson catalog

The active path is `/learn` → LessonCatalog → GET `/v1/lessons` → ListLessons.
The previous PostgreSQL path fetched slugs, then called GetLesson per item,
repeating schema, metadata and exercise reads. With N returned lessons this is
`2 + 3N` database driver calls/round trips, including repeated DDL batches.
One Exec of the schema batch contains several SQL statements, so this metric
must not be described as a count of individual SQL statements.

The new path performs one existing schema batch and one LEFT JOIN read,
independent of N. A single read snapshot also keeps lesson metadata and exercises
from the same committed publication revision. Public requests filter published
lessons; teacher/admin requests retain draft visibility. Primary order remains
updated_at descending, with lesson ID as a deterministic tie break and exercise
position ascending. No-exercise lessons keep the legacy null exercises field;
all metadata/options remain in the same API shape. Memory behavior, personal
bookmarks, user ownership, rewards and saves are unchanged. No cache or schema
migration is introduced, so changes are visible to the next request.

PostgreSQL tests use only owned fixtures in `loccao_system_test`, count calls
through a test-only pq connector wrapper, compare legacy response fields, and
assert the fixed two-call budget at small/larger catalogs. Public/admin, empty
exercise lists, ordering, options, result isolation and concurrent committed
publication revisions are covered. No production query observer is added.

The CI backend job runs the same legacy and optimized implementations against
one isolated fixture corpus in `BenchmarkListLessonsPostgres`, reporting
`ns/op`, allocation cost and `db-calls/op`. The legacy implementation exists
only in `_test.go`; it cannot be called by the API binary. Timings include the
test counter and loopback PostgreSQL/container conditions. Report measured values
with the run/head and corpus, never as production p95, capacity or a universal
speedup. Benchmarks are evidence alongside the correctness/race checks, not a
flaky timing threshold.

Backend measurements on source `94998a8`,
[CI 225](https://github.com/Loccao102/LocCaoEnglish/actions/runs/41994506828),
used 26 published lessons (23 owned fixtures plus three seeds), loopback PostgreSQL,
the test counter and a 250ms minimum benchmark window:

| Path | Database calls/op | Time/op | Bytes/op | Allocations/op |
| --- | ---: | ---: | ---: | ---: |
| Legacy test baseline | 80 | 14.312 ms | 185451 | 3178 |
| Joined catalog | 2 | 0.672 ms | 101284 | 2373 |

CI 225 passed all six jobs, including PostgreSQL/race/vet and 256 E2E cases
(40.7m); PR 49 merged that source as `ff7ef88`. These measurements apply to that
run, not production percentiles or a universal speed guarantee. Later source
changes require their own checks; no local benchmark was executed.

The course catalog follow-up replaces ListCourses' `1 + 2N` reads and the found
GetCourse lookup's two reads with one LEFT JOIN snapshot each. Published course
and lesson filters remain separate so a course with no visible lessons is still
returned with `Lessons: []`. Nil lookup means list, while a lookup for empty slug
still returns not found. Metadata, authored lesson position, enrollment/progress,
owner, bookmarks and memory behavior remain unchanged. There is no cache/schema
change; publication edits are visible to the next request.

Course PostgreSQL regressions reuse the test-only counter for small/larger
catalogs, compare the genuine legacy response, check draft/hidden/empty cases,
republishing and concurrent course/lesson revisions. A separate CI-only benchmark
compares both paths on the same fixture. On source `82871ea`,
[CI 229](https://github.com/Loccao102/LocCaoEnglish/actions/runs/42002431910)
measured 24 published courses (23 owned fixtures plus one seed):

| Course list path | Database calls/op | Time/op | Bytes/op | Allocations/op |
| --- | ---: | ---: | ---: | ---: |
| Legacy test baseline | 49 | 23.791 ms | 85717 | 1875 |
| Joined catalog | 1 | 0.858 ms | 47592 | 1143 |

The same run measured the 26-lesson corpus again:

| Lesson list path | Database calls/op | Time/op | Bytes/op | Allocations/op |
| --- | ---: | ---: | ---: | ---: |
| Legacy test baseline | 80 | 27.459 ms | 185436 | 3178 |
| Joined catalog | 2 | 1.127 ms | 101276 | 2373 |

Both benchmarks use the same isolated PostgreSQL/counter conditions and a 250ms
minimum window; the backend's race/vet/correctness and benchmark steps passed.
Variation from CI 225 illustrates why fixture timings are not a production
latency claim. Pagination, query indexes and payload size need their own measured
scopes; this does not claim the entire application is optimized.

## Outbound AI connections

[PR #47](https://github.com/Loccao102/LocCaoEnglish/pull/47), source `29a126b`,
adds one HTTPX client per FastAPI worker lifespan for LLM JSON coaching and Azure
neural TTS. Limits are 40 connections and 12 idle keepalive connections, with
shutdown cleanup. Existing 35-second LLM and 25-second TTS timeouts, provider
failure/browser fallback and API shape remain. Direct standalone synthesis can
still use a temporary client. There is no prompt/result cache or new secret.

MockTransport tests verify reuse, request content, fallback and lifecycle cleanup;
they do not contact a real provider or prove provider throughput/network latency.
Writing/acoustic integrations using separate clients are outside this slice.
The actual server imports the same main FastAPI app, so its lifespan is active.
The combined source `94998a8` passed all six CI 225 jobs/256 E2E cases and merged
through PR 49; acceptance did not rely on the older standalone branch's checks.

## Repeated label layout

PERF-003 targets FestivalArena's actual updateView loop. It previously recreated
and sorted collision-layout candidates and assigned label DOM attributes every
animation frame, even when the projection/input had not changed. The new key
contains viewport/camera framing/zoom, moving target coordinates, followed hero
position, object visibility and the selection/round/input state. Identical inputs
skip only label layout/DOM writes. Resize/rebuild's metrics-dirty flag still
forces a fresh measurement; graphics rendering, animation, physics and session
timing continue unchanged. Nothing in the renderer grants a reward.

Browser tests use MutationObserver on the real label layer to count attribute
writes over explicit 250ms samples for paused and running stationary scenes,
verify invalidation after resize/selection, and require moving targets to keep
updating. CI retains JSON samples. This metric describes redundant DOM work;
it does not establish FPS, GPU utilization, battery savings or device-wide
latency. Source `82871ea` passed all 38 focused checks in
[run 14](https://github.com/Loccao102/LocCaoEnglish/actions/runs/42002431903) (2.0m).
Both Adventure/Challenge 250ms samples recorded pausedWrites=0 and runningWrites=0;
live countdown, selection, resize and moving-box checks also passed. The complete
source passed all six CI 229 jobs/263 E2E cases (46.1m), merged through PR 51 as
`59cf031`. All four final Bridge 390×551/844 images for
Adventure/Challenge were inspected and show the 3D board, bank labels, HUD and
reachable controls. Evidence capture explicitly waits for rendering/composition
after reload; the earlier blank WebGL capture is not accepted as visual proof.

## Visual verification found during recovery review

Fair recovery's first phone captures were readable in layout but inherited the
dialog's muted paragraph color. Its scoped paragraph/list color now explicitly
uses the dark text color instead. Source `94998a8` passed 31 focused checks
(47.9s) and the full six-job CI 225/256 E2E gate. Both final phone captures were
inspected with the dark text; the earlier muted-color captures alone were not
accepted as proof of that follow-up source.
