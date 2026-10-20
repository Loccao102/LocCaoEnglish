package store

import (
	"context"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/model"
	"github.com/lib/pq"
	"sort"
)

const CheckedPracticeMethod = "server-checked-practice.v1"
const CheckedPracticeDisclaimer = "Only XP from server-checked learning rounds is ranked. Guided practice is not a skill certification or verified competition. Legacy, story and other personal XP are excluded."

var checkedPracticeRules = map[string]string{
	"word-link": "word-link.v1", "grammar-repair": "grammar-repair.v1",
	"collocation-factory": "collocation-factory.v1", "sentence-builder": "sentence-builder.v1",
	"word-graph": "word-graph.v1", "reading-race": "reading-race.v1",
	"story-choice": "story-choice.v1", "listen-pick": "listen-pick.v1",
	"dictation": "dictation.v1", "shadowing": "shadowing.v1",
}

func checkedPractice(r LearningAttemptRecord) bool {
	rule, supported := checkedPracticeRules[r.Activity]
	return supported && r.RulesVersion == rule && r.ContentVersion != "" && r.UserID != "" && r.Status == "completed" && r.Correct && r.ProgressionApplied && r.XPDelta == 20
}
func (s *Store) TopUsers(ctx context.Context, limit int) ([]model.LeaderboardEntry, error) {
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	if s.db != nil {
		// Both storage modes use the same versioned eligibility policy.
		pairs := make([]string, 0, len(checkedPracticeRules))
		for activity, rules := range checkedPracticeRules {
			pairs = append(pairs, activity+":"+rules)
		}
		query := `SELECT u.id,u.display_name,SUM(a.xp_delta),u.streak FROM learning_attempts a
  JOIN users u ON u.id=a.user_id WHERE a.status='completed' AND a.correct AND a.progression_applied AND a.xp_delta=20 AND a.content_version<>'' AND a.activity||':'||a.rules_version=ANY($2)
  AND EXISTS(SELECT 1 FROM learning_daily_rewards c WHERE c.attempt_id=a.id AND c.user_id=a.user_id AND c.item_key=a.item_key AND c.content_version=a.content_version)
  GROUP BY u.id,u.display_name,u.streak ORDER BY SUM(a.xp_delta) DESC,u.id ASC LIMIT $1`
		rows, err := s.db.QueryContext(ctx, query, limit, pq.Array(pairs))
		if err != nil {
			return nil, err
		}
		defer rows.Close()
		out := []model.LeaderboardEntry{}
		for rows.Next() {
			var item model.LeaderboardEntry
			if err := rows.Scan(&item.UserID, &item.DisplayName, &item.XP, &item.Streak); err != nil {
				return nil, err
			}
			item.Rank = len(out) + 1
			out = append(out, item)
		}
		return out, rows.Err()
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	totals := map[string]int{}
	for _, r := range s.learningAttempts {
		if checkedPractice(r) {
			totals[r.UserID] += r.XPDelta
		}
	}
	out := []model.LeaderboardEntry{}
	for id, xp := range totals {
		if acc, ok := s.mem.users[id]; ok {
			out = append(out, model.LeaderboardEntry{UserID: id, DisplayName: acc.user.DisplayName, XP: xp, Streak: acc.user.Streak})
		}
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].XP == out[j].XP {
			return out[i].UserID < out[j].UserID
		}
		return out[i].XP > out[j].XP
	})
	if len(out) > limit {
		out = out[:limit]
	}
	for i := range out {
		out[i].Rank = i + 1
	}
	return out, nil
}
