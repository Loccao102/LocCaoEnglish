package httpapi

import (
	"errors"
	"net/http"
	"regexp"
	"strings"

	"github.com/Loccao102/LocCaoEnglish/backend/internal/learning"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/model"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/store"
)

const (
	wordLinkRulesVersion    = "word-link.v1"
	grammarRulesVersion     = "grammar-repair.v1"
	collocationRulesVersion = "collocation-factory.v1"
)

func (s *Server) learningAttemptStart(w http.ResponseWriter, r *http.Request) {
	userID, ok := s.learningOwner(w, r)
	if !ok {
		return
	}
	var in model.LearningAttemptStartInput
	if !decode(w, r, &in) {
		return
	}
	in.RequestID = strings.TrimSpace(in.RequestID)
	in.Activity = strings.TrimSpace(in.Activity)
	if !learningRequestID.MatchString(in.RequestID) {
		problem(w, 400, "requestId must be a UUIDv4")
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
	pack := strings.TrimSpace(in.Pack)
	if pack == "" || pack == "default" {
		pack = "cefr-core"
	}
	in.Pack, in.CEFRLevel = pack, level
	if in.ExcludeItemKeys == nil {
		in.ExcludeItemKeys = []string{}
	}
	// Restore by request key before consulting today's catalog. A lost creation
	// response must not change the question after a content deployment.
	if rec, err := s.store.FindLearningRequest(r.Context(), userID, in); err == nil {
		response, ok := learningAttemptResponse(rec, pack)
		if !ok {
			learningError(w, store.ErrAttemptExpired)
			return
		}
		write(w, http.StatusOK, response)
		return
	} else if !errors.Is(err, store.ErrNotFound) {
		learningError(w, err)
		return
	}
	var publicPrompt model.LearningAttemptPrompt

	var skill, itemKey, contentVersion, rulesVersion, promptText, correctAnswer, feedback string
	switch in.Activity {
	case "word-link":
		if pack != "cefr-core" && pack != "travel-airport" {
			problem(w, 400, "unsupported word-link pack")
			return
		}
		item, err := learning.PickWordLink(level, pack, in.RequestID, in.ExcludeItemKeys)
		if err != nil {
			problem(w, 400, err.Error())
			return
		}
		skill, itemKey = "Vocabulary", item.ID
		contentVersion, rulesVersion = learning.WordLinkContentVersion(), wordLinkRulesVersion
		promptText, correctAnswer, feedback = item.Word+" — "+item.Relation, item.CorrectAnswer, item.Note
		publicPrompt = model.LearningAttemptPrompt{Word: item.Word, Relation: item.Relation, Options: learning.ShuffledOptions(item, in.RequestID)}
	case "grammar-repair":
		if !supportedGrammarPack(pack) {
			problem(w, 400, "unsupported grammar-repair pack")
			return
		}
		item, err := learning.PickGrammar(level, pack, in.RequestID, in.ExcludeItemKeys)
		if err != nil {
			problem(w, 400, err.Error())
			return
		}
		skill, itemKey = "Grammar", item.ID
		contentVersion, rulesVersion = learning.GrammarContentVersion(), grammarRulesVersion
		promptText, correctAnswer, feedback = item.Question, item.CorrectAnswer, item.Feedback
		publicPrompt = model.LearningAttemptPrompt{Question: item.Question, Options: learning.ShuffledGrammarOptions(item, in.RequestID)}
	case "collocation-factory":
		if !supportedCollocationPack(pack) {
			problem(w, 400, "unsupported collocation-factory pack")
			return
		}
		item, err := learning.PickCollocation(level, pack, in.RequestID, in.ExcludeItemKeys)
		if err != nil {
			problem(w, 400, err.Error())
			return
		}
		skill, itemKey = "Vocabulary", item.ID
		contentVersion, rulesVersion = learning.CollocationContentVersion(), collocationRulesVersion
		promptText, correctAnswer, feedback = item.Question+" — "+item.Core+" + ?", item.CorrectAnswer, item.Feedback
		publicPrompt = model.LearningAttemptPrompt{Word: item.Core, Question: item.Question, Relation: "Complete the natural collocation", Options: learning.ShuffledCollocationOptions(item, in.RequestID)}
	default:
		problem(w, 400, "activity is not supported by the verified learning engine")
		return
	}

	rec, created, err := s.store.StartLearningAttempt(
		r.Context(), userID, in.RequestID, in.Activity, skill, itemKey, level,
		contentVersion, rulesVersion, promptText, correctAnswer, feedback,
		store.LearningSnapshot{Input: in, Prompt: publicPrompt},
	)
	if err != nil {
		learningError(w, err)
		return
	}
	if rec.Activity != in.Activity || rec.CEFRLevel != level || rec.Skill != skill {
		problem(w, 409, "requestId was already used for a different learning attempt")
		return
	}
	response, ok := learningAttemptResponse(rec, pack)
	if !ok {
		problem(w, 409, "attempt content or pack no longer matches this request")
		return
	}
	status := http.StatusOK
	if created {
		status = http.StatusCreated
	}
	write(w, status, response)
}

func learningAttemptResponse(rec store.LearningAttemptRecord, requestedPack string) (model.LearningAttemptStart, bool) {
	base := model.LearningAttemptStart{
		AttemptID: rec.ID, Activity: rec.Activity, ItemKey: rec.ItemKey, CEFRLevel: rec.CEFRLevel,
		ContentVersion: rec.ContentVersion, RulesVersion: rec.RulesVersion, Status: rec.Status,
		Pack: rec.Snapshot.Input.Pack, Prompt: rec.Snapshot.Prompt, ExpiresAt: rec.ExpiresAt, Result: store.LearningResult(rec), Mode: "account",
	}
	if rec.UserID == "" {
		base.Mode = "guest"
	}
	return base, base.Pack == requestedPack && len(base.Prompt.Options) > 0
}

func supportedGrammarPack(pack string) bool {
	switch pack {
	case "cefr-core", "travel-hotel", "conversation-clarity", "work-requirements", "work-deadline":
		return true
	default:
		return false
	}
}

func supportedCollocationPack(pack string) bool {
	switch pack {
	case "cefr-core", "travel-transit", "conversation-cafe", "conversation-clarity", "work-standup", "work-deadline":
		return true
	default:
		return false
	}
}

func (s *Server) learningAttemptSubmit(w http.ResponseWriter, r *http.Request) {
	userID, ok := s.learningOwner(w, r)
	if !ok {
		return
	}
	var in model.LearningAttemptSubmitInput
	if !decode(w, r, &in) {
		return
	}
	if strings.TrimSpace(in.Answer) == "" || len(in.Answer) > 2048 || in.ContentVersion == "" || in.RulesVersion == "" {
		problem(w, 400, "answer and content/rules versions are required; refresh an older client")
		return
	}
	result, err := s.store.SubmitLearningAttempt(r.Context(), userID, r.PathValue("id"), in.Answer, in)
	if err != nil {
		learningError(w, err)
		return
	}
	write(w, 200, result)
}

var learningRequestID = regexp.MustCompile(`^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$`)

func (s *Server) learningOwner(w http.ResponseWriter, r *http.Request) (string, bool) {
	if strings.TrimSpace(r.Header.Get("Authorization")) == "" {
		return "", true
	}
	u, ok := s.signedInUser(w, r)
	return u.ID, ok
}
func (s *Server) learningAttemptGet(w http.ResponseWriter, r *http.Request) {
	owner, ok := s.learningOwner(w, r)
	if !ok {
		return
	}
	rec, err := s.store.GetLearningAttempt(r.Context(), owner, r.PathValue("id"))
	if err != nil {
		learningError(w, err)
		return
	}
	value, ok := learningAttemptResponse(rec, rec.Snapshot.Input.Pack)
	if !ok {
		learningError(w, store.ErrAttemptExpired)
		return
	}
	write(w, 200, value)
}
func learningError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, store.ErrNotFound), errors.Is(err, store.ErrAttemptOwner):
		problem(w, 404, "learning attempt not found")
	case errors.Is(err, store.ErrAttemptConflict):
		problem(w, 409, err.Error())
	case errors.Is(err, store.ErrAttemptExpired):
		problem(w, 410, err.Error())
	case errors.Is(err, store.ErrAttemptInput):
		problem(w, 400, err.Error())
	default:
		problem(w, 500, "could not save this learning round; retry the same request")
	}
}
