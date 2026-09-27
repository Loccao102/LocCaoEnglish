package learning

import "testing"

func TestGrammarCatalogCoversAllCEFRLevels(t *testing.T) {
	for _, level := range []string{"A1", "A2", "B1", "B2", "C1", "C2"} {
		item, err := PickGrammar(level, "cefr-core", "seed", nil)
		if err != nil {
			t.Fatalf("%s: %v", level, err)
		}
		if item.CEFRLevel != level {
			t.Fatalf("expected %s item, got %s", level, item.CEFRLevel)
		}
		options := ShuffledGrammarOptions(item, "attempt")
		found := 0
		for _, option := range options {
			if option == item.CorrectAnswer {
				found++
			}
		}
		if found != 1 {
			t.Fatalf("%s should expose correct answer exactly once, got %d", item.ID, found)
		}
	}
}

func TestGrammarCampaignPackKeepsFirstScenario(t *testing.T) {
	item, err := PickGrammar("B2", "work-requirements", "seed", nil)
	if err != nil {
		t.Fatal(err)
	}
	if item.ID != "work-requirements-clarification" {
		t.Fatalf("expected campaign's first scenario, got %s", item.ID)
	}
}
