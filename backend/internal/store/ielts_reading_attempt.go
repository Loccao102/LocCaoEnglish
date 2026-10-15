package store

import (
	"context"
	"database/sql"
	"encoding/json"
	"time"

	"github.com/Loccao102/LocCaoEnglish/backend/internal/learning"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/model"
)

func ieltsReadingResult(rec LearningAttemptRecord) *model.IELTSReadingResult {
	if rec.Activity != "ielts-reading" || rec.Status != "completed" || rec.Snapshot.IELTS == nil || rec.Snapshot.IELTS.Result == nil {
		return nil
	}
	result := *rec.Snapshot.IELTS.Result
	result.Answers = append([]model.IELTSReadingAnswer(nil), result.Answers...)
	return &result
}

func completeIELTSReading(rec LearningAttemptRecord, answer string) (LearningAttemptRecord, model.IELTSAttempt, ieltsReceipt, error) {
	result, err := learning.GradeIELTSReading(rec.Snapshot.Prompt.Reading, rec.Snapshot.IELTS, answer)
	if err != nil {
		return rec, model.IELTSAttempt{}, ieltsReceipt{}, ErrAttemptInput
	}
	rec = cloneLearningRecord(rec)
	rec.Status, rec.SubmittedAnswer, rec.Correct = "completed", answer, result.RawScore == result.MaxScore
	rec.Snapshot.IELTS.Result = result
	// Evidence-only completion never consumes a daily reward, changes skill
	// confidence, creates a review, or writes the old mastery attempts table.
	rec.XPDelta, rec.ResultConfidence, rec.ResultLevel, rec.ReviewAdded, rec.ProgressionApplied = 0, 0, 0, false, false
	a := model.IELTSAttempt{ID: newID(), AttemptID: rec.ID, Section: "reading", TestType: "academic", RawScore: &result.RawScore, MaxScore: &result.MaxScore, Band: result.Band, Source: learning.IELTSReadingEvidence, CreatedAt: time.Now().UTC(), ContentVersion: rec.ContentVersion, RulesVersion: rec.RulesVersion, MethodVersion: result.MethodVersion, Provider: result.Provider, Evidence: learning.IELTSReadingEvidence, Legacy: false}
	receipt := ieltsReceipt{Evidence: a.Evidence, ContentVersion: rec.ContentVersion, RulesVersion: rec.RulesVersion, ActualAnswer: answer, Result: result}
	return rec, a, receipt, nil
}

// Called under the shared attempt FOR UPDATE lock; the history and verdict
// commit together. No nested transaction or independent history writer.
func (s *Store) submitIELTSReadingTx(ctx context.Context, tx *sql.Tx, rec LearningAttemptRecord, answer string) (model.LearningAttemptResult, error) {
	rec, a, receipt, err := completeIELTSReading(rec, answer)
	if err != nil {
		return model.LearningAttemptResult{}, err
	}
	rawReceipt, err := json.Marshal(receipt)
	if err != nil {
		return model.LearningAttemptResult{}, err
	}
	rawSnapshot, err := json.Marshal(rec.Snapshot)
	if err != nil {
		return model.LearningAttemptResult{}, err
	}
	if _, err = tx.ExecContext(ctx, `UPDATE learning_attempts SET status='completed',submitted_answer=$2,correct=$3,snapshot=$4,completed_at=NOW() WHERE id=$1`, rec.ID, answer, rec.Correct, string(rawSnapshot)); err != nil {
		return model.LearningAttemptResult{}, err
	}
	if _, err = tx.ExecContext(ctx, `INSERT INTO ielts_attempts(id,user_id,section,test_type,raw_score,max_score,band,source,created_at,attempt_id,receipt) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`, a.ID, rec.UserID, a.Section, a.TestType, a.RawScore, a.MaxScore, a.Band, a.Source, a.CreatedAt, rec.ID, string(rawReceipt)); err != nil {
		return model.LearningAttemptResult{}, err
	}
	if err = tx.Commit(); err != nil {
		return model.LearningAttemptResult{}, err
	}
	return learningAttemptResult(rec), nil
}

// s.mu is held by SubmitLearningAttempt, serializing the same receipt invariant
// as the database row lock. History readers cannot see a half-finished record.
func (s *Store) submitIELTSReadingMemory(rec LearningAttemptRecord, answer string) (model.LearningAttemptResult, error) {
	if _, ok := s.mem.users[rec.UserID]; !ok {
		return model.LearningAttemptResult{}, ErrNotFound
	}
	rec, a, _, err := completeIELTSReading(rec, answer)
	if err != nil {
		return model.LearningAttemptResult{}, err
	}
	state := s.ieltsMemory()
	state.mu.Lock()
	defer state.mu.Unlock()
	state.attempts[rec.UserID] = append(state.attempts[rec.UserID], cloneIELTSAttempt(a))
	s.learningAttempts[rec.ID] = rec
	return learningAttemptResult(rec), nil
}
