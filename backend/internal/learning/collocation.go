package learning

import (
	"crypto/sha256"
	_ "embed"
	"encoding/binary"
	"encoding/json"
	"errors"
	"sort"
)

//go:embed collocation_catalog.json
var collocationCatalogJSON []byte

type CollocationItem struct {
	ID            string   `json:"id"`
	Pack          string   `json:"pack"`
	CEFRLevel     string   `json:"cefrLevel"`
	Core          string   `json:"core"`
	Question      string   `json:"question"`
	Options       []string `json:"options"`
	CorrectAnswer string   `json:"correctAnswer"`
	Feedback      string   `json:"feedback"`
}

type collocationCatalogFile struct {
	ContentVersion string            `json:"contentVersion"`
	Items          []CollocationItem `json:"items"`
}

var collocationCatalog collocationCatalogFile

func init() {
	if err := json.Unmarshal(collocationCatalogJSON, &collocationCatalog); err != nil {
		panic("invalid collocation catalog: " + err.Error())
	}
}

func CollocationContentVersion() string { return collocationCatalog.ContentVersion }

func CollocationItemByID(id string) (CollocationItem, bool) {
	for _, item := range collocationCatalog.Items {
		if item.ID == id {
			return item, true
		}
	}
	return CollocationItem{}, false
}

func PickCollocation(level, pack, seed string, excluded []string) (CollocationItem, error) {
	blocked := make(map[string]bool, len(excluded))
	for _, id := range excluded {
		blocked[id] = true
	}
	candidates := make([]CollocationItem, 0)
	for _, item := range collocationCatalog.Items {
		if item.Pack == pack && item.CEFRLevel == level && !blocked[item.ID] {
			candidates = append(candidates, item)
		}
	}
	if len(candidates) == 0 {
		for _, item := range collocationCatalog.Items {
			if item.Pack == pack && item.CEFRLevel == level {
				candidates = append(candidates, item)
			}
		}
	}
	if len(candidates) == 0 {
		return CollocationItem{}, errors.New("no collocation content for CEFR level and pack")
	}
	if pack != "cefr-core" {
		return candidates[0], nil
	}
	sum := sha256.Sum256([]byte(seed + "|" + level + "|collocation"))
	return candidates[int(binary.BigEndian.Uint16(sum[:2]))%len(candidates)], nil
}

func ShuffledCollocationOptions(item CollocationItem, seed string) []string {
	options := append([]string(nil), item.Options...)
	sort.SliceStable(options, func(i, j int) bool {
		left := sha256.Sum256([]byte(seed + "|collocation|" + options[i]))
		right := sha256.Sum256([]byte(seed + "|collocation|" + options[j]))
		return string(left[:]) < string(right[:])
	})
	return options
}
