package httpapi

import (
	"context"
	"encoding/json"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/Loccao102/LocCaoEnglish/backend/internal/ai"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/auth"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/learning"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/realtime"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/store"
)

func TestLearningHTTPGradingAndOwnership(t *testing.T) {
	s, err := store.New("")
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	authService := auth.New("test-only-secret", time.Hour)
	social := realtime.New("")
	defer social.Close()
	handler := New(s, authService, ai.New("http://127.0.0.1:1"), social).Handler()
	u, _ := s.CreateUser(context.Background(), "graded@example.test", "hash", "Graded Learner")
	token, _ := authService.Issue(u.ID)
	call := func(method, path, body, bearer string) *httptest.ResponseRecorder {
		r := httptest.NewRequest(method, path, strings.NewReader(body))
		if bearer != "" {
			r.Header.Set("Authorization", "Bearer "+bearer)
		}
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, r)
		return w
	}
	path := "/v1/learning/word-link/attempts"
	create := `{"requestId":"12345678-1234-4123-8123-123456789012","pack":"default","round":0}`
	if w := call("POST", path, create, "bad-token"); w.Code != 401 {
		t.Fatal("invalid token downgraded to guest")
	}
	w := call("POST", path, create, token)
	if w.Code != 201 {
		t.Fatal(w.Code, w.Body.String())
	}
	var v learning.View
	if err = json.Unmarshal(w.Body.Bytes(), &v); err != nil {
		t.Fatal(err)
	}
	if strings.Contains(w.Body.String(), `"answer"`) || strings.Contains(w.Body.String(), `"note"`) {
		t.Fatal("answer key leaked")
	}
	if w = call("GET", path+"/"+v.ID, "", ""); w.Code != 404 {
		t.Fatal("guest sees account attempt")
	}
	var choice string
	for _, c := range v.Choices {
		if c.Label == "substantial" {
			choice = c.ID
		}
	}
	submit := `{"choiceId":"` + choice + `","contentVersion":1,"rulesVersion":1}`
	if w = call("POST", path+"/"+v.ID+"/submit", strings.TrimSuffix(submit, "}")+`,"score":999}`, token); w.Code != 400 {
		t.Fatal("client score accepted")
	}
	if w = call("POST", path+"/"+v.ID+"/submit", submit, token); w.Code != 200 {
		t.Fatal(w.Code, w.Body.String())
	}
	first := w.Body.String()
	w = call("POST", path+"/"+v.ID+"/submit", submit, token)
	if w.Code != 200 || w.Body.String() != first {
		t.Fatal("HTTP retry changed result")
	}
	user, _ := s.GetUser(context.Background(), u.ID)
	if user.XP != 30 {
		t.Fatal("incorrect awarded XP")
	}
	legacy := `{"skill":"Vocabulary","activity":"word-link","itemKey":"fake","accuracy":1}`
	if w = call("POST", "/v1/attempts", legacy, token); w.Code != 409 {
		t.Fatal("legacy Word Link bypass remains")
	}
}
