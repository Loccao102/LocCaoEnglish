package store

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/daily"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/model"
	"github.com/lib/pq"
	"sort"
	"strings"
	"time"
)

const dailySchemaSQL = `
CREATE TABLE IF NOT EXISTS daily_claims(user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,day DATE NOT NULL,reward_xp INTEGER NOT NULL DEFAULT 50,claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),PRIMARY KEY(user_id,day));
ALTER TABLE daily_claims ADD COLUMN IF NOT EXISTS rules_version TEXT NOT NULL DEFAULT 'legacy-unverified';
ALTER TABLE daily_claims ADD COLUMN IF NOT EXISTS receipt JSONB;
CREATE TABLE IF NOT EXISTS daily_plans(user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,day DATE NOT NULL,snapshot JSONB NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),PRIMARY KEY(user_id,day));
CREATE INDEX IF NOT EXISTS learning_completed_day ON learning_attempts(user_id,completed_at) WHERE status='completed';`

func (s *Store) EnsureDaily(ctx context.Context) error {
	if s.db == nil {
		return nil
	}
	_, e := s.db.ExecContext(ctx, dailySchemaSQL)
	return e
}
func CurrentPlayerDay() string          { return daily.Day(time.Now()) }
func dailyKey(owner, day string) string { return owner + ":" + day }
func cloneDailyPlan(p model.DailyPlanSnapshot) model.DailyPlanSnapshot {
	p.Quests = append([]model.DailyQuest{}, p.Quests...)
	return p
}
func cloneDailyReceipt(r model.DailyClaimReceipt) model.DailyClaimReceipt {
	r.Evidence = append([]model.DailyQuestEvidence{}, r.Evidence...)
	if r.Plan != nil {
		p := cloneDailyPlan(*r.Plan)
		r.Plan = &p
	}
	return r
}
func decodeDailyPlan(raw []byte, day string) (model.DailyPlanSnapshot, error) {
	var p model.DailyPlanSnapshot
	if json.Unmarshal(raw, &p) != nil || p.Date != day || daily.Validate(p) != nil {
		return p, daily.ErrConflict
	}
	return p, nil
}
func (s *Store) GetDailyPlan(ctx context.Context, owner, day string) (model.DailyPlanSnapshot, error) {
	if _, _, e := daily.Bounds(day); e != nil {
		return model.DailyPlanSnapshot{}, e
	}
	if s.db != nil {
		var raw []byte
		e := s.db.QueryRowContext(ctx, `SELECT snapshot FROM daily_plans WHERE user_id=$1 AND day=$2::date`, owner, day).Scan(&raw)
		if errors.Is(e, sql.ErrNoRows) {
			e = ErrNotFound
		}
		if e != nil {
			return model.DailyPlanSnapshot{}, e
		}
		return decodeDailyPlan(raw, day)
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	p, ok := s.dailyPlans[dailyKey(owner, day)]
	if !ok {
		return p, ErrNotFound
	}
	if p.Date != day {
		return p, daily.ErrConflict
	}
	if e := daily.Validate(p); e != nil {
		return p, e
	}
	return cloneDailyPlan(p), nil
}
func (s *Store) SaveDailyPlan(ctx context.Context, owner string, p model.DailyPlanSnapshot) (model.DailyPlanSnapshot, error) {
	if e := daily.Validate(p); e != nil {
		return p, e
	}
	if _, e := s.GetUser(ctx, owner); e != nil {
		return p, e
	}
	if s.db != nil {
		raw, _ := json.Marshal(p)
		_, e := s.db.ExecContext(ctx, `INSERT INTO daily_plans(user_id,day,snapshot,created_at) VALUES($1,$2::date,$3,$4) ON CONFLICT(user_id,day) DO NOTHING`, owner, p.Date, string(raw), p.CreatedAt)
		if e != nil {
			return p, e
		}
		return s.GetDailyPlan(ctx, owner, p.Date)
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.dailyPlans == nil {
		s.dailyPlans = map[string]model.DailyPlanSnapshot{}
	}
	key := dailyKey(owner, p.Date)
	if old, ok := s.dailyPlans[key]; ok {
		if old.Date != p.Date {
			return old, daily.ErrConflict
		}
		if e := daily.Validate(old); e != nil {
			return old, e
		}
		return cloneDailyPlan(old), nil
	}
	s.dailyPlans[key] = cloneDailyPlan(p)
	return cloneDailyPlan(p), nil
}

type dailyQuery interface {
	QueryContext(context.Context, string, ...any) (*sql.Rows, error)
}

func practiceRulePairs() []string {
	pairs := make([]string, 0, len(checkedPracticeRules))
	for activity, rules := range checkedPracticeRules {
		pairs = append(pairs, activity+":"+rules)
	}
	return pairs
}
func dailyEvidenceSQL(ctx context.Context, q dailyQuery, owner, day string) (map[string]string, error) {
	start, end, e := daily.Bounds(day)
	if e != nil {
		return nil, e
	}
	rows, e := q.QueryContext(ctx, `SELECT id,activity FROM learning_attempts WHERE user_id=$1 AND status='completed' AND content_version<>'' AND completed_at >= $2 AND completed_at < $3 AND activity||':'||rules_version=ANY($4) ORDER BY completed_at,id`, owner, start, end, pq.Array(practiceRulePairs()))
	if e != nil {
		return nil, e
	}
	defer rows.Close()
	out := map[string]string{}
	for rows.Next() {
		var id, activity string
		if e = rows.Scan(&id, &activity); e != nil {
			return nil, e
		}
		if out[activity] == "" {
			out[activity] = id
		}
	}
	return out, rows.Err()
}

// The caller holds s.mu. Completion time is a value, not a caller-owned pointer.
func (s *Store) dailyEvidenceMemory(owner, day string) (map[string]string, error) {
	start, end, e := daily.Bounds(day)
	if e != nil {
		return nil, e
	}
	records := []LearningAttemptRecord{}
	for _, r := range s.learningAttempts {
		rules, ok := checkedPracticeRules[r.Activity]
		if ok && r.RulesVersion == rules && r.ContentVersion != "" && r.UserID == owner && r.Status == "completed" && !r.CompletedAt.Before(start) && r.CompletedAt.Before(end) {
			records = append(records, r)
		}
	}
	sort.Slice(records, func(i, j int) bool {
		if records[i].CompletedAt.Equal(records[j].CompletedAt) {
			return records[i].ID < records[j].ID
		}
		return records[i].CompletedAt.Before(records[j].CompletedAt)
	})
	out := map[string]string{}
	for _, r := range records {
		if out[r.Activity] == "" {
			out[r.Activity] = r.ID
		}
	}
	return out, nil
}
func (s *Store) DailyEvidence(ctx context.Context, owner, day string) (map[string]string, error) {
	if s.db != nil {
		return dailyEvidenceSQL(ctx, s.db, owner, day)
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.dailyEvidenceMemory(owner, day)
}

func validDailyReceipt(r model.DailyClaimReceipt, day string) bool {
	if r.Date != day || r.ClaimedAt.IsZero() {
		return false
	}
	if r.Legacy {
		return r.RulesVersion == "legacy-unverified" && r.Plan == nil && len(r.Evidence) == 0
	}
	if r.RulesVersion != daily.RulesVersion || r.RewardXP != daily.RewardXP || r.Plan == nil || r.Plan.Date != day || daily.Validate(*r.Plan) != nil || len(r.Evidence) != len(r.Plan.Quests) {
		return false
	}
	seen := map[string]bool{}
	for i, q := range r.Plan.Quests {
		proof := r.Evidence[i]
		if proof.QuestID != q.ID || proof.Activity != q.Activity || proof.AttemptID == "" || seen[proof.AttemptID] {
			return false
		}
		seen[proof.AttemptID] = true
	}
	return true
}
func readDailyClaim(row learningRow, day string) (model.DailyClaimReceipt, error) {
	var reward int
	var at time.Time
	var version string
	var raw []byte
	e := row.Scan(&reward, &at, &version, &raw)
	if errors.Is(e, sql.ErrNoRows) {
		return model.DailyClaimReceipt{}, ErrNotFound
	}
	if e != nil {
		return model.DailyClaimReceipt{}, e
	}
	if version == "legacy-unverified" && len(raw) == 0 {
		return model.DailyClaimReceipt{Date: day, RulesVersion: version, RewardXP: reward, ClaimedAt: at, Legacy: true, Evidence: []model.DailyQuestEvidence{}}, nil
	}
	var r model.DailyClaimReceipt
	if json.Unmarshal(raw, &r) != nil || version != r.RulesVersion || reward != r.RewardXP || !validDailyReceipt(r, day) {
		return r, daily.ErrConflict
	}
	return r, nil
}
func (s *Store) DailyReceipt(ctx context.Context, owner, day string) (model.DailyClaimReceipt, error) {
	if _, _, e := daily.Bounds(day); e != nil {
		return model.DailyClaimReceipt{}, e
	}
	if s.db != nil {
		return readDailyClaim(s.db.QueryRowContext(ctx, `SELECT reward_xp,claimed_at,rules_version,receipt FROM daily_claims WHERE user_id=$1 AND day=$2::date`, owner, day), day)
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	r, ok := s.dailyClaims[dailyKey(owner, day)]
	if !ok {
		return r, ErrNotFound
	}
	if !validDailyReceipt(r, day) {
		return r, daily.ErrConflict
	}
	return cloneDailyReceipt(r), nil
}
func makeDailyReceipt(p model.DailyPlanSnapshot, evidence map[string]string) (model.DailyClaimReceipt, error) {
	if daily.Validate(p) != nil {
		return model.DailyClaimReceipt{}, daily.ErrConflict
	}
	r := model.DailyClaimReceipt{Date: p.Date, RulesVersion: p.RulesVersion, RewardXP: daily.RewardXP, ClaimedAt: time.Now().UTC(), Plan: &p, Evidence: []model.DailyQuestEvidence{}}
	for _, q := range p.Quests {
		if evidence[q.Activity] == "" {
			return r, daily.ErrIncomplete
		}
		r.Evidence = append(r.Evidence, model.DailyQuestEvidence{QuestID: q.ID, Activity: q.Activity, AttemptID: evidence[q.Activity]})
	}
	return r, nil
}
func (s *Store) ClaimDailyReward(ctx context.Context, owner, day, version string) (model.DailyClaimReceipt, bool, error) {
	if _, _, e := daily.Bounds(day); e != nil {
		return model.DailyClaimReceipt{}, false, e
	}
	if version != daily.RulesVersion {
		return model.DailyClaimReceipt{}, false, daily.ErrConflict
	}
	if s.db != nil {
		tx, e := s.db.BeginTx(ctx, nil)
		if e != nil {
			return model.DailyClaimReceipt{}, false, e
		}
		defer tx.Rollback()
		var id string
		if e = tx.QueryRowContext(ctx, `SELECT id FROM users WHERE id=$1 FOR UPDATE`, owner).Scan(&id); errors.Is(e, sql.ErrNoRows) {
			return model.DailyClaimReceipt{}, false, ErrNotFound
		} else if e != nil {
			return model.DailyClaimReceipt{}, false, e
		}
		old, e := readDailyClaim(tx.QueryRowContext(ctx, `SELECT reward_xp,claimed_at,rules_version,receipt FROM daily_claims WHERE user_id=$1 AND day=$2::date`, owner, day), day)
		if e == nil {
			return old, false, nil
		}
		if !errors.Is(e, ErrNotFound) {
			return old, false, e
		}
		if day != CurrentPlayerDay() {
			return model.DailyClaimReceipt{}, false, daily.ErrExpired
		}
		var raw []byte
		e = tx.QueryRowContext(ctx, `SELECT snapshot FROM daily_plans WHERE user_id=$1 AND day=$2::date FOR UPDATE`, owner, day).Scan(&raw)
		if errors.Is(e, sql.ErrNoRows) {
			return model.DailyClaimReceipt{}, false, daily.ErrConflict
		}
		if e != nil {
			return model.DailyClaimReceipt{}, false, e
		}
		p, e := decodeDailyPlan(raw, day)
		if e != nil {
			return model.DailyClaimReceipt{}, false, e
		}
		proof, e := dailyEvidenceSQL(ctx, tx, owner, day)
		if e != nil {
			return model.DailyClaimReceipt{}, false, e
		}
		receipt, e := makeDailyReceipt(p, proof)
		if e != nil {
			return receipt, false, e
		}
		raw, _ = json.Marshal(receipt)
		res, e := tx.ExecContext(ctx, `INSERT INTO daily_claims(user_id,day,reward_xp,claimed_at,rules_version,receipt) VALUES($1,$2::date,$3,$4,$5,$6) ON CONFLICT(user_id,day) DO NOTHING`, owner, day, daily.RewardXP, receipt.ClaimedAt, daily.RulesVersion, string(raw))
		if e != nil {
			return receipt, false, e
		}
		n, e := res.RowsAffected()
		if e != nil {
			return receipt, false, e
		}
		if n == 0 {
			existing, e := readDailyClaim(tx.QueryRowContext(ctx, `SELECT reward_xp,claimed_at,rules_version,receipt FROM daily_claims WHERE user_id=$1 AND day=$2::date`, owner, day), day)
			return existing, false, e
		}
		streak, e := claimStreakTx(ctx, tx, owner)
		if e != nil {
			return receipt, false, e
		}
		if _, e = tx.ExecContext(ctx, `UPDATE users SET xp=xp+$2,streak=$3 WHERE id=$1`, owner, daily.RewardXP, streak); e != nil {
			return receipt, false, e
		}
		if e = tx.Commit(); e != nil {
			return receipt, false, e
		}
		return receipt, true, nil
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	acc, ok := s.mem.users[owner]
	if !ok {
		return model.DailyClaimReceipt{}, false, ErrNotFound
	}
	key := dailyKey(owner, day)
	if old, ok := s.dailyClaims[key]; ok {
		if !validDailyReceipt(old, day) {
			return old, false, daily.ErrConflict
		}
		return cloneDailyReceipt(old), false, nil
	}
	if day != CurrentPlayerDay() {
		return model.DailyClaimReceipt{}, false, daily.ErrExpired
	}
	p, ok := s.dailyPlans[key]
	if !ok {
		return model.DailyClaimReceipt{}, false, daily.ErrConflict
	}
	if p.Date != day {
		return model.DailyClaimReceipt{}, false, daily.ErrConflict
	}
	proof, e := s.dailyEvidenceMemory(owner, day)
	if e != nil {
		return model.DailyClaimReceipt{}, false, e
	}
	receipt, e := makeDailyReceipt(cloneDailyPlan(p), proof)
	if e != nil {
		return receipt, false, e
	}
	if s.dailyClaims == nil {
		s.dailyClaims = map[string]model.DailyClaimReceipt{}
	}
	s.dailyClaims[key] = cloneDailyReceipt(receipt)
	acc.user.XP += daily.RewardXP
	days := []time.Time{}
	for k, r := range s.dailyClaims {
		if strings.HasPrefix(k, owner+":") {
			if at, e := time.Parse("2006-01-02", r.Date); e == nil {
				days = append(days, at)
			}
		}
	}
	sort.Slice(days, func(i, j int) bool { return days[i].After(days[j]) })
	acc.user.Streak = consecutiveDays(days)
	s.mem.users[owner] = acc
	return receipt, true, nil
}
func claimStreakTx(ctx context.Context, tx *sql.Tx, owner string) (int, error) {
	rows, e := tx.QueryContext(ctx, `SELECT day FROM daily_claims WHERE user_id=$1 ORDER BY day DESC LIMIT 365`, owner)
	if e != nil {
		return 0, e
	}
	defer rows.Close()
	days := []time.Time{}
	for rows.Next() {
		var at time.Time
		if e = rows.Scan(&at); e != nil {
			return 0, e
		}
		days = append(days, at)
	}
	if e = rows.Err(); e != nil {
		return 0, e
	}
	return consecutiveDays(days), nil
}
func consecutiveDays(days []time.Time) int {
	if len(days) == 0 {
		return 0
	}
	streak := 1
	previous := days[0]
	for _, at := range days[1:] {
		delta := previous.Sub(at)
		if delta >= 23*time.Hour && delta <= 25*time.Hour {
			streak++
			previous = at
			continue
		}
		if delta < 23*time.Hour {
			continue
		}
		break
	}
	return streak
}
