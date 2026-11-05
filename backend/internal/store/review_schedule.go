package store

import (
	"context"
	"database/sql"
	"errors"
	"strings"
	"time"

	"github.com/Loccao102/LocCaoEnglish/backend/internal/model"
)

const ReviewScheduleRulesVersion = "review-schedule.v1"

var (
	ErrReviewScheduleConflict = errors.New("review schedule request conflicts with an existing receipt")
	ErrReviewScheduleVersion  = errors.New("unsupported review schedule rules version")
	ErrReviewScheduleInput    = errors.New("invalid review schedule request")
)

type ReviewScheduleRequest struct {
	RequestID    string
	Quality      int
	RulesVersion string
}

func validateReviewScheduleRequest(in ReviewScheduleRequest) error {
	if strings.TrimSpace(in.RequestID) == "" || len([]rune(in.RequestID)) > 120 {
		return ErrReviewScheduleInput
	}
	if in.Quality < 0 || in.Quality > 5 {
		return ErrReviewScheduleInput
	}
	if in.RulesVersion != ReviewScheduleRulesVersion {
		return ErrReviewScheduleVersion
	}
	return nil
}

func sameReviewScheduleRequest(receipt model.ReviewScheduleReceipt, itemKey string, in ReviewScheduleRequest) bool {
	return receipt.ItemKey == itemKey && receipt.Quality == in.Quality && receipt.RulesVersion == in.RulesVersion
}

func (s *Store) ScheduleReview(ctx context.Context, userID, itemKey string, in ReviewScheduleRequest) (model.ReviewScheduleReceipt, error) {
	if err := validateReviewScheduleRequest(in); err != nil {
		return model.ReviewScheduleReceipt{}, err
	}
	if strings.TrimSpace(itemKey) == "" {
		return model.ReviewScheduleReceipt{}, ErrNotFound
	}
	if s.db == nil {
		return s.scheduleReviewMemory(userID, itemKey, in)
	}

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return model.ReviewScheduleReceipt{}, err
	}
	defer tx.Rollback()
	// Serialize the first claim for one owner/request pair even when competing
	// calls target different review rows. Without this lock both transactions
	// can pass the missing-receipt check and one loses the unique insert as a
	// 500 instead of returning the immutable receipt/conflict contract.
	if _, err := tx.ExecContext(ctx, `SELECT pg_advisory_xact_lock(hashtext('review-schedule.v1:' || $1), hashtext($2))`, userID, in.RequestID); err != nil {
		return model.ReviewScheduleReceipt{}, err
	}

	if receipt, found, err := reviewScheduleReceiptTx(ctx, tx, userID, in.RequestID, false); err != nil {
		return model.ReviewScheduleReceipt{}, err
	} else if found {
		if !sameReviewScheduleRequest(receipt, itemKey, in) {
			return model.ReviewScheduleReceipt{}, ErrReviewScheduleConflict
		}
		return receipt, nil
	}

	var interval, failures int
	var ease float64
	err = tx.QueryRowContext(ctx, `SELECT interval_days,ease,failures FROM review_items WHERE user_id=$1 AND item_key=$2 FOR UPDATE`, userID, itemKey).Scan(&interval, &ease, &failures)
	if errors.Is(err, sql.ErrNoRows) {
		return model.ReviewScheduleReceipt{}, ErrNotFound
	}
	if err != nil {
		return model.ReviewScheduleReceipt{}, err
	}
	// A competing request with the same id may have committed while this
	// transaction waited for the review row. Re-read the receipt after the row
	// lock so it cannot schedule twice.
	if receipt, found, err := reviewScheduleReceiptTx(ctx, tx, userID, in.RequestID, false); err != nil {
		return model.ReviewScheduleReceipt{}, err
	} else if found {
		if !sameReviewScheduleRequest(receipt, itemKey, in) {
			return model.ReviewScheduleReceipt{}, ErrReviewScheduleConflict
		}
		if err := tx.Commit(); err != nil {
			return model.ReviewScheduleReceipt{}, err
		}
		return receipt, nil
	}

	interval, ease, failures = nextReview(interval, ease, failures, in.Quality)
	now := time.Now().UTC().Truncate(time.Microsecond)
	dueAt := now.Add(time.Duration(interval) * 24 * time.Hour)
	if _, err = tx.ExecContext(ctx, `UPDATE review_items SET interval_days=$3,ease=$4,failures=$5,due_at=$6 WHERE user_id=$1 AND item_key=$2`, userID, itemKey, interval, ease, failures, dueAt); err != nil {
		return model.ReviewScheduleReceipt{}, err
	}
	if _, err = tx.ExecContext(ctx, `INSERT INTO review_schedule_receipts(owner_id,request_id,item_key,quality,rules_version,scheduled_at,due_at,interval_days,ease,failures) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`, userID, in.RequestID, itemKey, in.Quality, in.RulesVersion, now, dueAt, interval, ease, failures); err != nil {
		return model.ReviewScheduleReceipt{}, err
	}
	if err := tx.Commit(); err != nil {
		return model.ReviewScheduleReceipt{}, err
	}
	return model.ReviewScheduleReceipt{RequestID: in.RequestID, ItemKey: itemKey, Quality: in.Quality, RulesVersion: in.RulesVersion, ScheduledAt: now, DueAt: dueAt, IntervalDays: interval, Ease: ease, Failures: failures}, nil
}

func (s *Store) scheduleReviewMemory(userID, itemKey string, in ReviewScheduleRequest) (model.ReviewScheduleReceipt, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if receipts := s.mem.reviewReceipts[userID]; receipts != nil {
		if receipt, ok := receipts[in.RequestID]; ok {
			if !sameReviewScheduleRequest(receipt, itemKey, in) {
				return model.ReviewScheduleReceipt{}, ErrReviewScheduleConflict
			}
			return receipt, nil
		}
	}
	items := s.mem.reviews[userID]
	if items == nil {
		return model.ReviewScheduleReceipt{}, ErrNotFound
	}
	if s.mem.reviewReceipts == nil {
		s.mem.reviewReceipts = map[string]map[string]model.ReviewScheduleReceipt{}
	}
	if s.mem.reviewReceipts[userID] == nil {
		s.mem.reviewReceipts[userID] = map[string]model.ReviewScheduleReceipt{}
	}
	r, ok := items[itemKey]
	if !ok {
		return model.ReviewScheduleReceipt{}, ErrNotFound
	}
	interval, ease, failures := nextReview(r.IntervalDays, r.Ease, r.Failures, in.Quality)
	now := time.Now().UTC().Truncate(time.Microsecond)
	dueAt := now.Add(time.Duration(interval) * 24 * time.Hour)
	r.IntervalDays, r.Ease, r.Failures, r.DueAt = interval, ease, failures, dueAt
	items[itemKey] = r
	receipt := model.ReviewScheduleReceipt{RequestID: in.RequestID, ItemKey: itemKey, Quality: in.Quality, RulesVersion: in.RulesVersion, ScheduledAt: now, DueAt: dueAt, IntervalDays: interval, Ease: ease, Failures: failures}
	s.mem.reviewReceipts[userID][in.RequestID] = receipt
	return receipt, nil
}

func (s *Store) ReviewScheduleReceipt(ctx context.Context, userID, requestID string) (model.ReviewScheduleReceipt, error) {
	if strings.TrimSpace(requestID) == "" {
		return model.ReviewScheduleReceipt{}, ErrNotFound
	}
	if s.db == nil {
		s.mu.RLock()
		defer s.mu.RUnlock()
		receipt, ok := s.mem.reviewReceipts[userID][requestID]
		if !ok {
			return model.ReviewScheduleReceipt{}, ErrNotFound
		}
		return receipt, nil
	}
	receipt, found, err := reviewScheduleReceiptDB(ctx, s.db, userID, requestID)
	if err != nil {
		return model.ReviewScheduleReceipt{}, err
	}
	if !found {
		return model.ReviewScheduleReceipt{}, ErrNotFound
	}
	return receipt, nil
}

func reviewScheduleReceiptTx(ctx context.Context, tx *sql.Tx, ownerID, requestID string, lock bool) (model.ReviewScheduleReceipt, bool, error) {
	query := `SELECT request_id,item_key,quality,rules_version,scheduled_at,due_at,interval_days,ease,failures FROM review_schedule_receipts WHERE owner_id=$1 AND request_id=$2`
	if lock {
		query += ` FOR UPDATE`
	}
	return scanReviewScheduleReceipt(tx.QueryRowContext(ctx, query, ownerID, requestID))
}

func reviewScheduleReceiptDB(ctx context.Context, db *sql.DB, ownerID, requestID string) (model.ReviewScheduleReceipt, bool, error) {
	return scanReviewScheduleReceipt(db.QueryRowContext(ctx, `SELECT request_id,item_key,quality,rules_version,scheduled_at,due_at,interval_days,ease,failures FROM review_schedule_receipts WHERE owner_id=$1 AND request_id=$2`, ownerID, requestID))
}

type reviewScheduleScanner interface{ Scan(...any) error }

func scanReviewScheduleReceipt(row reviewScheduleScanner) (model.ReviewScheduleReceipt, bool, error) {
	var receipt model.ReviewScheduleReceipt
	if err := row.Scan(&receipt.RequestID, &receipt.ItemKey, &receipt.Quality, &receipt.RulesVersion, &receipt.ScheduledAt, &receipt.DueAt, &receipt.IntervalDays, &receipt.Ease, &receipt.Failures); errors.Is(err, sql.ErrNoRows) {
		return model.ReviewScheduleReceipt{}, false, nil
	} else if err != nil {
		return model.ReviewScheduleReceipt{}, false, err
	}
	return receipt, true, nil
}
