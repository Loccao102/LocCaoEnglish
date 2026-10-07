package learning

import (
	"crypto/sha256"
	_ "embed"
	"encoding/binary"
	"encoding/json"
	"errors"
	"sort"
)

//go:embed word_graph_catalog.json
var wordGraphJSON []byte

type WordGraphNode struct {
	ID    string `json:"id"`
	Label string `json:"label"`
}

type WordGraphEdge struct {
	ID       string   `json:"id"`
	From     string   `json:"from"`
	To       string   `json:"to"`
	Label    string   `json:"label"`
	Question string   `json:"question"`
	Options  []string `json:"options"`
	Feedback string   `json:"feedback"`
}

type WordGraphItem struct {
	ID, Word, Relation, Question, CorrectAnswer, Feedback string
	Options                                               []string
}

var wordGraphCatalog struct {
	ContentVersion string          `json:"contentVersion"`
	Pack           string          `json:"pack"`
	CEFRLevel      string          `json:"cefrLevel"`
	Nodes          []WordGraphNode `json:"nodes"`
	Edges          []WordGraphEdge `json:"edges"`
}

func init() {
	if err := json.Unmarshal(wordGraphJSON, &wordGraphCatalog); err != nil {
		panic(err)
	}
}

func WordGraphContentVersion() string { return wordGraphCatalog.ContentVersion }

func WordGraphItemByID(id string) (WordGraphItem, bool) {
	for _, edge := range wordGraphCatalog.Edges {
		if edge.ID != id {
			continue
		}
		item := WordGraphItem{ID: edge.ID, Relation: edge.Label, Question: edge.Question, Options: append([]string(nil), edge.Options...), Feedback: edge.Feedback}
		for _, node := range wordGraphCatalog.Nodes {
			if node.ID == edge.From {
				item.Word = node.Label
			}
			if node.ID == edge.To {
				item.CorrectAnswer = node.Label
			}
		}
		return item, item.Word != "" && item.CorrectAnswer != ""
	}
	return WordGraphItem{}, false
}

func PickWordGraph(level, pack, seed string, excluded []string) (WordGraphItem, error) {
	if pack != wordGraphCatalog.Pack || level != wordGraphCatalog.CEFRLevel {
		return WordGraphItem{}, errors.New("word-graph supports travel-network at A2")
	}
	blocked := map[string]bool{}
	for _, id := range excluded {
		blocked[id] = true
	}
	var candidates []string
	for _, edge := range wordGraphCatalog.Edges {
		if !blocked[edge.ID] {
			candidates = append(candidates, edge.ID)
		}
	}
	if len(candidates) == 0 {
		for _, edge := range wordGraphCatalog.Edges {
			candidates = append(candidates, edge.ID)
		}
	}
	if len(candidates) == 0 {
		return WordGraphItem{}, errors.New("no word-graph questions available")
	}
	sum := sha256.Sum256([]byte(seed + "|word-graph"))
	item, ok := WordGraphItemByID(candidates[int(binary.BigEndian.Uint16(sum[:2]))%len(candidates)])
	if !ok {
		return WordGraphItem{}, errors.New("invalid word-graph relation")
	}
	return item, nil
}

func ShuffledWordGraphOptions(item WordGraphItem, seed string) []string {
	options := append([]string(nil), item.Options...)
	sort.SliceStable(options, func(i, j int) bool {
		left := sha256.Sum256([]byte(seed + "|graph-option|" + options[i]))
		right := sha256.Sum256([]byte(seed + "|graph-option|" + options[j]))
		return string(left[:]) < string(right[:])
	})
	return options
}
