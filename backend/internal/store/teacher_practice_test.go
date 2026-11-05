package store

import (
	"context"
	"reflect"
	"testing"
	"time"

	"github.com/Loccao102/LocCaoEnglish/backend/internal/model"
)

func teacherPracticeSkill(t *testing.T, got model.TeacherPracticeAnalytics, name string) model.TeacherPracticeSkillAnalytics {
	t.Helper()
	for _, skill := range got.Skills {
		if skill.Skill == name {
			return skill
		}
	}
	t.Fatalf("missing practice skill %q in %#v", name, got.Skills)
	return model.TeacherPracticeSkillAnalytics{}
}

// Fixed, isolated time windows avoid depending on wall-clock speed or other
// tests' completed rows in the shared, dedicated PostgreSQL test database.
func teacherPracticeAt(t *testing.T, s *Store, end time.Time) model.TeacherPracticeAnalytics {
	t.Helper()
	start := end.Add(-7 * 24 * time.Hour)
	if s.db == nil {
		return s.teacherPracticeMemory(start, end)
	}
	result, err := teacherPracticeSQL(context.Background(), s.db, start, end)
	if err != nil {
		t.Fatal(err)
	}
	return result
}

func TestTeacherPracticeEligibilityWindowAndRetryMemoryAndPostgres(t *testing.T) {
	skillPracticeStores(t, func(t *testing.T, s *Store, _ string) {
		ctx := context.Background()
		owner, other := skillPracticeUser(t, s), skillPracticeUser(t, s)
		now := time.Date(2050, time.November, 5, 12, 0, 0, 0, time.UTC)
		fixture := func(userID, activity, skill string, correct bool, completedAt time.Time) LearningAttemptRecord {
			return LearningAttemptRecord{
				ID: newID(), UserID: userID, Activity: activity, Skill: skill,
				ItemKey: newID(), ContentVersion: "teacher-content.v1", RulesVersion: checkedPracticeRules[activity],
				Status: "completed", Correct: correct, CompletedAt: completedAt,
			}
		}

		// Both verdicts and distinct learners are practice evidence. A transcript
		// match remains separately labelled from guided practice.
		skillPracticeFixture(t, s, fixture(owner.ID, "word-link", "Vocabulary", true, now))
		skillPracticeFixture(t, s, fixture(other.ID, "word-link", "Vocabulary", false, now.Add(-2*time.Hour)))
		skillPracticeFixture(t, s, fixture(owner.ID, "shadowing", "Speaking", true, now.Add(-time.Hour)))
		// Shared Story Choice is checked guided Reading practice. Adventure
		// chapter clears are a different source and remain excluded below.
		skillPracticeFixture(t, s, fixture(owner.ID, "story-choice", "Reading", true, now.Add(-time.Hour)))

		// The lower boundary is inclusive; an older and a future receipt are not.
		boundary := fixture(owner.ID, "grammar-repair", "Grammar", true, now.Add(-7*24*time.Hour))
		skillPracticeFixture(t, s, boundary)
		old := fixture(owner.ID, "word-link", "Vocabulary", true, now.Add(-7*24*time.Hour-time.Second))
		skillPracticeFixture(t, s, old)
		future := fixture(owner.ID, "word-link", "Vocabulary", true, now.Add(time.Second))
		skillPracticeFixture(t, s, future)

		// Malformed, legacy, personal-story, IELTS, and demo rows are excluded.
		invalid := []LearningAttemptRecord{
			fixture(owner.ID, "word-link", "Vocabulary", true, now),
			fixture(owner.ID, "word-link", "Vocabulary", true, now),
			fixture(owner.ID, "story", "Reading", true, now),
			fixture(owner.ID, "ielts-reading", "Reading", true, now),
			fixture(owner.ID, "unknown", "Vocabulary", true, now),
		}
		invalid[0].Status, invalid[1].ContentVersion = "active", ""
		for _, change := range []func(*LearningAttemptRecord){
			func(r *LearningAttemptRecord) { r.RulesVersion = "unsupported.v99" },
			func(r *LearningAttemptRecord) { r.Skill = "Writing" },
			func(r *LearningAttemptRecord) { r.ItemKey = "" },
			func(r *LearningAttemptRecord) { r.UserID = "" },
			func(r *LearningAttemptRecord) { r.CompletedAt = time.Time{} },
		} {
			row := fixture(owner.ID, "word-link", "Vocabulary", true, now)
			change(&row)
			invalid = append(invalid, row)
		}
		for _, row := range invalid {
			skillPracticeFixture(t, s, row)
		}
		demo := fixture(s.demoID, "word-link", "Vocabulary", true, now)
		skillPracticeFixture(t, s, demo)
		if s.db != nil {
			t.Cleanup(func() { _, _ = s.db.ExecContext(ctx, `DELETE FROM learning_attempts WHERE id=$1`, demo.ID) })
		}

		before, err := s.GetUser(ctx, owner.ID)
		if err != nil {
			t.Fatal(err)
		}
		got := teacherPracticeAt(t, s, now)
		after, err := s.GetUser(ctx, owner.ID)
		if err != nil {
			t.Fatal(err)
		}
		if !reflect.DeepEqual(before, after) {
			t.Fatal("analytics projection mutated learner state")
		}
		if got.WindowDays != 7 || got.Attempts7d != 5 || got.Correct7d != 4 || got.Active7d != 2 {
			t.Fatalf("unexpected totals: %#v", got)
		}
		vocabulary := teacherPracticeSkill(t, got, "Vocabulary")
		if vocabulary.Attempts != 2 || vocabulary.Correct != 1 || vocabulary.Learners != 2 || vocabulary.EvidenceKind != "guided-practice" {
			t.Fatalf("unexpected vocabulary projection: %#v", vocabulary)
		}
		grammar := teacherPracticeSkill(t, got, "Grammar")
		if grammar.Attempts != 1 || grammar.Correct != 1 || grammar.Learners != 1 {
			t.Fatalf("unexpected boundary projection: %#v", grammar)
		}
		speaking := teacherPracticeSkill(t, got, "Speaking")
		if speaking.Attempts != 1 || speaking.Correct != 1 || speaking.Learners != 1 || speaking.EvidenceKind != "transcript-match" {
			t.Fatalf("unexpected transcript projection: %#v", speaking)
		}
		reading := teacherPracticeSkill(t, got, "Reading")
		if reading.Attempts != 1 || reading.Correct != 1 || reading.EvidenceKind != "guided-practice" {
			t.Fatalf("shared Story Choice was confused with Adventure rewards: %#v", reading)
		}

		// Retrying the same server attempt is idempotent: it must remain one row
		// in the projection even though SubmitLearningAttempt is called twice.
		baseline, err := s.TeacherPractice(ctx)
		if err != nil {
			t.Fatal(err)
		}
		attempt, answer := campaignRound(t, s, owner.ID, "word-link", "teacher-retry", "teacher-retry-item")
		campaignSubmit(t, s, owner.ID, attempt, answer)
		campaignSubmit(t, s, owner.ID, attempt, answer)
		got, err = s.TeacherPractice(ctx)
		if err != nil {
			t.Fatal(err)
		}
		if got.Attempts7d != baseline.Attempts7d+1 || got.Correct7d != baseline.Correct7d+1 || got.Active7d != baseline.Active7d+1 {
			t.Fatalf("retry was double-counted: before=%#v after=%#v", baseline, got)
		}
		replay, replayAnswer := campaignRound(t, s, owner.ID, "word-link", "teacher-fresh-replay", "teacher-retry-item")
		if result := campaignSubmit(t, s, owner.ID, replay, replayAnswer); result.XPDelta != 0 {
			t.Fatal("same-day replay fixture must be capped", result)
		}
		got, err = s.TeacherPractice(ctx)
		if err != nil || got.Attempts7d != baseline.Attempts7d+2 || got.Correct7d != baseline.Correct7d+2 || got.Active7d != baseline.Active7d+1 {
			t.Fatalf("fresh capped replay is practice: after=%#v error=%v", got, err)
		}
	})
}

func TestTeacherPracticeZeroMemoryAndPostgres(t *testing.T) {
	skillPracticeStores(t, func(t *testing.T, s *Store, _ string) {
		skillPracticeUser(t, s)
		got := teacherPracticeAt(t, s, time.Date(1900, time.January, 1, 0, 0, 0, 0, time.UTC))
		if got.WindowDays != 7 || got.Attempts7d != 0 || got.Correct7d != 0 || got.Active7d != 0 || len(got.Skills) != 0 {
			t.Fatalf("zero projection is not empty: %#v", got)
		}
	})
}
