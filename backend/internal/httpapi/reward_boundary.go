package httpapi

import (
	"net/http"
	"strconv"

	"github.com/Loccao102/LocCaoEnglish/backend/internal/model"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/store"
)

func (s *Server) lessonComplete(w http.ResponseWriter, r *http.Request) {
	u, ok := s.signedInUser(w, r)
	if !ok {
		return
	}
	id := u.ID
	lesson, err := s.store.GetLesson(r.Context(), r.PathValue("slug"), false)
	if err != nil {
		problem(w, 404, "lesson not found")
		return
	}
	var in struct {
		Completed int     `json:"completed"`
		Score     float64 `json:"score"`
	}
	if !decode(w, r, &in) {
		return
	}
	if in.Completed < 0 || in.Completed > len(lesson.Exercises) || in.Score < 0 || in.Score > 1 {
		problem(w, http.StatusBadRequest, "invalid self-reported lesson bookmark")
		return
	}
	p, err := s.store.SaveLessonProgress(r.Context(), id, lesson.ID, in.Completed, len(lesson.Exercises), in.Score)
	if err != nil {
		problem(w, 500, err.Error())
		return
	}
	write(w, 200, struct {
		model.LessonProgress
		Evidence string `json:"evidence"`
	}{p, "client-reported-bookmark"})
}
func (s *Server) leaderboard(w http.ResponseWriter, r *http.Request) {
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	items, err := s.store.TopUsers(r.Context(), limit)
	if err != nil {
		problem(w, 500, err.Error())
		return
	}
	online, _ := s.social.Online(r.Context())
	set := map[string]bool{}
	for _, p := range online {
		set[p.UserID] = true
	}
	for i := range items {
		items[i].Online = set[items[i].UserID]
	}
	write(w, 200, map[string]any{"items": items, "onlineCount": len(online), "method": store.CheckedPracticeMethod, "disclaimer": store.CheckedPracticeDisclaimer})
}
func (s *Server) submitChallenge(w http.ResponseWriter, r *http.Request) {
	_, ok := s.signedInUser(w, r)
	if !ok {
		return
	}
	problem(w, http.StatusConflict, "client-reported duel scores are retired; practice invitations do not create competitive results")
}
