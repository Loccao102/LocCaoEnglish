package store

import (
	"context"
	"errors"
	"fmt"
	"net/url"
	"os"
	"sync"
	"testing"
)

func TestSEC002RolesUsePersistedAssignmentsOnly(t *testing.T) {
	bootstrapEmail := fmt.Sprintf("bootstrap-teacher-%s@example.test", newID())
	t.Setenv("TEACHER_EMAILS", bootstrapEmail)
	t.Setenv("ADMIN_EMAILS", bootstrapEmail)

	stores := map[string]string{"memory": ""}
	if databaseURL := os.Getenv("TEST_DATABASE_URL"); databaseURL != "" {
		parsed, err := url.Parse(databaseURL)
		if err != nil || (parsed.Scheme != "postgres" && parsed.Scheme != "postgresql") || parsed.Path != "/loccao_system_test" {
			t.Fatal("use the dedicated loccao_system_test database")
		}
		stores["postgres"] = databaseURL
	}

	for mode, databaseURL := range stores {
		t.Run(mode, func(t *testing.T) {
			ctx := context.Background()
			st, err := New(databaseURL)
			if err != nil {
				t.Fatal(err)
			}
			t.Cleanup(st.Close)
			if st.db != nil {
				st.db.SetMaxOpenConns(8)
			}

			var ownedIDs []string
			t.Cleanup(func() {
				if st.db == nil {
					return
				}
				for _, id := range ownedIDs {
					if _, err := st.db.ExecContext(ctx, `DELETE FROM users WHERE id=$1`, id); err != nil {
						t.Error(err)
					}
				}
			})

			create := func(email string) string {
				u, err := st.CreateUser(ctx, email, "test-password-hash", "SEC-002 role fixture")
				if err != nil {
					t.Fatal(err)
				}
				ownedIDs = append(ownedIDs, u.ID)
				return u.ID
			}

			bootstrapID := create(bootstrapEmail)
			teacherID := create(fmt.Sprintf("explicit-teacher-%s@example.test", bootstrapID))
			adminID := create(fmt.Sprintf("explicit-admin-%s@example.test", bootstrapID))
			raceID := create(fmt.Sprintf("race-%s@example.test", bootstrapID))

			if role, err := st.RoleForUser(ctx, bootstrapID); err != nil || role != "learner" {
				t.Fatalf("configured email must not elevate a new account: role=%q err=%v", role, err)
			}
			for _, role := range []string{"teacher", "learner"} {
				if err := st.SetUserRole(ctx, bootstrapID, role); err != nil {
					t.Fatal(err)
				}
				if got, err := st.RoleForUser(ctx, bootstrapID); err != nil || got != role {
					t.Fatalf("obsolete configured email overrode operator role %q: got=%q err=%v", role, got, err)
				}
			}
			if err := st.SetUserRole(ctx, teacherID, "teacher"); err != nil {
				t.Fatal(err)
			}
			if role, err := st.RoleForUser(ctx, teacherID); err != nil || role != "teacher" {
				t.Fatalf("persisted teacher assignment was not returned: role=%q err=%v", role, err)
			}
			if err := st.SetUserRole(ctx, teacherID, "learner"); err != nil {
				t.Fatal(err)
			}
			if role, err := st.RoleForUser(ctx, teacherID); err != nil || role != "learner" {
				t.Fatalf("explicit learner demotion was not durable: role=%q err=%v", role, err)
			}
			if err := st.SetUserRole(ctx, adminID, "admin"); err != nil {
				t.Fatal(err)
			}
			if role, err := st.RoleForUser(ctx, adminID); err != nil || role != "admin" {
				t.Fatalf("persisted admin assignment was not returned: role=%q err=%v", role, err)
			}

			if err := st.SetUserRole(ctx, "missing-sec002-user", "teacher"); !errors.Is(err, ErrNotFound) {
				t.Fatalf("unknown user assignment error = %v, want ErrNotFound", err)
			}
			if err := st.SetUserRole(ctx, adminID, "owner"); err == nil {
				t.Fatal("invalid role was accepted")
			}
			if _, err := st.RoleForUser(ctx, "missing-sec002-user"); !errors.Is(err, ErrNotFound) {
				t.Fatalf("unknown user role lookup error = %v, want ErrNotFound", err)
			}

			concurrentRoleReads(t, st, ctx, bootstrapID, "learner")
			concurrentRoleReads(t, st, ctx, adminID, "admin")
			concurrentRoleGrantAndReads(t, st, ctx, raceID)

			if st.db != nil {
				reopened, err := New(databaseURL)
				if err != nil {
					t.Fatal(err)
				}
				t.Cleanup(reopened.Close)
				if role, err := reopened.RoleForUser(ctx, adminID); err != nil || role != "admin" {
					t.Fatalf("admin role did not survive store restart: role=%q err=%v", role, err)
				}
				if role, err := reopened.RoleForUser(ctx, teacherID); err != nil || role != "learner" {
					t.Fatalf("learner demotion did not survive store restart: role=%q err=%v", role, err)
				}
				if role, err := reopened.RoleForUser(ctx, raceID); err != nil || role != "teacher" {
					t.Fatalf("concurrent teacher assignment did not survive store restart: role=%q err=%v", role, err)
				}
			}
		})
	}
}

func concurrentRoleReads(t *testing.T, st *Store, ctx context.Context, userID, want string) {
	t.Helper()
	const readers = 24
	start := make(chan struct{})
	errs := make(chan error, readers)
	var group sync.WaitGroup
	group.Add(readers)
	for i := 0; i < readers; i++ {
		go func() {
			defer group.Done()
			<-start
			role, err := st.RoleForUser(ctx, userID)
			if err != nil {
				errs <- err
				return
			}
			if role != want {
				errs <- fmt.Errorf("concurrent role read = %q, want %q", role, want)
			}
		}()
	}
	close(start)
	group.Wait()
	close(errs)
	for err := range errs {
		t.Error(err)
	}
}

func concurrentRoleGrantAndReads(t *testing.T, st *Store, ctx context.Context, userID string) {
	t.Helper()
	const readers = 24
	start := make(chan struct{})
	errs := make(chan error, readers+1)
	var group sync.WaitGroup
	group.Add(readers + 1)
	go func() {
		defer group.Done()
		<-start
		if err := st.SetUserRole(ctx, userID, "teacher"); err != nil {
			errs <- fmt.Errorf("concurrent operator assignment: %w", err)
		}
	}()
	for i := 0; i < readers; i++ {
		go func() {
			defer group.Done()
			<-start
			role, err := st.RoleForUser(ctx, userID)
			if err != nil {
				errs <- err
				return
			}
			if role != "learner" && role != "teacher" {
				errs <- fmt.Errorf("concurrent first role read = %q, want learner or teacher", role)
			}
		}()
	}
	close(start)
	group.Wait()
	close(errs)
	for err := range errs {
		t.Error(err)
	}
	if role, err := st.RoleForUser(ctx, userID); err != nil || role != "teacher" {
		t.Fatalf("final explicit assignment after concurrent first read = %q, want teacher (err=%v)", role, err)
	}
}
