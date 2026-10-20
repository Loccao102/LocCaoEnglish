package httpapi

import (
	"context"
	"encoding/json"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/ai"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/auth"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/realtime"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/store"
	"net/http/httptest"
	"reflect"
	"strings"
	"testing"
	"time"
)

func TestAllClientScoreAliasesRetired(t *testing.T) {
	st, e := store.New("")
	if e != nil {
		t.Fatal(e)
	}
	defer st.Close()
	social := realtime.New("")
	defer social.Close()
	authn := auth.New("boundary-only", time.Hour)
	u, _ := st.CreateUser(context.Background(), "boundary@example.test", "hash", "Learner")
	token, _ := authn.Issue(u.ID)
	skills, _ := st.Skills(context.Background(), u.ID)
	handler := New(st, authn, ai.New("http://127.0.0.1:1"), social).Handler()
	call := func(method, path, body, bearer string) *httptest.ResponseRecorder {
		r := httptest.NewRequest(method, path, strings.NewReader(body))
		r.RemoteAddr = "192.0.2.100:1"
		if bearer != "" {
			r.Header.Set("Authorization", "Bearer "+bearer)
		}
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, r)
		return w
	}
	for _, activity := range []string{"arbitrary-new-game", "placement", "lesson-choice", "lesson-input", " WORD-LINK ", "shadowing", "npc-conversation", "", "unknown"} {
		body, _ := json.Marshal(map[string]any{"activity": activity, "skill": "Vocabulary", "itemKey": "forged", "prompt": "fake", "answer": "target", "accuracy": 1})
		if w := call("POST", "/v1/attempts", string(body), token); w.Code != 409 {
			t.Fatal("client accuracy accepted", activity, w.Code)
		}
	}
	if w := call("POST", "/v1/attempts", "{}", "invalid"); w.Code != 401 {
		t.Fatal("invalid auth")
	}
	if w := call("POST", "/v1/social/challenges/missing/submit", `{"score":999999}`, token); w.Code != 409 {
		t.Fatal("arbitrary duel score accepted", w.Code)
	}
	if w := call("POST", "/v1/social/challenges/missing/submit", `{"score":999999}`, ""); w.Code != 401 {
		t.Fatal("guest duel write")
	}
	if w := call("POST", "/v1/lessons/airport-check-in-sprint/complete", `{"completed":3,"score":1}`, ""); w.Code != 401 {
		t.Fatal("guest writes shared bookmark")
	}
	if w := call("POST", "/v1/lessons/airport-check-in-sprint/complete", `{"completed":999,"score":1}`, token); w.Code != 400 {
		t.Fatal("invalid bookmark count", w.Code)
	}
	if w := call("POST", "/v1/lessons/airport-check-in-sprint/complete", `{"completed":3,"score":1}`, token); w.Code != 200 || !strings.Contains(w.Body.String(), "client-reported-bookmark") {
		t.Fatal("bookmark evidence", w.Code, w.Body.String())
	}
	w := call("GET", "/v1/social/leaderboard", "", token)
	if w.Code != 200 || !strings.Contains(w.Body.String(), store.CheckedPracticeMethod) || !strings.Contains(w.Body.String(), "Guided practice") {
		t.Fatal("missing rank provenance", w.Code, w.Body.String())
	}
	after, _ := st.GetUser(context.Background(), u.ID)
	afterSkills, _ := st.Skills(context.Background(), u.ID)
	reviews, _ := st.ReviewQueue(context.Background(), u.ID, 100)
	if after.XP != u.XP || !reflect.DeepEqual(skills, afterSkills) || len(reviews) != 0 {
		t.Fatal("retired writes changed progress")
	}
}
