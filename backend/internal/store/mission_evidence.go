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
	BossID      string                     `json:"bossId"`
	Messages    []string                   `json:"messages"`
	Evaluation  *engine.ScenarioEvaluation `json:"evaluation,omitempty"`
	Legacy      bool                       `json:"legacy"`
	Preparation *CampaignPreparation       `json:"preparation,omitempty"`
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
	if _, ok := campaignGates[bossID]; !ok {
		return out, ErrNotFound
	}
	receipt := MissionReceipt{BossID: bossID, Messages: append([]string{}, messages...), Evaluation: &verdict}
	var err error
	if s.db != nil {
		err = s.commitMissionSQL(ctx, userID, receipt)
	} else {
		err = s.commitMissionMemory(userID, receipt)
	}
	if err != nil {
		return out, err
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

var ErrCampaignGateLocked = errors.New("boss gate is still locked: complete the chapter checkpoints first")

func campaignCompletionsSQL(ctx context.Context, q dailyQuery, owner string) (map[string]*time.Time, error) {
	rows, err := q.QueryContext(ctx, `SELECT boss_id,completed_at FROM player_bosses WHERE user_id=$1`, owner)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	done := map[string]*time.Time{}
	for rows.Next() {
		var id string
		var at time.Time
		if err = rows.Scan(&id, &at); err != nil {
			return nil, err
		}
		done[id] = &at
	}
	return done, rows.Err()
}

func (s *Store) commitMissionSQL(ctx context.Context, owner string, receipt MissionReceipt) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	var user model.User
	var profile model.PlayerProfile
	// Serialize first clears per owner across Store instances before reading the
	// predecessor ledger and practice receipts. Never lock a learning attempt here.
	err = tx.QueryRowContext(ctx, `SELECT u.xp,COALESCE(p.goal,'conversation') FROM users u LEFT JOIN player_profiles p ON p.user_id=u.id WHERE u.id=$1 FOR UPDATE OF u`, owner).Scan(&user.XP, &profile.Goal)
	if errors.Is(err, sql.ErrNoRows) {
		return ErrNotFound
	}
	if err != nil {
		return err
	}
	done, err := campaignCompletionsSQL(ctx, tx, owner)
	if err != nil {
		return err
	}
	// The winner's immutable receipt is checked by the caller.
	if done[receipt.BossID] != nil {
		return tx.Commit()
	}
	practice, err := campaignPracticeSQL(ctx, tx, owner)
	if err != nil {
		return err
	}
	if !campaignGateOpen(receipt.BossID, user, profile, done, practice) {
		return ErrCampaignGateLocked
	}
	p := prepareCampaign(receipt.BossID, done, practice)
	receipt.Preparation = &p
	raw, err := json.Marshal(receipt)
	if err != nil {
		return err
	}
	reward := campaignGates[receipt.BossID].RewardXP
	_, err = tx.ExecContext(ctx, `INSERT INTO player_bosses(user_id,boss_id,score,reward_xp,completed_at,evidence) VALUES($1,$2,$3,$4,clock_timestamp(),$5)`, owner, receipt.BossID, receipt.Evaluation.Score, reward, string(raw))
	if err != nil {
		return err
	}
	if _, err = tx.ExecContext(ctx, `UPDATE users SET xp=xp+$2 WHERE id=$1`, owner, reward); err != nil {
		return err
	}
	return tx.Commit()
}

func (s *Store) commitMissionMemory(owner string, receipt MissionReceipt) error {
	mem := s.progressionMemory()
	// Shared lock order: progression first, then account/attempt state. Holding
	// both makes the gate, receipt, ledger and XP one indivisible memory operation.
	mem.mu.Lock()
	defer mem.mu.Unlock()
	s.mu.Lock()
	defer s.mu.Unlock()
	acc, ok := s.mem.users[owner]
	if !ok {
		return ErrNotFound
	}
	if _, exists := mem.bosses[owner][receipt.BossID]; exists {
		return nil
	}
	done := map[string]*time.Time{}
	for id, at := range mem.bosses[owner] {
		copy := at
		done[id] = &copy
	}
	playerProfileMu.RLock()
	profile, found := playerProfiles[owner]
	playerProfileMu.RUnlock()
	if !found {
		profile = defaultPlayerProfile(owner)
	}
	practice := s.campaignPracticeMemory(owner)
	if !campaignGateOpen(receipt.BossID, acc.user, profile, done, practice) {
		return ErrCampaignGateLocked
	}
	p := prepareCampaign(receipt.BossID, done, practice)
	receipt.Preparation = &p
	if mem.bosses[owner] == nil {
		mem.bosses[owner] = map[string]time.Time{}
	}
	if mem.receipts[owner] == nil {
		mem.receipts[owner] = map[string]MissionReceipt{}
	}
	mem.bosses[owner][receipt.BossID] = time.Now().UTC()
	mem.receipts[owner][receipt.BossID] = cloneMissionReceipt(receipt)
	acc.user.XP += campaignGates[receipt.BossID].RewardXP
	s.mem.users[owner] = acc
	return nil
}
