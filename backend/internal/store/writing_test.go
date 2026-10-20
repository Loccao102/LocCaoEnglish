package store

import (
	"context"
	"errors"
	"fmt"
	"os"
	"reflect"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/Loccao102/LocCaoEnglish/backend/internal/writing"
)

func writingFeedback(essay string) *writing.Feedback {
	zero := 0.0
	f := &writing.Feedback{Provider: "configured-llm", Model: "test-model", EvaluatorVersion: writing.EvaluatorVersion, RulesVersion: writing.RulesVersion, Overall: &zero, Criteria: map[string]writing.Criterion{}, Strengths: []string{"The topic is identified."}, Improvements: []string{"Support your position with a specific example."}}
	for _, key := range writing.Criteria {
		f.Criteria[key] = writing.Criterion{Band: &zero, Evidence: essay[:16], Comment: "Develop this claim."}
	}
	return f
}
func TestWritingReceiptsMemoryAndPostgres(t *testing.T) {
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
			for i := 0; i < 2; i++ {
				if err = s.EnsureIELTS(ctx); err != nil {
					t.Fatal(err)
				}
			}
			if s.db != nil {
				migration, e := os.ReadFile("../../migrations/019_writing_receipts.sql")
				if e != nil {
					t.Fatal(e)
				}
				for i := 0; i < 2; i++ {
					if _, e = s.db.ExecContext(ctx, string(migration)); e != nil {
						t.Fatal(e)
					}
				}
			}
			u, err := s.CreateUser(ctx, fmt.Sprintf("writing-%d@example.test", time.Now().UnixNano()), "hash", "Writer")
			if err != nil {
				t.Fatal(err)
			}
			if s.db != nil {
				defer s.db.ExecContext(ctx, "DELETE FROM users WHERE id=$1", u.ID)
			}
			skills, _ := s.Skills(ctx, u.ID)
			req := writing.StartInput{RequestID: "writing-start-request-001"}
			a, err := s.StartWriting(ctx, u.ID, req)
			if err != nil {
				t.Fatal(err)
			}
			again, err := s.StartWriting(ctx, u.ID, req)
			if err != nil || !reflect.DeepEqual(a, again) {
				t.Fatal("create retry", err)
			}
			if _, err = s.GetWriting(ctx, "other", a.ID); !errors.Is(err, ErrNotFound) {
				t.Fatal("owner leak", err)
			}
			if list, _ := s.ListWriting(ctx, "other"); len(list) != 0 {
				t.Fatal("list owner leak")
			}
			essay := strings.Repeat("Public transport supports people in the city. ", 40) + "\n\nMore buses could improve access."
			if len(essay) <= 2048 {
				essay += strings.Repeat("People need reliable connections. ", 25)
			}
			input := writing.SaveInput{Version: 0, Essay: essay, RulesVersion: writing.RulesVersion}
			a, err = s.SaveWritingDraft(ctx, u.ID, a.ID, input)
			if err != nil || a.Version != 1 {
				t.Fatal("save", err)
			}
			again, err = s.SaveWritingDraft(ctx, u.ID, a.ID, input)
			if err != nil || !reflect.DeepEqual(a, again) {
				t.Fatal("draft retry", err)
			}
			bad := input
			bad.Essay = "other tab"
			if _, err = s.SaveWritingDraft(ctx, u.ID, a.ID, bad); !errors.Is(err, writing.ErrConflict) {
				t.Fatal("overwrote concurrent draft", err)
			}
			bad.Version = 1
			bad.Essay = strings.Repeat("a", 12001)
			if _, err = s.SaveWritingDraft(ctx, u.ID, a.ID, bad); !errors.Is(err, writing.ErrInput) {
				t.Fatal("essay bound", err)
			}
			input.Version = 1
			submit := writing.SubmitInput{SaveInput: input}
			// Independent PostgreSQL connections must serialize the provider claim too.
			second := s
			if s.db != nil {
				second, err = New(url)
				if err != nil {
					t.Fatal(err)
				}
				defer second.Close()
			}
			var creators sync.WaitGroup
			createdIDs := make(chan string, 8)
			for i := 0; i < 8; i++ {
				creators.Add(1)
				go func(i int) {
					defer creators.Done()
					st := s
					if i%2 == 1 {
						st = second
					}
					a, e := st.StartWriting(ctx, u.ID, writing.StartInput{RequestID: "concurrent-create-request"})
					if e != nil {
						t.Error(e)
						return
					}
					createdIDs <- a.ID
				}(i)
			}
			creators.Wait()
			close(createdIDs)
			onlyID := ""
			for id := range createdIDs {
				if onlyID != "" && onlyID != id {
					t.Fatal("duplicate concurrent draft")
				}
				onlyID = id
			}
			var claims atomic.Int32
			var wg sync.WaitGroup
			for i := 0; i < 12; i++ {
				wg.Add(1)
				go func(i int) {
					defer wg.Done()
					st := s
					if i%2 == 1 {
						st = second
					}
					_, claimed, e := st.ClaimWriting(ctx, u.ID, a.ID, submit)
					if e != nil {
						t.Error(e)
					}
					if claimed {
						claims.Add(1)
					}
				}(i)
			}
			wg.Wait()
			if claims.Load() != 1 {
				t.Fatal("duplicate provider claim", claims.Load())
			}
			pending, _ := s.GetWriting(ctx, u.ID, a.ID)
			if _, err = s.SaveWritingDraft(ctx, u.ID, a.ID, input); !errors.Is(err, writing.ErrConflict) {
				t.Fatal("submitted draft mutable")
			}
			if _, err = s.StartWriting(ctx, u.ID, writing.StartInput{RequestID: "pending-child-request", ParentID: a.ID}); !errors.Is(err, writing.ErrConflict) {
				t.Fatal("pending revision allowed", err)
			}
			invalid := writingFeedback(essay)
			invalid.Criteria[writing.Criteria[0]] = writing.Criterion{}
			if _, err = s.FinishWriting(ctx, u.ID, a.ID, pending.Generation, invalid); !errors.Is(err, writing.ErrInput) {
				t.Fatal("invalid feedback saved", err)
			}
			failed, err := s.FinishWriting(ctx, u.ID, a.ID, pending.Generation, nil)
			if err != nil || failed.Status != "failed" || failed.Feedback != nil || failed.Essay != essay {
				t.Fatal("failure lost essay", err)
			}
			if history, _ := s.IELTSHistory(ctx, u.ID, 30); len(history) != 0 {
				t.Fatal("failure invented score")
			}
			oldRetry, reclaimed, e := s.ClaimWriting(ctx, u.ID, a.ID, submit)
			if e != nil || reclaimed || oldRetry.Status != "failed" || oldRetry.Generation != 1 {
				t.Fatal("uncertain old submit repeated provider", e)
			}
			submit.Generation = 1
			next, claimed, err := s.ClaimWriting(ctx, u.ID, a.ID, submit)
			if err != nil || !claimed || next.Generation != 2 {
				t.Fatal("retry claim", err)
			}
			// Simulate a dead worker. A new generation fences late results, including failure.
			_, err = s.changeWriting(ctx, u.ID, a.ID, func(a *writing.Attempt) error { past := time.Now().Add(-time.Second); a.LeaseUntil = &past; return nil })
			if err != nil {
				t.Fatal(err)
			}
			submit.Generation = 2
			next, claimed, err = s.ClaimWriting(ctx, u.ID, a.ID, submit)
			if err != nil || !claimed || next.Generation != 3 {
				t.Fatal("expired lease", err)
			}
			if _, err = s.FinishWriting(ctx, u.ID, a.ID, 2, writingFeedback(essay)); !errors.Is(err, writing.ErrConflict) {
				t.Fatal("stale worker committed", err)
			}
			completed, err := s.FinishWriting(ctx, u.ID, a.ID, 3, writingFeedback(essay))
			if err != nil || completed.Status != "completed" || *completed.Feedback.Overall != 0 {
				t.Fatal("zero band rejected", err)
			}
			replay, claimed, err := s.ClaimWriting(ctx, u.ID, a.ID, submit)
			if err != nil || claimed || !reflect.DeepEqual(completed, replay) {
				t.Fatal("completed retry", err)
			}
			bad = input
			bad.Essay += "changed"
			if _, _, err = s.ClaimWriting(ctx, u.ID, a.ID, writing.SubmitInput{SaveInput: bad, Generation: 3}); !errors.Is(err, writing.ErrConflict) {
				t.Fatal("changed receipt", err)
			}
			child, err := s.StartWriting(ctx, u.ID, writing.StartInput{RequestID: "revision-child-request", ParentID: a.ID})
			if err != nil || child.Revision != 2 || child.Essay != essay || child.Feedback != nil || child.Status != "draft" {
				t.Fatal("revision", err)
			}
			history, err := s.IELTSHistory(ctx, u.ID, 30)
			if err != nil || len(history) != 1 || history[0].Band != 0 || history[0].Evidence != "provider-estimate" || history[0].AttemptID != a.ID {
				t.Fatal("history receipt", history, err)
			}
			completed.Feedback.Improvements[0] = "caller mutation"
			completed.Feedback.Criteria[writing.Criteria[0]] = writing.Criterion{}
			fresh, _ := s.GetWriting(ctx, u.ID, a.ID)
			if fresh.Feedback.Improvements[0] == "caller mutation" || fresh.Feedback.Criteria[writing.Criteria[0]].Band == nil {
				t.Fatal("snapshot alias")
			}
			user, _ := s.GetUser(ctx, u.ID)
			after, _ := s.Skills(ctx, u.ID)
			reviews, _ := s.ReviewQueue(ctx, u.ID, 100)
			if user.XP != u.XP || !reflect.DeepEqual(skills, after) || len(reviews) != 0 {
				t.Fatal("Writing granted learning progress")
			}
		})
	}
}
