package httpapi

import (
	"net/http"
	"strings"

	"github.com/Loccao102/LocCaoEnglish/backend/internal/model"
)

func (s *Server) attempt(w http.ResponseWriter, r *http.Request) {
	id, ok := s.userID(w, r)
	if !ok {
		return
	}
	var in model.AttemptInput
	if !decode(w, r, &in) {
		return
	}
	// Migrated activities must not award progress through the older accuracy API.
	switch strings.ToLower(strings.TrimSpace(in.Activity)) {
	case "word-link", "grammar-repair", "collocation-factory", "sentence-builder", "word-graph", "reading-race", "story-choice":
		problem(w, http.StatusConflict, "use server-owned learning attempts for this activity")
		return
	}
	if strings.TrimSpace(in.Skill) == "" || strings.TrimSpace(in.ItemKey) == "" {
		problem(w, http.StatusBadRequest, "skill and itemKey are required")
		return
	}
	res, err := s.store.RecordAttempt(r.Context(), id, in)
	if err != nil {
		problem(w, 500, err.Error())
		return
	}
	write(w, http.StatusCreated, res)
}
