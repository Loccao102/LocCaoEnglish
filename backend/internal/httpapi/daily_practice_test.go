package httpapi

import (
	"context"
	"encoding/json"
	"fmt"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/ai"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/auth"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/daily"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/model"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/realtime"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/store"
	"net/http/httptest"
	"reflect"
	"strings"
	"sync"
	"testing"
	"time"
)

func TestDailyHTTPFrozenPlanAndAtomicClaim(t *testing.T) {
	st, e := store.New("")
	if e != nil {
		t.Fatal(e)
	}
	defer st.Close()
	social := realtime.New("")
	defer social.Close()
	authn := auth.New("daily-http-only", time.Hour)
	handler := New(st, authn, ai.New("http://127.0.0.1:1"), social).Handler()
	u, _ := st.CreateUser(context.Background(), "daily-http@example.test", "hash", "Daily")
	token, _ := authn.Issue(u.ID)
	other, _ := st.CreateUser(context.Background(), "daily-other@example.test", "hash", "Other")
	otherToken, _ := authn.Issue(other.ID)
	call := func(method, path string, body any, bearer string) *httptest.ResponseRecorder {
		raw, _ := json.Marshal(body)
		r := httptest.NewRequest(method, path, strings.NewReader(string(raw)))
		r.RemoteAddr = "192.0.2.110:1"
		if bearer != "" {
			r.Header.Set("Authorization", "Bearer "+bearer)
		}
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, r)
		return w
	}
	root := "/v1/player/daily"
	for _, method := range []string{"GET", "POST"} {
		path := root
		if method == "POST" {
			path += "/claim"
		}
		if w := call(method, path, nil, ""); w.Code != 401 {
			t.Fatal("guest daily write/read", w.Code)
		}
	}
	profile := model.PlayerProfile{Goal: "ielts", CEFRLevel: "B1", DailyMinutes: 15, TargetBand: 7, Interests: []string{"daily-life"}}
	if w := call("PUT", "/v1/player/profile", profile, token); w.Code != 200 {
		t.Fatal(w.Code, w.Body.String())
	}
	w := call("GET", root, nil, token)
	if w.Code != 200 {
		t.Fatal(w.Code, w.Body.String())
	}
	var initial model.DailyRun
	_ = json.Unmarshal(w.Body.Bytes(), &initial)
	if initial.Total != 3 || initial.Completed != 0 || initial.Claimable || initial.RulesVersion != daily.RulesVersion {
		t.Fatal(initial)
	}
	input := map[string]any{"date": initial.Date, "rulesVersion": initial.RulesVersion}
	if w := call("POST", root+"/claim", nil, token); w.Code != 400 {
		t.Fatal("missing dated identity", w.Code)
	}
	if w := call("POST", root+"/claim", input, token); w.Code != 409 {
		t.Fatal("unearned chest", w.Code)
	}
	if w := call("POST", root+"/claim", map[string]any{"date": initial.Date, "rulesVersion": initial.RulesVersion, "rewardXp": 999999}, token); w.Code != 400 {
		t.Fatal("client reward", w.Code)
	}
	original := append([]model.DailyQuest{}, initial.Quests...)
	for i, q := range initial.Quests {
		opened := call("POST", "/v1/learning/attempts", model.LearningAttemptStartInput{RequestID: fmt.Sprintf("12345678-1234-4123-8123-%012d", i+1), Activity: q.Activity, Pack: "cefr-core", CEFRLevel: "B1"}, token)
		if opened.Code != 201 {
			t.Fatal(opened.Code, opened.Body.String())
		}
		var attempt model.LearningAttemptStart
		_ = json.Unmarshal(opened.Body.Bytes(), &attempt)
		answer := "Different words."
		if q.Activity == "reading-race" {
			answer = attempt.Prompt.Options[0]
		}
		if q.Activity == "sentence-builder" {
			ids := []string{}
			for _, chunk := range attempt.Prompt.Chunks {
				ids = append(ids, chunk.ID)
			}
			raw, _ := json.Marshal(ids)
			answer = string(raw)
		}
		submitted := call("POST", "/v1/learning/attempts/"+attempt.AttemptID+"/submit", model.LearningAttemptSubmitInput{Answer: answer, ContentVersion: attempt.ContentVersion, RulesVersion: attempt.RulesVersion}, token)
		if submitted.Code != 200 {
			t.Fatal(submitted.Code, submitted.Body.String())
		}
	}
	profile.Goal = "travel"
	if w := call("PUT", "/v1/player/profile", profile, token); w.Code != 200 {
		t.Fatal(w.Code)
	}
	w = call("GET", root, nil, token)
	var ready model.DailyRun
	_ = json.Unmarshal(w.Body.Bytes(), &ready)
	if ready.Completed != 3 || !ready.Claimable {
		t.Fatal("missing actual practice", ready, w.Body.String())
	}
	for i, q := range ready.Quests {
		q.Complete = false
		if !reflect.DeepEqual(q, original[i]) {
			t.Fatal("daily plan moved", ready)
		}
	}
	before, _ := st.GetUser(context.Background(), u.ID)
	var wg sync.WaitGroup
	for i := 0; i < 8; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			res := call("POST", root+"/claim", input, token)
			if res.Code != 200 {
				t.Error(res.Code, res.Body.String())
			}
			var run model.DailyRun
			_ = json.Unmarshal(res.Body.Bytes(), &run)
			if !run.Claimed || run.Receipt == nil || len(run.Receipt.Evidence) != 3 {
				t.Error("missing receipt", run)
			}
		}()
	}
	wg.Wait()
	after, _ := st.GetUser(context.Background(), u.ID)
	if after.XP-before.XP != 50 {
		t.Fatal("duplicate chest", before.XP, after.XP)
	}
	if w := call("GET", root+"/claims/"+initial.Date, nil, otherToken); w.Code != 404 {
		t.Fatal("claim owner leak", w.Code)
	}
	w = call("GET", root, nil, otherToken)
	var clean model.DailyRun
	_ = json.Unmarshal(w.Body.Bytes(), &clean)
	if clean.Completed != 0 || clean.Claimed {
		t.Fatal("account evidence leak")
	}
	w = call("GET", root, nil, token)
	var restored model.DailyRun
	_ = json.Unmarshal(w.Body.Bytes(), &restored)
	if !restored.Claimed || restored.Claimable || restored.Receipt == nil || restored.Receipt.RewardXP != 50 {
		t.Fatal("claim not restored", restored)
	}
}
