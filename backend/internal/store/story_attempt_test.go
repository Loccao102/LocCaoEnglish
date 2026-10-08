package store

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/learning"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/model"
	"os"
	"reflect"
	"strings"
	"sync"
	"testing"
	"time"
)

func TestStoryChainMemoryAndPostgres(t *testing.T) {
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
			u, err := s.CreateUser(ctx, fmt.Sprintf("story-%d@example.test", time.Now().UnixNano()), "hash", "Story reader")
			if err != nil {
				t.Fatal(err)
			}
			if s.db != nil {
				defer s.db.ExecContext(ctx, "DELETE FROM users WHERE id=$1", u.ID)
			}
			input := model.LearningAttemptStartInput{RequestID: "root", Activity: "story-choice", Pack: "hotel-check-in", CEFRLevel: "B1", ExcludeItemKeys: []string{}}
			root, _, err := s.StartStoryChoice(ctx, u.ID, input)
			if err != nil {
				t.Fatal(err)
			}
			if _, err = s.ContinueStoryChoice(ctx, u.ID, root.ID); !errors.Is(err, ErrAttemptConflict) {
				t.Fatal("skipped ungraded scene", err)
			}
			if _, err = s.ContinueStoryChoice(ctx, "", root.ID); !errors.Is(err, ErrNotFound) {
				t.Fatal("owner bypass", err)
			}
			node, _ := root.Snapshot.Story.Definition.Node("arrival")
			good := node.Choices[1].Label
			versions := model.LearningAttemptSubmitInput{ContentVersion: root.ContentVersion, RulesVersion: root.RulesVersion}
			verdict, err := s.SubmitLearningAttempt(ctx, u.ID, root.ID, good, versions)
			if err != nil || !verdict.Correct || verdict.XPDelta != 20 || verdict.Story == nil || !verdict.Story.CanContinue {
				t.Fatal("alternative valid decision rejected", verdict, err)
			}
			if _, err = s.SubmitLearningAttempt(ctx, u.ID, root.ID, node.Choices[0].Label, versions); !errors.Is(err, ErrAttemptConflict) {
				t.Fatal("changed committed choice", err)
			}
			ids := make(chan string, 8)
			var wg sync.WaitGroup
			for i := 0; i < 8; i++ {
				wg.Add(1)
				go func() {
					defer wg.Done()
					child, e := s.ContinueStoryChoice(ctx, u.ID, root.ID)
					if e != nil {
						t.Error(e)
						return
					}
					ids <- child.ID
				}()
			}
			wg.Wait()
			close(ids)
			childID := ""
			for id := range ids {
				if childID != "" && childID != id {
					t.Fatal("forked children")
				}
				childID = id
			}
			if childID == "" {
				t.Fatal("missing child")
			}
			child, err := s.GetLearningAttempt(ctx, u.ID, childID)
			if err != nil || child.Snapshot.Story.NodeID != "identity" || !child.ExpiresAt.Equal(root.ExpiresAt) || StoryRoundOf(child).Step != 2 || StoryRoundOf(child).RunID != root.ID {
				t.Fatal("wrong chain", child, err)
			}
			if child.Snapshot.Story.History[0].Answer != good {
				t.Fatal("lost actual decision")
			}
			child.Snapshot.Story.Definition.Nodes[0].Choices[0].Label = "mutated"
			child.Snapshot.Story.History[0].Answer = "mutated"
			restored, err := s.GetLearningAttempt(ctx, u.ID, childID)
			if err != nil || restored.Snapshot.Story.History[0].Answer != good || restored.Snapshot.Story.Definition.Nodes[0].Choices[0].Label == "mutated" {
				t.Fatal("snapshot aliased")
			}
			identity, _ := restored.Snapshot.Story.Definition.Node("identity")
			ending, err := s.SubmitLearningAttempt(ctx, u.ID, childID, identity.Choices[1].Label, versions)
			if err != nil || ending.Correct || ending.Story == nil || ending.Story.Ending != "unresolved" || ending.Story.CanContinue {
				t.Fatal("wrong terminal result", ending, err)
			}
			if _, err = s.ContinueStoryChoice(ctx, u.ID, childID); !errors.Is(err, ErrAttemptConflict) {
				t.Fatal("continued past ending", err)
			}
			completedChild, err := s.ContinueStoryChoice(ctx, u.ID, root.ID)
			if err != nil || completedChild.ID != childID || completedChild.Status != "completed" {
				t.Fatal("reopened parent forked its completed child", err)
			}
			input.RequestID = "replay"
			replay, _, err := s.StartStoryChoice(ctx, u.ID, input)
			if err != nil {
				t.Fatal(err)
			}
			v, err := s.SubmitLearningAttempt(ctx, u.ID, replay.ID, good, versions)
			if err != nil || v.XPDelta != 0 || v.ProgressionApplied {
				t.Fatal("replay farmed progress", v, err)
			}
			// Expired chains cannot open a fresh child, but existing children remain resumable.
			replay, err = s.GetLearningAttempt(ctx, u.ID, replay.ID)
			if err != nil {
				t.Fatal(err)
			}
			replay.Snapshot.Story.Deadline = time.Now().UTC().Add(-time.Hour)
			replay.ExpiresAt = replay.Snapshot.Story.Deadline
			if s.db != nil {
				raw, _ := json.Marshal(replay.Snapshot)
				_, err = s.db.ExecContext(ctx, "UPDATE learning_attempts SET snapshot=$2,expires_at=$3 WHERE id=$1", replay.ID, string(raw), replay.ExpiresAt)
			} else {
				s.mu.Lock()
				s.learningAttempts[replay.ID] = replay
				s.mu.Unlock()
			}
			if err != nil {
				t.Fatal(err)
			}
			if _, err = s.ContinueStoryChoice(ctx, u.ID, replay.ID); !errors.Is(err, ErrAttemptExpired) {
				t.Fatal("expired path extended", err)
			}
			// A saved graph, not today's catalog, controls the next scene after reconnect.
			old := learning.StoryCatalog()
			old.ContentVersion = "saved-version"
			for i := range old.Nodes {
				if old.Nodes[i].ID == "details" {
					old.Nodes[i].Text = "A preserved scene from the previous content version."
				}
			}
			input.RequestID = "old"
			saved, _, err := s.startStoryNode(ctx, u.ID, input, StorySnapshot{Definition: old, NodeID: old.Start, Deadline: time.Now().UTC().Add(time.Hour), History: []model.StoryDecision{}})
			if err != nil {
				t.Fatal(err)
			}
			oldRoot, _ := old.Node(old.Start)
			if _, err = s.SubmitLearningAttempt(ctx, u.ID, saved.ID, oldRoot.Choices[0].Label, model.LearningAttemptSubmitInput{ContentVersion: "saved-version", RulesVersion: learning.StoryRulesVersion}); err != nil {
				t.Fatal(err)
			}
			other := s
			if url != "" {
				other, err = New(url)
				if err != nil {
					t.Fatal(err)
				}
				defer other.Close()
			}
			continued, err := other.ContinueStoryChoice(ctx, u.ID, saved.ID)
			if err != nil || continued.ContentVersion != "saved-version" || continued.Snapshot.Prompt.Passage != "A preserved scene from the previous content version." {
				t.Fatal("catalog deployment changed scene", continued, err)
			}
			again, err := s.ContinueStoryChoice(ctx, u.ID, saved.ID)
			if err != nil || !reflect.DeepEqual(continued, again) {
				t.Fatal("continue retry changed snapshot", err)
			}
		})
	}
}
