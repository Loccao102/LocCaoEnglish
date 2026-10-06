package learning

import (
	"fmt"
	"reflect"
	"strings"
	"testing"
)

func TestCollocationPlayableSetsDoNotRepeat(t *testing.T) {
	packs := map[string][]string{
		"cefr-core":      {"A1", "A2", "B1", "B2", "C1", "C2"},
		"travel-transit": {"A2"}, "conversation-cafe": {"A2"},
		"conversation-clarity": {"B1"}, "work-standup": {"B1"}, "work-deadline": {"B2"},
	}
	for pack, levels := range packs {
		for _, level := range levels {
			t.Run(pack+"/"+level, func(t *testing.T) {
				seen := []string{}
				for round := 0; round < 3; round++ {
					item, err := PickCollocation(level, pack, fmt.Sprint(round), seen)
					if err != nil {
						t.Fatal(err)
					}
					for _, previous := range seen {
						if previous == item.ID {
							t.Fatalf("round %d repeated %s", round+1, item.ID)
						}
					}
					seen = append(seen, item.ID)
				}
				// Exhaustion still permits practice instead of trapping the player.
				if _, err := PickCollocation(level, pack, "replay", seen); err != nil {
					t.Fatal(err)
				}
			})
		}
	}
}

func TestCollocationCatalogAndShuffling(t *testing.T) {
	ids := map[string]bool{}
	for _, item := range collocationCatalog.Items {
		if ids[item.ID] {
			t.Fatalf("duplicate item %s", item.ID)
		}
		ids[item.ID] = true
		if item.Question == "" || item.Feedback == "" || item.Core == "" || len(item.Options) != 4 {
			t.Fatalf("incomplete scenario %s", item.ID)
		}
		options := map[string]bool{}
		for _, option := range item.Options {
			key := strings.ToLower(strings.TrimSpace(option))
			if key == "" || options[key] {
				t.Fatalf("invalid choice in %s", item.ID)
			}
			options[key] = true
		}
		if !options[strings.ToLower(item.CorrectAnswer)] {
			t.Fatalf("missing answer in %s", item.ID)
		}
		original := append([]string(nil), item.Options...)
		positions := map[int]bool{}
		for seed := 0; seed < 32; seed++ {
			shuffled := ShuffledCollocationOptions(item, fmt.Sprint(seed))
			if !reflect.DeepEqual(shuffled, ShuffledCollocationOptions(item, fmt.Sprint(seed))) {
				t.Fatal("same seed changed options")
			}
			for position, choice := range shuffled {
				if choice == item.CorrectAnswer {
					positions[position] = true
				}
			}
		}
		if len(positions) < 2 {
			t.Fatalf("answer position never varies for %s", item.ID)
		}
		if !reflect.DeepEqual(item.Options, original) {
			t.Fatal("shuffle mutated catalog")
		}
	}
	if _, err := PickCollocation("A1", "work-deadline", "seed", nil); err == nil {
		t.Fatal("unsupported level unexpectedly accepted")
	}
}

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
