package store

import (
	"context"
	"errors"
	"os"
	"reflect"
	"sync"
	"testing"

	"github.com/Loccao102/LocCaoEnglish/backend/internal/model"
)

func reviewScheduleFixture(t *testing.T, s *Store, email, item string) model.User {
	t.Helper()
	ctx := context.Background()
	u, err := s.CreateUser(ctx, email, "hash", "Review receipt tester")
	if err != nil {
		t.Fatal(err)
	}
	if s.db != nil {
		t.Cleanup(func() { _, _ = s.db.ExecContext(ctx, `DELETE FROM users WHERE id=$1`, u.ID) })
	}
	snapshot := LearningSnapshot{Input: model.LearningAttemptStartInput{Activity: "word-link", CEFRLevel: "A1", Pack: "cefr-core"}, Prompt: model.LearningAttemptPrompt{Word: item, Relation: "synonym", Options: []string{"glad", "sad"}}}
	attempt, _, err := s.StartLearningAttempt(ctx, u.ID, "receipt-seed-"+newID(), "word-link", "Vocabulary", item, "A1", "receipt-content.v1", "word-link.v1", item+" — choose a synonym", "glad", "Practice.", snapshot)
	if err != nil {
		t.Fatal(err)
	}
	if _, err = s.SubmitLearningAttempt(ctx, u.ID, attempt.ID, "sad", model.LearningAttemptSubmitInput{ContentVersion: attempt.ContentVersion, RulesVersion: attempt.RulesVersion}); err != nil {
		t.Fatal(err)
	}
	return u
}

func TestReviewScheduleReceiptIsIdempotentAndOwnerScoped(t *testing.T) {
	skillPracticeStores(t, func(t *testing.T, s *Store, _ string) {
		ctx := context.Background()
		u := reviewScheduleFixture(t, s, "review-receipt-"+newID()+"@example.test", "receipt-item")
		before, err := s.ReviewQueue(ctx, u.ID, 10)
		if err != nil || len(before) != 1 {
			t.Fatalf("seed review: %v %#v", err, before)
		}
		in := ReviewScheduleRequest{RequestID: "receipt-request-1", Quality: 5, RulesVersion: ReviewScheduleRulesVersion}
		first, err := s.ScheduleReview(ctx, u.ID, "receipt-item", in)
		if err != nil {
			t.Fatal(err)
		}
		afterFirst, _ := s.ReviewQueue(ctx, u.ID, 10)
		second, err := s.ScheduleReview(ctx, u.ID, "receipt-item", in)
		if err != nil || !reflect.DeepEqual(first, second) {
			t.Fatalf("exact retry should return immutable receipt: %#v %#v %v", first, second, err)
		}
		afterRetry, _ := s.ReviewQueue(ctx, u.ID, 10)
		if !reflect.DeepEqual(afterFirst, afterRetry) || afterFirst[0].IntervalDays != 3 {
			t.Fatalf("retry applied a second transition: first=%#v retry=%#v", afterFirst, afterRetry)
		}
		if _, err = s.ScheduleReview(ctx, u.ID, "receipt-item", ReviewScheduleRequest{RequestID: in.RequestID, Quality: 1, RulesVersion: in.RulesVersion}); !errors.Is(err, ErrReviewScheduleConflict) {
			t.Fatalf("changed quality must conflict, got %v", err)
		}
		if _, err = s.ReviewScheduleReceipt(ctx, u.ID, in.RequestID); err != nil {
			t.Fatal("owner should recover receipt", err)
		}
		foreign, err := s.CreateUser(ctx, "review-foreign-"+newID()+"@example.test", "hash", "Foreign")
		if err != nil {
			t.Fatal(err)
		}
		if _, err = s.ReviewScheduleReceipt(ctx, foreign.ID, in.RequestID); !errors.Is(err, ErrNotFound) {
			t.Fatalf("foreign receipt must be hidden, got %v", err)
		}
		if _, err = s.ScheduleReview(ctx, u.ID, "missing-item", ReviewScheduleRequest{RequestID: "missing-request", Quality: 4, RulesVersion: in.RulesVersion}); !errors.Is(err, ErrNotFound) {
			t.Fatalf("missing item must be 404/not found, got %v", err)
		}
		if _, err = s.ReviewScheduleReceipt(ctx, u.ID, "missing-request"); !errors.Is(err, ErrNotFound) {
			t.Fatalf("missing item must not leave phantom receipt, got %v", err)
		}
	})
}

func TestReviewScheduleConcurrentFirstClaimAndDueProjection(t *testing.T) {
	skillPracticeStores(t, func(t *testing.T, s *Store, _ string) {
		ctx := context.Background()
		u := reviewScheduleFixture(t, s, "review-concurrent-"+newID()+"@example.test", "concurrent-item")
		request := ReviewScheduleRequest{RequestID: "concurrent-request", Quality: 5, RulesVersion: ReviewScheduleRulesVersion}
		const workers = 8
		results := make(chan model.ReviewScheduleReceipt, workers)
		errs := make(chan error, workers)
		var wg sync.WaitGroup
		for i := 0; i < workers; i++ {
			wg.Add(1)
			go func() {
				defer wg.Done()
				receipt, err := s.ScheduleReview(ctx, u.ID, "concurrent-item", request)
				if err != nil {
					errs <- err
					return
				}
				results <- receipt
			}()
		}
		wg.Wait()
		close(results)
		close(errs)
		for err := range errs {
			t.Fatal(err)
		}
		var first model.ReviewScheduleReceipt
		for receipt := range results {
			if first.RequestID == "" {
				first = receipt
			} else if !reflect.DeepEqual(first, receipt) {
				t.Fatalf("concurrent retry returned different receipt: %#v %#v", first, receipt)
			}
		}
		items, err := s.ReviewQueue(ctx, u.ID, 10)
		if err != nil || len(items) != 1 || items[0].IntervalDays != 3 {
			t.Fatalf("concurrent first claim must schedule once: %v %#v", err, items)
		}
		// The explicit due projection excludes the future receipt while the
		// compatibility queue continues to expose the saved item.
		due, err := s.DueReviewQueue(ctx, u.ID, 10)
		if err != nil {
			t.Fatal(err)
		}
		if len(due) != 0 || len(items) != 1 {
			t.Fatalf("due-only projection parity: due=%#v all=%#v", due, items)
		}
		if _, err = s.ScheduleReview(ctx, u.ID, "concurrent-item", ReviewScheduleRequest{RequestID: "invalid-quality", Quality: 6, RulesVersion: ReviewScheduleRulesVersion}); !errors.Is(err, ErrReviewScheduleInput) {
			t.Fatalf("invalid quality should rollback/no-op, got %v", err)
		}
		if _, err = s.ReviewScheduleReceipt(ctx, u.ID, "invalid-quality"); !errors.Is(err, ErrNotFound) {
			t.Fatalf("invalid request must not create receipt, got %v", err)
		}
	})
}

func TestReviewScheduleReceiptSurvivesPostgresStoreRestart(t *testing.T) {
	databaseURL := os.Getenv("TEST_DATABASE_URL")
	if databaseURL == "" {
		t.Skip("set TEST_DATABASE_URL for PostgreSQL restart coverage")
	}
	first, err := New(databaseURL)
	if err != nil {
		t.Fatal(err)
	}
	u := reviewScheduleFixture(t, first, "review-restart-"+newID()+"@example.test", "restart-item")
	want, err := first.ScheduleReview(context.Background(), u.ID, "restart-item", ReviewScheduleRequest{RequestID: "restart-request", Quality: 4, RulesVersion: ReviewScheduleRulesVersion})
	if err != nil {
		first.Close()
		t.Fatal(err)
	}
	first.Close()
	second, err := New(databaseURL)
	if err != nil {
		t.Fatal(err)
	}
	got, err := second.ReviewScheduleReceipt(context.Background(), u.ID, "restart-request")
	if err != nil || !reflect.DeepEqual(want, got) {
		second.Close()
		t.Fatalf("receipt did not survive restart: want=%#v got=%#v err=%v", want, got, err)
	}
	_, _ = second.db.ExecContext(context.Background(), `DELETE FROM users WHERE id=$1`, u.ID)
	second.Close()
}
