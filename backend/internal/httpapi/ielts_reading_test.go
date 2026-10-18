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

func TestIELTSObjectiveHTTPContract(t *testing.T) {
	for _, activity := range []string{"ielts-reading", "ielts-listening"} {
		t.Run(activity, func(t *testing.T) { testIELTSHTTP(t, activity) })
	}
}
func testIELTSHTTP(t *testing.T, activity string) {
	pack := learning.IELTSReadingPack
	if activity == "ielts-listening" {
		pack = learning.IELTSListeningPack
	}
	ctx := context.Background()
	st, err := store.New("")
	if err != nil {
		t.Fatal(err)
	}
	defer st.Close()
	service := auth.New("ielts-test-only", time.Hour)
	social := realtime.New("")
	defer social.Close()
	handler := New(st, service, ai.New("http://127.0.0.1:1"), social).Handler()
	u, err := st.CreateUser(ctx, "ielts-http@example.test", "hash", "Reader")
	if err != nil {
		t.Fatal(err)
	}
	token, _ := service.Issue(u.ID)
	other, err := st.CreateUser(ctx, "ielts-http-other@example.test", "hash", "Other")
	if err != nil {
		t.Fatal(err)
	}
	otherToken, _ := service.Issue(other.ID)
	call := func(method, path string, body any, bearer string) *httptest.ResponseRecorder {
		raw, _ := json.Marshal(body)
		r := httptest.NewRequest(method, path, strings.NewReader(string(raw)))
		// Each fixture represents its own client; avoid consuming neighboring
		// HTTP suites' shared default httptest source-IP budget.
		r.RemoteAddr = "192.0.2.18:1234"
		if activity == "ielts-listening" {
			r.RemoteAddr = "192.0.2.19:1234"
		}
		if bearer != "" {
			r.Header.Set("Authorization", "Bearer "+bearer)
		}
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, r)
		return w
	}
	input := model.LearningAttemptStartInput{RequestID: "92345678-1234-4123-8123-123456789012", Activity: activity, Pack: pack, CEFRLevel: "B2"}
	base := "/v1/learning/attempts"
	for _, path := range []string{"/v1/ielts/history", "/v1/ielts/band", "/v1/ielts/objective-score"} {
		method := "POST"
		if strings.HasSuffix(path, "history") {
			method = "GET"
		}
		if r := call(method, path, map[string]any{}, ""); r.Code != 401 {
			t.Fatal("guest IELTS access", path, r.Code)
		}
	}
	if r := call("POST", base, input, ""); r.Code != 401 {
		t.Fatal("guest reading start", r.Code)
	}
	for _, level := range []string{"A1", "C2"} {
		bad := input
		bad.CEFRLevel = level
		if r := call("POST", base, bad, token); r.Code != 400 {
			t.Fatal("unsupported level", r.Code)
		}
	}
	created := call("POST", base, input, token)
	if created.Code != 201 {
		t.Fatal(created.Code, created.Body.String())
	}
	for _, private := range []string{"correctAnswer", "correctOptions", "correctOptionId", "feedback", "answer", "ielts"} {
		if strings.Contains(created.Body.String(), `"`+private+`"`) {
			t.Fatal("private field leaked", private)
		}
	}
	var a model.LearningAttemptStart
	if err = json.Unmarshal(created.Body.Bytes(), &a); err != nil {
		t.Fatal(err)
	}
	paper, parts := a.Prompt.Reading, 3
	if activity == "ielts-listening" {
		paper, parts = a.Prompt.ListeningPaper, 4
	}
	if a.Mode != "account" || paper == nil || len(paper.Sections) != parts || a.Result != nil {
		t.Fatal("invalid issued reading")
	}
	if r := call("POST", base, input, token); r.Code != 200 || r.Body.String() != created.Body.String() {
		t.Fatal("create retry changed snapshot", r.Code)
	}
	if r := call("GET", base+"/"+a.AttemptID, nil, token); r.Code != 200 || r.Body.String() != created.Body.String() {
		t.Fatal("GET changed snapshot", r.Code)
	}
	for _, bearer := range []string{"", otherToken} {
		if r := call("GET", base+"/"+a.AttemptID, nil, bearer); r.Code != 404 {
			t.Fatal("foreign read", r.Code)
		}
	}
	rec, err := st.GetLearningAttempt(ctx, u.ID, a.AttemptID)
	if err != nil {
		t.Fatal(err)
	}
	selections := [][]string{}
	for _, section := range paper.Sections {
		for _, q := range section.Questions {
			selections = append(selections, []string{q.ID, rec.Snapshot.IELTS.CorrectOptions[q.ID]})
		}
	}
	raw, _ := json.Marshal(selections)
	payload := model.LearningAttemptSubmitInput{Answer: string(raw), ContentVersion: a.ContentVersion, RulesVersion: a.RulesVersion}
	submit := base + "/" + a.AttemptID + "/submit"
	bad := payload
	bad.RulesVersion = "old"
	if r := call("POST", submit, bad, token); r.Code != 400 {
		t.Fatal("version accepted", r.Code)
	}
	bad = payload
	bad.Answer = `[["R1","bad"]]`
	if r := call("POST", submit, bad, token); r.Code != 400 {
		t.Fatal("invalid selection accepted", r.Code)
	}
	if r := call("POST", submit, payload, otherToken); r.Code != 404 {
		t.Fatal("foreign submit", r.Code)
	}
	for _, activity := range []string{"ielts-reading", " IELTS-READING-calibration ", "ielts-listening", " IELTS-LISTENING-calibration "} {
		if r := call("POST", "/v1/attempts", model.AttemptInput{Skill: "Reading", Activity: activity, ItemKey: "test", Accuracy: 1}, token); r.Code != 409 {
			t.Fatal("legacy XP bypass", r.Code)
		}
	}
	if r := call("POST", "/v1/ielts/objective-score", map[string]any{"section": "READING", "correct": 40, "total": 40}, token); r.Code != 409 {
		t.Fatal("legacy reading tally", r.Code)
	}
	if r := call("POST", "/v1/ielts/band", map[string]any{"section": "speaking", "band": 9, "source": "server-objective"}, token); r.Code != 409 {
		t.Fatal("client band accepted", r.Code)
	}
	if activity == "ielts-listening" {
		if r := call("POST", submit, payload, token); r.Code != 409 {
			t.Fatal("unheard paper submitted", r.Code)
		}
		audioPath := base + "/" + a.AttemptID + "/audio"
		for i, part := range paper.Sections {
			event := map[string]any{"requestId": fmt.Sprintf("a2345678-1234-4123-8123-%012d", i+1), "partId": part.ID, "rate": 1, "status": "requested", "contentVersion": a.ContentVersion, "rulesVersion": a.RulesVersion}
			if i == 0 {
				event["partId"] = "foreign-part"
				if r := call("POST", audioPath, event, token); r.Code != 400 {
					t.Fatal("unknown part accepted", r.Code)
				}
				event["partId"] = part.ID
				if r := call("POST", audioPath, event, otherToken); r.Code != 404 {
					t.Fatal("foreign audio", r.Code)
				}
				event["contentVersion"] = "old"
				if r := call("POST", audioPath, event, token); r.Code != 400 {
					t.Fatal("audio version", r.Code)
				}
				event["contentVersion"] = a.ContentVersion
			}
			prepared := call("POST", audioPath, event, token)
			if prepared.Code != 200 {
				t.Fatal("prepare", prepared.Code, prepared.Body.String())
			}
			var playback struct {
				Attempt model.LearningAttemptStart
				Audio   struct{ Provider, Text string }
			}
			if err = json.Unmarshal(prepared.Body.Bytes(), &playback); err != nil || playback.Audio.Provider != "browser-speech-synthesis" || playback.Audio.Text != rec.Snapshot.Listening.Transcripts[part.ID] || playback.Attempt.Listening.Transcripts != nil {
				t.Fatal("wrong part/fallback/public transcript", err)
			}
			event["partId"] = paper.Sections[(i+1)%4].ID
			if r := call("POST", audioPath, event, token); r.Code != 409 {
				t.Fatal("audio ID reassigned to another part", r.Code)
			}
			event["partId"] = part.ID
			event["status"], event["provider"] = "completed", "browser-speech-synthesis"
			done := call("POST", audioPath, event, token)
			if done.Code != 200 {
				t.Fatal("completion", done.Code)
			}
			if r := call("POST", audioPath, event, token); r.Code != 200 || r.Body.String() != done.Body.String() {
				t.Fatal("audio retry changed evidence", r.Code)
			}
			if i < 3 {
				if r := call("POST", submit, payload, token); r.Code != 409 {
					t.Fatal("partial listening accepted", r.Code)
				}
			}
		}
	}
	response := call("POST", submit, payload, token)
	if response.Code != 200 {
		t.Fatal(response.Code, response.Body.String())
	}
	var result model.LearningAttemptResult
	if err = json.Unmarshal(response.Body.Bytes(), &result); err != nil {
		t.Fatal(err)
	}
	if result.IELTS == nil || result.IELTS.RawScore != 40 || result.IELTS.Percentage != 100 || !result.Correct || result.XPDelta != 0 || result.NewConfidence != 0 || result.Level != 0 || result.ReviewAdded || result.ProgressionApplied || result.ActualAnswer != payload.Answer || result.Evidence != learning.IELTSReadingEvidence {
		t.Fatal("wrong result", result)
	}
	if r := call("POST", submit, payload, token); r.Code != 200 || r.Body.String() != response.Body.String() {
		t.Fatal("submit retry changed receipt", r.Code)
	}
	bad = payload
	bad.Answer = "[]"
	if r := call("POST", submit, bad, token); r.Code != 409 {
		t.Fatal("changed completion accepted", r.Code)
	}
	var resumed model.LearningAttemptStart
	r := call("GET", base+"/"+a.AttemptID, nil, token)
	if err = json.Unmarshal(r.Body.Bytes(), &resumed); err != nil || !reflect.DeepEqual(resumed.Result, &result) {
		t.Fatal("GET lost verdict", err)
	}
	if r := call("POST", "/v1/ielts/objective-score", map[string]any{"section": "listening", "testType": "academic", "correct": 20, "total": 40}, token); r.Code != 409 {
		t.Fatal("reported listening tally accepted", r.Code, r.Body.String())
	}
	history, err := st.IELTSHistory(ctx, u.ID, 30)
	if err != nil || len(history) != 1 || history[0].AttemptID != a.AttemptID || history[0].Evidence != learning.IELTSReadingEvidence {
		t.Fatal("history provenance", history, err)
	}
	if r := call("GET", "/v1/ielts/history", nil, otherToken); r.Code != 200 || !strings.Contains(r.Body.String(), `"items":[]`) {
		t.Fatal("history crosses owner", r.Code, r.Body.String())
	}
	user, err := st.GetUser(ctx, u.ID)
	if err != nil || user.XP != 0 {
		t.Fatal("IELTS awarded XP", user, err)
	}
}
