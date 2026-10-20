package store

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"sort"
	"strings"
	"time"

	"github.com/Loccao102/LocCaoEnglish/backend/internal/evaluation"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/model"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/writing"
)

type writingRecord struct {
	UserID  string
	Attempt writing.Attempt
}

// Keep aligned with migration 019. The completed snapshot is the history receipt;
// no independent history insert can succeed without its matching essay/feedback.
const writingSchemaSQL = `
CREATE TABLE IF NOT EXISTS ielts_writing_attempts (
 id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 request_id TEXT NOT NULL,snapshot JSONB NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 UNIQUE(user_id,request_id));
CREATE INDEX IF NOT EXISTS writing_owner_updated ON ielts_writing_attempts(user_id,updated_at DESC);`

func cloneWriting(a writing.Attempt) writing.Attempt {
	b, _ := json.Marshal(a)
	var out writing.Attempt
	_ = json.Unmarshal(b, &out)
	return out
}
func (s *Store) StartWriting(ctx context.Context, owner string, in writing.StartInput) (writing.Attempt, error) {
	if owner == "" || !writing.ValidRequest(in.RequestID) {
		return writing.Attempt{}, writing.ErrInput
	}
	if _, err := s.GetUser(ctx, owner); err != nil {
		return writing.Attempt{}, err
	}
	// Return old create requests before inspecting current catalog or parent state.
	if old, err := s.writingByRequest(ctx, owner, in.RequestID); err == nil {
		if old.ParentID != in.ParentID {
			return old, writing.ErrConflict
		}
		return old, nil
	} else if !errors.Is(err, ErrNotFound) {
		return writing.Attempt{}, err
	}
	now := time.Now().UTC()
	a := writing.Attempt{ID: newID(), RequestID: in.RequestID, ParentID: in.ParentID, Revision: 1, Task: writing.Task, ContentVersion: writing.ContentVersion, RulesVersion: writing.RulesVersion, Status: "draft", CreatedAt: now, UpdatedAt: now}
	if in.ParentID != "" {
		p, err := s.GetWriting(ctx, owner, in.ParentID)
		if err != nil {
			return a, err
		}
		if p.Status != "completed" && p.Status != "failed" {
			return a, writing.ErrConflict
		}
		a.Revision, a.Essay, a.Task, a.ContentVersion, a.RulesVersion = p.Revision+1, p.Essay, p.Task, p.ContentVersion, p.RulesVersion
	}
	if s.db != nil {
		raw, _ := json.Marshal(a)
		_, err := s.db.ExecContext(ctx, `INSERT INTO ielts_writing_attempts(id,user_id,request_id,snapshot,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$5) ON CONFLICT(user_id,request_id) DO NOTHING`, a.ID, owner, in.RequestID, string(raw), now)
		if err != nil {
			return a, err
		}
		a, err = s.writingByRequest(ctx, owner, in.RequestID)
		if err == nil && a.ParentID != in.ParentID {
			err = writing.ErrConflict
		}
		return a, err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.writingAttempts == nil {
		s.writingAttempts = map[string]writingRecord{}
	}
	for _, r := range s.writingAttempts {
		if r.UserID == owner && r.Attempt.RequestID == in.RequestID {
			if r.Attempt.ParentID != in.ParentID {
				return writing.Attempt{}, writing.ErrConflict
			}
			return cloneWriting(r.Attempt), nil
		}
	}
	s.writingAttempts[a.ID] = writingRecord{owner, cloneWriting(a)}
	return a, nil
}
func (s *Store) writingByRequest(ctx context.Context, owner, request string) (writing.Attempt, error) {
	if s.db != nil {
		var raw []byte
		err := s.db.QueryRowContext(ctx, `SELECT snapshot FROM ielts_writing_attempts WHERE user_id=$1 AND request_id=$2`, owner, request).Scan(&raw)
		return decodeWriting(raw, err)
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	for _, r := range s.writingAttempts {
		if r.UserID == owner && r.Attempt.RequestID == request {
			return cloneWriting(r.Attempt), nil
		}
	}
	return writing.Attempt{}, ErrNotFound
}
func decodeWriting(raw []byte, err error) (writing.Attempt, error) {
	var a writing.Attempt
	if errors.Is(err, sql.ErrNoRows) {
		err = ErrNotFound
	}
	if err == nil {
		err = json.Unmarshal(raw, &a)
	}
	return a, err
}
func (s *Store) GetWriting(ctx context.Context, owner, id string) (writing.Attempt, error) {
	if s.db != nil {
		var raw []byte
		err := s.db.QueryRowContext(ctx, `SELECT snapshot FROM ielts_writing_attempts WHERE user_id=$1 AND id=$2`, owner, id).Scan(&raw)
		return decodeWriting(raw, err)
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	r, ok := s.writingAttempts[id]
	if !ok || r.UserID != owner {
		return writing.Attempt{}, ErrNotFound
	}
	return cloneWriting(r.Attempt), nil
}
func (s *Store) ListWriting(ctx context.Context, owner string) ([]writing.Attempt, error) {
	out := []writing.Attempt{}
	if s.db != nil {
		rows, err := s.db.QueryContext(ctx, `SELECT snapshot FROM ielts_writing_attempts WHERE user_id=$1 ORDER BY updated_at DESC,id DESC LIMIT 50`, owner)
		if err != nil {
			return nil, err
		}
		defer rows.Close()
		for rows.Next() {
			var raw []byte
			if err = rows.Scan(&raw); err != nil {
				return nil, err
			}
			a, e := decodeWriting(raw, nil)
			if e != nil {
				return nil, e
			}
			out = append(out, a)
		}
		return out, rows.Err()
	}
	s.mu.RLock()
	for _, r := range s.writingAttempts {
		if r.UserID == owner {
			out = append(out, cloneWriting(r.Attempt))
		}
	}
	s.mu.RUnlock()
	sort.Slice(out, func(i, j int) bool {
		if out[i].UpdatedAt.Equal(out[j].UpdatedAt) {
			return out[i].ID > out[j].ID
		}
		return out[i].UpdatedAt.After(out[j].UpdatedAt)
	})
	if len(out) > 50 {
		out = out[:50]
	}
	return out, nil
}

// Serializes only a short state transition, never provider I/O. Both backends
// use the same transition function and return detached snapshots.
func (s *Store) changeWriting(ctx context.Context, owner, id string, change func(*writing.Attempt) error) (writing.Attempt, error) {
	if s.db != nil {
		tx, err := s.db.BeginTx(ctx, nil)
		if err != nil {
			return writing.Attempt{}, err
		}
		defer tx.Rollback()
		var raw []byte
		err = tx.QueryRowContext(ctx, `SELECT snapshot FROM ielts_writing_attempts WHERE user_id=$1 AND id=$2 FOR UPDATE`, owner, id).Scan(&raw)
		a, err := decodeWriting(raw, err)
		if err != nil {
			return a, err
		}
		if err = change(&a); err != nil {
			return a, err
		}
		raw, err = json.Marshal(a)
		if err != nil {
			return a, err
		}
		_, err = tx.ExecContext(ctx, `UPDATE ielts_writing_attempts SET snapshot=$2,updated_at=$3 WHERE id=$1`, id, string(raw), a.UpdatedAt)
		if err != nil {
			return a, err
		}
		return a, tx.Commit()
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	r, ok := s.writingAttempts[id]
	if !ok || r.UserID != owner {
		return writing.Attempt{}, ErrNotFound
	}
	a := cloneWriting(r.Attempt)
	if err := change(&a); err != nil {
		return a, err
	}
	r.Attempt = cloneWriting(a)
	s.writingAttempts[id] = r
	return a, nil
}
func (s *Store) SaveWritingDraft(ctx context.Context, owner, id string, in writing.SaveInput) (writing.Attempt, error) {
	if in.Version < 0 || !writing.ValidEssay(in.Essay) {
		return writing.Attempt{}, writing.ErrInput
	}
	return s.changeWriting(ctx, owner, id, func(a *writing.Attempt) error {
		if a.RulesVersion != in.RulesVersion || a.RulesVersion != writing.RulesVersion {
			return writing.ErrInput
		}
		if a.Status != "draft" {
			return writing.ErrConflict
		}
		if a.Version == in.Version+1 && a.Essay == in.Essay {
			return nil
		}
		if a.Version != in.Version {
			return writing.ErrConflict
		}
		a.Essay = in.Essay
		a.Version++
		a.UpdatedAt = time.Now().UTC()
		return nil
	})
}
func (s *Store) ClaimWriting(ctx context.Context, owner, id string, in writing.SubmitInput) (writing.Attempt, bool, error) {
	claimed := false
	a, err := s.changeWriting(ctx, owner, id, func(a *writing.Attempt) error {
		if in.RulesVersion != a.RulesVersion || a.RulesVersion != writing.RulesVersion || !writing.ValidEssay(in.Essay) || len(strings.Fields(in.Essay)) < 40 {
			return writing.ErrInput
		}
		if in.Version != a.Version || in.Essay != a.Essay {
			return writing.ErrConflict
		}
		state, acquired, err := evaluation.Claim(evaluation.State{Status: a.Status, Generation: a.Generation, LeaseUntil: a.LeaseUntil}, in.Generation, time.Now().UTC())
		if err != nil {
			return writing.ErrConflict
		}
		if acquired {
			a.Status, a.Generation, a.LeaseUntil = state.Status, state.Generation, state.LeaseUntil
			a.Failure = ""
			a.UpdatedAt = time.Now().UTC()
			claimed = true
		}
		return nil
	})
	return a, claimed, err
}
func (s *Store) FinishWriting(ctx context.Context, owner, id string, generation int, feedback *writing.Feedback) (writing.Attempt, error) {
	return s.changeWriting(ctx, owner, id, func(a *writing.Attempt) error {
		if !evaluation.CanFinish(evaluation.State{Status: a.Status, Generation: a.Generation, LeaseUntil: a.LeaseUntil}, generation) {
			return writing.ErrConflict
		}
		if feedback != nil {
			if err := writing.ValidateFeedback(*feedback, a.Essay); err != nil {
				return err
			}
		}
		now := time.Now().UTC()
		a.LeaseUntil = nil
		a.UpdatedAt = now
		if feedback == nil {
			a.Status = "failed"
			a.Failure = "Feedback is unavailable. Your submitted essay is saved; retry this submission or create a revision."
			return nil
		}
		a.Status = "completed"
		a.CompletedAt = &now
		feedback.Disclaimer = writing.Disclaimer
		a.Feedback = feedback
		return nil
	})
}

func (s *Store) writingHistory(ctx context.Context, owner string) ([]model.IELTSAttempt, error) {
	attempts := []writing.Attempt{}
	if s.db != nil {
		rows, err := s.db.QueryContext(ctx, `SELECT snapshot FROM ielts_writing_attempts WHERE user_id=$1 AND snapshot->>'status'='completed' ORDER BY (snapshot->>'completedAt')::timestamptz DESC,id DESC LIMIT 100`, owner)
		if err != nil {
			return nil, err
		}
		defer rows.Close()
		for rows.Next() {
			var raw []byte
			if err = rows.Scan(&raw); err != nil {
				return nil, err
			}
			a, e := decodeWriting(raw, nil)
			if e != nil {
				return nil, e
			}
			attempts = append(attempts, a)
		}
		if err = rows.Err(); err != nil {
			return nil, err
		}
	} else {
		s.mu.RLock()
		for _, r := range s.writingAttempts {
			if r.UserID == owner && r.Attempt.Status == "completed" {
				attempts = append(attempts, cloneWriting(r.Attempt))
			}
		}
		s.mu.RUnlock()
	}
	out := []model.IELTSAttempt{}
	for _, a := range attempts {
		if a.Feedback == nil || a.Feedback.Overall == nil || a.CompletedAt == nil {
			continue
		}
		out = append(out, model.IELTSAttempt{ID: a.ID, AttemptID: a.ID, Section: "writing", TestType: "academic", Band: *a.Feedback.Overall, Source: "provider-practice-estimate", Evidence: "provider-estimate", Provider: a.Feedback.Provider, MethodVersion: a.Feedback.EvaluatorVersion, ContentVersion: a.ContentVersion, RulesVersion: a.RulesVersion, CreatedAt: *a.CompletedAt})
	}
	return out, nil
}
