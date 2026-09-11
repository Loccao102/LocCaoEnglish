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
	mux.HandleFunc("PUT /v1/player/loadout", s.equipCosmetic)
	mux.HandleFunc("GET /v1/player/daily", s.dailyRun)
	mux.HandleFunc("POST /v1/player/daily/claim", s.claimDailyRun)
}

func (s *Server) playerProgression(w http.ResponseWriter, r *http.Request) { id,ok:=s.userID(w,r);if!ok{return};state,err:=s.store.GetProgression(r.Context(),id);if err!=nil{problem(w,500,err.Error());return};write(w,200,state) }

func (s *Server) evaluateBoss(w http.ResponseWriter, r *http.Request) {
	id,ok:=s.userID(w,r);if!ok{return}
	var in struct{ Messages []string `json:"messages"` };if!decode(w,r,&in){return}
	bossID:=r.PathValue("id");state,err:=s.store.GetProgression(r.Context(),id);if err!=nil{problem(w,500,err.Error());return}
	found:=false;unlocked:=false;cleared:=false;for _,boss:=range state.Bosses{if boss.ID==bossID{found=true;unlocked=boss.Unlocked;cleared=boss.Cleared;break}}
	if !found{problem(w,404,"boss not found");return};if !unlocked&&!cleared{problem(w,409,"boss gate is still locked");return}
	write(w,200,engine.EvaluateBossConversation(bossID,in.Messages))
}

func (s *Server) completeBoss(w http.ResponseWriter, r *http.Request) {
	id,ok:=s.userID(w,r);if!ok{return}
	var in struct{Score int `json:"score"`;Messages []string `json:"messages"`};if!decode(w,r,&in){return}
	verdict:=engine.EvaluateBossConversation(r.PathValue("id"),in.Messages)
	if !verdict.Complete{problem(w,409,"conversation objectives are incomplete");return}
	state,err:=s.store.CompleteBoss(r.Context(),id,r.PathValue("id"),verdict.Score);if errors.Is(err,store.ErrNotFound){problem(w,404,"boss not found");return};if err!=nil{problem(w,409,err.Error());return};write(w,200,state)
}

func (s *Server) equipCosmetic(w http.ResponseWriter, r *http.Request) { id,ok:=s.userID(w,r);if!ok{return};var in model.EquipCosmeticInput;if!decode(w,r,&in){return};state,err:=s.store.EquipCosmetic(r.Context(),id,in.CosmeticID);if errors.Is(err,store.ErrNotFound){problem(w,404,"cosmetic not found");return};if err!=nil{problem(w,409,err.Error());return};write(w,200,state) }
