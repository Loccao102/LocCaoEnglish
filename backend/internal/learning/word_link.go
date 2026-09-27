// Package learning owns server-issued learning attempts and their grading rules.
package learning

import (
	"crypto/rand"
	_ "embed"
	"encoding/hex"
	"encoding/json"
	"errors"
	"math/big"
	"regexp"
	"time"
)

//go:embed word_link.json
var catalogJSON []byte

var ErrInvalid = errors.New("invalid learning attempt")
var ErrConflict = errors.New("this attempt already has a different submission")
var ErrExpired = errors.New("this attempt expired; start a new round")
var requestPattern = regexp.MustCompile(`^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$`)

type Question struct {
	ID       string   `json:"id"`
	Word     string   `json:"word"`
	Relation string   `json:"relation"`
	Answer   string   `json:"answer"`
	Options  []string `json:"options"`
	Note     string   `json:"note"`
}
type Pack struct {
	ID        string     `json:"id"`
	Label     string     `json:"label"`
	Version   int        `json:"version"`
	Questions []Question `json:"questions"`
}

var packs = func() map[string]Pack {
	var list []Pack
	if err := json.Unmarshal(catalogJSON, &list); err != nil {
		panic(err)
	}
	result := map[string]Pack{}
	for _, p := range list {
		result[p.ID] = p
	}
	return result
}()

type Create struct {
	RequestID string `json:"requestId"`
	Pack      string `json:"pack"`
	Round     int    `json:"round"`
}
type Choice struct {
	ID    string `json:"id"`
	Label string `json:"label"`
}
type Submission struct {
	ChoiceID       string `json:"choiceId"`
	ContentVersion int    `json:"contentVersion"`
	RulesVersion   int    `json:"rulesVersion"`
}
type Verdict struct {
	Correct            bool      `json:"correct"`
	ActualAnswer       string    `json:"actualAnswer"`
	CorrectAnswer      string    `json:"correctAnswer"`
	Note               string    `json:"note"`
	XPDelta            int       `json:"xpDelta"`
	ReviewAdded        bool      `json:"reviewAdded"`
	ProgressionApplied bool      `json:"progressionApplied"`
	Evidence           string    `json:"evidence"`
	Assisted           bool      `json:"assisted"`
	SubmittedAt        time.Time `json:"submittedAt"`
}

// View never includes answer keys before a result is committed.
type View struct {
	ID             string    `json:"id"`
	ContentID      string    `json:"contentId"`
	ContentVersion int       `json:"contentVersion"`
	RulesVersion   int       `json:"rulesVersion"`
	Pack           string    `json:"pack"`
	Label          string    `json:"label"`
	Round          int       `json:"round"`
	Total          int       `json:"total"`
	Word           string    `json:"word"`
	Prompt         string    `json:"prompt"`
	Choices        []Choice  `json:"choices"`
	Mode           string    `json:"mode"`
	ExpiresAt      time.Time `json:"expiresAt"`
	Result         *Verdict  `json:"result,omitempty"`
}
type Attempt struct {
	View      View      `json:"view"`
	Question  Question  `json:"question"`
	CreatedAt time.Time `json:"createdAt"`
}

func ValidCreate(in Create) bool {
	p, ok := packs[in.Pack]
	return requestPattern.MatchString(in.RequestID) && ok && in.Round >= 0 && in.Round < len(p.Questions)
}
func RandomID() (string, error) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}
func New(in Create, account bool, now time.Time) (Attempt, error) {
	if !ValidCreate(in) {
		return Attempt{}, ErrInvalid
	}
	p := packs[in.Pack]
	q := p.Questions[in.Round]
	id, err := RandomID()
	if err != nil {
		return Attempt{}, err
	}
	choices := make([]Choice, len(q.Options))
	for i, label := range q.Options {
		key, err := RandomID()
		if err != nil {
			return Attempt{}, err
		}
		choices[i] = Choice{key, label}
	}
	for i := len(choices) - 1; i > 0; i-- {
		n, err := rand.Int(rand.Reader, big.NewInt(int64(i+1)))
		if err != nil {
			return Attempt{}, err
		}
		j := int(n.Int64())
		choices[i], choices[j] = choices[j], choices[i]
	}
	mode := "guest"
	if account {
		mode = "account"
	}
	return Attempt{View: View{ID: id, ContentID: q.ID, ContentVersion: p.Version, RulesVersion: 1, Pack: p.ID, Label: p.Label, Round: in.Round, Total: len(p.Questions), Word: q.Word, Prompt: q.Relation, Choices: choices, Mode: mode, ExpiresAt: now.Add(24 * time.Hour)}, Question: q, CreatedAt: now}, nil
}
func (a Attempt) Grade(in Submission, now time.Time) (Verdict, error) {
	if in.ContentVersion != a.View.ContentVersion || in.RulesVersion != a.View.RulesVersion || a.View.RulesVersion != 1 {
		return Verdict{}, ErrInvalid
	}
	if !now.Before(a.View.ExpiresAt) {
		return Verdict{}, ErrExpired
	}
	for _, choice := range a.View.Choices {
		if choice.ID == in.ChoiceID {
			return Verdict{Correct: choice.Label == a.Question.Answer, ActualAnswer: choice.Label, CorrectAnswer: a.Question.Answer, Note: a.Question.Note, Evidence: "server-objective", SubmittedAt: now.UTC()}, nil
		}
	}
	return Verdict{}, ErrInvalid
}
