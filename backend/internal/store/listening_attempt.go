package store

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"time"

	"github.com/Loccao102/LocCaoEnglish/backend/internal/learning"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/model"
)

type ListeningSnapshot struct {
	Transcript string                    `json:"transcript"`
	Events     []model.ListeningPlayback `json:"events"`
}

func learningEvidence(rec LearningAttemptRecord) string {
	if rec.Activity == "dictation" {
		return "server-objective-guided-dictation"
	}
	if rec.Activity == "listen-pick" {
		return "server-objective-guided-listening"
	}
	return "server-objective"
}
func supportedAudioAttempt(rec LearningAttemptRecord) bool {
	return rec.Activity == "listen-pick" && rec.RulesVersion == learning.ListeningRulesVersion ||
		rec.Activity == "dictation" && rec.RulesVersion == learning.DictationRulesVersion
}
func cloneListening(value *ListeningSnapshot) *ListeningSnapshot {
	if value == nil {
		return nil
	}
	copy := *value
	copy.Events = append([]model.ListeningPlayback{}, value.Events...)
	return &copy
}
func ListeningEvidenceOf(rec LearningAttemptRecord, reveal bool) *model.ListeningEvidence {
	value := rec.Snapshot.Listening
	if value == nil {
		return nil
	}
	out := &model.ListeningEvidence{Events: append([]model.ListeningPlayback{}, value.Events...), Source: "client-reported-playback"}
	if reveal && rec.Status == "completed" {
		out.Transcript = value.Transcript
	}
	return out
}
func listeningReady(rec LearningAttemptRecord) bool {
	if rec.Snapshot.Listening != nil {
		for _, event := range rec.Snapshot.Listening.Events {
			if event.Status == "completed" {
				return true
			}
		}
	}
	return false
}

// Serialize audio metadata against grading on the same row/memory lock. A final
// result freezes assistance, and a lost report response is safe to retry.
func (s *Store) RecordListeningPlayback(ctx context.Context, owner, id, contentVersion, rulesVersion string, event model.ListeningPlayback) (LearningAttemptRecord, error) {
	update := func(rec LearningAttemptRecord) (LearningAttemptRecord, error) {
		if rec.UserID != owner {
			return rec, ErrAttemptOwner
		}
		if !supportedAudioAttempt(rec) || rulesVersion != rec.RulesVersion || contentVersion != rec.ContentVersion || rec.Snapshot.Listening == nil {
			return rec, ErrAttemptInput
		}
		if event.RequestID == "" || (event.Rate != 1 && event.Rate != 0.72) {
			return rec, ErrAttemptInput
		}
		if event.Status != "requested" && event.Status != "completed" && event.Status != "failed" {
			return rec, ErrAttemptInput
		}
		if event.Status == "requested" && event.Provider != "" || event.Status != "requested" && event.Provider != "browser-speech-synthesis" && event.Provider != "azure-speech-neural-tts" {
			return rec, ErrAttemptInput
		}
		rec.Snapshot.Listening = cloneListening(rec.Snapshot.Listening)
		found := -1
		for i, saved := range rec.Snapshot.Listening.Events {
			if saved.RequestID == event.RequestID {
				if saved.Rate != event.Rate {
					return rec, ErrAttemptConflict
				}
				if saved == event {
					return rec, nil
				}
				// A retry of preparation returns the already recorded outcome, not a new play.
				if event.Status == "requested" {
					return rec, nil
				}
				if saved.Status != "requested" {
					return rec, ErrAttemptConflict
				}
				found = i
				break
			}
		}
		if rec.Status != "active" {
			return rec, ErrAttemptConflict
		}
		if !time.Now().Before(rec.ExpiresAt) {
			return rec, ErrAttemptExpired
		}
		if found < 0 {
			if event.Status != "requested" {
				return rec, ErrAttemptConflict
			}
			if len(rec.Snapshot.Listening.Events) >= 32 {
				return rec, ErrAttemptInput
			}
			rec.Snapshot.Listening.Events = append(rec.Snapshot.Listening.Events, event)
		} else {
			rec.Snapshot.Listening.Events[found] = event
		}
		return rec, nil
	}
	if s.db != nil {
		tx, err := s.db.BeginTx(ctx, nil)
		if err != nil {
			return LearningAttemptRecord{}, err
		}
		defer tx.Rollback()
		rec, err := learningAttemptFromRow(tx.QueryRowContext(ctx, `SELECT id,COALESCE(user_id,''),request_id,activity,skill,item_key,cefr_level,content_version,rules_version,prompt,correct_answer,feedback,status,submitted_answer,correct,xp_delta,result_confidence,result_level,review_added,created_at,snapshot,expires_at,progression_applied FROM learning_attempts WHERE id=$1 FOR UPDATE`, id))
		if errors.Is(err, sql.ErrNoRows) {
			err = ErrNotFound
		}
		if err != nil {
			return rec, err
		}
		rec, err = update(rec)
		if err != nil {
			return rec, err
		}
		raw, err := json.Marshal(rec.Snapshot)
		if err != nil {
			return rec, err
		}
		if _, err = tx.ExecContext(ctx, `UPDATE learning_attempts SET snapshot=$2 WHERE id=$1`, id, string(raw)); err != nil {
			return rec, err
		}
		if err = tx.Commit(); err != nil {
			return rec, err
		}
		return rec, nil
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	rec, ok := s.learningAttempts[id]
	if !ok {
		return rec, ErrNotFound
	}
	rec, err := update(rec)
	if err != nil {
		return rec, err
	}
	s.learningAttempts[id] = rec
	return cloneLearningRecord(rec), nil
}
