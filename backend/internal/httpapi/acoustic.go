package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"time"

	"github.com/Loccao102/LocCaoEnglish/backend/internal/acoustic"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/store"
)

func (s *Server) registerAcousticRoutes(mux *http.ServeMux) {
	mux.HandleFunc("POST /v1/speaking/assessments", s.acousticStart)
	mux.HandleFunc("GET /v1/speaking/assessments", s.acousticList)
	mux.HandleFunc("GET /v1/speaking/assessments/{id}", s.acousticGet)
	mux.HandleFunc("GET /v1/speaking/assessments/by-request/{requestId}", s.acousticRequest)
	mux.HandleFunc("POST /v1/speaking/assessments/{id}/retry", s.acousticRetry)
}
func acousticError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, store.ErrNotFound), errors.Is(err, store.ErrAttemptOwner):
		problem(w, 404, "Recording assessment not found")
	case errors.Is(err, acoustic.ErrInput):
		problem(w, 400, "Invalid recording or practice version. Use the in-browser recorder and current phrase.")
	case errors.Is(err, acoustic.ErrConflict), errors.Is(err, acoustic.ErrNeedsAudio):
		problem(w, 409, err.Error())
	default:
		problem(w, 503, "Could not confirm the saved pronunciation request. Check its saved status before retrying.")
	}
}
func (s *Server) acousticRequest(w http.ResponseWriter, r *http.Request) {
	u, ok := s.signedInUser(w, r)
	if !ok {
		return
	}
	item, err := s.store.AcousticByRequest(r.Context(), u.ID, r.PathValue("requestId"))
	if err != nil {
		acousticError(w, err)
		return
	}
	write(w, 200, item)
}
func decodeAcousticInput(w http.ResponseWriter, r *http.Request, out any) bool {
	d := json.NewDecoder(http.MaxBytesReader(w, r.Body, 600000))
	d.DisallowUnknownFields()
	if err := d.Decode(out); err != nil {
		problem(w, 400, "Invalid pronunciation request")
		return false
	}
	if err := d.Decode(new(any)); err != io.EOF {
		problem(w, 400, "A single pronunciation request is required")
		return false
	}
	return true
}
func (s *Server) acousticList(w http.ResponseWriter, r *http.Request) {
	u, ok := s.signedInUser(w, r)
	if !ok {
		return
	}
	items, err := s.store.ListAcoustic(r.Context(), u.ID, r.URL.Query().Get("attemptId"))
	if err != nil {
		acousticError(w, err)
		return
	}
	write(w, 200, map[string]any{"items": items})
}
func (s *Server) acousticGet(w http.ResponseWriter, r *http.Request) {
	u, ok := s.signedInUser(w, r)
	if !ok {
		return
	}
	item, err := s.store.GetAcoustic(r.Context(), u.ID, r.PathValue("id"))
	if err != nil {
		acousticError(w, err)
		return
	}
	write(w, 200, item)
}
func (s *Server) acousticStart(w http.ResponseWriter, r *http.Request) {
	u, ok := s.signedInUser(w, r)
	if !ok {
		return
	}
	var in acoustic.StartInput
	if !decodeAcousticInput(w, r, &in) {
		return
	}
	_, sample, err := acoustic.DecodeWAV(in.AudioBase64)
	if err != nil {
		acousticError(w, err)
		return
	}
	item, err := s.store.StartAcoustic(r.Context(), u.ID, in, sample)
	if err != nil {
		acousticError(w, err)
		return
	}
	s.evaluateAcoustic(w, r, u.ID, item.ID, 0, in.AudioBase64, sample.SHA256)
}
func (s *Server) acousticRetry(w http.ResponseWriter, r *http.Request) {
	u, ok := s.signedInUser(w, r)
	if !ok {
		return
	}
	var in acoustic.RetryInput
	if !decodeAcousticInput(w, r, &in) {
		return
	}
	hash := ""
	if in.AudioBase64 != "" {
		_, sample, err := acoustic.DecodeWAV(in.AudioBase64)
		if err != nil {
			acousticError(w, err)
			return
		}
		hash = sample.SHA256
	}
	s.evaluateAcoustic(w, r, u.ID, r.PathValue("id"), in.Generation, in.AudioBase64, hash)
}
func (s *Server) evaluateAcoustic(w http.ResponseWriter, r *http.Request, owner, id string, generation int, encoded, hash string) {
	item, claimed, err := s.store.ClaimAcoustic(r.Context(), owner, id, generation, hash)
	if err != nil {
		acousticError(w, err)
		return
	}
	if claimed {
		ctx, cancel := context.WithTimeout(context.WithoutCancel(r.Context()), 30*time.Second)
		defer cancel()
		var feedback acoustic.Feedback
		err = s.ai.Post(ctx, "/v1/pronunciation/score", map[string]any{"audioBase64": encoded, "referenceText": item.Reference, "transcript": item.Transcript, "locale": "en-US"}, &feedback)
		var valid *acoustic.Feedback
		if err == nil && acoustic.Validate(feedback, item) == nil {
			valid = &feedback
		}
		commitCtx, done := context.WithTimeout(context.WithoutCancel(r.Context()), 5*time.Second)
		defer done()
		item, err = s.store.FinishAcoustic(commitCtx, owner, id, item.Generation, valid)
		if err != nil {
			acousticError(w, err)
			return
		}
	}
	status := 200
	if item.Status == "evaluating" {
		status = 202
	}
	write(w, status, item)
}
