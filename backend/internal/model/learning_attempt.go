package model

type LearningAttemptStartInput struct {
	RequestID       string   `json:"requestId"`
	Activity        string   `json:"activity"`
	CEFRLevel       string   `json:"cefrLevel"`
	ExcludeItemKeys []string `json:"excludeItemKeys,omitempty"`
}

type LearningAttemptPrompt struct {
	Word     string   `json:"word"`
	Relation string   `json:"relation"`
	Options  []string `json:"options"`
}

type LearningAttemptStart struct {
	AttemptID     string                `json:"attemptId"`
	Activity      string                `json:"activity"`
	ItemKey       string                `json:"itemKey"`
	CEFRLevel     string                `json:"cefrLevel"`
	ContentVersion string               `json:"contentVersion"`
	RulesVersion  string                `json:"rulesVersion"`
	Status        string                `json:"status"`
	Prompt        LearningAttemptPrompt `json:"prompt"`
}

type LearningAttemptSubmitInput struct {
	Answer string `json:"answer"`
}

type LearningAttemptResult struct {
	AttemptID       string  `json:"attemptId"`
	Status          string  `json:"status"`
	Correct         bool    `json:"correct"`
	CorrectAnswer   string  `json:"correctAnswer"`
	Feedback        string  `json:"feedback"`
	XPDelta         int     `json:"xpDelta"`
	NewConfidence   float64 `json:"newConfidence"`
	Level           int     `json:"level"`
	ReviewAdded     bool    `json:"reviewAdded"`
	ContentVersion  string  `json:"contentVersion"`
	RulesVersion    string  `json:"rulesVersion"`
}
