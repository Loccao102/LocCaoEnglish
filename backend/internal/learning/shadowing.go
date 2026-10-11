package learning

import (
	"crypto/sha256"
	_ "embed"
	"encoding/binary"
	"encoding/json"
	"errors"
)

const ShadowingRulesVersion = "shadowing.v1"

//go:embed shadowing_catalog.json
var shadowingJSON []byte

type ShadowingItem struct{ ID, Text string }
type ShadowingPack struct {
	ID, Label, CEFRLevel string
	Items                []ShadowingItem
}

var shadowingCatalog struct {
	ContentVersion string
	Packs          []ShadowingPack
}

func init() {
	if err := json.Unmarshal(shadowingJSON, &shadowingCatalog); err != nil {
		panic(err)
	}
}
func ShadowingContentVersion() string { return shadowingCatalog.ContentVersion }
func PickShadowing(level, pack, seed string, excluded []string) (ShadowingItem, string, error) {
	blocked := map[string]bool{}
	for _, id := range excluded {
		blocked[id] = true
	}
	for _, p := range shadowingCatalog.Packs {
		if p.ID != pack || p.CEFRLevel != level {
			continue
		}
		candidates := []ShadowingItem{}
		for _, item := range p.Items {
			if !blocked[item.ID] {
				candidates = append(candidates, item)
			}
		}
		if len(candidates) == 0 {
			candidates = p.Items
		}
		if len(candidates) == 0 {
			break
		}
		sum := sha256.Sum256([]byte(seed + "|shadowing"))
		return candidates[int(binary.BigEndian.Uint16(sum[:2]))%len(candidates)], p.Label, nil
	}
	return ShadowingItem{}, "", errors.New("unsupported shadowing pack or level")
}
