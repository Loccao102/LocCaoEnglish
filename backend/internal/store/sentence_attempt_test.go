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
	"github.com/Loccao102/LocCaoEnglish/backend/internal/model"
)

func TestSentenceAttemptsMemoryAndPostgres(t *testing.T) {
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
			user, err := s.CreateUser(ctx, fmt.Sprintf("sentence-%d@example.test", time.Now().UnixNano()), "hash", "Builder")
			if err != nil {
				t.Fatal(err)
			}
			if s.db != nil {
				defer s.db.ExecContext(ctx, `DELETE FROM users WHERE id=$1`, user.ID)
			}
			chunks := []model.SentenceChunk{{ID: "x", Text: "I"}, {ID: "y", Text: "like"}, {ID: "z", Text: "tea"}}
			start := func(owner, request, item string) LearningAttemptRecord {
				snap := LearningSnapshot{Input: model.LearningAttemptStartInput{RequestID: request, Activity: "sentence-builder", Pack: "cefr-core", CEFRLevel: "A1"}, Prompt: model.LearningAttemptPrompt{Question: "Name your favourite drink.", Chunks: chunks}}
				a, _, e := s.StartLearningAttempt(ctx, owner, request, "sentence-builder", "Grammar", item, "A1", "test.v1", learning.SentenceRulesVersion, snap.Prompt.Question, "I like tea", "Subject, verb, object.", snap)
				if e != nil {
					t.Fatal(e)
				}
				return a
			}
			versions := model.LearningAttemptSubmitInput{ContentVersion: "test.v1", RulesVersion: learning.SentenceRulesVersion}
			correct, wrong := `["x","y","z"]`, `["z","y","x"]`
			a := start(user.ID, "first", "sentence-one")
			// Snapshot is independent of both the source catalog and returned values.
			a.Snapshot.Prompt.Chunks[0].Text = "mutated"
			saved, err := s.GetLearningAttempt(ctx, user.ID, a.ID)
			if err != nil || saved.Snapshot.Prompt.Chunks[0].Text != "I" {
				t.Fatal("snapshot aliased", err)
			}
			if _, err := s.SubmitLearningAttempt(ctx, "", a.ID, correct, versions); !errors.Is(err, ErrAttemptOwner) {
				t.Fatal("owner bypass", err)
			}
			for _, invalid := range []string{"I like tea", `["x","y"]`, `["x","y","y"]`, `["x","y","fake"]`} {
				if _, err := s.SubmitLearningAttempt(ctx, user.ID, a.ID, invalid, versions); !errors.Is(err, ErrAttemptInput) {
					t.Fatal("invalid sequence accepted", invalid, err)
				}
			}
			bad := versions
			bad.RulesVersion = "sentence-builder.v0"
			if _, err := s.SubmitLearningAttempt(ctx, user.ID, a.ID, correct, bad); !errors.Is(err, ErrAttemptInput) {
				t.Fatal("version accepted", err)
			}
			var wg sync.WaitGroup
			for n := 0; n < 8; n++ {
				wg.Add(1)
				go func() {
					defer wg.Done()
					v, e := s.SubmitLearningAttempt(ctx, user.ID, a.ID, correct, versions)
					if e != nil || !v.Correct || v.XPDelta != 20 || v.ActualAnswer != "I like tea" {
						t.Errorf("concurrent retry: %+v %v", v, e)
					}
				}()
			}
			wg.Wait()
			if _, err := s.SubmitLearningAttempt(ctx, user.ID, a.ID, wrong, versions); !errors.Is(err, ErrAttemptConflict) {
				t.Fatal("regraded after feedback", err)
			}
			// Distinct attempts for the same item still cannot claim another reward.
			b := start(user.ID, "second", "sentence-one")
			v, err := s.SubmitLearningAttempt(ctx, user.ID, b.ID, correct, versions)
			if err != nil || v.XPDelta != 0 || v.ProgressionApplied {
				t.Fatal("daily cap", v, err)
			}
			c := start(user.ID, "wrong", "sentence-two")
			v, err = s.SubmitLearningAttempt(ctx, user.ID, c.ID, wrong, versions)
			if err != nil || v.Correct || v.XPDelta != 0 || !v.ReviewAdded || v.ActualAnswer != "tea like I" || v.CorrectAnswer != "I like tea" {
				t.Fatal("wrong verdict", v, err)
			}
			restored, err := s.GetLearningAttempt(ctx, user.ID, c.ID)
			if err != nil || restored.SubmittedAnswer != wrong || !reflect.DeepEqual(LearningResult(restored), &v) {
				t.Fatal("lost submitted order", err)
			}
			reviews, _ := s.ReviewQueue(ctx, user.ID, 10)
			if len(reviews) != 1 || reviews[0].Answer != "I like tea" {
				t.Fatal("review contains IDs or actual error", reviews)
			}
			u, _ := s.GetUser(ctx, user.ID)
			if u.XP != 20 {
				t.Fatal("incorrect XP", u.XP)
			}
			guest := start("", "guest", "sentence-one")
			gv, err := s.SubmitLearningAttempt(ctx, "", guest.ID, correct, versions)
			if err != nil || !gv.Correct || gv.ProgressionApplied || gv.XPDelta != 0 {
				t.Fatal("guest progression", gv, err)
			}
			if s.db != nil {
				defer s.db.ExecContext(ctx, `DELETE FROM learning_attempts WHERE id=$1`, guest.ID)
				var actual, source string
				if err := s.db.QueryRowContext(ctx, `SELECT answer,grading_source FROM attempts WHERE id=$1`, c.ID).Scan(&actual, &source); err != nil || actual != "tea like I" || source != "server-objective" {
					t.Fatal("wrong evidence", actual, source, err)
				}
				// A reopened store restores both the IDs and readable result.
				reopened, err := New(url)
				if err != nil {
					t.Fatal(err)
				}
				defer reopened.Close()
				r, err := reopened.GetLearningAttempt(ctx, user.ID, c.ID)
				if err != nil || !reflect.DeepEqual(LearningResult(r), &v) || !reflect.DeepEqual(r.Snapshot, restored.Snapshot) {
					raw, _ := json.Marshal(r)
					t.Fatal("restart changed round", string(raw), err)
				}
			}
		})
	}
}
