package evaluation

import (
	"testing"
	"time"
)

func TestGenerationFencesAndLease(t *testing.T) {
	now := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	s, ok, err := Claim(State{Status: "ready"}, 0, now)
	if err != nil || !ok || s.Generation != 1 || s.LeaseUntil.Sub(now) != 90*time.Second {
		t.Fatal(s, ok, err)
	}
	for _, expected := range []int{0, 1} {
		if _, ok, e := Claim(s, expected, now); e != nil || ok {
			t.Fatal("duplicate provider claim", expected, e)
		}
	}
	if _, _, e := Claim(s, 2, now); e == nil {
		t.Fatal("future generation accepted")
	}
	newer, ok, e := Claim(s, 1, now.Add(90*time.Second))
	if e != nil || !ok || newer.Generation != 2 {
		t.Fatal("expired recovery", newer, e)
	}
	if CanFinish(newer, 1) || !CanFinish(newer, 2) {
		t.Fatal("late completion overwrites new generation")
	}
	newer.Status = "completed"
	if _, ok, e := Claim(newer, 2, now); ok || e != nil {
		t.Fatal("completed request evaluated again")
	}
	newer.Status = "failed"
	if _, ok, e := Claim(newer, 1, now); ok || e != nil {
		t.Fatal("old retry starts failed request")
	}
	if _, ok, e := Claim(newer, 2, now); !ok || e != nil {
		t.Fatal("explicit retry rejected")
	}
}
