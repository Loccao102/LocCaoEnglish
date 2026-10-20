// Package evaluation owns the short, generation-fenced provider lease policy.
// Callers bind immutable domain inputs and hold their own row lock around Claim.
package evaluation

import (
	"errors"
	"regexp"
	"time"
)

var ErrConflict = errors.New("evaluation generation conflicts with the saved request")
var requestID = regexp.MustCompile(`^[a-zA-Z0-9-]{16,64}$`)

func ValidRequestID(s string) bool { return requestID.MatchString(s) }

type State struct {
	Status     string
	Generation int
	LeaseUntil *time.Time
}

func Claim(s State, expected int, now time.Time) (State, bool, error) {
	if expected < 0 || expected > s.Generation {
		return s, false, ErrConflict
	}
	if expected < s.Generation || s.Status == "completed" || s.Status == "evaluating" && s.LeaseUntil != nil && now.Before(*s.LeaseUntil) {
		return s, false, nil
	}
	if s.Status != "draft" && s.Status != "ready" && s.Status != "failed" && s.Status != "evaluating" {
		return s, false, ErrConflict
	}
	lease := now.Add(90 * time.Second)
	s.Status = "evaluating"
	s.Generation++
	s.LeaseUntil = &lease
	return s, true, nil
}
func CanFinish(s State, generation int) bool {
	return s.Status == "evaluating" && generation == s.Generation
}
