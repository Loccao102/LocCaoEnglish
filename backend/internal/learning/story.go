package learning

import (
	"crypto/sha256"
	_ "embed"
	"encoding/json"
	"sort"
	"strings"
)

const StoryRulesVersion = "story-choice.v1"

//go:embed story_catalog.json
var storyJSON []byte

type StoryChoice struct {
	Label    string `json:"label"`
	Good     bool   `json:"good"`
	Next     string `json:"next"`
	Feedback string `json:"feedback"`
}
type StoryNode struct {
	ID       string        `json:"id"`
	Title    string        `json:"title"`
	Text     string        `json:"text"`
	Question string        `json:"question,omitempty"`
	Choices  []StoryChoice `json:"choices,omitempty"`
	Ending   string        `json:"ending,omitempty"`
}
type StoryDefinition struct {
	ContentVersion string      `json:"contentVersion"`
	Pack           string      `json:"pack"`
	CEFRLevel      string      `json:"cefrLevel"`
	Start          string      `json:"start"`
	Title          string      `json:"title"`
	Nodes          []StoryNode `json:"nodes"`
}

func StoryCatalog() StoryDefinition {
	var story StoryDefinition
	if err := json.Unmarshal(storyJSON, &story); err != nil {
		panic(err)
	}
	return story
}
func (s StoryDefinition) Node(id string) (StoryNode, bool) {
	for _, node := range s.Nodes {
		if node.ID == id {
			return node, true
		}
	}
	return StoryNode{}, false
}
func (n StoryNode) Choice(answer string) (StoryChoice, bool) {
	for _, choice := range n.Choices {
		if strings.EqualFold(choice.Label, strings.TrimSpace(answer)) {
			return choice, true
		}
	}
	return StoryChoice{}, false
}
func (n StoryNode) Options(seed string) []string {
	options := make([]string, 0, len(n.Choices))
	for _, c := range n.Choices {
		options = append(options, c.Label)
	}
	sort.SliceStable(options, func(i, j int) bool {
		left := sha256.Sum256([]byte(seed + "|story|" + options[i]))
		right := sha256.Sum256([]byte(seed + "|story|" + options[j]))
		return string(left[:]) < string(right[:])
	})
	return options
}
func (n StoryNode) EffectiveAnswers() string {
	var answers []string
	for _, c := range n.Choices {
		if c.Good {
			answers = append(answers, c.Label)
		}
	}
	return strings.Join(answers, " OR ")
}
