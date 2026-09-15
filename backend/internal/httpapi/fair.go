package httpapi

import (
	"errors"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/fair"
	"net/http"
)

func (s *Server) registerFairRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /v1/fair", func(w http.ResponseWriter, r *http.Request) {
		u, ok := s.signedInUser(w, r)
		if !ok {
			return
		}
		save, err := s.store.GetFair(r.Context(), u.ID)
		if err != nil {
			problem(w, 500, "could not load your friendship scrapbook")
			return
		}
		write(w, 200, map[string]any{"save": save, "playerId": u.ID, "displayName": u.DisplayName, "storageMode": s.store.Mode()})
	})
	mux.HandleFunc("POST /v1/fair/completions", func(w http.ResponseWriter, r *http.Request) {
		u, ok := s.signedInUser(w, r)
		if !ok {
			return
		}
		var completion fair.Completion
		if !decodeLimit(w, r, &completion, 2048) {
			return
		}
		save, err := s.store.CompleteFair(r.Context(), u.ID, completion)
		if err != nil {
			switch {
			case errors.Is(err, fair.ErrInvalid):
				problem(w, 400, err.Error())
			case errors.Is(err, fair.ErrConflict):
				problem(w, 409, err.Error())
			case errors.Is(err, fair.ErrLocked):
				problem(w, 409, err.Error())
			default:
				problem(w, 500, "could not save your friendship memory")
			}
			return
		}
		write(w, 200, map[string]any{"save": save})
	})
}
