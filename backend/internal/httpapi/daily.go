package httpapi

import (
	"encoding/json"
	"errors"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/daily"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/model"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/store"
	"io"
	"net/http"
	"time"
)

func dailyError(w http.ResponseWriter, e error) {
	switch {
	case errors.Is(e, store.ErrNotFound):
		problem(w, 404, "Daily record not found")
	case errors.Is(e, daily.ErrInput):
		problem(w, 400, e.Error())
	case errors.Is(e, daily.ErrConflict), errors.Is(e, daily.ErrExpired), errors.Is(e, daily.ErrIncomplete):
		problem(w, 409, e.Error())
	default:
		problem(w, 503, "Could not confirm the daily record. Refresh its saved status before retrying.")
	}
}
func (s *Server) dailyRun(w http.ResponseWriter, r *http.Request) {
	u, ok := s.signedInUser(w, r)
	if !ok {
		return
	}
	run, e := s.buildDailyRun(r, u.ID)
	if e != nil {
		dailyError(w, e)
		return
	}
	write(w, 200, run)
}
func (s *Server) dailyReceipt(w http.ResponseWriter, r *http.Request) {
	u, ok := s.signedInUser(w, r)
	if !ok {
		return
	}
	receipt, e := s.store.DailyReceipt(r.Context(), u.ID, r.PathValue("day"))
	if e != nil {
		dailyError(w, e)
		return
	}
	write(w, 200, receipt)
}
func (s *Server) claimDailyRun(w http.ResponseWriter, r *http.Request) {
	u, ok := s.signedInUser(w, r)
	if !ok {
		return
	}
	var in struct {
		Date         string `json:"date"`
		RulesVersion string `json:"rulesVersion"`
	}
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 2048))
	decoder.DisallowUnknownFields()
	if decoder.Decode(&in) != nil {
		problem(w, 400, "Invalid daily claim request")
		return
	}
	if decoder.Decode(new(any)) != io.EOF {
		problem(w, 400, "A single daily claim request is required")
		return
	}
	receipt, _, e := s.store.ClaimDailyReward(r.Context(), u.ID, in.Date, in.RulesVersion)
	if e != nil {
		dailyError(w, e)
		return
	}
	run := model.DailyRun{Date: receipt.Date, RulesVersion: daily.RulesVersion, Method: daily.Method, Quests: []model.DailyQuest{}, ChestXP: receipt.RewardXP, Claimed: true, Receipt: &receipt}
	if receipt.Plan != nil {
		run.Quests = append(run.Quests, receipt.Plan.Quests...)
		for i := range run.Quests {
			run.Quests[i].Complete = true
		}
		run.Total = len(run.Quests)
		run.Completed = run.Total
	} else {
		run.Method = "legacy-unverified"
	}
	write(w, 200, run)
}
func (s *Server) buildDailyRun(r *http.Request, owner string) (model.DailyRun, error) {
	day := store.CurrentPlayerDay()
	p, e := s.store.GetDailyPlan(r.Context(), owner, day)
	if errors.Is(e, store.ErrNotFound) {
		skills, err := s.store.Skills(r.Context(), owner)
		if err != nil {
			return model.DailyRun{}, err
		}
		profile, err := s.store.GetPlayerProfile(r.Context(), owner)
		if err != nil {
			return model.DailyRun{}, err
		}
		p, e = s.store.SaveDailyPlan(r.Context(), owner, daily.Build(day, skills, profile, time.Now()))
	}
	if e != nil {
		return model.DailyRun{}, e
	}
	evidence, e := s.store.DailyEvidence(r.Context(), owner, day)
	if e != nil {
		return model.DailyRun{}, e
	}
	receipt, e := s.store.DailyReceipt(r.Context(), owner, day)
	var saved *model.DailyClaimReceipt
	if e == nil {
		saved = &receipt
	} else if !errors.Is(e, store.ErrNotFound) {
		return model.DailyRun{}, e
	}
	run := model.DailyRun{Date: day, RulesVersion: p.RulesVersion, Method: daily.Method, Quests: append([]model.DailyQuest{}, p.Quests...), ChestXP: daily.RewardXP, Receipt: saved, Claimed: saved != nil, Total: len(p.Quests)}
	for i, q := range run.Quests {
		if evidence[q.Activity] != "" {
			run.Quests[i].Complete = true
			run.Completed++
		}
	}
	run.Claimable = run.Total > 0 && run.Completed == run.Total && !run.Claimed
	return run, nil
}
