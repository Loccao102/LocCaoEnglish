package auth

import (
	"testing"
	"time"
)

func TestPasswordAndTokenRoundTrip(t *testing.T) {
	hash, err := HashPassword("correct-horse-battery")
	if err != nil { t.Fatal(err) }
	if !VerifyPassword(hash, "correct-horse-battery") { t.Fatal("expected password to verify") }
	if VerifyPassword(hash, "wrong-password") { t.Fatal("wrong password must not verify") }

	svc := New("test-secret", time.Hour)
	token, err := svc.Issue("learner-1")
	if err != nil { t.Fatal(err) }
	id, err := svc.Parse(token)
	if err != nil { t.Fatal(err) }
	if id != "learner-1" { t.Fatalf("unexpected subject %q", id) }
}
