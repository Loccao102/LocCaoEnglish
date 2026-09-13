package store

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"time"

	"github.com/Loccao102/LocCaoEnglish/backend/internal/fair"
)

const fairSchema = `
CREATE TABLE IF NOT EXISTS player_fairs(user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, save JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS fair_completions(user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, run_id UUID NOT NULL, game_id TEXT NOT NULL, stars INTEGER NOT NULL CHECK(stars BETWEEN 1 AND 3), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY(user_id,run_id));
`

func (s *Store) EnsureFair(ctx context.Context) error {
	if s.db == nil {
		return nil
	}
	_, err := s.db.ExecContext(ctx, fairSchema)
	return err
}
func (s *Store) GetFair(ctx context.Context, userID string) (fair.Save, error) {
	if _, err := s.GetUser(ctx, userID); err != nil {
		return fair.Save{}, err
	}
	if s.db != nil {
		var raw []byte
		err := s.db.QueryRowContext(ctx, `SELECT save FROM player_fairs WHERE user_id=$1`, userID).Scan(&raw)
		if errors.Is(err, sql.ErrNoRows) {
			return fair.NewSave(), nil
		}
		if err != nil {
			return fair.Save{}, err
		}
		var save fair.Save
		err = json.Unmarshal(raw, &save)
		return save, err
	}
	s.fairMu.Lock()
	defer s.fairMu.Unlock()
	return fair.Clone(s.fairs[userID]), nil
}

// Lock the account summary before checking the ledger so simultaneous retries
// and different browser tabs cannot increment visits twice for one run.
func (s *Store) CompleteFair(ctx context.Context, userID string, completion fair.Completion) (fair.Save, error) {
	if err := fair.Validate(completion); err != nil {
		return fair.Save{}, err
	}
	if _, err := s.GetUser(ctx, userID); err != nil {
		return fair.Save{}, err
	}
	if s.db != nil {
		tx, err := s.db.BeginTx(ctx, nil)
		if err != nil {
			return fair.Save{}, err
		}
		defer tx.Rollback()
		initial, _ := json.Marshal(fair.NewSave())
		if _, err = tx.ExecContext(ctx, `INSERT INTO player_fairs(user_id,save) VALUES($1,$2) ON CONFLICT(user_id) DO NOTHING`, userID, string(initial)); err != nil {
			return fair.Save{}, err
		}
		var raw []byte
		if err = tx.QueryRowContext(ctx, `SELECT save FROM player_fairs WHERE user_id=$1 FOR UPDATE`, userID).Scan(&raw); err != nil {
			return fair.Save{}, err
		}
		var save fair.Save
		if err = json.Unmarshal(raw, &save); err != nil {
			return fair.Save{}, err
		}
		var old fair.Completion
		err = tx.QueryRowContext(ctx, `SELECT game_id,stars FROM fair_completions WHERE user_id=$1 AND run_id=$2`, userID, completion.RunID).Scan(&old.GameID, &old.Stars)
		if err == nil {
			if old.GameID != completion.GameID || old.Stars != completion.Stars {
				return fair.Save{}, fair.ErrConflict
			}
			return save, tx.Commit()
		}
		if !errors.Is(err, sql.ErrNoRows) {
			return fair.Save{}, err
		}
		save = fair.Apply(save, completion, time.Now())
		updated, _ := json.Marshal(save)
		if _, err = tx.ExecContext(ctx, `INSERT INTO fair_completions(user_id,run_id,game_id,stars) VALUES($1,$2,$3,$4)`, userID, completion.RunID, completion.GameID, completion.Stars); err != nil {
			return fair.Save{}, err
		}
		if _, err = tx.ExecContext(ctx, `UPDATE player_fairs SET save=$2,updated_at=NOW() WHERE user_id=$1`, userID, string(updated)); err != nil {
			return fair.Save{}, err
		}
		return save, tx.Commit()
	}
	s.fairMu.Lock()
	defer s.fairMu.Unlock()
	if s.fairs == nil {
		s.fairs = map[string]fair.Save{}
		s.fairRuns = map[string]map[string]fair.Completion{}
	}
	if s.fairRuns[userID] == nil {
		s.fairRuns[userID] = map[string]fair.Completion{}
	}
	if old, ok := s.fairRuns[userID][completion.RunID]; ok {
		if old != completion {
			return fair.Save{}, fair.ErrConflict
		}
		return fair.Clone(s.fairs[userID]), nil
	}
	save := fair.Apply(s.fairs[userID], completion, time.Now())
	s.fairs[userID] = save
	s.fairRuns[userID][completion.RunID] = completion
	return fair.Clone(save), nil
}
