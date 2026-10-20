package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"time"

	"github.com/Loccao102/LocCaoEnglish/backend/internal/store"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/writing"
)

func decodeWritingInput(w http.ResponseWriter, r *http.Request, out any, limit int64) bool {
	d := json.NewDecoder(http.MaxBytesReader(w, r.Body, limit))
	d.DisallowUnknownFields()
	if err := d.Decode(out); err != nil {
		problem(w, 400, "Invalid Writing request")
		return false
	}
	if err := d.Decode(new(any)); err != io.EOF {
		problem(w, 400, "A single Writing request is required")
		return false
	}
	return true
}

func (s *Server) registerWritingRoutes(mux *http.ServeMux) {
	mux.HandleFunc("POST /v1/ielts/writing/attempts", s.writingStart)
	mux.HandleFunc("GET /v1/ielts/writing/attempts", s.writingList)
	mux.HandleFunc("GET /v1/ielts/writing/attempts/{id}", s.writingGet)
	mux.HandleFunc("PUT /v1/ielts/writing/attempts/{id}/draft", s.writingDraft)
	mux.HandleFunc("POST /v1/ielts/writing/attempts/{id}/submit", s.writingSubmit)
}
func writingError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, store.ErrNotFound):
		problem(w, 404, "Writing revision not found")
	case errors.Is(err, writing.ErrInput):
		problem(w, 400, err.Error())
	case errors.Is(err, writing.ErrConflict):
		problem(w, 409, err.Error())
	default:
		problem(w, 503, "Could not confirm the saved Writing revision. Keep your draft and retry.")
	}
}
func (s *Server) writingStart(w http.ResponseWriter, r *http.Request) {
	u, ok := s.signedInUser(w, r)
	if !ok {
		return
	}
	var in writing.StartInput
	if !decodeWritingInput(w, r, &in, 4096) {
		return
	}
	a, err := s.store.StartWriting(r.Context(), u.ID, in)
	if err != nil {
		writingError(w, err)
		return
	}
	write(w, 201, a)
}
func (s *Server) writingList(w http.ResponseWriter, r *http.Request) {
	u, ok := s.signedInUser(w, r)
	if !ok {
		return
	}
	items, err := s.store.ListWriting(r.Context(), u.ID)
	if err != nil {
		writingError(w, err)
		return
	}
	write(w, 200, map[string]any{"items": items})
}
func (s *Server) writingGet(w http.ResponseWriter, r *http.Request) {
	u, ok := s.signedInUser(w, r)
	if !ok {
		return
	}
	a, err := s.store.GetWriting(r.Context(), u.ID, r.PathValue("id"))
	if err != nil {
		writingError(w, err)
		return
	}
	write(w, 200, a)
}
func (s *Server) writingDraft(w http.ResponseWriter, r *http.Request) {
	u, ok := s.signedInUser(w, r)
	if !ok {
		return
	}
	var in writing.SaveInput
	if !decodeWritingInput(w, r, &in, 100000) {
		return
	}
	a, err := s.store.SaveWritingDraft(r.Context(), u.ID, r.PathValue("id"), in)
	if err != nil {
		writingError(w, err)
		return
	}
	write(w, 200, a)
}
func (s *Server) writingSubmit(w http.ResponseWriter, r *http.Request) {
	u, ok := s.signedInUser(w, r)
	if !ok {
		return
	}
	var in writing.SubmitInput
	if !decodeWritingInput(w, r, &in, 100000) {
		return
	}
	a, claimed, err := s.store.ClaimWriting(r.Context(), u.ID, r.PathValue("id"), in)
	if err != nil {
		writingError(w, err)
		return
	}
	if claimed {
		// The already accepted submission survives a browser disconnect. Provider I/O
		// is bounded, outside any DB lock, and never retried automatically.
		ctx, cancel := context.WithTimeout(context.WithoutCancel(r.Context()), 30*time.Second)
		defer cancel()
		var feedback writing.Feedback
		err = s.ai.Post(ctx, "/v1/writing/score", map[string]any{"essay": a.Essay, "task": a.Task, "rulesVersion": a.RulesVersion}, &feedback)
		var result *writing.Feedback
		if err == nil && writing.ValidateFeedback(feedback, a.Essay) == nil {
			result = &feedback
		}
		commitCtx, done := context.WithTimeout(context.WithoutCancel(r.Context()), 5*time.Second)
		defer done()
		a, err = s.store.FinishWriting(commitCtx, u.ID, a.ID, a.Generation, result)
		if err != nil {
			writingError(w, err)
			return
		}
	}
	status := 200
	if a.Status == "evaluating" {
		status = 202
	}
	write(w, status, a)
}
func (s *Server) writingLegacy(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.signedInUser(w, r); !ok {
		return
	}
	problem(w, 409, "Writing feedback requires a saved Writing revision. Open Writing Lab to keep your essay and feedback together.")
}
