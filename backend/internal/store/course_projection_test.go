package store

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"
	"os"
	"reflect"
	"strings"
	"sync"
	"testing"

	"github.com/Loccao102/LocCaoEnglish/backend/internal/model"
)

func TestCoursePublishedProjectionPreservesHiddenBookmarks(t *testing.T) {
	stores := map[string]string{"memory": ""}
	if databaseURL := os.Getenv("TEST_DATABASE_URL"); databaseURL != "" {
		parsed, err := url.Parse(databaseURL)
		if err != nil || (parsed.Scheme != "postgres" && parsed.Scheme != "postgresql") || parsed.Path != "/loccao_system_test" {
			t.Fatal("use the dedicated loccao_system_test database")
		}
		stores["postgres"] = databaseURL
	}
	for mode, databaseURL := range stores {
		t.Run(mode, func(t *testing.T) {
			ctx := context.Background()
			st, err := New(databaseURL)
			if err != nil {
				t.Fatal(err)
			}
			t.Cleanup(st.Close)
			if st.db != nil {
				st.db.SetMaxOpenConns(8)
			}
			if err := st.EnsureContent(ctx); err != nil {
				t.Fatal(err)
			}
			if err := st.EnsureCourses(ctx); err != nil {
				t.Fatal(err)
			}
			owner := skillPracticeUser(t, st)
			other := skillPracticeUser(t, st)
			tag := newID()
			course := model.Course{ID: newID(), Slug: "projection-" + tag, Title: "Projection fixture", Status: "published"}
			lessons := []model.Lesson{}
			// Only this fixture's IDs are removed, before the store closes. No global
			// reset, seeded lessons, or unrelated learner records are touched.
			t.Cleanup(func() {
				if st.db == nil {
					return
				}
				if _, err := st.db.ExecContext(ctx, `DELETE FROM courses WHERE id=$1`, course.ID); err != nil {
					t.Error(err)
				}
				for _, lesson := range lessons {
					if _, err := st.db.ExecContext(ctx, `DELETE FROM lessons WHERE id=$1`, lesson.ID); err != nil {
						t.Error(err)
					}
				}
			})
			for i := 0; i < 3; i++ {
				lesson, err := st.SaveLesson(ctx, model.Lesson{
					Slug: fmt.Sprintf("projection-%s-%d", tag, i), Title: fmt.Sprintf("Part %d", i),
					Skill: "Vocabulary", Level: "B1", Status: "published", EstimatedMins: 8,
					Exercises: []model.LessonExercise{{Kind: "choice", Prompt: "Choose", Answer: "a", Options: []string{"a", "b"}}, {Kind: "input", Prompt: "Recall", Answer: "a"}},
				}, owner.ID)
				if err != nil {
					t.Fatal(err)
				}
				lessons = append(lessons, lesson)
				course.Lessons = append(course.Lessons, model.CourseLesson{Slug: lesson.Slug, Title: lesson.Title, Skill: lesson.Skill, Level: lesson.Level, Position: i, EstimatedMins: lesson.EstimatedMins})
			}
			if st.db != nil {
				if _, err := st.db.ExecContext(ctx, `INSERT INTO courses(id,slug,title,status) VALUES($1,$2,$3,'published')`, course.ID, course.Slug, course.Title); err != nil {
					t.Fatal(err)
				}
				for i, lesson := range lessons {
					if _, err := st.db.ExecContext(ctx, `INSERT INTO course_lessons(course_id,lesson_id,position) VALUES($1,$2,$3)`, course.ID, lesson.ID, i); err != nil {
						t.Fatal(err)
					}
				}
			} else {
				state := st.courseMemory()
				state.mu.Lock()
				state.courses[course.Slug] = course
				state.mu.Unlock()
			}
			for i, lesson := range lessons {
				completed := 2
				if i == 2 {
					completed = 1
				}
				if _, err := st.SaveLessonProgress(ctx, owner.ID, lesson.ID, completed, 2, 0); err != nil {
					t.Fatal(err)
				}
			}
			if _, err := st.EnrollCourse(ctx, owner.ID, course.Slug); err != nil {
				t.Fatal(err)
			}
			check := func(total, completed int) {
				t.Helper()
				catalog, err := st.GetCourse(ctx, course.Slug)
				if err != nil {
					t.Fatal(err)
				}
				p, err := st.CourseProgress(ctx, owner.ID, course.Slug)
				if err != nil {
					t.Fatal(err)
				}
				percent := 0
				if total > 0 {
					percent = completed * 100 / total
				}
				if len(catalog.Lessons) != total || p.TotalLessons != total || p.CompletedLessons != completed || p.Percent != percent || !p.Enrolled {
					t.Fatalf("published catalog/progress mismatch: catalog=%+v progress=%+v", catalog, p)
				}
				foreign, err := st.CourseProgress(ctx, other.ID, course.Slug)
				if err != nil {
					t.Fatal(err)
				}
				if foreign.TotalLessons != total || foreign.CompletedLessons != 0 || foreign.Percent != 0 || foreign.Enrolled {
					t.Fatalf("foreign owner progress: %+v", foreign)
				}
				courses, err := st.ListCourses(ctx)
				if err != nil {
					t.Fatal(err)
				}
				found := false
				for _, row := range courses {
					if row.Slug == course.Slug {
						found = true
						if !reflect.DeepEqual(row.Lessons, catalog.Lessons) {
							t.Fatal("course list retained hidden lessons or stale metadata")
						}
					}
				}
				if !found {
					t.Fatal("public course disappeared")
				}
				if total == 0 {
					raw, err := json.Marshal(catalog)
					if err != nil {
						t.Fatal(err)
					}
					if !strings.Contains(string(raw), `"lessons":[]`) {
						t.Fatalf("empty catalog must be an array: %s", raw)
					}
				}
			}
			check(3, 2)
			for i := range lessons {
				lessons[i].Status = "draft"
				if _, err := st.SaveLesson(ctx, lessons[i], owner.ID); err != nil {
					t.Fatal(err)
				}
				check(2-i, maxInt(0, 1-i))
			}
			lessons[0].Status, lessons[0].Title, lessons[0].EstimatedMins = "published", "Updated public title", 14
			if _, err := st.SaveLesson(ctx, lessons[0], owner.ID); err != nil {
				t.Fatal(err)
			}
			check(1, 1)
			catalog, err := st.GetCourse(ctx, course.Slug)
			if err != nil {
				t.Fatal(err)
			}
			if catalog.Lessons[0].Title != "Updated public title" || catalog.Lessons[0].EstimatedMins != 14 {
				t.Fatal("course metadata was not refreshed")
			}
			catalog.Lessons[0].Title = "Caller mutation"
			again, err := st.GetCourse(ctx, course.Slug)
			if err != nil || again.Lessons[0].Title != "Updated public title" {
				t.Fatal("course result aliases stored references", err)
			}
			// While one completed item is toggled, both counts must observe the same
			// visibility snapshot. A separate old-catalog denominator can exceed 100%.
			var group sync.WaitGroup
			errors := make(chan error, 2)
			start := make(chan struct{})
			group.Add(2)
			go func() {
				defer group.Done()
				<-start
				for i := 0; i < 24; i++ {
					changed := lessons[0]
					changed.Status = "published"
					if i%2 == 0 {
						changed.Status = "draft"
					}
					if _, err := st.SaveLesson(ctx, changed, owner.ID); err != nil {
						errors <- err
						return
					}
				}
			}()
			go func() {
				defer group.Done()
				<-start
				for i := 0; i < 60; i++ {
					p, err := st.CourseProgress(ctx, owner.ID, course.Slug)
					if err != nil {
						errors <- err
						return
					}
					if p.CompletedLessons != p.TotalLessons || p.TotalLessons < 0 || p.TotalLessons > 1 || p.Percent < 0 || p.Percent > 100 {
						errors <- fmt.Errorf("mixed publication snapshot: %+v", p)
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
			check(1, 1)
			if st.db != nil {
				reopened, err := New(databaseURL)
				if err != nil {
					t.Fatal(err)
				}
				defer reopened.Close()
				p, err := reopened.CourseProgress(ctx, owner.ID, course.Slug)
				if err != nil || p.CompletedLessons != 1 || p.TotalLessons != 1 || p.Percent != 100 {
					t.Fatal("published bookmark lost across restart", p, err)
				}
			}
			after, err := st.GetUser(ctx, owner.ID)
			if err != nil || after.XP != owner.XP {
				t.Fatal("catalog reads changed XP", after, err)
			}
		})
	}
}
