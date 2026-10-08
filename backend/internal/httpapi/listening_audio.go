package httpapi

import (
	"context"
	"net/http"
	"time"

	"github.com/Loccao102/LocCaoEnglish/backend/internal/model"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/store"
)

func (s *Server) registerListeningRoutes(mux *http.ServeMux) {
	mux.HandleFunc("POST /v1/learning/attempts/{id}/audio", s.listeningAudio)
}
func (s *Server) listeningAudio(w http.ResponseWriter, r *http.Request) {
	owner, ok := s.learningOwner(w, r)
	if !ok {
		return
	}
	var input struct {
		model.ListeningPlayback
		ContentVersion string `json:"contentVersion"`
		RulesVersion   string `json:"rulesVersion"`
	}
	if !decode(w, r, &input) {
		return
	}
	if !learningRequestID.MatchString(input.RequestID) {
		problem(w, 400, "audio requestId must be a UUIDv4")
		return
	}
	rec, err := s.store.RecordListeningPlayback(r.Context(), owner, r.PathValue("id"), input.ContentVersion, input.RulesVersion, input.ListeningPlayback)
	if err != nil {
		learningError(w, err)
		return
	}
	response, _ := learningAttemptResponse(rec, rec.Snapshot.Input.Pack)
	output := struct {
		Attempt model.LearningAttemptStart `json:"attempt"`
		Audio   any                        `json:"audio,omitempty"`
	}{Attempt: response}
	pending := false
	for _, event := range rec.Snapshot.Listening.Events {
		if event.RequestID == input.RequestID && event.Status == "requested" {
			pending = true
		}
	}
	if input.Status == "requested" && pending {
		if rec.Status != "active" {
			learningError(w, store.ErrAttemptConflict)
			return
		}
		if !time.Now().Before(rec.ExpiresAt) {
			learningError(w, store.ErrAttemptExpired)
			return
		}
		var generated struct {
			Provider    string `json:"provider"`
			AudioBase64 string `json:"audioBase64"`
			MimeType    string `json:"mimeType"`
		}
		ctx, cancel := context.WithTimeout(r.Context(), 8*time.Second)
		defer cancel()
		err = s.ai.Post(ctx, "/v1/tts/synthesize", map[string]any{"text": rec.Snapshot.Listening.Transcript, "locale": "en-US", "voice": "en-US-JennyNeural", "rate": input.Rate}, &generated)
		if err == nil && generated.Provider == "azure-speech-neural-tts" && generated.MimeType == "audio/mpeg" && generated.AudioBase64 != "" {
			output.Audio = map[string]any{"provider": generated.Provider, "audioBase64": generated.AudioBase64, "mimeType": generated.MimeType, "rate": input.Rate}
		} else {
			// Browser synthesis requires text. It is deliberate assistance, not secret
			// assessment content; no answer key or grading feedback is returned here.
			output.Audio = map[string]any{"provider": "browser-speech-synthesis", "text": rec.Snapshot.Listening.Transcript, "rate": input.Rate}
		}
	}
	write(w, 200, output)
}
