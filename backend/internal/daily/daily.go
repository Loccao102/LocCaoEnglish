// Package daily owns the v1 daily checklist, date and personal reward contract.
package daily

import (
	"errors"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/model"
	"sort"
	"time"
)

const RulesVersion = "daily-plan.v1"
const Method = "completed-practice.v1"
const RewardXP = 50

var ErrInput = errors.New("invalid daily request")
var ErrConflict = errors.New("the saved daily plan needs a supported date and version; refresh its status")
var ErrIncomplete = errors.New("finish the saved daily practice checklist before claiming the chest")
var ErrExpired = errors.New("the practice day changed; refresh the current checklist. An earlier confirmed reward is kept")
var zone = time.FixedZone("UTC+7", 7*60*60)

func Day(at time.Time) string { return at.In(zone).Format("2006-01-02") }
func Bounds(day string) (time.Time, time.Time, error) {
	start, e := time.ParseInLocation("2006-01-02", day, zone)
	if e != nil || start.Year() < 1 || start.Format("2006-01-02") != day {
		return time.Time{}, time.Time{}, ErrInput
	}
	return start.UTC(), start.AddDate(0, 0, 1).UTC(), nil
}

var quests = map[string]model.DailyQuest{
	"word-link":        {ID: "daily-word-link", Title: "Find a word connection", Skill: "Vocabulary", Activity: "word-link", Route: "/games/word-link", XP: 20},
	"grammar-repair":   {ID: "daily-grammar", Title: "Repair a sentence", Skill: "Grammar", Activity: "grammar-repair", Route: "/games/grammar-repair", XP: 20},
	"reading-race":     {ID: "daily-reading", Title: "Read and choose the evidence", Skill: "Reading", Activity: "reading-race", Route: "/reading", XP: 20},
	"listen-pick":      {ID: "daily-listening", Title: "Listen and choose a response", Skill: "Listening", Activity: "listen-pick", Route: "/listening", XP: 20},
	"dictation":        {ID: "daily-dictation", Title: "Reconstruct a heard sentence", Skill: "Dictation", Activity: "dictation", Route: "/dictation", XP: 20},
	"shadowing":        {ID: "daily-speaking", Title: "Practise a guided speaking phrase", Skill: "Speaking", Activity: "shadowing", Route: "/speaking", XP: 20},
	"sentence-builder": {ID: "daily-sentence", Title: "Build a clear sentence", Skill: "Grammar", Activity: "sentence-builder", Route: "/games/sentence-builder", XP: 20},
}

func Build(day string, skills []model.Skill, profile model.PlayerProfile, now time.Time) model.DailyPlanSnapshot {
	out := model.DailyPlanSnapshot{Date: day, RulesVersion: RulesVersion, CreatedAt: now.UTC(), Quests: []model.DailyQuest{}}
	seen := map[string]bool{}
	add := func(activity string) {
		if q, ok := quests[activity]; ok && !seen[activity] && len(out.Quests) < 3 {
			out.Quests = append(out.Quests, q)
			seen[activity] = true
		}
	}
	switch profile.Goal {
	case "travel":
		add("listen-pick")
	case "ielts":
		add("reading-race")
	case "work", "conversation":
		add("shadowing")
	}
	ordered := append([]model.Skill(nil), skills...)
	sort.Slice(ordered, func(i, j int) bool {
		if ordered[i].Confidence == ordered[j].Confidence {
			return ordered[i].Name < ordered[j].Name
		}
		return ordered[i].Confidence < ordered[j].Confidence
	})
	activity := map[string]string{"Vocabulary": "word-link", "Grammar": "grammar-repair", "Reading": "reading-race", "Listening": "listen-pick", "Dictation": "dictation", "Speaking": "shadowing", "Writing": "sentence-builder"}
	for _, skill := range ordered {
		add(activity[skill.Name])
	}
	for _, fallback := range []string{"word-link", "grammar-repair", "reading-race"} {
		add(fallback)
	}
	return out
}
func Validate(p model.DailyPlanSnapshot) error {
	if _, _, e := Bounds(p.Date); e != nil || p.RulesVersion != RulesVersion || p.CreatedAt.IsZero() || len(p.Quests) != 3 {
		return ErrConflict
	}
	seen := map[string]bool{}
	for _, q := range p.Quests {
		expected, ok := quests[q.Activity]
		if !ok || q != expected || seen[q.Activity] {
			return ErrConflict
		}
		seen[q.Activity] = true
	}
	return nil
}
