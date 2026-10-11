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

func TestRateLimitedResponsesRemainReadableToAllowedOrigins(t *testing.T) {
	t.Setenv("CORS_ORIGINS", "http://localhost:3102")
	t.Setenv("TRUST_PROXY", "false")
	st, err := store.New("")
	if err != nil {
		t.Fatal(err)
	}
	defer st.Close()
	social := realtime.New("")
	defer social.Close()
	handler := New(st, auth.New("rate-cors-test", time.Hour), ai.New("http://127.0.0.1:1"), social).Handler()
	const ip = "192.0.2.240"
	for i := 0; i < 360; i++ {
		if _, err := social.Allow(context.Background(), realtime.RateKey("general", ip), 360, time.Minute); err != nil {
			t.Fatal(err)
		}
	}
	for _, path := range []string{"/v1/player/progression", "/v1/ielts/history"} {
		r := httptest.NewRequest(http.MethodGet, path, nil)
		r.RemoteAddr = ip + ":12000"
		r.Header.Set("Origin", "http://localhost:3102")
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, r)
		if w.Code != 429 || w.Header().Get("Retry-After") != "60" {
			t.Fatalf("limit bypassed: %d", w.Code)
		}
		if w.Header().Get("Access-Control-Allow-Origin") != "http://localhost:3102" || !strings.Contains(w.Header().Get("Access-Control-Expose-Headers"), "Retry-After") {
			t.Fatalf("browser cannot read throttling: %v", w.Header())
		}
	}
	r := httptest.NewRequest(http.MethodGet, "/v1/player/progression", nil)
	r.RemoteAddr = ip + ":12000"
	r.Header.Set("Origin", "https://untrusted.example")
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, r)
	if w.Header().Get("Access-Control-Allow-Origin") != "" {
		t.Fatal("untrusted origin allowed")
	}
}
