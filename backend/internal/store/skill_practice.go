package store

import (
	"context"
	"sort"
	"time"

	"github.com/Loccao102/LocCaoEnglish/backend/internal/model"
	"github.com/lib/pq"
)

const SkillPracticeMethod = "skill-practice.v1"
const SkillPracticeWindow = 20

// Activity and rules support comes from checkedPracticeRules. This mapping also
// prevents a malformed/old receipt from being interpreted as another skill.
var skillPracticeActivitySkills = map[string]string{
	"word-link": "Vocabulary", "collocation-factory": "Vocabulary", "word-graph": "Vocabulary",
	"grammar-repair": "Grammar", "sentence-builder": "Grammar",
	"reading-race": "Reading", "story-choice": "Reading",
	"listen-pick": "Listening", "dictation": "Dictation", "shadowing": "Speaking",
}

func emptySkillPractice(skill string) model.SkillPractice {
	kind := "not-supported"
	for _, supported := range skillPracticeActivitySkills {
		if skill == supported {
			kind = "guided-practice"
			break
		}
	}
	if skill == "Speaking" {
		kind = "transcript-match"
	}
	return model.SkillPractice{Method: SkillPracticeMethod, WindowSize: SkillPracticeWindow, EvidenceKind: kind}
}

func attachSkillPractice(skills []model.Skill, practice map[string]model.SkillPractice) {
	for i := range skills {
		summary, ok := practice[skills[i].Name]
		if !ok {
			summary = emptySkillPractice(skills[i].Name)
		}
		skills[i].Practice = &summary
	}
}

func addSkillPractice(out map[string]model.SkillPractice, skill string, correct bool, at time.Time) {
	summary, ok := out[skill]
	if !ok {
		summary = emptySkillPractice(skill)
	}
	summary.SampleCount++
	if correct {
		summary.CorrectCount++
	}
	if summary.LastCompletedAt == nil || at.After(*summary.LastCompletedAt) {
		copy := at.UTC()
		summary.LastCompletedAt = &copy
	}
	out[skill] = summary
}

func skillPracticeSQL(ctx context.Context, q dailyQuery, owner string) (map[string]model.SkillPractice, error) {
	out := map[string]model.SkillPractice{}
	if owner == "" {
		return out, nil
	}
	triples := make([]string, 0, len(skillPracticeActivitySkills))
	for activity, skill := range skillPracticeActivitySkills {
		if rules, ok := checkedPracticeRules[activity]; ok {
			triples = append(triples, activity+":"+rules+":"+skill)
		}
	}
	sort.Strings(triples)
	// Deduplicate the actual content item before choosing each skill's window.
	// Reward eligibility is deliberately absent: wrong answers and new capped
	// replays both describe practice. At most 20 rows per supported skill leave SQL.
	rows, err := q.QueryContext(ctx, `WITH latest_items AS (
	 SELECT DISTINCT ON (activity,item_key,content_version) id,skill,correct,completed_at
	 FROM learning_attempts
	 WHERE user_id=$1 AND status='completed' AND item_key<>'' AND content_version<>''
	 AND completed_at IS NOT NULL AND completed_at>$4
	 AND activity||':'||rules_version||':'||skill=ANY($2)
	 ORDER BY activity,item_key,content_version,completed_at DESC,id COLLATE "C" DESC
	), ranked AS (
	 SELECT skill,correct,completed_at,ROW_NUMBER() OVER (PARTITION BY skill ORDER BY completed_at DESC,id COLLATE "C" DESC) AS position
	 FROM latest_items
	)
	SELECT skill,correct,completed_at FROM ranked WHERE position<=$3`, owner, pq.Array(triples), SkillPracticeWindow, time.Time{})
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var skill string
		var correct bool
		var at time.Time
		if err = rows.Scan(&skill, &correct, &at); err != nil {
			return nil, err
		}
		addSkillPractice(out, skill, correct, at)
	}
	return out, rows.Err()
}

// Caller holds s.mu. Build copies rather than mutating legacy skill state.
func (s *Store) skillPracticeMemory(owner string) map[string]model.SkillPractice {
	out := map[string]model.SkillPractice{}
	if owner == "" {
		return out
	}
	type itemKey struct{ activity, item, content string }
	latest := map[itemKey]LearningAttemptRecord{}
	for _, r := range s.learningAttempts {
		rules, supported := checkedPracticeRules[r.Activity]
		skill, mapped := skillPracticeActivitySkills[r.Activity]
		if !supported || !mapped || r.RulesVersion != rules || r.Skill != skill || r.UserID != owner || r.Status != "completed" || r.ItemKey == "" || r.ContentVersion == "" || !r.CompletedAt.After(time.Time{}) {
			continue
		}
		key := itemKey{r.Activity, r.ItemKey, r.ContentVersion}
		old, found := latest[key]
		if !found || r.CompletedAt.After(old.CompletedAt) || r.CompletedAt.Equal(old.CompletedAt) && r.ID > old.ID {
			latest[key] = r
		}
	}
	ordered := make([]LearningAttemptRecord, 0, len(latest))
	for _, r := range latest {
		ordered = append(ordered, r)
	}
	sort.Slice(ordered, func(i, j int) bool {
		if ordered[i].CompletedAt.Equal(ordered[j].CompletedAt) {
			return ordered[i].ID > ordered[j].ID
		}
		return ordered[i].CompletedAt.After(ordered[j].CompletedAt)
	})
	for _, r := range ordered {
		if out[r.Skill].SampleCount < SkillPracticeWindow {
			addSkillPractice(out, r.Skill, r.Correct, r.CompletedAt)
		}
	}
	return out
}
