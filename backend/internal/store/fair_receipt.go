package store

import (
	"context"
	"database/sql"
	"errors"

	"github.com/Loccao102/LocCaoEnglish/backend/internal/fair"
)

var ErrFairCompletionID = errors.New("invalid fair completion id")

// GetFairCompletion returns the immutable completion receipt for one owner.
// It deliberately reads the ledger instead of reconstructing a result from the
// current aggregate save, so a later run cannot change the original payload.
func (s *Store) GetFairCompletion(ctx context.Context, userID, runID string) (fair.Completion, error) {
	if !fair.ValidRunID(runID) {
		return fair.Completion{}, ErrFairCompletionID
	}
	if s.db != nil {
		var completion fair.Completion
		completion.RunID = runID
		err := s.db.QueryRowContext(ctx, `SELECT game_id,stars,course_id,elapsed_ms,feathers,difficulty FROM fair_completions WHERE user_id=$1 AND run_id=$2`, userID, runID).Scan(&completion.GameID, &completion.Stars, &completion.CourseID, &completion.ElapsedMS, &completion.Feathers, &completion.Difficulty)
		if errors.Is(err, sql.ErrNoRows) {
			return fair.Completion{}, ErrNotFound
		}
		if err != nil {
			return fair.Completion{}, err
		}
		return completion, nil
	}

	s.fairMu.Lock()
	defer s.fairMu.Unlock()
	if runs := s.fairRuns[userID]; runs != nil {
		if completion, ok := runs[runID]; ok {
			return completion, nil
		}
	}
	return fair.Completion{}, ErrNotFound
}
