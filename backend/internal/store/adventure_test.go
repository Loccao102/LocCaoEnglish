package store

import (
	"context"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/adventure"
	"sync"
	"testing"
)

func TestAdventureConcurrentRewardsAndIsolation(t *testing.T) {
	ctx := context.Background()
	st, err := New("")
	if err != nil {
		t.Fatal(err)
	}
	defer st.Close()
	u, err := st.CreateUser(ctx, "adventure@example.test", "hash", "Explorer")
	if err != nil {
		t.Fatal(err)
	}
	quest := adventure.Quests()[0]
	answers := []string{}
	for _, q := range quest.Questions {
		answers = append(answers, q.Answer)
	}
	var wg sync.WaitGroup
	for i := 0; i < 12; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			if _, err := st.ApplyAdventure(ctx, u.ID, adventure.Action{Kind: "complete", QuestID: quest.ID, Answers: answers}); err != nil {
				t.Error(err)
			}
		}()
	}
	wg.Wait()
	save, err := st.GetAdventure(ctx, u.ID)
	if err != nil {
		t.Fatal(err)
	}
	player, _ := st.GetUser(ctx, u.ID)
	if save.XP != 60 || save.Coins != 15 || player.XP != 60 {
		t.Fatalf("duplicate award: %+v userXP=%d", save, player.XP)
	}
	save.Completed["school-page"] = 3
	again, _ := st.GetAdventure(ctx, u.ID)
	if again.Completed["school-page"] != 0 {
		t.Fatal("save leaked mutable map")
	}
	demo, _ := st.GetAdventure(ctx, st.DemoID())
	if demo.XP != 0 {
		t.Fatal("players share saves")
	}
}
