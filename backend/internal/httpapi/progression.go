package httpapi

import (
	"errors"
	"net/http"

	"github.com/Loccao102/LocCaoEnglish/backend/internal/model"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/store"
)

func (s *Server) registerProgressionRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /v1/player/progression", s.playerProgression)
	mux.HandleFunc("POST /v1/player/bosses/{id}/complete", s.completeBoss)
	mux.HandleFunc("PUT /v1/player/loadout", s.equipCosmetic)
}

func (s *Server) playerProgression(w http.ResponseWriter, r *http.Request) {
	id, ok := s.userID(w,r); if !ok { return }
	state, err := s.store.GetProgression(r.Context(),id); if err != nil { problem(w,500,err.Error()); return }
	write(w,200,state)
}

func (s *Server) completeBoss(w http.ResponseWriter, r *http.Request) {
	id, ok := s.userID(w,r); if !ok { return }
	var in struct{ Score int `json:"score"` }; if !decode(w,r,&in){ return }
	state, err := s.store.CompleteBoss(r.Context(),id,r.PathValue("id"),in.Score)
	if errors.Is(err,store.ErrNotFound){problem(w,404,"boss not found");return};if err!=nil{problem(w,409,err.Error());return};write(w,200,state)
}

func (s *Server) equipCosmetic(w http.ResponseWriter, r *http.Request) {
	id, ok := s.userID(w,r); if !ok { return }
	var in model.EquipCosmeticInput; if !decode(w,r,&in){ return }
	state, err := s.store.EquipCosmetic(r.Context(),id,in.CosmeticID)
	if errors.Is(err,store.ErrNotFound){problem(w,404,"cosmetic not found");return};if err!=nil{problem(w,409,err.Error());return};write(w,200,state)
}
