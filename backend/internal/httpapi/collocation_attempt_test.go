package httpapi

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http/httptest"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/Loccao102/LocCaoEnglish/backend/internal/ai"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/auth"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/learning"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/model"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/realtime"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/store"
)

func TestCollocationFactoryUsesServerVerdict(t *testing.T) {
	st, err := store.New("")
	if err != nil {
		t.Fatal(err)
	}
	defer st.Close()
	service := auth.New("test-only-secret", time.Hour)
	social := realtime.New("")
	defer social.Close()
	handler := New(st, service, ai.New("http://127.0.0.1:1"), social).Handler()
	user, _ := st.CreateUser(context.Background(), "collocation-http@example.test", "hash", "Learner")
	token, _ := service.Issue(user.ID)
	request := httptest.NewRequest("POST", "/v1/learning/attempts", strings.NewReader(`{"requestId":"22345678-1234-4123-8123-123456789012","activity":"collocation-factory","pack":"work-standup","cefrLevel":"B1"}`))
	request.Header.Set("Authorization", "Bearer "+token)
	created := httptest.NewRecorder()
	handler.ServeHTTP(created, request)
	if created.Code != 201 {
		t.Fatal(created.Code, created.Body.String())
	}
	if strings.Contains(created.Body.String(), "correctAnswer") || strings.Contains(created.Body.String(), "feedback") {
		t.Fatal("collocation answer leaked before submit")
	}
	var attempt model.LearningAttemptStart
	if err := json.Unmarshal(created.Body.Bytes(), &attempt); err != nil {
		t.Fatal(err)
	}
	answer := attempt.Prompt.Options[0]
	submit, _ := json.Marshal(model.LearningAttemptSubmitInput{Answer: answer, ContentVersion: attempt.ContentVersion, RulesVersion: attempt.RulesVersion})
	post := httptest.NewRequest("POST", "/v1/learning/attempts/"+attempt.AttemptID+"/submit", strings.NewReader(string(submit)))
	post.Header.Set("Authorization", "Bearer "+token)
	result := httptest.NewRecorder()
	handler.ServeHTTP(result, post)
	if result.Code != 200 || !strings.Contains(result.Body.String(), `"evidence":"server-objective"`) {
		t.Fatal(result.Code, result.Body.String())
	}
}

func TestCollocationProgressionAndRecovery(t *testing.T) {
	for _, mode := range []string{"guest", "account"} {
		for _, correct := range []bool{false, true} {
			t.Run(fmt.Sprintf("%s/correct=%t", mode, correct), func(t *testing.T) {
				st, err := store.New("")
				if err != nil {
					t.Fatal(err)
				}
				defer st.Close()
				service := auth.New("test-only-secret", time.Hour)
				social := realtime.New("")
				defer social.Close()
				handler := New(st, service, ai.New("http://127.0.0.1:1"), social).Handler()
				user, err := st.CreateUser(context.Background(), "collocation-flow@example.test", "hash", "Learner")
				if err != nil {
					t.Fatal(err)
				}
				token := ""
				if mode == "account" {
					token, _ = service.Issue(user.ID)
				}
				call := func(method, path string, body any, bearer string) *httptest.ResponseRecorder {
					raw, _ := json.Marshal(body)
					request := httptest.NewRequest(method, path, strings.NewReader(string(raw)))
					if bearer != "" {
						request.Header.Set("Authorization", "Bearer "+bearer)
					}
					response := httptest.NewRecorder()
					handler.ServeHTTP(response, request)
					return response
				}
				base := "/v1/learning/attempts"
				input := model.LearningAttemptStartInput{RequestID: "32345678-1234-4123-8123-123456789012", Activity: "collocation-factory", Pack: "work-standup", CEFRLevel: "B1"}
				created := call("POST", base, input, token)
				if created.Code != 201 {
					t.Fatal(created.Code, created.Body.String())
				}
				var a model.LearningAttemptStart
				if err := json.Unmarshal(created.Body.Bytes(), &a); err != nil {
					t.Fatal(err)
				}
				if a.Mode != mode || a.Prompt.Question == "" || a.Result != nil {
					t.Fatal("missing scenario or leaked verdict", a)
				}
				if retry := call("POST", base, input, token); retry.Code != 200 || retry.Body.String() != created.Body.String() {
					t.Fatal("creation retry changed the round", retry.Body.String())
				}
				item, ok := learning.CollocationItemByID(a.ItemKey)
				if !ok {
					t.Fatal("unknown issued item")
				}
				answer := item.CorrectAnswer
				if !correct {
					for _, option := range a.Prompt.Options {
						if option != answer {
							answer = option
							break
						}
					}
				}
				payload := model.LearningAttemptSubmitInput{Answer: answer, ContentVersion: a.ContentVersion, RulesVersion: a.RulesVersion}
				invalid := payload
				invalid.Answer = "not an offered option"
				if bad := call("POST", base+"/"+a.AttemptID+"/submit", invalid, token); bad.Code != 400 {
					t.Fatal("invalid option accepted")
				}
				invalid = payload
				invalid.ContentVersion = "obsolete"
				if bad := call("POST", base+"/"+a.AttemptID+"/submit", invalid, token); bad.Code != 400 {
					t.Fatal("invalid version accepted")
				}
				submitted := call("POST", base+"/"+a.AttemptID+"/submit", payload, token)
				if submitted.Code != 200 {
					t.Fatal(submitted.Code, submitted.Body.String())
				}
				var verdict model.LearningAttemptResult
				if err := json.Unmarshal(submitted.Body.Bytes(), &verdict); err != nil {
					t.Fatal(err)
				}
				expectedXP := 0
				if mode == "account" && correct {
					expectedXP = 20
				}
				if verdict.Correct != correct || verdict.ActualAnswer != answer || verdict.CorrectAnswer != item.CorrectAnswer ||
					verdict.XPDelta != expectedXP || verdict.ReviewAdded != (mode == "account" && !correct) ||
					verdict.ProgressionApplied != (mode == "account") {
					t.Fatalf("incorrect verdict: %+v", verdict)
				}
				if retry := call("POST", base+"/"+a.AttemptID+"/submit", payload, token); retry.Body.String() != submitted.Body.String() {
					t.Fatal("submit retry changed result")
				}
				restored := call("GET", base+"/"+a.AttemptID, nil, token)
				var saved model.LearningAttemptStart
				if err := json.Unmarshal(restored.Body.Bytes(), &saved); err != nil {
					t.Fatal(err)
				}
				if restored.Code != 200 || saved.Result == nil || !reflect.DeepEqual(saved.Prompt, a.Prompt) || !reflect.DeepEqual(*saved.Result, verdict) {
					t.Fatal("resume changed prompt or result")
				}
				if mode == "account" && call("GET", base+"/"+a.AttemptID, nil, "").Code != 404 {
					t.Fatal("guest accessed account attempt")
				}
				input.RequestID = "42345678-1234-4123-8123-123456789012"
				replay := call("POST", base, input, token)
				var next model.LearningAttemptStart
				if err := json.Unmarshal(replay.Body.Bytes(), &next); err != nil {
					t.Fatal(err)
				}
				if next.ItemKey != a.ItemKey {
					t.Fatal("fixture should replay the campaign's first item")
				}
				payload.Answer = item.CorrectAnswer
				repeated := call("POST", base+"/"+next.AttemptID+"/submit", payload, token)
				var repeatedVerdict model.LearningAttemptResult
				if err := json.Unmarshal(repeated.Body.Bytes(), &repeatedVerdict); err != nil {
					t.Fatal(err)
				}
				if repeated.Code != 200 || !repeatedVerdict.Correct || repeatedVerdict.XPDelta != 0 || repeatedVerdict.ProgressionApplied {
					t.Fatal("daily replay awarded progress")
				}
				updated, _ := st.GetUser(context.Background(), user.ID)
				if updated.XP != expectedXP {
					t.Fatal("incorrect persisted XP", updated.XP)
				}
				reviews, _ := st.ReviewQueue(context.Background(), user.ID, 20)
				if mode == "account" && !correct {
					if len(reviews) != 1 || reviews[0].Answer != item.CorrectAnswer {
						t.Fatal("review did not teach correct answer", reviews)
					}
				} else if len(reviews) != 0 {
					t.Fatal("unexpected review", reviews)
				}
			})
		}
	}
}
