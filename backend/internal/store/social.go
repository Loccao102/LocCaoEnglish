package store

import (
	"context"
	"sort"

	"github.com/Loccao102/LocCaoEnglish/backend/internal/model"
)

func (s *Store) TopUsers(ctx context.Context, limit int) ([]model.LeaderboardEntry, error) {
	if limit <= 0 || limit > 100 { limit = 20 }
	if s.db != nil {
		rows, err := s.db.QueryContext(ctx, `SELECT id,display_name,xp,streak FROM users ORDER BY xp DESC, created_at ASC LIMIT $1`, limit)
		if err != nil { return nil, err }
		defer rows.Close()
		out := []model.LeaderboardEntry{}
		for rows.Next() { var item model.LeaderboardEntry; if err := rows.Scan(&item.UserID,&item.DisplayName,&item.XP,&item.Streak); err != nil { return nil,err }; item.Rank=len(out)+1; out=append(out,item) }
		return out, rows.Err()
	}
	s.mu.RLock(); defer s.mu.RUnlock(); out:=make([]model.LeaderboardEntry,0,len(s.mem.users));for _,acc:=range s.mem.users{out=append(out,model.LeaderboardEntry{UserID:acc.user.ID,DisplayName:acc.user.DisplayName,XP:acc.user.XP,Streak:acc.user.Streak})};sort.Slice(out,func(i,j int)bool{if out[i].XP==out[j].XP{return out[i].DisplayName<out[j].DisplayName};return out[i].XP>out[j].XP});if len(out)>limit{out=out[:limit]};for i:=range out{out[i].Rank=i+1};return out,nil
}
