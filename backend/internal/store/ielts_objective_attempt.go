package store

import (
	"context"
	"database/sql"
	"encoding/json"
	"time"

	"github.com/Loccao102/LocCaoEnglish/backend/internal/learning"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/model"
)

func validIELTSRules(rec LearningAttemptRecord) bool {
	return rec.Activity == "ielts-reading" && rec.RulesVersion == learning.IELTSReadingRulesVersion ||
		rec.Activity == "ielts-listening" && rec.RulesVersion == learning.IELTSListeningRulesVersion
}

func gradeIELTSAttempt(rec LearningAttemptRecord, answer string) (*model.IELTSReadingResult, error) {
	if rec.Activity == "ielts-listening" {
		paper, audio := rec.Snapshot.Prompt.ListeningPaper, rec.Snapshot.Listening
		if paper == nil || len(paper.Sections) != 4 || audio == nil || len(audio.Transcripts) != 4 {
			return nil, ErrAttemptInput
		}
		for _, part := range paper.Sections {
			if audio.Transcripts[part.ID] == "" {
				return nil, ErrAttemptInput
			}
		}
		return learning.GradeIELTSListening(paper, rec.Snapshot.IELTS, answer)
	}
	return learning.GradeIELTSReading(rec.Snapshot.Prompt.Reading, rec.Snapshot.IELTS, answer)
}

func ieltsObjectiveResult(rec LearningAttemptRecord) *model.IELTSReadingResult {
	if !learning.IsIELTSObjective(rec.Activity) || rec.Status != "completed" || rec.Snapshot.IELTS == nil || rec.Snapshot.IELTS.Result == nil {
		return nil
	}
	result := *rec.Snapshot.IELTS.Result
	result.Answers = append([]model.IELTSReadingAnswer(nil), result.Answers...)
	return &result
}

func completeIELTSObjective(rec LearningAttemptRecord, answer string) (LearningAttemptRecord, model.IELTSAttempt, ieltsReceipt, error) {
	result, err := gradeIELTSAttempt(rec, answer)
	if err != nil {
		return rec, model.IELTSAttempt{}, ieltsReceipt{}, ErrAttemptInput
	}
	rec = cloneLearningRecord(rec)
	rec.Status, rec.SubmittedAnswer, rec.Correct = "completed", answer, result.RawScore == result.MaxScore
	rec.Snapshot.IELTS.Result = result
	// Evidence-only completion never consumes a daily reward, changes skill
	// confidence, creates a review, or writes the old mastery attempts table.
	rec.XPDelta, rec.ResultConfidence, rec.ResultLevel, rec.ReviewAdded, rec.ProgressionApplied = 0, 0, 0, false, false
	a := model.IELTSAttempt{ID: newID(), AttemptID: rec.ID, Section: result.Section, TestType: "academic", RawScore: &result.RawScore, MaxScore: &result.MaxScore, Band: result.Band, Source: learning.IELTSReadingEvidence, CreatedAt: time.Now().UTC(), ContentVersion: rec.ContentVersion, RulesVersion: rec.RulesVersion, MethodVersion: result.MethodVersion, Provider: result.Provider, Evidence: learning.IELTSReadingEvidence, Legacy: false}
	receipt := ieltsReceipt{Evidence: a.Evidence, ContentVersion: rec.ContentVersion, RulesVersion: rec.RulesVersion, ActualAnswer: answer, Result: result, Listening: ListeningEvidenceOf(rec, true)}
	return rec, a, receipt, nil
}

// Called under the shared attempt FOR UPDATE lock; the history and verdict
// commit together. No nested transaction or independent history writer.
func (s *Store) submitIELTSObjectiveTx(ctx context.Context, tx *sql.Tx, rec LearningAttemptRecord, answer string) (model.LearningAttemptResult, error) {
	rec, a, receipt, err := completeIELTSObjective(rec, answer)
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
	if err = tx.QueryRowContext(ctx, `UPDATE learning_attempts SET status='completed',submitted_answer=$2,correct=$3,snapshot=$4,completed_at=clock_timestamp() WHERE id=$1 RETURNING completed_at`, rec.ID, answer, rec.Correct, string(rawSnapshot)).Scan(&rec.CompletedAt); err != nil {
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
func (s *Store) submitIELTSObjectiveMemory(rec LearningAttemptRecord, answer string) (model.LearningAttemptResult, error) {
	if _, ok := s.mem.users[rec.UserID]; !ok {
		return model.LearningAttemptResult{}, ErrNotFound
	}
	rec, a, _, err := completeIELTSObjective(rec, answer)
	if err != nil {
		return model.LearningAttemptResult{}, err
	}
	state := s.ieltsMemory()
	state.mu.Lock()
	defer state.mu.Unlock()
	state.attempts[rec.UserID] = append(state.attempts[rec.UserID], cloneIELTSAttempt(a))
	rec.CompletedAt = time.Now().UTC()
	s.learningAttempts[rec.ID] = rec
	return learningAttemptResult(rec), nil
}
