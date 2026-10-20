package writing

import (
	"errors"
	"math"
	"regexp"
	"strings"
	"time"
	"unicode/utf8"
)

const RulesVersion = "ielts-writing.v1"
const ContentVersion = "2026-10-18.1"
const EvaluatorVersion = "writing-feedback.v1"
const MaxChars = 12000
const Task = "Some people believe that governments should invest more money in public transport than in building new roads. To what extent do you agree or disagree?"
const Disclaimer = "AI practice feedback, not an official IELTS score. No learning XP or overall four-skill band is awarded."

var ErrInput = errors.New("invalid Writing input or version")
var ErrConflict = errors.New("this Writing revision changed; reload the saved version before continuing")
var requestID = regexp.MustCompile(`^[a-zA-Z0-9-]{16,64}$`)
var Criteria = []string{"taskResponse", "coherenceCohesion", "lexicalResource", "grammarRangeAccuracy"}

type Criterion struct {
	Band     *float64 `json:"band"`
	Evidence string   `json:"evidence"`
	Comment  string   `json:"comment"`
}
type Feedback struct {
	Provider         string               `json:"provider"`
	Model            string               `json:"model"`
	EvaluatorVersion string               `json:"evaluatorVersion"`
	RulesVersion     string               `json:"rulesVersion"`
	Overall          *float64             `json:"overall"`
	Criteria         map[string]Criterion `json:"criteria"`
	Strengths        []string             `json:"strengths"`
	Improvements     []string             `json:"improvements"`
	Disclaimer       string               `json:"disclaimer"`
}
type Attempt struct {
	ID             string     `json:"id"`
	RequestID      string     `json:"requestId"`
	ParentID       string     `json:"parentId,omitempty"`
	Revision       int        `json:"revision"`
	Task           string     `json:"task"`
	ContentVersion string     `json:"contentVersion"`
	RulesVersion   string     `json:"rulesVersion"`
	Version        int        `json:"version"`
	Essay          string     `json:"essay"`
	Status         string     `json:"status"`
	Generation     int        `json:"generation"`
	LeaseUntil     *time.Time `json:"leaseUntil,omitempty"`
	Feedback       *Feedback  `json:"feedback,omitempty"`
	Failure        string     `json:"failure,omitempty"`
	CreatedAt      time.Time  `json:"createdAt"`
	UpdatedAt      time.Time  `json:"updatedAt"`
	CompletedAt    *time.Time `json:"completedAt,omitempty"`
}
type StartInput struct {
	RequestID string `json:"requestId"`
	ParentID  string `json:"parentId,omitempty"`
}
type SaveInput struct {
	Version      int    `json:"version"`
	Essay        string `json:"essay"`
	RulesVersion string `json:"rulesVersion"`
}
type SubmitInput struct {
	SaveInput
	Generation int `json:"generation"`
}

func ValidRequest(id string) bool { return requestID.MatchString(id) }
func ValidEssay(s string) bool {
	return utf8.ValidString(s) && utf8.RuneCountInString(s) <= MaxChars && !strings.ContainsRune(s, '\x00')
}
func ValidBand(v *float64) bool {
	return v != nil && !math.IsNaN(*v) && !math.IsInf(*v, 0) && *v >= 0 && *v <= 9 && math.Mod(*v*2, 1) == 0
}
func ValidateFeedback(f Feedback, essay string) error {
	if f.Provider != "configured-llm" || strings.TrimSpace(f.Model) == "" || len(f.Model) > 200 || f.EvaluatorVersion != EvaluatorVersion || f.RulesVersion != RulesVersion || !ValidBand(f.Overall) || len(f.Criteria) != 4 {
		return ErrInput
	}
	total := 0.0
	for _, key := range Criteria {
		c, ok := f.Criteria[key]
		if !ok || !ValidBand(c.Band) || strings.TrimSpace(c.Evidence) == "" || len(c.Evidence) > 4000 || !strings.Contains(essay, c.Evidence) || strings.TrimSpace(c.Comment) == "" || len(c.Comment) > 4000 {
			return ErrInput
		}
		total += *c.Band
	}
	if *f.Overall != math.Floor(total/4*2+0.5)/2 {
		return ErrInput
	}
	for _, lines := range [][]string{f.Strengths, f.Improvements} {
		if len(lines) < 1 || len(lines) > 6 {
			return ErrInput
		}
		for _, line := range lines {
			if strings.TrimSpace(line) == "" || len(line) > 2000 {
				return ErrInput
			}
		}
	}
	return nil
}
