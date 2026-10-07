package httpapi

import "net/http"

// Continue has no client-selected node, score, or version: the committed parent
// determines all of them from its private, versioned snapshot.
func (s *Server) storyAttemptContinue(w http.ResponseWriter, r *http.Request) {
	owner, ok := s.learningOwner(w, r)
	if !ok {
		return
	}
	var input struct{}
	if !decode(w, r, &input) {
		return
	}
	rec, err := s.store.ContinueStoryChoice(r.Context(), owner, r.PathValue("id"))
	if err != nil {
		learningError(w, err)
		return
	}
	response, ok := learningAttemptResponse(rec, rec.Snapshot.Input.Pack)
	if !ok {
		problem(w, 409, "story snapshot unavailable")
		return
	}
	write(w, 200, response)
}
