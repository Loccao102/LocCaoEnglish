package httpapi

import (
	"errors"
	"net/http"
	"strings"

	"github.com/Loccao102/LocCaoEnglish/backend/internal/learning"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/model"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/store"
)

const wordLinkRulesVersion = "word-link.v1"

func (s *Server) learningAttemptStart(w http.ResponseWriter, r *http.Request) {
	userID, ok := s.userID(w, r)
	if !ok {
		return
	}
	var in model.LearningAttemptStartInput
	if !decode(w, r, &in) {
		return
	}
	in.RequestID = strings.TrimSpace(in.RequestID)
	in.Activity = strings.TrimSpace(in.Activity)
	if in.RequestID == "" || len(in.RequestID) > 100 {
		problem(w, 400, "requestId is required and must be at most 100 characters")
		return
	}
	if in.Activity != "word-link" {
		problem(w, 400, "only word-link uses the verified learning attempt pilot")
		return
	}
	level, valid := learning.NormalizeCEFR(in.CEFRLevel)
	if !valid {
		problem(w, 400, "cefrLevel must be one of A1, A2, B1, B2, C1, C2")
		return
	}
	if len(in.ExcludeItemKeys) > 20 {
		problem(w, 400, "excludeItemKeys is too large")
		return
	}
	item, err := learning.PickWordLink(level, in.RequestID, in.ExcludeItemKeys)
	if err != nil {
		problem(w, 500, err.Error())
		return
	}
	rec, created, err := s.store.StartLearningAttempt(
		r.Context(), userID, in.RequestID, in.Activity, item.ID, level,
		learning.WordLinkContentVersion(), wordLinkRulesVersion,
		item.Word+" — "+item.Relation, item.CorrectAnswer, item.Note,
	)
	if err != nil {
		problem(w, 500, err.Error())
		return
	}
	if rec.Activity != in.Activity || rec.CEFRLevel != level {
		problem(w, 409, "requestId was already used for a different learning attempt")
		return
	}
	storedItem, found := learning.WordLinkItemByID(rec.ItemKey)
	if !found || storedItem.CEFRLevel != rec.CEFRLevel {
		problem(w, 409, "attempt content version is no longer available")
		return
	}
	status := http.StatusOK
	if created {
		status = http.StatusCreated
	}
	write(w, status, model.LearningAttemptStart{
		AttemptID: rec.ID, Activity: rec.Activity, ItemKey: rec.ItemKey, CEFRLevel: rec.CEFRLevel,
		ContentVersion: rec.ContentVersion, RulesVersion: rec.RulesVersion, Status: rec.Status,
		Prompt: model.LearningAttemptPrompt{
			Word: storedItem.Word, Relation: storedItem.Relation,
			Options: learning.ShuffledOptions(storedItem, rec.ID),
		},
	})
}

func (s *Server) learningAttemptSubmit(w http.ResponseWriter, r *http.Request) {
	userID, ok := s.userID(w, r)
	if !ok {
		return
	}
	var in model.LearningAttemptSubmitInput
	if !decode(w, r, &in) {
		return
	}
	if strings.TrimSpace(in.Answer) == "" {
		problem(w, 400, "answer is required")
		return
	}
	result, err := s.store.SubmitLearningAttempt(r.Context(), userID, r.PathValue("id"), in.Answer)
	switch {
	case errors.Is(err, store.ErrNotFound), errors.Is(err, store.ErrAttemptOwner):
		problem(w, 404, "learning attempt not found")
	case errors.Is(err, store.ErrAttemptConflict):
		problem(w, 409, err.Error())
	case err != nil:
		problem(w, 500, err.Error())
	default:
		write(w, 200, result)
	}
}
