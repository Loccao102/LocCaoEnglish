package store

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/Loccao102/LocCaoEnglish/backend/internal/learning"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/model"
)

var ErrAttemptConflict = errors.New("learning attempt payload conflicts with the recorded result")
var ErrAttemptOwner = errors.New("learning attempt does not belong to this user")
var ErrAttemptExpired = errors.New("this round expired; start a new round")
var ErrAttemptInput = errors.New("invalid answer or content/rules version; refresh and try again")

type LearningSnapshot struct {
	Input  model.LearningAttemptStartInput `json:"input"`
	Prompt model.LearningAttemptPrompt     `json:"prompt"`
}

type LearningAttemptRecord struct {
	ID                 string
	UserID             string
	RequestID          string
	Activity           string
	Skill              string
	ItemKey            string
	CEFRLevel          string
	ContentVersion     string
	RulesVersion       string
	Prompt             string
	CorrectAnswer      string
	Feedback           string
	Status             string
	SubmittedAnswer    string
	Correct            bool
	XPDelta            int
	ResultConfidence   float64
	ResultLevel        int
	ReviewAdded        bool
	CreatedAt          time.Time
	Snapshot           LearningSnapshot
	ExpiresAt          time.Time
	ProgressionApplied bool
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
-- Keep aligned with migration 016_learning_recovery.sql.
ALTER TABLE learning_attempts ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE learning_attempts ADD COLUMN IF NOT EXISTS snapshot JSONB NOT NULL DEFAULT '{}';
ALTER TABLE learning_attempts ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE learning_attempts ADD COLUMN IF NOT EXISTS progression_applied BOOLEAN NOT NULL DEFAULT FALSE;
CREATE UNIQUE INDEX IF NOT EXISTS learning_request_owner ON learning_attempts ((COALESCE(user_id,'')),request_id);
CREATE TABLE IF NOT EXISTS learning_daily_rewards(user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,item_key TEXT NOT NULL,content_version TEXT NOT NULL,reward_day DATE NOT NULL,attempt_id TEXT NOT NULL REFERENCES learning_attempts(id) ON DELETE CASCADE,PRIMARY KEY(user_id,item_key,content_version,reward_day));
ALTER TABLE attempts ADD COLUMN IF NOT EXISTS grading_source TEXT NOT NULL DEFAULT 'legacy-client';
ALTER TABLE attempts ADD COLUMN IF NOT EXISTS content_version TEXT NOT NULL DEFAULT '';
ALTER TABLE attempts ADD COLUMN IF NOT EXISTS rules_version TEXT NOT NULL DEFAULT '';
`

func (s *Store) StartLearningAttempt(ctx context.Context, userID, requestID, activity, skill, itemKey, cefrLevel, contentVersion, rulesVersion, prompt, correctAnswer, feedback string, snapshots ...LearningSnapshot) (LearningAttemptRecord, bool, error) {
	var snapshot LearningSnapshot
	if len(snapshots) > 0 {
		snapshot = snapshots[0]
	}
	raw, err := json.Marshal(snapshot)
	if err != nil {
		return LearningAttemptRecord{}, false, err
	}
	// Break caller-owned slice aliases in memory mode as well as PostgreSQL.
	if err = json.Unmarshal(raw, &snapshot); err != nil {
		return LearningAttemptRecord{}, false, err
	}
	expires := time.Now().UTC().Add(24 * time.Hour)
	if s.db != nil {
		id := newID()
		result, err := s.db.ExecContext(ctx, `
			INSERT INTO learning_attempts(id,user_id,request_id,activity,skill,item_key,cefr_level,content_version,rules_version,prompt,correct_answer,feedback,status,created_at,snapshot,expires_at)
			VALUES($1,NULLIF($2,''),$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'active',NOW(),$13,$14)
			ON CONFLICT DO NOTHING
		`, id, userID, requestID, activity, skill, itemKey, cefrLevel, contentVersion, rulesVersion, prompt, correctAnswer, feedback, string(raw), expires)
		if err != nil {
			return LearningAttemptRecord{}, false, err
		}
		rows, _ := result.RowsAffected()
		rec, err := s.learningAttemptByRequest(ctx, userID, requestID)
		if err == nil && !sameLearningRequest(rec, activity, cefrLevel, snapshot) {
			err = ErrAttemptConflict
		}
		return rec, rows == 1, err
	}

	s.mu.Lock()
	defer s.mu.Unlock()
	for _, rec := range s.learningAttempts {
		if rec.UserID == userID && rec.RequestID == requestID {
			if !sameLearningRequest(rec, activity, cefrLevel, snapshot) {
				return LearningAttemptRecord{}, false, ErrAttemptConflict
			}
			return cloneLearningRecord(rec), false, nil
		}
	}
	rec := LearningAttemptRecord{
		ID: newID(), UserID: userID, RequestID: requestID, Activity: activity, Skill: skill, ItemKey: itemKey,
		CEFRLevel: cefrLevel, ContentVersion: contentVersion, RulesVersion: rulesVersion,
		Prompt: prompt, CorrectAnswer: correctAnswer, Feedback: feedback, Status: "active", CreatedAt: time.Now().UTC(),
		Snapshot: snapshot, ExpiresAt: expires,
	}
	s.learningAttempts[rec.ID] = rec
	return cloneLearningRecord(rec), true, nil
}

func (s *Store) SubmitLearningAttempt(ctx context.Context, userID, attemptID, answer string, versions ...model.LearningAttemptSubmitInput) (model.LearningAttemptResult, error) {
	answer = strings.TrimSpace(answer)
	if s.db != nil {
		tx, err := s.db.BeginTx(ctx, nil)
		if err != nil {
			return model.LearningAttemptResult{}, err
		}
		defer tx.Rollback()

		rec, err := learningAttemptFromRow(tx.QueryRowContext(ctx, `
			SELECT id,COALESCE(user_id,''),request_id,activity,skill,item_key,cefr_level,content_version,rules_version,prompt,correct_answer,feedback,status,submitted_answer,correct,xp_delta,result_confidence,result_level,review_added,created_at,snapshot,expires_at,progression_applied
			FROM learning_attempts WHERE id=$1 FOR UPDATE
		`, attemptID))
		if errors.Is(err, sql.ErrNoRows) {
			return model.LearningAttemptResult{}, ErrNotFound
		}
		if err != nil {
			return model.LearningAttemptResult{}, err
		}
		if rec.UserID != userID {
			return model.LearningAttemptResult{}, ErrAttemptOwner
		}
		if err = validateLearningSubmission(rec, answer, versions); err != nil {
			return model.LearningAttemptResult{}, err
		}
		if rec.Status == "completed" {
			if !sameSubmittedAnswer(rec, answer) {
				return model.LearningAttemptResult{}, ErrAttemptConflict
			}
			return learningAttemptResult(rec), nil
		}

		actual := learningAnswerText(rec, answer)
		correct := sameAnswer(rec.CorrectAnswer, actual)
		applied := false
		if userID != "" {
			claim, err := tx.ExecContext(ctx, `INSERT INTO learning_daily_rewards(user_id,item_key,content_version,reward_day,attempt_id) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`, userID, rec.ItemKey, rec.ContentVersion, time.Now().UTC().Format("2006-01-02"), rec.ID)
			if err != nil {
				return model.LearningAttemptResult{}, err
			}
			n, err := claim.RowsAffected()
			if err != nil {
				return model.LearningAttemptResult{}, err
			}
			applied = n == 1
		}
		accuracy, xp := 0.0, 0
		if correct {
			accuracy = 1
			if applied {
				xp = 20
			}
		}
		next, level, reviewAdded := 0.0, 0, false
		if applied {
			var old float64
			err = tx.QueryRowContext(ctx, `SELECT confidence FROM user_skills WHERE user_id=$1 AND skill=$2 FOR UPDATE`, userID, rec.Skill).Scan(&old)
			if errors.Is(err, sql.ErrNoRows) {
				old = .35
				_, err = tx.ExecContext(ctx, `INSERT INTO user_skills(user_id,skill,confidence,level,updated_at) VALUES($1,$2,$3,$4,NOW())`, userID, rec.Skill, old, levelFor(old))
			}
			if err != nil {
				return model.LearningAttemptResult{}, err
			}
			next = old*.75 + accuracy*.25
			level = levelFor(next)
			if _, err = tx.ExecContext(ctx, `UPDATE user_skills SET confidence=$3,level=$4,updated_at=NOW() WHERE user_id=$1 AND skill=$2`, userID, rec.Skill, next, level); err != nil {
				return model.LearningAttemptResult{}, err
			}
			if xp > 0 {
				if _, err = tx.ExecContext(ctx, `UPDATE users SET xp=xp+$2 WHERE id=$1`, userID, xp); err != nil {
					return model.LearningAttemptResult{}, err
				}
			}
			reviewAdded = !correct
			if reviewAdded {
				if _, err = tx.ExecContext(ctx, `
				INSERT INTO review_items(user_id,item_key,kind,prompt,answer,due_at,interval_days,ease,failures)
				VALUES($1,$2,$3,$4,$5,NOW(),1,2.5,1)
				ON CONFLICT(user_id,item_key) DO UPDATE SET prompt=EXCLUDED.prompt,answer=EXCLUDED.answer,due_at=NOW(),failures=review_items.failures+1
			`, userID, rec.ItemKey, rec.Activity, rec.Prompt, rec.CorrectAnswer); err != nil {
					return model.LearningAttemptResult{}, err
				}
			}
			if _, err = tx.ExecContext(ctx, `INSERT INTO attempts(id,user_id,skill,activity,item_key,prompt,answer,accuracy,duration_sec,grading_source,content_version,rules_version) VALUES($1,$2,$3,$4,$5,$6,$7,$8,0,'server-objective',$9,$10)`, rec.ID, userID, rec.Skill, rec.Activity, rec.ItemKey, rec.Prompt, actual, accuracy, rec.ContentVersion, rec.RulesVersion); err != nil {
				return model.LearningAttemptResult{}, err
			}
		}
		if _, err = tx.ExecContext(ctx, `
			UPDATE learning_attempts
			SET status='completed',submitted_answer=$2,correct=$3,xp_delta=$4,result_confidence=$5,result_level=$6,review_added=$7,completed_at=NOW(),progression_applied=$8
			WHERE id=$1
		`, rec.ID, answer, correct, xp, next, level, reviewAdded, applied); err != nil {
			return model.LearningAttemptResult{}, err
		}
		if err = tx.Commit(); err != nil {
			return model.LearningAttemptResult{}, err
		}
		rec.Status, rec.SubmittedAnswer, rec.Correct, rec.XPDelta = "completed", answer, correct, xp
		rec.ResultConfidence, rec.ResultLevel, rec.ReviewAdded = next, level, reviewAdded
		rec.ProgressionApplied = applied
		return learningAttemptResult(rec), nil
	}

	s.mu.Lock()
	defer s.mu.Unlock()
	rec, ok := s.learningAttempts[attemptID]
	if !ok {
		return model.LearningAttemptResult{}, ErrNotFound
	}
	if rec.UserID != userID {
		return model.LearningAttemptResult{}, ErrAttemptOwner
	}
	if err := validateLearningSubmission(rec, answer, versions); err != nil {
		return model.LearningAttemptResult{}, err
	}
	if rec.Status == "completed" {
		if !sameSubmittedAnswer(rec, answer) {
			return model.LearningAttemptResult{}, ErrAttemptConflict
		}
		return learningAttemptResult(rec), nil
	}
	if s.learningRewards == nil {
		s.learningRewards = map[string]bool{}
	}
	key := fmt.Sprintf("%s:%s:%s:%s", userID, rec.ItemKey, rec.ContentVersion, time.Now().UTC().Format("2006-01-02"))
	applied := userID != "" && !s.learningRewards[key]
	correct := sameAnswer(rec.CorrectAnswer, learningAnswerText(rec, answer))
	accuracy, xp := 0.0, 0
	if correct {
		accuracy = 1
		if applied {
			xp = 20
		}
	}
	next, level, reviewAdded := 0.0, 0, false
	if applied {
		skills := s.mem.skills[userID]
		if skills == nil {
			return model.LearningAttemptResult{}, ErrNotFound
		}
		skill, ok := skills[rec.Skill]
		if !ok {
			skill = model.Skill{Name: rec.Skill, Confidence: .35, Level: levelFor(.35), UpdatedAt: time.Now()}
		}
		next = skill.Confidence*.75 + accuracy*.25
		skill.Confidence, skill.Level, skill.UpdatedAt = next, levelFor(next), time.Now()
		skills[rec.Skill] = skill
		if xp > 0 {
			account := s.mem.users[userID]
			account.user.XP += xp
			s.mem.users[userID] = account
		}
		reviewAdded = !correct
		if reviewAdded {
			if s.mem.reviews[userID] == nil {
				s.mem.reviews[userID] = map[string]model.ReviewItem{}
			}
			item := s.mem.reviews[userID][rec.ItemKey]
			item.ItemKey, item.Kind, item.Prompt, item.Answer = rec.ItemKey, rec.Activity, rec.Prompt, rec.CorrectAnswer
			item.DueAt, item.IntervalDays = time.Now(), 1
			if item.Ease == 0 {
				item.Ease = 2.5
			}
			item.Failures++
			s.mem.reviews[userID][rec.ItemKey] = item
		}
		level = skill.Level
		s.learningRewards[key] = true
	}
	rec.Status, rec.SubmittedAnswer, rec.Correct, rec.XPDelta = "completed", answer, correct, xp
	rec.ResultConfidence, rec.ResultLevel, rec.ReviewAdded = next, level, reviewAdded
	rec.ProgressionApplied = applied
	s.learningAttempts[attemptID] = rec
	return learningAttemptResult(rec), nil
}

func (s *Store) learningAttemptByRequest(ctx context.Context, userID, requestID string) (LearningAttemptRecord, error) {
	return learningAttemptFromRow(s.db.QueryRowContext(ctx, `
		SELECT id,COALESCE(user_id,''),request_id,activity,skill,item_key,cefr_level,content_version,rules_version,prompt,correct_answer,feedback,status,submitted_answer,correct,xp_delta,result_confidence,result_level,review_added,created_at,snapshot,expires_at,progression_applied
		FROM learning_attempts WHERE COALESCE(user_id,'')=$1 AND request_id=$2
	`, userID, requestID))
}

type learningRow interface{ Scan(dest ...any) error }

func learningAttemptFromRow(row learningRow) (LearningAttemptRecord, error) {
	var rec LearningAttemptRecord
	var raw []byte
	err := row.Scan(&rec.ID, &rec.UserID, &rec.RequestID, &rec.Activity, &rec.Skill, &rec.ItemKey, &rec.CEFRLevel, &rec.ContentVersion, &rec.RulesVersion, &rec.Prompt, &rec.CorrectAnswer, &rec.Feedback, &rec.Status, &rec.SubmittedAnswer, &rec.Correct, &rec.XPDelta, &rec.ResultConfidence, &rec.ResultLevel, &rec.ReviewAdded, &rec.CreatedAt, &raw, &rec.ExpiresAt, &rec.ProgressionApplied)
	if err == nil {
		err = json.Unmarshal(raw, &rec.Snapshot)
	}
	return rec, err
}

func learningAttemptResult(rec LearningAttemptRecord) model.LearningAttemptResult {
	return model.LearningAttemptResult{
		AttemptID: rec.ID, Status: rec.Status, Correct: rec.Correct, CorrectAnswer: rec.CorrectAnswer,
		Feedback: rec.Feedback, XPDelta: rec.XPDelta, NewConfidence: rec.ResultConfidence,
		Level: rec.ResultLevel, ReviewAdded: rec.ReviewAdded, ContentVersion: rec.ContentVersion, RulesVersion: rec.RulesVersion,
		ActualAnswer: learningAnswerText(rec, rec.SubmittedAnswer), ProgressionApplied: rec.ProgressionApplied, Evidence: "server-objective",
	}
}

func sameAnswer(left, right string) bool {
	return strings.EqualFold(strings.TrimSpace(left), strings.TrimSpace(right))
}

func sameSubmittedAnswer(rec LearningAttemptRecord, answer string) bool {
	if rec.Activity == "sentence-builder" {
		return rec.SubmittedAnswer == answer
	}
	return sameAnswer(rec.SubmittedAnswer, answer)
}

func sameLearningRequest(rec LearningAttemptRecord, activity, level string, snapshot LearningSnapshot) bool {
	left, _ := json.Marshal(rec.Snapshot.Input)
	right, _ := json.Marshal(snapshot.Input)
	return rec.Activity == activity && rec.CEFRLevel == level && string(left) == string(right)
}
func cloneLearningRecord(rec LearningAttemptRecord) LearningAttemptRecord {
	rec.Snapshot.Prompt.Chunks = append([]model.SentenceChunk(nil), rec.Snapshot.Prompt.Chunks...)
	rec.Snapshot.Prompt.Options = append([]string(nil), rec.Snapshot.Prompt.Options...)
	rec.Snapshot.Input.ExcludeItemKeys = append([]string(nil), rec.Snapshot.Input.ExcludeItemKeys...)
	return rec
}
func validateLearningSubmission(rec LearningAttemptRecord, answer string, versions []model.LearningAttemptSubmitInput) error {
	if len(versions) > 0 && (versions[0].ContentVersion != rec.ContentVersion || versions[0].RulesVersion != rec.RulesVersion) {
		return ErrAttemptInput
	}
	if rec.Status == "completed" {
		return nil
	}
	if !time.Now().Before(rec.ExpiresAt) {
		return ErrAttemptExpired
	}
	if rec.Activity == "sentence-builder" {
		if rec.RulesVersion != learning.SentenceRulesVersion {
			return ErrAttemptInput
		}
		if _, err := learning.ResolveSentenceAnswer(rec.Snapshot.Prompt.Chunks, answer); err != nil {
			return ErrAttemptInput
		}
		return nil
	}
	if len(versions) > 0 {
		for _, option := range rec.Snapshot.Prompt.Options {
			if sameAnswer(option, answer) {
				return nil
			}
		}
		return ErrAttemptInput
	}
	return nil
}

// Keep the immutable wire answer for retries; show/store language, not opaque IDs,
// in the verdict and learning evidence. Resolve only against the saved snapshot.
func learningAnswerText(rec LearningAttemptRecord, answer string) string {
	if rec.Activity == "sentence-builder" {
		text, _ := learning.ResolveSentenceAnswer(rec.Snapshot.Prompt.Chunks, answer)
		return text
	}
	return answer
}
func (s *Store) GetLearningAttempt(ctx context.Context, userID, id string) (LearningAttemptRecord, error) {
	if s.db != nil {
		rec, err := learningAttemptFromRow(s.db.QueryRowContext(ctx, `SELECT id,COALESCE(user_id,''),request_id,activity,skill,item_key,cefr_level,content_version,rules_version,prompt,correct_answer,feedback,status,submitted_answer,correct,xp_delta,result_confidence,result_level,review_added,created_at,snapshot,expires_at,progression_applied FROM learning_attempts WHERE id=$1 AND COALESCE(user_id,'')=$2`, id, userID))
		if errors.Is(err, sql.ErrNoRows) {
			err = ErrNotFound
		}
		return rec, err
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	rec, ok := s.learningAttempts[id]
	if !ok || rec.UserID != userID {
		return LearningAttemptRecord{}, ErrNotFound
	}
	return cloneLearningRecord(rec), nil
}
func LearningResult(rec LearningAttemptRecord) *model.LearningAttemptResult {
	if rec.Status != "completed" {
		return nil
	}
	result := learningAttemptResult(rec)
	return &result
}

func (s *Store) FindLearningRequest(ctx context.Context, owner string, input model.LearningAttemptStartInput) (LearningAttemptRecord, error) {
	var rec LearningAttemptRecord
	if s.db != nil {
		var err error
		rec, err = s.learningAttemptByRequest(ctx, owner, input.RequestID)
		if errors.Is(err, sql.ErrNoRows) {
			return rec, ErrNotFound
		}
		if err != nil {
			return rec, err
		}
	} else {
		s.mu.RLock()
		defer s.mu.RUnlock()
		for _, candidate := range s.learningAttempts {
			if candidate.UserID == owner && candidate.RequestID == input.RequestID {
				rec = candidate
				break
			}
		}
		if rec.ID == "" {
			return rec, ErrNotFound
		}
	}
	if !sameLearningRequest(rec, input.Activity, input.CEFRLevel, LearningSnapshot{Input: input}) {
		return LearningAttemptRecord{}, ErrAttemptConflict
	}
	return cloneLearningRecord(rec), nil
}
