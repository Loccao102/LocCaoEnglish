package learning

import (
	"crypto/sha256"
	_ "embed"
	"encoding/binary"
	"encoding/json"
	"errors"
	"sort"
)

//go:embed grammar_catalog.json
var grammarCatalogJSON []byte

type GrammarItem struct {
	ID            string   `json:"id"`
	Pack          string   `json:"pack"`
	CEFRLevel     string   `json:"cefrLevel"`
	Question      string   `json:"question"`
	Options       []string `json:"options"`
	CorrectAnswer string   `json:"correctAnswer"`
	Feedback      string   `json:"feedback"`
}

type grammarCatalogFile struct {
	ContentVersion string        `json:"contentVersion"`
	Items          []GrammarItem `json:"items"`
}

var grammarCatalog grammarCatalogFile

func init() {
	if err := json.Unmarshal(grammarCatalogJSON, &grammarCatalog); err != nil {
		panic("invalid grammar catalog: " + err.Error())
	}
}

func GrammarContentVersion() string { return grammarCatalog.ContentVersion }

func GrammarItemByID(id string) (GrammarItem, bool) {
	for _, item := range grammarCatalog.Items {
		if item.ID == id {
			return item, true
		}
	}
	return GrammarItem{}, false
}

func PickGrammar(level, pack, seed string, excluded []string) (GrammarItem, error) {
	exclude := map[string]bool{}
	for _, id := range excluded {
		exclude[id] = true
	}
	candidates := make([]GrammarItem, 0)
	for _, item := range grammarCatalog.Items {
		if item.CEFRLevel == level && item.Pack == pack && !exclude[item.ID] {
			candidates = append(candidates, item)
		}
	}
	if len(candidates) == 0 {
		for _, item := range grammarCatalog.Items {
			if item.CEFRLevel == level && item.Pack == pack {
				candidates = append(candidates, item)
			}
		}
	}
	if len(candidates) == 0 {
		return GrammarItem{}, errors.New("no grammar-repair content for CEFR level and pack")
	}
	if pack != "cefr-core" {
		return candidates[0], nil
	}
	sum := sha256.Sum256([]byte(seed + "|" + level + "|grammar"))
	index := int(binary.BigEndian.Uint16(sum[:2])) % len(candidates)
	return candidates[index], nil
}

func ShuffledGrammarOptions(item GrammarItem, seed string) []string {
	options := append([]string(nil), item.Options...)
	sort.SliceStable(options, func(i, j int) bool {
		left := sha256.Sum256([]byte(seed + "|grammar|" + options[i]))
		right := sha256.Sum256([]byte(seed + "|grammar|" + options[j]))
		return string(left[:]) < string(right[:])
	})
	return options
}
