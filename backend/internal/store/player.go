package store

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/lib/pq"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/model"
)

var playerProfileMu sync.RWMutex
var playerProfiles = map[string]model.PlayerProfile{}

func (s *Store) EnsurePlayerProfiles(ctx context.Context) error {
	if s.db == nil { return nil }
	_, err := s.db.ExecContext(ctx, `
CREATE TABLE IF NOT EXISTS player_profiles(
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  goal TEXT NOT NULL DEFAULT 'conversation',
  cefr_level TEXT NOT NULL DEFAULT 'B1',
  daily_minutes INTEGER NOT NULL DEFAULT 15,
  target_band DOUBLE PRECISION NOT NULL DEFAULT 7.0,
  interests TEXT[] NOT NULL DEFAULT '{}'::text[],
  onboarded BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);`)
	return err
}

func defaultPlayerProfile(userID string) model.PlayerProfile {
	return model.PlayerProfile{UserID:userID, Goal:"conversation", CEFRLevel:"B1", DailyMinutes:15, TargetBand:7.0, Interests:[]string{"travel","daily-life"}, Onboarded:false, UpdatedAt:time.Now().UTC()}
}

func (s *Store) GetPlayerProfile(ctx context.Context, userID string) (model.PlayerProfile, error) {
	if _, err := s.GetUser(ctx,userID); err != nil { return model.PlayerProfile{}, err }
	if s.db != nil {
		var p model.PlayerProfile
		err := s.db.QueryRowContext(ctx, `SELECT user_id,goal,cefr_level,daily_minutes,target_band,interests,onboarded,updated_at FROM player_profiles WHERE user_id=$1`, userID).Scan(&p.UserID,&p.Goal,&p.CEFRLevel,&p.DailyMinutes,&p.TargetBand,pq.Array(&p.Interests),&p.Onboarded,&p.UpdatedAt)
		if err == nil { return p,nil }
		if !errors.Is(err,ErrNotFound) && !strings.Contains(strings.ToLower(err.Error()),"no rows") { return p,err }
		return defaultPlayerProfile(userID),nil
	}
	playerProfileMu.RLock(); p,ok:=playerProfiles[userID]; playerProfileMu.RUnlock(); if ok{return p,nil}; return defaultPlayerProfile(userID),nil
}

func (s *Store) SavePlayerProfile(ctx context.Context, userID string, in model.PlayerProfile) (model.PlayerProfile, error) {
	if _, err := s.GetUser(ctx,userID); err != nil { return model.PlayerProfile{}, err }
	goal:=strings.ToLower(strings.TrimSpace(in.Goal)); switch goal{case "conversation","ielts","travel","work":default:return model.PlayerProfile{},fmt.Errorf("invalid goal")}
	level:=strings.ToUpper(strings.TrimSpace(in.CEFRLevel)); switch level{case "A1","A2","B1","B2","C1","C2":default:return model.PlayerProfile{},fmt.Errorf("invalid CEFR level")}
	minutes:=in.DailyMinutes;if minutes<5{minutes=5};if minutes>120{minutes=120}
	band:=in.TargetBand;if band<4{band=4};if band>9{band=9};band=float64(int(band*2+0.5))/2
	interests:=make([]string,0,8);seen:=map[string]bool{};for _,raw:=range in.Interests{value:=strings.ToLower(strings.TrimSpace(raw));if value!=""&&!seen[value]&&len(interests)<8{seen[value]=true;interests=append(interests,value)}}
	p:=model.PlayerProfile{UserID:userID,Goal:goal,CEFRLevel:level,DailyMinutes:minutes,TargetBand:band,Interests:interests,Onboarded:true,UpdatedAt:time.Now().UTC()}
	if s.db!=nil{_,err:=s.db.ExecContext(ctx,`INSERT INTO player_profiles(user_id,goal,cefr_level,daily_minutes,target_band,interests,onboarded,updated_at) VALUES($1,$2,$3,$4,$5,$6,TRUE,NOW()) ON CONFLICT(user_id) DO UPDATE SET goal=EXCLUDED.goal,cefr_level=EXCLUDED.cefr_level,daily_minutes=EXCLUDED.daily_minutes,target_band=EXCLUDED.target_band,interests=EXCLUDED.interests,onboarded=TRUE,updated_at=NOW()`,p.UserID,p.Goal,p.CEFRLevel,p.DailyMinutes,p.TargetBand,pq.Array(p.Interests));if err!=nil{return model.PlayerProfile{},err};return s.GetPlayerProfile(ctx,userID)}
	playerProfileMu.Lock();playerProfiles[userID]=p;playerProfileMu.Unlock();return p,nil
}
