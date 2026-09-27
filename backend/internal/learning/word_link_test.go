package learning

import (
	"encoding/json"
	"errors"
	"strings"
	"testing"
	"time"
)

func TestCatalogAndPublicAttempt(t *testing.T) {
	seen := map[string]bool{}
	for _, p := range packs {
		for i, q := range p.Questions {
			if seen[q.ID] || q.ID == "" || q.Note == "" {
				t.Fatal("invalid catalog identity")
			}
			seen[q.ID] = true
			options := map[string]bool{}
			for _, option := range q.Options {
				if options[option] {
					t.Fatal("duplicate choice")
				}
				options[option] = true
			}
			if !options[q.Answer] || len(options) < 3 {
				t.Fatal("unanswerable question")
			}
			a, err := New(Create{"12345678-1234-4123-8123-123456789012", p.ID, i}, true, time.Now())
			if err != nil {
				t.Fatal(err)
			}
			public, _ := json.Marshal(a.View)
			if strings.Contains(string(public), `"answer"`) || strings.Contains(string(public), `"note"`) {
				t.Fatal("answer key leaked")
			}
			for _, choice := range a.View.Choices {
				v, err := a.Grade(Submission{choice.ID, a.View.ContentVersion, 1}, time.Now())
				if err != nil || v.Correct != (choice.Label == q.Answer) || v.ActualAnswer != choice.Label || v.Assisted || v.XPDelta != 0 {
					t.Fatalf("bad grade: %+v %v", v, err)
				}
			}
		}
	}
}
func TestInvalidAndExpiredAttempts(t *testing.T) {
	in := Create{"12345678-1234-4123-8123-123456789012", "default", 0}
	now := time.Now()
	a, _ := New(in, false, now)
	for _, bad := range []Submission{{"unknown", 1, 1}, {a.View.Choices[0].ID, 2, 1}, {a.View.Choices[0].ID, 1, 99}} {
		if _, err := a.Grade(bad, now); !errors.Is(err, ErrInvalid) {
			t.Fatal("invalid grade accepted")
		}
	}
	if _, err := a.Grade(Submission{a.View.Choices[0].ID, 1, 1}, now.Add(24*time.Hour)); !errors.Is(err, ErrExpired) {
		t.Fatal("expired accepted")
	}
	in.Round = 99
	if _, err := New(in, true, now); !errors.Is(err, ErrInvalid) {
		t.Fatal("invalid round accepted")
	}
}
