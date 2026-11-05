package store

import (
	"context"
	"errors"
	"fmt"
	"net/url"
	"os"
	"reflect"
	"testing"
	"time"

	"github.com/Loccao102/LocCaoEnglish/backend/internal/fair"
)

func TestFairCompletionReceiptIsOwnerScopedAndImmutable(t *testing.T) {
	urls := map[string]string{"memory": ""}
	if value := os.Getenv("TEST_DATABASE_URL"); value != "" {
		parsed, err := url.Parse(value)
		if err != nil || parsed.Path != "/loccao_system_test" || (parsed.Scheme != "postgres" && parsed.Scheme != "postgresql") {
			t.Fatal("TEST_DATABASE_URL must target the dedicated loccao_system_test PostgreSQL database")
		}
		urls["postgres"] = value
	}

	for mode, databaseURL := range urls {
		t.Run(mode, func(t *testing.T) {
			ctx := context.Background()
			st, err := New(databaseURL)
			if err != nil {
				t.Fatal(err)
			}
			t.Cleanup(st.Close)
			if err := st.EnsureFair(ctx); err != nil {
				t.Fatal(err)
			}

			owner, err := st.CreateUser(ctx, fmt.Sprintf("fair-receipt-owner-%d@example.test", time.Now().UnixNano()), "hash", "Receipt owner")
			if err != nil {
				t.Fatal(err)
			}
			other, err := st.CreateUser(ctx, fmt.Sprintf("fair-receipt-other-%d@example.test", time.Now().UnixNano()), "hash", "Receipt other")
			if err != nil {
				t.Fatal(err)
			}
			if st.db != nil {
				t.Cleanup(func() {
					_, _ = st.db.ExecContext(context.Background(), `DELETE FROM users WHERE id IN ($1,$2)`, owner.ID, other.ID)
				})
			}

			first := fair.Completion{RunID: "12345678-1234-4123-8123-123456789012", GameID: "tea-time", Stars: 2}
			if _, err := st.CompleteFair(ctx, owner.ID, first); err != nil {
				t.Fatal(err)
			}
			before, err := st.GetFair(ctx, owner.ID)
			if err != nil {
				t.Fatal(err)
			}

			changed := first
			changed.Stars = 3
			if _, err := st.CompleteFair(ctx, owner.ID, changed); !errors.Is(err, fair.ErrConflict) {
				t.Fatalf("changed duplicate should conflict: %v", err)
			}
			afterConflict, err := st.GetFair(ctx, owner.ID)
			if err != nil || !reflect.DeepEqual(before, afterConflict) {
				t.Fatalf("conflict changed aggregate save: before=%+v after=%+v err=%v", before, afterConflict, err)
			}

			second := fair.Completion{RunID: "22345678-1234-4123-8123-123456789012", GameID: "tea-time", Stars: 3, Difficulty: "expert"}
			if _, err := st.CompleteFair(ctx, owner.ID, second); err != nil {
				t.Fatal(err)
			}
			receipt, err := st.GetFairCompletion(ctx, owner.ID, first.RunID)
			if err != nil || !reflect.DeepEqual(receipt, first) {
				t.Fatalf("immutable receipt = %+v, want %+v (err=%v)", receipt, first, err)
			}
			if _, err := st.GetFairCompletion(ctx, other.ID, first.RunID); !errors.Is(err, ErrNotFound) {
				t.Fatalf("foreign receipt should be hidden: %v", err)
			}
			if _, err := st.GetFairCompletion(ctx, owner.ID, "not-a-uuid"); !errors.Is(err, ErrFairCompletionID) {
				t.Fatalf("invalid receipt ID error = %v", err)
			}
			user, err := st.GetUser(ctx, owner.ID)
			if err != nil || user.XP != 0 {
				t.Fatalf("fair receipt changed learning XP: user=%+v err=%v", user, err)
			}

			if st.db != nil {
				reopened, err := New(databaseURL)
				if err != nil {
					t.Fatal(err)
				}
				t.Cleanup(reopened.Close)
				if err := reopened.EnsureFair(ctx); err != nil {
					t.Fatal(err)
				}
				fresh, err := reopened.GetFairCompletion(ctx, owner.ID, first.RunID)
				if err != nil || !reflect.DeepEqual(fresh, first) {
					t.Fatalf("receipt after restart = %+v, want %+v (err=%v)", fresh, first, err)
				}
			}
		})
	}
}
