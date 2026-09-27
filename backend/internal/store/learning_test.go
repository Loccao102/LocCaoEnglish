package store

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"reflect"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/Loccao102/LocCaoEnglish/backend/internal/learning"
)

func TestLearningAttemptsAtomicAndDurable(t *testing.T) {
	urls := map[string]string{"memory": ""}
	if url := os.Getenv("TEST_DATABASE_URL"); url != "" {
		if !strings.Contains(url, "loccao_system_test") {
			t.Fatal("test database must be loccao_system_test")
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
			if err = s.EnsureLearningAttempts(ctx); err != nil {
				t.Fatal(err)
			}
			u, err := s.CreateUser(ctx, fmt.Sprintf("attempt-%d@example.test", time.Now().UnixNano()), "hash", "Learner")
			if err != nil {
				t.Fatal(err)
			}
			if s.db != nil {
				defer s.db.ExecContext(ctx, `DELETE FROM users WHERE id=$1`, u.ID)
			}
			create := learning.Create{RequestID: "12345678-1234-4123-8123-123456789012", Pack: "default", Round: 0}
			v, err := s.CreateLearningAttempt(ctx, u.ID, create)
			if err != nil {
				t.Fatal(err)
			}
			retry, err := s.CreateLearningAttempt(ctx, u.ID, create)
			if err != nil || !reflect.DeepEqual(v, retry) {
				t.Fatal("creation is not idempotent")
			}
			create.Round = 1
			if _, err = s.CreateLearningAttempt(ctx, u.ID, create); !errors.Is(err, learning.ErrConflict) {
				t.Fatal("changed creation accepted")
			}
			if _, err = s.GetLearningAttempt(ctx, "", v.ID); !errors.Is(err, ErrNotFound) {
				t.Fatal("account leaked to guest")
			}
			if _, err = s.GetLearningAttempt(ctx, s.DemoID(), v.ID); !errors.Is(err, ErrNotFound) {
				t.Fatal("account leaked to another owner")
			}
			var correct, wrong learning.Submission
			for _, c := range v.Choices {
				in := learning.Submission{ChoiceID: c.ID, ContentVersion: 1, RulesVersion: 1}
				if c.Label == "substantial" {
					correct = in
				} else {
					wrong = in
				}
			}
			if _, err = s.SubmitLearningAttempt(ctx, "", v.ID, correct); !errors.Is(err, ErrNotFound) {
				t.Fatal("guest submitted account round")
			}
			bad := correct
			bad.ContentVersion = 2
			if _, err = s.SubmitLearningAttempt(ctx, u.ID, v.ID, bad); !errors.Is(err, learning.ErrInvalid) {
				t.Fatal("wrong version accepted")
			}
			before, _ := s.GetUser(ctx, u.ID)
			if before.XP != 0 {
				t.Fatal("invalid submission awarded XP")
			}
			var wg sync.WaitGroup
			for i := 0; i < 12; i++ {
				wg.Add(1)
				go func() {
					defer wg.Done()
					result, err := s.SubmitLearningAttempt(ctx, u.ID, v.ID, correct)
					if err != nil || !result.Correct || result.XPDelta != 30 {
						t.Errorf("retry failed: %+v %v", result, err)
					}
				}()
			}
			wg.Wait()
			user, _ := s.GetUser(ctx, u.ID)
			if user.XP != 30 {
				t.Fatalf("duplicate XP: %d", user.XP)
			}
			if _, err = s.SubmitLearningAttempt(ctx, u.ID, v.ID, wrong); !errors.Is(err, learning.ErrConflict) {
				t.Fatal("changed answer accepted")
			}
			saved, _ := s.GetLearningAttempt(ctx, u.ID, v.ID)
			saved.Result.XPDelta = 999
			saved.Choices[0].Label = "corrupted"
			fresh, _ := s.GetLearningAttempt(ctx, u.ID, v.ID)
			if fresh.Result.XPDelta != 30 || fresh.Choices[0].Label == "corrupted" {
				t.Fatal("mutable view leaked")
			}
			create.RequestID = "22345678-1234-4123-8123-123456789012"
			create.Round = 0
			repeat, err := s.CreateLearningAttempt(ctx, u.ID, create)
			if err != nil {
				t.Fatal(err)
			}
			result, err := s.SubmitLearningAttempt(ctx, u.ID, repeat.ID, learning.Submission{ChoiceID: repeat.Choices[0].ID, ContentVersion: 1, RulesVersion: 1})
			if err != nil || result.ProgressionApplied || result.XPDelta != 0 {
				t.Fatal("same content rewarded twice today")
			}
			create.RequestID = "32345678-1234-4123-8123-123456789012"
			create.Round = 1
			second, err := s.CreateLearningAttempt(ctx, u.ID, create)
			if err != nil {
				t.Fatal(err)
			}
			var wrongLabel string
			for _, c := range second.Choices {
				if c.Label != "increase dramatically" {
					wrong = learning.Submission{ChoiceID: c.ID, ContentVersion: 1, RulesVersion: 1}
					wrongLabel = c.Label
					break
				}
			}
			result, err = s.SubmitLearningAttempt(ctx, u.ID, second.ID, wrong)
			if err != nil || result.Correct || !result.ReviewAdded || result.ActualAnswer != wrongLabel {
				t.Fatalf("wrong answer not retained: %+v %v", result, err)
			}
			reviews, _ := s.ReviewQueue(ctx, u.ID, 20)
			if len(reviews) != 1 || reviews[0].Answer != "increase dramatically" {
				t.Fatalf("review teaches the wrong answer: %+v", reviews)
			}
			if s.db != nil {
				var actual, source string
				var version int
				if err = s.db.QueryRowContext(ctx, `SELECT answer,grading_source,content_version FROM attempts WHERE id=$1`, second.ID).Scan(&actual, &source, &version); err != nil || actual != wrongLabel || source != "server-objective" || version != 1 {
					t.Fatal("attempt evidence incorrect", err)
				}
				reopened, err := New(url)
				if err != nil {
					t.Fatal(err)
				}
				defer reopened.Close()
				durable, err := reopened.GetLearningAttempt(ctx, u.ID, v.ID)
				if err != nil || durable.Result.XPDelta != 30 {
					t.Fatal("result lost after reconnect", err)
				}
			}
			create.RequestID = "42345678-1234-4123-8123-123456789012"
			create.Round = 0
			guest, err := s.CreateLearningAttempt(ctx, "", create)
			if err != nil {
				t.Fatal(err)
			}
			if s.db != nil {
				defer s.db.ExecContext(ctx, `DELETE FROM learning_attempts WHERE id=$1`, guest.ID)
			}
			demoBefore, _ := s.GetUser(ctx, s.DemoID())
			gr, err := s.SubmitLearningAttempt(ctx, "", guest.ID, learning.Submission{ChoiceID: guest.Choices[0].ID, ContentVersion: 1, RulesVersion: 1})
			if err != nil || gr.ProgressionApplied || gr.XPDelta != 0 {
				t.Fatal("guest earned progression")
			}
			demoAfter, _ := s.GetUser(ctx, s.DemoID())
			if demoBefore.XP != demoAfter.XP {
				t.Fatal("guest mutated demo")
			}
			create.RequestID = "52345678-1234-4123-8123-123456789012"
			expiring, _ := s.CreateLearningAttempt(ctx, u.ID, create)
			// Age private persisted state; browser input cannot change this deadline.
			if s.db != nil {
				var raw []byte
				_ = s.db.QueryRowContext(ctx, `SELECT snapshot FROM learning_attempts WHERE id=$1`, expiring.ID).Scan(&raw)
				var a learning.Attempt
				_ = json.Unmarshal(raw, &a)
				a.View.ExpiresAt = time.Now().Add(-time.Minute)
				raw, _ = json.Marshal(a)
				_, err = s.db.ExecContext(ctx, `UPDATE learning_attempts SET snapshot=$2 WHERE id=$1`, expiring.ID, string(raw))
				if err != nil {
					t.Fatal(err)
				}
			} else {
				r := s.learning[expiring.ID]
				r.Attempt.View.ExpiresAt = time.Now().Add(-time.Minute)
				s.learning[expiring.ID] = r
			}
			if _, err = s.SubmitLearningAttempt(ctx, u.ID, expiring.ID, learning.Submission{ChoiceID: expiring.Choices[0].ID, ContentVersion: 1, RulesVersion: 1}); !errors.Is(err, learning.ErrExpired) {
				t.Fatal("expired attempt scored")
			}
			// Different attempts racing for the same previously unanswered content
			// must share a single reward claim, not just an attempt-row lock.
			before, _ = s.GetUser(ctx, u.ID)
			results := make(chan learning.Verdict, 6)
			for i := 0; i < 6; i++ {
				wg.Add(1)
				go func(i int) {
					defer wg.Done()
					a, err := s.CreateLearningAttempt(ctx, u.ID, learning.Create{RequestID: fmt.Sprintf("%08d-1234-4123-8123-123456789012", i+60), Pack: "default", Round: 2})
					if err != nil {
						t.Error(err)
						return
					}
					for _, c := range a.Choices {
						if c.Label == "abundant" {
							r, err := s.SubmitLearningAttempt(ctx, u.ID, a.ID, learning.Submission{ChoiceID: c.ID, ContentVersion: 1, RulesVersion: 1})
							if err != nil {
								t.Error(err)
								return
							}
							results <- r
						}
					}
				}(i)
			}
			wg.Wait()
			close(results)
			claims, count := 0, 0
			for r := range results {
				count++
				if r.ProgressionApplied {
					claims++
				}
			}
			after, _ := s.GetUser(ctx, u.ID)
			if count != 6 || claims != 1 || after.XP-before.XP != 30 {
				t.Fatal("parallel content replay rewarded twice", count, claims, after.XP-before.XP)
			}
		})
	}
}
