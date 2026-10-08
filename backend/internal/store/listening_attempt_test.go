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

func TestListeningSnapshotAndConcurrentEvidence(t *testing.T) {
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
			user, err := s.CreateUser(ctx, fmt.Sprintf("listen-%d@example.test", time.Now().UnixNano()), "hash", "Listener")
			if err != nil {
				t.Fatal(err)
			}
			if s.db != nil {
				defer s.db.ExecContext(ctx, "DELETE FROM users WHERE id=$1", user.ID)
			}
			snap := LearningSnapshot{Input: model.LearningAttemptStartInput{Activity: "listen-pick", Pack: "cefr-core", CEFRLevel: "B1"}, Prompt: model.LearningAttemptPrompt{Question: "Which gate?", Options: []string{"Twelve", "Eight"}}, Listening: &ListeningSnapshot{Transcript: "Use gate twelve, not eight.", Events: []model.ListeningPlayback{}}}
			open := func(key string) LearningAttemptRecord {
				snap.Input.RequestID = key
				a, _, err := s.StartLearningAttempt(ctx, user.ID, key, "listen-pick", "Listening", "old-listening-item", "B1", "saved-content", "listen-pick.v1", "Use gate twelve, not eight. Which gate?", "Twelve", "The departure gate changed.", snap)
				if err != nil {
					t.Fatal(err)
				}
				return a
			}
			a := open("first")
			a.Snapshot.Listening.Transcript = "corrupted"
			a.Snapshot.Listening.Events = append(a.Snapshot.Listening.Events, model.ListeningPlayback{Status: "completed"})
			second := s
			if url != "" {
				second, err = New(url)
				if err != nil {
					t.Fatal(err)
				}
				defer second.Close()
			}
			saved, err := second.GetLearningAttempt(ctx, user.ID, a.ID)
			if err != nil || saved.Snapshot.Listening.Transcript != snap.Listening.Transcript || len(saved.Snapshot.Listening.Events) != 0 {
				t.Fatal("snapshot alias/reconnect failure", err)
			}
			versions := model.LearningAttemptSubmitInput{ContentVersion: a.ContentVersion, RulesVersion: a.RulesVersion}
			record := func(st *Store, id string, event model.ListeningPlayback) (LearningAttemptRecord, error) {
				return st.RecordListeningPlayback(ctx, user.ID, id, a.ContentVersion, a.RulesVersion, event)
			}
			event := model.ListeningPlayback{RequestID: "same-play", Rate: .72, Status: "requested"}
			var wg sync.WaitGroup
			errs := make(chan error, 8)
			for i := 0; i < 8; i++ {
				wg.Add(1)
				go func() { defer wg.Done(); _, e := record(second, a.ID, event); errs <- e }()
			}
			wg.Wait()
			close(errs)
			for err := range errs {
				if err != nil {
					t.Fatal(err)
				}
			}
			saved, _ = s.GetLearningAttempt(ctx, user.ID, a.ID)
			if len(saved.Snapshot.Listening.Events) != 1 {
				t.Fatal("concurrent prepare duplicated event")
			}
			if _, err := s.SubmitLearningAttempt(ctx, user.ID, a.ID, "Twelve", versions); err != ErrAttemptConflict {
				t.Fatal("requested is not completed", err)
			}
			if _, err := s.RecordListeningPlayback(ctx, "other", a.ID, a.ContentVersion, a.RulesVersion, event); err != ErrAttemptOwner {
				t.Fatal("owner boundary", err)
			}
			event.Status, event.Provider = "completed", "browser-speech-synthesis"
			if _, err := record(second, a.ID, event); err != nil {
				t.Fatal(err)
			}
			result, err := second.SubmitLearningAttempt(ctx, user.ID, a.ID, "Twelve", versions)
			if err != nil || result.XPDelta != 20 || result.Listening.Transcript != snap.Listening.Transcript {
				t.Fatal("saved-content grade", result, err)
			}
			if _, err := record(s, a.ID, event); err != nil {
				t.Fatal("lost ack retry after grade", err)
			}
			event.Status = "failed"
			if _, err := record(s, a.ID, event); err != ErrAttemptConflict {
				t.Fatal("mutated completed evidence", err)
			}
			retry, err := s.SubmitLearningAttempt(ctx, user.ID, a.ID, "Twelve", versions)
			if err != nil || !reflect.DeepEqual(result, retry) {
				t.Fatal("immutable retry", err)
			}
			result.Listening.Events[0].Rate = 1
			saved, _ = s.GetLearningAttempt(ctx, user.ID, a.ID)
			if saved.Snapshot.Listening.Events[0].Rate != .72 {
				t.Fatal("result aliases evidence")
			}
			replay := open("replay")
			event = model.ListeningPlayback{RequestID: "replay", Rate: 1, Status: "requested"}
			record(s, replay.ID, event)
			event.Status, event.Provider = "completed", "azure-speech-neural-tts"
			record(s, replay.ID, event)
			repeated, err := s.SubmitLearningAttempt(ctx, user.ID, replay.ID, "Twelve", versions)
			if err != nil || repeated.XPDelta != 0 || repeated.ProgressionApplied {
				t.Fatal("daily replay awarded again", err)
			}
			expired := open("expired")
			if s.db != nil {
				_, err = s.db.ExecContext(ctx, "UPDATE learning_attempts SET expires_at=$2 WHERE id=$1", expired.ID, time.Now().Add(-time.Hour))
			} else {
				s.mu.Lock()
				expired.ExpiresAt = time.Now().Add(-time.Hour)
				s.learningAttempts[expired.ID] = expired
				s.mu.Unlock()
			}
			if err != nil {
				t.Fatal(err)
			}
			event = model.ListeningPlayback{RequestID: "expired-play", Rate: 1, Status: "requested"}
			if _, err := record(s, expired.ID, event); err != ErrAttemptExpired {
				t.Fatal("expired playback accepted", err)
			}
			if s.db != nil {
				var source string
				if err = s.db.QueryRowContext(ctx, "SELECT grading_source FROM attempts WHERE id=$1", a.ID).Scan(&source); err != nil || source != "server-objective-guided-listening" {
					t.Fatal("evidence provenance lost", source, err)
				}
			}
		})
	}
}
