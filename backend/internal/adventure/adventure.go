// Package adventure owns story unlocks, grading and single-award rewards.
package adventure

import (
	"embed"
	"encoding/json"
	"errors"
	"strings"
)

//go:embed catalog.json
var files embed.FS

type Question struct {
	Kind    string   `json:"kind"`
	Prompt  string   `json:"prompt"`
	Answer  string   `json:"answer"`
	Options []string `json:"options"`
	Note    string   `json:"note"`
	Passage string   `json:"passage"`
}
type Quest struct {
	ID        string     `json:"id"`
	ZoneID    string     `json:"zoneId"`
	Title     string     `json:"title"`
	Requires  string     `json:"requires"`
	XP        int        `json:"xp"`
	Coins     int        `json:"coins"`
	Page      bool       `json:"page"`
	Questions []Question `json:"questions"`
}
type Companion struct {
	ID   string `json:"id"`
	Cost int    `json:"cost"`
}
type Catalog struct {
	Zones []struct {
		ID     string  `json:"id"`
		Quests []Quest `json:"quests"`
	} `json:"zones"`
	Companions []Companion `json:"companions"`
}

var Content = loadCatalog()

func loadCatalog() Catalog {
	var catalog Catalog
	data, err := files.ReadFile("catalog.json")
	if err != nil {
		panic(err)
	}
	if err = json.Unmarshal(data, &catalog); err != nil {
		panic(err)
	}
	return catalog
}
func Quests() []Quest {
	out := []Quest{}
	for _, zone := range Content.Zones {
		out = append(out, zone.Quests...)
	}
	return out
}
func FindQuest(id string) (Quest, bool) {
	for _, quest := range Quests() {
		if quest.ID == id {
			return quest, true
		}
	}
	return Quest{}, false
}

type Save struct {
	Version   int            `json:"version"`
	Completed map[string]int `json:"completed"`
	XP        int            `json:"xp"`
	Coins     int            `json:"coins"`
	Owned     []string       `json:"owned"`
	Character string         `json:"character"`
}
type Action struct {
	Kind      string   `json:"kind"`
	QuestID   string   `json:"questId,omitempty"`
	Answers   []string `json:"answers,omitempty"`
	Character string   `json:"character,omitempty"`
}
type Verdict struct {
	Correct    int  `json:"correct"`
	Stars      int  `json:"stars"`
	Passed     bool `json:"passed"`
	XP         int  `json:"xp"`
	Coins      int  `json:"coins"`
	FirstClear bool `json:"firstClear"`
}
type Result struct {
	Save    Save     `json:"save"`
	Verdict *Verdict `json:"verdict,omitempty"`
}

func NewSave() Save {
	return Save{Version: 1, Completed: map[string]int{}, Owned: []string{"mam"}, Character: "mam"}
}
func Clone(save Save) Save {
	out := save
	out.Completed = map[string]int{}
	for id, stars := range save.Completed {
		out.Completed[id] = stars
	}
	out.Owned = append([]string{}, save.Owned...)
	return out
}
func Normalize(value string) string {
	value = strings.ToLower(value)
	value = strings.Map(func(r rune) rune {
		if strings.ContainsRune(".,!?;:’'", r) {
			return -1
		}
		return r
	}, value)
	return strings.Join(strings.Fields(value), " ")
}
func Apply(save Save, action Action) (Result, error) {
	save = Clone(save)
	result := Result{Save: save}
	switch action.Kind {
	case "complete":
		quest, ok := FindQuest(action.QuestID)
		if !ok {
			return result, errors.New("unknown quest")
		}
		if quest.Requires != "" && save.Completed[quest.Requires] < 2 {
			return result, errors.New("finish the previous quest first")
		}
		if len(action.Answers) != len(quest.Questions) {
			return result, errors.New("answer every question before finishing")
		}
		verdict := &Verdict{}
		for i, q := range quest.Questions {
			if len(action.Answers[i]) > 512 {
				return result, errors.New("answer is too long")
			}
			if Normalize(action.Answers[i]) == Normalize(q.Answer) {
				verdict.Correct++
			}
		}
		verdict.Passed = verdict.Correct >= 2
		if verdict.Passed {
			verdict.Stars = verdict.Correct
			verdict.FirstClear = save.Completed[quest.ID] == 0
			if verdict.FirstClear {
				verdict.XP = quest.XP
				verdict.Coins = quest.Coins
				save.XP += quest.XP
				save.Coins += quest.Coins
			}
			if verdict.Stars > save.Completed[quest.ID] {
				save.Completed[quest.ID] = verdict.Stars
			}
		}
		result.Save = save
		result.Verdict = verdict
		return result, nil
	case "equip":
		for _, companion := range Content.Companions {
			if companion.ID != action.Character {
				continue
			}
			for _, owned := range save.Owned {
				if owned == companion.ID {
					save.Character = companion.ID
					return Result{Save: save}, nil
				}
			}
			if save.Coins < companion.Cost {
				return result, errors.New("not enough sun coins")
			}
			save.Coins -= companion.Cost
			save.Owned = append(save.Owned, companion.ID)
			save.Character = companion.ID
			return Result{Save: save}, nil
		}
		return result, errors.New("unknown companion")
	default:
		return result, errors.New("unknown adventure action")
	}
}
