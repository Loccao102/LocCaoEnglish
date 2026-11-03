package httpapi

import (
	"net/http"

	"github.com/Loccao102/LocCaoEnglish/backend/internal/model"
)

func (s *Server) playerProfile(w http.ResponseWriter, r *http.Request) {
	id, ok := s.userID(w, r)
	if !ok {
		return
	}
	p, err := s.store.GetPlayerProfile(r.Context(), id)
	if err != nil {
		problem(w, 500, err.Error())
		return
	}
	write(w, 200, p)
}

func (s *Server) savePlayerProfile(w http.ResponseWriter, r *http.Request) {
	u, ok := s.signedInUser(w, r)
	if !ok {
		return
	}
	var in model.PlayerProfile
	if !decode(w, r, &in) {
		return
	}
	// Profile preferences belong to the authenticated owner, including when a
	// stale form or caller supplies a different userId in the request body.
	p, err := s.store.SavePlayerProfile(r.Context(), u.ID, in)
	if err != nil {
		problem(w, 400, err.Error())
		return
	}
	write(w, 200, p)
}
