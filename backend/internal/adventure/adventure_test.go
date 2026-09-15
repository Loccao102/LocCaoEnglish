package adventure

import "testing"

func TestEntireStoryAndRepeatRewards(t *testing.T) {
	save := NewSave()
	pages := 0
	totalXP := 0
	for _, quest := range Quests() {
		answers := []string{}
		for _, q := range quest.Questions {
			answers = append(answers, q.Answer)
		}
		result, err := Apply(save, Action{Kind: "complete", QuestID: quest.ID, Answers: answers})
		if err != nil {
			t.Fatal(err)
		}
		if !result.Verdict.Passed || !result.Verdict.FirstClear {
			t.Fatal("expected first clear")
		}
		save = result.Save
		totalXP += quest.XP
		if quest.Page {
			pages++
		}
		again, err := Apply(save, Action{Kind: "complete", QuestID: quest.ID, Answers: answers})
		if err != nil || again.Verdict.XP != 0 || again.Verdict.Coins != 0 || again.Save.XP != save.XP {
			t.Fatal("replay awarded currency")
		}
	}
	if len(save.Completed) != 14 || pages != 7 || save.XP != totalXP {
		t.Fatal("story is incomplete")
	}
	for _, companion := range Content.Companions {
		result, err := Apply(save, Action{Kind: "equip", Character: companion.ID})
		if err != nil {
			t.Fatal(err)
		}
		save = result.Save
	}
	if len(save.Owned) != len(Content.Companions) || save.Coins < 0 {
		t.Fatal("invalid inventory")
	}
}
func TestLockedFailedMalformedAndPurchase(t *testing.T) {
	save := NewSave()
	quests := Quests()
	if _, err := Apply(save, Action{Kind: "complete", QuestID: quests[1].ID, Answers: []string{"x", "x", "x"}}); err == nil {
		t.Fatal("skipped prerequisite")
	}
	if _, err := Apply(save, Action{Kind: "complete", QuestID: quests[0].ID, Answers: []string{"x"}}); err == nil {
		t.Fatal("accepted missing answers")
	}
	result, err := Apply(save, Action{Kind: "complete", QuestID: quests[0].ID, Answers: []string{"x", "x", "x"}})
	if err != nil || result.Verdict.Passed || result.Save.XP != 0 || len(result.Save.Completed) != 0 {
		t.Fatal("failed run rewarded")
	}
	if _, err := Apply(save, Action{Kind: "equip", Character: "soi"}); err == nil {
		t.Fatal("negative balance allowed")
	}
	if Normalize("  HELLO,   friend! ") != "hello friend" {
		t.Fatal("normalization failed")
	}
}
