package store

import (
	"context"
	"errors"
	"fmt"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/daily"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/model"
	"os"
	"reflect"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

func TestDailyPracticeMemoryAndPostgres(t *testing.T) {
	urls := map[string]string{"memory": ""}
	if url := os.Getenv("TEST_DATABASE_URL"); url != "" {
		if !strings.Contains(url, "loccao_system_test") {
			t.Fatal("dedicated test database required")
		}
		urls["postgres"] = url
	}
	for mode, url := range urls {
		t.Run(mode, func(t *testing.T) {
			ctx := context.Background()
			s, e := New(url)
			if e != nil {
				t.Fatal(e)
			}
			defer s.Close()
			u, e := s.CreateUser(ctx, fmt.Sprintf("daily-%d@example.test", time.Now().UnixNano()), "hash", "Daily learner")
			if e != nil {
				t.Fatal(e)
			}
			if s.db != nil {
				defer s.db.ExecContext(ctx, "DELETE FROM users WHERE id=$1", u.ID)
			}
			day := CurrentPlayerDay()
			start, end, _ := daily.Bounds(day)
			older := daily.Day(start.Add(-time.Hour))
			future := daily.Day(end)
			// A pre-migration reward is retained and cannot acquire invented evidence.
			if s.db != nil {
				if _, e = s.db.ExecContext(ctx, `CREATE TABLE IF NOT EXISTS daily_claims(user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,day DATE NOT NULL,reward_xp INTEGER NOT NULL DEFAULT 50,claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),PRIMARY KEY(user_id,day))`); e != nil {
					t.Fatal(e)
				}
				if _, e = s.db.ExecContext(ctx, `INSERT INTO daily_claims(user_id,day,reward_xp,claimed_at) VALUES($1,$2::date,50,$3)`, u.ID, older, start.Add(-time.Hour)); e != nil {
					t.Fatal(e)
				}
			} else {
				s.dailyClaims = map[string]model.DailyClaimReceipt{dailyKey(u.ID, older): {Date: older, RulesVersion: "legacy-unverified", RewardXP: 50, ClaimedAt: start.Add(-time.Hour), Legacy: true, Evidence: []model.DailyQuestEvidence{}}}
			}
			if s.db != nil {
				if _, e = s.db.ExecContext(ctx, "UPDATE users SET xp=xp+50 WHERE id=$1", u.ID); e != nil {
					t.Fatal(e)
				}
			} else {
				s.mu.Lock()
				acc := s.mem.users[u.ID]
				acc.user.XP += 50
				s.mem.users[u.ID] = acc
				s.mu.Unlock()
			}
			for i := 0; i < 2; i++ {
				if e = s.EnsureDaily(ctx); e != nil {
					t.Fatal(e)
				}
			}
			if s.db != nil {
				raw, e := os.ReadFile("../../migrations/021_daily_practice_receipts.sql")
				if e != nil {
					t.Fatal(e)
				}
				for i := 0; i < 2; i++ {
					if _, e = s.db.ExecContext(ctx, string(raw)); e != nil {
						t.Fatal(e)
					}
				}
			}
			legacy, e := s.DailyReceipt(ctx, u.ID, older)
			if e != nil || !legacy.Legacy || legacy.Plan != nil || len(legacy.Evidence) != 0 {
				t.Fatal("legacy provenance", legacy, e)
			}
			if _, fresh, e := s.ClaimDailyReward(ctx, u.ID, older, daily.RulesVersion); e != nil || fresh {
				t.Fatal("old committed retry", e)
			}
			if retained, _ := s.GetUser(ctx, u.ID); retained.XP != 50 {
				t.Fatal("legacy reward changed on retry", retained.XP)
			}
			for _, skill := range []string{"Vocabulary", "Grammar", "Speaking"} {
				if _, e = s.recordLegacyFixture(ctx, u.ID, model.AttemptInput{Activity: "old", Skill: skill, ItemKey: "legacy-" + skill, Accuracy: 1}); e != nil {
					t.Fatal(e)
				}
			}
			if proof, e := s.DailyEvidence(ctx, u.ID, day); e != nil || len(proof) != 0 {
				t.Fatal("legacy/confidence became today's practice", proof, e)
			}
			if _, _, e = s.ClaimDailyReward(ctx, u.ID, day, daily.RulesVersion); !errors.Is(e, daily.ErrConflict) {
				t.Fatal("missing plan", e)
			}
			skills := []model.Skill{{Name: "Vocabulary", Confidence: .1}, {Name: "Grammar", Confidence: .2}, {Name: "Speaking", Confidence: .3}}
			p, e := s.SaveDailyPlan(ctx, u.ID, daily.Build(day, skills, model.PlayerProfile{}, time.Now()))
			if e != nil {
				t.Fatal(e)
			}
			alternate := daily.Build(day, nil, model.PlayerProfile{Goal: "travel"}, time.Now())
			var wg sync.WaitGroup
			for i := 0; i < 8; i++ {
				wg.Add(1)
				go func() {
					defer wg.Done()
					saved, e := s.SaveDailyPlan(ctx, u.ID, alternate)
					if e != nil || !reflect.DeepEqual(saved, p) {
						t.Error("plan moved after preference change", saved, e)
					}
				}()
			}
			wg.Wait()
			if _, _, e = s.ClaimDailyReward(ctx, u.ID, day, daily.RulesVersion); !errors.Is(e, daily.ErrIncomplete) {
				t.Fatal("confidence-only reward", e)
			}
			before, _ := s.GetUser(ctx, u.ID)
			ids := []string{}
			for i, q := range p.Quests {
				reference := "right"
				answer := "wrong"
				options := []string{"right", "wrong"}
				if q.Activity == "shadowing" {
					reference = "Hello there."
					answer = "Different words."
					options = []string{}
				}
				snap := LearningSnapshot{Input: model.LearningAttemptStartInput{Activity: q.Activity, Pack: "cefr-core", CEFRLevel: "B1"}, Prompt: model.LearningAttemptPrompt{Question: reference, Options: options}}
				a, _, e := s.StartLearningAttempt(ctx, u.ID, fmt.Sprintf("daily-round-%d", i), q.Activity, q.Skill, "daily-item-"+q.Activity, "B1", "daily-test.v1", checkedPracticeRules[q.Activity], reference, reference, "Practice feedback.", snap)
				if e != nil {
					t.Fatal(e)
				}
				v := model.LearningAttemptSubmitInput{ContentVersion: a.ContentVersion, RulesVersion: a.RulesVersion}
				r, e := s.SubmitLearningAttempt(ctx, u.ID, a.ID, answer, v)
				if e != nil || r.Correct || r.XPDelta != 0 {
					t.Fatal("wrong practice receipt", r, e)
				}
				ids = append(ids, a.ID)
				loaded, e := s.GetLearningAttempt(ctx, u.ID, a.ID)
				if e != nil || loaded.CompletedAt.IsZero() {
					t.Fatal("missing completion time", e)
				}
				// Day checks use completion, not creation; private fixtures emulate older starts.
				if s.db != nil {
					_, e = s.db.ExecContext(ctx, "UPDATE learning_attempts SET created_at=$2 WHERE id=$1", a.ID, start.Add(-time.Hour))
				} else {
					s.mu.Lock()
					rec := s.learningAttempts[a.ID]
					rec.CreatedAt = start.Add(-time.Hour)
					s.learningAttempts[a.ID] = rec
					s.mu.Unlock()
				}
				if e != nil {
					t.Fatal(e)
				}
				if proof, e := s.DailyEvidence(ctx, u.ID, day); e != nil || len(proof) != i+1 {
					t.Fatal("actual completion missing", proof, e)
				}
			}
			if proof, e := s.DailyEvidence(ctx, "other", day); e != nil || len(proof) != 0 {
				t.Fatal("owner leak")
			}
			if proof, e := s.DailyEvidence(ctx, u.ID, future); e != nil || len(proof) != 0 {
				t.Fatal("old work became tomorrow's practice")
			}
			old, _ := s.GetLearningAttempt(ctx, u.ID, ids[0])
			setCompleted := func(at time.Time) {
				if s.db != nil {
					if _, e := s.db.ExecContext(ctx, "UPDATE learning_attempts SET completed_at=$2 WHERE id=$1", old.ID, at); e != nil {
						t.Fatal(e)
					}
				} else {
					s.mu.Lock()
					rec := s.learningAttempts[old.ID]
					rec.CompletedAt = at
					s.learningAttempts[old.ID] = rec
					s.mu.Unlock()
				}
			}
			setCompleted(start)
			if proof, e := s.DailyEvidence(ctx, u.ID, day); e != nil || len(proof) != 3 {
				t.Fatal("start boundary must be inclusive", proof, e)
			}
			setCompleted(end)
			if proof, e := s.DailyEvidence(ctx, u.ID, day); e != nil || len(proof) != 2 {
				t.Fatal("end boundary must be exclusive", proof, e)
			}
			originalAt := start.Add(-time.Microsecond)
			setCompleted(originalAt)
			if _, e = s.SubmitLearningAttempt(ctx, u.ID, old.ID, old.SubmittedAnswer, model.LearningAttemptSubmitInput{ContentVersion: old.ContentVersion, RulesVersion: old.RulesVersion}); e != nil {
				t.Fatal(e)
			}
			retried, _ := s.GetLearningAttempt(ctx, u.ID, old.ID)
			if !retried.CompletedAt.Equal(originalAt) {
				t.Fatal("retry redated completion")
			}
			if _, _, e = s.ClaimDailyReward(ctx, u.ID, day, daily.RulesVersion); !errors.Is(e, daily.ErrIncomplete) {
				t.Fatal("old completed retry counted as fresh work", e)
			}
			// A newly completed replay can count as effort without another learning reward.
			replay, _, e := s.StartLearningAttempt(ctx, u.ID, "daily-fresh-replay", old.Activity, old.Skill, old.ItemKey, old.CEFRLevel, old.ContentVersion, old.RulesVersion, old.Prompt, old.CorrectAnswer, old.Feedback, old.Snapshot)
			if e != nil {
				t.Fatal(e)
			}
			played, e := s.SubmitLearningAttempt(ctx, u.ID, replay.ID, old.SubmittedAnswer, model.LearningAttemptSubmitInput{ContentVersion: old.ContentVersion, RulesVersion: old.RulesVersion})
			if e != nil || played.XPDelta != 0 || played.ProgressionApplied {
				t.Fatal("fresh replay contract", played, e)
			}
			ids[0] = replay.ID
			if _, _, e = s.ClaimDailyReward(ctx, u.ID, future, daily.RulesVersion); !errors.Is(e, daily.ErrExpired) {
				t.Fatal("wrong day claim", e)
			}
			if _, _, e = s.ClaimDailyReward(ctx, u.ID, day, "future"); !errors.Is(e, daily.ErrConflict) {
				t.Fatal("rules not checked", e)
			}
			second := s
			if url != "" {
				second, e = New(url)
				if e != nil {
					t.Fatal(e)
				}
				defer second.Close()
			}
			var fresh atomic.Int32
			receipts := make(chan model.DailyClaimReceipt, 12)
			for i := 0; i < 12; i++ {
				wg.Add(1)
				go func(i int) {
					defer wg.Done()
					st := s
					if i%2 == 0 {
						st = second
					}
					r, new, e := st.ClaimDailyReward(ctx, u.ID, day, daily.RulesVersion)
					if e != nil {
						t.Error(e)
						return
					}
					if new {
						fresh.Add(1)
					}
					receipts <- r
				}(i)
			}
			wg.Wait()
			close(receipts)
			if fresh.Load() != 1 {
				t.Fatal("duplicate daily reward", fresh.Load())
			}
			var first model.DailyClaimReceipt
			for r := range receipts {
				if first.Date == "" {
					first = r
				}
				if !reflect.DeepEqual(first, r) {
					t.Fatal("receipt changed on retry")
				}
			}
			if first.RewardXP != 50 || first.Legacy || first.Plan == nil || len(first.Evidence) != 3 {
				t.Fatal("claim provenance", first)
			}
			for i, proof := range first.Evidence {
				if proof.AttemptID != ids[i] || proof.Activity != p.Quests[i].Activity {
					t.Fatal("unbound evidence", proof)
				}
			}
			after, _ := s.GetUser(ctx, u.ID)
			if after.XP-before.XP != 50 || after.Streak != 2 {
				t.Fatal("reward/streak", before.XP, after.XP, after.Streak)
			}
			first.Plan.Quests[0].Title = "mutated"
			first.Evidence[0].AttemptID = "mutated"
			saved, e := second.DailyReceipt(ctx, u.ID, day)
			if e != nil || saved.Evidence[0].AttemptID == "mutated" || saved.Plan.Quests[0].Title == "mutated" {
				t.Fatal("receipt alias", e)
			}
			if list, e := s.TopUsers(ctx, 100); e != nil {
				t.Fatal(e)
			} else {
				for _, entry := range list {
					if entry.UserID == u.ID {
						t.Fatal("wrong-answer daily bonus entered checked rank")
					}
				}
			}
			if url != "" {
				reopened, e := New(url)
				if e != nil {
					t.Fatal(e)
				}
				defer reopened.Close()
				got, e := reopened.DailyReceipt(ctx, u.ID, day)
				if e != nil || !reflect.DeepEqual(got, saved) {
					t.Fatal("restart lost claim", e)
				}
			} else {
				other, e := New("")
				if e != nil {
					t.Fatal(e)
				}
				defer other.Close()
				other.mu.Lock()
				other.mem.users[u.ID] = s.mem.users[u.ID]
				other.mu.Unlock()
				if _, e = other.DailyReceipt(ctx, u.ID, day); !errors.Is(e, ErrNotFound) {
					t.Fatal("process-global memory ledger leak", e)
				}
			}
		})
	}
}
