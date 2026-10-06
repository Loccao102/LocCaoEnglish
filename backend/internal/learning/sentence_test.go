package learning

import (
	"encoding/json"
	"fmt"
	"reflect"
	"strings"
	"testing"

	"github.com/Loccao102/LocCaoEnglish/backend/internal/model"
)

func TestSentenceCatalogAndSeededChunks(t *testing.T) {
	ids := map[string]bool{}
	for _, item := range sentenceCatalog.Items {
		if ids[item.ID] || item.ID == "" || item.Question == "" || item.Feedback == "" || len(item.Chunks) < 3 {
			t.Fatal("incomplete or duplicate item", item.ID)
		}
		ids[item.ID] = true
		for seed := 0; seed < 32; seed++ {
			chunks := ShuffledSentenceChunks(item, fmt.Sprint(seed))
			if !reflect.DeepEqual(chunks, ShuffledSentenceChunks(item, fmt.Sprint(seed))) {
				t.Fatal("unstable seed")
			}
			var answerIDs []string
			available := append([]model.SentenceChunk(nil), chunks...)
			for _, word := range item.Chunks {
				for i, c := range available {
					if c.Text == word {
						answerIDs = append(answerIDs, c.ID)
						available = append(available[:i], available[i+1:]...)
						break
					}
				}
			}
			raw, _ := json.Marshal(answerIDs)
			text, err := ResolveSentenceAnswer(chunks, string(raw))
			if err != nil || text != strings.Join(item.Chunks, " ") {
				t.Fatal("unsolvable", item.ID, err)
			}
			var shown []string
			for _, c := range chunks {
				shown = append(shown, c.Text)
			}
			if strings.EqualFold(strings.Join(shown, " "), text) {
				t.Fatal("already solved", item.ID)
			}
		}
	}
	for _, pair := range [][2]string{{"cefr-core", "A1"}, {"cefr-core", "A2"}, {"cefr-core", "B1"}, {"cefr-core", "B2"}, {"cefr-core", "C1"}, {"cefr-core", "C2"}, {"conversation-plans", "A2"}, {"work-standup", "B1"}, {"work-deadline", "B2"}} {
		var seen []string
		for n := 0; n < 3; n++ {
			item, err := PickSentence(pair[1], pair[0], "seed", seen)
			if err != nil {
				t.Fatal(err)
			}
			for _, id := range seen {
				if id == item.ID {
					t.Fatal("early repeat", pair)
				}
			}
			seen = append(seen, item.ID)
		}
		if _, err := PickSentence(pair[1], pair[0], "seed", seen); err != nil {
			t.Fatal("exhausted bank must remain playable", err)
		}
	}
	if _, err := PickSentence("C2", "work-standup", "seed", nil); err == nil {
		t.Fatal("unsupported pair accepted")
	}
}

func TestSentenceAnswerPermutation(t *testing.T) {
	chunks := []model.SentenceChunk{{ID: "one", Text: "a"}, {ID: "two", Text: "ball"}, {ID: "three", Text: "and"}, {ID: "four", Text: "a"}, {ID: "five", Text: "bed"}}
	for _, answer := range []string{`["one","two","three","four","five"]`, `["four","two","three","one","five"]`} {
		text, err := ResolveSentenceAnswer(chunks, answer)
		if err != nil || text != "a ball and a bed" {
			t.Fatal("equal words should be interchangeable", text, err)
		}
	}
	for _, answer := range []string{`null`, `[]`, `"a ball and a bed"`, `["one","two"]`, `["one","two","three","one","five"]`, `["one","two","three","four","fake"]`, `[1,2,3,4,5]`} {
		if _, err := ResolveSentenceAnswer(chunks, answer); err == nil {
			t.Fatal("invalid answer accepted", answer)
		}
	}
}
