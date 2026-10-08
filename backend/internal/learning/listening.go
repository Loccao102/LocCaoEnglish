package learning

import (
	"crypto/sha256"
	_ "embed"
	"encoding/binary"
	"encoding/json"
	"errors"
	"sort"
)

const ListeningRulesVersion = "listen-pick.v1"

//go:embed listening_catalog.json
var listeningJSON []byte

type ListeningItem struct {
	ID, Pack, CEFRLevel, Transcript, Question, CorrectAnswer, Feedback string
	Options                                                            []string
}

var listeningCatalog struct {
	ContentVersion string
	Items          []ListeningItem
}

func init() {
	if err := json.Unmarshal(listeningJSON, &listeningCatalog); err != nil {
		panic(err)
	}
}
func ListeningContentVersion() string { return listeningCatalog.ContentVersion }
func ListeningItemByID(id string) (ListeningItem, bool) {
	for _, item := range listeningCatalog.Items {
		if item.ID == id {
			item.Options = append([]string(nil), item.Options...)
			return item, true
		}
	}
	return ListeningItem{}, false
}
func PickListening(level, pack, seed string, excluded []string) (ListeningItem, error) {
	blocked := map[string]bool{}
	for _, id := range excluded {
		blocked[id] = true
	}
	var all, candidates []string
	for _, item := range listeningCatalog.Items {
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
		return ListeningItem{}, errors.New("listen-pick supports B1 core, airport, transit, cafe, plans and requirements packs")
	}
	sum := sha256.Sum256([]byte(seed + "|listen-pick"))
	item, _ := ListeningItemByID(candidates[int(binary.BigEndian.Uint16(sum[:2]))%len(candidates)])
	return item, nil
}
func ShuffledListeningOptions(item ListeningItem, seed string) []string {
	options := append([]string(nil), item.Options...)
	sort.SliceStable(options, func(i, j int) bool {
		a := sha256.Sum256([]byte(seed + "|listen|" + options[i]))
		b := sha256.Sum256([]byte(seed + "|listen|" + options[j]))
		return string(a[:]) < string(b[:])
	})
	return options
}
