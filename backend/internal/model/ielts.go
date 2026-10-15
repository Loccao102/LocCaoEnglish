package model

import "time"

type IELTSAttempt struct {
	AttemptID      string    `json:"attemptId,omitempty"`
	ContentVersion string    `json:"contentVersion,omitempty"`
	RulesVersion   string    `json:"rulesVersion,omitempty"`
	MethodVersion  string    `json:"methodVersion,omitempty"`
	Provider       string    `json:"provider,omitempty"`
	Evidence       string    `json:"evidence"`
	Legacy         bool      `json:"legacy"`
	ID             string    `json:"id"`
	Section        string    `json:"section"`
	TestType       string    `json:"testType"`
	RawScore       *int      `json:"rawScore,omitempty"`
	MaxScore       *int      `json:"maxScore,omitempty"`
	Band           float64   `json:"band"`
	Source         string    `json:"source"`
	CreatedAt      time.Time `json:"createdAt"`
}

type IELTSReadingOption struct {
	ID   string `json:"id"`
	Text string `json:"text"`
}
type IELTSReadingQuestion struct {
	ID      string               `json:"id"`
	Prompt  string               `json:"prompt"`
	Options []IELTSReadingOption `json:"options"`
}
type IELTSReadingSection struct {
	ID        string                 `json:"id"`
	Title     string                 `json:"title"`
	Passage   string                 `json:"passage"`
	Questions []IELTSReadingQuestion `json:"questions"`
}
type IELTSReadingPrompt struct {
	Title    string                `json:"title"`
	Sections []IELTSReadingSection `json:"sections"`
}
type IELTSReadingAnswer struct {
	QuestionID      string `json:"questionId"`
	OptionID        string `json:"optionId"`
	CorrectOptionID string `json:"correctOptionId"`
	Correct         bool   `json:"correct"`
}
type IELTSReadingResult struct {
	Section       string               `json:"section"`
	TestType      string               `json:"testType"`
	RawScore      int                  `json:"rawScore"`
	MaxScore      int                  `json:"maxScore"`
	Band          float64              `json:"band"`
	Percentage    int                  `json:"percentage"`
	Method        string               `json:"method"`
	MethodVersion string               `json:"methodVersion"`
	Provider      string               `json:"provider"`
	Disclaimer    string               `json:"disclaimer"`
	Answers       []IELTSReadingAnswer `json:"answers"`
}

type IELTSOverallInput struct {
	Listening float64 `json:"listening"`
	Reading   float64 `json:"reading"`
	Writing   float64 `json:"writing"`
	Speaking  float64 `json:"speaking"`
}
