package store

import (
	"context"
	"sort"
	"time"

	"github.com/Loccao102/LocCaoEnglish/backend/internal/model"
	"github.com/lib/pq"
)

const (
	TeacherPracticeMethod     = "teacher-practice.v1"
	TeacherPracticeWindowDays = 7
)

// TeacherPractice is a read-only projection over the same versioned shared
// attempt policy used by the learner practice summary and checked-practice
// ranking. It deliberately has no progression or reward side effects.
func (s *Store) TeacherPractice(ctx context.Context) (model.TeacherPracticeAnalytics, error) {
	now := time.Now().UTC()
	start := now.Add(-time.Duration(TeacherPracticeWindowDays) * 24 * time.Hour)
	if s.db != nil {
		return teacherPracticeSQL(ctx, s.db, start, now)
	}
	return s.teacherPracticeMemory(start, now), nil
}

func teacherPracticeSQL(ctx context.Context, q dailyQuery, start, end time.Time) (model.TeacherPracticeAnalytics, error) {
	out := model.TeacherPracticeAnalytics{WindowDays: TeacherPracticeWindowDays, Skills: []model.TeacherPracticeSkillAnalytics{}}
	rows, err := q.QueryContext(ctx, `
		WITH eligible AS (
			SELECT a.skill, a.user_id, a.correct
			FROM learning_attempts a
			JOIN users u ON u.id=a.user_id
			WHERE a.user_id IS NOT NULL
			  AND u.email <> 'demo@loccao.local'
			  AND a.status='completed'
			  AND a.item_key<>''
			  AND a.content_version<>''
			  AND a.completed_at IS NOT NULL
			  AND a.completed_at >= $1
			  AND a.completed_at <= $2
			  AND a.activity||':'||a.rules_version||':'||a.skill=ANY($3)
		)
		SELECT skill, COUNT(*) AS attempts,
		       COUNT(*) FILTER (WHERE correct) AS correct,
		       COUNT(DISTINCT user_id) AS learners,
		       (SELECT COUNT(DISTINCT user_id) FROM eligible) AS active
		FROM eligible
		GROUP BY skill
		ORDER BY skill`, start, end, pq.Array(practiceRuleTriples()))
	if err != nil {
		return out, err
	}
	defer rows.Close()
	for rows.Next() {
		var skill string
		var attempts, correct, learners, active int
		if err := rows.Scan(&skill, &attempts, &correct, &learners, &active); err != nil {
			return out, err
		}
		out.Attempts7d += attempts
		out.Correct7d += correct
		out.Active7d = active
		out.Skills = append(out.Skills, model.TeacherPracticeSkillAnalytics{
			Skill: skill, Attempts: attempts, Correct: correct, Learners: learners,
			EvidenceKind: teacherPracticeEvidenceKind(skill),
		})
	}
	if err := rows.Err(); err != nil {
		return out, err
	}
	return out, nil
}

func practiceRuleTriples() []string {
	triples := make([]string, 0, len(skillPracticeActivitySkills))
	for activity, skill := range skillPracticeActivitySkills {
		if rules, ok := checkedPracticeRules[activity]; ok {
			triples = append(triples, activity+":"+rules+":"+skill)
		}
	}
	sort.Strings(triples)
	return triples
}

func teacherPracticeEvidenceKind(skill string) string {
	if skill == "Speaking" {
		return "transcript-match"
	}
	return "guided-practice"
}

func (s *Store) teacherPracticeMemory(start, end time.Time) model.TeacherPracticeAnalytics {
	out := model.TeacherPracticeAnalytics{WindowDays: TeacherPracticeWindowDays, Skills: []model.TeacherPracticeSkillAnalytics{}}
	bySkill := map[string]model.TeacherPracticeSkillAnalytics{}
	learners := map[string]map[string]bool{}
	activeLearners := map[string]bool{}
	s.mu.RLock()
	defer s.mu.RUnlock()
	for _, r := range s.learningAttempts {
		if !teacherPracticeEligible(r, start, end, s.demoID, s.mem.users) {
			continue
		}
		item := bySkill[r.Skill]
		item.Skill = r.Skill
		item.Attempts++
		if r.Correct {
			item.Correct++
		}
		item.EvidenceKind = teacherPracticeEvidenceKind(r.Skill)
		bySkill[r.Skill] = item
		if learners[r.Skill] == nil {
			learners[r.Skill] = map[string]bool{}
		}
		learners[r.Skill][r.UserID] = true
		activeLearners[r.UserID] = true
	}
	for skill, item := range bySkill {
		item.Learners = len(learners[skill])
		out.Skills = append(out.Skills, item)
		out.Attempts7d += item.Attempts
		out.Correct7d += item.Correct
	}
	out.Active7d = len(activeLearners)
	sort.Slice(out.Skills, func(i, j int) bool { return out.Skills[i].Skill < out.Skills[j].Skill })
	return out
}

func teacherPracticeEligible(r LearningAttemptRecord, start, end time.Time, demoID string, users map[string]account) bool {
	rules, supported := checkedPracticeRules[r.Activity]
	skill, mapped := skillPracticeActivitySkills[r.Activity]
	if !supported || !mapped || r.RulesVersion != rules || r.Skill != skill || r.UserID == "" || r.UserID == demoID || r.Status != "completed" || r.ItemKey == "" || r.ContentVersion == "" || r.CompletedAt.IsZero() || r.CompletedAt.Before(start) || r.CompletedAt.After(end) {
		return false
	}
	account, ok := users[r.UserID]
	return ok && account.user.Email != "demo@loccao.local"
}
