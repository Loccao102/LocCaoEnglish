package httpapi

import (
	"context"
	"encoding/json"
	"net/http/httptest"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/Loccao102/LocCaoEnglish/backend/internal/ai"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/auth"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/model"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/realtime"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/store"
)

func TestSentenceHTTPContract(t *testing.T) {
	for _, signedIn := range []bool{false, true} {
		t.Run(map[bool]string{false: "guest", true: "account"}[signedIn], func(t *testing.T) {
			st, err := store.New("")
			if err != nil {
				t.Fatal(err)
			}
			defer st.Close()
			service := auth.New("test-only-secret", time.Hour)
			social := realtime.New("")
			defer social.Close()
			handler := New(st, service, ai.New("http://127.0.0.1:1"), social).Handler()
			token := ""
			if signedIn {
				user, e := st.CreateUser(context.Background(), "sentence-http@example.test", "hash", "Builder")
				if e != nil {
					t.Fatal(e)
				}
				token, _ = service.Issue(user.ID)
			}
			call := func(method, path string, body any) *httptest.ResponseRecorder {
				raw, _ := json.Marshal(body)
				req := httptest.NewRequest(method, path, strings.NewReader(string(raw)))
				if token != "" {
					req.Header.Set("Authorization", "Bearer "+token)
				}
				w := httptest.NewRecorder()
				handler.ServeHTTP(w, req)
				return w
			}
			base := "/v1/learning/attempts"
			input := model.LearningAttemptStartInput{RequestID: "52345678-1234-4123-8123-123456789012", Activity: "sentence-builder", Pack: "work-standup", CEFRLevel: "B1"}
			created := call("POST", base, input)
			if created.Code != 201 || strings.Contains(created.Body.String(), "correctAnswer") || strings.Contains(created.Body.String(), "feedback") {
				t.Fatal("creation/leak", created.Code, created.Body.String())
			}
			var a model.LearningAttemptStart
			if err := json.Unmarshal(created.Body.Bytes(), &a); err != nil {
				t.Fatal(err)
			}
			if len(a.Prompt.Chunks) != 3 || len(a.Prompt.Options) != 0 || a.RulesVersion != "sentence-builder.v1" {
				t.Fatal("bad prompt", a)
			}
			if retry := call("POST", base, input); retry.Code != 200 || retry.Body.String() != created.Body.String() {
				t.Fatal("changed creation", retry.Body.String())
			}
			input.Pack = "cefr-core"
			if conflict := call("POST", base, input); conflict.Code != 409 {
				t.Fatal("creation conflict accepted")
			}
			var ids []string
			for _, text := range []string{"Yesterday", "I fixed", "the login bug"} {
				for _, c := range a.Prompt.Chunks {
					if c.Text == text {
						ids = append(ids, c.ID)
					}
				}
			}
			raw, _ := json.Marshal(ids)
			payload := model.LearningAttemptSubmitInput{Answer: string(raw), ContentVersion: a.ContentVersion, RulesVersion: a.RulesVersion}
			bad := payload
			bad.Answer = "Yesterday I fixed the login bug"
			if call("POST", base+"/"+a.AttemptID+"/submit", bad).Code != 400 {
				t.Fatal("free text bypass")
			}
			w := call("POST", base+"/"+a.AttemptID+"/submit", payload)
			if w.Code != 200 {
				t.Fatal(w.Code, w.Body.String())
			}
			var v model.LearningAttemptResult
			if err := json.Unmarshal(w.Body.Bytes(), &v); err != nil {
				t.Fatal(err)
			}
			if !v.Correct || v.ActualAnswer != "Yesterday I fixed the login bug" || v.ProgressionApplied != signedIn || v.XPDelta != map[bool]int{false: 0, true: 20}[signedIn] {
				t.Fatal("wrong verdict", v)
			}
			if retry := call("POST", base+"/"+a.AttemptID+"/submit", payload); retry.Body.String() != w.Body.String() {
				t.Fatal("changed submit")
			}
			saved := call("GET", base+"/"+a.AttemptID, nil)
			var restored model.LearningAttemptStart
			if err := json.Unmarshal(saved.Body.Bytes(), &restored); err != nil {
				t.Fatal(err)
			}
			if saved.Code != 200 || !reflect.DeepEqual(restored.Prompt, a.Prompt) || !reflect.DeepEqual(restored.Result, &v) {
				t.Fatal("resume failed")
			}
			for _, activity := range []string{"sentence-builder", " SENTENCE-BUILDER "} {
				if call("POST", "/v1/attempts", map[string]any{"activity": activity, "skill": "Grammar", "itemKey": "fake", "accuracy": 1}).Code != 409 {
					t.Fatal("legacy bypass")
				}
			}
		})
	}
}
