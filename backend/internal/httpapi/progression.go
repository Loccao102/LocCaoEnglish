package httpapi

import (
	"errors"
	"net/http"

	"github.com/Loccao102/LocCaoEnglish/backend/internal/engine"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/model"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/store"
)

func (s *Server) registerProgressionRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /v1/player/progression", s.playerProgression)
	mux.HandleFunc("POST /v1/player/bosses/{id}/evaluate", s.evaluateBoss)
	mux.HandleFunc("POST /v1/player/bosses/{id}/complete", s.completeBoss)
	mux.HandleFunc("GET /v1/player/bosses/{id}/receipt", s.missionReceipt)
	mux.HandleFunc("PUT /v1/player/loadout", s.equipCosmetic)
	mux.HandleFunc("GET /v1/player/daily", s.dailyRun)
	mux.HandleFunc("GET /v1/player/daily/claims/{day}", s.dailyReceipt)
	mux.HandleFunc("POST /v1/player/daily/claim", s.claimDailyRun)
}

func (s *Server) playerProgression(w http.ResponseWriter, r *http.Request) {
	id, ok := s.userID(w, r)
	if !ok {
		return
	}
	state, err := s.store.GetProgression(r.Context(), id)
	if err != nil {
		problem(w, 500, err.Error())
		return
	}
	write(w, 200, state)
}

func (s *Server) evaluateBoss(w http.ResponseWriter, r *http.Request) {
	u, ok := s.signedInUser(w, r)
	if !ok {
		return
	}
	id := u.ID
	var in struct {
		Messages     []string `json:"messages"`
		RulesVersion string   `json:"rulesVersion"`
	}
	if !decode(w, r, &in) {
		return
	}
	if in.RulesVersion != engine.ConversationRulesVersion {
		problem(w, 409, "conversation rules changed; reload this mission")
		return
	}
	if err := engine.ValidateConversation(r.PathValue("id"), in.Messages); err != nil {
		problem(w, 400, err.Error())
		return
	}
	bossID := r.PathValue("id")
	state, err := s.store.GetProgression(r.Context(), id)
	if err != nil {
		problem(w, 500, err.Error())
		return
	}
	found := false
	unlocked := false
	cleared := false
	for _, boss := range state.Bosses {
		if boss.ID == bossID {
			found = true
			unlocked = boss.Unlocked
			cleared = boss.Cleared
			break
		}
	}
	if !found {
		problem(w, 404, "boss not found")
		return
	}
	if !unlocked && !cleared {
		problem(w, 409, "boss gate is still locked")
		return
	}
	write(w, 200, engine.EvaluateBossConversation(bossID, in.Messages))
}

func (s *Server) completeBoss(w http.ResponseWriter, r *http.Request) {
	u, ok := s.signedInUser(w, r)
	if !ok {
		return
	}
	var in struct {
		Messages     []string `json:"messages"`
		RulesVersion string   `json:"rulesVersion"`
	}
	if !decode(w, r, &in) {
		return
	}
	state, err := s.store.CompleteBoss(r.Context(), u.ID, r.PathValue("id"), in.Messages, in.RulesVersion)
	if errors.Is(err, store.ErrNotFound) {
		problem(w, 404, "boss not found")
		return
	}
	if err != nil {
		problem(w, 409, err.Error())
		return
	}
	write(w, 200, state)
}

func (s *Server) missionReceipt(w http.ResponseWriter, r *http.Request) {
	u, ok := s.signedInUser(w, r)
	if !ok {
		return
	}
	receipt, err := s.store.GetMissionReceipt(r.Context(), u.ID, r.PathValue("id"))
	if errors.Is(err, store.ErrNotFound) {
		problem(w, 404, "no saved completion for this mission")
		return
	}
	if err != nil {
		problem(w, 500, "could not load mission receipt")
		return
	}
	write(w, 200, receipt)
}

func (s *Server) equipCosmetic(w http.ResponseWriter, r *http.Request) {
	id, ok := s.userID(w, r)
	if !ok {
		return
	}
	var in model.EquipCosmeticInput
	if !decode(w, r, &in) {
		return
	}
	state, err := s.store.EquipCosmetic(r.Context(), id, in.CosmeticID)
	if errors.Is(err, store.ErrNotFound) {
		problem(w, 404, "cosmetic not found")
		return
	}
	if err != nil {
		problem(w, 409, err.Error())
		return
	}
	write(w, 200, state)
}
