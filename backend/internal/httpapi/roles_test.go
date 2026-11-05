package httpapi

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/Loccao102/LocCaoEnglish/backend/internal/ai"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/auth"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/realtime"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/store"
)

func TestSEC002PublicRegistrationCannotSelfElevateRole(t *testing.T) {
	t.Setenv("ALLOW_ANONYMOUS_DEMO", "false")
	t.Setenv("TEACHER_EMAILS", "sec002-public@example.test")
	t.Setenv("ADMIN_EMAILS", "sec002-public@example.test")

	ctx := context.Background()
	st, err := store.New("")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(st.Close)
	social := realtime.New("")
	t.Cleanup(social.Close)
	authn := auth.New("sec002-http-test", time.Hour)
	handler := New(st, authn, ai.New("http://127.0.0.1:1"), social).Handler()

	register := func(email string) (string, string) {
		t.Helper()
		body, err := json.Marshal(map[string]string{
			"email":       email,
			"password":    "SunlitTest123!",
			"displayName": "SEC-002 role fixture",
		})
		if err != nil {
			t.Fatal(err)
		}
		r := httptest.NewRequest(http.MethodPost, "/v1/auth/register", bytes.NewReader(body))
		r.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, r)
		if w.Code != http.StatusCreated {
			t.Fatalf("register %s: %d %s", email, w.Code, w.Body.String())
		}
		var response struct {
			Token string `json:"token"`
			User  struct {
				ID string `json:"id"`
			} `json:"user"`
		}
		if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
			t.Fatal(err)
		}
		if response.Token == "" || response.User.ID == "" {
			t.Fatalf("register response omitted identity: %s", w.Body.String())
		}
		return response.User.ID, response.Token
	}

	publicID, publicToken := register("sec002-public@example.test")

	me := func(token string) string {
		t.Helper()
		r := httptest.NewRequest(http.MethodGet, "/v1/me", nil)
		r.Header.Set("Authorization", "Bearer "+token)
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, r)
		if w.Code != http.StatusOK {
			t.Fatalf("me: %d %s", w.Code, w.Body.String())
		}
		var response struct {
			Role string `json:"role"`
		}
		if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
			t.Fatal(err)
		}
		return response.Role
	}

	if role := me(publicToken); role != "learner" {
		t.Fatalf("public registration self-elevated to %q", role)
	}

	analytics := httptest.NewRequest(http.MethodGet, "/v1/admin/analytics", nil)
	analytics.Header.Set("Authorization", "Bearer "+publicToken)
	analyticsResponse := httptest.NewRecorder()
	handler.ServeHTTP(analyticsResponse, analytics)
	if analyticsResponse.Code != http.StatusForbidden {
		t.Fatalf("self-elevated analytics access: %d %s", analyticsResponse.Code, analyticsResponse.Body.String())
	}

	teacherID, teacherToken := register(fmt.Sprintf("sec002-explicit-teacher-%s@example.test", publicID))
	if err := st.SetUserRole(ctx, teacherID, "teacher"); err != nil {
		t.Fatal(err)
	}
	if role := me(teacherToken); role != "teacher" {
		t.Fatalf("persisted teacher assignment returned %q", role)
	}
}
