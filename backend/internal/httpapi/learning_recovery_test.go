package httpapi

import (
	"context"
	"encoding/json"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/ai"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/auth"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/model"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/realtime"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/store"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestVerifiedLearningRecoveryHTTP(t *testing.T) {
	st, err := store.New("")
	if err != nil {
		t.Fatal(err)
	}
	defer st.Close()
	service := auth.New("test-only-secret", time.Hour)
	social := realtime.New("")
	defer social.Close()
	handler := New(st, service, ai.New("http://127.0.0.1:1"), social).Handler()
	user, _ := st.CreateUser(context.Background(), "learning-http@example.test", "hash", "Learner")
	token, _ := service.Issue(user.ID)
	call := func(method, path, body, bearer string) *httptest.ResponseRecorder {
		r := httptest.NewRequest(method, path, strings.NewReader(body))
		if bearer != "" {
			r.Header.Set("Authorization", "Bearer "+bearer)
		}
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, r)
		return w
	}
	base := "/v1/learning/attempts"
	body := `{"requestId":"12345678-1234-4123-8123-123456789012","activity":"word-link","pack":"travel-airport","cefrLevel":"B1"}`
	if w := call("POST", base, body, "bad"); w.Code != 401 {
		t.Fatal("bad token became guest")
	}
	w := call("POST", base, body, token)
	if w.Code != 201 {
		t.Fatal(w.Code, w.Body.String())
	}
	var a model.LearningAttemptStart
	if err = json.Unmarshal(w.Body.Bytes(), &a); err != nil {
		t.Fatal(err)
	}
	if strings.Contains(w.Body.String(), `"correctAnswer"`) || strings.Contains(w.Body.String(), `"feedback"`) {
		t.Fatal("answer key leaked")
	}
	w = call("GET", base+"/"+a.AttemptID, "", token)
	if w.Code != 200 {
		t.Fatal("resume failed")
	}
	if w = call("GET", base+"/"+a.AttemptID, "", ""); w.Code != 404 {
		t.Fatal("guest read account")
	}
	input := model.LearningAttemptSubmitInput{Answer: "board the flight", ContentVersion: a.ContentVersion, RulesVersion: a.RulesVersion}
	raw, _ := json.Marshal(input)
	if w = call("POST", base+"/"+a.AttemptID+"/submit", strings.TrimSuffix(string(raw), "}")+`,"score":100}`, token); w.Code != 400 {
		t.Fatal("client score accepted")
	}
	w = call("POST", base+"/"+a.AttemptID+"/submit", string(raw), token)
	if w.Code != 200 {
		t.Fatal(w.Code, w.Body.String())
	}
	first := w.Body.String()
	w = call("POST", base+"/"+a.AttemptID+"/submit", string(raw), token)
	if w.Code != 200 || w.Body.String() != first {
		t.Fatal("retry differs")
	}
	u, _ := st.GetUser(context.Background(), user.ID)
	if u.XP != 20 {
		t.Fatal("wrong XP", u.XP)
	}
	w = call("GET", base+"/"+a.AttemptID, "", token)
	if !strings.Contains(w.Body.String(), `"result"`) {
		t.Fatal("completed resume lost result")
	}
	for _, activity := range []string{"word-link", "grammar-repair"} {
		w = call("POST", "/v1/attempts", `{"activity":"`+activity+`","skill":"Vocabulary","itemKey":"fake","accuracy":1}`, token)
		if w.Code != 409 {
			t.Fatal("legacy bypass", activity, w.Code)
		}
	}
	w = call("POST", base, body, "")
	if w.Code != 201 {
		t.Fatal(w.Code, w.Body.String())
	}
	if !strings.Contains(w.Body.String(), `"mode":"guest"`) {
		t.Fatal("guest bound to demo")
	}
}
