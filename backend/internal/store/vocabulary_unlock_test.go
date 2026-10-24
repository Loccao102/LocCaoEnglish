package store

import (
	"context"
	"database/sql"
	"net/url"
	"os"
	"reflect"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/Loccao102/LocCaoEnglish/backend/internal/model"
	"github.com/lib/pq"
)

// Every PostgreSQL fixture lives in its own schema inside the dedicated test DB.
// A failed cutover test must never drop/reset the normal application's tables.
func vocabularyTestDatabase(t *testing.T) string {
	t.Helper()
	databaseURL := os.Getenv("TEST_DATABASE_URL")
	if databaseURL == "" {
		t.Skip("set TEST_DATABASE_URL for isolated-schema PostgreSQL verification")
	}
	parsed, err := url.Parse(databaseURL)
	if err != nil || (parsed.Scheme != "postgres" && parsed.Scheme != "postgresql") || parsed.Path != "/loccao_system_test" {
		t.Fatal("dedicated loccao_system_test database required")
	}
	admin, err := sql.Open("postgres", databaseURL)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = admin.Close() })
	schema := "vocab_unlock_" + newID()
	if _, err = admin.Exec(`CREATE SCHEMA ` + pq.QuoteIdentifier(schema)); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if _, err := admin.Exec(`DROP SCHEMA ` + pq.QuoteIdentifier(schema) + ` CASCADE`); err != nil {
			t.Error("clean isolated test schema", err)
		}
	})
	query := parsed.Query()
	query.Set("search_path", schema)
	parsed.RawQuery = query.Encode()
	return parsed.String()
}

func vocabularyTestStore(t *testing.T, databaseURL string) *Store {
	t.Helper()
	s, err := New(databaseURL)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(s.Close)
	for _, ensure := range []func(context.Context) error{s.EnsurePlayerProfiles, s.EnsureIELTS, s.EnsureProgression} {
		if err = ensure(context.Background()); err != nil {
			t.Fatal(err)
		}
	}
	return s
}

func vocabularyModes(t *testing.T, run func(*testing.T, *Store, string)) {
	t.Helper()
	t.Run("memory", func(t *testing.T) { run(t, vocabularyTestStore(t, ""), "") })
	t.Run("postgres", func(t *testing.T) {
		databaseURL := vocabularyTestDatabase(t)
		run(t, vocabularyTestStore(t, databaseURL), databaseURL)
	})
}

func vocabularyUser(t *testing.T, s *Store) model.User {
	t.Helper()
	u, err := s.CreateUser(context.Background(), newID()+"@vocabulary.example.test", "hash", "Vocabulary learner")
	if err != nil {
		t.Fatal(err)
	}
	return u
}

func vocabularyState(t *testing.T, s *Store, owner string) map[string]model.VocabularyUnlock {
	t.Helper()
	state, err := s.GetProgression(context.Background(), owner)
	if err != nil {
		t.Fatal(err)
	}
	out := map[string]model.VocabularyUnlock{}
	for _, w := range state.Worlds {
		if w.ID == "words" {
			if w.Unlock == nil || w.Unlocked != (w.Unlock.Receipt != nil) {
				t.Fatal("word world missing/mismatched provenance", w)
			}
			out["word-network"] = *w.Unlock
		}
	}
	for _, a := range state.Achievements {
		if a.ID == "wordsmith" {
			if a.Unlock == nil || a.Unlocked != (a.Unlock.Receipt != nil) {
				t.Fatal("wordsmith achievement missing/mismatched provenance", a)
			}
			out["wordsmith"] = *a.Unlock
		}
	}
	for _, c := range state.Inventory {
		if c.ID == "wordsmith-pin" {
			if c.Unlock == nil || !reflect.DeepEqual(*c.Unlock, out["wordsmith"]) || c.Unlocked != (c.Unlock.Receipt != nil) {
				t.Fatal("pin differs from achievement", c)
			}
		}
	}
	if len(out) != 2 {
		t.Fatal("missing vocabulary milestones", out)
	}
	return out
}

func TestVocabularyUnlockRealPracticeAndImmutableReceipts(t *testing.T) {
	vocabularyModes(t, func(t *testing.T, s *Store, databaseURL string) {
		ctx := context.Background()
		u := vocabularyUser(t, s)
		initial := vocabularyState(t, s, u.ID)
		for _, v := range initial {
			if v.Method != VocabularyUnlockMethod || v.CorrectItems != 0 || v.ActivityCount != 0 || v.Receipt != nil {
				t.Fatal("seed created a grant", v)
			}
		}
		if _, err := s.EquipCosmetic(ctx, u.ID, "wordsmith-pin"); err == nil {
			t.Fatal("new seed equipped Wordsmith")
		}
		if _, err := s.recordLegacyFixture(ctx, u.ID, model.AttemptInput{Skill: "Vocabulary", Activity: "word-link", ItemKey: "legacy", Accuracy: 1}); err != nil {
			t.Fatal(err)
		}
		if vocabularyState(t, s, u.ID)["word-network"].CorrectItems != 0 {
			t.Fatal("legacy attempt counted")
		}
		wrong, _ := campaignRound(t, s, u.ID, "word-link", "first-wrong", "one")
		campaignSubmit(t, s, u.ID, wrong, "sad")
		if vocabularyState(t, s, u.ID)["word-network"].CorrectItems != 0 {
			t.Fatal("wrong answer counted")
		}
		one, answer := campaignRound(t, s, u.ID, "word-link", "correct-capped", "one")
		if r := campaignSubmit(t, s, u.ID, one, answer); r.XPDelta != 0 || !r.Correct {
			t.Fatal("capped correct fixture", r)
		}
		campaignSubmit(t, s, u.ID, one, answer)
		if vocabularyState(t, s, u.ID)["word-network"].CorrectItems != 1 {
			t.Fatal("capped/retry item identity")
		}
		for _, item := range []string{"two", "three"} {
			a, answer := campaignRound(t, s, u.ID, "word-link", item, item)
			campaignSubmit(t, s, u.ID, a, answer)
		}
		words := vocabularyState(t, s, u.ID)["word-network"].Receipt
		if words == nil || words.Source != "checked-practice" || len(words.Evidence) != 3 || words.PersonalXP != nil {
			t.Fatal("three-item grant", words)
		}
		// Seven correct items from one activity cannot earn the diverse milestone.
		for _, item := range []string{"four", "five", "six", "seven", "eight"} {
			a, answer := campaignRound(t, s, u.ID, "word-link", item, item)
			campaignSubmit(t, s, u.ID, a, answer)
		}
		if state := vocabularyState(t, s, u.ID)["wordsmith"]; state.CorrectItems != 7 || state.ActivityCount != 1 || state.Receipt != nil {
			t.Fatal("single activity earned Wordsmith", state)
		}
		a, answer := campaignRound(t, s, u.ID, "collocation-factory", "other-activity", "nine")
		campaignSubmit(t, s, u.ID, a, answer)
		beforeUser, _ := s.GetUser(ctx, u.ID)
		beforeSkills, _ := s.Skills(ctx, u.ID)
		full := vocabularyState(t, s, u.ID)
		smith := full["wordsmith"].Receipt
		if smith == nil || smith.Source != "checked-practice" || len(smith.Evidence) != 7 || full["wordsmith"].ActivityCount != 2 || !reflect.DeepEqual(words, full["word-network"].Receipt) {
			t.Fatal("diverse grant or changed first receipt", full)
		}
		activities := map[string]bool{}
		for _, e := range smith.Evidence {
			activities[e.Activity] = true
			if e.AttemptID == "" || e.CompletedAt.IsZero() {
				t.Fatal("missing proof", e)
			}
		}
		if len(activities) != 2 {
			t.Fatal("proof lost activity after the first seven items", smith)
		}
		// Neither immutable proof nor qualification is revoked by later wrong work.
		later, _ := campaignRound(t, s, u.ID, "word-link", "later-wrong", "one")
		campaignSubmit(t, s, u.ID, later, "sad")
		if got := vocabularyState(t, s, u.ID); !reflect.DeepEqual(got, full) {
			t.Fatal("later answer rewrote milestone", got, full)
		}
		var wg sync.WaitGroup
		for i := 0; i < 8; i++ {
			wg.Add(1)
			go func() {
				defer wg.Done()
				got, err := s.syncVocabularyUnlocks(ctx, u.ID)
				if err != nil || !reflect.DeepEqual(got, full) {
					t.Error("concurrent immutable grant", got, err)
				}
			}()
		}
		wg.Wait()
		for i := 0; i < 2; i++ {
			state, err := s.EquipCosmetic(ctx, u.ID, "wordsmith-pin")
			if err != nil {
				t.Fatal(err)
			}
			found := false
			for _, c := range state.Inventory {
				if c.ID == "wordsmith-pin" {
					found = c.Equipped && reflect.DeepEqual(c.Unlock.Receipt, smith)
				}
			}
			if !found {
				t.Fatal("equipped grant missing", state)
			}
		}
		full["wordsmith"].Receipt.Evidence[0].AttemptID = "caller-mutation"
		if vocabularyState(t, s, u.ID)["wordsmith"].Receipt.Evidence[0].AttemptID == "caller-mutation" {
			t.Fatal("receipt aliases caller")
		}
		afterUser, _ := s.GetUser(ctx, u.ID)
		afterSkills, _ := s.Skills(ctx, u.ID)
		for i := range beforeSkills {
			beforeSkills[i].Practice = nil
		}
		for i := range afterSkills {
			afterSkills[i].Practice = nil
		}
		if !reflect.DeepEqual(beforeUser, afterUser) || !reflect.DeepEqual(beforeSkills, afterSkills) {
			t.Fatal("grant/equip mutated XP or confidence")
		}
		if databaseURL != "" {
			second := vocabularyTestStore(t, databaseURL)
			if !reflect.DeepEqual(vocabularyState(t, s, u.ID), vocabularyState(t, second, u.ID)) {
				t.Fatal("restart changed grant")
			}
		}
	})
}

func TestVocabularyUnlockEvidenceEligibilityAndIdentity(t *testing.T) {
	vocabularyModes(t, func(t *testing.T, s *Store, _ string) {
		u, foreign := vocabularyUser(t, s), vocabularyUser(t, s)
		at := time.Date(2026, 10, 20, 12, 0, 0, 0, time.UTC)
		fixture := func() LearningAttemptRecord {
			id := newID()
			return LearningAttemptRecord{ID: id, UserID: u.ID, Activity: "word-link", Skill: "Vocabulary", ItemKey: id, ContentVersion: "v1", RulesVersion: "word-link.v1", Status: "completed", Correct: true, CompletedAt: at}
		}
		for _, mutate := range []func(*LearningAttemptRecord){
			func(r *LearningAttemptRecord) { r.UserID = foreign.ID }, func(r *LearningAttemptRecord) { r.UserID = "" }, func(r *LearningAttemptRecord) { r.Status = "active" }, func(r *LearningAttemptRecord) { r.Correct = false }, func(r *LearningAttemptRecord) { r.Skill = "Reading" }, func(r *LearningAttemptRecord) { r.ContentVersion = "" }, func(r *LearningAttemptRecord) { r.ItemKey = "" }, func(r *LearningAttemptRecord) { r.CompletedAt = time.Time{} }, func(r *LearningAttemptRecord) { r.RulesVersion = "word-link.v99" }, func(r *LearningAttemptRecord) { r.Activity = "ielts-reading" }, func(r *LearningAttemptRecord) { r.Activity = "pronunciation-assessment" },
		} {
			r := fixture()
			mutate(&r)
			skillPracticeFixture(t, s, r)
		}
		if got := vocabularyState(t, s, u.ID)["word-network"]; got.CorrectItems != 0 || got.Receipt != nil {
			t.Fatal("ineligible evidence counted", got)
		}
		prefix := newID()
		for _, suffix := range []string{"z", "a", "m"} {
			r := fixture()
			r.ID = prefix + suffix
			r.ItemKey = "same-item"
			r.ContentVersion = "version-" + suffix
			skillPracticeFixture(t, s, r)
		}
		later := fixture()
		later.ID, later.ItemKey, later.ContentVersion = "000"+prefix, "same-item", "later-version"
		later.CompletedAt = at.Add(time.Hour)
		skillPracticeFixture(t, s, later)
		got := vocabularyState(t, s, u.ID)["word-network"]
		if got.CorrectItems != 1 {
			t.Fatal("new content version duplicated item", got)
		}
		for _, activity := range []string{"word-graph", "collocation-factory"} {
			r := fixture()
			r.Activity = activity
			r.ItemKey = "same-item"
			r.RulesVersion = checkedPracticeRules[activity]
			skillPracticeFixture(t, s, r)
		}
		got = vocabularyState(t, s, u.ID)["word-network"]
		if got.CorrectItems != 3 || got.ActivityCount != 3 || got.Receipt == nil {
			t.Fatal("activity identity", got)
		}
		found := false
		for _, e := range got.Receipt.Evidence {
			if e.Activity == "word-link" {
				found = e.AttemptID == prefix+"a" && e.ContentVersion == "version-a"
			}
		}
		if !found {
			t.Fatal("first-correct tie did not preserve earliest ID/content proof", got.Receipt)
		}
	})
}

func TestVocabularyUnlockPersonalXPAndPracticePrecedence(t *testing.T) {
	vocabularyModes(t, func(t *testing.T, s *Store, _ string) {
		ctx := context.Background()
		for _, practice := range []bool{false, true} {
			u := vocabularyUser(t, s)
			if practice {
				for _, item := range []string{"a", "b", "c"} {
					a, answer := campaignRound(t, s, u.ID, "word-link", item, item)
					campaignSubmit(t, s, u.ID, a, answer)
				}
			}
			if s.db != nil {
				if _, err := s.db.ExecContext(ctx, `UPDATE users SET xp=300 WHERE id=$1`, u.ID); err != nil {
					t.Fatal(err)
				}
			} else {
				s.mu.Lock()
				a := s.mem.users[u.ID]
				a.user.XP = 300
				s.mem.users[u.ID] = a
				s.mu.Unlock()
			}
			state := vocabularyState(t, s, u.ID)
			receipt := state["word-network"].Receipt
			if receipt == nil || state["wordsmith"].Receipt != nil {
				t.Fatal("XP milestone", state)
			}
			if practice {
				if receipt.Source != "checked-practice" || len(receipt.Evidence) != 3 || receipt.PersonalXP != nil {
					t.Fatal("practice not preferred", receipt)
				}
			} else if receipt.Source != "personal-xp" || receipt.PersonalXP == nil || *receipt.PersonalXP != 300 || len(receipt.Evidence) != 0 {
				t.Fatal("personal XP provenance", receipt)
			}
			if !practice {
				for _, item := range []string{"later-a", "later-b", "later-c"} {
					a, answer := campaignRound(t, s, u.ID, "word-link", item, item)
					campaignSubmit(t, s, u.ID, a, answer)
				}
				if got := vocabularyState(t, s, u.ID)["word-network"]; got.CorrectItems != 3 || !reflect.DeepEqual(got.Receipt, receipt) {
					t.Fatal("later practice rewrote first personal XP receipt", got, receipt)
				}
			}
		}
	})
}

func TestVocabularyUnlockConcurrentFirstGrantAndEquip(t *testing.T) {
	vocabularyModes(t, func(t *testing.T, s *Store, _ string) {
		ctx := context.Background()
		u := vocabularyUser(t, s)
		at := time.Date(2026, 10, 20, 12, 0, 0, 0, time.UTC)
		for i := 0; i < 7; i++ {
			activity := "word-link"
			if i == 6 {
				activity = "collocation-factory"
			}
			id := newID()
			skillPracticeFixture(t, s, LearningAttemptRecord{ID: id, UserID: u.ID, Activity: activity, Skill: "Vocabulary", ItemKey: id, ContentVersion: "v1", RulesVersion: checkedPracticeRules[activity], Status: "completed", Correct: true, CompletedAt: at})
		}
		type result struct {
			state model.ProgressionState
			err   error
		}
		results := make(chan result, 16)
		start := make(chan struct{})
		var wg sync.WaitGroup
		for i := 0; i < cap(results); i++ {
			wg.Add(1)
			go func(equip bool) {
				defer wg.Done()
				<-start
				var got model.ProgressionState
				var err error
				if equip {
					got, err = s.EquipCosmetic(ctx, u.ID, "wordsmith-pin")
				} else {
					got, err = s.GetProgression(ctx, u.ID)
				}
				results <- result{got, err}
			}(i%2 == 0)
		}
		close(start)
		wg.Wait()
		close(results)
		want := vocabularyState(t, s, u.ID)
		for got := range results {
			if got.err != nil {
				t.Fatal("concurrent sync/equip", got.err)
			}
			for _, c := range got.state.Inventory {
				if c.ID == "wordsmith-pin" && (!c.Unlocked || c.Unlock == nil || !reflect.DeepEqual(*c.Unlock, want["wordsmith"])) {
					t.Fatal("first concurrent grant changed proof/time", c, want)
				}
			}
		}
		loadout, err := s.playerLoadout(ctx, u.ID)
		if err != nil || loadout["badge"] != "wordsmith-pin" {
			t.Fatal("concurrent equip was not saved", loadout, err)
		}
		for id, target := range map[string]int{"word-network": 3, "wordsmith": 7} {
			r := want[id].Receipt
			if r == nil || r.Source != "checked-practice" || len(r.Evidence) != target {
				t.Fatal("missing concurrent first grant", want)
			}
		}
	})
}

func TestVocabularyUnlockOutlivesLatestJournalWindow(t *testing.T) {
	vocabularyModes(t, func(t *testing.T, s *Store, _ string) {
		u := vocabularyUser(t, s)
		at := time.Date(2026, 10, 20, 12, 0, 0, 0, time.UTC)
		for i := 0; i < 28; i++ {
			id := newID()
			skillPracticeFixture(t, s, LearningAttemptRecord{ID: id, UserID: u.ID, Activity: "word-link", Skill: "Vocabulary", ItemKey: id, ContentVersion: "v1", RulesVersion: checkedPracticeRules["word-link"], Status: "completed", Correct: i < 3, CompletedAt: at.Add(time.Duration(i) * time.Minute)})
		}
		practice := skillPracticeRead(t, s, u.ID)["Vocabulary"].Practice
		if practice.SampleCount != 20 || practice.CorrectCount != 0 {
			t.Fatal("fixture did not move correct items outside journal", practice)
		}
		got := vocabularyState(t, s, u.ID)["word-network"]
		if got.CorrectItems != 3 || got.Receipt == nil || got.Receipt.Source != "checked-practice" || len(got.Receipt.Evidence) != 3 {
			t.Fatal("latest-20 journal erased cumulative milestone", got)
		}
	})
}

func TestVocabularyPostgresLoadoutFailureRetainsGrant(t *testing.T) {
	databaseURL := vocabularyTestDatabase(t)
	s := vocabularyTestStore(t, databaseURL)
	u := vocabularyUser(t, s)
	for _, item := range []string{"one", "two", "three", "four", "five", "six", "seven"} {
		activity := "word-link"
		if item == "seven" {
			activity = "collocation-factory"
		}
		a, answer := campaignRound(t, s, u.ID, activity, item, item)
		campaignSubmit(t, s, u.ID, a, answer)
	}
	if _, err := s.db.Exec(`ALTER TABLE player_loadout ADD CONSTRAINT reject_test_pin CHECK(cosmetic_id <> 'wordsmith-pin')`); err != nil {
		t.Fatal(err)
	}
	if _, err := s.EquipCosmetic(context.Background(), u.ID, "wordsmith-pin"); err == nil {
		t.Fatal("failed loadout write reported success")
	}
	before := vocabularyState(t, s, u.ID)
	if before["wordsmith"].Receipt == nil {
		t.Fatal("equip failure removed earned grant", before)
	}
	loadout, err := s.playerLoadout(context.Background(), u.ID)
	if err != nil || loadout["badge"] == "wordsmith-pin" {
		t.Fatal("failed equip appeared saved", loadout, err)
	}
	if _, err := s.db.Exec(`ALTER TABLE player_loadout DROP CONSTRAINT reject_test_pin`); err != nil {
		t.Fatal(err)
	}
	if _, err := s.EquipCosmetic(context.Background(), u.ID, "wordsmith-pin"); err != nil {
		t.Fatal("retry equip", err)
	}
	if got := vocabularyState(t, s, u.ID); !reflect.DeepEqual(got, before) {
		t.Fatal("equip retry rewrote grant", got, before)
	}
}

func TestVocabularyMigrationMatchesStartupSQL(t *testing.T) {
	raw, err := os.ReadFile("../../migrations/022_vocabulary_unlock_grants.sql")
	if err != nil {
		t.Fatal(err)
	}
	if strings.TrimSpace(strings.ReplaceAll(string(raw), "\r\n", "\n")) != "BEGIN;\n"+strings.TrimSpace(vocabularyUnlockSchemaSQL)+"\nCOMMIT;" {
		t.Fatal("migration 022 and startup SQL differ")
	}
}
