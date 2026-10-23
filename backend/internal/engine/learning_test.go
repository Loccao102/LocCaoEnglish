package engine

import (
	"github.com/Loccao102/LocCaoEnglish/backend/internal/model"
	"reflect"
	"strings"
	"testing"
	"time"
)

func practiceSkill(name string, count, correct int) model.Skill {
	return model.Skill{Name: name, Confidence: .99, Practice: &model.SkillPractice{Method: "skill-practice.v1", WindowSize: 20, SampleCount: count, CorrectCount: correct, EvidenceKind: "guided-practice"}}
}
func TestBuildPlanUsesObservedErrorsAndDueReviews(t *testing.T) {
	skills := []model.Skill{practiceSkill("Reading", 10, 9), practiceSkill("Speaking", 4, 1), {Name: "Dictation", Confidence: .01}}
	reviews := []model.ReviewItem{{ItemKey: "due", DueAt: time.Now().Add(-time.Hour)}, {ItemKey: "later", DueAt: time.Now().Add(time.Hour)}}
	plan := BuildPlan(skills, reviews)
	if len(plan.Items) != 4 || plan.Items[0].Title != "Review 1 due items" || plan.Items[1].Skill != "Speaking" || plan.Items[2].Skill != "Reading" || plan.Items[3].Skill != "Dictation" {
		t.Fatalf("expected actual errors before unsampled practice and only due review: %+v", plan)
	}
	if !strings.Contains(plan.Items[1].Reason, "1 of your 4") || !strings.Contains(plan.Items[1].Reason, "not pronunciation") || plan.PotentialXP != 0 {
		t.Fatal("practice reason or invented XP", plan)
	}
	for _, item := range plan.Items {
		if item.XP != 0 {
			t.Fatal("recommendation fabricated reward", item)
		}
	}
}
func TestPlanDoesNotDiagnoseSeededOrLegacyConfidence(t *testing.T) {
	a := []model.Skill{{Name: "Vocabulary", Confidence: .99}, {Name: "Speaking", Confidence: .01}, {Name: "Reading", Confidence: .5}, {Name: "Writing", Confidence: 0}}
	first := BuildPlan(a, nil)
	a[0].Confidence, a[1].Confidence, a[2].Confidence = 0, 1, .1
	second := BuildPlan(a, nil)
	if !reflect.DeepEqual(first, second) || first.Focus != "Start your practice record" || first.Items[0].Skill != "Reading" {
		t.Fatal("legacy values affected suggestions", first, second)
	}
	for _, item := range first.Items {
		if !strings.Contains(item.Reason, "No checked practice") || strings.Contains(item.Reason, "weak") || item.Skill == "Writing" {
			t.Fatal("fabricated diagnosis", item)
		}
	}
}
func TestPlanRoutesAndSafeSummaryCompatibility(t *testing.T) {
	for skill, route := range map[string]string{"Vocabulary": "/games/word-link", "Grammar": "/games/grammar-repair", "Reading": "/reading", "Listening": "/listening", "Dictation": "/dictation", "Speaking": "/speaking"} {
		s := practiceSkill(skill, 1, 1)
		plan := BuildPlan([]model.Skill{s}, nil)
		if len(plan.Items) != 1 || plan.Items[0].Route != route {
			t.Fatal("wrong activity route", plan)
		}
		s.Practice.Method = "future.v2"
		if !strings.Contains(BuildPlan([]model.Skill{s}, nil).Items[0].Reason, "No checked practice") {
			t.Fatal("unsupported summary inferred as evidence")
		}
	}
	plan := BuildPlan([]model.Skill{practiceSkill("Vocabulary", 20, 20), {Name: "Listening"}}, nil)
	if plan.Items[0].Skill != "Listening" {
		t.Fatal("unseen practice should precede all-correct review")
	}
}
func TestProfilePlanDoesNotQuoteRewardsOrRepeatRoutes(t *testing.T) {
	for _, goal := range []string{"ielts", "travel", "work", "conversation"} {
		plan := BuildPlanForProfile([]model.Skill{practiceSkill("Speaking", 2, 0), practiceSkill("Grammar", 1, 0)}, nil, model.PlayerProfile{Goal: goal, Onboarded: true, DailyMinutes: 60, TargetBand: 7})
		seen := map[string]bool{}
		for _, item := range plan.Items {
			if seen[item.Route] || item.XP != 0 {
				t.Fatal("duplicate or invented reward", plan)
			}
			seen[item.Route] = true
		}
		if plan.PotentialXP != 0 || len(plan.Items) == 0 {
			t.Fatal("invalid profile plan", plan)
		}
	}
}

func TestShortProfileBudgetStillOffersObservedMistake(t *testing.T) {
	for _, goal := range []string{"ielts", "travel", "work", "conversation"} {
		plan := BuildPlanForProfile([]model.Skill{practiceSkill("Grammar", 1, 0), {Name: "Speaking"}}, nil, model.PlayerProfile{Goal: goal, Onboarded: true, DailyMinutes: 5})
		if len(plan.Items) != 1 || plan.Items[0].Route != "/games/grammar-repair" {
			t.Fatal("goal hid observed mistake in a short practice budget", goal, plan)
		}
	}
}
