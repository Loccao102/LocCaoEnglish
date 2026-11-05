package httpapi

import (
	"errors"
	"net/http"
	"time"

	"github.com/Loccao102/LocCaoEnglish/backend/internal/store"
)

// reviewLegacyGrade is deliberately a safe-upgrade response. Keeping the old
// path reserved prevents a rolled-back/new-client mismatch from silently
// applying a non-idempotent quality-only grade.
func (s *Server) reviewLegacyGrade(w http.ResponseWriter, r *http.Request) {
	problem(w, http.StatusConflict, "review scheduling requires the receipt endpoint")
}

func (s *Server) reviewSchedule(w http.ResponseWriter, r *http.Request) {
	u, ok := s.signedInUser(w, r)
	if !ok {
		return
	}
	var in struct {
		RequestID     string    `json:"requestId"`
		Quality       *int      `json:"quality"`
		RulesVersion  string    `json:"rulesVersion"`
		ExpectedDueAt time.Time `json:"expectedDueAt"`
	}
	if !decode(w, r, &in) {
		return
	}
	// A quality-only retry from the pre-receipt client must fail explicitly so
	// the client cannot mistake a non-idempotent grade for a saved receipt.
	if in.RequestID == "" || in.RulesVersion == "" {
		problem(w, http.StatusConflict, "review scheduling requires requestId and rulesVersion")
		return
	}
	if in.Quality == nil || in.ExpectedDueAt.IsZero() {
		problem(w, http.StatusBadRequest, "quality and expectedDueAt are required")
		return
	}
	receipt, err := s.store.ScheduleReview(r.Context(), u.ID, r.PathValue("itemKey"), store.ReviewScheduleRequest{RequestID: in.RequestID, Quality: *in.Quality, RulesVersion: in.RulesVersion, ExpectedDueAt: in.ExpectedDueAt})
	switch {
	case errors.Is(err, store.ErrNotFound):
		problem(w, http.StatusNotFound, "review item not found")
	case errors.Is(err, store.ErrReviewScheduleConflict):
		problem(w, http.StatusConflict, "review request already belongs to a different schedule")
	case errors.Is(err, store.ErrReviewScheduleVersion):
		problem(w, http.StatusConflict, "unsupported review scheduling rules version")
	case errors.Is(err, store.ErrReviewScheduleInput):
		problem(w, http.StatusBadRequest, "invalid review scheduling request")
	case err != nil:
		problem(w, http.StatusInternalServerError, err.Error())
	default:
		write(w, http.StatusOK, receipt)
	}
}

func (s *Server) reviewScheduleReceipt(w http.ResponseWriter, r *http.Request) {
	u, ok := s.signedInUser(w, r)
	if !ok {
		return
	}
	receipt, err := s.store.ReviewScheduleReceipt(r.Context(), u.ID, r.PathValue("requestId"))
	if errors.Is(err, store.ErrNotFound) {
		problem(w, http.StatusNotFound, "review receipt not found")
		return
	}
	if err != nil {
		problem(w, http.StatusInternalServerError, err.Error())
		return
	}
	write(w, http.StatusOK, receipt)
}
