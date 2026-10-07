package learning

import (
	"crypto/sha256"
	_ "embed"
	"encoding/binary"
	"encoding/json"
	"errors"
	"sort"
)

//go:embed reading_catalog.json
var readingJSON []byte

type ReadingItem struct {
	ID, Pack, CEFRLevel, Title, Passage, Question, CorrectAnswer string
	Evidence, Evidence2, Feedback, Kind                          string
	Options                                                      []string
}

var readingCatalog struct {
	ContentVersion string
	Items          []ReadingItem
}

func init() {
	if err := json.Unmarshal(readingJSON, &readingCatalog); err != nil {
		panic(err)
	}
}

func ReadingContentVersion() string { return readingCatalog.ContentVersion }

func ReadingItemByID(id string) (ReadingItem, bool) {
	for _, item := range readingCatalog.Items {
		if item.ID == id {
			item.Options = append([]string(nil), item.Options...)
			return item, true
		}
	}
	return ReadingItem{}, false
}

func PickReading(level, pack, seed string, excluded []string) (ReadingItem, error) {
	blocked := map[string]bool{}
	for _, id := range excluded {
		blocked[id] = true
	}
	var candidates, all []string
	for _, item := range readingCatalog.Items {
		if item.Pack == pack && item.CEFRLevel == level {
			all = append(all, item.ID)
			if !blocked[item.ID] {
				candidates = append(candidates, item.ID)
			}
		}
	}
	if len(candidates) == 0 {
		candidates = all
	}
	if len(candidates) == 0 {
		return ReadingItem{}, errors.New("reading-race supports cefr-core at A2, B1 and B2")
	}
	sum := sha256.Sum256([]byte(seed + "|" + level + "|reading-race"))
	item, _ := ReadingItemByID(candidates[int(binary.BigEndian.Uint16(sum[:2]))%len(candidates)])
	return item, nil
}

func ShuffledReadingOptions(item ReadingItem, seed string) []string {
	options := append([]string(nil), item.Options...)
	sort.SliceStable(options, func(i, j int) bool {
		left := sha256.Sum256([]byte(seed + "|reading-option|" + options[i]))
		right := sha256.Sum256([]byte(seed + "|reading-option|" + options[j]))
		return string(left[:]) < string(right[:])
	})
	return options
}

// Persist evidence with the verdict so old rounds never consult a newer bank.
func ReadingFeedback(item ReadingItem) string {
	feedback := "Evidence: “" + item.Evidence + "”"
	if item.Evidence2 != "" {
		feedback += " “" + item.Evidence2 + "”"
	}
	return feedback + "\n\n" + item.Feedback
}
