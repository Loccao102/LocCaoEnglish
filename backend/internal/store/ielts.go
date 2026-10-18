package store

import (
	"context"
	"database/sql"
	"encoding/json"
	"sort"
	"sync"
	"time"

	"github.com/Loccao102/LocCaoEnglish/backend/internal/learning"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/model"
)

type ieltsMemory struct {
	mu       sync.RWMutex
	attempts map[string][]model.IELTSAttempt
}

var ieltsMemories sync.Map

func (s *Store) ieltsMemory() *ieltsMemory {
	if v, ok := ieltsMemories.Load(s); ok {
		return v.(*ieltsMemory)
	}
	state := &ieltsMemory{attempts: map[string][]model.IELTSAttempt{}}
	actual, _ := ieltsMemories.LoadOrStore(s, state)
	return actual.(*ieltsMemory)
}
func (s *Store) EnsureIELTS(ctx context.Context) error {
	if s.db == nil {
		_ = s.ieltsMemory()
		return nil
	}
	_, err := s.db.ExecContext(ctx, ieltsSchemaSQL)
	return err
}

// Only the atomic learning-attempt transaction creates server-graded history.
// The old writer can retain unverified records or an explicitly reported tally.
func (s *Store) SaveIELTSAttempt(ctx context.Context, userID string, a model.IELTSAttempt) (model.IELTSAttempt, error) {
	if userID == "" {
		return a, ErrAttemptOwner
	}
	a.AttemptID, a.ContentVersion, a.RulesVersion, a.MethodVersion, a.Provider = "", "", "", "", ""
	var receipt any
	if a.Evidence == "client-reported" {
		a.Legacy = false
		a.Source = "client-reported-practice-estimate"
		receipt = `{"evidence":"client-reported"}`
	} else {
		a.Evidence = "legacy-unverified"
		a.Legacy = true
	}
	if a.ID == "" {
		a.ID = newID()
	}
	a.CreatedAt = time.Now().UTC()
	if s.db != nil {
		_, err := s.db.ExecContext(ctx, `INSERT INTO ielts_attempts(id,user_id,section,test_type,raw_score,max_score,band,source,created_at,receipt) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`, a.ID, userID, a.Section, a.TestType, a.RawScore, a.MaxScore, a.Band, a.Source, a.CreatedAt, receipt)
		return cloneIELTSAttempt(a), err
	}
	if _, err := s.GetUser(ctx, userID); err != nil {
		return a, err
	}
	state := s.ieltsMemory()
	state.mu.Lock()
	state.attempts[userID] = append(state.attempts[userID], cloneIELTSAttempt(a))
	state.mu.Unlock()
	return cloneIELTSAttempt(a), nil
}

type ieltsReceipt struct {
	Listening      *model.ListeningEvidence  `json:"listening,omitempty"`
	Evidence       string                    `json:"evidence"`
	ContentVersion string                    `json:"contentVersion,omitempty"`
	RulesVersion   string                    `json:"rulesVersion,omitempty"`
	ActualAnswer   string                    `json:"actualAnswer,omitempty"`
	Result         *model.IELTSReadingResult `json:"result,omitempty"`
}

func (s *Store) IELTSHistory(ctx context.Context, userID string, limit int) ([]model.IELTSAttempt, error) {
	if limit <= 0 || limit > 100 {
		limit = 30
	}
	if s.db != nil {
		rows, err := s.db.QueryContext(ctx, `SELECT id,section,test_type,raw_score,max_score,band,source,created_at,COALESCE(attempt_id,''),receipt FROM ielts_attempts WHERE user_id=$1 ORDER BY created_at DESC,id DESC LIMIT $2`, userID, limit)
		if err != nil {
			return nil, err
		}
		defer rows.Close()
		out := []model.IELTSAttempt{}
		for rows.Next() {
			var a model.IELTSAttempt
			var raw, max sql.NullInt64
			var receiptJSON []byte
			if err := rows.Scan(&a.ID, &a.Section, &a.TestType, &raw, &max, &a.Band, &a.Source, &a.CreatedAt, &a.AttemptID, &receiptJSON); err != nil {
				return nil, err
			}
			if raw.Valid {
				v := int(raw.Int64)
				a.RawScore = &v
			}
			if max.Valid {
				v := int(max.Int64)
				a.MaxScore = &v
			}
			a.Legacy, a.Evidence = true, "legacy-unverified"
			if len(receiptJSON) > 0 {
				var receipt ieltsReceipt
				if err := json.Unmarshal(receiptJSON, &receipt); err != nil {
					return nil, err
				}
				if a.AttemptID != "" && receipt.Evidence == learning.IELTSReadingEvidence && receipt.Result != nil {
					a.Legacy, a.Evidence = false, receipt.Evidence
					a.ContentVersion, a.RulesVersion = receipt.ContentVersion, receipt.RulesVersion
					a.MethodVersion, a.Provider = receipt.Result.MethodVersion, receipt.Result.Provider
				} else if receipt.Evidence == "client-reported" {
					a.Legacy, a.Evidence = false, "client-reported"
				}
			}
			out = append(out, a)
		}
		return out, rows.Err()
	}
	state := s.ieltsMemory()
	state.mu.RLock()
	items := make([]model.IELTSAttempt, 0, len(state.attempts[userID]))
	for _, a := range state.attempts[userID] {
		items = append(items, cloneIELTSAttempt(a))
	}
	state.mu.RUnlock()
	sort.Slice(items, func(i, j int) bool {
		if items[i].CreatedAt.Equal(items[j].CreatedAt) {
			return items[i].ID > items[j].ID
		}
		return items[i].CreatedAt.After(items[j].CreatedAt)
	})
	if len(items) > limit {
		items = items[:limit]
	}
	return items, nil
}

func cloneIELTSAttempt(a model.IELTSAttempt) model.IELTSAttempt {
	if a.RawScore != nil {
		v := *a.RawScore
		a.RawScore = &v
	}
	if a.MaxScore != nil {
		v := *a.MaxScore
		a.MaxScore = &v
	}
	return a
}

// Keep additive startup schema aligned with 018_ielts_reading_evidence.sql.
const ieltsSchemaSQL = `
CREATE TABLE IF NOT EXISTS ielts_attempts(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,section TEXT NOT NULL,test_type TEXT NOT NULL DEFAULT 'academic',raw_score INTEGER,max_score INTEGER,band DOUBLE PRECISION NOT NULL,source TEXT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE INDEX IF NOT EXISTS idx_ielts_attempts_user_created ON ielts_attempts(user_id,created_at DESC);
ALTER TABLE ielts_attempts ADD COLUMN IF NOT EXISTS attempt_id TEXT REFERENCES learning_attempts(id) ON DELETE CASCADE;
ALTER TABLE ielts_attempts ADD COLUMN IF NOT EXISTS receipt JSONB;
CREATE UNIQUE INDEX IF NOT EXISTS ielts_attempt_receipt ON ielts_attempts(attempt_id) WHERE attempt_id IS NOT NULL;
`
