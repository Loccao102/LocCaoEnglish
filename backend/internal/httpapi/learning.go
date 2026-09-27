package httpapi

import (
	"errors"
	"net/http"
	"strings"

	"github.com/Loccao102/LocCaoEnglish/backend/internal/learning"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/store"
)

// Anonymous learning attempts are isolated guest practice, never the demo user.
func (s *Server) learningOwner(w http.ResponseWriter, r *http.Request) (string, bool) {
	if strings.TrimSpace(r.Header.Get("Authorization")) == "" {
		return "", true
	}
	u, ok := s.signedInUser(w, r)
	return u.ID, ok
}
func learningError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, learning.ErrInvalid):
		problem(w, 400, err.Error())
	case errors.Is(err, learning.ErrConflict):
		problem(w, 409, err.Error())
	case errors.Is(err, learning.ErrExpired):
		problem(w, 410, err.Error())
	case errors.Is(err, store.ErrNotFound):
		problem(w, 404, "learning attempt not found")
	default:
		problem(w, 500, "could not save this learning attempt; retry the same answer")
	}
}
func (s *Server) registerLearningRoutes(mux *http.ServeMux) {
	mux.HandleFunc("POST /v1/learning/word-link/attempts", func(w http.ResponseWriter, r *http.Request) {
		owner, ok := s.learningOwner(w, r)
		if !ok {
			return
		}
		var in learning.Create
		if !decodeLimit(w, r, &in, 2048) {
			return
		}
		v, err := s.store.CreateLearningAttempt(r.Context(), owner, in)
		if err != nil {
			learningError(w, err)
			return
		}
		write(w, 201, v)
	})
	mux.HandleFunc("GET /v1/learning/word-link/attempts/{id}", func(w http.ResponseWriter, r *http.Request) {
		owner, ok := s.learningOwner(w, r)
		if !ok {
			return
		}
		v, err := s.store.GetLearningAttempt(r.Context(), owner, r.PathValue("id"))
		if err != nil {
			learningError(w, err)
			return
		}
		write(w, 200, v)
	})
	mux.HandleFunc("POST /v1/learning/word-link/attempts/{id}/submit", func(w http.ResponseWriter, r *http.Request) {
		owner, ok := s.learningOwner(w, r)
		if !ok {
			return
		}
		var in learning.Submission
		if !decodeLimit(w, r, &in, 2048) {
			return
		}
		v, err := s.store.SubmitLearningAttempt(r.Context(), owner, r.PathValue("id"), in)
		if err != nil {
			learningError(w, err)
			return
		}
		write(w, 200, v)
	})
}
