package learning

import (
	"fmt"
	"reflect"
	"testing"
)

func TestListeningCatalog(t *testing.T) {
	counts := map[string]int{}
	ids := map[string]bool{}
	for _, item := range listeningCatalog.Items {
		if ids[item.ID] || item.Transcript == "" || item.Question == "" || item.Feedback == "" || item.CEFRLevel != "B1" {
			t.Fatal("invalid listening item", item.ID)
		}
		ids[item.ID] = true
		counts[item.Pack]++
		options := map[string]bool{}
		correct := 0
		for _, option := range item.Options {
			if options[option] || option == "" {
				t.Fatal("duplicate/empty option")
			}
			options[option] = true
			if option == item.CorrectAnswer {
				correct++
			}
		}
		if len(options) != 4 || correct != 1 {
			t.Fatal("ambiguous key", item.ID)
		}
		positions := map[int]bool{}
		for i := 0; i < 30; i++ {
			seed := fmt.Sprint(i)
			shuffled := ShuffledListeningOptions(item, seed)
			if !reflect.DeepEqual(shuffled, ShuffledListeningOptions(item, seed)) {
				t.Fatal("unstable shuffle")
			}
			for j, option := range shuffled {
				if option == item.CorrectAnswer {
					positions[j] = true
				}
			}
		}
		if len(positions) < 3 {
			t.Fatal("predictable answer position")
		}
	}
	if len(counts) != 6 {
		t.Fatal("lost campaign")
	}
	for pack, count := range counts {
		if count != 3 {
			t.Fatal("pack must contain three distinct clips", pack)
		}
		var seen []string
		for i := 0; i < count; i++ {
			item, err := PickListening("B1", pack, "fixed", seen)
			if err != nil {
				t.Fatal(err)
			}
			for _, id := range seen {
				if id == item.ID {
					t.Fatal("repeated clip")
				}
			}
			seen = append(seen, item.ID)
		}
		if _, err := PickListening("B1", pack, "fixed", seen); err != nil {
			t.Fatal("cannot replay exhausted set")
		}
	}
	if _, err := PickListening("C2", "cefr-core", "x", nil); err == nil {
		t.Fatal("unsupported level accepted")
	}
	if _, err := PickListening("B1", "unknown", "x", nil); err == nil {
		t.Fatal("unknown pack silently replaced")
	}
	original, _ := ListeningItemByID(listeningCatalog.Items[0].ID)
	copy, _ := ListeningItemByID(original.ID)
	copy.Options[0] = "changed"
	saved, _ := ListeningItemByID(original.ID)
	if !reflect.DeepEqual(original, saved) {
		t.Fatal("catalog alias")
	}
}
