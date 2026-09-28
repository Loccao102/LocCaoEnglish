package store

import (
	"context"
	"errors"
	"fmt"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/model"
	"os"
	"reflect"
	"strings"
	"sync"
	"testing"
	"time"
)

func TestLearningRecoveryMemoryAndPostgres(t *testing.T) {
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
			s, err := New(url)
			if err != nil {
				t.Fatal(err)
			}
			defer s.Close()
			user, err := s.CreateUser(ctx, fmt.Sprintf("recovery-%d@example.test", time.Now().UnixNano()), "hash", "Recovery")
			if err != nil {
				t.Fatal(err)
			}
			if s.db != nil {
				defer s.db.ExecContext(ctx, `DELETE FROM users WHERE id=$1`, user.ID)
			}
			start := func(owner, req, item string) (LearningAttemptRecord, error) {
				snap := LearningSnapshot{Input: model.LearningAttemptStartInput{RequestID: req, Activity: "word-link", Pack: "cefr-core", CEFRLevel: "A1"}, Prompt: model.LearningAttemptPrompt{Word: "happy", Relation: "synonym", Options: []string{"glad", "sad"}}}
				a, _, e := s.StartLearningAttempt(ctx, owner, req, "word-link", "Vocabulary", item, "A1", "test.v1", "word-link.v1", "happy — synonym", "glad", "Happy means glad.", snap)
				return a, e
			}
			in := model.LearningAttemptSubmitInput{Answer: "glad", ContentVersion: "test.v1", RulesVersion: "word-link.v1"}
			a, err := start(user.ID, "create-1", "happy")
			if err != nil {
				t.Fatal(err)
			}
			retry, err := start(user.ID, "create-1", "happy")
			if err != nil || !reflect.DeepEqual(a, retry) {
				t.Fatal("creation retry changed snapshot", err)
			}
			tampered := a.Snapshot
			tampered.Input.Pack = "travel-airport"
			if _, _, err = s.StartLearningAttempt(ctx, user.ID, "create-1", "word-link", "Vocabulary", "happy", "A1", "test.v1", "word-link.v1", "happy", "glad", "note", tampered); !errors.Is(err, ErrAttemptConflict) {
				t.Fatal("changed request accepted", err)
			}
			if _, err = s.GetLearningAttempt(ctx, "", a.ID); !errors.Is(err, ErrNotFound) {
				t.Fatal("guest reads account")
			}
			bad := in
			bad.ContentVersion = "wrong"
			if _, err = s.SubmitLearningAttempt(ctx, user.ID, a.ID, "glad", bad); !errors.Is(err, ErrAttemptInput) {
				t.Fatal("bad version accepted")
			}
			if _, err = s.SubmitLearningAttempt(ctx, user.ID, a.ID, "not an option", in); !errors.Is(err, ErrAttemptInput) {
				t.Fatal("unoffered answer accepted")
			}
			var wg sync.WaitGroup
			for i := 0; i < 8; i++ {
				wg.Add(1)
				go func() {
					defer wg.Done()
					v, e := s.SubmitLearningAttempt(ctx, user.ID, a.ID, "glad", in)
					if e != nil || !v.Correct || v.XPDelta != 20 {
						t.Errorf("submit retry: %+v %v", v, e)
					}
				}()
			}
			wg.Wait()
			u, _ := s.GetUser(ctx, user.ID)
			if u.XP != 20 {
				t.Fatal("duplicate XP", u.XP)
			}
			if _, err = s.SubmitLearningAttempt(ctx, user.ID, a.ID, "sad", in); !errors.Is(err, ErrAttemptConflict) {
				t.Fatal("changed completion accepted")
			}
			// Distinct attempt locks cannot bypass the shared daily content claim.
			results := make(chan model.LearningAttemptResult, 6)
			for i := 0; i < 6; i++ {
				wg.Add(1)
				go func(i int) {
					defer wg.Done()
					r, e := start(user.ID, fmt.Sprintf("concurrent-%d", i), "new-content")
					if e != nil {
						t.Error(e)
						return
					}
					v, e := s.SubmitLearningAttempt(ctx, user.ID, r.ID, "glad", in)
					if e != nil {
						t.Error(e)
						return
					}
					results <- v
				}(i)
			}
			wg.Wait()
			close(results)
			count, claims := 0, 0
			for r := range results {
				count++
				if r.ProgressionApplied {
					claims++
				}
			}
			u, _ = s.GetUser(ctx, user.ID)
			if count != 6 || claims != 1 || u.XP != 40 {
				t.Fatal("daily cap failed", count, claims, u.XP)
			}
			wrong, err := start(user.ID, "wrong", "wrong-content")
			if err != nil {
				t.Fatal(err)
			}
			result, err := s.SubmitLearningAttempt(ctx, user.ID, wrong.ID, "sad", in)
			if err != nil || result.Correct || !result.ReviewAdded || result.ActualAnswer != "sad" || result.XPDelta != 0 {
				t.Fatal("wrong response", result, err)
			}
			reviews, _ := s.ReviewQueue(ctx, user.ID, 20)
			if len(reviews) != 1 || reviews[0].Answer != "glad" {
				t.Fatal("incorrect review answer", reviews)
			}
			guest, err := start("", newID(), "guest-content")
			if err != nil {
				t.Fatal(err)
			}
			if s.db != nil {
				defer s.db.ExecContext(ctx, `DELETE FROM learning_attempts WHERE id=$1`, guest.ID)
			}
			demoBefore, _ := s.GetUser(ctx, s.DemoID())
			gr, err := s.SubmitLearningAttempt(ctx, "", guest.ID, "glad", in)
			demoAfter, _ := s.GetUser(ctx, s.DemoID())
			if err != nil || gr.XPDelta != 0 || gr.ProgressionApplied || demoBefore.XP != demoAfter.XP {
				t.Fatal("guest mutated progress", gr, err)
			}
			expired, err := start(user.ID, "expired", "expired")
			if err != nil {
				t.Fatal(err)
			}
			age := func(id string) {
				if s.db != nil {
					if _, e := s.db.ExecContext(ctx, `UPDATE learning_attempts SET expires_at=NOW()-INTERVAL '1 day' WHERE id=$1`, id); e != nil {
						t.Fatal(e)
					}
				} else {
					r := s.learningAttempts[id]
					r.ExpiresAt = time.Now().Add(-time.Hour)
					s.learningAttempts[id] = r
				}
			}
			age(expired.ID)
			if _, err = s.SubmitLearningAttempt(ctx, user.ID, expired.ID, "glad", in); !errors.Is(err, ErrAttemptExpired) {
				t.Fatal("expired round graded")
			}
			age(a.ID)
			if _, err = s.SubmitLearningAttempt(ctx, user.ID, a.ID, "glad", in); err != nil {
				t.Fatal("completed retry should survive expiry", err)
			}
			if s.db != nil {
				var actual, source string
				if err = s.db.QueryRowContext(ctx, `SELECT answer,grading_source FROM attempts WHERE id=$1`, wrong.ID).Scan(&actual, &source); err != nil || actual != "sad" || source != "server-objective" {
					t.Fatal("actual evidence not logged", err)
				}
				// A failed evidence write rolls back reward, confidence and completion together.
				rollback, err := start(user.ID, "rollback", "rollback")
				if err != nil {
					t.Fatal(err)
				}
				_, err = s.db.ExecContext(ctx, `INSERT INTO attempts(id,user_id,skill,activity,item_key,accuracy) VALUES($1,$2,'Vocabulary','test','sentinel',0)`, rollback.ID, user.ID)
				if err != nil {
					t.Fatal(err)
				}
				before, _ := s.GetUser(ctx, user.ID)
				skillsBefore, _ := s.Skills(ctx, user.ID)
				if _, err = s.SubmitLearningAttempt(ctx, user.ID, rollback.ID, "glad", in); err == nil {
					t.Fatal("expected evidence write conflict")
				}
				after, _ := s.GetUser(ctx, user.ID)
				skillsAfter, _ := s.Skills(ctx, user.ID)
				saved, _ := s.GetLearningAttempt(ctx, user.ID, rollback.ID)
				var claims int
				s.db.QueryRowContext(ctx, `SELECT count(*) FROM learning_daily_rewards WHERE attempt_id=$1`, rollback.ID).Scan(&claims)
				if before.XP != after.XP || !reflect.DeepEqual(skillsBefore, skillsAfter) || saved.Status != "active" || claims != 0 {
					t.Fatal("partial transaction committed")
				}
				if _, err = s.db.ExecContext(ctx, `DELETE FROM attempts WHERE id=$1`, rollback.ID); err != nil {
					t.Fatal(err)
				}
				if _, err = s.SubmitLearningAttempt(ctx, user.ID, rollback.ID, "glad", in); err != nil {
					t.Fatal(err)
				}
				reopened, err := New(url)
				if err != nil {
					t.Fatal(err)
				}
				defer reopened.Close()
				durable, err := reopened.GetLearningAttempt(ctx, user.ID, a.ID)
				if err != nil || durable.Status != "completed" || durable.XPDelta != 20 || !reflect.DeepEqual(durable.Snapshot, a.Snapshot) {
					t.Fatal("reconnect lost snapshot/result", err)
				}
			}
		})
	}
}
