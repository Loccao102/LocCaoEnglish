package learning

import "testing"

func TestWordLinkCatalogCoversAllCEFRLevels(t *testing.T) {
	for _, level := range []string{"A1", "A2", "B1", "B2", "C1", "C2"} {
		first, err := PickWordLink(level, "cefr-core", "seed-one", nil)
		if err != nil {
			t.Fatalf("%s: %v", level, err)
		}
		if first.CEFRLevel != level {
			t.Fatalf("expected %s item, got %s", level, first.CEFRLevel)
		}
		options := ShuffledOptions(first, "attempt-id")
		count := 0
		for _, option := range options {
			if option == first.CorrectAnswer {
				count++
			}
		}
		if count != 1 {
			t.Fatalf("%s %s should expose the correct option exactly once, got %d", level, first.ID, count)
		}
	}
}

func TestTravelAirportPackStartsWithBoardingPass(t *testing.T) {
	item, err := PickWordLink("B1", "travel-airport", "any-seed", nil)
	if err != nil {
		t.Fatal(err)
	}
	if item.Word != "boarding pass" {
		t.Fatalf("campaign compatibility should open with boarding pass, got %q", item.Word)
	}
}
