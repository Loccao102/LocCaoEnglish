# Performance measurements

Roadmap: PERF-001/PERF-002. New source acceptance is pending GitHub Actions;
no local app, test, build, benchmark or service is run for this work.

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
flaky timing threshold. Recorded results will be added after CI completes.

ListCourses has a similar loop and is a separate follow-up. Pagination, query
indexes, payload size and client rendering need their own measured scopes;
this change does not claim the entire application is optimized.

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
The combined source must pass CI after integration with newer main/Fair changes;
an older standalone branch's checks are not a substitute.

## Visual verification found during recovery review

Fair recovery's first phone captures were readable in layout but inherited the
dialog's muted paragraph color. Its scoped paragraph/list color now explicitly
uses the dark text color instead. New-head screenshots and focused/full CI
must verify the final style; the earlier 31 passing recovery checks do not
establish acceptance of this follow-up source.
