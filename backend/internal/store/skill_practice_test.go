package store

import (
	"context"
	"fmt"
	"net/url"
	"os"
	"reflect"
	"testing"
	"time"

	"github.com/Loccao102/LocCaoEnglish/backend/internal/model"
)

func skillPracticeStores(t *testing.T, run func(*testing.T, *Store, string)) {
	t.Helper()
	urls := map[string]string{"memory": ""}
	if databaseURL := os.Getenv("TEST_DATABASE_URL"); databaseURL != "" {
		parsed, err := url.Parse(databaseURL)
		if err != nil || (parsed.Scheme != "postgres" && parsed.Scheme != "postgresql") || parsed.Path != "/loccao_system_test" {
			t.Fatal("dedicated test database required")
		}
		urls["postgres"] = databaseURL
	}
	for mode, url := range urls {
		t.Run(mode, func(t *testing.T) {
			s, err := New(url)
			if err != nil {
				t.Fatal(err)
			}
			t.Cleanup(s.Close)
			if s.db != nil {
				// Skills must close its first query before loading the projection.
				s.db.SetMaxOpenConns(1)
			}
			run(t, s, url)
		})
	}
}

func skillPracticeUser(t *testing.T, s *Store) model.User {
	t.Helper()
	u, err := s.CreateUser(context.Background(), "skill-practice-"+newID()+"@example.test", "hash", "Practice summary")
	if err != nil {
		t.Fatal(err)
	}
	if s.db != nil {
		t.Cleanup(func() { _, _ = s.db.ExecContext(context.Background(), `DELETE FROM users WHERE id=$1`, u.ID) })
	}
	return u
}

func skillPracticeRead(t *testing.T, s *Store, owner string) map[string]model.Skill {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	skills, err := s.Skills(ctx, owner)
	if err != nil {
		t.Fatal(err)
	}
	out := map[string]model.Skill{}
	for _, skill := range skills {
		if skill.Practice == nil || skill.Practice.Method != SkillPracticeMethod || skill.Practice.WindowSize != 20 {
			t.Fatal("missing/versionless summary", skill)
		}
		out[skill.Name] = skill
	}
	return out
}

func skillPracticeFixture(t *testing.T, s *Store, r LearningAttemptRecord) {
	t.Helper()
	if s.db != nil {
		var owner, completed any = r.UserID, r.CompletedAt
		if r.UserID == "" {
			owner = nil
		}
		if r.CompletedAt.IsZero() {
			completed = nil
		}
		_, err := s.db.ExecContext(context.Background(), `INSERT INTO learning_attempts(id,user_id,request_id,activity,skill,item_key,cefr_level,content_version,rules_version,correct_answer,status,correct,completed_at)
		 VALUES($1,$2,$1,$3,$4,$5,'B1',$6,$7,'fixture',$8,$9,$10)`, r.ID, owner, r.Activity, r.Skill, r.ItemKey, r.ContentVersion, r.RulesVersion, r.Status, r.Correct, completed)
		if err != nil {
			t.Fatal(err)
		}
		if owner == nil {
			t.Cleanup(func() {
				_, _ = s.db.ExecContext(context.Background(), `DELETE FROM learning_attempts WHERE id=$1`, r.ID)
			})
		}
		return
	}
	s.mu.Lock()
	s.learningAttempts[r.ID] = r
	s.mu.Unlock()
}

func TestSkillPracticeRealRoundsMemoryAndPostgres(t *testing.T) {
	skillPracticeStores(t, func(t *testing.T, s *Store, url string) {
		ctx := context.Background()
		u := skillPracticeUser(t, s)
		initial := skillPracticeRead(t, s, u.ID)
		for name, skill := range initial {
			if skill.Practice.SampleCount != 0 || skill.Practice.CorrectCount != 0 || skill.Practice.LastCompletedAt != nil || skill.Confidence != initialConfidence(name) {
				t.Fatal("seed was interpreted as practice", skill)
			}
		}
		if initial["Writing"].Practice.EvidenceKind != "not-supported" || initial["Speaking"].Practice.EvidenceKind != "transcript-match" || initial["Vocabulary"].Practice.EvidenceKind != "guided-practice" {
			t.Fatal("evidence kinds", initial)
		}
		if _, err := s.recordLegacyFixture(ctx, u.ID, model.AttemptInput{Skill: "Vocabulary", Activity: "word-link", ItemKey: "legacy", Accuracy: 1}); err != nil {
			t.Fatal(err)
		}
		if skillPracticeRead(t, s, u.ID)["Vocabulary"].Practice.SampleCount != 0 {
			t.Fatal("legacy history counted")
		}
		first, answer := campaignRound(t, s, u.ID, "word-link", "summary-first", "summary-item")
		if r := campaignSubmit(t, s, u.ID, first, answer); !r.Correct || r.XPDelta != 20 {
			t.Fatal("correct round fixture", r)
		}
		wrong, _ := campaignRound(t, s, u.ID, "word-link", "summary-wrong", "summary-other")
		if r := campaignSubmit(t, s, u.ID, wrong, "sad"); r.Correct {
			t.Fatal("wrong round fixture", r)
		}
		beforeReplay := skillPracticeRead(t, s, u.ID)
		p := beforeReplay["Vocabulary"].Practice
		if p.SampleCount != 2 || p.CorrectCount != 1 || p.LastCompletedAt == nil {
			t.Fatal("completed correct/wrong missing", p)
		}
		campaignSubmit(t, s, u.ID, first, answer)
		if !reflect.DeepEqual(beforeReplay, skillPracticeRead(t, s, u.ID)) {
			t.Fatal("same attempt retry changed summary")
		}
		for !time.Now().After(*p.LastCompletedAt) {
			time.Sleep(time.Millisecond)
		}
		replay, _ := campaignRound(t, s, u.ID, "word-link", "summary-replay", "summary-item")
		if r := campaignSubmit(t, s, u.ID, replay, "sad"); r.Correct || r.XPDelta != 0 || r.ProgressionApplied {
			t.Fatal("capped replay fixture", r)
		}
		afterReplay := skillPracticeRead(t, s, u.ID)
		p = afterReplay["Vocabulary"].Practice
		if p.SampleCount != 2 || p.CorrectCount != 0 || !p.LastCompletedAt.After(*beforeReplay["Vocabulary"].Practice.LastCompletedAt) {
			t.Fatal("latest capped replay should replace the earlier answer", p)
		}
		if afterReplay["Vocabulary"].Confidence != beforeReplay["Vocabulary"].Confidence {
			t.Fatal("summary rewrote legacy confidence")
		}
		for _, activity := range []string{"shadowing", "grammar-repair", "sentence-builder", "dictation", "listen-pick", "collocation-factory", "story-choice"} {
			a, correct := campaignRound(t, s, u.ID, activity, "summary-"+activity, "summary-"+activity)
			campaignSubmit(t, s, u.ID, a, correct)
		}
		beforeRead, err := s.GetUser(ctx, u.ID)
		if err != nil {
			t.Fatal(err)
		}
		final := skillPracticeRead(t, s, u.ID)
		for name, expected := range map[string]int{"Vocabulary": 3, "Grammar": 2, "Reading": 1, "Dictation": 1, "Listening": 1, "Speaking": 1, "Writing": 0} {
			if final[name].Practice.SampleCount != expected {
				t.Fatal("mapped activity count", name, final[name].Practice)
			}
		}
		// Returned pointers must not alias stored state or another skill.
		final["Vocabulary"].Practice.CorrectCount = 999
		if final["Speaking"].Practice.CorrectCount != 1 || skillPracticeRead(t, s, u.ID)["Vocabulary"].Practice.CorrectCount != 1 {
			t.Fatal("mutable summary leaked")
		}
		afterRead, _ := s.GetUser(ctx, u.ID)
		if !reflect.DeepEqual(beforeRead, afterRead) {
			t.Fatal("reading summary mutated account")
		}
		if url != "" {
			second, err := New(url)
			if err != nil {
				t.Fatal(err)
			}
			defer second.Close()
			if !reflect.DeepEqual(skillPracticeRead(t, s, u.ID), skillPracticeRead(t, second, u.ID)) {
				t.Fatal("projection changed after reopening store")
			}
		}
	})
}

func TestSkillPracticeEligibilityAndWindowMemoryAndPostgres(t *testing.T) {
	skillPracticeStores(t, func(t *testing.T, s *Store, _ string) {
		u, other := skillPracticeUser(t, s), skillPracticeUser(t, s)
		baseTime := time.Date(2026, 10, 20, 12, 0, 0, 0, time.UTC)
		fixture := func() LearningAttemptRecord {
			id := newID()
			return LearningAttemptRecord{ID: id, UserID: u.ID, Activity: "word-link", Skill: "Vocabulary", ItemKey: id, ContentVersion: "summary-content.v1", RulesVersion: "word-link.v1", Status: "completed", Correct: true, CompletedAt: baseTime}
		}
		for _, mutate := range []func(*LearningAttemptRecord){
			func(r *LearningAttemptRecord) { r.UserID = other.ID },
			func(r *LearningAttemptRecord) { r.UserID = "" },
			func(r *LearningAttemptRecord) { r.Status = "active" },
			func(r *LearningAttemptRecord) { r.ItemKey = "" },
			func(r *LearningAttemptRecord) { r.ContentVersion = "" },
			func(r *LearningAttemptRecord) { r.CompletedAt = time.Time{} },
			func(r *LearningAttemptRecord) { r.RulesVersion = "word-link.v99" },
			func(r *LearningAttemptRecord) { r.Skill = "Writing" },
			func(r *LearningAttemptRecord) { r.Skill = "vocabulary" },
			func(r *LearningAttemptRecord) { r.Activity = "ielts-reading"; r.RulesVersion = "ielts-reading.v1" },
			func(r *LearningAttemptRecord) { r.Activity = "pronunciation-assessment" },
			func(r *LearningAttemptRecord) { r.Activity = "adventure" },
		} {
			r := fixture()
			mutate(&r)
			skillPracticeFixture(t, s, r)
		}
		for name, skill := range skillPracticeRead(t, s, u.ID) {
			if skill.Practice.SampleCount != 0 {
				t.Fatal("ineligible row counted", name, skill.Practice)
			}
		}
		prefix := newID()
		// 25 equally timed distinct items: ID determines the last 20. Their
		// duplicate older rows must not crowd distinct items out of the window.
		for i := 0; i < 25; i++ {
			r := fixture()
			r.ID, r.ItemKey, r.Correct = fmt.Sprintf("%s-%02d", prefix, i), fmt.Sprintf("window-%02d", i), i%2 == 0
			skillPracticeFixture(t, s, r)
			r.ID, r.CompletedAt, r.Correct = r.ID+"-old", baseTime.Add(-time.Hour), true
			skillPracticeFixture(t, s, r)
		}
		p := skillPracticeRead(t, s, u.ID)["Vocabulary"].Practice
		if p.SampleCount != 20 || p.CorrectCount != 10 || p.LastCompletedAt == nil || !p.LastCompletedAt.Equal(baseTime) {
			t.Fatal("distinct item window / time tie", p)
		}
		// Same item + time chooses the larger ID, then the new verdict replaces it.
		r := fixture()
		r.ID, r.ItemKey, r.Correct = prefix+"-24-z", "window-24", false
		skillPracticeFixture(t, s, r)
		if got := skillPracticeRead(t, s, u.ID)["Vocabulary"].Practice; got.SampleCount != 20 || got.CorrectCount != 9 {
			t.Fatal("same-item timestamp tie", got)
		}
		// A newer invalid row for that item cannot hide its supported receipt.
		r.ID, r.CompletedAt, r.Correct, r.RulesVersion = newID(), baseTime.Add(time.Hour), true, "unsupported.v9"
		skillPracticeFixture(t, s, r)
		if got := skillPracticeRead(t, s, u.ID)["Vocabulary"].Practice; !reflect.DeepEqual(p.LastCompletedAt, got.LastCompletedAt) || got.CorrectCount != 9 {
			t.Fatal("invalid row displaced valid evidence", got)
		}
		// Activity and content version both contribute to item identity.
		keys := skillPracticeUser(t, s)
		for _, pair := range [][2]string{{"word-link", "v1"}, {"word-link", "v2"}, {"word-graph", "v1"}, {"collocation-factory", "v1"}} {
			r := fixture()
			r.UserID, r.Activity, r.ItemKey, r.ContentVersion = keys.ID, pair[0], "same-key", pair[1]
			r.RulesVersion = checkedPracticeRules[r.Activity]
			skillPracticeFixture(t, s, r)
		}
		if got := skillPracticeRead(t, s, keys.ID)["Vocabulary"].Practice; got.SampleCount != 4 || got.CorrectCount != 4 {
			t.Fatal("activity/content identity collapsed", got)
		}
		// Both reading adapters share Reading, never Writing or legacy confidence.
		r = fixture()
		r.UserID, r.Activity, r.Skill, r.RulesVersion = keys.ID, "reading-race", "Reading", checkedPracticeRules["reading-race"]
		skillPracticeFixture(t, s, r)
		if skillPracticeRead(t, s, keys.ID)["Reading"].Practice.SampleCount != 1 {
			t.Fatal("reading activity missing")
		}
	})
}
