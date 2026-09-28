package learning

import "testing"

func TestCollocationCatalogCoversCoreCEFRLevels(t *testing.T) {
	for _, level := range []string{"A1", "A2", "B1", "B2", "C1", "C2"} {
		item, err := PickCollocation(level, "cefr-core", "seed", nil)
		if err != nil {
			t.Fatalf("%s: %v", level, err)
		}
		if item.CEFRLevel != level {
			t.Fatalf("expected %s item, got %s", level, item.CEFRLevel)
		}
		found := 0
		for _, option := range ShuffledCollocationOptions(item, "attempt") {
			if option == item.CorrectAnswer {
				found++
			}
		}
		if found != 1 {
			t.Fatalf("%s should expose correct answer exactly once, got %d", item.ID, found)
		}
	}
}

func TestCollocationCampaignPackSelectsExpectedScenario(t *testing.T) {
	item, err := PickCollocation("B1", "work-standup", "seed", nil)
	if err != nil {
		t.Fatal(err)
	}
	if item.ID != "standup-fix-bug" && item.ID != "standup-run-tests" {
		t.Fatalf("unexpected standup scenario: %s", item.ID)
	}
}
