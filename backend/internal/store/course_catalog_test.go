package store

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"reflect"
	"sort"
	"sync"
	"testing"
	"time"

	"github.com/Loccao102/LocCaoEnglish/backend/internal/model"
)

type courseCatalogFixture struct {
	course  model.Course
	lessons []model.Lesson
}

func addCourseCatalogFixtures(t testing.TB, st *Store, count int) []courseCatalogFixture {
	t.Helper()
	ctx := context.Background()
	tag := newID()
	base := time.Now().UTC().Truncate(time.Microsecond).Add(time.Duration(count+2) * time.Minute)
	fixtures := make([]courseCatalogFixture, 0, count)
	for i := 0; i < count; i++ {
		status := "published"
		if i == count-1 {
			status = "draft"
		}
		course := model.Course{
			ID: newID(), Slug: fmt.Sprintf("perf001-course-%s-%02d", tag, i),
			Title: fmt.Sprintf("PERF-001 course %02d", i), Description: fmt.Sprintf("owned PERF-001 course %02d", i),
			Level: "B1", Status: status, Lessons: make([]model.CourseLesson, 0),
			CreatedAt: base.Add(-time.Duration(i) * time.Minute), UpdatedAt: base.Add(-time.Duration(i) * time.Minute),
		}
		if _, err := st.db.ExecContext(ctx, `INSERT INTO courses(id,slug,title,description,level,status,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`, course.ID, course.Slug, course.Title, course.Description, course.Level, course.Status, course.CreatedAt, course.UpdatedAt); err != nil {
			t.Fatal(err)
		}
		// Register cleanup immediately after each owned insert; lesson cleanup is
		// registered later and therefore runs before this course cleanup.
		t.Cleanup(func() {
			if _, err := st.db.ExecContext(ctx, `DELETE FROM courses WHERE id=$1`, course.ID); err != nil {
				t.Errorf("cleanup PERF-001 course %s: %v", course.Slug, err)
			}
		})

		var lessonStatuses []string
		switch i % 4 {
		case 1:
			lessonStatuses = []string{"published", "published"}
		case 2:
			lessonStatuses = []string{"draft"}
		case 3:
			lessonStatuses = []string{"published", "draft"}
		}
		fixture := courseCatalogFixture{course: course, lessons: make([]model.Lesson, 0, len(lessonStatuses))}
		for lessonIndex, lessonStatus := range lessonStatuses {
			lesson := model.Lesson{
				ID: newID(), Slug: fmt.Sprintf("perf001-lesson-%s-%02d-%02d", tag, i, lessonIndex),
				Title: fmt.Sprintf("PERF-001 lesson %02d/%02d", i, lessonIndex), Description: fmt.Sprintf("lesson description %02d/%02d", i, lessonIndex),
				Level: "B1", Skill: "Vocabulary", Topic: "PERF-001", Status: lessonStatus, EstimatedMins: 7 + lessonIndex,
				CreatedAt: course.CreatedAt.Add(-time.Duration(lessonIndex+1) * time.Second), UpdatedAt: course.UpdatedAt.Add(-time.Duration(lessonIndex+1) * time.Second),
			}
			if _, err := st.db.ExecContext(ctx, `INSERT INTO lessons(id,slug,title,description,level,skill,topic,status,estimated_mins,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`, lesson.ID, lesson.Slug, lesson.Title, lesson.Description, lesson.Level, lesson.Skill, lesson.Topic, lesson.Status, lesson.EstimatedMins, lesson.CreatedAt, lesson.UpdatedAt); err != nil {
				t.Fatal(err)
			}
			t.Cleanup(func() {
				if _, err := st.db.ExecContext(ctx, `DELETE FROM lessons WHERE id=$1`, lesson.ID); err != nil {
					t.Errorf("cleanup PERF-001 lesson %s: %v", lesson.Slug, err)
				}
			})

			position := len(lessonStatuses) - lessonIndex - 1
			if _, err := st.db.ExecContext(ctx, `INSERT INTO course_lessons(course_id,lesson_id,position) VALUES($1,$2,$3)`, course.ID, lesson.ID, position); err != nil {
				t.Fatal(err)
			}
			fixture.lessons = append(fixture.lessons, lesson)
			fixture.course.Lessons = append(fixture.course.Lessons, model.CourseLesson{Slug: lesson.Slug, Title: lesson.Title, Skill: lesson.Skill, Level: lesson.Level, Position: position, EstimatedMins: lesson.EstimatedMins})
		}
		fixtures = append(fixtures, fixture)
	}
	return fixtures
}

func expectedCourseCatalogFixture(fixture courseCatalogFixture) model.Course {
	want := fixture.course
	want.Lessons = make([]model.CourseLesson, 0, len(fixture.course.Lessons))
	bySlug := make(map[string]model.Lesson, len(fixture.lessons))
	for _, lesson := range fixture.lessons {
		bySlug[lesson.Slug] = lesson
	}
	for _, ref := range fixture.course.Lessons {
		lesson := bySlug[ref.Slug]
		if lesson.Status != "published" {
			continue
		}
		ref.Title, ref.Skill, ref.Level, ref.EstimatedMins = lesson.Title, lesson.Skill, lesson.Level, lesson.EstimatedMins
		want.Lessons = append(want.Lessons, ref)
	}
	sort.SliceStable(want.Lessons, func(i, j int) bool { return want.Lessons[i].Position < want.Lessons[j].Position })
	return want
}

func assertCourseCatalogFixtures(t testing.TB, got []model.Course, fixtures []courseCatalogFixture) {
	t.Helper()
	want := make([]model.Course, 0, len(fixtures))
	for _, fixture := range fixtures {
		if fixture.course.Status == "published" {
			want = append(want, expectedCourseCatalogFixture(fixture))
		}
	}
	actual := make([]model.Course, 0, len(want))
	for _, course := range got {
		if len(course.Slug) >= len("perf001-course-") && course.Slug[:len("perf001-course-")] == "perf001-course-" {
			actual = append(actual, course)
		}
	}
	if len(actual) != len(want) {
		t.Fatalf("owned course count = %d, want %d", len(actual), len(want))
	}
	for i := range want {
		gotCourse, wantCourse := actual[i], want[i]
		if gotCourse.ID != wantCourse.ID || gotCourse.Slug != wantCourse.Slug || gotCourse.Title != wantCourse.Title || gotCourse.Description != wantCourse.Description || gotCourse.Level != wantCourse.Level || gotCourse.Status != wantCourse.Status || !gotCourse.CreatedAt.Equal(wantCourse.CreatedAt) || !gotCourse.UpdatedAt.Equal(wantCourse.UpdatedAt) {
			t.Fatalf("course metadata[%d] mismatch: got %+v want %+v", i, gotCourse, wantCourse)
		}
		if len(gotCourse.Lessons) != len(wantCourse.Lessons) {
			t.Fatalf("course[%d] lesson count = %d, want %d", i, len(gotCourse.Lessons), len(wantCourse.Lessons))
		}
		for j := range wantCourse.Lessons {
			if gotCourse.Lessons[j] != wantCourse.Lessons[j] {
				t.Fatalf("course[%d] lesson[%d] mismatch: got %+v want %+v", i, j, gotCourse.Lessons[j], wantCourse.Lessons[j])
			}
		}
	}
}

func legacyGetCourseForCatalog(ctx context.Context, st *Store, slug string) (model.Course, error) {
	course := model.Course{Lessons: []model.CourseLesson{}}
	err := st.db.QueryRowContext(ctx, `SELECT id,slug,title,description,level,status,created_at,updated_at FROM courses WHERE slug=$1 AND status='published'`, slug).Scan(&course.ID, &course.Slug, &course.Title, &course.Description, &course.Level, &course.Status, &course.CreatedAt, &course.UpdatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return course, ErrNotFound
	}
	if err != nil {
		return course, err
	}
	rows, err := st.db.QueryContext(ctx, `SELECT l.slug,l.title,l.skill,l.level,cl.position,l.estimated_mins FROM course_lessons cl JOIN lessons l ON l.id=cl.lesson_id WHERE cl.course_id=$1 AND l.status='published' ORDER BY cl.position`, course.ID)
	if err != nil {
		return course, err
	}
	defer rows.Close()
	for rows.Next() {
		var lesson model.CourseLesson
		if err := rows.Scan(&lesson.Slug, &lesson.Title, &lesson.Skill, &lesson.Level, &lesson.Position, &lesson.EstimatedMins); err != nil {
			return course, err
		}
		course.Lessons = append(course.Lessons, lesson)
	}
	return course, rows.Err()
}

func legacyListCoursesForCatalog(ctx context.Context, st *Store) ([]model.Course, error) {
	rows, err := st.db.QueryContext(ctx, `SELECT slug FROM courses WHERE status='published' ORDER BY updated_at DESC`)
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
	out := make([]model.Course, 0, len(slugs))
	for _, slug := range slugs {
		course, err := legacyGetCourseForCatalog(ctx, st, slug)
		if err != nil {
			return nil, err
		}
		out = append(out, course)
	}
	return out, nil
}

func TestCourseCatalogPostgresUsesConstantQueryBudget(t *testing.T) {
	databaseURL := requireLessonCatalogDatabase(t)
	for _, fixtureCount := range []int{5, 24} {
		t.Run(fmt.Sprintf("n=%d", fixtureCount), func(t *testing.T) {
			counter := &lessonCatalogQueryCounter{}
			st := openLessonCatalogStore(t, databaseURL, true, counter)
			if err := st.EnsureCourses(context.Background()); err != nil {
				t.Fatal(err)
			}
			fixtures := addCourseCatalogFixtures(t, st, fixtureCount)
			ctx := context.Background()

			counter.reset()
			optimized, err := st.ListCourses(ctx)
			if err != nil {
				t.Fatal(err)
			}
			if got := counter.value(); got != 1 {
				t.Fatalf("optimized ListCourses used %d database statements, want 1 joined read", got)
			}
			assertCourseCatalogFixtures(t, optimized, fixtures)

			counter.reset()
			legacy, err := legacyListCoursesForCatalog(ctx, st)
			if err != nil {
				t.Fatal(err)
			}
			if got, want := counter.value(), int64(1+2*len(legacy)); got != want {
				t.Fatalf("legacy ListCourses used %d database statements, want %d", got, want)
			}
			if !reflect.DeepEqual(optimized, legacy) {
				t.Fatal("optimized course catalog differs from the legacy response")
			}

			published := fixtures[1]
			counter.reset()
			optimizedOne, err := st.GetCourse(ctx, published.course.Slug)
			if err != nil {
				t.Fatal(err)
			}
			if got := counter.value(); got != 1 {
				t.Fatalf("optimized GetCourse used %d database statements, want 1 joined read", got)
			}
			counter.reset()
			legacyOne, err := legacyGetCourseForCatalog(ctx, st, published.course.Slug)
			if err != nil {
				t.Fatal(err)
			}
			if got := counter.value(); got != 2 {
				t.Fatalf("legacy GetCourse used %d database statements, want 2", got)
			}
			if !reflect.DeepEqual(optimizedOne, legacyOne) {
				t.Fatal("optimized GetCourse differs from the legacy response")
			}

			counter.reset()
			if _, err := st.GetCourse(ctx, ""); !errors.Is(err, ErrNotFound) {
				t.Fatalf("empty slug error = %v, want ErrNotFound", err)
			}
			if got := counter.value(); got != 1 {
				t.Fatalf("empty-slug GetCourse used %d database statements, want 1", got)
			}
			draft := fixtures[len(fixtures)-1]
			if _, err := st.GetCourse(ctx, draft.course.Slug); !errors.Is(err, ErrNotFound) {
				t.Fatalf("draft course error = %v, want ErrNotFound", err)
			}

			hidden := fixtures[2]
			if len(expectedCourseCatalogFixture(hidden).Lessons) != 0 {
				t.Fatal("hidden fixture must start with no visible lessons")
			}
			lesson := hidden.lessons[0]
			if _, err := st.db.ExecContext(ctx, `UPDATE lessons SET status='published',title=$1,estimated_mins=$2 WHERE id=$3`, "PERF-001 republished lesson", 19, lesson.ID); err != nil {
				t.Fatal(err)
			}
			counter.reset()
			refreshed, err := st.GetCourse(ctx, hidden.course.Slug)
			if err != nil {
				t.Fatal(err)
			}
			if got := counter.value(); got != 1 || len(refreshed.Lessons) != 1 || refreshed.Lessons[0].Title != "PERF-001 republished lesson" || refreshed.Lessons[0].EstimatedMins != 19 {
				t.Fatalf("republished lesson projection = %+v, queries=%d", refreshed, counter.value())
			}
		})
	}
}

func TestGetCoursePostgresUsesSinglePublicationSnapshot(t *testing.T) {
	databaseURL := requireLessonCatalogDatabase(t)
	st := openLessonCatalogStore(t, databaseURL, false, nil)
	if err := st.EnsureCourses(context.Background()); err != nil {
		t.Fatal(err)
	}
	fixtures := addCourseCatalogFixtures(t, st, 5)
	fixture := fixtures[3]
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	visible := expectedCourseCatalogFixture(fixture).Lessons
	if len(visible) != 1 {
		t.Fatalf("snapshot fixture visible lessons = %d, want 1", len(visible))
	}
	lessonSlug := visible[0].Slug

	type revision struct {
		courseTitle, courseDescription, lessonTitle string
		minutes                                     int
	}
	revisions := []revision{
		{courseTitle: "PERF-001 revision A course", courseDescription: "revision A course description", lessonTitle: "PERF-001 revision A lesson", minutes: 11},
		{courseTitle: "PERF-001 revision B course", courseDescription: "revision B course description", lessonTitle: "PERF-001 revision B lesson", minutes: 17},
	}
	writeRevision := func(next revision) error {
		tx, err := st.db.BeginTx(ctx, nil)
		if err != nil {
			return err
		}
		defer tx.Rollback()
		if _, err := tx.ExecContext(ctx, `UPDATE courses SET title=$1,description=$2,updated_at=NOW() WHERE id=$3`, next.courseTitle, next.courseDescription, fixture.course.ID); err != nil {
			return err
		}
		if _, err := tx.ExecContext(ctx, `UPDATE lessons SET title=$1,estimated_mins=$2,updated_at=NOW() WHERE slug=$3`, next.lessonTitle, next.minutes, lessonSlug); err != nil {
			return err
		}
		return tx.Commit()
	}
	if err := writeRevision(revisions[0]); err != nil {
		t.Fatal(err)
	}

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
				course, err := st.GetCourse(ctx, fixture.course.Slug)
				if err != nil {
					record(err)
					return
				}
				if len(course.Lessons) != 1 {
					record(fmt.Errorf("snapshot returned %d visible lessons", len(course.Lessons)))
					return
				}
				revisionIndex := -1
				for i, revision := range revisions {
					if course.Title == revision.courseTitle {
						revisionIndex = i
					}
				}
				if revisionIndex < 0 || course.Description != revisions[revisionIndex].courseDescription || course.Lessons[0].Title != revisions[revisionIndex].lessonTitle || course.Lessons[0].EstimatedMins != revisions[revisionIndex].minutes {
					record(fmt.Errorf("mixed course publication snapshot: %+v", course))
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
			if err := writeRevision(revisions[1]); err != nil {
				record(err)
				return
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

func BenchmarkCourseCatalogPostgres(b *testing.B) {
	databaseURL := requireLessonCatalogDatabase(b)
	counter := &lessonCatalogQueryCounter{}
	st := openLessonCatalogStore(b, databaseURL, true, counter)
	if err := st.EnsureCourses(context.Background()); err != nil {
		b.Fatal(err)
	}
	fixtures := addCourseCatalogFixtures(b, st, 24)
	if len(fixtures) == 0 {
		b.Fatal("course catalog fixture was empty")
	}
	if _, err := st.ListCourses(context.Background()); err != nil {
		b.Fatal(err)
	}
	for _, benchmark := range []struct {
		name string
		list func(context.Context, *Store) ([]model.Course, error)
	}{
		{name: "legacy", list: legacyListCoursesForCatalog},
		{name: "optimized", list: func(ctx context.Context, store *Store) ([]model.Course, error) { return store.ListCourses(ctx) }},
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
