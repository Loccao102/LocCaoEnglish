package store

import (
	"context"
	"fmt"
	"math"
	"os"
	"reflect"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/Loccao102/LocCaoEnglish/backend/internal/model"
)

func TestShadowingEvidencePersistence(t *testing.T) {
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
			u, err := s.CreateUser(ctx, fmt.Sprintf("shadow-%d@example.test", time.Now().UnixNano()), "hash", "Speaker")
			if err != nil {
				t.Fatal(err)
			}
			if s.db != nil {
				defer s.db.ExecContext(ctx, "DELETE FROM users WHERE id=$1", u.ID)
			}
			second := s
			if url != "" {
				second, err = New(url)
				if err != nil {
					t.Fatal(err)
				}
				defer second.Close()
			}
			open := func(request, item string) LearningAttemptRecord {
				input := model.LearningAttemptStartInput{RequestID: request, Activity: "shadowing", Pack: "cefr-core", CEFRLevel: "B1"}
				snap := LearningSnapshot{Input: input, Prompt: model.LearningAttemptPrompt{Question: "I think that that helps.", Options: []string{}}}
				a, _, err := s.StartLearningAttempt(ctx, u.ID, request, "shadowing", "Speaking", item, "B1", "retired-bank", "shadowing.v1", snap.Prompt.Question, snap.Prompt.Question, "Guided text, not acoustic evidence.", snap)
				if err != nil {
					t.Fatal(err)
				}
				return a
			}
			v := model.LearningAttemptSubmitInput{ContentVersion: "retired-bank", RulesVersion: "shadowing.v1"}
			a := open("first", "shadow-phrase")
			if _, err := second.SubmitLearningAttempt(ctx, "other", a.ID, "I think that helps.", v); err != ErrAttemptOwner {
				t.Fatal("owner", err)
			}
			for _, answer := range []string{"...", strings.Repeat("x", 2049)} {
				if _, err := second.SubmitLearningAttempt(ctx, u.ID, a.ID, answer, v); err != ErrAttemptInput {
					t.Fatal("input", err)
				}
			}
			bad := v
			bad.RulesVersion = "shadowing.v2"
			if _, err := second.SubmitLearningAttempt(ctx, u.ID, a.ID, "I think that helps.", bad); err != ErrAttemptInput {
				t.Fatal("version", err)
			}
			var wg sync.WaitGroup
			results := make(chan model.LearningAttemptResult, 8)
			errs := make(chan error, 8)
			for range 8 {
				wg.Add(1)
				go func() {
					defer wg.Done()
					r, e := second.SubmitLearningAttempt(ctx, u.ID, a.ID, "I think that helps.", v)
					results <- r
					errs <- e
				}()
			}
			wg.Wait()
			close(results)
			close(errs)
			for e := range errs {
				if e != nil {
					t.Fatal(e)
				}
			}
			var result model.LearningAttemptResult
			for r := range results {
				if result.AttemptID != "" && !reflect.DeepEqual(result, r) {
					t.Fatal("retry drift")
				}
				result = r
			}
			if result.Correct || result.XPDelta != 0 || !result.ReviewAdded || !result.ProgressionApplied || result.ActualAnswer != "I think that helps." || result.TranscriptMatch == nil || result.TranscriptMatch.Missing != 1 || math.Abs(result.TranscriptMatch.Accuracy-.8) > 1e-9 || result.Evidence != "server-guided-transcript-match" {
				t.Fatalf("wrong result: %+v", result)
			}
			if result.Dictation != nil || result.Listening != nil {
				t.Fatal("wrong evidence kind")
			}
			if _, err := second.SubmitLearningAttempt(ctx, u.ID, a.ID, "i think that helps.", v); err != ErrAttemptConflict {
				t.Fatal("changed actual text", err)
			}
			saved, err := second.GetLearningAttempt(ctx, u.ID, a.ID)
			if err != nil || !reflect.DeepEqual(LearningResult(saved), &result) {
				t.Fatal("durable result", err)
			}
			b := open("repeat", "shadow-phrase")
			r, err := second.SubmitLearningAttempt(ctx, u.ID, b.ID, "I THINK THAT THAT HELPS!", v)
			if err != nil || !r.Correct || r.ProgressionApplied || r.XPDelta != 0 {
				t.Fatal("daily cap", r, err)
			}
			c := open("fresh", "fresh-shadow")
			r, err = second.SubmitLearningAttempt(ctx, u.ID, c.ID, "I THINK THAT THAT HELPS!", v)
			if err != nil || !r.Correct || r.XPDelta != 20 || r.TranscriptMatch.Accuracy != 1 {
				t.Fatal("practice reward", r, err)
			}
			if s.db != nil {
				var actual, source string
				var count int
				if err := s.db.QueryRowContext(ctx, "SELECT answer,grading_source FROM attempts WHERE id=$1", a.ID).Scan(&actual, &source); err != nil || actual != result.ActualAnswer || source != result.Evidence {
					t.Fatal("stored evidence", err)
				}
				if err := s.db.QueryRowContext(ctx, "SELECT failures FROM review_items WHERE user_id=$1 AND item_key=$2", u.ID, a.ItemKey).Scan(&count); err != nil || count != 1 {
					t.Fatal("duplicate review", count, err)
				}
			}
			expired := open("expired", "old-shadow")
			if s.db != nil {
				_, err = s.db.ExecContext(ctx, "UPDATE learning_attempts SET expires_at=NOW()-INTERVAL '1 hour' WHERE id=$1 OR id=$2", expired.ID, a.ID)
				if err != nil {
					t.Fatal(err)
				}
			} else {
				s.mu.Lock()
				for _, id := range []string{expired.ID, a.ID} {
					rec := s.learningAttempts[id]
					rec.ExpiresAt = time.Now().Add(-time.Hour)
					s.learningAttempts[id] = rec
				}
				s.mu.Unlock()
			}
			if _, err := second.SubmitLearningAttempt(ctx, u.ID, expired.ID, "I think that that helps.", v); err != ErrAttemptExpired {
				t.Fatal("expiry", err)
			}
			if retry, err := second.SubmitLearningAttempt(ctx, u.ID, a.ID, result.ActualAnswer, v); err != nil || !reflect.DeepEqual(result, retry) {
				t.Fatal("expired result retry", err)
			}
		})
	}
}
