package learning

import (
	"fmt"
	"reflect"
	"testing"
)

func TestWordGraphCatalogMatchesExploration(t *testing.T) {
	nodes, labels, edges := map[string]bool{}, map[string]bool{}, map[string]bool{}
	for _, node := range wordGraphCatalog.Nodes {
		if node.ID == "" || node.Label == "" || nodes[node.ID] || labels[node.Label] {
			t.Fatal("invalid graph node", node)
		}
		nodes[node.ID], labels[node.Label] = true, true
	}
	if len(nodes) != 9 || len(wordGraphCatalog.Edges) != 9 {
		t.Fatal("travel graph lost content")
	}
	for _, edge := range wordGraphCatalog.Edges {
		if edges[edge.ID] || !nodes[edge.From] || !nodes[edge.To] || edge.From == edge.To || edge.Question == "" || edge.Feedback == "" || edge.Label == "" {
			t.Fatal("invalid edge", edge.ID)
		}
		edges[edge.ID] = true
		item, ok := WordGraphItemByID(edge.ID)
		if !ok {
			t.Fatal("missing question")
		}
		options := map[string]bool{}
		for _, option := range item.Options {
			if options[option] || !labels[option] {
				t.Fatal("invalid option", edge.ID, option)
			}
			options[option] = true
		}
		if len(options) != 4 || !options[item.CorrectAnswer] {
			t.Fatal("edge target must be offered exactly once", edge.ID)
		}
		positions := map[int]bool{}
		for n := 0; n < 32; n++ {
			seed := fmt.Sprint(n)
			shuffled := ShuffledWordGraphOptions(item, seed)
			if !reflect.DeepEqual(shuffled, ShuffledWordGraphOptions(item, seed)) {
				t.Fatal("unstable shuffle")
			}
			for i, option := range shuffled {
				if option == item.CorrectAnswer {
					positions[i] = true
				}
			}
		}
		if len(positions) < 2 {
			t.Fatal("correct position is fixed", edge.ID)
		}
		item.Options[0] = "mutated"
		again, _ := WordGraphItemByID(edge.ID)
		if again.Options[0] == "mutated" {
			t.Fatal("catalog aliased")
		}
	}
}

func TestWordGraphQuestionSelection(t *testing.T) {
	var seen []string
	for n := 0; n < 9; n++ {
		item, err := PickWordGraph("A2", "travel-network", "seed", seen)
		if err != nil {
			t.Fatal(err)
		}
		again, _ := PickWordGraph("A2", "travel-network", "seed", seen)
		if !reflect.DeepEqual(item, again) {
			t.Fatal("seed changed question")
		}
		for _, id := range seen {
			if item.ID == id {
				t.Fatal("repeated before exhaustion")
			}
		}
		seen = append(seen, item.ID)
	}
	if _, err := PickWordGraph("A2", "travel-network", "seed", seen); err != nil {
		t.Fatal("exhausted bank cannot replay")
	}
	for _, pair := range [][2]string{{"A1", "travel-network"}, {"C2", "travel-network"}, {"A2", "cefr-core"}, {"A2", "unknown"}} {
		if _, err := PickWordGraph(pair[0], pair[1], "seed", nil); err == nil {
			t.Fatal("unsupported pair", pair)
		}
	}
}
