package httpapi

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/Loccao102/LocCaoEnglish/backend/internal/ai"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/auth"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/model"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/realtime"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/store"
)

func TestCourseEnrollmentRequiresAccountAndStaysOwnerScoped(t *testing.T) {
	t.Setenv("ALLOW_ANONYMOUS_DEMO", "true")
	ctx := context.Background()
	st, err := store.New("")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = st.Close() })
	if err := st.EnsureContent(ctx); err != nil {
		t.Fatal(err)
	}
	if err := st.EnsureCourses(ctx); err != nil {
		t.Fatal(err)
	}
	course, err := st.GetCourse(ctx, "english-b1-foundations")
	if err != nil || course.Status != "published" || len(course.Lessons) == 0 {
		t.Fatalf("missing seeded course catalog: %+v %v", course, err)
	}
	a, err := st.CreateUser(ctx, "course-owner-a@example.test", "hash", "Course A")
	if err != nil {
		t.Fatal(err)
	}
	b, err := st.CreateUser(ctx, "course-owner-b@example.test", "hash", "Course B")
	if err != nil {
		t.Fatal(err)
	}
	authn := auth.New("course-enrollment-http-test", time.Hour)
	aToken, err := authn.Issue(a.ID)
	if err != nil {
		t.Fatal(err)
	}
	bToken, err := authn.Issue(b.ID)
	if err != nil {
		t.Fatal(err)
	}
	social := realtime.New("")
	t.Cleanup(social.Close)
	handler := New(st, authn, ai.New("http://127.0.0.1:1"), social).Handler()

	call := func(method, token string) *httptest.ResponseRecorder {
		r := httptest.NewRequest(method, "/v1/courses/english-b1-foundations/"+map[string]string{http.MethodPost: "enroll", http.MethodGet: "progress"}[method], nil)
		if token != "" {
			r.Header.Set("Authorization", "Bearer "+token)
		}
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, r)
		return w
	}
	decode := func(w *httptest.ResponseRecorder) model.CourseProgress {
		t.Helper()
		if w.Code != http.StatusOK {
			t.Fatalf("course response: %d %s", w.Code, w.Body.String())
		}
		var progress model.CourseProgress
		if err := json.Unmarshal(w.Body.Bytes(), &progress); err != nil {
			t.Fatal(err)
		}
		return progress
	}

	if guest := call(http.MethodPost, ""); guest.Code != http.StatusUnauthorized {
		t.Fatalf("guest enrollment must be rejected even when demo reads are enabled: %d", guest.Code)
	}
	if guestProgress := decode(call(http.MethodGet, "")); guestProgress.Enrolled {
		t.Fatal("anonymous progress should remain demo-compatible and unenrolled")
	}
	beforeA, err := st.GetUser(ctx, a.ID)
	if err != nil {
		t.Fatal(err)
	}
	first := decode(call(http.MethodPost, aToken))
	retry := decode(call(http.MethodPost, aToken))
	if !first.Enrolled || retry != first {
		t.Fatalf("enrollment retry changed idempotent progress: first=%#v retry=%#v", first, retry)
	}
	afterA, err := st.GetUser(ctx, a.ID)
	if err != nil {
		t.Fatal(err)
	}
	if afterA.XP != beforeA.XP {
		t.Fatalf("enrollment awarded XP: before=%d after=%d", beforeA.XP, afterA.XP)
	}
	if bBefore := decode(call(http.MethodGet, bToken)); bBefore.Enrolled {
		t.Fatal("account B inherited account A enrollment")
	}
	if !decode(call(http.MethodPost, bToken)).Enrolled || !decode(call(http.MethodGet, aToken)).Enrolled {
		t.Fatal("owner-scoped enrollments were not preserved")
	}
}
