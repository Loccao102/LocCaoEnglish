package store

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/Loccao102/LocCaoEnglish/backend/internal/learning"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/model"
)

type learningRecord struct {
	Owner      string
	Attempt    learning.Attempt
	Submission *learning.Submission
	Result     *learning.Verdict
}

// Keep in sync with migration 014. Startup and explicit migrations are idempotent.
const learningSchema = `
CREATE TABLE IF NOT EXISTS learning_attempts (id TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id) ON DELETE CASCADE,request_id UUID NOT NULL,snapshot JSONB NOT NULL,submission JSONB,verdict JSONB,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE UNIQUE INDEX IF NOT EXISTS learning_request_owner ON learning_attempts ((COALESCE(user_id,'')),request_id);
CREATE TABLE IF NOT EXISTS learning_daily_rewards (user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,content_id TEXT NOT NULL,content_version INTEGER NOT NULL,reward_day DATE NOT NULL,attempt_id TEXT NOT NULL REFERENCES learning_attempts(id) ON DELETE CASCADE,PRIMARY KEY(user_id,content_id,content_version,reward_day));
ALTER TABLE attempts ADD COLUMN IF NOT EXISTS grading_source TEXT NOT NULL DEFAULT 'legacy-client';
ALTER TABLE attempts ADD COLUMN IF NOT EXISTS content_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE attempts ADD COLUMN IF NOT EXISTS rules_version INTEGER NOT NULL DEFAULT 0;
`

func (s *Store) EnsureLearningAttempts(ctx context.Context) error {
	if s.db == nil {
		return nil
	}
	_, err := s.db.ExecContext(ctx, learningSchema)
	return err
}
func cloneLearningView(a learning.Attempt, result *learning.Verdict) learning.View {
	v := a.View
	v.Choices = append([]learning.Choice(nil), v.Choices...)
	if result != nil {
		copy := *result
		v.Result = &copy
	}
	return v
}
func (s *Store) CreateLearningAttempt(ctx context.Context, owner string, in learning.Create) (learning.View, error) {
	if !learning.ValidCreate(in) {
		return learning.View{}, learning.ErrInvalid
	}
	if owner != "" {
		if _, err := s.GetUser(ctx, owner); err != nil {
			return learning.View{}, err
		}
	}
	a, err := learning.New(in, owner != "", time.Now().UTC())
	if err != nil {
		return learning.View{}, err
	}
	if s.db != nil {
		raw, err := json.Marshal(a)
		if err != nil {
			return learning.View{}, err
		}
		_, err = s.db.ExecContext(ctx, `INSERT INTO learning_attempts(id,user_id,request_id,snapshot) VALUES($1,NULLIF($2,''),$3,$4) ON CONFLICT DO NOTHING`, a.View.ID, owner, in.RequestID, string(raw))
		if err != nil {
			return learning.View{}, err
		}
		var id string
		err = s.db.QueryRowContext(ctx, `SELECT id FROM learning_attempts WHERE COALESCE(user_id,'')=$1 AND request_id=$2`, owner, in.RequestID).Scan(&id)
		if err != nil {
			return learning.View{}, err
		}
		v, err := s.GetLearningAttempt(ctx, owner, id)
		if err == nil && (v.Pack != in.Pack || v.Round != in.Round) {
			return learning.View{}, learning.ErrConflict
		}
		return v, err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.learning == nil {
		s.learning = map[string]learningRecord{}
		s.learningRequests = map[string]string{}
		s.learningRewards = map[string]bool{}
	}
	key := owner + ":" + in.RequestID
	if id, ok := s.learningRequests[key]; ok {
		r := s.learning[id]
		if r.Attempt.View.Pack != in.Pack || r.Attempt.View.Round != in.Round {
			return learning.View{}, learning.ErrConflict
		}
		return cloneLearningView(r.Attempt, r.Result), nil
	}
	s.learning[a.View.ID] = learningRecord{Owner: owner, Attempt: a}
	s.learningRequests[key] = a.View.ID
	return cloneLearningView(a, nil), nil
}
func (s *Store) GetLearningAttempt(ctx context.Context, owner, id string) (learning.View, error) {
	if s.db != nil {
		var raw, result []byte
		err := s.db.QueryRowContext(ctx, `SELECT snapshot,verdict FROM learning_attempts WHERE id=$1 AND COALESCE(user_id,'')=$2`, id, owner).Scan(&raw, &result)
		if errors.Is(err, sql.ErrNoRows) {
			return learning.View{}, ErrNotFound
		}
		if err != nil {
			return learning.View{}, err
		}
		var a learning.Attempt
		var v *learning.Verdict
		if err = json.Unmarshal(raw, &a); err != nil {
			return learning.View{}, err
		}
		if len(result) > 0 {
			if err = json.Unmarshal(result, &v); err != nil {
				return learning.View{}, err
			}
		}
		return cloneLearningView(a, v), nil
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	r, ok := s.learning[id]
	if !ok || r.Owner != owner {
		return learning.View{}, ErrNotFound
	}
	return cloneLearningView(r.Attempt, r.Result), nil
}
func learningInput(a learning.Attempt, v learning.Verdict) model.AttemptInput {
	accuracy := 0.0
	if v.Correct {
		accuracy = 1
	}
	return model.AttemptInput{Skill: "Vocabulary", Activity: "word-link", ItemKey: a.View.ContentID, Prompt: a.View.Word + " — " + a.View.Prompt, Answer: v.ActualAnswer, Accuracy: accuracy}
}
func (s *Store) SubmitLearningAttempt(ctx context.Context, owner, id string, in learning.Submission) (learning.Verdict, error) {
	if s.db != nil {
		return s.submitLearningDB(ctx, owner, id, in)
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	r, ok := s.learning[id]
	if !ok || r.Owner != owner {
		return learning.Verdict{}, ErrNotFound
	}
	if r.Result != nil {
		if *r.Submission != in {
			return learning.Verdict{}, learning.ErrConflict
		}
		return *r.Result, nil
	}
	now := time.Now().UTC()
	v, err := r.Attempt.Grade(in, now)
	if err != nil {
		return v, err
	}
	key := fmt.Sprintf("%s:%s:%d:%s", owner, r.Attempt.View.ContentID, r.Attempt.View.ContentVersion, now.Format("2006-01-02"))
	if owner != "" && !s.learningRewards[key] {
		result, err := s.recordAttemptMemory(owner, learningInput(r.Attempt, v), v.CorrectAnswer)
		if err != nil {
			return learning.Verdict{}, err
		}
		v.XPDelta = result.XPDelta
		v.ReviewAdded = result.ReviewAdded
		v.ProgressionApplied = true
		s.learningRewards[key] = true
	}
	r.Submission = &in
	r.Result = &v
	s.learning[id] = r
	return v, nil
}
func (s *Store) submitLearningDB(ctx context.Context, owner, id string, in learning.Submission) (learning.Verdict, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return learning.Verdict{}, err
	}
	defer tx.Rollback()
	var raw, oldSubmission, oldResult []byte
	err = tx.QueryRowContext(ctx, `SELECT snapshot,submission,verdict FROM learning_attempts WHERE id=$1 AND COALESCE(user_id,'')=$2 FOR UPDATE`, id, owner).Scan(&raw, &oldSubmission, &oldResult)
	if errors.Is(err, sql.ErrNoRows) {
		return learning.Verdict{}, ErrNotFound
	}
	if err != nil {
		return learning.Verdict{}, err
	}
	if len(oldResult) > 0 {
		var previous learning.Submission
		var result learning.Verdict
		if err = json.Unmarshal(oldSubmission, &previous); err != nil {
			return result, err
		}
		if previous != in {
			return result, learning.ErrConflict
		}
		if err = json.Unmarshal(oldResult, &result); err != nil {
			return result, err
		}
		return result, tx.Commit()
	}
	var a learning.Attempt
	if err = json.Unmarshal(raw, &a); err != nil {
		return learning.Verdict{}, err
	}
	now := time.Now().UTC()
	v, err := a.Grade(in, now)
	if err != nil {
		return v, err
	}
	if owner != "" {
		claim, err := tx.ExecContext(ctx, `INSERT INTO learning_daily_rewards(user_id,content_id,content_version,reward_day,attempt_id) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`, owner, a.View.ContentID, a.View.ContentVersion, now.Format("2006-01-02"), id)
		if err != nil {
			return v, err
		}
		count, err := claim.RowsAffected()
		if err != nil {
			return v, err
		}
		if count == 1 {
			result, err := recordAttemptTx(ctx, tx, owner, learningInput(a, v), v.CorrectAnswer, id)
			if err != nil {
				return v, err
			}
			v.XPDelta = result.XPDelta
			v.ReviewAdded = result.ReviewAdded
			v.ProgressionApplied = true
			if _, err = tx.ExecContext(ctx, `UPDATE attempts SET grading_source='server-objective',content_version=$2,rules_version=$3 WHERE id=$1`, id, a.View.ContentVersion, a.View.RulesVersion); err != nil {
				return v, err
			}
		}
	}
	submission, err := json.Marshal(in)
	if err != nil {
		return v, err
	}
	result, err := json.Marshal(v)
	if err != nil {
		return v, err
	}
	if _, err = tx.ExecContext(ctx, `UPDATE learning_attempts SET submission=$2,verdict=$3 WHERE id=$1`, id, string(submission), string(result)); err != nil {
		return v, err
	}
	return v, tx.Commit()
}
