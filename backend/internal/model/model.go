package model

import "time"

type User struct {
	ID          string    `json:"id"`
	Email       string    `json:"email"`
	DisplayName string    `json:"displayName"`
	XP          int       `json:"xp"`
	Streak      int       `json:"streak"`
	CreatedAt   time.Time `json:"createdAt"`
}

type Skill struct {
	Name       string    `json:"name"`
	Confidence float64   `json:"confidence"`
	Level      int       `json:"level"`
	UpdatedAt  time.Time `json:"updatedAt"`
}

type AttemptInput struct {
	Skill       string  `json:"skill"`
	Activity    string  `json:"activity"`
	ItemKey     string  `json:"itemKey"`
	Prompt      string  `json:"prompt"`
	Answer      string  `json:"answer"`
	Accuracy    float64 `json:"accuracy"`
	DurationSec int     `json:"durationSec"`
}

type AttemptResult struct {
	XPDelta       int     `json:"xpDelta"`
	NewConfidence float64 `json:"newConfidence"`
	Level         int     `json:"level"`
	ReviewAdded   bool    `json:"reviewAdded"`
}

type ReviewItem struct {
	ItemKey      string    `json:"itemKey"`
	Kind         string    `json:"kind"`
	Prompt       string    `json:"prompt"`
	Answer       string    `json:"answer"`
	DueAt        time.Time `json:"dueAt"`
	IntervalDays int       `json:"intervalDays"`
	Ease         float64   `json:"ease"`
	Failures     int       `json:"failures"`
}

type Dashboard struct {
	User       User    `json:"user"`
	Skills     []Skill `json:"skills"`
	DueReviews int     `json:"dueReviews"`
	IELTSBand  float64 `json:"ieltsBand"`
	TargetBand float64 `json:"targetBand"`
}

type PlanItem struct {
	ID          string `json:"id"`
	Title       string `json:"title"`
	Skill       string `json:"skill"`
	Activity    string `json:"activity"`
	Reason      string `json:"reason"`
	Minutes     int    `json:"minutes"`
	XP          int    `json:"xp"`
	Route       string `json:"route"`
	Priority    int    `json:"priority"`
}

type DailyPlan struct {
	Focus      string     `json:"focus"`
	TotalMins  int        `json:"totalMins"`
	PotentialXP int       `json:"potentialXp"`
	Items      []PlanItem `json:"items"`
}
