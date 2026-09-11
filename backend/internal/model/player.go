package model

import "time"

type PlayerProfile struct {
	UserID       string    `json:"userId"`
	Goal         string    `json:"goal"`
	CEFRLevel    string    `json:"cefrLevel"`
	DailyMinutes int       `json:"dailyMinutes"`
	TargetBand   float64   `json:"targetBand"`
	Interests    []string  `json:"interests"`
	Onboarded    bool      `json:"onboarded"`
	UpdatedAt    time.Time `json:"updatedAt"`
}
