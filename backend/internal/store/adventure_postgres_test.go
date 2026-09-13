package store

import (
	"context"
	"fmt"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/Loccao102/LocCaoEnglish/backend/internal/adventure"
)

func TestAdventurePostgresWholeStory(t *testing.T) {
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("set TEST_DATABASE_URL for PostgreSQL integration")
	}
	if !strings.Contains(url, "loccao_system_test") {
		t.Fatal("use the dedicated loccao_system_test database")
	}
	ctx := context.Background()
	st, err := New(url)
	if err != nil {
		t.Fatal(err)
	}
	defer st.Close()
	if err = st.EnsureAdventure(ctx); err != nil {
		t.Fatal(err)
	}
	u, err := st.CreateUser(ctx, fmt.Sprintf("story-%d@example.test", time.Now().UnixNano()), "hash", "Story Tester")
	if err != nil {
		t.Fatal(err)
	}
	defer st.db.ExecContext(ctx, `DELETE FROM users WHERE id=$1`, u.ID)
	var result adventure.Result
	for _, quest := range adventure.Quests() {
		answers := []string{}
		for _, question := range quest.Questions {
			answers = append(answers, question.Answer)
		}
		partial := append([]string{}, answers...)
		partial[0] = "wrong answer"
		result, err = st.ApplyAdventure(ctx, u.ID, adventure.Action{Kind: "complete", QuestID: quest.ID, Answers: partial})
		if err != nil {
			t.Fatal(err)
		}
		if !result.Verdict.FirstClear || result.Verdict.Stars != 2 {
			t.Fatalf("first clear: %+v", result.Verdict)
		}
		result, err = st.ApplyAdventure(ctx, u.ID, adventure.Action{Kind: "complete", QuestID: quest.ID, Answers: answers})
		if err != nil {
			t.Fatal(err)
		}
		if result.Verdict.FirstClear || result.Verdict.XP != 0 || result.Verdict.Stars != 3 {
			t.Fatalf("replay: %+v", result.Verdict)
		}
	}
	if result.Save.XP != 1050 || result.Save.Coins != 280 || len(result.Save.Completed) != 14 {
		t.Fatalf("whole story: %+v", result.Save)
	}
	var attempts, reviews int
	if err = st.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM attempts WHERE user_id=$1`, u.ID).Scan(&attempts); err != nil {
		t.Fatal(err)
	}
	if err = st.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM review_items WHERE user_id=$1`, u.ID).Scan(&reviews); err != nil {
		t.Fatal(err)
	}
	if attempts != 42 || reviews != 14 {
		t.Fatalf("learning evidence attempts=%d reviews=%d", attempts, reviews)
	}
	for _, id := range []string{"nang", "may", "soi"} {
		result, err = st.ApplyAdventure(ctx, u.ID, adventure.Action{Kind: "equip", Character: id})
		if err != nil {
			t.Fatal(err)
		}
	}
	if result.Save.Coins != 30 || result.Save.Character != "soi" {
		t.Fatalf("companion purchases: %+v", result.Save)
	}
	u, err = st.GetUser(ctx, u.ID)
	if err != nil || u.XP != 1050 {
		t.Fatalf("account XP = %d, %v", u.XP, err)
	}
	reopened, err := New(url)
	if err != nil {
		t.Fatal(err)
	}
	defer reopened.Close()
	saved, err := reopened.GetAdventure(ctx, u.ID)
	if err != nil || saved.Character != "soi" || saved.Coins != 30 {
		t.Fatalf("durable story: %+v %v", saved, err)
	}
}
