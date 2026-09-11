package store

import (
	"context"
	"testing"

	"github.com/Loccao102/LocCaoEnglish/backend/internal/model"
)

func TestMemoryAttemptCreatesAdaptiveReview(t *testing.T) {
	ctx := context.Background()
	st, err := New("")
	if err != nil { t.Fatal(err) }
	defer st.Close()
	id := st.DemoID()
	before, err := st.Dashboard(ctx, id)
	if err != nil { t.Fatal(err) }
	result, err := st.RecordAttempt(ctx, id, model.AttemptInput{Skill:"Vocabulary", Activity:"word-link", ItemKey:"test:scarce", Prompt:"scarce", Answer:"abundant", Accuracy:0})
	if err != nil { t.Fatal(err) }
	if !result.ReviewAdded { t.Fatal("wrong answer should enter review") }
	after, err := st.Dashboard(ctx, id)
	if err != nil { t.Fatal(err) }
	if after.User.XP <= before.User.XP { t.Fatal("attempt should award XP") }
	items, err := st.ReviewQueue(ctx, id, 10)
	if err != nil { t.Fatal(err) }
	if len(items) == 0 || items[0].ItemKey != "test:scarce" { t.Fatalf("expected review item, got %#v", items) }
	if err := st.GradeReview(ctx, id, "test:scarce", 5); err != nil { t.Fatal(err) }
	items, _ = st.ReviewQueue(ctx, id, 10)
	if items[0].IntervalDays <= 1 { t.Fatal("easy recall should expand interval") }
}
