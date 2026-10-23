package engine

import (
	"fmt"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/model"
	"sort"
	"time"
)

// Recommendations describe observed guided practice, not a mastery estimate.
// Legacy confidence remains available for compatibility but is not evidence here.
func BuildPlan(skills []model.Skill, reviews []model.ReviewItem) model.DailyPlan {
	ordered := make([]model.Skill, 0, len(skills))
	for _, skill := range skills {
		if _, _, _, ok := prescription(skill.Name); ok {
			ordered = append(ordered, skill)
		}
	}
	sort.Slice(ordered, func(i, j int) bool {
		a, b := practicePriority(ordered[i]), practicePriority(ordered[j])
		if a != b {
			return a < b
		}
		if a == 0 {
			ap, bp := ordered[i].Practice, ordered[j].Practice
			left := (ap.SampleCount - ap.CorrectCount) * bp.SampleCount
			right := (bp.SampleCount - bp.CorrectCount) * ap.SampleCount
			if left != right {
				return left > right
			}
		}
		return ordered[i].Name < ordered[j].Name
	})
	items := make([]model.PlanItem, 0, 4)
	for i, skill := range ordered {
		if i >= 3 {
			break
		}
		activity, route, mins, _ := prescription(skill.Name)
		reason := "Try this activity to start a saved practice record. No checked practice is available yet."
		if hasPractice(skill) {
			p := skill.Practice
			reason = fmt.Sprintf("%d of your %d recent different items were correct on their latest try. Revisit this guided practice.", p.CorrectCount, p.SampleCount)
			if skill.Name == "Speaking" {
				reason += " This checks transcript matching, not pronunciation."
			}
		}
		items = append(items, model.PlanItem{ID: "practice-" + skill.Name, Title: activity, Skill: skill.Name, Activity: activity, Reason: reason, Minutes: mins, Route: route, Priority: i + 1})
	}
	count := 0
	now := time.Now()
	for _, review := range reviews {
		if !review.DueAt.After(now) {
			count++
		}
	}
	if count > 12 {
		count = 12
	}
	if count > 0 {
		items = append([]model.PlanItem{{ID: "review-due", Title: fmt.Sprintf("Review %d due items", count), Skill: "Memory", Activity: "Spaced review", Reason: "These saved items are due for review. Self-ratings schedule the next review; they do not award learning XP.", Minutes: 5 + count/2, Route: "/review", Priority: 0}}, items...)
	}
	total := 0
	for _, item := range items {
		total += item.Minutes
	}
	focus := "Start your practice record"
	if len(ordered) > 0 && hasPractice(ordered[0]) {
		focus = ordered[0].Name + " practice"
	}
	// A recommendation is not a reward quote. Compatibility XP fields stay zero.
	return model.DailyPlan{Method: "skill-practice.v1", Focus: focus, TotalMins: total, Items: items}
}

func hasPractice(skill model.Skill) bool {
	p := skill.Practice
	return p != nil && p.Method == "skill-practice.v1" && p.WindowSize == 20 && p.SampleCount > 0 && p.SampleCount <= p.WindowSize && p.CorrectCount >= 0 && p.CorrectCount <= p.SampleCount && (p.EvidenceKind == "guided-practice" || p.EvidenceKind == "transcript-match")
}
func practicePriority(skill model.Skill) int {
	if !hasPractice(skill) {
		return 1
	}
	if skill.Practice.CorrectCount < skill.Practice.SampleCount {
		return 0
	}
	return 2
}
func prescription(skill string) (string, string, int, bool) {
	switch skill {
	case "Speaking":
		return "Shadow & respond", "/speaking", 7, true
	case "Dictation":
		return "Dictation Rush", "/dictation", 6, true
	case "Listening":
		return "Listen & choose", "/listening", 7, true
	case "Vocabulary":
		return "Word Link", "/games/word-link", 6, true
	case "Reading":
		return "Reading sprint", "/reading", 8, true
	case "Grammar":
		return "Sentence repair", "/games/grammar-repair", 7, true
	}
	return "", "", 0, false
}
