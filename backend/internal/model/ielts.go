package model

import "time"

type IELTSAttempt struct {
	ID        string    `json:"id"`
	Section   string    `json:"section"`
	TestType  string    `json:"testType"`
	RawScore  *int      `json:"rawScore,omitempty"`
	MaxScore  *int      `json:"maxScore,omitempty"`
	Band      float64   `json:"band"`
	Source    string    `json:"source"`
	CreatedAt time.Time `json:"createdAt"`
}

type IELTSOverallInput struct {
	Listening float64 `json:"listening"`
	Reading   float64 `json:"reading"`
	Writing   float64 `json:"writing"`
	Speaking  float64 `json:"speaking"`
}
