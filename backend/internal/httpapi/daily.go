package httpapi

import (
	"errors"
	"net/http"

	"github.com/Loccao102/LocCaoEnglish/backend/internal/engine"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/model"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/store"
)

func (s *Server) dailyRun(w http.ResponseWriter,r *http.Request){id,ok:=s.userID(w,r);if!ok{return};run,err:=s.buildDailyRun(r,id);if err!=nil{problem(w,500,err.Error());return};write(w,200,run)}
func (s *Server) claimDailyRun(w http.ResponseWriter,r *http.Request){id,ok:=s.userID(w,r);if!ok{return};run,err:=s.buildDailyRun(r,id);if err!=nil{problem(w,500,err.Error());return};if run.Claimed{write(w,200,run);return};if !run.Claimable{problem(w,409,"finish the daily quest chain before claiming the chest");return};claimed,err:=s.store.ClaimDailyReward(r.Context(),id,run.Date,run.ChestXP);if errors.Is(err,store.ErrNotFound){problem(w,404,"player not found");return};if err!=nil{problem(w,500,err.Error());return};run.Claimed=claimed||run.Claimed;run.Claimable=false;write(w,200,run)}
func(s *Server)buildDailyRun(r *http.Request,userID string)(model.DailyRun,error){skills,err:=s.store.Skills(r.Context(),userID);if err!=nil{return model.DailyRun{},err};reviews,_:=s.store.ReviewQueue(r.Context(),userID,20);profile,err:=s.store.GetPlayerProfile(r.Context(),userID);if err!=nil{return model.DailyRun{},err};plan:=engine.BuildPlanForProfile(skills,reviews,profile);evidence,err:=s.store.DailyEvidence(r.Context(),userID);if err!=nil{return model.DailyRun{},err};quests:=[]model.DailyQuest{};for _,item:=range plan.Items{if item.Skill=="Memory"{continue};q:=model.DailyQuest{ID:item.ID,Title:item.Title,Skill:item.Skill,Activity:item.Activity,Route:item.Route,XP:item.XP,Complete:store.DailyQuestComplete(evidence,item.Skill,item.Activity)};quests=append(quests,q);if len(quests)==3{break}};completed:=0;for _,q:=range quests{if q.Complete{completed++}};day:=store.CurrentPlayerDay();claimed,err:=s.store.DailyClaimed(r.Context(),userID,day);if err!=nil{return model.DailyRun{},err};return model.DailyRun{Date:day,Quests:quests,Completed:completed,Total:len(quests),ChestXP:50,Claimable:len(quests)>0&&completed==len(quests)&&!claimed,Claimed:claimed},nil}
