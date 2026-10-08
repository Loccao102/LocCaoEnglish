package httpapi

import (
	"context"
	"encoding/json"
	"fmt"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/ai"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/auth"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/learning"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/model"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/realtime"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/store"
	"net/http"
	"net/http/httptest"
	"reflect"
	"strings"
	"testing"
	"time"
)

func TestListeningHTTP(t *testing.T) {
	for _, account := range []bool{false, true} {
		for _, correct := range []bool{false, true} {
			t.Run(fmt.Sprintf("account=%t/correct=%t", account, correct), func(t *testing.T) {
				st, _ := store.New("")
				defer st.Close()
				service := auth.New("test-secret", time.Hour)
				social := realtime.New("")
				defer social.Close()
				user, err := st.CreateUser(context.Background(), "listening@example.test", "hash", "Listener")
				if err != nil {
					t.Fatal(err)
				}
				token := ""
				if account {
					token, _ = service.Issue(user.ID)
				}
				handler := New(st, service, ai.New("http://127.0.0.1:1"), social).Handler()
				call := func(method, path string, body any, bearer string) *httptest.ResponseRecorder {
					raw, _ := json.Marshal(body)
					req := httptest.NewRequest(method, path, strings.NewReader(string(raw)))
					if bearer != "" {
						req.Header.Set("Authorization", "Bearer "+bearer)
					}
					w := httptest.NewRecorder()
					handler.ServeHTTP(w, req)
					return w
				}
				base := "/v1/learning/attempts"
				input := model.LearningAttemptStartInput{RequestID: "52345678-1234-4123-8123-123456789012", Activity: "listen-pick", Pack: "cefr-core", CEFRLevel: "B1", ExcludeItemKeys: []string{"listen-cefr-core-2", "listen-cefr-core-3"}}
				created := call("POST", base, input, token)
				if created.Code != 201 {
					t.Fatal(created.Code, created.Body.String())
				}
				var a model.LearningAttemptStart
				json.Unmarshal(created.Body.Bytes(), &a)
				item, _ := learning.ListeningItemByID(a.ItemKey)
				if strings.Contains(created.Body.String(), item.Transcript) || strings.Contains(created.Body.String(), "correctAnswer") || a.Listening == nil || len(a.Listening.Events) != 0 {
					t.Fatal("leaked transcript/key or missing metadata")
				}
				if retry := call("POST", base, input, token); retry.Code != 200 || retry.Body.String() != created.Body.String() {
					t.Fatal("create retry changed snapshot")
				}
				answer := item.CorrectAnswer
				if !correct {
					for _, option := range item.Options {
						if option != answer {
							answer = option
							break
						}
					}
				}
				payload := model.LearningAttemptSubmitInput{Answer: answer, ContentVersion: a.ContentVersion, RulesVersion: a.RulesVersion}
				path := base + "/" + a.AttemptID
				if call("POST", path+"/submit", payload, token).Code != 409 {
					t.Fatal("submitted before listening")
				}
				event := map[string]any{"requestId": "62345678-1234-4123-8123-123456789012", "rate": .72, "status": "requested", "contentVersion": a.ContentVersion, "rulesVersion": a.RulesVersion}
				prepared := call("POST", path+"/audio", event, token)
				if prepared.Code != 200 {
					t.Fatal(prepared.Body.String())
				}
				var clip struct {
					Audio   struct{ Provider, Text string }
					Attempt model.LearningAttemptStart
				}
				json.Unmarshal(prepared.Body.Bytes(), &clip)
				if clip.Audio.Provider != "browser-speech-synthesis" || clip.Audio.Text != item.Transcript || clip.Attempt.Listening.Events[0].Status != "requested" {
					t.Fatal("fallback pretended to play")
				}
				if call("POST", path+"/submit", payload, token).Code != 409 {
					t.Fatal("request alone unlocked submission")
				}
				event["status"], event["provider"] = "failed", "browser-speech-synthesis"
				if call("POST", path+"/audio", event, token).Code != 200 || call("POST", path+"/submit", payload, token).Code != 409 {
					t.Fatal("failure counted as completed")
				}
				event["requestId"], event["status"] = "72345678-1234-4123-8123-123456789012", "requested"
				delete(event, "provider")
				if call("POST", path+"/audio", event, token).Code != 200 {
					t.Fatal("cannot retry playback")
				}
				event["status"], event["provider"] = "completed", "browser-speech-synthesis"
				reported := call("POST", path+"/audio", event, token)
				if reported.Code != 200 {
					t.Fatal(reported.Body.String())
				}
				if retry := call("POST", path+"/audio", event, token); retry.Body.String() != reported.Body.String() {
					t.Fatal("report retry changed evidence")
				}
				bad := payload
				bad.RulesVersion = "bad"
				if call("POST", path+"/submit", bad, token).Code != 400 {
					t.Fatal("wrong version accepted")
				}
				bad = payload
				bad.Answer = "not offered"
				if call("POST", path+"/submit", bad, token).Code != 400 {
					t.Fatal("invalid answer accepted")
				}
				submitted := call("POST", path+"/submit", payload, token)
				var result model.LearningAttemptResult
				json.Unmarshal(submitted.Body.Bytes(), &result)
				xp := 0
				if account && correct {
					xp = 20
				}
				if submitted.Code != 200 || result.Correct != correct || result.ActualAnswer != answer || result.XPDelta != xp || result.ReviewAdded != (account && !correct) || result.Evidence != "server-objective-guided-listening" || result.Listening.Transcript != item.Transcript || len(result.Listening.Events) != 2 {
					t.Fatal("wrong result", submitted.Body.String())
				}
				if retry := call("POST", path+"/submit", payload, token); retry.Body.String() != submitted.Body.String() {
					t.Fatal("submit not idempotent")
				}
				if call("POST", path+"/audio", event, token).Code != 200 {
					t.Fatal("lost report retry after grade rejected")
				}
				event["status"] = "failed"
				if call("POST", path+"/audio", event, token).Code != 409 {
					t.Fatal("evidence changed after grade")
				}
				var resumed model.LearningAttemptStart
				json.Unmarshal(call("GET", path, nil, token).Body.Bytes(), &resumed)
				if !reflect.DeepEqual(resumed.Result, &result) {
					t.Fatal("resume lost evidence")
				}
				if account && call("GET", path, nil, "").Code != 404 {
					t.Fatal("owner leak")
				}
				for _, alias := range []string{"listen-pick", " LISTEN-PICK "} {
					if call("POST", "/v1/attempts", map[string]any{"activity": alias, "skill": "Listening", "itemKey": "fake", "accuracy": 1}, token).Code != 409 {
						t.Fatal("legacy bypass")
					}
				}
				if account && !correct {
					reviews, _ := st.ReviewQueue(context.Background(), user.ID, 20)
					if len(reviews) != 1 || reviews[0].Answer != item.CorrectAnswer || !strings.Contains(reviews[0].Prompt, item.Transcript) {
						t.Fatal("wrong review")
					}
				}
			})
		}
	}
}

func TestListeningNeuralProjection(t *testing.T) {
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var body map[string]any
		json.NewDecoder(r.Body).Decode(&body)
		if body["text"] == "" || body["rate"] != float64(1) {
			t.Error("missing saved transcript/rate")
		}
		json.NewEncoder(w).Encode(map[string]any{"provider": "azure-speech-neural-tts", "mimeType": "audio/mpeg", "audioBase64": "dGVzdA==", "text": "private upstream transcript"})
	}))
	defer upstream.Close()
	st, _ := store.New("")
	defer st.Close()
	social := realtime.New("")
	defer social.Close()
	handler := New(st, auth.New("test-secret", time.Hour), ai.New(upstream.URL), social).Handler()
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, httptest.NewRequest("POST", "/v1/learning/attempts", strings.NewReader(`{"requestId":"82345678-1234-4123-8123-123456789012","activity":"listen-pick","pack":"cefr-core","cefrLevel":"B1"}`)))
	var a model.LearningAttemptStart
	json.Unmarshal(w.Body.Bytes(), &a)
	raw, _ := json.Marshal(map[string]any{"requestId": "92345678-1234-4123-8123-123456789012", "status": "requested", "rate": 1, "contentVersion": a.ContentVersion, "rulesVersion": a.RulesVersion})
	w = httptest.NewRecorder()
	handler.ServeHTTP(w, httptest.NewRequest("POST", "/v1/learning/attempts/"+a.AttemptID+"/audio", strings.NewReader(string(raw))))
	if w.Code != 200 || !strings.Contains(w.Body.String(), "dGVzdA==") || strings.Contains(w.Body.String(), `"text"`) {
		t.Fatal("neural payload projection", w.Body.String())
	}
}
