package store

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"reflect"
	"time"

	"github.com/Loccao102/LocCaoEnglish/backend/internal/engine"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/model"
)

var ErrMissionConflict = errors.New("this chapter already has different recorded dialogue; reload the saved completion")
var ErrMissionInput = errors.New("invalid conversation or rules version; reload this mission")

type MissionReceipt struct {
	BossID     string                     `json:"bossId"`
	Messages   []string                   `json:"messages"`
	Evaluation *engine.ScenarioEvaluation `json:"evaluation,omitempty"`
	Legacy     bool                       `json:"legacy"`
}
type MissionCompletion struct {
	Progression model.ProgressionState `json:"progression"`
	Receipt     MissionReceipt         `json:"receipt"`
}

func cloneMissionReceipt(r MissionReceipt) MissionReceipt {
	data, _ := json.Marshal(r)
	var result MissionReceipt
	_ = json.Unmarshal(data, &result)
	return result
}
func (s *Store) GetMissionReceipt(ctx context.Context, userID, bossID string) (MissionReceipt, error) {
	if s.db != nil {
		var raw []byte
		err := s.db.QueryRowContext(ctx, `SELECT evidence FROM player_bosses WHERE user_id=$1 AND boss_id=$2`, userID, bossID).Scan(&raw)
		if errors.Is(err, sql.ErrNoRows) {
			return MissionReceipt{}, ErrNotFound
		}
		if err != nil {
			return MissionReceipt{}, err
		}
		if len(raw) == 0 {
			return MissionReceipt{BossID: bossID, Messages: []string{}, Legacy: true}, nil
		}
		var r MissionReceipt
		err = json.Unmarshal(raw, &r)
		return r, err
	}
	mem := s.progressionMemory()
	mem.mu.RLock()
	defer mem.mu.RUnlock()
	if r, ok := mem.receipts[userID][bossID]; ok {
		return cloneMissionReceipt(r), nil
	}
	if _, ok := mem.bosses[userID][bossID]; ok {
		return MissionReceipt{BossID: bossID, Messages: []string{}, Legacy: true}, nil
	}
	return MissionReceipt{}, ErrNotFound
}
func sameMission(r MissionReceipt, messages []string, version string) bool {
	return r.Legacy || r.Evaluation != nil && r.Evaluation.RulesVersion == version && reflect.DeepEqual(r.Messages, messages)
}

// First-clear evidence and the existing chapter reward commit together. No
// per-turn learning attempt or Speaking confidence is created from this rubric.
func (s *Store) CompleteBoss(ctx context.Context, userID, bossID string, messages []string, version string) (MissionCompletion, error) {
	var out MissionCompletion
	if version != engine.ConversationRulesVersion || engine.ValidateConversation(bossID, messages) != nil {
		return out, ErrMissionInput
	}
	if saved, err := s.GetMissionReceipt(ctx, userID, bossID); err == nil {
		if !sameMission(saved, messages, version) {
			return out, ErrMissionConflict
		}
		out.Receipt = saved
		out.Progression, err = s.GetProgression(ctx, userID)
		return out, err
	} else if !errors.Is(err, ErrNotFound) {
		return out, err
	}
	verdict := engine.EvaluateBossConversation(bossID, messages)
	if !verdict.Complete {
		return out, errors.New("conversation objectives are incomplete")
	}
	state, err := s.GetProgression(ctx, userID)
	if err != nil {
		return out, err
	}
	var boss *model.BossState
	for i := range state.Bosses {
		if state.Bosses[i].ID == bossID {
			boss = &state.Bosses[i]
			break
		}
	}
	if boss == nil {
		return out, ErrNotFound
	}
	if !boss.Unlocked {
		return out, errors.New("boss gate is still locked: complete the chapter checkpoints first")
	}
	receipt := MissionReceipt{BossID: bossID, Messages: append([]string{}, messages...), Evaluation: &verdict}
	if s.db != nil {
		tx, err := s.db.BeginTx(ctx, nil)
		if err != nil {
			return out, err
		}
		defer tx.Rollback()
		raw, err := json.Marshal(receipt)
		if err != nil {
			return out, err
		}
		res, err := tx.ExecContext(ctx, `INSERT INTO player_bosses(user_id,boss_id,score,reward_xp,completed_at,evidence) VALUES($1,$2,$3,$4,NOW(),$5) ON CONFLICT(user_id,boss_id) DO NOTHING`, userID, bossID, verdict.Score, boss.RewardXP, string(raw))
		if err != nil {
			return out, err
		}
		n, err := res.RowsAffected()
		if err != nil {
			return out, err
		}
		if n > 0 {
			if _, err = tx.ExecContext(ctx, `UPDATE users SET xp=xp+$2 WHERE id=$1`, userID, boss.RewardXP); err != nil {
				return out, err
			}
		}
		if err = tx.Commit(); err != nil {
			return out, err
		}
	} else {
		mem := s.progressionMemory()
		mem.mu.Lock()
		if mem.bosses[userID] == nil {
			mem.bosses[userID] = map[string]time.Time{}
		}
		if _, exists := mem.bosses[userID][bossID]; !exists {
			mem.bosses[userID][bossID] = time.Now().UTC()
			if mem.receipts[userID] == nil {
				mem.receipts[userID] = map[string]MissionReceipt{}
			}
			mem.receipts[userID][bossID] = cloneMissionReceipt(receipt)
			s.mu.Lock()
			acc := s.mem.users[userID]
			acc.user.XP += boss.RewardXP
			s.mem.users[userID] = acc
			s.mu.Unlock()
		}
		mem.mu.Unlock()
	}
	saved, err := s.GetMissionReceipt(ctx, userID, bossID)
	if err != nil {
		return out, err
	}
	if !sameMission(saved, messages, version) {
		return out, ErrMissionConflict
	}
	out.Receipt = saved
	out.Progression, err = s.GetProgression(ctx, userID)
	return out, err
}
