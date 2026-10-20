package store

import (
	"context"
	"database/sql"
	"errors"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/model"
	"math"
	"time"
)

// Test-only reconstruction of old client-graded rows. This helper must never
// compile into the API or provide a new route for awarding client-scored XP.
func (s *Store) recordLegacyFixture(ctx context.Context, userID string, in model.AttemptInput) (model.AttemptResult, error) {
	accuracy := math.Max(0, math.Min(1, in.Accuracy))
	xp := 10 + int(math.Round(20*accuracy))
	review := accuracy < 0.85
	if s.db != nil {
		tx, err := s.db.BeginTx(ctx, nil)
		if err != nil {
			return model.AttemptResult{}, err
		}
		defer tx.Rollback()
		var old float64
		err = tx.QueryRowContext(ctx, `SELECT confidence FROM user_skills WHERE user_id=$1 AND skill=$2 FOR UPDATE`, userID, in.Skill).Scan(&old)
		if errors.Is(err, sql.ErrNoRows) {
			old = .35
			_, err = tx.ExecContext(ctx, `INSERT INTO user_skills(user_id,skill,confidence,level,updated_at) VALUES($1,$2,$3,$4,NOW())`, userID, in.Skill, old, levelFor(old))
		}
		if err != nil {
			return model.AttemptResult{}, err
		}
		next := old*.75 + accuracy*.25
		level := levelFor(next)
		_, err = tx.ExecContext(ctx, `UPDATE user_skills SET confidence=$3,level=$4,updated_at=NOW() WHERE user_id=$1 AND skill=$2`, userID, in.Skill, next, level)
		if err != nil {
			return model.AttemptResult{}, err
		}
		_, err = tx.ExecContext(ctx, `INSERT INTO attempts(id,user_id,skill,activity,item_key,prompt,answer,accuracy,duration_sec,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())`, newID(), userID, in.Skill, in.Activity, in.ItemKey, in.Prompt, in.Answer, accuracy, in.DurationSec)
		if err != nil {
			return model.AttemptResult{}, err
		}
		_, err = tx.ExecContext(ctx, `UPDATE users SET xp=xp+$2 WHERE id=$1`, userID, xp)
		if err != nil {
			return model.AttemptResult{}, err
		}
		if review {
			_, err = tx.ExecContext(ctx, `INSERT INTO review_items(user_id,item_key,kind,prompt,answer,due_at,interval_days,ease,failures) VALUES($1,$2,$3,$4,$5,NOW(),1,2.5,1) ON CONFLICT(user_id,item_key) DO UPDATE SET prompt=EXCLUDED.prompt,answer=EXCLUDED.answer,due_at=NOW(),failures=review_items.failures+1`, userID, in.ItemKey, in.Activity, in.Prompt, in.Answer)
			if err != nil {
				return model.AttemptResult{}, err
			}
		}
		if err := tx.Commit(); err != nil {
			return model.AttemptResult{}, err
		}
		return model.AttemptResult{XPDelta: xp, NewConfidence: next, Level: level, ReviewAdded: review}, nil
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	skmap := s.mem.skills[userID]
	if skmap == nil {
		return model.AttemptResult{}, ErrNotFound
	}
	sk, ok := skmap[in.Skill]
	if !ok {
		sk = model.Skill{Name: in.Skill, Confidence: .35, Level: levelFor(.35), UpdatedAt: time.Now()}
	}
	next := sk.Confidence*.75 + accuracy*.25
	sk.Confidence = next
	sk.Level = levelFor(next)
	sk.UpdatedAt = time.Now()
	skmap[in.Skill] = sk
	acc := s.mem.users[userID]
	acc.user.XP += xp
	s.mem.users[userID] = acc
	if review {
		if s.mem.reviews[userID] == nil {
			s.mem.reviews[userID] = map[string]model.ReviewItem{}
		}
		r := s.mem.reviews[userID][in.ItemKey]
		r.ItemKey = in.ItemKey
		r.Kind = in.Activity
		r.Prompt = in.Prompt
		r.Answer = in.Answer
		r.DueAt = time.Now()
		r.IntervalDays = 1
		if r.Ease == 0 {
			r.Ease = 2.5
		}
		r.Failures++
		s.mem.reviews[userID][in.ItemKey] = r
	}
	return model.AttemptResult{XPDelta: xp, NewConfidence: next, Level: sk.Level, ReviewAdded: review}, nil
}
