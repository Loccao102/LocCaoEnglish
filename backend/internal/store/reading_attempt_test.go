package store

import (
	"context"
	"fmt"
	"os"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/Loccao102/LocCaoEnglish/backend/internal/model"
)

func TestReadingSnapshotMemoryAndPostgres(t *testing.T) {
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
			user, err := s.CreateUser(ctx, fmt.Sprintf("reading-%d@example.test", time.Now().UnixNano()), "hash", "Reader")
			if err != nil {
				t.Fatal(err)
			}
			if s.db != nil {
				defer s.db.ExecContext(ctx, "DELETE FROM users WHERE id=$1", user.ID)
			}
			prompt := model.LearningAttemptPrompt{Title: "A saved notice", Passage: "The meeting starts at nine, not ten.", Question: "When does it start?", Options: []string{"Nine", "Ten"}}
			snap := LearningSnapshot{Input: model.LearningAttemptStartInput{RequestID: "reading-snapshot", Activity: "reading-race", Pack: "cefr-core", CEFRLevel: "A2"}, Prompt: prompt}
			contextText := prompt.Title + "\n" + prompt.Passage + "\n" + prompt.Question
			feedback := "Evidence: The meeting starts at nine, not ten."
			a, _, err := s.StartLearningAttempt(ctx, user.ID, "reading-snapshot", "reading-race", "Reading", "reading-snapshot", "A2", "old-content", "reading-race.v1", contextText, "Nine", feedback, snap)
			if err != nil {
				t.Fatal(err)
			}
			// Caller edits and later catalog changes cannot replace the stored passage.
			a.Snapshot.Prompt.Passage = "Changed text"
			a.Snapshot.Prompt.Options[0] = "Changed answer"
			readStore := s
			if url != "" {
				readStore, err = New(url)
				if err != nil {
					t.Fatal(err)
				}
				defer readStore.Close()
			}
			saved, err := readStore.GetLearningAttempt(ctx, user.ID, a.ID)
			if err != nil || !reflect.DeepEqual(saved.Snapshot.Prompt, prompt) {
				t.Fatal("lost passage snapshot", saved, err)
			}
			versions := model.LearningAttemptSubmitInput{ContentVersion: "old-content", RulesVersion: "reading-race.v1"}
			result, err := readStore.SubmitLearningAttempt(ctx, user.ID, a.ID, "Ten", versions)
			if err != nil || result.Correct || result.ActualAnswer != "Ten" || result.Feedback != feedback || !result.ReviewAdded {
				t.Fatal("wrong snapshot verdict", result, err)
			}
			retry, err := s.SubmitLearningAttempt(ctx, user.ID, a.ID, "Ten", versions)
			if err != nil || !reflect.DeepEqual(result, retry) {
				t.Fatal("retry changed result", retry, err)
			}
			reviews, err := s.ReviewQueue(ctx, user.ID, 20)
			if err != nil || len(reviews) != 1 || reviews[0].Prompt != contextText || reviews[0].Answer != "Nine" {
				t.Fatal("review lost context", reviews, err)
			}
		})
	}
}
