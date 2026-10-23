package engine

import (
	"fmt"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/model"
)

func BuildPlanForProfile(skills []model.Skill, reviews []model.ReviewItem, profile model.PlayerProfile) model.DailyPlan {
	base := BuildPlan(skills, reviews)
	if !profile.Onboarded {
		return base
	}
	// Keep due reviews and observed mistakes ahead of the chosen goal, even
	// when a short daily budget would otherwise hide every feedback action.
	errors := map[string]bool{}
	for _, skill := range skills {
		if hasPractice(skill) && skill.Practice.CorrectCount < skill.Practice.SampleCount {
			errors[skill.Name] = true
		}
	}
	cut := 0
	for cut < len(base.Items) && (base.Items[cut].ID == "review-due" || errors[base.Items[cut].Skill]) {
		cut++
	}
	items := append([]model.PlanItem{}, base.Items[:cut]...)
	items = append(items, goalQuest(profile))
	items = append(items, base.Items[cut:]...)
	seen := map[string]bool{}
	target := profile.DailyMinutes
	if target < 5 {
		target = 15
	}
	picked := make([]model.PlanItem, 0, 4)
	total := 0
	for _, item := range items {
		if seen[item.Route] {
			continue
		}
		seen[item.Route] = true
		picked = append(picked, item)
		total += item.Minutes
		if len(picked) >= 4 || total >= target {
			break
		}
	}
	base.Items, base.TotalMins, base.PotentialXP = picked, total, 0
	base.Focus = "Your goal & next practice"
	return base
}
func goalQuest(profile model.PlayerProfile) model.PlanItem {
	switch profile.Goal {
	case "ielts":
		return model.PlanItem{ID: "goal-ielts", Title: "Choose an IELTS practice section", Skill: "IELTS", Activity: "IELTS practice", Reason: fmt.Sprintf("You chose a target band of %.1f. Section practice has its own feedback history and does not award learning XP.", profile.TargetBand), Minutes: 15, Route: "/ielts", Priority: 0}
	case "travel":
		return model.PlanItem{ID: "goal-travel", Title: "Prepare your airport mission", Skill: "Speaking", Activity: "Scenario mission", Reason: "You chose travel English. Check the saved preparation steps before starting the airport conversation.", Minutes: 12, Route: "/missions/airport", Priority: 0}
	case "work":
		return model.PlanItem{ID: "goal-work", Title: "Practise a speaking phrase", Skill: "Speaking", Activity: "Shadowing", Reason: "You chose English for work. Start with guided transcript matching; pronunciation feedback is separate.", Minutes: 7, Route: "/speaking", Priority: 0}
	default:
		return model.PlanItem{ID: "goal-conversation", Title: "Practise a speaking phrase", Skill: "Speaking", Activity: "Shadowing", Reason: "You chose everyday conversation. Start with guided transcript matching; pronunciation feedback is separate.", Minutes: 7, Route: "/speaking", Priority: 0}
	}
}
