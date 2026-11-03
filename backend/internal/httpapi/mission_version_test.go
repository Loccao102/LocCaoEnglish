package httpapi

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/Loccao102/LocCaoEnglish/backend/internal/ai"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/auth"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/engine"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/model"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/realtime"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/store"
)

// Seed only uses the public store APIs. The HTTP assertions below therefore
// exercise the same owner-scoped progression and receipt routes as a browser.
func seedMissionPractice(t *testing.T, s *store.Store, owner string) {
	t.Helper()
	ctx := context.Background()
	rules := map[string]string{
		"word-link": "word-link.v1", "grammar-repair": "grammar-repair.v1",
		"collocation-factory": "collocation-factory.v1", "listen-pick": "listen-pick.v1",
		"shadowing": "shadowing.v1",
	}
	skill := map[string]string{
		"word-link": "Vocabulary", "grammar-repair": "Grammar", "collocation-factory": "Vocabulary",
		"listen-pick": "Listening", "shadowing": "Speaking",
	}
	complete := func(activity, request string) {
		input := model.LearningAttemptStartInput{RequestID: request, Activity: activity, Pack: "cefr-core", CEFRLevel: "B1"}
		prompt := model.LearningAttemptPrompt{Question: "Choose glad.", Options: []string{"glad", "sad"}}
		snapshot := store.LearningSnapshot{Input: input, Prompt: prompt}
		if activity == "listen-pick" {
			snapshot.Listening = &store.ListeningSnapshot{Transcript: "glad", Events: []model.ListeningPlayback{}}
		}
		rec, _, err := s.StartLearningAttempt(ctx, owner, request, activity, skill[activity], request, "B1", "http-fixture."+request, rules[activity], prompt.Question, "glad", "Fixture feedback.", snapshot)
		if err != nil {
			t.Fatal(err)
		}
		if activity == "listen-pick" {
			e := model.ListeningPlayback{RequestID: request + "-play", Rate: 1, Status: "requested"}
			if _, err = s.RecordListeningPlayback(ctx, owner, rec.ID, rec.ContentVersion, rec.RulesVersion, e); err != nil {
				t.Fatal(err)
			}
			e.Status, e.Provider = "completed", "browser-speech-synthesis"
			if _, err = s.RecordListeningPlayback(ctx, owner, rec.ID, rec.ContentVersion, rec.RulesVersion, e); err != nil {
				t.Fatal(err)
			}
		}
		result, err := s.SubmitLearningAttempt(ctx, owner, rec.ID, "glad", model.LearningAttemptSubmitInput{ContentVersion: rec.ContentVersion, RulesVersion: rec.RulesVersion})
		if err != nil || !result.Correct {
			t.Fatalf("practice %s failed: %+v %v", activity, result, err)
		}
	}
	completeStory := func(request string) {
		current, _, err := s.StartStoryChoice(ctx, owner, model.LearningAttemptStartInput{RequestID: request, Activity: "story-choice", Pack: "hotel-check-in", CEFRLevel: "B1"})
		if err != nil {
			t.Fatal(err)
		}
		for {
			node, ok := current.Snapshot.Story.Definition.Node(current.Snapshot.Story.NodeID)
			if !ok {
				t.Fatal("missing story node")
			}
			answer := ""
			for _, choice := range node.Choices {
				if choice.Good {
					answer = choice.Label
					break
				}
			}
			result, submitErr := s.SubmitLearningAttempt(ctx, owner, current.ID, answer, model.LearningAttemptSubmitInput{ContentVersion: current.ContentVersion, RulesVersion: current.RulesVersion})
			if submitErr != nil || !result.Correct {
				t.Fatalf("story practice failed: %+v %v", result, submitErr)
			}
			if result.Story == nil || !result.Story.CanContinue {
				return
			}
			current, err = s.ContinueStoryChoice(ctx, owner, current.ID)
			if err != nil {
				t.Fatal(err)
			}
		}
	}

	for _, item := range []struct{ activity, request string }{
		{"word-link", "http-airport-vocab"}, {"listen-pick", "http-airport-listen"}, {"shadowing", "http-airport-speak"},
	} {
		complete(item.activity, item.request)
	}
	airport := []string{"I missed my flight today.", "Could you rebook me on the next flight?", "Yes please, book it. Which gate should I use?"}
	if _, err := s.CompleteBoss(ctx, owner, "airport-crisis", airport, engine.ConversationRulesVersion); err != nil {
		t.Fatal("airport fixture", err)
	}
	if progression, err := s.GetProgression(ctx, owner); err != nil {
		t.Fatal(err)
	} else {
		for _, boss := range progression.Bosses {
			if boss.ID == "airport-crisis" && boss.CompletedAt != nil {
				for !time.Now().UTC().After(*boss.CompletedAt) {
					time.Sleep(time.Millisecond)
				}
			}
		}
	}
	completeStory("http-hotel-reading")
	complete("grammar-repair", "http-hotel-grammar")
	complete("shadowing", "http-hotel-speak")
	hotel := []string{"My confirmed reservation is missing.", "My confirmation number is ABC123.", "What time is breakfast tomorrow?"}
	if _, err := s.CompleteBoss(ctx, owner, "hotel-reservation", hotel, engine.ConversationRulesVersion); err != nil {
		t.Fatal("hotel fixture", err)
	}
	// Campaign prerequisites must be completed strictly after the prior clear;
	// this also keeps the fixture stable on clocks with coarse resolution.
	if progression, err := s.GetProgression(ctx, owner); err != nil {
		t.Fatal(err)
	} else if progression.Bosses != nil {
		for _, boss := range progression.Bosses {
			if boss.ID == "hotel-reservation" && boss.CompletedAt != nil {
				for !time.Now().UTC().After(*boss.CompletedAt) {
					time.Sleep(time.Millisecond)
				}
			}
		}
	}
	for _, item := range []struct{ activity, request string }{
		{"collocation-factory", "http-city-vocab"}, {"listen-pick", "http-city-listen"}, {"shadowing", "http-city-speak"},
	} {
		complete(item.activity, item.request)
	}
}

func TestMissionVersionedHTTPCompatibilityAndOwner(t *testing.T) {
	s, err := store.New("")
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	ctx := context.Background()
	owner, err := s.CreateUser(ctx, "mission-http-owner@example.test", "hash", "Owner")
	if err != nil {
		t.Fatal(err)
	}
	other, err := s.CreateUser(ctx, "mission-http-other@example.test", "hash", "Other")
	if err != nil {
		t.Fatal(err)
	}
	if _, err = s.SavePlayerProfile(ctx, owner.ID, model.PlayerProfile{Goal: "travel", CEFRLevel: "B1"}); err != nil {
		t.Fatal(err)
	}
	seedMissionPractice(t, s, owner.ID)
	service := auth.New("mission-http-secret", time.Hour)
	ownerToken, _ := service.Issue(owner.ID)
	otherToken, _ := service.Issue(other.ID)
	social := realtime.New("")
	defer social.Close()
	handler := New(s, service, ai.New("http://127.0.0.1:1"), social).Handler()
	transit := []string{"I need to get to Central station.", "Which line is the fastest route?", "Could you tell me the departure time?"}
	call := func(method, path, token string, body any) *httptest.ResponseRecorder {
		raw, _ := json.Marshal(body)
		req := httptest.NewRequest(method, path, bytes.NewReader(raw))
		req.Header.Set("Authorization", "Bearer "+token)
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)
		return w
	}
	var v2 engine.ScenarioEvaluation
	if w := call(http.MethodPost, "/v1/player/bosses/city-transit/evaluate", ownerToken, map[string]any{"messages": transit, "rulesVersion": engine.ConversationRulesVersion}); w.Code != http.StatusOK {
		t.Fatal("v2 evaluate", w.Code, w.Body.String())
	} else if err := json.NewDecoder(w.Body).Decode(&v2); err != nil || v2.Complete || v2.RulesVersion != engine.ConversationRulesVersion {
		t.Fatalf("v2 compatibility changed: %+v %v", v2, err)
	}
	if w := call(http.MethodPost, "/v1/player/bosses/city-transit/evaluate", ownerToken, map[string]any{"messages": transit, "rulesVersion": engine.LatestConversationRulesVersion}); w.Code != http.StatusOK {
		t.Fatal("v3 evaluate", w.Code, w.Body.String())
	} else {
		var v3 engine.ScenarioEvaluation
		if err := json.NewDecoder(w.Body).Decode(&v3); err != nil || !v3.Complete || v3.RulesVersion != engine.LatestConversationRulesVersion {
			t.Fatalf("v3 dispatch failed: %+v %v", v3, err)
		}
	}
	unknown := call(http.MethodPost, "/v1/player/bosses/city-transit/evaluate", ownerToken, map[string]any{"messages": transit, "rulesVersion": "conversation.v9"})
	if unknown.Code != http.StatusConflict {
		t.Fatalf("unknown version status=%d body=%s", unknown.Code, unknown.Body.String())
	}
	complete := call(http.MethodPost, "/v1/player/bosses/city-transit/complete", ownerToken, map[string]any{"messages": transit, "rulesVersion": engine.LatestConversationRulesVersion})
	if complete.Code != http.StatusOK {
		t.Fatal("v3 complete", complete.Code, complete.Body.String())
	}
	retry := call(http.MethodPost, "/v1/player/bosses/city-transit/complete", ownerToken, map[string]any{"messages": transit, "rulesVersion": engine.LatestConversationRulesVersion})
	if retry.Code != http.StatusOK || retry.Body.String() != complete.Body.String() {
		t.Fatal("v3 retry changed receipt", retry.Code, retry.Body.String())
	}
	crossVersion := call(http.MethodPost, "/v1/player/bosses/city-transit/complete", ownerToken, map[string]any{"messages": transit, "rulesVersion": engine.ConversationRulesVersion})
	if crossVersion.Code != http.StatusConflict {
		t.Fatalf("cross-version retry status=%d body=%s", crossVersion.Code, crossVersion.Body.String())
	}
	foreign := call(http.MethodGet, "/v1/player/bosses/city-transit/receipt", otherToken, nil)
	if foreign.Code != http.StatusNotFound {
		t.Fatalf("foreign receipt status=%d body=%s", foreign.Code, foreign.Body.String())
	}
}
