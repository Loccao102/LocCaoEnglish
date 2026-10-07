package learning

import (
	"fmt"
	"reflect"
	"strings"
	"testing"
)

func TestReadingCatalogEvidenceAndSelection(t *testing.T) {
	ids, passages := map[string]bool{}, map[string]bool{}
	counts := map[string]int{}
	for _, item := range readingCatalog.Items {
		if item.ID == "" || ids[item.ID] || item.Title == "" || item.Question == "" || item.Feedback == "" || item.Kind == "" || item.Pack != "cefr-core" {
			t.Fatal("incomplete or duplicate reading item", item.ID)
		}
		if passages[item.Passage] || item.Evidence == "" || !strings.Contains(item.Passage, item.Evidence) || item.Evidence2 != "" && !strings.Contains(item.Passage, item.Evidence2) {
			t.Fatal("evidence must quote this distinct passage", item.ID)
		}
		ids[item.ID], passages[item.Passage] = true, true
		counts[item.CEFRLevel]++
		options := map[string]bool{}
		for _, option := range item.Options {
			if option == "" || options[option] {
				t.Fatal("empty/duplicate option", item.ID)
			}
			options[option] = true
		}
		if len(options) != 4 || !options[item.CorrectAnswer] {
			t.Fatal("answer not offered exactly once", item.ID)
		}
		positions := map[int]bool{}
		for n := 0; n < 32; n++ {
			seed := fmt.Sprint(n)
			shuffled := ShuffledReadingOptions(item, seed)
			if !reflect.DeepEqual(shuffled, ShuffledReadingOptions(item, seed)) {
				t.Fatal("unstable options")
			}
			for i, option := range shuffled {
				if option == item.CorrectAnswer {
					positions[i] = true
				}
			}
		}
		if len(positions) < 2 {
			t.Fatal("fixed answer position", item.ID)
		}
		copied, _ := ReadingItemByID(item.ID)
		copied.Options[0] = "changed"
		again, _ := ReadingItemByID(item.ID)
		if again.Options[0] == "changed" {
			t.Fatal("catalog slice alias")
		}
	}
	if !reflect.DeepEqual(counts, map[string]int{"A2": 3, "B1": 3, "B2": 3}) {
		t.Fatal("unsupported or insufficient levels", counts)
	}
	for _, level := range []string{"A2", "B1", "B2"} {
		var seen []string
		for n := 0; n < 3; n++ {
			item, err := PickReading(level, "cefr-core", "seed", seen)
			if err != nil {
				t.Fatal(err)
			}
			same, _ := PickReading(level, "cefr-core", "seed", seen)
			if !reflect.DeepEqual(item, same) {
				t.Fatal("unstable item")
			}
			for _, id := range seen {
				if item.ID == id {
					t.Fatal("repeated before exhaustion")
				}
			}
			seen = append(seen, item.ID)
		}
		if _, err := PickReading(level, "cefr-core", "seed", seen); err != nil {
			t.Fatal("cannot replay", err)
		}
	}
	for _, pair := range [][2]string{{"A1", "cefr-core"}, {"C1", "cefr-core"}, {"C2", "cefr-core"}, {"B1", "travel-airport"}} {
		if _, err := PickReading(pair[0], pair[1], "seed", nil); err == nil {
			t.Fatal("unsupported pair", pair)
		}
	}
}
