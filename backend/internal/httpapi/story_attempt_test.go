package httpapi

import (
	"context"
	"encoding/json"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/ai"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/auth"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/learning"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/model"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/realtime"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/store"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestStoryHTTPBoundaries(t *testing.T) {
	for _, account := range []bool{false, true} {
		t.Run(map[bool]string{true: "account", false: "guest"}[account], func(t *testing.T) {
			st, err := store.New("")
			if err != nil {
				t.Fatal(err)
			}
			defer st.Close()
			service := auth.New("test-secret", time.Hour)
			social := realtime.New("")
			defer social.Close()
			handler := New(st, service, ai.New("http://127.0.0.1:1"), social).Handler()
			u, err := st.CreateUser(context.Background(), "story@example.test", "hash", "Reader")
			if err != nil {
				t.Fatal(err)
			}
			token := ""
			if account {
				token, _ = service.Issue(u.ID)
			}
			call := func(path string, body any) *httptest.ResponseRecorder {
				raw, _ := json.Marshal(body)
				req := httptest.NewRequest("POST", path, strings.NewReader(string(raw)))
				if token != "" {
					req.Header.Set("Authorization", "Bearer "+token)
				}
				w := httptest.NewRecorder()
				handler.ServeHTTP(w, req)
				return w
			}
			base := "/v1/learning/attempts"
			input := model.LearningAttemptStartInput{RequestID: "52345678-1234-4123-8123-123456789012", Activity: "story-choice", Pack: "hotel-check-in", CEFRLevel: "B1"}
			created := call(base, input)
			if created.Code != 201 {
				t.Fatal(created.Code, created.Body.String())
			}
			for _, field := range []string{"definition", "nodes", "good", "next", "feedback", "correctAnswer", "ending"} {
				if strings.Contains(created.Body.String(), "\""+field+"\"") {
					t.Fatal("private graph leaked", field)
				}
			}
			var a model.LearningAttemptStart
			_ = json.Unmarshal(created.Body.Bytes(), &a)
			if a.Story == nil || a.Story.Step != 1 || len(a.Prompt.Options) != 3 {
				t.Fatal("missing opening")
			}
			if retry := call(base, input); retry.Code != 200 || retry.Body.String() != created.Body.String() {
				t.Fatal("start retry changed scene")
			}
			if bad := call(base+"/"+a.AttemptID+"/continue", map[string]string{}); bad.Code != 409 {
				t.Fatal("skipped decision")
			}
			catalog := learning.StoryCatalog()
			node, _ := catalog.Node(catalog.Start)
			wrong := node.Choices[2]
			payload := model.LearningAttemptSubmitInput{Answer: wrong.Label, ContentVersion: a.ContentVersion, RulesVersion: a.RulesVersion}
			bad := payload
			bad.RulesVersion = "invalid"
			if call(base+"/"+a.AttemptID+"/submit", bad).Code != 400 {
				t.Fatal("version bypass")
			}
			bad = payload
			bad.Answer = "skip to ending"
			if call(base+"/"+a.AttemptID+"/submit", bad).Code != 400 {
				t.Fatal("option bypass")
			}
			submitted := call(base+"/"+a.AttemptID+"/submit", payload)
			if submitted.Code != 200 {
				t.Fatal(submitted.Body.String())
			}
			var verdict model.LearningAttemptResult
			_ = json.Unmarshal(submitted.Body.Bytes(), &verdict)
			if verdict.Correct || verdict.ActualAnswer != wrong.Label || verdict.XPDelta != 0 || verdict.ReviewAdded != account || verdict.Story == nil || !verdict.Story.CanContinue || verdict.Feedback != wrong.Feedback {
				t.Fatal("wrong decision not preserved", verdict)
			}
			if call(base+"/"+a.AttemptID+"/submit", payload).Body.String() != submitted.Body.String() {
				t.Fatal("retry changed verdict")
			}
			if call(base+"/"+a.AttemptID+"/continue", map[string]string{"node": "confirmed"}).Code != 400 {
				t.Fatal("client chose next scene")
			}
			next := call(base+"/"+a.AttemptID+"/continue", map[string]string{})
			if next.Code != 200 {
				t.Fatal(next.Body.String())
			}
			var child model.LearningAttemptStart
			_ = json.Unmarshal(next.Body.Bytes(), &child)
			if child.Story.Step != 2 || child.Story.History[0].Answer != wrong.Label || child.Prompt.Title != "Before a second charge" {
				t.Fatal("wrong consequence branch")
			}
			if call(base+"/"+a.AttemptID+"/continue", map[string]string{}).Body.String() != next.Body.String() {
				t.Fatal("continue duplicated")
			}
			for _, activity := range []string{"story-choice", " STORY-CHOICE "} {
				if call("/v1/attempts", map[string]any{"activity": activity, "accuracy": 1}).Code != 409 {
					t.Fatal("legacy bypass")
				}
			}
		})
	}
}
