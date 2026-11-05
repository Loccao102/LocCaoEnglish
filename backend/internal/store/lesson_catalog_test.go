package store

import (
	"context"
	"database/sql"
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"net/url"
	"os"
	"reflect"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/Loccao102/LocCaoEnglish/backend/internal/model"
	"github.com/lib/pq"
)

type lessonCatalogQueryCounter struct{ count atomic.Int64 }

func (c *lessonCatalogQueryCounter) reset()       { c.count.Store(0) }
func (c *lessonCatalogQueryCounter) value() int64 { return c.count.Load() }

type lessonCatalogCountingConnector struct {
	driver.Connector
	counter *lessonCatalogQueryCounter
}

func (c lessonCatalogCountingConnector) Connect(ctx context.Context) (driver.Conn, error) {
	conn, err := c.Connector.Connect(ctx)
	if err != nil {
		return nil, err
	}
	return &lessonCatalogCountingConn{Conn: conn, counter: c.counter}, nil
}

type lessonCatalogCountingConn struct {
	driver.Conn
	counter *lessonCatalogQueryCounter
}

func (c *lessonCatalogCountingConn) ExecContext(ctx context.Context, query string, args []driver.NamedValue) (driver.Result, error) {
	c.counter.count.Add(1)
	execer, ok := c.Conn.(driver.ExecerContext)
	if !ok {
		return nil, fmt.Errorf("postgres connection does not support ExecContext")
	}
	return execer.ExecContext(ctx, query, args)
}

func (c *lessonCatalogCountingConn) QueryContext(ctx context.Context, query string, args []driver.NamedValue) (driver.Rows, error) {
	c.counter.count.Add(1)
	queryer, ok := c.Conn.(driver.QueryerContext)
	if !ok {
		return nil, fmt.Errorf("postgres connection does not support QueryContext")
	}
	return queryer.QueryContext(ctx, query, args)
}

type lessonCatalogFixture struct {
	lesson model.Lesson
}

func requireLessonCatalogDatabase(t testing.TB) string {
	t.Helper()
	databaseURL := os.Getenv("TEST_DATABASE_URL")
	if databaseURL == "" {
		t.Skip("lesson catalog PostgreSQL evidence requires TEST_DATABASE_URL")
	}
	parsed, err := url.Parse(databaseURL)
	if err != nil || (parsed.Scheme != "postgres" && parsed.Scheme != "postgresql") || parsed.Path != "/loccao_system_test" {
		t.Fatalf("use the dedicated loccao_system_test database")
	}
	return databaseURL
}

func openLessonCatalogStore(t testing.TB, databaseURL string, counted bool, count *lessonCatalogQueryCounter) *Store {
	t.Helper()
	bootstrap, err := New(databaseURL)
	if err != nil {
		t.Fatal(err)
	}
	if err := bootstrap.EnsureContent(context.Background()); err != nil {
		bootstrap.Close()
		t.Fatal(err)
	}
	bootstrap.Close()

	postgresConnector, err := pq.NewConnector(databaseURL)
	if err != nil {
		t.Fatal(err)
	}
	var connector driver.Connector = postgresConnector
	if counted {
		connector = lessonCatalogCountingConnector{Connector: connector, counter: count}
	}
	db := sql.OpenDB(connector)
	st := &Store{db: db}
	t.Cleanup(func() { st.Close() })
	return st
}

func addLessonCatalogFixtures(t testing.TB, st *Store, count int) []lessonCatalogFixture {
	t.Helper()
	ctx := context.Background()
	tag := newID()
	fixtures := make([]lessonCatalogFixture, 0, count)
	base := time.Now().UTC().Truncate(time.Microsecond).Add(time.Duration(count+1) * time.Minute)
	for i := 0; i < count; i++ {
		id := newID()
		slug := fmt.Sprintf("perf001-%s-%02d", tag, i)
		status := "published"
		if i == count-1 {
			status = "draft"
		}
		lesson := model.Lesson{
			ID: id, Slug: slug, Title: fmt.Sprintf("PERF-001 lesson %02d", i),
			Description: fmt.Sprintf("owned PERF-001 fixture %02d", i), Level: "B1",
			Skill: "Vocabulary", Topic: "PERF-001", Status: status,
			EstimatedMins: 7 + i, CreatedAt: base.Add(-time.Duration(i) * time.Second),
			UpdatedAt: base.Add(-time.Duration(i) * time.Second),
		}
		if _, err := st.db.ExecContext(ctx, `INSERT INTO lessons(id,slug,title,description,level,skill,topic,status,estimated_mins,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10)`, lesson.ID, lesson.Slug, lesson.Title, lesson.Description, lesson.Level, lesson.Skill, lesson.Topic, lesson.Status, lesson.EstimatedMins, lesson.UpdatedAt); err != nil {
			t.Fatal(err)
		}
		t.Cleanup(func() {
			if _, err := st.db.ExecContext(ctx, `DELETE FROM lessons WHERE id=$1`, id); err != nil {
				t.Errorf("cleanup PERF-001 lesson %s: %v", id, err)
			}
		})
		if i%5 != 0 {
			for position := 1; position >= 0; position-- {
				options, _ := json.Marshal([]string{fmt.Sprintf("fixture-%d-a", i), fmt.Sprintf("fixture-%d-b", i)})
				exerciseID := newID()
				if _, err := st.db.ExecContext(ctx, `INSERT INTO lesson_exercises(id,lesson_id,kind,prompt,answer,options,explanation,position,xp) VALUES($1,$2,'choice',$3,$4,$5,$6,$7,$8)`, exerciseID, lesson.ID, fmt.Sprintf("PERF-001 prompt %d/%d", i, position), fmt.Sprintf("PERF-001 answer %d/%d", i, position), options, "PERF-001 explanation", position, 10+position); err != nil {
					t.Fatal(err)
				}
				lesson.Exercises = append(lesson.Exercises, model.LessonExercise{ID: exerciseID, Kind: "choice", Prompt: fmt.Sprintf("PERF-001 prompt %d/%d", i, position), Answer: fmt.Sprintf("PERF-001 answer %d/%d", i, position), Options: []string{fmt.Sprintf("fixture-%d-a", i), fmt.Sprintf("fixture-%d-b", i)}, Explanation: "PERF-001 explanation", Position: position, XP: 10 + position})
			}
			// The insert order above is intentionally reverse-position; the catalog
			// query must still return exercises in position order.
			reverseLessonExercises(lesson.Exercises)
		}
		fixtures = append(fixtures, lessonCatalogFixture{lesson: lesson})
	}
	return fixtures
}

func reverseLessonExercises(exercises []model.LessonExercise) {
	for left, right := 0, len(exercises)-1; left < right; left, right = left+1, right-1 {
		exercises[left], exercises[right] = exercises[right], exercises[left]
	}
}

func fixtureLessons(t *testing.T, got []model.Lesson, fixtures []lessonCatalogFixture, includeDraft bool) []model.Lesson {
	t.Helper()
	expected := make([]model.Lesson, 0, len(fixtures))
	for _, fixture := range fixtures {
		if includeDraft || fixture.lesson.Status == "published" {
			expected = append(expected, fixture.lesson)
		}
	}
	gotFixtures := make([]model.Lesson, 0, len(expected))
	for _, lesson := range got {
		if strings.HasPrefix(lesson.Slug, "perf001-") {
			gotFixtures = append(gotFixtures, lesson)
		}
	}
	seen := make(map[string]bool, len(gotFixtures))
	for _, lesson := range gotFixtures {
		if seen[lesson.Slug] {
			t.Fatalf("duplicate PERF-001 lesson %q", lesson.Slug)
		}
		seen[lesson.Slug] = true
	}
	for _, want := range expected {
		if !seen[want.Slug] {
			t.Fatalf("missing PERF-001 lesson %q", want.Slug)
		}
	}
	if len(gotFixtures) != len(expected) {
		t.Fatalf("fixture count mismatch: got %d want %d", len(gotFixtures), len(expected))
	}
	return gotFixtures
}

func assertLessonCatalogFixtures(t *testing.T, got []model.Lesson, fixtures []lessonCatalogFixture, includeDraft bool) {
	t.Helper()
	want := make([]model.Lesson, 0, len(fixtures))
	for _, fixture := range fixtures {
		if includeDraft || fixture.lesson.Status == "published" {
			want = append(want, fixture.lesson)
		}
	}
	actual := fixtureLessons(t, got, fixtures, includeDraft)
	for i := range want {
		if actual[i].Slug != want[i].Slug {
			t.Fatalf("lesson order[%d] = %q, want %q", i, actual[i].Slug, want[i].Slug)
		}
		if actual[i].ID != want[i].ID || actual[i].Title != want[i].Title || actual[i].Description != want[i].Description || actual[i].Level != want[i].Level || actual[i].Skill != want[i].Skill || actual[i].Topic != want[i].Topic || actual[i].Status != want[i].Status || actual[i].EstimatedMins != want[i].EstimatedMins || !actual[i].CreatedAt.Equal(want[i].CreatedAt) || !actual[i].UpdatedAt.Equal(want[i].UpdatedAt) {
			t.Fatalf("lesson metadata[%d] mismatch: got %+v want %+v", i, actual[i], want[i])
		}
		if len(actual[i].Exercises) != len(want[i].Exercises) {
			t.Fatalf("exercise count for %q = %d, want %d", actual[i].Slug, len(actual[i].Exercises), len(want[i].Exercises))
		}
		if want[i].Exercises == nil && actual[i].Exercises != nil {
			t.Fatal("empty exercises changed their legacy null shape")
		}
		for j := range want[i].Exercises {
			gotExercise, wantExercise := actual[i].Exercises[j], want[i].Exercises[j]
			if gotExercise.ID != wantExercise.ID || gotExercise.Kind != wantExercise.Kind || gotExercise.Prompt != wantExercise.Prompt || gotExercise.Answer != wantExercise.Answer || gotExercise.Explanation != wantExercise.Explanation || gotExercise.Position != wantExercise.Position || gotExercise.XP != wantExercise.XP || len(gotExercise.Options) != len(wantExercise.Options) || gotExercise.Options[0] != wantExercise.Options[0] || gotExercise.Options[1] != wantExercise.Options[1] {
				t.Fatalf("exercise[%d] for %q mismatch: got %+v want %+v", j, actual[i].Slug, gotExercise, wantExercise)
			}
		}
	}
}

func TestListLessonsPostgresUsesConstantQueryBudget(t *testing.T) {
	databaseURL := requireLessonCatalogDatabase(t)
	for _, fixtureCount := range []int{3, 24} {
		t.Run(fmt.Sprintf("n=%d", fixtureCount), func(t *testing.T) {
			counter := &lessonCatalogQueryCounter{}
			st := openLessonCatalogStore(t, databaseURL, true, counter)
			fixtures := addLessonCatalogFixtures(t, st, fixtureCount)

			counter.reset()
			public, err := st.ListLessons(context.Background(), false)
			if err != nil {
				t.Fatal(err)
			}
			if got := counter.value(); got != 2 {
				t.Fatalf("public catalog used %d database statements, want schema + one joined read", got)
			}
			assertLessonCatalogFixtures(t, public, fixtures, false)
			counter.reset()
			legacy, err := legacyListLessonsForBenchmark(context.Background(), st, false)
			if err != nil {
				t.Fatal(err)
			}
			if got, want := counter.value(), int64(2+3*len(legacy)); got != want {
				t.Fatalf("legacy baseline used %d database calls, want %d", got, want)
			}
			byID := make(map[string]model.Lesson, len(legacy))
			for _, lesson := range legacy {
				byID[lesson.ID] = lesson
			}
			for _, lesson := range public {
				if !reflect.DeepEqual(lesson, byID[lesson.ID]) {
					t.Fatalf("optimized lesson differs from legacy response: %s", lesson.Slug)
				}
			}
			t.Logf("public catalog %d lessons: legacy %d database calls, optimized 2", len(public), 2+3*len(legacy))

			counter.reset()
			admin, err := st.ListLessons(context.Background(), true)
			if err != nil {
				t.Fatal(err)
			}
			if got := counter.value(); got != 2 {
				t.Fatalf("admin catalog used %d database statements, want schema + one joined read", got)
			}
			assertLessonCatalogFixtures(t, admin, fixtures, true)

			fixture := fixtureLessons(t, public, fixtures, false)[1]
			fixture.Title = "caller mutation"
			if len(fixture.Exercises) > 0 {
				fixture.Exercises[0].Options[0] = "caller mutation"
			}
			counter.reset()
			reloaded, err := st.ListLessons(context.Background(), false)
			if err != nil {
				t.Fatal(err)
			}
			if got := counter.value(); got != 2 {
				t.Fatalf("reload used %d database statements, want schema + one joined read", got)
			}
			if reloadedFixture := fixtureLessons(t, reloaded, fixtures, false)[1]; reloadedFixture.Title == "caller mutation" || (len(reloadedFixture.Exercises) > 0 && reloadedFixture.Exercises[0].Options[0] == "caller mutation") {
				t.Fatal("catalog result aliases stored lesson or exercise data")
			}
		})
	}
}

func TestListLessonsPostgresConcurrentPublicationIsAtomic(t *testing.T) {
	databaseURL := requireLessonCatalogDatabase(t)
	st := openLessonCatalogStore(t, databaseURL, false, nil)
	ctx := context.Background()
	lessonID := newID()
	slug := "perf001-concurrent-" + newID()
	createdAt := time.Now().UTC().Truncate(time.Microsecond)
	if _, err := st.db.ExecContext(ctx, `INSERT INTO lessons(id,slug,title,description,level,skill,topic,status,estimated_mins,created_at,updated_at) VALUES($1,$2,'PERF-001 revision A','revision A description','B1','Vocabulary','PERF-001','published',9,$3,$3)`, lessonID, slug, createdAt); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if _, err := st.db.ExecContext(ctx, `DELETE FROM lessons WHERE id=$1`, lessonID); err != nil {
			t.Errorf("cleanup concurrent PERF-001 lesson: %v", err)
		}
	})
	exerciseID := newID()
	insertExercise := func(tx *sql.Tx, id, prompt, answer string) error {
		options, _ := json.Marshal([]string{"revision-a", "revision-b"})
		_, err := tx.ExecContext(ctx, `INSERT INTO lesson_exercises(id,lesson_id,kind,prompt,answer,options,explanation,position,xp) VALUES($1,$2,'choice',$3,$4,$5,'concurrent revision',0,12)`, id, lessonID, prompt, answer, options)
		return err
	}
	if err := func() error {
		tx, err := st.db.BeginTx(ctx, nil)
		if err != nil {
			return err
		}
		defer tx.Rollback()
		if err := insertExercise(tx, exerciseID, "PERF-001 prompt A", "PERF-001 answer A"); err != nil {
			return err
		}
		return tx.Commit()
	}(); err != nil {
		t.Fatal(err)
	}

	type revision struct {
		title, description, prompt, answer string
	}
	revisions := []revision{
		{title: "PERF-001 revision A", description: "revision A description", prompt: "PERF-001 prompt A", answer: "PERF-001 answer A"},
		{title: "PERF-001 revision B", description: "revision B description", prompt: "PERF-001 prompt B", answer: "PERF-001 answer B"},
	}
	writeRevision := func(next revision) error {
		tx, err := st.db.BeginTx(ctx, nil)
		if err != nil {
			return err
		}
		defer tx.Rollback()
		if _, err := tx.ExecContext(ctx, `UPDATE lessons SET status='draft' WHERE id=$1`, lessonID); err != nil {
			return err
		}
		if _, err := tx.ExecContext(ctx, `UPDATE lessons SET title=$1,description=$2,updated_at=NOW() WHERE id=$3`, next.title, next.description, lessonID); err != nil {
			return err
		}
		if _, err := tx.ExecContext(ctx, `DELETE FROM lesson_exercises WHERE lesson_id=$1`, lessonID); err != nil {
			return err
		}
		if err := insertExercise(tx, newID(), next.prompt, next.answer); err != nil {
			return err
		}
		if _, err := tx.ExecContext(ctx, `UPDATE lessons SET status='published',updated_at=NOW() WHERE id=$1`, lessonID); err != nil {
			return err
		}
		return tx.Commit()
	}

	readCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()
	start := make(chan struct{})
	errors := make(chan error, 8)
	var group sync.WaitGroup
	record := func(err error) {
		if err != nil {
			select {
			case errors <- err:
			default:
			}
		}
	}
	for worker := 0; worker < 3; worker++ {
		group.Add(1)
		go func() {
			defer group.Done()
			<-start
			for attempt := 0; attempt < 24; attempt++ {
				lessons, err := st.ListLessons(readCtx, false)
				if err != nil {
					record(err)
					return
				}
				var found *model.Lesson
				for i := range lessons {
					if lessons[i].Slug == slug {
						found = &lessons[i]
						break
					}
				}
				if found == nil {
					record(fmt.Errorf("concurrent catalog omitted published lesson %s", slug))
					return
				}
				if found.Status != "published" || len(found.Exercises) != 1 {
					record(fmt.Errorf("concurrent catalog returned incomplete lesson: status=%q exercises=%d", found.Status, len(found.Exercises)))
					return
				}
				if found.Title != revisions[0].title && found.Title != revisions[1].title {
					record(fmt.Errorf("concurrent catalog returned unknown title %q", found.Title))
					return
				}
				revisionIndex := 0
				if found.Title == revisions[1].title {
					revisionIndex = 1
				}
				if found.Description != revisions[revisionIndex].description || found.Exercises[0].Prompt != revisions[revisionIndex].prompt || found.Exercises[0].Answer != revisions[revisionIndex].answer {
					record(fmt.Errorf("concurrent catalog mixed lesson revision: title=%q description=%q prompt=%q answer=%q", found.Title, found.Description, found.Exercises[0].Prompt, found.Exercises[0].Answer))
					return
				}
			}
		}()
	}
	group.Add(1)
	go func() {
		defer group.Done()
		<-start
		for cycle := 0; cycle < 6; cycle++ {
			for _, next := range revisions[1:] {
				if err := writeRevision(next); err != nil {
					record(err)
					return
				}
			}
			if err := writeRevision(revisions[0]); err != nil {
				record(err)
				return
			}
		}
	}()
	close(start)
	group.Wait()
	close(errors)
	for err := range errors {
		t.Fatal(err)
	}
}

func legacyListLessonsForBenchmark(ctx context.Context, s *Store, includeDraft bool) ([]model.Lesson, error) {
	if err := s.ensureContentSchema(ctx); err != nil {
		return nil, err
	}
	query := `SELECT slug FROM lessons`
	if !includeDraft {
		query += ` WHERE status='published'`
	}
	query += ` ORDER BY updated_at DESC`
	rows, err := s.db.QueryContext(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var slugs []string
	for rows.Next() {
		var slug string
		if err := rows.Scan(&slug); err != nil {
			return nil, err
		}
		slugs = append(slugs, slug)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	out := make([]model.Lesson, 0, len(slugs))
	for _, slug := range slugs {
		lesson, err := s.GetLesson(ctx, slug, includeDraft)
		if err != nil {
			return nil, err
		}
		out = append(out, lesson)
	}
	return out, nil
}

func BenchmarkListLessonsPostgres(b *testing.B) {
	databaseURL := requireLessonCatalogDatabase(b)
	counter := &lessonCatalogQueryCounter{}
	st := openLessonCatalogStore(b, databaseURL, true, counter)
	fixtures := addLessonCatalogFixtures(b, st, 24)
	if _, err := st.ListLessons(context.Background(), false); err != nil {
		b.Fatal(err)
	}
	if len(fixtures) == 0 {
		b.Fatal("benchmark fixture was empty")
	}

	for _, benchmark := range []struct {
		name string
		list func(context.Context, *Store) ([]model.Lesson, error)
	}{
		{name: "legacy", list: func(ctx context.Context, store *Store) ([]model.Lesson, error) {
			return legacyListLessonsForBenchmark(ctx, store, false)
		}},
		{name: "optimized", list: func(ctx context.Context, store *Store) ([]model.Lesson, error) { return store.ListLessons(ctx, false) }},
	} {
		b.Run(benchmark.name, func(b *testing.B) {
			b.ReportAllocs()
			counter.reset()
			b.ResetTimer()
			for i := 0; i < b.N; i++ {
				if _, err := benchmark.list(context.Background(), st); err != nil {
					b.Fatal(err)
				}
			}
			b.StopTimer()
			b.ReportMetric(float64(counter.value())/float64(b.N), "db-calls/op")
		})
	}
}
