package httpapi

import (
	"github.com/Loccao102/LocCaoEnglish/backend/internal/adventure"
	"net/http"
)

func (s *Server) registerAdventureRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /v1/adventure", func(w http.ResponseWriter, r *http.Request) {
		u, ok := s.signedInUser(w, r)
		if !ok {
			return
		}
		save, err := s.store.GetAdventure(r.Context(), u.ID)
		if err != nil {
			problem(w, 500, "could not load your adventure")
			return
		}
		write(w, 200, map[string]any{"save": save, "playerId": u.ID, "displayName": u.DisplayName, "storageMode": s.store.Mode()})
	})
	mux.HandleFunc("POST /v1/adventure/actions", func(w http.ResponseWriter, r *http.Request) {
		u, ok := s.signedInUser(w, r)
		if !ok {
			return
		}
		var action adventure.Action
		if !decodeLimit(w, r, &action, 16<<10) {
			return
		}
		result, err := s.store.ApplyAdventure(r.Context(), u.ID, action)
		if err != nil {
			problem(w, 409, err.Error())
			return
		}
		write(w, 200, result)
	})
}
