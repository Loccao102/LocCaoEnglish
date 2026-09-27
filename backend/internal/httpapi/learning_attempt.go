package httpapi

import (
	"errors"
	"net/http"
	"strings"

	"github.com/Loccao102/LocCaoEnglish/backend/internal/learning"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/model"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/store"
)

const (
	wordLinkRulesVersion = "word-link.v1"
	grammarRulesVersion  = "grammar-repair.v1"
)

func (s *Server) learningAttemptStart(w http.ResponseWriter, r *http.Request) {
	userID, ok := s.userID(w, r)
	if !ok { return }
	var in model.LearningAttemptStartInput
	if !decode(w, r, &in) { return }
	in.RequestID = strings.TrimSpace(in.RequestID)
	in.Activity = strings.TrimSpace(in.Activity)
	if in.RequestID == "" || len(in.RequestID) > 100 {
		problem(w, 400, "requestId is required and must be at most 100 characters"); return
	}
	level, valid := learning.NormalizeCEFR(in.CEFRLevel)
	if !valid {
		problem(w, 400, "cefrLevel must be one of A1, A2, B1, B2, C1, C2"); return
	}
	if len(in.ExcludeItemKeys) > 20 {
		problem(w, 400, "excludeItemKeys is too large"); return
	}
	pack := strings.TrimSpace(in.Pack)
	if pack == "" || pack == "default" { pack = "cefr-core" }

	var skill, itemKey, contentVersion, rulesVersion, promptText, correctAnswer, feedback string
	switch in.Activity {
	case "word-link":
		if pack != "cefr-core" && pack != "travel-airport" {
			problem(w, 400, "unsupported word-link pack"); return
		}
		item, err := learning.PickWordLink(level, pack, in.RequestID, in.ExcludeItemKeys)
		if err != nil { problem(w, 400, err.Error()); return }
		skill, itemKey = "Vocabulary", item.ID
		contentVersion, rulesVersion = learning.WordLinkContentVersion(), wordLinkRulesVersion
		promptText, correctAnswer, feedback = item.Word+" — "+item.Relation, item.CorrectAnswer, item.Note
	case "grammar-repair":
		if !supportedGrammarPack(pack) {
			problem(w, 400, "unsupported grammar-repair pack"); return
		}
		item, err := learning.PickGrammar(level, pack, in.RequestID, in.ExcludeItemKeys)
		if err != nil { problem(w, 400, err.Error()); return }
		skill, itemKey = "Grammar", item.ID
		contentVersion, rulesVersion = learning.GrammarContentVersion(), grammarRulesVersion
		promptText, correctAnswer, feedback = item.Question, item.CorrectAnswer, item.Feedback
	default:
		problem(w, 400, "activity is not supported by the verified learning engine"); return
	}

	rec, created, err := s.store.StartLearningAttempt(
		r.Context(), userID, in.RequestID, in.Activity, skill, itemKey, level,
		contentVersion, rulesVersion, promptText, correctAnswer, feedback,
	)
	if err != nil { problem(w, 500, err.Error()); return }
	if rec.Activity != in.Activity || rec.CEFRLevel != level || rec.Skill != skill {
		problem(w, 409, "requestId was already used for a different learning attempt"); return
	}
	response, ok := learningAttemptResponse(rec, pack)
	if !ok {
		problem(w, 409, "attempt content or pack no longer matches this request"); return
	}
	status := http.StatusOK
	if created { status = http.StatusCreated }
	write(w, status, response)
}

func learningAttemptResponse(rec store.LearningAttemptRecord, requestedPack string) (model.LearningAttemptStart, bool) {
	base := model.LearningAttemptStart{
		AttemptID: rec.ID, Activity: rec.Activity, ItemKey: rec.ItemKey, CEFRLevel: rec.CEFRLevel,
		ContentVersion: rec.ContentVersion, RulesVersion: rec.RulesVersion, Status: rec.Status,
	}
	switch rec.Activity {
	case "word-link":
		item, found := learning.WordLinkItemByID(rec.ItemKey)
		if !found || item.CEFRLevel != rec.CEFRLevel || item.Pack != requestedPack {
			return model.LearningAttemptStart{}, false
		}
		base.Pack = item.Pack
		base.Prompt = model.LearningAttemptPrompt{Word: item.Word, Relation: item.Relation, Options: learning.ShuffledOptions(item, rec.ID)}
		return base, true
	case "grammar-repair":
		item, found := learning.GrammarItemByID(rec.ItemKey)
		if !found || item.CEFRLevel != rec.CEFRLevel || item.Pack != requestedPack {
			return model.LearningAttemptStart{}, false
		}
		base.Pack = item.Pack
		base.Prompt = model.LearningAttemptPrompt{Question: item.Question, Options: learning.ShuffledGrammarOptions(item, rec.ID)}
		return base, true
	default:
		return model.LearningAttemptStart{}, false
	}
}

func supportedGrammarPack(pack string) bool {
	switch pack {
	case "cefr-core", "travel-hotel", "conversation-clarity", "work-requirements", "work-deadline":
		return true
	default:
		return false
	}
}

func (s *Server) learningAttemptSubmit(w http.ResponseWriter, r *http.Request) {
	userID, ok := s.userID(w, r)
	if !ok { return }
	var in model.LearningAttemptSubmitInput
	if !decode(w, r, &in) { return }
	if strings.TrimSpace(in.Answer) == "" {
		problem(w, 400, "answer is required"); return
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
