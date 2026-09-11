package engine

import "strings"

type ScenarioEvaluation struct {
	BossID    string   `json:"bossId"`
	Stage     int      `json:"stage"`
	Score     int      `json:"score"`
	Complete  bool     `json:"complete"`
	Completed []string `json:"completed"`
	Missing   []string `json:"missing"`
}

type scenarioObjective struct {
	Name     string
	Keywords []string
}

func EvaluateBossConversation(bossID string, messages []string) ScenarioEvaluation {
	objectives := objectivesForBoss(bossID)
	joined := strings.ToLower(strings.Join(messages, " "))
	result := ScenarioEvaluation{BossID: bossID, Completed: []string{}, Missing: []string{}}
	for _, objective := range objectives {
		if containsAny(joined, objective.Keywords) {
			result.Completed = append(result.Completed, objective.Name)
		} else {
			result.Missing = append(result.Missing, objective.Name)
		}
	}
	result.Stage = len(result.Completed)
	if len(objectives) > 0 {
		result.Score = int(float64(len(result.Completed)) / float64(len(objectives)) * 100)
	}
	result.Complete = len(messages) >= 3 && len(result.Missing) == 0
	return result
}

func objectivesForBoss(bossID string) []scenarioObjective {
	switch bossID {
	case "airport-crisis":
		return []scenarioObjective{
			{Name: "Explain the flight problem", Keywords: []string{"missed", "miss my", "late", "delay"}},
			{Name: "Ask for a workable replacement", Keywords: []string{"rebook", "next flight", "earliest", "later flight", "another flight", "prefer"}},
			{Name: "Confirm the plan", Keywords: []string{"book it", "take it", "yes please", "gate", "boarding", "board"}},
		}
	case "hotel-reservation":
		return []scenarioObjective{
			{Name: "Explain the missing reservation", Keywords: []string{"reservation", "booking", "booked", "cannot find", "can't find"}},
			{Name: "Provide booking evidence", Keywords: []string{"confirmation number", "booking number", "email", "under my name", "middle name"}},
			{Name: "Confirm a practical stay detail", Keywords: []string{"breakfast", "checkout", "check-out", "wifi", "wi-fi", "key card", "please", "could you"}},
		}
	case "city-transit":
		return []scenarioObjective{
			{Name: "Explain the destination or last-train problem", Keywords: []string{"station", "train", "metro", "last train", "get to", "need to go"}},
			{Name: "Ask for or choose a route", Keywords: []string{"fastest", "route", "transfer", "change", "line", "fewer transfers"}},
			{Name: "Confirm an operational detail", Keywords: []string{"platform", "ticket", "minutes", "what time", "central", "blue line", "green line"}},
		}
	default:
		return nil
	}
}

func containsAny(text string, keywords []string) bool {
	for _, keyword := range keywords {
		if strings.Contains(text, keyword) {
			return true
		}
	}
	return false
}
