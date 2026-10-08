package model

import "time"

type LearningAttemptStartInput struct {
	RequestID       string   `json:"requestId"`
	Activity        string   `json:"activity"`
	Pack            string   `json:"pack,omitempty"`
	CEFRLevel       string   `json:"cefrLevel"`
	ExcludeItemKeys []string `json:"excludeItemKeys,omitempty"`
}

type LearningAttemptPrompt struct {
	Title    string          `json:"title,omitempty"`
	Passage  string          `json:"passage,omitempty"`
	Word     string          `json:"word,omitempty"`
	Relation string          `json:"relation,omitempty"`
	Question string          `json:"question,omitempty"`
	Options  []string        `json:"options"`
	Chunks   []SentenceChunk `json:"chunks,omitempty"`
}

type SentenceChunk struct {
	ID   string `json:"id"`
	Text string `json:"text"`
}

type LearningAttemptStart struct {
	Listening      *ListeningEvidence     `json:"listening,omitempty"`
	Story          *StoryRound            `json:"story,omitempty"`
	AttemptID      string                 `json:"attemptId"`
	Activity       string                 `json:"activity"`
	Pack           string                 `json:"pack"`
	ItemKey        string                 `json:"itemKey"`
	CEFRLevel      string                 `json:"cefrLevel"`
	ContentVersion string                 `json:"contentVersion"`
	RulesVersion   string                 `json:"rulesVersion"`
	Status         string                 `json:"status"`
	Prompt         LearningAttemptPrompt  `json:"prompt"`
	Mode           string                 `json:"mode"`
	ExpiresAt      time.Time              `json:"expiresAt"`
	Result         *LearningAttemptResult `json:"result,omitempty"`
}

type LearningAttemptSubmitInput struct {
	Answer         string `json:"answer"`
	ContentVersion string `json:"contentVersion"`
	RulesVersion   string `json:"rulesVersion"`
}

type LearningAttemptResult struct {
	Listening          *ListeningEvidence `json:"listening,omitempty"`
	Story              *StoryOutcome      `json:"story,omitempty"`
	AttemptID          string             `json:"attemptId"`
	Status             string             `json:"status"`
	Correct            bool               `json:"correct"`
	CorrectAnswer      string             `json:"correctAnswer"`
	Feedback           string             `json:"feedback"`
	XPDelta            int                `json:"xpDelta"`
	NewConfidence      float64            `json:"newConfidence"`
	Level              int                `json:"level"`
	ReviewAdded        bool               `json:"reviewAdded"`
	ContentVersion     string             `json:"contentVersion"`
	RulesVersion       string             `json:"rulesVersion"`
	ActualAnswer       string             `json:"actualAnswer"`
	ProgressionApplied bool               `json:"progressionApplied"`
	Evidence           string             `json:"evidence"`
}

// Playback completion is reported by the browser, never proof that a human heard it.
type ListeningPlayback struct {
	RequestID string  `json:"requestId"`
	Rate      float64 `json:"rate"`
	Status    string  `json:"status"`
	Provider  string  `json:"provider,omitempty"`
}
type ListeningEvidence struct {
	Events     []ListeningPlayback `json:"events"`
	Source     string              `json:"source"`
	Transcript string              `json:"transcript,omitempty"`
}

type StoryDecision struct {
	Scene       string `json:"scene"`
	Answer      string `json:"answer"`
	Consequence string `json:"consequence"`
	XP          int    `json:"xp"`
}
type StoryRound struct {
	RunID   string          `json:"runId"`
	Step    int             `json:"step"`
	History []StoryDecision `json:"history"`
}
type StoryOutcome struct {
	Consequence string `json:"consequence"`
	CanContinue bool   `json:"canContinue"`
	Ending      string `json:"ending,omitempty"`
	Title       string `json:"title,omitempty"`
	Text        string `json:"text,omitempty"`
}
