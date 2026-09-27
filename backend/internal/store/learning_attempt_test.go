package store

import (
	"context"
	"errors"
	"testing"
)

func TestLearningAttemptServerGradesAndIsIdempotent(t *testing.T) {
	ctx := context.Background()
	st, err := New("")
	if err != nil {
		t.Fatal(err)
	}
	defer st.Close()
	userID := st.DemoID()

	attempt, created, err := st.StartLearningAttempt(ctx, userID, "req-1", "word-link", "a1-happy-synonym", "A1", "test-content", "word-link.v1", "happy — Choose a synonym", "glad", "Happy and glad are synonyms.")
	if err != nil || !created {
		t.Fatalf("start attempt: created=%v err=%v", created, err)
	}
	before, _ := st.Dashboard(ctx, userID)
	result, err := st.SubmitLearningAttempt(ctx, userID, attempt.ID, "glad")
	if err != nil {
		t.Fatal(err)
	}
	if !result.Correct || result.XPDelta != 20 {
		t.Fatalf("server verdict should be correct with 20 XP, got %#v", result)
	}
	afterFirst, _ := st.Dashboard(ctx, userID)
	if afterFirst.User.XP-before.User.XP != 20 {
		t.Fatalf("expected exactly 20 XP, got %d", afterFirst.User.XP-before.User.XP)
	}

	replayed, err := st.SubmitLearningAttempt(ctx, userID, attempt.ID, " glad ")
	if err != nil || !replayed.Correct {
		t.Fatalf("same payload retry should return recorded result: %#v %v", replayed, err)
	}
	afterRetry, _ := st.Dashboard(ctx, userID)
	if afterRetry.User.XP != afterFirst.User.XP {
		t.Fatal("retry must not award XP twice")
	}
	if _, err = st.SubmitLearningAttempt(ctx, userID, attempt.ID, "late"); !errors.Is(err, ErrAttemptConflict) {
		t.Fatalf("changed payload must conflict, got %v", err)
	}
}

func TestLearningAttemptWrongAnswerAddsCorrectReview(t *testing.T) {
	ctx := context.Background()
	st, err := New("")
	if err != nil {
		t.Fatal(err)
	}
	defer st.Close()
	userID := st.DemoID()
	attempt, _, err := st.StartLearningAttempt(ctx, userID, "req-wrong", "word-link", "b2-scarce-antonym", "B2", "test-content", "word-link.v1", "scarce — Choose an antonym", "abundant", "Scarce and abundant are opposites.")
	if err != nil {
		t.Fatal(err)
	}
	result, err := st.SubmitLearningAttempt(ctx, userID, attempt.ID, "rare")
	if err != nil {
		t.Fatal(err)
	}
	if result.Correct || !result.ReviewAdded || result.XPDelta != 0 {
		t.Fatalf("wrong answer should be review evidence without XP, got %#v", result)
	}
	items, err := st.ReviewQueue(ctx, userID, 20)
	if err != nil {
		t.Fatal(err)
	}
	found := false
	for _, item := range items {
		if item.ItemKey == "b2-scarce-antonym" {
			found = true
			if item.Answer != "abundant" {
				t.Fatalf("review must store the authoritative answer, got %q", item.Answer)
			}
		}
	}
	if !found {
		t.Fatal("expected wrong item in review queue")
	}
}
