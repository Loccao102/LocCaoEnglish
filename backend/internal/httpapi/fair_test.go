package httpapi

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/Loccao102/LocCaoEnglish/backend/internal/ai"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/auth"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/realtime"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/store"
)

func TestFairRequiresIdentityAndStrictCompletion(t *testing.T) {
	st, err := store.New("")
	if err != nil {
		t.Fatal(err)
	}
	defer st.Close()
	authService := auth.New("test-only-secret", time.Hour)
	social := realtime.New("")
	defer social.Close()
	server := New(st, authService, ai.New("http://127.0.0.1:1"), social).Handler()
	for _, path := range []string{"/v1/fair", "/v1/fair/completions"} {
		method := "GET"
		if strings.HasSuffix(path, "completions") {
			method = "POST"
		}
		r := httptest.NewRequest(method, path, strings.NewReader("{}"))
		w := httptest.NewRecorder()
		server.ServeHTTP(w, r)
		if w.Code != http.StatusUnauthorized {
			t.Fatalf("anonymous %s = %d", path, w.Code)
		}
	}
	user, err := st.CreateUser(context.Background(), "fair-http@example.test", "hash", "Friend")
	if err != nil {
		t.Fatal(err)
	}
	token, err := authService.Issue(user.ID)
	if err != nil {
		t.Fatal(err)
	}
	for _, tc := range []struct {
		body   string
		status int
	}{
		{`{"runId":"12345678-1234-4123-8123-123456789012","gameId":"tea-time","stars":3}`, 200},
		{`{"runId":"12345678-1234-4123-8123-123456789012","gameId":"tea-time","stars":3}`, 200},
		{`{"runId":"12345678-1234-4123-8123-123456789012","gameId":"tea-time","stars":1}`, 409},
		{`{"runId":"invalid","gameId":"tea-time","stars":3}`, 400},
		{`{"runId":"22345678-1234-4123-8123-123456789012","gameId":"tea-time","stars":3,"score":99999}`, 400},
	} {
		r := httptest.NewRequest("POST", "/v1/fair/completions", strings.NewReader(tc.body))
		r.Header.Set("Authorization", "Bearer "+token)
		w := httptest.NewRecorder()
		server.ServeHTTP(w, r)
		if w.Code != tc.status {
			t.Errorf("got %d, want %d: %s", w.Code, tc.status, w.Body.String())
		}
	}
}
