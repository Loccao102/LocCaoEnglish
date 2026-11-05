package main

import (
	"bytes"
	"context"
	"errors"
	"strings"
	"testing"
)

type fakeRoles struct {
	userID, role string
	calls        int
	closed       bool
	failure      error
}

func (f *fakeRoles) SetUserRole(ctx context.Context, userID, role string) error {
	if _, ok := ctx.Deadline(); !ok {
		return errors.New("missing operator timeout")
	}
	f.userID, f.role = userID, role
	f.calls++
	return f.failure
}
func (f *fakeRoles) Close() { f.closed = true }

func TestRoleCommandRejectsUnsafeInvocationBeforeOpeningDatabase(t *testing.T) {
	for _, tc := range []struct {
		name, databaseURL string
		args              []string
	}{
		{"missing database", "", []string{"--user-id", "owner", "--role", "teacher"}},
		{"missing ID", "postgres://configured", []string{"--role", "admin"}},
		{"padded ID", "postgres://configured", []string{"--user-id", " owner", "--role", "admin"}},
		{"invalid role", "postgres://configured", []string{"--user-id", "owner", "--role", "superuser"}},
		{"email selector", "postgres://configured", []string{"--email", "someone@example.test", "--role", "admin"}},
		{"unexpected argument", "postgres://configured", []string{"--user-id", "owner", "--role", "teacher", "secret"}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			var output bytes.Buffer
			err := run(tc.args, tc.databaseURL, &output, func(string) (roleStore, error) {
				t.Fatal("invalid invocation opened the database")
				return nil, nil
			})
			if err == nil || output.Len() != 0 {
				t.Fatal("invalid invocation reported success")
			}
		})
	}
}

func TestRoleCommandAssignsExactIDAndAlwaysCloses(t *testing.T) {
	for _, role := range []string{"learner", "teacher", "admin"} {
		t.Run(role, func(t *testing.T) {
			st := &fakeRoles{}
			var output bytes.Buffer
			err := run([]string{"--user-id", "verified-account", "--role", role}, "postgres://configured", &output, func(databaseURL string) (roleStore, error) {
				if databaseURL != "postgres://configured" {
					t.Fatal("database configuration changed")
				}
				return st, nil
			})
			if err != nil || st.calls != 1 || st.userID != "verified-account" || st.role != role || !st.closed {
				t.Fatalf("assignment failed: %v %+v", err, st)
			}
			if output.String() != "Account verified-account now has role "+role+".\n" {
				t.Fatal("missing exact confirmation")
			}
		})
	}
}

func TestRoleCommandDoesNotExposeDatabaseFailuresOrClaimSuccess(t *testing.T) {
	for _, opening := range []bool{true, false} {
		st := &fakeRoles{failure: errors.New("credential-secret")}
		var output bytes.Buffer
		err := run([]string{"--user-id", "verified-account", "--role", "teacher"}, "postgres://credential-secret", &output, func(string) (roleStore, error) {
			if opening {
				return nil, errors.New("credential-secret")
			}
			return st, nil
		})
		if err == nil || strings.Contains(err.Error(), "credential-secret") || output.Len() != 0 {
			t.Fatal("failure disclosed credentials or claimed success")
		}
		if !opening && !st.closed {
			t.Fatal("failed assignment did not close the database")
		}
	}
}
