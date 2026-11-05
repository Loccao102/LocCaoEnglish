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

func TestTeacherPracticeEligibilityWindowAndRetryMemoryAndPostgres(t *testing.T) {
	skillPracticeStores(t, func(t *testing.T, s *Store, _ string) {
		ctx := context.Background()
		owner, other := skillPracticeUser(t, s), skillPracticeUser(t, s)
		now := time.Now().UTC()
		fixture := func(userID, activity, skill string, correct bool, completedAt time.Time) LearningAttemptRecord {
			return LearningAttemptRecord{
				ID: newID(), UserID: userID, Activity: activity, Skill: skill,
				ItemKey: newID(), ContentVersion: "teacher-content.v1", RulesVersion: checkedPracticeRules[activity],
				Status: "completed", Correct: correct, CompletedAt: completedAt,
			}
		}

		// Both verdicts and distinct learners are practice evidence. A transcript
		// match remains separately labelled from guided practice.
		skillPracticeFixture(t, s, fixture(owner.ID, "word-link", "Vocabulary", true, now.Add(-time.Hour)))
		skillPracticeFixture(t, s, fixture(other.ID, "word-link", "Vocabulary", false, now.Add(-2*time.Hour)))
		skillPracticeFixture(t, s, fixture(owner.ID, "shadowing", "Speaking", true, now.Add(-time.Hour)))

		// The lower boundary is inclusive; an older and a future receipt are not.
		boundary := fixture(owner.ID, "grammar-repair", "Grammar", true, now.Add(-7*24*time.Hour+2*time.Second))
		skillPracticeFixture(t, s, boundary)
		old := fixture(owner.ID, "word-link", "Vocabulary", true, now.Add(-7*24*time.Hour-2*time.Second))
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
		for _, row := range invalid {
			skillPracticeFixture(t, s, row)
		}
		demo := fixture(s.demoID, "word-link", "Vocabulary", true, now)
		skillPracticeFixture(t, s, demo)

		before, err := s.GetUser(ctx, owner.ID)
		if err != nil {
			t.Fatal(err)
		}
		got, err := s.TeacherPractice(ctx)
		if err != nil {
			t.Fatal(err)
		}
		after, err := s.GetUser(ctx, owner.ID)
		if err != nil {
			t.Fatal(err)
		}
		if !reflect.DeepEqual(before, after) {
			t.Fatal("analytics projection mutated learner state")
		}
		if got.WindowDays != 7 || got.Attempts7d != 4 || got.Correct7d != 3 || got.Active7d != 2 {
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

		// Retrying the same server attempt is idempotent: it must remain one row
		// in the projection even though SubmitLearningAttempt is called twice.
		attempt, answer := campaignRound(t, s, owner.ID, "word-link", "teacher-retry", "teacher-retry-item")
		campaignSubmit(t, s, owner.ID, attempt, answer)
		campaignSubmit(t, s, owner.ID, attempt, answer)
		got, err = s.TeacherPractice(ctx)
		if err != nil {
			t.Fatal(err)
		}
		vocabulary = teacherPracticeSkill(t, got, "Vocabulary")
		if vocabulary.Attempts != 3 || vocabulary.Correct != 2 || vocabulary.Learners != 2 {
			t.Fatalf("retry was double-counted: %#v", vocabulary)
		}
	})
}

func TestTeacherPracticeZeroMemoryAndPostgres(t *testing.T) {
	skillPracticeStores(t, func(t *testing.T, s *Store, _ string) {
		skillPracticeUser(t, s)
		got, err := s.TeacherPractice(context.Background())
		if err != nil {
			t.Fatal(err)
		}
		if got.WindowDays != 7 || got.Attempts7d != 0 || got.Correct7d != 0 || got.Active7d != 0 || len(got.Skills) != 0 {
			t.Fatalf("zero projection is not empty: %#v", got)
		}
	})
}
