package store

import (
	"context"
	"fmt"
	"net/url"
	"os"
	"strings"
	"sync"
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
		assertAdventureAnswers(t, st, u.ID, quest, partial)
		result, err = st.ApplyAdventure(ctx, u.ID, adventure.Action{Kind: "complete", QuestID: quest.ID, Answers: answers})
		if err != nil {
			t.Fatal(err)
		}
		if result.Verdict.FirstClear || result.Verdict.XP != 0 || result.Verdict.Stars != 3 {
			t.Fatalf("replay: %+v", result.Verdict)
		}
		// Improved replay stars must not replace first-clear answers or reward.
		assertAdventureAnswers(t, st, u.ID, quest, partial)
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

func assertAdventureAnswers(t *testing.T, st *Store, owner string, quest adventure.Quest, submitted []string) {
	t.Helper()
	for i, question := range quest.Questions {
		var actual, source, content, rules string
		var accuracy float64
		var count int
		key := quest.ID + ":" + question.Prompt
		if err := st.db.QueryRowContext(context.Background(), `SELECT COUNT(*) FROM attempts WHERE user_id=$1 AND activity='adventure' AND item_key=$2`, owner, key).Scan(&count); err != nil || count != 1 {
			t.Fatalf("first clear must keep exactly one question record: count=%d error=%v", count, err)
		}
		if err := st.db.QueryRowContext(context.Background(), `SELECT answer,accuracy,grading_source,content_version,rules_version FROM attempts WHERE user_id=$1 AND activity='adventure' AND item_key=$2`, owner, key).Scan(&actual, &accuracy, &source, &content, &rules); err != nil {
			t.Fatal(err)
		}
		expectedAccuracy := 0.0
		if adventure.Normalize(submitted[i]) == adventure.Normalize(question.Answer) {
			expectedAccuracy = 1
		}
		if actual != submitted[i] || accuracy != expectedAccuracy || source != adventure.EvidenceSource || content != adventure.ContentVersion() || rules != adventure.RulesVersion {
			t.Fatalf("answer/provenance mismatch for question %d: answer=%q accuracy=%v source=%s content=%s rules=%s", i, actual, accuracy, source, content, rules)
		}
	}
}

func TestAdventurePostgresConcurrentFirstClearKeepsActualAnswersAndLegacy(t *testing.T) {
	databaseURL := os.Getenv("TEST_DATABASE_URL")
	if databaseURL == "" {
		t.Skip("set TEST_DATABASE_URL for PostgreSQL integration")
	}
	parsed, err := url.Parse(databaseURL)
	if err != nil || (parsed.Scheme != "postgres" && parsed.Scheme != "postgresql") || parsed.Path != "/loccao_system_test" {
		t.Fatal("use the dedicated loccao_system_test database")
	}
	ctx := context.Background()
	st, err := New(databaseURL)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(st.Close)
	if err = st.EnsureAdventure(ctx); err != nil {
		t.Fatal(err)
	}
	other, err := New(databaseURL)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(other.Close)
	u, err := st.CreateUser(ctx, "adventure-proof-"+newID()+"@example.test", "hash", "Story evidence")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _, _ = st.db.ExecContext(ctx, `DELETE FROM users WHERE id=$1`, u.ID) })
	legacyID := newID()
	if _, err = st.db.ExecContext(ctx, `INSERT INTO attempts(id,user_id,skill,activity,item_key,prompt,answer,accuracy,duration_sec) VALUES($1,$2,'Vocabulary','adventure','legacy-story-question','Older story question','retained legacy value',0,0)`, legacyID, u.ID); err != nil {
		t.Fatal(err)
	}
	quest := adventure.Quests()[0]
	answers := make([]string, len(quest.Questions))
	for i, question := range quest.Questions {
		answers[i] = question.Answer
	}
	answers[0] = "My original incorrect reply!"
	action := adventure.Action{Kind: "complete", QuestID: quest.ID, Answers: answers}
	var wg sync.WaitGroup
	start := make(chan struct{})
	results := make(chan adventure.Result, 8)
	for i := 0; i < 8; i++ {
		writer := st
		if i%2 == 1 {
			writer = other
		}
		wg.Add(1)
		go func(writer *Store) {
			defer wg.Done()
			<-start
			result, applyErr := writer.ApplyAdventure(ctx, u.ID, action)
			if applyErr != nil {
				t.Error(applyErr)
				return
			}
			results <- result
		}(writer)
	}
	close(start)
	wg.Wait()
	close(results)
	firstClears, count := 0, 0
	for result := range results {
		count++
		if result.Verdict.FirstClear {
			firstClears++
		}
	}
	if firstClears != 1 || count != 8 {
		t.Fatalf("concurrent first clears=%d responses=%d", firstClears, count)
	}
	assertAdventureAnswers(t, st, u.ID, quest, answers)
	player, err := st.GetUser(ctx, u.ID)
	if err != nil || player.XP != quest.XP {
		t.Fatalf("duplicate story XP: %+v error=%v", player, err)
	}
	// Reopening the store reads the same first clear and cannot reward a retry.
	reopened, err := New(databaseURL)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(reopened.Close)
	saved, err := reopened.GetAdventure(ctx, u.ID)
	if err != nil || saved.Completed[quest.ID] != 2 || saved.XP != quest.XP {
		t.Fatalf("durable first clear: %+v error=%v", saved, err)
	}
	result, err := reopened.ApplyAdventure(ctx, u.ID, action)
	if err != nil || result.Verdict.FirstClear || result.Verdict.XP != 0 {
		t.Fatalf("reopened retry: %+v error=%v", result, err)
	}
	assertAdventureAnswers(t, reopened, u.ID, quest, answers)
	var actual, source, content, rules string
	if err = st.db.QueryRowContext(ctx, `SELECT answer,grading_source,content_version,rules_version FROM attempts WHERE id=$1 AND user_id=$2`, legacyID, u.ID).Scan(&actual, &source, &content, &rules); err != nil || actual != "retained legacy value" || source != "legacy-client" || content != "" || rules != "" {
		t.Fatalf("legacy evidence was reinterpreted: source=%s content=%s rules=%s error=%v", source, content, rules, err)
	}
}
