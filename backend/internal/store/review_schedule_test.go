package store

import (
	"context"
	"errors"
	"fmt"
	"net/url"
	"os"
	"reflect"
	"sync"
	"testing"
	"time"

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
	reviewScheduleSeedItem(t, s, u.ID, item)
	return u
}

func reviewScheduleSeedItem(t *testing.T, s *Store, userID, item string) {
	t.Helper()
	snapshot := LearningSnapshot{Input: model.LearningAttemptStartInput{Activity: "word-link", CEFRLevel: "A1", Pack: "cefr-core"}, Prompt: model.LearningAttemptPrompt{Word: item, Relation: "synonym", Options: []string{"glad", "sad"}}}
	attempt, _, err := s.StartLearningAttempt(context.Background(), userID, "receipt-seed-"+newID(), "word-link", "Vocabulary", item, "A1", "receipt-content.v1", "word-link.v1", item+" — choose a synonym", "glad", "Practice.", snapshot)
	if err != nil {
		t.Fatal(err)
	}
	if _, err = s.SubmitLearningAttempt(context.Background(), userID, attempt.ID, "sad", model.LearningAttemptSubmitInput{ContentVersion: attempt.ContentVersion, RulesVersion: attempt.RulesVersion}); err != nil {
		t.Fatal(err)
	}
}

func reviewScheduleDueAt(t *testing.T, s *Store, userID, itemKey string) time.Time {
	t.Helper()
	items, err := s.ReviewQueue(context.Background(), userID, 100)
	if err != nil {
		t.Fatal(err)
	}
	for _, item := range items {
		if item.ItemKey == itemKey {
			return item.DueAt
		}
	}
	t.Fatalf("missing review item %q", itemKey)
	return time.Time{}
}

func TestReviewScheduleReceiptIsIdempotentAndOwnerScoped(t *testing.T) {
	skillPracticeStores(t, func(t *testing.T, s *Store, _ string) {
		ctx := context.Background()
		u := reviewScheduleFixture(t, s, "review-receipt-"+newID()+"@example.test", "receipt-item")
		before, err := s.ReviewQueue(ctx, u.ID, 10)
		if err != nil || len(before) != 1 {
			t.Fatalf("seed review: %v %#v", err, before)
		}
		in := ReviewScheduleRequest{RequestID: "receipt-request-1", Quality: 5, RulesVersion: ReviewScheduleRulesVersion, ExpectedDueAt: before[0].DueAt}
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
		if _, err = s.ScheduleReview(ctx, u.ID, "receipt-item", ReviewScheduleRequest{RequestID: in.RequestID, Quality: 1, RulesVersion: in.RulesVersion, ExpectedDueAt: in.ExpectedDueAt}); !errors.Is(err, ErrReviewScheduleConflict) {
			t.Fatalf("changed quality must conflict, got %v", err)
		}
		if _, err = s.ReviewScheduleReceipt(ctx, u.ID, in.RequestID); err != nil {
			t.Fatal("owner should recover receipt", err)
		}
		foreign, err := s.CreateUser(ctx, "review-foreign-"+newID()+"@example.test", "hash", "Foreign")
		if err != nil {
			t.Fatal(err)
		}
		if s.db != nil {
			t.Cleanup(func() { _, _ = s.db.ExecContext(ctx, `DELETE FROM users WHERE id=$1`, foreign.ID) })
		}
		if _, err = s.ReviewScheduleReceipt(ctx, foreign.ID, in.RequestID); !errors.Is(err, ErrNotFound) {
			t.Fatalf("foreign receipt must be hidden, got %v", err)
		}
		if _, err = s.ScheduleReview(ctx, u.ID, "missing-item", ReviewScheduleRequest{RequestID: "missing-request", Quality: 4, RulesVersion: in.RulesVersion, ExpectedDueAt: in.ExpectedDueAt}); !errors.Is(err, ErrNotFound) {
			t.Fatalf("missing item must be 404/not found, got %v", err)
		}
		if _, err = s.ReviewScheduleReceipt(ctx, u.ID, "missing-request"); !errors.Is(err, ErrNotFound) {
			t.Fatalf("missing item must not leave phantom receipt, got %v", err)
		}
		if s.db != nil {
			blocked := "review_receipt_block_" + u.ID
			trigger := "review_receipt_block_trigger_" + u.ID
			fnSQL := fmt.Sprintf(`CREATE OR REPLACE FUNCTION %s() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.owner_id = '%s' THEN RAISE EXCEPTION 'review receipt test rollback'; END IF; RETURN NEW; END $$`, blocked, u.ID)
			if _, err = s.db.ExecContext(ctx, fnSQL); err != nil {
				t.Fatal(err)
			}
			if _, err = s.db.ExecContext(ctx, fmt.Sprintf(`CREATE TRIGGER %s BEFORE INSERT ON review_schedule_receipts FOR EACH ROW EXECUTE FUNCTION %s()`, trigger, blocked)); err != nil {
				t.Fatal(err)
			}
			t.Cleanup(func() {
				_, _ = s.db.ExecContext(ctx, fmt.Sprintf(`DROP TRIGGER IF EXISTS %s ON review_schedule_receipts`, trigger))
				_, _ = s.db.ExecContext(ctx, fmt.Sprintf(`DROP FUNCTION IF EXISTS %s()`, blocked))
			})
			reviewScheduleSeedItem(t, s, u.ID, "rollback-item")
			beforeRollback, _ := s.ReviewQueue(ctx, u.ID, 10)
			rollbackDue := reviewScheduleDueAt(t, s, u.ID, "rollback-item")
			if _, err = s.ScheduleReview(ctx, u.ID, "rollback-item", ReviewScheduleRequest{RequestID: "rollback-request", Quality: 5, RulesVersion: ReviewScheduleRulesVersion, ExpectedDueAt: rollbackDue}); err == nil {
				t.Fatal("receipt trigger should force atomic rollback")
			}
			afterRollback, _ := s.ReviewQueue(ctx, u.ID, 10)
			findInterval := func(items []model.ReviewItem, key string) int {
				for _, item := range items {
					if item.ItemKey == key {
						return item.IntervalDays
					}
				}
				return 0
			}
			if findInterval(beforeRollback, "rollback-item") != findInterval(afterRollback, "rollback-item") {
				t.Fatalf("failed receipt insert changed review item: before=%#v after=%#v", beforeRollback, afterRollback)
			}
			if _, err = s.ReviewScheduleReceipt(ctx, u.ID, "rollback-request"); !errors.Is(err, ErrNotFound) {
				t.Fatalf("failed receipt insert left a receipt: %v", err)
			}
			if _, err = s.db.ExecContext(ctx, fmt.Sprintf(`DROP TRIGGER %s ON review_schedule_receipts`, trigger)); err != nil {
				t.Fatal(err)
			}
			if _, err = s.ScheduleReview(ctx, u.ID, "rollback-item", ReviewScheduleRequest{RequestID: "rollback-request", Quality: 5, RulesVersion: ReviewScheduleRulesVersion, ExpectedDueAt: rollbackDue}); err != nil {
				t.Fatal("valid retry after rollback failed", err)
			}
		}
	})
}

func TestReviewScheduleConcurrentFirstClaimAndDueProjection(t *testing.T) {
	skillPracticeStores(t, func(t *testing.T, s *Store, _ string) {
		ctx := context.Background()
		if s.db != nil {
			s.db.SetMaxOpenConns(8)
		}
		u := reviewScheduleFixture(t, s, "review-concurrent-"+newID()+"@example.test", "concurrent-item")
		request := ReviewScheduleRequest{RequestID: "concurrent-request", Quality: 5, RulesVersion: ReviewScheduleRulesVersion, ExpectedDueAt: reviewScheduleDueAt(t, s, u.ID, "concurrent-item")}
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
		if _, err = s.ScheduleReview(ctx, u.ID, "concurrent-item", ReviewScheduleRequest{RequestID: "invalid-quality", Quality: 6, RulesVersion: ReviewScheduleRulesVersion, ExpectedDueAt: request.ExpectedDueAt}); !errors.Is(err, ErrReviewScheduleInput) {
			t.Fatalf("invalid quality should rollback/no-op, got %v", err)
		}
		if _, err = s.ReviewScheduleReceipt(ctx, u.ID, "invalid-quality"); !errors.Is(err, ErrNotFound) {
			t.Fatalf("invalid request must not create receipt, got %v", err)
		}
		reviewScheduleSeedItem(t, s, u.ID, "split-item")
		beforeSplit, err := s.ReviewQueue(ctx, u.ID, 10)
		if err != nil {
			t.Fatal(err)
		}
		originals := map[string]model.ReviewItem{}
		for _, row := range beforeSplit {
			originals[row.ItemKey] = row
		}
		claims := make(chan error, 2)
		var split sync.WaitGroup
		split.Add(2)
		go func() {
			defer split.Done()
			_, err := s.ScheduleReview(ctx, u.ID, "concurrent-item", ReviewScheduleRequest{RequestID: "split-request", Quality: 4, RulesVersion: ReviewScheduleRulesVersion, ExpectedDueAt: reviewScheduleDueAt(t, s, u.ID, "concurrent-item")})
			claims <- err
		}()
		go func() {
			defer split.Done()
			_, err := s.ScheduleReview(ctx, u.ID, "split-item", ReviewScheduleRequest{RequestID: "split-request", Quality: 4, RulesVersion: ReviewScheduleRulesVersion, ExpectedDueAt: reviewScheduleDueAt(t, s, u.ID, "split-item")})
			claims <- err
		}()
		split.Wait()
		close(claims)
		var successes, conflicts int
		for err := range claims {
			switch {
			case err == nil:
				successes++
			case errors.Is(err, ErrReviewScheduleConflict):
				conflicts++
			default:
				t.Fatalf("same request on different items returned unexpected error: %v", err)
			}
		}
		if successes != 1 || conflicts != 1 {
			t.Fatalf("same request must have one winner and one conflict: successes=%d conflicts=%d", successes, conflicts)
		}
		items, err = s.ReviewQueue(ctx, u.ID, 10)
		if err != nil || len(items) != 2 {
			t.Fatalf("split race queue: %v %#v", err, items)
		}
		winner, err := s.ReviewScheduleReceipt(ctx, u.ID, "split-request")
		if err != nil {
			t.Fatal(err)
		}
		for _, item := range items {
			if item.ItemKey == winner.ItemKey {
				if item.IntervalDays != winner.IntervalDays || item.Ease != winner.Ease || item.Failures != winner.Failures || !item.DueAt.Equal(winner.DueAt) {
					t.Fatalf("winner and receipt differ: item=%#v receipt=%#v", item, winner)
				}
			} else if !reflect.DeepEqual(item, originals[item.ItemKey]) {
				t.Fatalf("losing item was updated: before=%#v after=%#v", originals[item.ItemKey], item)
			}
		}
		if _, err = s.ScheduleReview(ctx, u.ID, "concurrent-item", ReviewScheduleRequest{RequestID: "stale-request", Quality: 4, RulesVersion: ReviewScheduleRulesVersion, ExpectedDueAt: request.ExpectedDueAt}); !errors.Is(err, ErrReviewScheduleConflict) {
			t.Fatalf("stale due snapshot must conflict, got %v", err)
		}
		if _, err = s.ScheduleReview(ctx, u.ID, "concurrent-item", ReviewScheduleRequest{RequestID: "fresh-request", Quality: 4, RulesVersion: ReviewScheduleRulesVersion, ExpectedDueAt: reviewScheduleDueAt(t, s, u.ID, "concurrent-item")}); err != nil {
			t.Fatalf("fresh due snapshot should allow a new schedule: %v", err)
		}
	})
}

func TestReviewScheduleTwoTabsCannotAdvanceTheSameSnapshotTwice(t *testing.T) {
	skillPracticeStores(t, func(t *testing.T, s *Store, _ string) {
		if s.db != nil {
			s.db.SetMaxOpenConns(8)
		}
		ctx := context.Background()
		u := reviewScheduleFixture(t, s, "review-tabs-"+newID()+"@example.test", "two-tabs")
		dueAt := reviewScheduleDueAt(t, s, u.ID, "two-tabs")
		start := make(chan struct{})
		results := make(chan error, 2)
		var wg sync.WaitGroup
		for _, id := range []string{"tab-first", "tab-second"} {
			wg.Add(1)
			go func(id string) {
				defer wg.Done()
				<-start
				_, err := s.ScheduleReview(ctx, u.ID, "two-tabs", ReviewScheduleRequest{RequestID: id, Quality: 4, RulesVersion: ReviewScheduleRulesVersion, ExpectedDueAt: dueAt})
				results <- err
			}(id)
		}
		close(start)
		wg.Wait()
		close(results)
		successes, conflicts := 0, 0
		for err := range results {
			if err == nil {
				successes++
			} else if errors.Is(err, ErrReviewScheduleConflict) {
				conflicts++
			} else {
				t.Fatal(err)
			}
		}
		if successes != 1 || conflicts != 1 {
			t.Fatalf("two displayed copies scheduled twice: successes=%d conflicts=%d", successes, conflicts)
		}
		rows, err := s.ReviewQueue(ctx, u.ID, 10)
		if err != nil || len(rows) != 1 || rows[0].IntervalDays != 3 {
			t.Fatalf("two tabs changed interval twice: rows=%#v error=%v", rows, err)
		}
		receipts := 0
		for _, id := range []string{"tab-first", "tab-second"} {
			if _, err := s.ReviewScheduleReceipt(ctx, u.ID, id); err == nil {
				receipts++
			} else if !errors.Is(err, ErrNotFound) {
				t.Fatal(err)
			}
		}
		if receipts != 1 {
			t.Fatalf("stale tab created a phantom receipt: %d", receipts)
		}
		if s.db != nil {
			if _, err := s.db.ExecContext(ctx, `DELETE FROM review_items WHERE user_id=$1 AND item_key=$2`, u.ID, "two-tabs"); err != nil {
				t.Fatal(err)
			}
		} else {
			s.mu.Lock()
			delete(s.mem.reviews, u.ID)
			s.mu.Unlock()
		}
		for _, id := range []string{"tab-first", "tab-second"} {
			stored, err := s.ReviewScheduleReceipt(ctx, u.ID, id)
			if errors.Is(err, ErrNotFound) {
				continue
			}
			if err != nil {
				t.Fatal(err)
			}
			retry, err := s.ScheduleReview(ctx, u.ID, "two-tabs", ReviewScheduleRequest{RequestID: id, Quality: 4, RulesVersion: ReviewScheduleRulesVersion, ExpectedDueAt: dueAt})
			if err != nil || !reflect.DeepEqual(stored, retry) {
				t.Fatalf("item removal broke exact retry: stored=%#v retry=%#v error=%v", stored, retry, err)
			}
		}
	})
}

func TestReviewScheduleReceiptSurvivesPostgresStoreRestart(t *testing.T) {
	databaseURL := os.Getenv("TEST_DATABASE_URL")
	if databaseURL == "" {
		t.Skip("set TEST_DATABASE_URL for PostgreSQL restart coverage")
	}
	parsed, err := url.Parse(databaseURL)
	if err != nil || (parsed.Scheme != "postgres" && parsed.Scheme != "postgresql") || parsed.Path != "/loccao_system_test" {
		t.Fatal("dedicated loccao_system_test database required")
	}
	first, err := New(databaseURL)
	if err != nil {
		t.Fatal(err)
	}
	u := reviewScheduleFixture(t, first, "review-restart-"+newID()+"@example.test", "restart-item")
	want, err := first.ScheduleReview(context.Background(), u.ID, "restart-item", ReviewScheduleRequest{RequestID: "restart-request", Quality: 4, RulesVersion: ReviewScheduleRulesVersion, ExpectedDueAt: reviewScheduleDueAt(t, first, u.ID, "restart-item")})
	if err != nil {
		first.Close()
		t.Fatal(err)
	}
	first.Close()
	second, err := New(databaseURL)
	if err != nil {
		t.Fatal(err)
	}
	defer func() {
		_, _ = second.db.ExecContext(context.Background(), `DELETE FROM users WHERE id=$1`, u.ID)
		second.Close()
	}()
	got, err := second.ReviewScheduleReceipt(context.Background(), u.ID, "restart-request")
	if err != nil || !reflect.DeepEqual(want, got) {
		second.Close()
		t.Fatalf("receipt did not survive restart: want=%#v got=%#v err=%v", want, got, err)
	}
}
