package httpapi

import (
	"encoding/json"
	"net/http/httptest"
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

func TestDictationHTTP(t *testing.T) {
	s, _ := store.New("")
	defer s.Close()
	social := realtime.New("")
	defer social.Close()
	h := New(s, auth.New("dictation-test", time.Hour), ai.New("http://127.0.0.1:1"), social).Handler()
	call := func(path string, body any) *httptest.ResponseRecorder {
		raw, _ := json.Marshal(body)
		w := httptest.NewRecorder()
		h.ServeHTTP(w, httptest.NewRequest("POST", path, strings.NewReader(string(raw))))
		return w
	}
	in := model.LearningAttemptStartInput{RequestID: "12345678-1234-4123-8123-123456789012", Activity: "dictation", CEFRLevel: "B1", Pack: "cefr-core"}
	created := call("/v1/learning/attempts", in)
	if created.Code != 201 {
		t.Fatal(created.Body.String())
	}
	var a model.LearningAttemptStart
	json.Unmarshal(created.Body.Bytes(), &a)
	item, err := learning.PickDictation("B1", "cefr-core", in.RequestID, nil)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(created.Body.String(), item.Transcript) || strings.Contains(created.Body.String(), "correctAnswer") || len(a.Prompt.Options) != 0 || a.Listening == nil {
		t.Fatal("public projection", created.Body.String())
	}
	path := "/v1/learning/attempts/" + a.AttemptID
	answer := item.Transcript + " extra"
	payload := model.LearningAttemptSubmitInput{Answer: answer, ContentVersion: a.ContentVersion, RulesVersion: a.RulesVersion}
	if call(path+"/submit", payload).Code != 409 {
		t.Fatal("unplayed grade")
	}
	event := map[string]any{"requestId": "22345678-1234-4123-8123-123456789012", "rate": 1, "status": "requested", "contentVersion": a.ContentVersion, "rulesVersion": a.RulesVersion}
	prepared := call(path+"/audio", event)
	if prepared.Code != 200 || !strings.Contains(prepared.Body.String(), item.Transcript) {
		t.Fatal("fallback", prepared.Body.String())
	}
	event["status"], event["provider"] = "failed", "browser-speech-synthesis"
	if call(path+"/audio", event).Code != 200 || call(path+"/submit", payload).Code != 409 {
		t.Fatal("failure gate")
	}
	event["requestId"], event["status"], event["provider"] = "32345678-1234-4123-8123-123456789012", "requested", ""
	if call(path+"/audio", event).Code != 200 {
		t.Fatal("replay")
	}
	event["status"], event["provider"] = "completed", "browser-speech-synthesis"
	if call(path+"/audio", event).Code != 200 {
		t.Fatal("completion")
	}
	if call(path+"/submit", map[string]any{"answer": answer, "accuracy": 1, "contentVersion": a.ContentVersion, "rulesVersion": a.RulesVersion}).Code != 400 {
		t.Fatal("accepted client score")
	}
	graded := call(path+"/submit", payload)
	var result model.LearningAttemptResult
	json.Unmarshal(graded.Body.Bytes(), &result)
	if graded.Code != 200 || result.Correct || result.XPDelta != 0 || result.ProgressionApplied || result.Dictation == nil || result.Dictation.Extra != 1 || result.Dictation.Accuracy >= 1 || result.ActualAnswer != answer || result.CorrectAnswer != item.Transcript {
		t.Fatal("grade", graded.Body.String())
	}
	if call(path+"/submit", payload).Body.String() != graded.Body.String() {
		t.Fatal("retry changed result")
	}
	payload.Answer = item.Transcript
	if call(path+"/submit", payload).Code != 409 {
		t.Fatal("correction overwrote first answer")
	}
	for _, alias := range []string{"dictation", " DICTATION "} {
		if call("/v1/attempts", map[string]any{"activity": alias, "skill": "Dictation", "itemKey": "fake", "accuracy": 1}).Code != 409 {
			t.Fatal("legacy bypass")
		}
	}
}
