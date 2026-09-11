package engine

import (
	"testing"
	"time"

	"github.com/Loccao102/LocCaoEnglish/backend/internal/model"
)

func TestBuildPlanPrioritizesWeakestAndReviews(t *testing.T) {
	skills := []model.Skill{{Name:"Reading",Confidence:.8},{Name:"Speaking",Confidence:.3},{Name:"Writing",Confidence:.45}}
	reviews := []model.ReviewItem{{ItemKey:"x",DueAt:time.Now()}}
	plan := BuildPlan(skills,reviews)
	if len(plan.Items) < 2 { t.Fatalf("expected multiple plan items") }
	if plan.Items[0].Route != "/review" { t.Fatalf("due review should be first") }
	if plan.Items[1].Skill != "Speaking" { t.Fatalf("weakest skill should be prioritized, got %s", plan.Items[1].Skill) }
}
