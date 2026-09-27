package store

import (
	"context"
	"database/sql"
	"errors"
	"strings"
	"time"

	"github.com/Loccao102/LocCaoEnglish/backend/internal/model"
)

var ErrAttemptConflict = errors.New("learning attempt payload conflicts with the recorded result")
var ErrAttemptOwner = errors.New("learning attempt does not belong to this user")

type LearningAttemptRecord struct {
	ID               string
	UserID           string
	RequestID        string
	Activity         string
	Skill            string
	ItemKey          string
	CEFRLevel        string
	ContentVersion   string
	RulesVersion     string
	Prompt           string
	CorrectAnswer    string
	Feedback         string
	Status           string
	SubmittedAnswer  string
	Correct          bool
	XPDelta          int
	ResultConfidence float64
	ResultLevel      int
	ReviewAdded      bool
	CreatedAt        time.Time
}

const learningAttemptSchemaSQL = `
CREATE TABLE IF NOT EXISTS learning_attempts(
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  request_id TEXT NOT NULL,
  activity TEXT NOT NULL,
  skill TEXT NOT NULL DEFAULT 'Vocabulary',
  item_key TEXT NOT NULL,
  cefr_level TEXT NOT NULL,
  content_version TEXT NOT NULL,
  rules_version TEXT NOT NULL,
  prompt TEXT NOT NULL DEFAULT '',
  correct_answer TEXT NOT NULL,
  feedback TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active',
  submitted_answer TEXT NOT NULL DEFAULT '',
  correct BOOLEAN NOT NULL DEFAULT FALSE,
  xp_delta INTEGER NOT NULL DEFAULT 0,
  result_confidence DOUBLE PRECISION NOT NULL DEFAULT 0,
  result_level INTEGER NOT NULL DEFAULT 0,
  review_added BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ NULL,
  UNIQUE(user_id, request_id)
);
ALTER TABLE learning_attempts ADD COLUMN IF NOT EXISTS skill TEXT NOT NULL DEFAULT 'Vocabulary';
CREATE INDEX IF NOT EXISTS idx_learning_attempts_user_created ON learning_attempts(user_id, created_at DESC);
`

func (s *Store) StartLearningAttempt(ctx context.Context, userID, requestID, activity, skill, itemKey, cefrLevel, contentVersion, rulesVersion, prompt, correctAnswer, feedback string) (LearningAttemptRecord, bool, error) {
	if s.db != nil {
		id := newID()
		result, err := s.db.ExecContext(ctx, `
			INSERT INTO learning_attempts(id,user_id,request_id,activity,skill,item_key,cefr_level,content_version,rules_version,prompt,correct_answer,feedback,status,created_at)
			VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'active',NOW())
			ON CONFLICT(user_id,request_id) DO NOTHING
		`, id, userID, requestID, activity, skill, itemKey, cefrLevel, contentVersion, rulesVersion, prompt, correctAnswer, feedback)
		if err != nil { return LearningAttemptRecord{}, false, err }
		rows, _ := result.RowsAffected()
		rec, err := s.learningAttemptByRequest(ctx, userID, requestID)
		return rec, rows == 1, err
	}

	s.mu.Lock()
	defer s.mu.Unlock()
	for _, rec := range s.learningAttempts {
		if rec.UserID == userID && rec.RequestID == requestID {
			return rec, false, nil
		}
	}
	rec := LearningAttemptRecord{
		ID: newID(), UserID: userID, RequestID: requestID, Activity: activity, Skill: skill, ItemKey: itemKey,
		CEFRLevel: cefrLevel, ContentVersion: contentVersion, RulesVersion: rulesVersion,
		Prompt: prompt, CorrectAnswer: correctAnswer, Feedback: feedback, Status: "active", CreatedAt: time.Now().UTC(),
	}
	s.learningAttempts[rec.ID] = rec
	return rec, true, nil
}

func (s *Store) SubmitLearningAttempt(ctx context.Context, userID, attemptID, answer string) (model.LearningAttemptResult, error) {
	answer = strings.TrimSpace(answer)
	if s.db != nil {
		tx, err := s.db.BeginTx(ctx, nil)
		if err != nil { return model.LearningAttemptResult{}, err }
		defer tx.Rollback()

		rec, err := learningAttemptFromRow(tx.QueryRowContext(ctx, `
			SELECT id,user_id,request_id,activity,skill,item_key,cefr_level,content_version,rules_version,prompt,correct_answer,feedback,status,submitted_answer,correct,xp_delta,result_confidence,result_level,review_added,created_at
			FROM learning_attempts WHERE id=$1 FOR UPDATE
		`, attemptID))
		if errors.Is(err, sql.ErrNoRows) { return model.LearningAttemptResult{}, ErrNotFound }
		if err != nil { return model.LearningAttemptResult{}, err }
		if rec.UserID != userID { return model.LearningAttemptResult{}, ErrAttemptOwner }
		if rec.Status == "completed" {
			if !sameAnswer(rec.SubmittedAnswer, answer) { return model.LearningAttemptResult{}, ErrAttemptConflict }
			return learningAttemptResult(rec), nil
		}

		correct := sameAnswer(rec.CorrectAnswer, answer)
		accuracy, xp := 0.0, 0
		if correct { accuracy, xp = 1, 20 }
		var old float64
		err = tx.QueryRowContext(ctx, `SELECT confidence FROM user_skills WHERE user_id=$1 AND skill=$2 FOR UPDATE`, userID, rec.Skill).Scan(&old)
		if errors.Is(err, sql.ErrNoRows) {
			old = .35
			_, err = tx.ExecContext(ctx, `INSERT INTO user_skills(user_id,skill,confidence,level,updated_at) VALUES($1,$2,$3,$4,NOW())`, userID, rec.Skill, old, levelFor(old))
		}
		if err != nil { return model.LearningAttemptResult{}, err }
		next := old*.75 + accuracy*.25
		level := levelFor(next)
		if _, err = tx.ExecContext(ctx, `UPDATE user_skills SET confidence=$3,level=$4,updated_at=NOW() WHERE user_id=$1 AND skill=$2`, userID, rec.Skill, next, level); err != nil {
			return model.LearningAttemptResult{}, err
		}
		if xp > 0 {
			if _, err = tx.ExecContext(ctx, `UPDATE users SET xp=xp+$2 WHERE id=$1`, userID, xp); err != nil {
				return model.LearningAttemptResult{}, err
			}
		}
		reviewAdded := !correct
		if reviewAdded {
			if _, err = tx.ExecContext(ctx, `
				INSERT INTO review_items(user_id,item_key,kind,prompt,answer,due_at,interval_days,ease,failures)
				VALUES($1,$2,$3,$4,$5,NOW(),1,2.5,1)
				ON CONFLICT(user_id,item_key) DO UPDATE SET prompt=EXCLUDED.prompt,answer=EXCLUDED.answer,due_at=NOW(),failures=review_items.failures+1
			`, userID, rec.ItemKey, rec.Activity, rec.Prompt, rec.CorrectAnswer); err != nil {
				return model.LearningAttemptResult{}, err
			}
		}
		if _, err = tx.ExecContext(ctx, `
			UPDATE learning_attempts
			SET status='completed',submitted_answer=$2,correct=$3,xp_delta=$4,result_confidence=$5,result_level=$6,review_added=$7,completed_at=NOW()
			WHERE id=$1
		`, rec.ID, answer, correct, xp, next, level, reviewAdded); err != nil {
			return model.LearningAttemptResult{}, err
		}
		if err = tx.Commit(); err != nil { return model.LearningAttemptResult{}, err }
		rec.Status, rec.SubmittedAnswer, rec.Correct, rec.XPDelta = "completed", answer, correct, xp
		rec.ResultConfidence, rec.ResultLevel, rec.ReviewAdded = next, level, reviewAdded
		return learningAttemptResult(rec), nil
	}

	s.mu.Lock()
	defer s.mu.Unlock()
	rec, ok := s.learningAttempts[attemptID]
	if !ok { return model.LearningAttemptResult{}, ErrNotFound }
	if rec.UserID != userID { return model.LearningAttemptResult{}, ErrAttemptOwner }
	if rec.Status == "completed" {
		if !sameAnswer(rec.SubmittedAnswer, answer) { return model.LearningAttemptResult{}, ErrAttemptConflict }
		return learningAttemptResult(rec), nil
	}
	skills := s.mem.skills[userID]
	if skills == nil { return model.LearningAttemptResult{}, ErrNotFound }
	skill, ok := skills[rec.Skill]
	if !ok { skill = model.Skill{Name: rec.Skill, Confidence: .35, Level: levelFor(.35), UpdatedAt: time.Now()} }
	correct := sameAnswer(rec.CorrectAnswer, answer)
	accuracy, xp := 0.0, 0
	if correct { accuracy, xp = 1, 20 }
	next := skill.Confidence*.75 + accuracy*.25
	skill.Confidence, skill.Level, skill.UpdatedAt = next, levelFor(next), time.Now()
	skills[rec.Skill] = skill
	if xp > 0 {
		account := s.mem.users[userID]
		account.user.XP += xp
		s.mem.users[userID] = account
	}
	reviewAdded := !correct
	if reviewAdded {
		if s.mem.reviews[userID] == nil { s.mem.reviews[userID] = map[string]model.ReviewItem{} }
		item := s.mem.reviews[userID][rec.ItemKey]
		item.ItemKey, item.Kind, item.Prompt, item.Answer = rec.ItemKey, rec.Activity, rec.Prompt, rec.CorrectAnswer
		item.DueAt, item.IntervalDays = time.Now(), 1
		if item.Ease == 0 { item.Ease = 2.5 }
		item.Failures++
		s.mem.reviews[userID][rec.ItemKey] = item
	}
	rec.Status, rec.SubmittedAnswer, rec.Correct, rec.XPDelta = "completed", answer, correct, xp
	rec.ResultConfidence, rec.ResultLevel, rec.ReviewAdded = next, skill.Level, reviewAdded
	s.learningAttempts[attemptID] = rec
	return learningAttemptResult(rec), nil
}

func (s *Store) learningAttemptByRequest(ctx context.Context, userID, requestID string) (LearningAttemptRecord, error) {
	return learningAttemptFromRow(s.db.QueryRowContext(ctx, `
		SELECT id,user_id,request_id,activity,skill,item_key,cefr_level,content_version,rules_version,prompt,correct_answer,feedback,status,submitted_answer,correct,xp_delta,result_confidence,result_level,review_added,created_at
		FROM learning_attempts WHERE user_id=$1 AND request_id=$2
	`, userID, requestID))
}

type learningRow interface{ Scan(dest ...any) error }

func learningAttemptFromRow(row learningRow) (LearningAttemptRecord, error) {
	var rec LearningAttemptRecord
	err := row.Scan(&rec.ID,&rec.UserID,&rec.RequestID,&rec.Activity,&rec.Skill,&rec.ItemKey,&rec.CEFRLevel,&rec.ContentVersion,&rec.RulesVersion,&rec.Prompt,&rec.CorrectAnswer,&rec.Feedback,&rec.Status,&rec.SubmittedAnswer,&rec.Correct,&rec.XPDelta,&rec.ResultConfidence,&rec.ResultLevel,&rec.ReviewAdded,&rec.CreatedAt)
	return rec, err
}

func learningAttemptResult(rec LearningAttemptRecord) model.LearningAttemptResult {
	return model.LearningAttemptResult{
		AttemptID: rec.ID, Status: rec.Status, Correct: rec.Correct, CorrectAnswer: rec.CorrectAnswer,
		Feedback: rec.Feedback, XPDelta: rec.XPDelta, NewConfidence: rec.ResultConfidence,
		Level: rec.ResultLevel, ReviewAdded: rec.ReviewAdded, ContentVersion: rec.ContentVersion, RulesVersion: rec.RulesVersion,
	}
}

func sameAnswer(left, right string) bool {
	return strings.EqualFold(strings.TrimSpace(left), strings.TrimSpace(right))
}
