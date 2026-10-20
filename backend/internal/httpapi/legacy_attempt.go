package httpapi

import "net/http"

// No activity alias can turn client-reported accuracy into learning evidence.
// Keep the route so older clients get an explicit migration response.
func (s *Server) attempt(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.userID(w, r); !ok {
		return
	}
	problem(w, http.StatusConflict, "client-reported accuracy is retired; use server-owned learning attempts. Local lesson and placement checks do not award learning progress")
}
