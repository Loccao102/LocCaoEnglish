package httpapi

import (
	"context"
	"encoding/base64"
	"encoding/binary"
	"encoding/json"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/acoustic"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/ai"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/auth"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/model"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/realtime"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/store"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

func TestAcousticHTTPReceipts(t *testing.T) {
	st, e := store.New("")
	if e != nil {
		t.Fatal(e)
	}
	defer st.Close()
	social := realtime.New("")
	defer social.Close()
	authn := auth.New("acoustic-http-only", time.Hour)
	var calls atomic.Int32
	var mode atomic.Int32
	provider := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		if mode.Load() == 0 {
			w.WriteHeader(503)
			return
		}
		var in struct{ AudioBase64, ReferenceText, Transcript, Locale string }
		_ = json.NewDecoder(r.Body).Decode(&in)
		if r.URL.Path != "/v1/pronunciation/score" || in.ReferenceText != "Hello there." || in.Transcript != "Hello" || in.Locale != "en-US" {
			t.Error("unbound provider input", in)
		}
		b, _ := base64.StdEncoding.DecodeString(in.AudioBase64)
		z := 0.0
		f := acoustic.Feedback{Provider: acoustic.Provider, Model: acoustic.Model, MethodVersion: acoustic.MethodVersion, Locale: "en-US", AudioSHA256: acoustic.Hash(b), ReferenceSHA256: acoustic.Hash([]byte(in.ReferenceText)), AcousticAssessment: true, Overall: &z, Scores: map[string]*float64{"accuracy": &z, "fluency": &z, "completeness": &z}, Coaching: []string{"Repeat slowly."}}
		if mode.Load() == 2 {
			f.ReferenceSHA256 = "wrong"
		}
		_ = json.NewEncoder(w).Encode(f)
	}))
	defer provider.Close()
	h := New(st, authn, ai.New(provider.URL), social).Handler()
	u, _ := st.CreateUser(context.Background(), "acoustic-http@example.test", "hash", "Speaker")
	token, _ := authn.Issue(u.ID)
	other, _ := st.CreateUser(context.Background(), "acoustic-http-other@example.test", "hash", "Other")
	otherToken, _ := authn.Issue(other.ID)
	snap := store.LearningSnapshot{Input: model.LearningAttemptStartInput{Activity: "shadowing", Pack: "cefr-core", CEFRLevel: "B1"}, Prompt: model.LearningAttemptPrompt{Question: "Hello there.", Options: []string{}}}
	parent, _, e := st.StartLearningAttempt(context.Background(), u.ID, "parent", "shadowing", "Speaking", "hello", "B1", "saved.v1", "shadowing.v1", "Hello there.", "Hello there.", "Practice.", snap)
	if e != nil {
		t.Fatal(e)
	}
	b := make([]byte, 76)
	copy(b, "RIFF")
	binary.LittleEndian.PutUint32(b[4:], 68)
	copy(b[8:], "WAVEfmt ")
	binary.LittleEndian.PutUint32(b[16:], 16)
	binary.LittleEndian.PutUint16(b[20:], 1)
	binary.LittleEndian.PutUint16(b[22:], 1)
	binary.LittleEndian.PutUint32(b[24:], 16000)
	binary.LittleEndian.PutUint32(b[28:], 32000)
	binary.LittleEndian.PutUint16(b[32:], 2)
	binary.LittleEndian.PutUint16(b[34:], 16)
	copy(b[36:], "data")
	binary.LittleEndian.PutUint32(b[40:], 32)
	audio := base64.StdEncoding.EncodeToString(b)
	call := func(method, path string, in any, bearer string) *httptest.ResponseRecorder {
		raw, _ := json.Marshal(in)
		r := httptest.NewRequest(method, path, strings.NewReader(string(raw)))
		r.RemoteAddr = "192.0.2.88:1000"
		if bearer != "" {
			r.Header.Set("Authorization", "Bearer "+bearer)
		}
		w := httptest.NewRecorder()
		h.ServeHTTP(w, r)
		return w
	}
	base := "/v1/speaking/assessments"
	if w := call("GET", base, nil, ""); w.Code != 401 {
		t.Fatal("guest history", w.Code)
	}
	in := acoustic.StartInput{RequestID: "acoustic-http-request", AttemptID: parent.ID, Transcript: "Hello", ContentVersion: "saved.v1", TranscriptRulesVersion: "shadowing.v1", RulesVersion: acoustic.RulesVersion, AudioBase64: audio}
	if w := call("POST", base, in, otherToken); w.Code != 404 {
		t.Fatal("foreign parent", w.Code)
	}
	forged := map[string]any{"requestId": in.RequestID, "overall": 100}
	if w := call("POST", base, forged, token); w.Code != 400 {
		t.Fatal("client score", w.Code)
	}
	w := call("POST", base, in, token)
	var item acoustic.Receipt
	_ = json.Unmarshal(w.Body.Bytes(), &item)
	if w.Code != 200 || item.Status != "failed" || item.Feedback != nil {
		t.Fatal(w.Code, w.Body.String())
	}
	if w = call("POST", base, in, token); w.Code != 200 || calls.Load() != 1 {
		t.Fatal("duplicate initial evaluation", w.Code, calls.Load())
	}
	if w = call("POST", base+"/"+item.ID+"/retry", acoustic.RetryInput{Generation: 1}, token); w.Code != 409 {
		t.Fatal("hash-only retry", w.Code)
	}
	mode.Store(2)
	w = call("POST", base+"/"+item.ID+"/retry", acoustic.RetryInput{Generation: 1, AudioBase64: audio}, token)
	_ = json.Unmarshal(w.Body.Bytes(), &item)
	if item.Status != "failed" || item.Feedback != nil {
		t.Fatal("mismatched provider input accepted")
	}
	mode.Store(1)
	w = call("POST", base+"/"+item.ID+"/retry", acoustic.RetryInput{Generation: 2, AudioBase64: audio}, token)
	_ = json.Unmarshal(w.Body.Bytes(), &item)
	if w.Code != 200 || item.Status != "completed" || *item.Feedback.Overall != 0 {
		t.Fatal(w.Code, w.Body.String())
	}
	if w = call("POST", base+"/"+item.ID+"/retry", acoustic.RetryInput{Generation: 0}, token); w.Code != 200 || calls.Load() != 3 {
		t.Fatal("completed provider repeated")
	}
	for _, path := range []string{base + "/" + item.ID, base + "/by-request/" + in.RequestID} {
		if w = call("GET", path, nil, otherToken); w.Code != 404 {
			t.Fatal("owner leak")
		}
		if w = call("GET", path, nil, token); w.Code != 200 || strings.Contains(w.Body.String(), "audioBase64") {
			t.Fatal("saved recovery", w.Code)
		}
	}
	if w = call("GET", base, nil, token); w.Code != 200 || !strings.Contains(w.Body.String(), `"status":"completed"`) {
		t.Fatal("history", w.Body.String())
	}
}
