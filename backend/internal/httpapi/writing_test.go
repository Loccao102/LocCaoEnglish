package httpapi

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/Loccao102/LocCaoEnglish/backend/internal/ai"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/auth"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/realtime"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/store"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/writing"
)

func TestWritingHTTPProviderAndRecovery(t *testing.T) {
	st, err := store.New("")
	if err != nil {
		t.Fatal(err)
	}
	defer st.Close()
	service := auth.New("writing-test-only", time.Hour)
	social := realtime.New("")
	defer social.Close()
	var calls atomic.Int32
	var mode atomic.Int32
	provider := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		var input struct{ Essay, Task, RulesVersion string }
		_ = json.NewDecoder(r.Body).Decode(&input)
		if input.Task != writing.Task || input.RulesVersion != writing.RulesVersion {
			t.Error("provider received client task/version")
		}
		if mode.Load() == 0 {
			w.WriteHeader(503)
			return
		}
		zero := 0.0
		f := writing.Feedback{Provider: "configured-llm", Model: "http-fixture", EvaluatorVersion: writing.EvaluatorVersion, RulesVersion: writing.RulesVersion, Overall: &zero, Criteria: map[string]writing.Criterion{}, Strengths: []string{"Topic identified."}, Improvements: []string{"Add an example."}}
		for _, key := range writing.Criteria {
			f.Criteria[key] = writing.Criterion{Band: &zero, Evidence: "Public transport", Comment: "Develop this claim."}
		}
		if mode.Load() == 2 {
			f.Overall = nil
		}
		_ = json.NewEncoder(w).Encode(f)
	}))
	defer provider.Close()
	handler := New(st, service, ai.New(provider.URL), social).Handler()
	u, _ := st.CreateUser(context.Background(), "writing-http@example.test", "hash", "Writer")
	token, _ := service.Issue(u.ID)
	other, _ := st.CreateUser(context.Background(), "writing-other@example.test", "hash", "Other")
	otherToken, _ := service.Issue(other.ID)
	call := func(method, path string, input any, bearer string) *httptest.ResponseRecorder {
		b, _ := json.Marshal(input)
		r := httptest.NewRequest(method, path, strings.NewReader(string(b)))
		r.RemoteAddr = "192.0.2.42:1000"
		if bearer != "" {
			r.Header.Set("Authorization", "Bearer "+bearer)
		}
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, r)
		return w
	}
	base := "/v1/ielts/writing/attempts"
	for _, path := range []string{base, base + "/missing", "/v1/ai/writing-score"} {
		method := "GET"
		if strings.Contains(path, "writing-score") {
			method = "POST"
		}
		if w := call(method, path, nil, ""); w.Code != 401 {
			t.Fatal("guest access", path, w.Code)
		}
	}
	if w := call("POST", "/v1/ai/writing-score", map[string]any{}, token); w.Code != 409 {
		t.Fatal("legacy proxy still accepts scoring", w.Code)
	}
	if w := call("POST", "/v1/attempts", map[string]any{"activity": "ielts-writing-task2", "skill": "Writing", "itemKey": "forged", "accuracy": 1}, token); w.Code != 409 {
		t.Fatal("legacy XP bypass", w.Code)
	}
	if w := call("POST", base, map[string]any{"requestId": "writing-http-request", "task": "forged"}, token); w.Code != 400 {
		t.Fatal("client task accepted")
	}
	res := call("POST", base, writing.StartInput{RequestID: "writing-http-request"}, token)
	if res.Code != 201 {
		t.Fatal(res.Code, res.Body.String())
	}
	var a writing.Attempt
	_ = json.Unmarshal(res.Body.Bytes(), &a)
	if w := call("GET", base+"/"+a.ID, nil, otherToken); w.Code != 404 {
		t.Fatal("owner leak")
	}
	in := writing.SaveInput{RulesVersion: writing.RulesVersion, Essay: strings.Repeat("Public transport can help workers get to work. ", 10)}
	if w := call("PUT", base+"/"+a.ID+"/draft", in, token); w.Code != 200 {
		t.Fatal(w.Code, w.Body.String())
	}
	in.Version = 1
	submit := writing.SubmitInput{SaveInput: in}
	for i, want := range []string{"failed", "failed", "completed"} {
		submit.Generation = i
		if i == 1 {
			mode.Store(2)
		}
		if i == 2 {
			mode.Store(1)
		}
		w := call("POST", base+"/"+a.ID+"/submit", submit, token)
		if w.Code != 200 {
			t.Fatal(w.Code, w.Body.String())
		}
		_ = json.Unmarshal(w.Body.Bytes(), &a)
		if a.Status != want || a.Essay != in.Essay {
			t.Fatal("failed to retain submission", a.Status, want)
		}
		if want == "failed" && a.Feedback != nil {
			t.Fatal("fabricated fallback")
		}
	}
	before := calls.Load()
	w := call("POST", base+"/"+a.ID+"/submit", in, token)
	if w.Code != 200 || calls.Load() != before {
		t.Fatal("retry called provider")
	}
	bad := map[string]any{"essay": in.Essay, "version": 1, "rulesVersion": in.RulesVersion, "overall": 9}
	if w = call("POST", base+"/"+a.ID+"/submit", bad, token); w.Code != 400 {
		t.Fatal("client band accepted")
	}
	h := call("GET", "/v1/ielts/history", nil, token)
	if h.Code != 200 || !strings.Contains(h.Body.String(), `"evidence":"provider-estimate"`) {
		t.Fatal("missing history", h.Body.String())
	}
	if calls.Load() != 3 {
		t.Fatal(fmt.Sprintf("provider calls=%d", calls.Load()))
	}
}
