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
