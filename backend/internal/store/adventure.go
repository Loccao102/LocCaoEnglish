package store

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/adventure"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/model"
	"time"
)

func (s *Store) EnsureAdventure(ctx context.Context) error {
	if s.db == nil {
		return nil
	}
	_, err := s.db.ExecContext(ctx, `CREATE TABLE IF NOT EXISTS player_adventures(user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,save JSONB NOT NULL,updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`)
	return err
}
func (s *Store) GetAdventure(ctx context.Context, userID string) (adventure.Save, error) {
	if _, err := s.GetUser(ctx, userID); err != nil {
		return adventure.Save{}, err
	}
	if s.db != nil {
		var raw []byte
		err := s.db.QueryRowContext(ctx, `SELECT save FROM player_adventures WHERE user_id=$1`, userID).Scan(&raw)
		if errors.Is(err, sql.ErrNoRows) {
			return adventure.NewSave(), nil
		}
		if err != nil {
			return adventure.Save{}, err
		}
		var save adventure.Save
		err = json.Unmarshal(raw, &save)
		return save, err
	}
	s.adventureMu.Lock()
	defer s.adventureMu.Unlock()
	if save, ok := s.adventures[userID]; ok {
		return adventure.Clone(save), nil
	}
	return adventure.NewSave(), nil
}

// The save and its account XP increment commit atomically. Repeated requests and
// simultaneous browser tabs cannot grant the same first-clear reward twice.
func (s *Store) ApplyAdventure(ctx context.Context, userID string, action adventure.Action) (adventure.Result, error) {
	if _, err := s.GetUser(ctx, userID); err != nil {
		return adventure.Result{}, err
	}
	if s.db != nil {
		tx, err := s.db.BeginTx(ctx, nil)
		if err != nil {
			return adventure.Result{}, err
		}
		defer tx.Rollback()
		initial, _ := json.Marshal(adventure.NewSave())
		if _, err = tx.ExecContext(ctx, `INSERT INTO player_adventures(user_id,save) VALUES($1,$2) ON CONFLICT(user_id) DO NOTHING`, userID, string(initial)); err != nil {
			return adventure.Result{}, err
		}
		var raw []byte
		if err = tx.QueryRowContext(ctx, `SELECT save FROM player_adventures WHERE user_id=$1 FOR UPDATE`, userID).Scan(&raw); err != nil {
			return adventure.Result{}, err
		}
		var save adventure.Save
		if err = json.Unmarshal(raw, &save); err != nil {
			return adventure.Result{}, err
		}
		result, err := adventure.Apply(save, action)
		if err != nil {
			return result, err
		}
		updated, _ := json.Marshal(result.Save)
		if _, err = tx.ExecContext(ctx, `UPDATE player_adventures SET save=$2,updated_at=NOW() WHERE user_id=$1`, userID, string(updated)); err != nil {
			return result, err
		}
		if result.Verdict != nil && result.Verdict.FirstClear {
			quest, _ := adventure.FindQuest(action.QuestID)
			if err = recordAdventureEvidence(ctx, tx, userID, quest, action.Answers); err != nil {
				return result, err
			}
			if _, err = tx.ExecContext(ctx, `UPDATE users SET xp=xp+$2 WHERE id=$1`, userID, result.Verdict.XP); err != nil {
				return result, err
			}
		}
		return result, tx.Commit()
	}
	s.adventureMu.Lock()
	defer s.adventureMu.Unlock()
	if s.adventures == nil {
		s.adventures = map[string]adventure.Save{}
	}
	save, ok := s.adventures[userID]
	if !ok {
		save = adventure.NewSave()
	}
	result, err := adventure.Apply(save, action)
	if err != nil {
		return result, err
	}
	s.adventures[userID] = adventure.Clone(result.Save)
	if result.Verdict != nil && result.Verdict.FirstClear {
		s.mu.Lock()
		acc := s.mem.users[userID]
		acc.user.XP += result.Verdict.XP
		s.mem.users[userID] = acc
		quest, _ := adventure.FindQuest(action.QuestID)
		for i, q := range quest.Questions {
			accuracy := 0.0
			if adventure.Normalize(action.Answers[i]) == adventure.Normalize(q.Answer) {
				accuracy = 1
			}
			skill := adventureSkill(q)
			sk := s.mem.skills[userID][skill]
			sk.Confidence = sk.Confidence*.75 + accuracy*.25
			sk.Level = levelFor(sk.Confidence)
			sk.UpdatedAt = time.Now()
			s.mem.skills[userID][skill] = sk
			if accuracy == 0 {
				if s.mem.reviews[userID] == nil {
					s.mem.reviews[userID] = map[string]model.ReviewItem{}
				}
				key := quest.ID + ":" + q.Prompt
				s.mem.reviews[userID][key] = model.ReviewItem{ItemKey: key, Kind: "adventure", Prompt: q.Prompt, Answer: q.Answer, DueAt: time.Now(), IntervalDays: 1, Ease: 2.5, Failures: 1}
			}
		}
		s.mu.Unlock()
	}
	return result, nil
}
func adventureSkill(q adventure.Question) string {
	if q.Kind == "listen" {
		return "Listening"
	}
	if q.Kind == "order" {
		return "Grammar"
	}
	if q.Passage != "" {
		return "Reading"
	}
	return "Vocabulary"
}
func recordAdventureEvidence(ctx context.Context, tx *sql.Tx, userID string, quest adventure.Quest, answers []string) error {
	for i, q := range quest.Questions {
		accuracy := 0.0
		if adventure.Normalize(answers[i]) == adventure.Normalize(q.Answer) {
			accuracy = 1
		}
		skill := adventureSkill(q)
		key := quest.ID + ":" + q.Prompt
		var old float64
		if err := tx.QueryRowContext(ctx, `SELECT confidence FROM user_skills WHERE user_id=$1 AND skill=$2 FOR UPDATE`, userID, skill).Scan(&old); err != nil {
			return err
		}
		next := old*.75 + accuracy*.25
		if _, err := tx.ExecContext(ctx, `UPDATE user_skills SET confidence=$3,level=$4,updated_at=NOW() WHERE user_id=$1 AND skill=$2`, userID, skill, next, levelFor(next)); err != nil {
			return err
		}
		if _, err := tx.ExecContext(ctx, `INSERT INTO attempts(id,user_id,skill,activity,item_key,prompt,answer,accuracy,duration_sec,created_at) VALUES($1,$2,$3,'adventure',$4,$5,$6,$7,0,NOW())`, newID(), userID, skill, key, q.Prompt, q.Answer, accuracy); err != nil {
			return err
		}
		if accuracy == 0 {
			if _, err := tx.ExecContext(ctx, `INSERT INTO review_items(user_id,item_key,kind,prompt,answer,due_at,interval_days,ease,failures) VALUES($1,$2,'adventure',$3,$4,NOW(),1,2.5,1) ON CONFLICT(user_id,item_key) DO UPDATE SET due_at=NOW(),failures=review_items.failures+1`, userID, key, q.Prompt, q.Answer); err != nil {
				return err
			}
		}
	}
	return nil
}
