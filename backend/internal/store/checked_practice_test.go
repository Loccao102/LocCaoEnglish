package store

import (
	"context"
	"fmt"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/model"
	"os"
	"reflect"
	"strings"
	"sync"
	"testing"
	"time"
)

func TestCheckedPracticeRankingMemoryAndPostgres(t *testing.T) {
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
			s, e := New(url)
			if e != nil {
				t.Fatal(e)
			}
			defer s.Close()
			u, e := s.CreateUser(ctx, fmt.Sprintf("checked-%d@example.test", time.Now().UnixNano()), "hash", "Checked practice")
			if e != nil {
				t.Fatal(e)
			}
			old, e := s.CreateUser(ctx, fmt.Sprintf("legacy-%d@example.test", time.Now().UnixNano()), "hash", "Legacy XP")
			if e != nil {
				t.Fatal(e)
			}
			if s.db != nil {
				defer s.db.ExecContext(ctx, "DELETE FROM users WHERE id IN($1,$2)", u.ID, old.ID)
			}
			// Simulate existing client-graded history without reopening its public route.
			for i := 0; i < 3; i++ {
				if _, e = s.recordLegacyFixture(ctx, old.ID, model.AttemptInput{Skill: "Vocabulary", Activity: "old-client", ItemKey: fmt.Sprint(i), Accuracy: 1}); e != nil {
					t.Fatal(e)
				}
			}
			legacy, _ := s.GetUser(ctx, old.ID)
			if legacy.XP != 90 {
				t.Fatal("legacy fixture")
			}
			own := func() []model.LeaderboardEntry {
				all, e := s.TopUsers(ctx, 100)
				if e != nil {
					t.Fatal(e)
				}
				out := []model.LeaderboardEntry{}
				for _, entry := range all {
					if entry.UserID == u.ID || entry.UserID == old.ID {
						out = append(out, entry)
					}
				}
				return out
			}
			if len(own()) != 0 {
				t.Fatal("legacy XP promoted into checked rank")
			}
			start := func(request, item, rules string) LearningAttemptRecord {
				snap := LearningSnapshot{Input: model.LearningAttemptStartInput{Activity: "word-link", CEFRLevel: "A1", Pack: "cefr-core"}, Prompt: model.LearningAttemptPrompt{Word: "happy", Relation: "synonym", Options: []string{"glad", "sad"}}}
				a, _, e := s.StartLearningAttempt(ctx, u.ID, request, "word-link", "Vocabulary", item, "A1", "checked-content.v1", rules, "Happy synonym", "glad", "Happy and glad are synonyms.", snap)
				if e != nil {
					t.Fatal(e)
				}
				return a
			}
			a := start("checked-first", "checked-item", "word-link.v1")
			versions := model.LearningAttemptSubmitInput{ContentVersion: a.ContentVersion, RulesVersion: a.RulesVersion}
			second := s
			if url != "" {
				second, e = New(url)
				if e != nil {
					t.Fatal(e)
				}
				defer second.Close()
			}
			var wg sync.WaitGroup
			for i := 0; i < 10; i++ {
				wg.Add(1)
				go func(i int) {
					defer wg.Done()
					st := s
					if i%2 == 0 {
						st = second
					}
					r, e := st.SubmitLearningAttempt(ctx, u.ID, a.ID, "glad", versions)
					if e != nil || r.XPDelta != 20 {
						t.Error("concurrent receipt", r, e)
					}
				}(i)
			}
			wg.Wait()
			rows := own()
			if len(rows) != 1 || rows[0].UserID != u.ID || rows[0].XP != 20 {
				t.Fatal("checked total", rows)
			}
			replay := start("checked-replay", "checked-item", "word-link.v1")
			r, e := s.SubmitLearningAttempt(ctx, u.ID, replay.ID, "glad", versions)
			if e != nil || r.XPDelta != 0 {
				t.Fatal("daily claim repeated", e)
			}
			wrong := start("checked-wrong", "checked-wrong", "word-link.v1")
			if _, e = s.SubmitLearningAttempt(ctx, u.ID, wrong.ID, "sad", versions); e != nil {
				t.Fatal(e)
			}
			future := start("checked-future", "checked-future", "future.v99")
			badVersions := versions
			badVersions.RulesVersion = "future.v99"
			if _, e = s.SubmitLearningAttempt(ctx, u.ID, future.ID, "glad", badVersions); e != nil {
				t.Fatal(e)
			}
			if rows = own(); len(rows) != 1 || rows[0].XP != 20 {
				t.Fatal("replay/wrong/unsupported rules entered rank", rows)
			}
			after, _ := s.GetUser(ctx, old.ID)
			if !reflect.DeepEqual(legacy, after) {
				t.Fatal("legacy progress reset")
			}
			saved, _ := s.GetUser(ctx, u.ID)
			if saved.XP != 40 {
				t.Fatal("personal XP unexpectedly rewritten", saved.XP)
			}
			if url != "" {
				reopened, e := New(url)
				if e != nil {
					t.Fatal(e)
				}
				defer reopened.Close()
				all, e := reopened.TopUsers(ctx, 100)
				if e != nil {
					t.Fatal(e)
				}
				found := false
				for _, entry := range all {
					if entry.UserID == u.ID {
						found = true
						if entry.XP != 20 {
							t.Fatal("restart total", entry)
						}
					}
					if entry.UserID == old.ID {
						t.Fatal("legacy after restart")
					}
				}
				if !found {
					t.Fatal("receipt lost after restart")
				}
			}
		})
	}
}
