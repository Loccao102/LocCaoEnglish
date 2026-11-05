package httpapi

import (
	"errors"
	"net/http"

	"github.com/Loccao102/LocCaoEnglish/backend/internal/store"
)

func (s *Server) fairCompletion(w http.ResponseWriter, r *http.Request) {
	u, ok := s.signedInUser(w, r)
	if !ok {
		return
	}
	completion, err := s.store.GetFairCompletion(r.Context(), u.ID, r.PathValue("runId"))
	switch {
	case errors.Is(err, store.ErrFairCompletionID):
		problem(w, http.StatusBadRequest, "invalid friendship memory id")
		return
	case errors.Is(err, store.ErrNotFound):
		problem(w, http.StatusNotFound, "friendship memory not found")
		return
	case err != nil:
		problem(w, http.StatusInternalServerError, "could not load friendship memory")
		return
	}
	save, err := s.store.GetFair(r.Context(), u.ID)
	if err != nil {
		problem(w, http.StatusInternalServerError, "could not load your friendship scrapbook")
		return
	}
	write(w, http.StatusOK, map[string]any{
		"method":     "fair-keepsake.v1",
		"playerId":   u.ID,
		"completion": completion,
		"save":       save,
	})
}
