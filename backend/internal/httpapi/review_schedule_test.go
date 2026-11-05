package httpapi

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/Loccao102/LocCaoEnglish/backend/internal/ai"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/auth"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/model"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/realtime"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/store"
)

func TestReviewScheduleHTTPRequiresReceiptEndpointAndOwner(t *testing.T) {
	st, err := store.New("")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(st.Close)
	authService := auth.New("review-http-test-secret", time.Hour)
	social := realtime.New("")
	t.Cleanup(social.Close)
	handler := New(st, authService, ai.New("http://127.0.0.1:1"), social).Handler()
	ctx := context.Background()
	owner, err := st.CreateUser(ctx, "review-http-owner-"+time.Now().UTC().Format("150405.000000000")+"@example.test", "hash", "Review owner")
	if err != nil {
		t.Fatal(err)
	}
	foreign, err := st.CreateUser(ctx, "review-http-foreign-"+time.Now().UTC().Format("150405.000000000")+"@example.test", "hash", "Review foreign")
	if err != nil {
		t.Fatal(err)
	}
	seed := store.LearningSnapshot{Input: model.LearningAttemptStartInput{Activity: "word-link", CEFRLevel: "A1", Pack: "cefr-core"}, Prompt: model.LearningAttemptPrompt{Word: "http-review-item", Relation: "synonym", Options: []string{"glad", "sad"}}}
	attempt, _, err := st.StartLearningAttempt(ctx, owner.ID, "http-seed-"+time.Now().UTC().Format("150405.000000000"), "word-link", "Vocabulary", "http-review-item", "A1", "http-review-content.v1", "word-link.v1", "Choose a synonym", "glad", "Practice.", seed)
	if err != nil {
		t.Fatal(err)
	}
	if _, err = st.SubmitLearningAttempt(ctx, owner.ID, attempt.ID, "sad", model.LearningAttemptSubmitInput{ContentVersion: attempt.ContentVersion, RulesVersion: attempt.RulesVersion}); err != nil {
		t.Fatal(err)
	}
	ownerToken, _ := authService.Issue(owner.ID)
	foreignToken, _ := authService.Issue(foreign.ID)
	call := func(method, path, token string, body any) *httptest.ResponseRecorder {
		raw, _ := json.Marshal(body)
		req := httptest.NewRequest(method, path, strings.NewReader(string(raw)))
		if token != "" {
			req.Header.Set("Authorization", "Bearer "+token)
		}
		response := httptest.NewRecorder()
		handler.ServeHTTP(response, req)
		return response
	}
	if response := call(http.MethodPost, "/v1/review/http-review-item", "", map[string]any{"requestId": "http-request", "quality": 4, "rulesVersion": store.ReviewScheduleRulesVersion}); response.Code != http.StatusUnauthorized {
		t.Fatalf("receipt write must require sign-in: %d %s", response.Code, response.Body.String())
	}
	if response := call(http.MethodPost, "/v1/review/http-review-item", ownerToken, map[string]any{"quality": 4}); response.Code != http.StatusConflict {
		t.Fatalf("old quality-only path must safe-upgrade: %d %s", response.Code, response.Body.String())
	}
	before, _ := st.ReviewQueue(ctx, owner.ID, 10)
	if response := call(http.MethodPost, "/v1/review/http-review-item", ownerToken, map[string]any{"requestId": "http-request", "quality": 4, "rulesVersion": store.ReviewScheduleRulesVersion}); response.Code != http.StatusConflict {
		t.Fatalf("old path must never grade even with new body: %d %s", response.Code, response.Body.String())
	}
	after, _ := st.ReviewQueue(ctx, owner.ID, 10)
	if len(before) != len(after) || before[0].IntervalDays != after[0].IntervalDays {
		t.Fatal("legacy path changed the review item")
	}
	for _, body := range []map[string]any{
		{"requestId": "missing-quality", "expectedDueAt": before[0].DueAt, "rulesVersion": store.ReviewScheduleRulesVersion},
		{"requestId": "null-quality", "quality": nil, "expectedDueAt": before[0].DueAt, "rulesVersion": store.ReviewScheduleRulesVersion},
	} {
		if response := call(http.MethodPost, "/v1/review/http-review-item/grades", ownerToken, body); response.Code != http.StatusBadRequest {
			t.Fatalf("missing/null quality must be rejected: %d %s", response.Code, response.Body.String())
		}
	}
	created := call(http.MethodPost, "/v1/review/http-review-item/grades", ownerToken, map[string]any{"requestId": "http-request", "quality": 4, "expectedDueAt": before[0].DueAt, "rulesVersion": store.ReviewScheduleRulesVersion})
	if created.Code != http.StatusOK {
		t.Fatalf("receipt endpoint failed: %d %s", created.Code, created.Body.String())
	}
	retry := call(http.MethodPost, "/v1/review/http-review-item/grades", ownerToken, map[string]any{"requestId": "http-request", "quality": 4, "expectedDueAt": before[0].DueAt, "rulesVersion": store.ReviewScheduleRulesVersion})
	if retry.Code != http.StatusOK || retry.Body.String() != created.Body.String() {
		t.Fatalf("receipt retry changed response: %d %s", retry.Code, retry.Body.String())
	}
	if recovered := call(http.MethodGet, "/v1/review/grades/http-request", ownerToken, nil); recovered.Code != http.StatusOK {
		t.Fatalf("owner receipt recovery failed: %d %s", recovered.Code, recovered.Body.String())
	}
	if hidden := call(http.MethodGet, "/v1/review/grades/http-request", foreignToken, nil); hidden.Code != http.StatusNotFound {
		t.Fatalf("foreign receipt must be hidden: %d %s", hidden.Code, hidden.Body.String())
	}
}
