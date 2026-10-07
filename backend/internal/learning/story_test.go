package learning

import (
	"fmt"
	"testing"
)

func TestStoryPathsAndChoices(t *testing.T) {
	s := StoryCatalog()
	seen := map[string]bool{}
	var walk func(string, map[string]bool) int
	walk = func(id string, path map[string]bool) int {
		n, ok := s.Node(id)
		if !ok || path[id] {
			t.Fatal("missing node or cycle", id)
		}
		seen[id] = true
		nextPath := map[string]bool{}
		for k, v := range path {
			nextPath[k] = v
		}
		nextPath[id] = true
		if n.Title == "" || n.Text == "" {
			t.Fatal("empty scene", id)
		}
		if n.Ending != "" {
			if len(n.Choices) != 0 || (n.Ending != "success" && n.Ending != "unresolved") {
				t.Fatal("invalid ending", id)
			}
			return 1
		}
		if n.Question == "" || len(n.Choices) < 2 || n.EffectiveAnswers() == "" {
			t.Fatal("incomplete decision", id)
		}
		labels := map[string]bool{}
		count := 0
		for _, c := range n.Choices {
			if labels[c.Label] || c.Label == "" || c.Feedback == "" {
				t.Fatal("invalid choice", id)
			}
			labels[c.Label] = true
			count += walk(c.Next, nextPath)
		}
		return count
	}
	if paths := walk(s.Start, map[string]bool{}); paths < 6 {
		t.Fatal("insufficient branching", paths)
	}
	if len(seen) != len(s.Nodes) {
		t.Fatal("unreachable content")
	}
	root, _ := s.Node(s.Start)
	good := 0
	for _, c := range root.Choices {
		if c.Good {
			good++
		}
	}
	if good < 2 {
		t.Fatal("opening should allow different effective approaches")
	}
	for _, n := range s.Nodes {
		if n.Ending != "" {
			continue
		}
		first := map[string]bool{}
		for i := 0; i < 32; i++ {
			first[n.Options(fmt.Sprint(i))[0]] = true
		}
		if len(first) < 2 {
			t.Fatal("fixed option order", n.ID)
		}
	}
}
