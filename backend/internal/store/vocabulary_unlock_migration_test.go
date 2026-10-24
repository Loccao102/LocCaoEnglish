package store

import (
	"context"
	"database/sql"
	"os"
	"reflect"
	"sync"
	"testing"

	"github.com/Loccao102/LocCaoEnglish/backend/internal/model"
)

// Reproduce the prior binary's store before the new constructor/cutover runs.
func vocabularyOldStore(t *testing.T, databaseURL string) *Store {
	t.Helper()
	if databaseURL == "" {
		return &Store{mem: memoryState{users: map[string]account{}, emails: map[string]string{}, skills: map[string]map[string]model.Skill{}, reviews: map[string]map[string]model.ReviewItem{}}, learningAttempts: map[string]LearningAttemptRecord{}}
	}
	db, err := sql.Open("postgres", databaseURL)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Close() })
	for _, schema := range []string{schemaSQL, learningAttemptSchemaSQL, progressionSchemaSQL} {
		if _, err = db.Exec(schema); err != nil {
			t.Fatal(err)
		}
	}
	return &Store{db: db}
}

func vocabularyLegacyConfidence(t *testing.T, s *Store, owner string, confidence float64) {
	t.Helper()
	if s.db != nil {
		if _, err := s.db.Exec(`UPDATE user_skills SET confidence=$2 WHERE user_id=$1 AND skill='Vocabulary'`, owner, confidence); err != nil {
			t.Fatal(err)
		}
		return
	}
	s.mu.Lock()
	skill := s.mem.skills[owner]["Vocabulary"]
	skill.Confidence = confidence
	s.mem.skills[owner]["Vocabulary"] = skill
	s.mu.Unlock()
}

func vocabularyLegacyPin(t *testing.T, s *Store, owner string) {
	t.Helper()
	if s.db != nil {
		if _, err := s.db.Exec(`INSERT INTO player_loadout(user_id,slot,cosmetic_id)VALUES($1,'badge','wordsmith-pin')`, owner); err != nil {
			t.Fatal(err)
		}
		return
	}
	mem := s.progressionMemory()
	mem.mu.Lock()
	mem.loadout[owner] = map[string]string{"badge": "wordsmith-pin"}
	mem.mu.Unlock()
}

func TestVocabularyLegacyCutoverFreezesPositiveAndNegativeDecisions(t *testing.T) {
	for _, mode := range []string{"memory", "postgres"} {
		t.Run(mode, func(t *testing.T) {
			databaseURL := ""
			if mode == "postgres" {
				databaseURL = vocabularyTestDatabase(t)
			}
			old := vocabularyOldStore(t, databaseURL)
			full, words, negative, pin, xp := vocabularyUser(t, old), vocabularyUser(t, old), vocabularyUser(t, old), vocabularyUser(t, old), vocabularyUser(t, old)
			vocabularyLegacyConfidence(t, old, words.ID, .60)
			for _, u := range []model.User{negative, pin, xp} {
				vocabularyLegacyConfidence(t, old, u.ID, .10)
			}
			vocabularyLegacyPin(t, old, pin.ID)
			if old.db != nil {
				if _, err := old.db.Exec(`UPDATE users SET xp=300 WHERE id=$1`, xp.ID); err != nil {
					t.Fatal(err)
				}
			} else {
				a := old.mem.users[xp.ID]
				a.user.XP = 300
				old.mem.users[xp.ID] = a
				// The old reader and SQL both matched Vocabulary case-insensitively.
				sk := old.mem.skills[full.ID]["Vocabulary"]
				sk.Name = "vOcAbUlArY"
				old.mem.skills[full.ID]["Vocabulary"] = sk
			}
			s := old
			if databaseURL != "" {
				s = vocabularyTestStore(t, databaseURL)
			} else {
				if err := s.EnsureProgression(context.Background()); err != nil {
					t.Fatal(err)
				}
			}
			before := map[string]map[string]model.VocabularyUnlock{}
			for _, test := range []struct {
				owner        string
				words, smith bool
			}{{full.ID, true, true}, {words.ID, true, false}, {negative.ID, false, false}, {pin.ID, true, true}, {xp.ID, true, false}} {
				got, err := s.syncVocabularyUnlocks(context.Background(), test.owner)
				if err != nil {
					t.Fatal(err)
				}
				before[test.owner] = got
				for id, want := range map[string]bool{"word-network": test.words, "wordsmith": test.smith} {
					r := got[id].Receipt
					if (r != nil) != want {
						t.Fatal("legacy snapshot", test, id, got)
					}
					if r != nil && (r.Source != "legacy-personal" || len(r.Evidence) != 0 || r.PersonalXP != nil || r.RecordedAt.IsZero()) {
						t.Fatal("invented legacy proof", r)
					}
				}
			}
			fresh := vocabularyUser(t, s)
			vocabularyLegacyConfidence(t, s, negative.ID, .95)
			vocabularyLegacyConfidence(t, s, full.ID, .05)
			for i := 0; i < 2; i++ {
				if err := s.EnsureProgression(context.Background()); err != nil {
					t.Fatal(err)
				}
			}
			if databaseURL != "" {
				raw, err := os.ReadFile("../../migrations/022_vocabulary_unlock_grants.sql")
				if err != nil {
					t.Fatal(err)
				}
				for i := 0; i < 2; i++ {
					if _, err = s.db.Exec(string(raw)); err != nil {
						t.Fatal(err)
					}
				}
				s = vocabularyTestStore(t, databaseURL)
			}
			for owner, want := range before {
				got, err := s.syncVocabularyUnlocks(context.Background(), owner)
				if err != nil || !reflect.DeepEqual(got, want) {
					t.Fatal("cutover changed after rerun/restart/confidence change", owner, got, want, err)
				}
			}
			if got, err := s.syncVocabularyUnlocks(context.Background(), fresh.ID); err != nil || got["word-network"].Receipt != nil || got["wordsmith"].Receipt != nil {
				t.Fatal("new .74 seed was grandfathered", got, err)
			}
			loadout, err := s.playerLoadout(context.Background(), pin.ID)
			if err != nil || loadout["badge"] != "wordsmith-pin" {
				t.Fatal("legacy equipped pin lost", loadout, err)
			}
		})
	}
}

func TestVocabularyPostgresConcurrentInitializersAndRollback(t *testing.T) {
	t.Run("concurrent constructors on empty schema", func(t *testing.T) {
		databaseURL := vocabularyTestDatabase(t)
		type result struct {
			store *Store
			err   error
		}
		results := make(chan result, 2)
		start := make(chan struct{})
		for i := 0; i < cap(results); i++ {
			go func() {
				<-start
				s, err := New(databaseURL)
				results <- result{s, err}
			}()
		}
		close(start)
		var demo string
		for i := 0; i < cap(results); i++ {
			got := <-results
			if got.err != nil {
				t.Error("concurrent empty-database initialization", got.err)
				continue
			}
			t.Cleanup(got.store.Close)
			if demo != "" && demo != got.store.DemoID() {
				t.Error("initializers created different demo accounts")
			}
			demo = got.store.DemoID()
			var markers, grants, demos int
			if err := got.store.db.QueryRow(`SELECT (SELECT count(*) FROM progression_cutovers),(SELECT count(*) FROM player_unlock_grants),(SELECT count(*) FROM users WHERE email='demo@loccao.local')`).Scan(&markers, &grants, &demos); err != nil {
				t.Fatal(err)
			}
			if markers != 1 || grants != 0 || demos != 1 {
				t.Error("cutover did not precede demo creation", markers, grants, demos)
			}
		}
	})
	t.Run("concurrent constructors", func(t *testing.T) {
		databaseURL := vocabularyTestDatabase(t)
		old := vocabularyOldStore(t, databaseURL)
		u := vocabularyUser(t, old)
		var wg sync.WaitGroup
		stores := make(chan *Store, 2)
		errs := make(chan error, 2)
		for i := 0; i < 2; i++ {
			wg.Add(1)
			go func() {
				defer wg.Done()
				s, err := New(databaseURL)
				if err != nil {
					errs <- err
				} else {
					stores <- s
				}
			}()
		}
		wg.Wait()
		close(stores)
		close(errs)
		for err := range errs {
			t.Error("concurrent initialization", err)
		}
		var expected map[string]model.VocabularyUnlock
		for s := range stores {
			t.Cleanup(s.Close)
			got, err := s.syncVocabularyUnlocks(context.Background(), u.ID)
			if err != nil {
				t.Fatal(err)
			}
			if expected != nil && !reflect.DeepEqual(got, expected) {
				t.Fatal("initializers disagreed", got, expected)
			}
			expected = got
		}
		if expected["word-network"].Receipt == nil || expected["wordsmith"].Receipt == nil {
			t.Fatal("legacy snapshot missing", expected)
		}
		var markers, grants int
		if err := old.db.QueryRow(`SELECT count(*) FROM progression_cutovers`).Scan(&markers); err != nil {
			t.Fatal(err)
		}
		if err := old.db.QueryRow(`SELECT count(*) FROM player_unlock_grants WHERE user_id=$1`, u.ID).Scan(&grants); err != nil {
			t.Fatal(err)
		}
		if markers != 1 || grants != 2 {
			t.Fatal("duplicate/missing cutover", markers, grants)
		}
	})
	t.Run("failed snapshot rolls back marker and all grants", func(t *testing.T) {
		databaseURL := vocabularyTestDatabase(t)
		old := vocabularyOldStore(t, databaseURL)
		u := vocabularyUser(t, old)
		if _, err := old.db.Exec(`CREATE TABLE player_unlock_grants(user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,unlock_id TEXT NOT NULL,receipt JSONB NOT NULL,PRIMARY KEY(user_id,unlock_id),CONSTRAINT fail_test_snapshot CHECK(false))`); err != nil {
			t.Fatal(err)
		}
		if err := old.EnsureProgression(context.Background()); err == nil {
			t.Fatal("failure fixture did not reject cutover")
		}
		var missing bool
		var grants int
		if err := old.db.QueryRow(`SELECT to_regclass('progression_cutovers') IS NULL`).Scan(&missing); err != nil {
			t.Fatal(err)
		}
		if err := old.db.QueryRow(`SELECT count(*) FROM player_unlock_grants`).Scan(&grants); err != nil {
			t.Fatal(err)
		}
		if !missing || grants != 0 {
			t.Fatal("partial cutover survived failed transaction", missing, grants)
		}
		if _, err := old.db.Exec(`ALTER TABLE player_unlock_grants DROP CONSTRAINT fail_test_snapshot`); err != nil {
			t.Fatal(err)
		}
		if err := old.EnsureProgression(context.Background()); err != nil {
			t.Fatal(err)
		}
		got, err := old.syncVocabularyUnlocks(context.Background(), u.ID)
		if err != nil || got["word-network"].Receipt == nil || got["wordsmith"].Receipt == nil {
			t.Fatal("retry failed to preserve old grants", got, err)
		}
	})
}

func TestVocabularyPostgresStandaloneMigrationFirstCutover(t *testing.T) {
	databaseURL := vocabularyTestDatabase(t)
	old := vocabularyOldStore(t, databaseURL)
	u := vocabularyUser(t, old)
	raw, err := os.ReadFile("../../migrations/022_vocabulary_unlock_grants.sql")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := old.db.Exec(string(raw)); err != nil {
		t.Fatal("first standalone migration", err)
	}
	before, err := old.syncVocabularyUnlocks(context.Background(), u.ID)
	if err != nil || before["word-network"].Receipt == nil || before["wordsmith"].Receipt == nil {
		t.Fatal("standalone migration missed old player", before, err)
	}
	fresh := vocabularyUser(t, old)
	for i := 0; i < 2; i++ {
		if _, err := old.db.Exec(string(raw)); err != nil {
			t.Fatal("repeat standalone migration", err)
		}
	}
	if got, err := old.syncVocabularyUnlocks(context.Background(), u.ID); err != nil || !reflect.DeepEqual(got, before) {
		t.Fatal("standalone rerun changed old receipts", got, before, err)
	}
	if got, err := old.syncVocabularyUnlocks(context.Background(), fresh.ID); err != nil || got["word-network"].Receipt != nil || got["wordsmith"].Receipt != nil {
		t.Fatal("standalone rerun grandfathered fresh seed", got, err)
	}
	if err := old.EnsureProgression(context.Background()); err != nil {
		t.Fatal("startup after standalone migration", err)
	}
	if got, err := old.syncVocabularyUnlocks(context.Background(), u.ID); err != nil || !reflect.DeepEqual(got, before) {
		t.Fatal("startup changed standalone receipts", got, before, err)
	}
}
