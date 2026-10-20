package store

import (
	"context"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/model"
	"testing"
)

func TestMemoryVerifiedAttemptCreatesAdaptiveReview(t *testing.T) {
	ctx := context.Background()
	st, err := New("")
	if err != nil {
		t.Fatal(err)
	}
	defer st.Close()
	id := st.DemoID()
	before, err := st.Dashboard(ctx, id)
	if err != nil {
		t.Fatal(err)
	}
	snapshot := LearningSnapshot{Input: model.LearningAttemptStartInput{Activity: "word-link", CEFRLevel: "B2", Pack: "cefr-core"}, Prompt: model.LearningAttemptPrompt{Word: "scarce", Relation: "antonym", Options: []string{"rare", "abundant"}}}
	a, _, err := st.StartLearningAttempt(ctx, id, "review-wrong", "word-link", "Vocabulary", "test:scarce", "B2", "test-content", "word-link.v1", "scarce — choose an antonym", "abundant", "Scarce and abundant are opposites.", snapshot)
	if err != nil {
		t.Fatal(err)
	}
	versions := model.LearningAttemptSubmitInput{ContentVersion: a.ContentVersion, RulesVersion: a.RulesVersion}
	result, err := st.SubmitLearningAttempt(ctx, id, a.ID, "rare", versions)
	if err != nil {
		t.Fatal(err)
	}
	if !result.ReviewAdded || result.Correct || result.XPDelta != 0 {
		t.Fatal("wrong verified answer should add review without XP", result)
	}
	correct, _, err := st.StartLearningAttempt(ctx, id, "review-correct", "word-link", "Vocabulary", "test:second-scarce", "B2", "test-content", "word-link.v1", "scarce — choose an antonym", "abundant", "Scarce and abundant are opposites.", snapshot)
	if err != nil {
		t.Fatal(err)
	}
	won, err := st.SubmitLearningAttempt(ctx, id, correct.ID, "abundant", versions)
	if err != nil || !won.Correct || won.XPDelta != 20 {
		t.Fatal("correct verified reward", won, err)
	}
	after, err := st.Dashboard(ctx, id)
	if err != nil {
		t.Fatal(err)
	}
	if after.User.XP-before.User.XP != 20 {
		t.Fatal("only the verified correct answer should award XP")
	}
	items, err := st.ReviewQueue(ctx, id, 10)
	if err != nil {
		t.Fatal(err)
	}
	if len(items) == 0 || items[0].ItemKey != "test:scarce" || items[0].Answer != "abundant" {
		t.Fatalf("expected server reference in review, got %#v", items)
	}
	if err := st.GradeReview(ctx, id, "test:scarce", 5); err != nil {
		t.Fatal(err)
	}
	items, _ = st.ReviewQueue(ctx, id, 10)
	if items[0].IntervalDays <= 1 {
		t.Fatal("easy recall should expand interval")
	}
}
