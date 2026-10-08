package learning

import (
	"math"
	"reflect"
	"strings"
	"testing"
)

func TestDictationAlignment(t *testing.T) {
	for _, tc := range []struct {
		name, expected, actual          string
		match, missing, extra, replaced int
		accuracy                        float64
	}{
		{"missing middle", "we have a little cat", "we have little cat", 4, 1, 0, 0, .8},
		{"extra tail", "we have a cat", "we have a cat today", 4, 0, 1, 0, .75},
		{"extra middle", "we have a cat", "we have a little cat", 4, 0, 1, 0, .75},
		{"substitute", "we have a cat", "we have a dog", 3, 0, 0, 1, .75},
		{"repeated", "to go to school", "to go school", 3, 1, 0, 0, .75},
		{"format", "I've been here.", "I’VE  BEEN\nhere!", 3, 0, 0, 0, 1},
		{"negation", "we don't go", "we do go", 2, 0, 0, 1, 2.0 / 3},
		{"contraction", "I've been here", "I have been here", 2, 0, 1, 1, 1.0 / 3},
		{"hyphen boundary", "a well-known book", "a well known book", 4, 0, 0, 0, 1},
		{"empty", "we go", "...", 0, 2, 0, 0, 0},
		{"all extra", "go", "go go go go", 1, 0, 3, 0, 0},
	} {
		t.Run(tc.name, func(t *testing.T) {
			got := GradeDictation(tc.expected, tc.actual)
			if got.Matched != tc.match || got.Missing != tc.missing || got.Extra != tc.extra || got.Substituted != tc.replaced || math.Abs(got.Accuracy-tc.accuracy) > 1e-9 {
				t.Fatalf("%+v", got)
			}
			var expected, actual []string
			for _, w := range got.Words {
				if w.Expected != "" {
					expected = append(expected, w.Expected)
				}
				if w.Actual != "" {
					actual = append(actual, w.Actual)
				}
			}
			if strings.Join(expected, " ") != strings.Join(DictationTokens(tc.expected), " ") || strings.Join(actual, " ") != strings.Join(DictationTokens(tc.actual), " ") {
				t.Fatal("alignment lost or reordered tokens")
			}
			if !reflect.DeepEqual(got, GradeDictation(tc.expected, tc.actual)) {
				t.Fatal("unstable alignment")
			}
		})
	}
}
func TestDictationCatalog(t *testing.T) {
	seen := map[string]bool{}
	for _, level := range []string{"A2", "B1", "B2"} {
		var exclude []string
		for i := 0; i < 3; i++ {
			item, err := PickDictation(level, "cefr-core", "stable", exclude)
			if err != nil || item.CEFRLevel != level || seen[item.ID] || len(item.Transcript) > 2048 || GradeDictation(item.Transcript, item.Transcript).Accuracy != 1 || item.Feedback == "" {
				t.Fatal(item, err)
			}
			seen[item.ID] = true
			exclude = append(exclude, item.ID)
		}
		if _, err := PickDictation(level, "cefr-core", "stable", exclude); err != nil {
			t.Fatal("exhaustion should permit practice", err)
		}
	}
	if len(seen) != 9 {
		t.Fatal(seen)
	}
	for _, pair := range [][2]string{{"C2", "cefr-core"}, {"B1", "unknown"}} {
		if _, err := PickDictation(pair[0], pair[1], "x", nil); err == nil {
			t.Fatal("unsupported pack/level")
		}
	}
}
