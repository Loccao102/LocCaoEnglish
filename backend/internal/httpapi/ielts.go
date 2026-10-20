package httpapi

import (
	"net/http"

	ieltscore "github.com/Loccao102/LocCaoEnglish/backend/internal/ielts"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/model"
)

func (s *Server) registerIELTSRoutes(mux *http.ServeMux) {
	s.registerWritingRoutes(mux)
	mux.HandleFunc("POST /v1/ielts/objective-score", s.ieltsObjectiveScore)
	mux.HandleFunc("POST /v1/ielts/band", s.ieltsBand)
	mux.HandleFunc("POST /v1/ielts/overall", s.ieltsOverall)
	mux.HandleFunc("GET /v1/ielts/history", s.ieltsHistory)
}
func (s *Server) ieltsObjectiveScore(w http.ResponseWriter, r *http.Request) {
	_, ok := s.signedInUser(w, r)
	if !ok {
		return
	}
	var in struct {
		Section  string `json:"section"`
		TestType string `json:"testType"`
		Correct  int    `json:"correct"`
		Total    int    `json:"total"`
	}
	if !decode(w, r, &in) {
		return
	}
	_, err := ieltscore.Objective(in.Section, in.TestType, in.Correct, in.Total)
	if err != nil {
		problem(w, 400, err.Error())
		return
	}
	problem(w, 409, "Reading and Listening estimates require a server-owned IELTS attempt with actual selections")
}
func (s *Server) ieltsBand(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.signedInUser(w, r); !ok {
		return
	}
	problem(w, 409, "Client-supplied IELTS bands are no longer recorded; use a supported assessment with saved evidence")
}
func (s *Server) ieltsOverall(w http.ResponseWriter, r *http.Request) {
	var in model.IELTSOverallInput
	if !decode(w, r, &in) {
		return
	}
	band, err := ieltscore.Overall(in.Listening, in.Reading, in.Writing, in.Speaking)
	if err != nil {
		problem(w, 400, err.Error())
		return
	}
	write(w, 200, map[string]any{"overall": band, "average": (in.Listening + in.Reading + in.Writing + in.Speaking) / 4, "method": "IELTS overall-band half-step rounding"})
}
func (s *Server) ieltsHistory(w http.ResponseWriter, r *http.Request) {
	u, ok := s.signedInUser(w, r)
	if !ok {
		return
	}
	items, err := s.store.IELTSHistory(r.Context(), u.ID, 30)
	if err != nil {
		problem(w, 500, "could not load IELTS history")
		return
	}
	write(w, 200, map[string]any{"items": items})
}
