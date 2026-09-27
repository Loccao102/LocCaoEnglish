package learning

import (
	"crypto/sha256"
	_ "embed"
	"encoding/binary"
	"encoding/json"
	"errors"
	"sort"
	"strings"
)

//go:embed catalog.json
var catalogJSON []byte

type WordLinkItem struct {
	ID            string   `json:"id"`
	CEFRLevel     string   `json:"cefrLevel"`
	Word          string   `json:"word"`
	Relation      string   `json:"relation"`
	Options       []string `json:"options"`
	CorrectAnswer string   `json:"correctAnswer"`
	Note          string   `json:"note"`
}

type catalogFile struct {
	ContentVersion string         `json:"contentVersion"`
	Items          []WordLinkItem `json:"items"`
}

var wordLinkCatalog catalogFile

func init() {
	if err := json.Unmarshal(catalogJSON, &wordLinkCatalog); err != nil {
		panic("invalid learning catalog: " + err.Error())
	}
}

func WordLinkContentVersion() string { return wordLinkCatalog.ContentVersion }

func NormalizeCEFR(value string) (string, bool) {
	level := strings.ToUpper(strings.TrimSpace(value))
	switch level {
	case "A1", "A2", "B1", "B2", "C1", "C2":
		return level, true
	default:
		return "", false
	}
}

func WordLinkItemByID(id string) (WordLinkItem, bool) {
	for _, item := range wordLinkCatalog.Items {
		if item.ID == id {
			return item, true
		}
	}
	return WordLinkItem{}, false
}

func PickWordLink(level, seed string, excluded []string) (WordLinkItem, error) {
	exclude := map[string]bool{}
	for _, id := range excluded {
		exclude[id] = true
	}
	candidates := make([]WordLinkItem, 0)
	for _, item := range wordLinkCatalog.Items {
		if item.CEFRLevel == level && !exclude[item.ID] {
			candidates = append(candidates, item)
		}
	}
	if len(candidates) == 0 {
		for _, item := range wordLinkCatalog.Items {
			if item.CEFRLevel == level {
				candidates = append(candidates, item)
			}
		}
	}
	if len(candidates) == 0 {
		return WordLinkItem{}, errors.New("no word-link content for CEFR level")
	}
	sum := sha256.Sum256([]byte(seed + "|" + level))
	index := int(binary.BigEndian.Uint16(sum[:2])) % len(candidates)
	return candidates[index], nil
}

func ShuffledOptions(item WordLinkItem, seed string) []string {
	options := append([]string(nil), item.Options...)
	sort.SliceStable(options, func(i, j int) bool {
		left := sha256.Sum256([]byte(seed + "|" + options[i]))
		right := sha256.Sum256([]byte(seed + "|" + options[j]))
		return string(left[:]) < string(right[:])
	})
	return options
}
