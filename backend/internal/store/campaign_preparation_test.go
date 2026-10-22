package store

import (
	"context"
	"errors"
	"fmt"
	"os"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/Loccao102/LocCaoEnglish/backend/internal/engine"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/model"
	"github.com/lib/pq"
)

// Test-owned prompts go through the actual saved snapshot and grader. They are
// not client accuracy fixtures. Audio events report playback, not human hearing.
func campaignRound(t *testing.T, s *Store, owner, activity, request, item string) (LearningAttemptRecord, string) {
	t.Helper()
	ctx := context.Background()
	if activity == "story-choice" {
		a, _, err := s.StartStoryChoice(ctx, owner, model.LearningAttemptStartInput{RequestID: request, Activity: activity, Pack: "hotel-check-in", CEFRLevel: "B1"})
		if err != nil {
			t.Fatal(err)
		}
		node, _ := a.Snapshot.Story.Definition.Node(a.Snapshot.Story.NodeID)
		for _, c := range node.Choices {
			if c.Good {
				return a, c.Label
			}
		}
		t.Fatal("story fixture has no solution")
	}
	skill := map[string]string{"word-link": "Vocabulary", "collocation-factory": "Vocabulary", "grammar-repair": "Grammar", "sentence-builder": "Grammar", "listen-pick": "Listening", "dictation": "Dictation", "shadowing": "Speaking"}[activity]
	snap := LearningSnapshot{Input: model.LearningAttemptStartInput{RequestID: request, Activity: activity, Pack: "cefr-core", CEFRLevel: "B1"}, Prompt: model.LearningAttemptPrompt{Question: "Choose glad.", Options: []string{"glad", "sad"}}}
	answer, correct := "glad", "glad"
	if activity == "sentence-builder" {
		snap.Prompt.Chunks = []model.SentenceChunk{{ID: "a", Text: "I"}, {ID: "b", Text: "like tea"}}
		answer, correct = `["a","b"]`, "I like tea"
	}
	if activity == "listen-pick" || activity == "dictation" {
		snap.Listening = &ListeningSnapshot{Transcript: "glad", Events: []model.ListeningPlayback{}}
	}
	a, _, err := s.StartLearningAttempt(ctx, owner, request, activity, skill, item, "B1", "campaign-fixture.v1", checkedPracticeRules[activity], snap.Prompt.Question, correct, "Saved practice fixture.", snap)
	if err != nil {
		t.Fatal(err)
	}
	if snap.Listening != nil {
		for _, status := range []string{"requested", "completed"} {
			e := model.ListeningPlayback{RequestID: "play", Status: status, Rate: 1}
			if status == "completed" {
				e.Provider = "browser-speech-synthesis"
			}
			if _, err = s.RecordListeningPlayback(ctx, owner, a.ID, a.ContentVersion, a.RulesVersion, e); err != nil {
				t.Fatal(err)
			}
		}
	}
	return a, answer
}
func campaignSubmit(t *testing.T, s *Store, owner string, a LearningAttemptRecord, answer string) model.LearningAttemptResult {
	t.Helper()
	r, err := s.SubmitLearningAttempt(context.Background(), owner, a.ID, answer, model.LearningAttemptSubmitInput{ContentVersion: a.ContentVersion, RulesVersion: a.RulesVersion})
	if err != nil {
		t.Fatal(err)
	}
	return r
}
func campaignBoss(t *testing.T, s *Store, owner, id string) model.BossState {
	t.Helper()
	p, err := s.GetProgression(context.Background(), owner)
	if err != nil {
		t.Fatal(err)
	}
	for _, b := range p.Bosses {
		if b.ID == id {
			return b
		}
	}
	t.Fatal("missing boss", id)
	return model.BossState{}
}

func TestCampaignPreparationMemoryAndPostgres(t *testing.T) {
	urls := map[string]string{"memory": ""}
	if url := os.Getenv("TEST_DATABASE_URL"); url != "" {
		if !strings.Contains(url, "loccao_system_test") {
			t.Fatal("dedicated test DB required")
		}
		urls["postgres"] = url
	}
	for mode, url := range urls {
		t.Run(mode, func(t *testing.T) {
			ctx := context.Background()
			s, err := New(url)
			if err != nil {
				t.Fatal(err)
			}
			defer s.Close()
			for _, ensure := range []func(context.Context) error{s.EnsureIELTS, s.EnsurePlayerProfiles, s.EnsureProgression} {
				if err = ensure(ctx); err != nil {
					t.Fatal(err)
				}
			}
			u, err := s.CreateUser(ctx, fmt.Sprintf("gate-%d@example.test", time.Now().UnixNano()), "hash", "Gate learner")
			if err != nil {
				t.Fatal(err)
			}
			foreign, err := s.CreateUser(ctx, fmt.Sprintf("foreign-gate-%d@example.test", time.Now().UnixNano()), "hash", "Other learner")
			if err != nil {
				t.Fatal(err)
			}
			if s.db != nil {
				defer s.db.ExecContext(ctx, `DELETE FROM users WHERE id IN($1,$2)`, u.ID, foreign.ID)
			}
			if _, err = s.SavePlayerProfile(ctx, u.ID, model.PlayerProfile{Goal: "travel", CEFRLevel: "B1"}); err != nil {
				t.Fatal(err)
			}
			lines := []string{"I missed my flight today.", "Could you rebook me on the next flight?", "Yes please, book it. Which gate should I use?"}
			locked := func() {
				t.Helper()
				b := campaignBoss(t, s, u.ID, "airport-crisis")
				if b.Unlocked || countReady(b.Checkpoints) != 0 {
					t.Fatal("untrusted practice opened gate", b)
				}
				if _, e := s.CompleteBoss(ctx, u.ID, b.ID, lines, engine.ConversationRulesVersion); !errors.Is(e, ErrCampaignGateLocked) {
					t.Fatal("claim bypassed gate", e)
				}
			}
			for _, in := range []model.AttemptInput{{Skill: "Vocabulary", Activity: "word-link", Accuracy: 1}, {Skill: "Listening", Activity: "listen-pick", Accuracy: 1}, {Skill: "Speaking", Activity: "pronunciation-assessment", Accuracy: 1}} {
				if _, err = s.recordLegacyFixture(ctx, u.ID, in); err != nil {
					t.Fatal(err)
				}
			}
			locked()
			for _, activity := range []string{"word-link", "dictation", "shadowing"} {
				a, answer := campaignRound(t, s, foreign.ID, activity, "foreign-"+activity, "foreign-"+activity)
				if !campaignSubmit(t, s, foreign.ID, a, answer).Correct {
					t.Fatal("foreign fixture")
				}
				a, _ = campaignRound(t, s, u.ID, activity, "wrong-"+activity, "wrong-"+activity)
				if campaignSubmit(t, s, u.ID, a, "sad").Correct {
					t.Fatal("wrong fixture")
				}
			}
			locked()
			// Simulate retained rows with unsupported rules, missing completion time,
			// missing content version and active status. Never infer a timestamp.
			for i, mutate := range []func(*LearningAttemptRecord){
				func(r *LearningAttemptRecord) { r.RulesVersion = "retired.v0" },
				func(r *LearningAttemptRecord) { r.CompletedAt = time.Time{} },
				func(r *LearningAttemptRecord) { r.ContentVersion = "" },
				func(r *LearningAttemptRecord) { r.Status = "active" },
				func(r *LearningAttemptRecord) { r.Activity = "pronunciation-assessment" },
			} {
				a, _ := campaignRound(t, s, u.ID, "word-link", fmt.Sprint("invalid-", i), fmt.Sprint("invalid-", i))
				a.Status = "completed"
				a.Correct = true
				a.CompletedAt = time.Now().UTC()
				mutate(&a)
				if s.db != nil {
					var at any = a.CompletedAt
					if a.CompletedAt.IsZero() {
						at = nil
					}
					_, err = s.db.ExecContext(ctx, `UPDATE learning_attempts SET activity=$2,status=$3,correct=$4,rules_version=$5,content_version=$6,completed_at=$7 WHERE id=$1`, a.ID, a.Activity, a.Status, a.Correct, a.RulesVersion, a.ContentVersion, at)
					if err != nil {
						t.Fatal(err)
					}
				} else {
					s.mu.Lock()
					s.learningAttempts[a.ID] = a
					s.mu.Unlock()
				}
			}
			locked()
			var oldShadow LearningAttemptRecord
			otherActivity, otherAnswer := campaignRound(t, s, u.ID, "collocation-factory", "different-vocab-activity", "different-vocab-activity")
			campaignSubmit(t, s, u.ID, otherActivity, otherAnswer)
			locked() // Correct Vocabulary in a different activity is not Word Link evidence.
			for _, activity := range []string{"word-link", "dictation", "shadowing", "story-choice", "grammar-repair"} {
				a, answer := campaignRound(t, s, u.ID, activity, "before-"+activity, "same-"+activity)
				if !campaignSubmit(t, s, u.ID, a, answer).Correct {
					t.Fatal("correct fixture")
				}
				if activity == "shadowing" {
					oldShadow = a
				}
			}
			// Starting before a chapter clear is allowed; only its completion time counts.
			activeGrammar, grammarAnswer := campaignRound(t, s, u.ID, "grammar-repair", "pending-grammar", "same-grammar-repair")
			if !campaignBoss(t, s, u.ID, "airport-crisis").Unlocked {
				t.Fatal("shared evidence did not unlock")
			}
			first, err := s.CompleteBoss(ctx, u.ID, "airport-crisis", lines, engine.ConversationRulesVersion)
			if err != nil {
				t.Fatal(err)
			}
			if p := first.Receipt.Preparation; p == nil || p.RulesVersion != CampaignPracticeRules || len(p.Checkpoints) != 3 || p.PreviousCompletedAt != nil {
				t.Fatal("preparation missing", p)
			}
			first.Receipt.Preparation.Checkpoints[0].AttemptID = "tampered"
			stored, _ := s.GetMissionReceipt(ctx, u.ID, "airport-crisis")
			if stored.Preparation.Checkpoints[0].AttemptID == "tampered" {
				t.Fatal("preparation aliased")
			}
			hotel := campaignBoss(t, s, u.ID, "hotel-reservation")
			if hotel.Unlocked || countReady(hotel.Checkpoints) != 0 {
				t.Fatal("pre-clear practice reused", hotel)
			}
			campaignSubmit(t, s, u.ID, oldShadow, "glad")
			if countReady(campaignBoss(t, s, u.ID, "hotel-reservation").Checkpoints) != 0 {
				t.Fatal("retry refreshed old receipt")
			}
			// Some Windows clocks return equal wall times for adjacent operations.
			// Equality must remain ineligible; wait until this really is later.
			clearedAt := campaignBoss(t, s, u.ID, "airport-crisis").CompletedAt
			for !time.Now().After(*clearedAt) {
				time.Sleep(time.Millisecond)
			}
			if r := campaignSubmit(t, s, u.ID, activeGrammar, grammarAnswer); !r.Correct || r.XPDelta != 0 {
				t.Fatal("fresh replay fixture", r)
			}
			if countReady(campaignBoss(t, s, u.ID, "hotel-reservation").Checkpoints) != 1 {
				t.Fatal("creation time used instead of completion")
			}
			for _, activity := range []string{"story-choice", "shadowing"} {
				a, answer := campaignRound(t, s, u.ID, activity, "after-"+activity, "same-"+activity)
				if r := campaignSubmit(t, s, u.ID, a, answer); !r.Correct || r.XPDelta != 0 {
					t.Fatal("new capped round rejected", r)
				}
			}
			if !campaignBoss(t, s, u.ID, "hotel-reservation").Unlocked {
				t.Fatal("fresh practice not ready")
			}
			hotelLines := []string{"My confirmed reservation is missing.", "My confirmation number is ABC123.", "What time is breakfast tomorrow?"}
			if s.db != nil {
				// Test-only trigger makes the final XP write fail. A receipt/clear must
				// not survive the failed reward transaction. Never touch a player DB.
				name := "campaign_fail_" + strings.ReplaceAll(u.ID, "-", "")
				_, err = s.db.ExecContext(ctx, `CREATE FUNCTION `+pq.QuoteIdentifier(name)+`() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'campaign test reward failure'; END $$`)
				if err != nil {
					t.Fatal(err)
				}
				defer s.db.ExecContext(ctx, `DROP FUNCTION IF EXISTS `+pq.QuoteIdentifier(name)+`() CASCADE`)
				_, err = s.db.ExecContext(ctx, `CREATE TRIGGER `+pq.QuoteIdentifier(name)+` BEFORE UPDATE ON users FOR EACH ROW WHEN (OLD.id=`+pq.QuoteLiteral(u.ID)+`) EXECUTE FUNCTION `+pq.QuoteIdentifier(name)+`()`)
				if err != nil {
					t.Fatal(err)
				}
				before, _ := s.GetUser(ctx, u.ID)
				if _, err = s.CompleteBoss(ctx, u.ID, "hotel-reservation", hotelLines, engine.ConversationRulesVersion); err == nil {
					t.Fatal("expected reward failure")
				}
				after, _ := s.GetUser(ctx, u.ID)
				if after.XP != before.XP || campaignBoss(t, s, u.ID, "hotel-reservation").Cleared {
					t.Fatal("partial reward transaction")
				}
				if _, err = s.GetMissionReceipt(ctx, u.ID, "hotel-reservation"); !errors.Is(err, ErrNotFound) {
					t.Fatal("partial receipt", err)
				}
				if _, err = s.db.ExecContext(ctx, `DROP TRIGGER `+pq.QuoteIdentifier(name)+` ON users`); err != nil {
					t.Fatal(err)
				}
			}
			second := s
			if url != "" {
				second, err = New(url)
				if err != nil {
					t.Fatal(err)
				}
				defer second.Close()
			}
			complete, err := second.CompleteBoss(ctx, u.ID, "hotel-reservation", hotelLines, engine.ConversationRulesVersion)
			if err != nil {
				t.Fatal(err)
			}
			p := complete.Receipt.Preparation
			if p == nil || p.PreviousBossID != "airport-crisis" || p.PreviousCompletedAt == nil || len(p.Checkpoints) != 3 {
				t.Fatal("freshness receipt", p)
			}
			for _, e := range p.Checkpoints {
				if !e.CompletedAt.After(*p.PreviousCompletedAt) {
					t.Fatal("stale proof", e)
				}
			}
			// Later practice must not rewrite the proof bound to an earlier clear.
			a, answer := campaignRound(t, s, u.ID, "shadowing", "even-later", "same-shadowing")
			campaignSubmit(t, s, u.ID, a, answer)
			retry, err := second.CompleteBoss(ctx, u.ID, "hotel-reservation", hotelLines, engine.ConversationRulesVersion)
			if err != nil || !reflect.DeepEqual(complete.Receipt, retry.Receipt) {
				t.Fatal("receipt changed on retry", err)
			}
		})
	}
}

func TestAllCampaignCheckpointMappings(t *testing.T) {
	// Explicit expected activities guard the campaign registry and UI against a
	// wrong skill fallback or accidentally substituting another activity.
	expected := map[string][][]string{
		"airport-crisis":          {{"word-link"}, {"listen-pick", "dictation"}, {"shadowing"}},
		"hotel-reservation":       {{"story-choice"}, {"grammar-repair"}, {"shadowing"}},
		"city-transit":            {{"collocation-factory"}, {"listen-pick"}, {"shadowing"}},
		"cafe-connection":         {{"collocation-factory"}, {"listen-pick"}, {"shadowing"}},
		"weekend-plans":           {{"sentence-builder"}, {"listen-pick"}, {"shadowing"}},
		"repair-misunderstanding": {{"grammar-repair"}, {"collocation-factory"}, {"shadowing"}},
		"daily-standup":           {{"sentence-builder"}, {"collocation-factory"}, {"shadowing"}},
		"requirement-clarity":     {{"listen-pick"}, {"grammar-repair"}, {"shadowing"}},
		"deadline-negotiation":    {{"collocation-factory"}, {"sentence-builder", "grammar-repair"}, {"shadowing"}},
	}
	s, _ := New("")
	defer s.Close()
	at := time.Now().UTC()
	for id, requirements := range expected {
		t.Run(id, func(t *testing.T) {
			gate := campaignGates[id]
			done := map[string]*time.Time{}
			if gate.Previous != "" {
				done[gate.Previous] = &at
			}
			practice := map[string]CampaignPracticeEvidence{}
			for i, choices := range requirements {
				if !reflect.DeepEqual(gate.Requirements[i].Activities, choices) {
					t.Fatal("wrong accepted activity", i)
				}
				for _, activity := range choices {
					practice[activity] = CampaignPracticeEvidence{AttemptID: activity, Activity: activity, CompletedAt: at}
					p := prepareCampaign(id, done, practice)
					if gate.Previous != "" && len(p.Checkpoints) != i {
						t.Fatal("equal timestamps accepted", p)
					}
					e := practice[activity]
					e.CompletedAt = at.Add(time.Second)
					practice[activity] = e
					p = prepareCampaign(id, done, practice)
					if len(p.Checkpoints) != i+1 {
						t.Fatal("matching activity missed", p)
					}
					delete(practice, activity)
				}
				activity := choices[0]
				practice[activity] = CampaignPracticeEvidence{AttemptID: activity, Activity: activity, CompletedAt: at.Add(time.Second)}
			}
			u := model.User{XP: 1000}
			profile := model.PlayerProfile{Goal: gate.Goal}
			if !campaignGateOpen(id, u, profile, done, practice) {
				t.Fatal("complete gate locked")
			}
			builds := []func(model.User, model.PlayerProfile, map[string]*time.Time, map[string]CampaignPracticeEvidence) campaignBuild{buildTravelCampaign, buildConversationCampaign, buildWorkCampaign}
			found := false
			for _, build := range builds {
				c := build(u, profile, done, practice)
				for _, b := range c.Bosses {
					if b.ID == id {
						found = true
						if !b.Unlocked || countReady(b.Checkpoints) != 3 || b.RewardXP != gate.RewardXP {
							t.Fatal("display/claim mismatch", b)
						}
						for i, checkpoint := range b.Checkpoints {
							if checkpoint.ID != gate.Requirements[i].ID {
								t.Fatal("checkpoint mapping drift")
							}
						}
					}
				}
			}
			if !found {
				t.Fatal("missing displayed boss")
			}
			if gate.Previous != "" {
				delete(done, gate.Previous)
				if campaignGateOpen(id, u, profile, done, practice) {
					t.Fatal("missing predecessor accepted")
				}
			}
		})
	}
}
