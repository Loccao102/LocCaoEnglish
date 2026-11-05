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

func TestTeacherAnalyticsHTTPAuthAndEmptyPracticeContract(t *testing.T) {
	t.Setenv("ALLOW_ANONYMOUS_DEMO", "true")
	t.Setenv("TEACHER_EMAILS", "")
	t.Setenv("ADMIN_EMAILS", "")
	ctx := context.Background()
	st, err := store.New("")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(st.Close)
	social := realtime.New("")
	t.Cleanup(social.Close)
	authn := auth.New("analytics-http-test", time.Hour)
	handler := New(st, authn, ai.New("http://127.0.0.1:1"), social).Handler()

	users := make(map[string]model.User, 3)
	for role, email := range map[string]string{
		"learner": "analytics-learner@example.test",
		"teacher": "analytics-teacher@example.test",
		"admin":   "analytics-admin@example.test",
	} {
		u, createErr := st.CreateUser(ctx, email, "hash", role)
		if createErr != nil {
			t.Fatal(createErr)
		}
		if role != "learner" {
			if setErr := st.SetUserRole(ctx, u.ID, role); setErr != nil {
				t.Fatal(setErr)
			}
		}
		users[role] = u
	}
	tokens := make(map[string]string, len(users))
	for role, u := range users {
		tokens[role], err = authn.Issue(u.ID)
		if err != nil {
			t.Fatal(err)
		}
	}

	call := func(token string) *httptest.ResponseRecorder {
		r := httptest.NewRequest(http.MethodGet, "/v1/admin/analytics", nil)
		if token != "" {
			r.Header.Set("Authorization", "Bearer "+token)
		}
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, r)
		return w
	}
	if guest := call(""); guest.Code != http.StatusUnauthorized {
		t.Fatalf("guest analytics access: %d", guest.Code)
	}
	if learner := call(tokens["learner"]); learner.Code != http.StatusForbidden {
		t.Fatalf("learner analytics access: %d", learner.Code)
	}

	for _, role := range []string{"teacher", "admin"} {
		w := call(tokens[role])
		if w.Code != http.StatusOK {
			t.Fatalf("%s analytics access: %d %s", role, w.Code, w.Body.String())
		}
		var snapshot model.AnalyticsSnapshot
		if err := json.Unmarshal(w.Body.Bytes(), &snapshot); err != nil {
			t.Fatal(err)
		}
		if snapshot.Method != store.TeacherPracticeMethod || snapshot.Practice.WindowDays != 7 || snapshot.Practice.Attempts7d != 0 || snapshot.Practice.Correct7d != 0 || snapshot.Practice.Active7d != 0 || snapshot.Practice.Skills == nil || len(snapshot.Practice.Skills) != 0 {
			t.Fatalf("%s analytics contract: %#v", role, snapshot)
		}
	}
}
