package store

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"sort"
	"time"

	"github.com/Loccao102/LocCaoEnglish/backend/internal/acoustic"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/evaluation"
)

type acousticRecord struct {
	Owner   string
	Receipt acoustic.Receipt
}

const acousticSchemaSQL = `
CREATE TABLE IF NOT EXISTS speaking_assessments (
 id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 attempt_id TEXT NOT NULL REFERENCES learning_attempts(id) ON DELETE CASCADE,
 request_id TEXT NOT NULL,snapshot JSONB NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 UNIQUE(user_id,request_id));
CREATE INDEX IF NOT EXISTS speaking_assessment_owner ON speaking_assessments(user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS speaking_assessment_attempt ON speaking_assessments(user_id,attempt_id,created_at DESC);`

func (s *Store) EnsureAcoustic(ctx context.Context) error {
	if s.db == nil {
		return nil
	}
	_, err := s.db.ExecContext(ctx, acousticSchemaSQL)
	return err
}
func cloneAcoustic(r acoustic.Receipt) acoustic.Receipt {
	raw, _ := json.Marshal(r)
	var out acoustic.Receipt
	_ = json.Unmarshal(raw, &out)
	return out
}
func decodeAcoustic(raw []byte, err error) (acoustic.Receipt, error) {
	var r acoustic.Receipt
	if errors.Is(err, sql.ErrNoRows) {
		err = ErrNotFound
	}
	if err == nil {
		err = json.Unmarshal(raw, &r)
	}
	return r, err
}
func sameAcoustic(r acoustic.Receipt, in acoustic.StartInput, sample acoustic.Sample) bool {
	return r.AttemptID == in.AttemptID && r.Transcript == in.Transcript && r.ContentVersion == in.ContentVersion && r.TranscriptRulesVersion == in.TranscriptRulesVersion && r.RulesVersion == in.RulesVersion && r.Sample == sample
}
func (s *Store) acousticByRequest(ctx context.Context, owner, request string) (acoustic.Receipt, error) {
	if s.db != nil {
		var raw []byte
		err := s.db.QueryRowContext(ctx, `SELECT snapshot FROM speaking_assessments WHERE user_id=$1 AND request_id=$2`, owner, request).Scan(&raw)
		return decodeAcoustic(raw, err)
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	for _, rec := range s.acousticReceipts {
		if rec.Owner == owner && rec.Receipt.RequestID == request {
			return cloneAcoustic(rec.Receipt), nil
		}
	}
	return acoustic.Receipt{}, ErrNotFound
}
func (s *Store) StartAcoustic(ctx context.Context, owner string, in acoustic.StartInput, sample acoustic.Sample) (acoustic.Receipt, error) {
	if owner == "" || !evaluation.ValidRequestID(in.RequestID) || in.RulesVersion != acoustic.RulesVersion || !acoustic.ValidTranscript(in.Transcript) || !acoustic.ValidSample(sample) {
		return acoustic.Receipt{}, acoustic.ErrInput
	}
	if old, err := s.acousticByRequest(ctx, owner, in.RequestID); err == nil {
		if !sameAcoustic(old, in, sample) {
			return acoustic.Receipt{}, acoustic.ErrConflict
		}
		return old, nil
	} else if !errors.Is(err, ErrNotFound) {
		return acoustic.Receipt{}, err
	}
	parent, err := s.GetLearningAttempt(ctx, owner, in.AttemptID)
	if err != nil {
		return acoustic.Receipt{}, err
	}
	if parent.Activity != "shadowing" || parent.RulesVersion != "shadowing.v1" || parent.ContentVersion != in.ContentVersion || parent.RulesVersion != in.TranscriptRulesVersion || parent.Snapshot.Prompt.Question == "" || !parent.ExpiresAt.After(time.Now()) {
		return acoustic.Receipt{}, acoustic.ErrInput
	}
	if _, err = s.GetUser(ctx, owner); err != nil {
		return acoustic.Receipt{}, err
	}
	now := time.Now().UTC()
	r := acoustic.Receipt{ID: newID(), RequestID: in.RequestID, AttemptID: in.AttemptID, Reference: parent.Snapshot.Prompt.Question, Transcript: in.Transcript, ContentVersion: parent.ContentVersion, TranscriptRulesVersion: parent.RulesVersion, RulesVersion: acoustic.RulesVersion, Sample: sample, Status: "ready", CreatedAt: now, UpdatedAt: now}
	if s.db != nil {
		raw, _ := json.Marshal(r)
		_, err = s.db.ExecContext(ctx, `INSERT INTO speaking_assessments(id,user_id,attempt_id,request_id,snapshot,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$6) ON CONFLICT(user_id,request_id) DO NOTHING`, r.ID, owner, r.AttemptID, r.RequestID, string(raw), now)
		if err != nil {
			return r, err
		}
		r, err = s.acousticByRequest(ctx, owner, in.RequestID)
		if err == nil && !sameAcoustic(r, in, sample) {
			err = acoustic.ErrConflict
		}
		return r, err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.acousticReceipts == nil {
		s.acousticReceipts = map[string]acousticRecord{}
	}
	for _, rec := range s.acousticReceipts {
		if rec.Owner == owner && rec.Receipt.RequestID == in.RequestID {
			if !sameAcoustic(rec.Receipt, in, sample) {
				return acoustic.Receipt{}, acoustic.ErrConflict
			}
			return cloneAcoustic(rec.Receipt), nil
		}
	}
	s.acousticReceipts[r.ID] = acousticRecord{owner, cloneAcoustic(r)}
	return r, nil
}
func (s *Store) GetAcoustic(ctx context.Context, owner, id string) (acoustic.Receipt, error) {
	if s.db != nil {
		var raw []byte
		err := s.db.QueryRowContext(ctx, `SELECT snapshot FROM speaking_assessments WHERE user_id=$1 AND id=$2`, owner, id).Scan(&raw)
		return decodeAcoustic(raw, err)
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	rec, ok := s.acousticReceipts[id]
	if !ok || rec.Owner != owner {
		return acoustic.Receipt{}, ErrNotFound
	}
	return cloneAcoustic(rec.Receipt), nil
}
func (s *Store) AcousticByRequest(ctx context.Context, owner, request string) (acoustic.Receipt, error) {
	return s.acousticByRequest(ctx, owner, request)
}
func (s *Store) ListAcoustic(ctx context.Context, owner, attemptID string) ([]acoustic.Receipt, error) {
	out := []acoustic.Receipt{}
	if s.db != nil {
		rows, err := s.db.QueryContext(ctx, `SELECT snapshot FROM speaking_assessments WHERE user_id=$1 AND ($2='' OR attempt_id=$2) ORDER BY created_at DESC,id DESC LIMIT 30`, owner, attemptID)
		if err != nil {
			return nil, err
		}
		defer rows.Close()
		for rows.Next() {
			var raw []byte
			if err = rows.Scan(&raw); err != nil {
				return nil, err
			}
			r, e := decodeAcoustic(raw, nil)
			if e != nil {
				return nil, e
			}
			out = append(out, r)
		}
		return out, rows.Err()
	}
	s.mu.RLock()
	for _, rec := range s.acousticReceipts {
		if rec.Owner == owner && (attemptID == "" || rec.Receipt.AttemptID == attemptID) {
			out = append(out, cloneAcoustic(rec.Receipt))
		}
	}
	s.mu.RUnlock()
	sort.Slice(out, func(i, j int) bool {
		if out[i].CreatedAt.Equal(out[j].CreatedAt) {
			return out[i].ID > out[j].ID
		}
		return out[i].CreatedAt.After(out[j].CreatedAt)
	})
	if len(out) > 30 {
		out = out[:30]
	}
	return out, nil
}
func (s *Store) changeAcoustic(ctx context.Context, owner, id string, change func(*acoustic.Receipt) error) (acoustic.Receipt, error) {
	if s.db != nil {
		tx, err := s.db.BeginTx(ctx, nil)
		if err != nil {
			return acoustic.Receipt{}, err
		}
		defer tx.Rollback()
		var raw []byte
		err = tx.QueryRowContext(ctx, `SELECT snapshot FROM speaking_assessments WHERE user_id=$1 AND id=$2 FOR UPDATE`, owner, id).Scan(&raw)
		r, err := decodeAcoustic(raw, err)
		if err != nil {
			return r, err
		}
		if err = change(&r); err != nil {
			return r, err
		}
		raw, err = json.Marshal(r)
		if err != nil {
			return r, err
		}
		_, err = tx.ExecContext(ctx, `UPDATE speaking_assessments SET snapshot=$2,updated_at=$3 WHERE id=$1`, id, string(raw), r.UpdatedAt)
		if err != nil {
			return r, err
		}
		return r, tx.Commit()
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	rec, ok := s.acousticReceipts[id]
	if !ok || rec.Owner != owner {
		return acoustic.Receipt{}, ErrNotFound
	}
	r := cloneAcoustic(rec.Receipt)
	if err := change(&r); err != nil {
		return r, err
	}
	rec.Receipt = cloneAcoustic(r)
	s.acousticReceipts[id] = rec
	return r, nil
}
func (s *Store) ClaimAcoustic(ctx context.Context, owner, id string, generation int, sampleHash string) (acoustic.Receipt, bool, error) {
	claimed := false
	r, err := s.changeAcoustic(ctx, owner, id, func(r *acoustic.Receipt) error {
		if r.RulesVersion != acoustic.RulesVersion || sampleHash != "" && sampleHash != r.Sample.SHA256 {
			return acoustic.ErrConflict
		}
		state, acquired, err := evaluation.Claim(evaluation.State{Status: r.Status, Generation: r.Generation, LeaseUntil: r.LeaseUntil}, generation, time.Now().UTC())
		if err != nil {
			return acoustic.ErrConflict
		}
		if acquired {
			if sampleHash == "" {
				return acoustic.ErrNeedsAudio
			}
			r.Status, r.Generation, r.LeaseUntil = state.Status, state.Generation, state.LeaseUntil
			r.Failure = ""
			r.UpdatedAt = time.Now().UTC()
			claimed = true
		}
		return nil
	})
	return r, claimed, err
}
func (s *Store) FinishAcoustic(ctx context.Context, owner, id string, generation int, f *acoustic.Feedback) (acoustic.Receipt, error) {
	return s.changeAcoustic(ctx, owner, id, func(r *acoustic.Receipt) error {
		if !evaluation.CanFinish(evaluation.State{Status: r.Status, Generation: r.Generation, LeaseUntil: r.LeaseUntil}, generation) {
			return acoustic.ErrConflict
		}
		if f != nil {
			if err := acoustic.Validate(*f, *r); err != nil {
				return err
			}
		}
		now := time.Now().UTC()
		r.LeaseUntil = nil
		r.UpdatedAt = now
		if f == nil {
			r.Status = "failed"
			r.Failure = "Acoustic feedback is unavailable. No pronunciation score was saved. Retry with the original recording, or record a new take."
			return nil
		}
		r.Status = "completed"
		r.CompletedAt = &now
		f.Disclaimer = "Acoustic practice feedback for this recording. The provider does not expose its underlying model revision. No IELTS band or learning reward is inferred."
		r.Feedback = f
		return nil
	})
}
