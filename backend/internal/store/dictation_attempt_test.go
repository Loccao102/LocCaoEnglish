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

func TestDictationPersistence(t *testing.T) {
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
			u, err := s.CreateUser(ctx, fmt.Sprintf("dictation-%d@example.test", time.Now().UnixNano()), "hash", "Writer")
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
			open := func(key, item string) LearningAttemptRecord {
				snapshot := LearningSnapshot{Input: model.LearningAttemptStartInput{RequestID: key, Activity: "dictation", Pack: "cefr-core", CEFRLevel: "B1"}, Prompt: model.LearningAttemptPrompt{Question: "Write the sentence", Options: []string{}}, Listening: &ListeningSnapshot{Transcript: "We have a little cat.", Events: []model.ListeningPlayback{}}}
				a, _, err := s.StartLearningAttempt(ctx, u.ID, key, "dictation", "Dictation", item, "B1", "retired-dictation-bank", "dictation.v1", "Write the sentence", "We have a little cat.", "Notice little.", snapshot)
				if err != nil {
					t.Fatal(err)
				}
				return a
			}
			versions := model.LearningAttemptSubmitInput{ContentVersion: "retired-dictation-bank", RulesVersion: "dictation.v1"}
			ready := func(a LearningAttemptRecord) {
				e := model.ListeningPlayback{RequestID: "play", Rate: .72, Status: "requested"}
				if _, err := second.RecordListeningPlayback(ctx, u.ID, a.ID, a.ContentVersion, a.RulesVersion, e); err != nil {
					t.Fatal(err)
				}
				e.Status, e.Provider = "completed", "browser-speech-synthesis"
				if _, err := second.RecordListeningPlayback(ctx, u.ID, a.ID, a.ContentVersion, a.RulesVersion, e); err != nil {
					t.Fatal(err)
				}
			}
			a := open("first", "saved-item")
			if _, err := s.SubmitLearningAttempt(ctx, u.ID, a.ID, "We have a cat.", versions); err != ErrAttemptConflict {
				t.Fatal("audio gate", err)
			}
			ready(a)
			if _, err := s.SubmitLearningAttempt(ctx, "other", a.ID, "We have a cat.", versions); err != ErrAttemptOwner {
				t.Fatal("owner", err)
			}
			for _, bad := range []string{"...", strings.Repeat("x", 2049)} {
				if _, err := s.SubmitLearningAttempt(ctx, u.ID, a.ID, bad, versions); err != ErrAttemptInput {
					t.Fatal("invalid answer", err)
				}
			}
			wrongVersion := versions
			wrongVersion.RulesVersion = "dictation.v2"
			if _, err := s.SubmitLearningAttempt(ctx, u.ID, a.ID, "We have a cat.", wrongVersion); err != ErrAttemptInput {
				t.Fatal("version", err)
			}
			var wg sync.WaitGroup
			results := make(chan model.LearningAttemptResult, 8)
			errs := make(chan error, 8)
			for i := 0; i < 8; i++ {
				wg.Add(1)
				go func() {
					defer wg.Done()
					r, e := second.SubmitLearningAttempt(ctx, u.ID, a.ID, "We have a cat.", versions)
					results <- r
					errs <- e
				}()
			}
			wg.Wait()
			close(results)
			close(errs)
			for err := range errs {
				if err != nil {
					t.Fatal(err)
				}
			}
			var result model.LearningAttemptResult
			for r := range results {
				if result.AttemptID != "" && !reflect.DeepEqual(result, r) {
					t.Fatal("unstable retry")
				}
				result = r
			}
			if result.Correct || result.XPDelta != 0 || !result.ReviewAdded || result.ActualAnswer != "We have a cat." || result.Dictation == nil || result.Dictation.Missing != 1 || result.Dictation.Matched != 4 || math.Abs(result.Dictation.Accuracy-.8) > 1e-9 || result.Evidence != "server-objective-guided-dictation" {
				t.Fatalf("wrong verdict: %+v", result)
			}
			if math.Abs(result.NewConfidence-(initialConfidence("Dictation")*.75+.8*.25)) > 1e-9 {
				t.Fatal("partial confidence", result.NewConfidence)
			}
			if _, err := s.SubmitLearningAttempt(ctx, u.ID, a.ID, "we have a cat.", versions); err != ErrAttemptConflict {
				t.Fatal("changed actual payload accepted", err)
			}
			saved, err := second.GetLearningAttempt(ctx, u.ID, a.ID)
			if err != nil || !reflect.DeepEqual(LearningResult(saved), &result) {
				t.Fatal("snapshot reconnect", err)
			}
			b := open("repeat", "saved-item")
			ready(b)
			r, err := s.SubmitLearningAttempt(ctx, u.ID, b.ID, "WE HAVE A LITTLE CAT!", versions)
			if err != nil || !r.Correct || r.ProgressionApplied || r.XPDelta != 0 {
				t.Fatal("daily cap", r, err)
			}
			c := open("fresh", "fresh-item")
			ready(c)
			r, err = s.SubmitLearningAttempt(ctx, u.ID, c.ID, "WE HAVE A LITTLE CAT!", versions)
			if err != nil || !r.Correct || r.XPDelta != 20 || r.Dictation.Accuracy != 1 {
				t.Fatal("perfect", r, err)
			}
			if s.db != nil {
				var accuracy float64
				var actual, source string
				var count int
				if err := s.db.QueryRowContext(ctx, "SELECT answer,accuracy,grading_source FROM attempts WHERE id=$1", a.ID).Scan(&actual, &accuracy, &source); err != nil {
					t.Fatal(err)
				}
				if actual != result.ActualAnswer || accuracy != .8 || source != result.Evidence {
					t.Fatal("wrong durable evidence", actual, accuracy, source)
				}
				if err := s.db.QueryRowContext(ctx, "SELECT failures FROM review_items WHERE user_id=$1 AND item_key=$2", u.ID, "saved-item").Scan(&count); err != nil || count != 1 {
					t.Fatal("duplicated review", count, err)
				}
			}
			expired := open("expired", "expired-item")
			ready(expired)
			if s.db != nil {
				if _, err := s.db.ExecContext(ctx, "UPDATE learning_attempts SET expires_at=NOW()-INTERVAL '1 hour' WHERE id=$1 OR id=$2", expired.ID, a.ID); err != nil {
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
			if _, err := second.SubmitLearningAttempt(ctx, u.ID, expired.ID, "We have a little cat.", versions); err != ErrAttemptExpired {
				t.Fatal("expired active round", err)
			}
			if retry, err := second.SubmitLearningAttempt(ctx, u.ID, a.ID, "We have a cat.", versions); err != nil || !reflect.DeepEqual(result, retry) {
				t.Fatal("completed expiry retry", err)
			}
		})
	}
}
