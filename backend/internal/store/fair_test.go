package store

import (
	"context"
	"errors"
	"fmt"
	"os"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/Loccao102/LocCaoEnglish/backend/internal/fair"
)

func TestFairPersistenceAndIdempotency(t *testing.T) {
	urls := map[string]string{"memory": ""}
	if value := os.Getenv("TEST_DATABASE_URL"); value != "" {
		if !strings.Contains(value, "loccao_system_test") {
			t.Fatal("TEST_DATABASE_URL must target the dedicated loccao_system_test database")
		}
		urls["postgres"] = value
	}
	for mode, url := range urls {
		t.Run(mode, func(t *testing.T) {
			ctx := context.Background()
			st, err := New(url)
			if err != nil {
				t.Fatal(err)
			}
			defer st.Close()
			if err = st.EnsureFair(ctx); err != nil {
				t.Fatal(err)
			}
			player, err := st.CreateUser(ctx, fmt.Sprintf("fair-%d@example.test", time.Now().UnixNano()), "hash", "Fair Friend")
			if err != nil {
				t.Fatal(err)
			}
			if st.db != nil {
				defer st.db.ExecContext(ctx, `DELETE FROM users WHERE id=$1`, player.ID)
			}
			c := fair.Completion{RunID: "12345678-1234-4123-8123-123456789012", GameID: "tea-time", Stars: 2}
			var wg sync.WaitGroup
			for i := 0; i < 16; i++ {
				wg.Add(1)
				go func() {
					defer wg.Done()
					if _, err := st.CompleteFair(ctx, player.ID, c); err != nil {
						t.Error(err)
					}
				}()
			}
			wg.Wait()
			save, err := st.GetFair(ctx, player.ID)
			if err != nil {
				t.Fatal(err)
			}
			if r := save.Games[c.GameID]; r.Visits != 1 || r.Stars != 2 || r.Best != 350 {
				t.Fatalf("duplicated or wrong result: %+v", r)
			}
			changed := c
			changed.Stars = 3
			if _, err = st.CompleteFair(ctx, player.ID, changed); !errors.Is(err, fair.ErrConflict) {
				t.Fatalf("changed retry accepted: %v", err)
			}
			changed.RunID = "22345678-1234-4123-8123-123456789012"
			if _, err = st.CompleteFair(ctx, player.ID, changed); err != nil {
				t.Fatal(err)
			}
			save, _ = st.GetFair(ctx, player.ID)
			if r := save.Games[c.GameID]; r.Visits != 2 || r.Best != 375 || r.Stars != 3 {
				t.Fatalf("best did not improve: %+v", r)
			}
			delete(save.Games, c.GameID)
			fresh, _ := st.GetFair(ctx, player.ID)
			if fresh.Games[c.GameID].Visits != 2 {
				t.Fatal("save leaked its mutable map")
			}
			demo, _ := st.GetFair(ctx, st.DemoID())
			if len(demo.Games) != 0 {
				t.Fatal("account data leaked to demo")
			}
			user, _ := st.GetUser(ctx, player.ID)
			if user.XP != 0 {
				t.Fatalf("fair keepsakes awarded learning XP: %d", user.XP)
			}
			invalid := c
			invalid.Stars = 99
			if _, err = st.CompleteFair(ctx, player.ID, invalid); !errors.Is(err, fair.ErrInvalid) {
				t.Fatal("invalid stars accepted")
			}
			invalid = c
			invalid.GameID = "unknown"
			if _, err = st.CompleteFair(ctx, player.ID, invalid); !errors.Is(err, fair.ErrInvalid) {
				t.Fatal("unknown game accepted")
			}
			invalid = c
			invalid.RunID = "not-a-uuid"
			if _, err = st.CompleteFair(ctx, player.ID, invalid); !errors.Is(err, fair.ErrInvalid) {
				t.Fatal("invalid run accepted")
			}
			course := fair.Completion{RunID: "32345678-1234-4123-8123-123456789012", GameID: "cloud-hop", CourseID: "cloud-02", Stars: 3, ElapsedMS: 42000, Feathers: 1}
			if _, err = st.CompleteFair(ctx, player.ID, course); !errors.Is(err, fair.ErrLocked) {
				t.Fatalf("locked course accepted: %v", err)
			}
			course.CourseID = "cloud-01"
			if _, err = st.CompleteFair(ctx, player.ID, course); err != nil {
				t.Fatal(err)
			}
			if _, err = st.CompleteFair(ctx, player.ID, course); err != nil {
				t.Fatal(err)
			}
			altered := course
			altered.Feathers = 3
			if _, err = st.CompleteFair(ctx, player.ID, altered); !errors.Is(err, fair.ErrConflict) {
				t.Fatalf("changed course retry accepted: %v", err)
			}
			altered.RunID = "42345678-1234-4123-8123-123456789012"
			altered.Stars = 1
			altered.ElapsedMS = 61000
			if _, err = st.CompleteFair(ctx, player.ID, altered); err != nil {
				t.Fatal(err)
			}
			course.RunID = "52345678-1234-4123-8123-123456789012"
			course.CourseID = "cloud-02"
			if _, err = st.CompleteFair(ctx, player.ID, course); err != nil {
				t.Fatal(err)
			}
			courseSave, _ := st.GetFair(ctx, player.ID)
			if r := courseSave.Courses["cloud-01"]; r.Visits != 2 || r.Medals != 3 || r.BestMS != 42000 {
				t.Fatalf("course save lost replay progress: %+v", r)
			}
			if st.db != nil {
				reopened, err := New(url)
				if err != nil {
					t.Fatal(err)
				}
				defer reopened.Close()
				durable, err := reopened.GetFair(ctx, player.ID)
				if err != nil || durable.Games[c.GameID].Visits != 2 {
					t.Fatalf("save did not survive a new store: %+v %v", durable, err)
				}
				if durable.Courses["cloud-01"].Medals != 3 || durable.Courses["cloud-02"].Visits != 1 {
					t.Fatal("course save did not survive reopening")
				}
			}
		})
	}
}
