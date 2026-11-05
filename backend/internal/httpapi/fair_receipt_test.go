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
	"github.com/Loccao102/LocCaoEnglish/backend/internal/fair"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/realtime"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/store"
)

func TestFairCompletionReceiptHTTPIsOwnerScopedAndRecoverable(t *testing.T) {
	t.Setenv("ALLOW_ANONYMOUS_DEMO", "false")
	ctx := context.Background()
	st, err := store.New("")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(st.Close)
	social := realtime.New("")
	t.Cleanup(social.Close)
	authService := auth.New("fair-receipt-http-test", time.Hour)
	handler := New(st, authService, ai.New("http://127.0.0.1:1"), social).Handler()

	owner, err := st.CreateUser(ctx, "fair-receipt-http-owner@example.test", "hash", "Receipt owner")
	if err != nil {
		t.Fatal(err)
	}
	foreign, err := st.CreateUser(ctx, "fair-receipt-http-foreign@example.test", "hash", "Receipt foreign")
	if err != nil {
		t.Fatal(err)
	}
	ownerToken, err := authService.Issue(owner.ID)
	if err != nil {
		t.Fatal(err)
	}
	foreignToken, err := authService.Issue(foreign.ID)
	if err != nil {
		t.Fatal(err)
	}
	first := fair.Completion{RunID: "12345678-1234-4123-8123-123456789012", GameID: "tea-time", Stars: 2}
	if _, err := st.CompleteFair(ctx, owner.ID, first); err != nil {
		t.Fatal(err)
	}
	second := fair.Completion{RunID: "22345678-1234-4123-8123-123456789012", GameID: "tea-time", Stars: 3, Difficulty: "expert"}
	if _, err := st.CompleteFair(ctx, owner.ID, second); err != nil {
		t.Fatal(err)
	}

	call := func(token, runID string) *httptest.ResponseRecorder {
		t.Helper()
		r := httptest.NewRequest(http.MethodGet, "/v1/fair/completions/"+runID, nil)
		if token != "" {
			r.Header.Set("Authorization", "Bearer "+token)
		}
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, r)
		return w
	}
	if response := call("", first.RunID); response.Code != http.StatusUnauthorized {
		t.Fatalf("guest receipt read = %d %s", response.Code, response.Body.String())
	}
	if response := call("invalid-token", first.RunID); response.Code != http.StatusUnauthorized {
		t.Fatalf("invalid-token receipt read = %d %s", response.Code, response.Body.String())
	}
	if response := call(ownerToken, "not-a-uuid"); response.Code != http.StatusBadRequest {
		t.Fatalf("invalid receipt ID = %d %s", response.Code, response.Body.String())
	}
	if response := call(ownerToken, "32345678-1234-4123-8123-123456789012"); response.Code != http.StatusNotFound {
		t.Fatalf("missing receipt = %d %s", response.Code, response.Body.String())
	}
	if response := call(foreignToken, first.RunID); response.Code != http.StatusNotFound {
		t.Fatalf("foreign receipt = %d %s", response.Code, response.Body.String())
	}

	response := call(ownerToken, first.RunID)
	if response.Code != http.StatusOK {
		t.Fatalf("owner receipt = %d %s", response.Code, response.Body.String())
	}
	var body struct {
		Method     string          `json:"method"`
		PlayerID   string          `json:"playerId"`
		Completion fair.Completion `json:"completion"`
		Save       fair.Save       `json:"save"`
	}
	if err := json.Unmarshal(response.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if body.Method != "fair-keepsake.v1" || body.PlayerID != owner.ID || body.Completion != first {
		t.Fatalf("receipt response = %+v, want method/player/first completion", body)
	}
	if body.Save.Games[first.GameID].Visits != 2 {
		t.Fatalf("receipt response did not include current aggregate save: %+v", body.Save.Games[first.GameID])
	}
	user, err := st.GetUser(ctx, owner.ID)
	if err != nil || user.XP != 0 {
		t.Fatalf("receipt read changed learning XP: user=%+v err=%v", user, err)
	}
	if strings.Contains(response.Body.String(), "database") {
		t.Fatal("receipt response exposed a storage error")
	}
}
