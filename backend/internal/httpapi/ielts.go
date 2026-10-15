package httpapi

import (
	"net/http"
	"strings"

	ieltscore "github.com/Loccao102/LocCaoEnglish/backend/internal/ielts"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/model"
)

func (s *Server) registerIELTSRoutes(mux *http.ServeMux) {
	mux.HandleFunc("POST /v1/ielts/objective-score", s.ieltsObjectiveScore)
	mux.HandleFunc("POST /v1/ielts/band", s.ieltsBand)
	mux.HandleFunc("POST /v1/ielts/overall", s.ieltsOverall)
	mux.HandleFunc("GET /v1/ielts/history", s.ieltsHistory)
}
func (s *Server) ieltsObjectiveScore(w http.ResponseWriter, r *http.Request) {
	u, ok := s.signedInUser(w, r)
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
	if strings.EqualFold(strings.TrimSpace(in.Section), "reading") {
		problem(w, 409, "Reading estimates now require a server-owned IELTS Reading attempt with actual selections")
		return
	}
	result, err := ieltscore.Objective(in.Section, in.TestType, in.Correct, in.Total)
	if err != nil {
		problem(w, 400, err.Error())
		return
	}
	raw, max := result.RawScore, result.MaxScore
	attempt, err := s.store.SaveIELTSAttempt(r.Context(), u.ID, model.IELTSAttempt{Section: result.Section, TestType: result.TestType, RawScore: &raw, MaxScore: &max, Band: result.Band, Source: "client-reported-practice-estimate", Evidence: "client-reported"})
	if err != nil {
		problem(w, 500, "could not save this reported estimate")
		return
	}
	write(w, 200, map[string]any{"result": result, "attempt": attempt})
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
