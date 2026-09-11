package store

import (
	"context"
	"errors"
	"fmt"
	"math"
	"strings"
	"sync"
	"time"

	"github.com/Loccao102/LocCaoEnglish/backend/internal/model"
)

type progressionMemory struct {
	mu      sync.RWMutex
	bosses  map[string]map[string]time.Time
	loadout map[string]map[string]string
}

var progressionMemories sync.Map

func (s *Store) progressionMemory() *progressionMemory {
	if v, ok := progressionMemories.Load(s); ok { return v.(*progressionMemory) }
	state := &progressionMemory{bosses: map[string]map[string]time.Time{}, loadout: map[string]map[string]string{}}
	actual, _ := progressionMemories.LoadOrStore(s, state)
	return actual.(*progressionMemory)
}

func (s *Store) EnsureProgression(ctx context.Context) error {
	if s.db == nil { _ = s.progressionMemory(); return nil }
	_, err := s.db.ExecContext(ctx, progressionSchemaSQL)
	return err
}

func (s *Store) GetProgression(ctx context.Context, userID string) (model.ProgressionState, error) {
	u, err := s.GetUser(ctx, userID); if err != nil { return model.ProgressionState{}, err }
	profile, err := s.GetPlayerProfile(ctx, userID); if err != nil { return model.ProgressionState{}, err }
	skills, err := s.Skills(ctx, userID); if err != nil { return model.ProgressionState{}, err }
	history, _ := s.IELTSHistory(ctx, userID, 100)
	bossDone, err := s.bossCompletions(ctx, userID); if err != nil { return model.ProgressionState{}, err }
	loadout, err := s.playerLoadout(ctx, userID); if err != nil { return model.ProgressionState{}, err }

	vocab := skillConfidence(skills, "Vocabulary")
	travel := profile.Goal == "travel" || u.XP >= 150
	wordNet := vocab >= .55 || u.XP >= 300
	arena := u.XP >= 700
	ielts := profile.Goal == "ielts" || u.XP >= 1000 || len(history) > 0
	sections := map[string]bool{}
	for _, h := range history { sections[strings.ToLower(h.Section)] = true }
	ieltsProgress := minInt(100, len(sections)*25)

	worlds := []model.WorldState{
		{ID:"training",Title:"Training Grounds",Description:"Daily quests, Recovery and the Arcade build your core stats.",Route:"/learn",Icon:"⌂",Unlocked:true,Progress:minInt(100,percent(u.XP,150)),UnlockText:"Always open"},
		{ID:"travel",Title:"Travel District",Description:"Airport, hotel and transport missions under real-world pressure.",Route:"/courses",Icon:"✈",Unlocked:travel,Progress:avgPercent(skillConfidence(skills,"Vocabulary"),skillConfidence(skills,"Listening"),skillConfidence(skills,"Speaking")),UnlockText:"Choose Travel as your goal or reach 150 XP"},
		{ID:"words",Title:"Word Network",Description:"Explore meaning, collocations and word families as a connected map.",Route:"/word-graph",Icon:"◇",Unlocked:wordNet,Progress:minInt(100,int(math.Round(vocab*100))),UnlockText:"Reach 55% Vocabulary confidence or 300 XP"},
		{ID:"arena",Title:"Battle Arena",Description:"Challenge other learners and put fast recall under pressure.",Route:"/social",Icon:"⚔",Unlocked:arena,Progress:minInt(100,percent(u.XP,700)),UnlockText:"Reach 700 XP"},
		{ID:"ielts",Title:"IELTS Tower",Description:"Clear four floors and build a four-skill practice estimate.",Route:"/ielts",Icon:"▤",Unlocked:ielts,Progress:ieltsProgress,UnlockText:"Choose IELTS as your goal, reach 1,000 XP, or complete an IELTS floor"},
	}

	vocabReady, _ := s.hasSkillEvidence(ctx,userID,"Vocabulary")
	listenReady, _ := s.hasSkillEvidence(ctx,userID,"Listening")
	speakReady, _ := s.hasSkillEvidence(ctx,userID,"Speaking")
	airportDone, airportTime := bossDone["airport-crisis"]
	boss := model.BossState{ID:"airport-crisis",Title:"Missed Flight",WorldID:"travel",Route:"/missions/airport",Unlocked:travel && vocabReady && listenReady && speakReady,Cleared:airportDone,RewardXP:150,CompletedAt:airportTime,Checkpoints:[]model.BossCheckpoint{
		{ID:"airport-vocab",Title:"Check-in vocabulary",Skill:"Vocabulary",Route:"/games/word-link",Complete:vocabReady},
		{ID:"airport-listening",Title:"Flight announcement",Skill:"Listening",Route:"/dictation",Complete:listenReady},
		{ID:"airport-speaking",Title:"Explain the problem",Skill:"Speaking",Route:"/speaking",Complete:speakReady},
	}}

	unlockedWorlds := 0; for _, w := range worlds { if w.Unlocked { unlockedWorlds++ } }
	achievements := []model.Achievement{
		{ID:"first-spark",Title:"First Spark",Description:"Earn your first 20 XP.",Icon:"✦",Unlocked:u.XP>=20,Progress:minInt(u.XP,20),Target:20},
		{ID:"world-walker",Title:"World Walker",Description:"Unlock three learning worlds.",Icon:"◫",Unlocked:unlockedWorlds>=3,Progress:minInt(unlockedWorlds,3),Target:3,RewardCosmetic:"traveler-badge"},
		{ID:"seven-day-flame",Title:"Seven Day Flame",Description:"Keep a seven-day learning streak.",Icon:"🔥",Unlocked:u.Streak>=7,Progress:minInt(u.Streak,7),Target:7},
		{ID:"wordsmith",Title:"Wordsmith",Description:"Raise Vocabulary confidence to 70%.",Icon:"◇",Unlocked:vocab>=.70,Progress:minInt(70,int(math.Round(vocab*100))),Target:70,RewardCosmetic:"wordsmith-pin"},
		{ID:"tower-entry",Title:"Tower Entry",Description:"Complete your first IELTS Tower floor.",Icon:"▤",Unlocked:len(history)>0,Progress:minInt(len(history),1),Target:1,RewardCosmetic:"ielts-aura"},
		{ID:"boss-breaker",Title:"Boss Breaker",Description:"Clear the Missed Flight boss.",Icon:"☠",Unlocked:airportDone,Progress:boolInt(airportDone),Target:1,RewardCosmetic:"airport-wings"},
	}

	cosmetics := []model.Cosmetic{
		{ID:"rookie-title",Name:"Adventurer",Slot:"title",Description:"The title every learner starts with.",Unlocked:true},
		{ID:"traveler-badge",Name:"World Walker",Slot:"badge",Description:"A passport-style badge for opening three worlds.",Unlocked:unlockedWorlds>=3},
		{ID:"wordsmith-pin",Name:"Wordsmith Pin",Slot:"badge",Description:"Unlocked by reaching 70% Vocabulary confidence.",Unlocked:vocab>=.70},
		{ID:"arena-frame",Name:"Arena Frame",Slot:"frame",Description:"A competitive profile frame unlocked with the Battle Arena.",Unlocked:arena},
		{ID:"ielts-aura",Name:"Tower Aura",Slot:"aura",Description:"Unlocked after your first IELTS Tower floor.",Unlocked:len(history)>0},
		{ID:"airport-wings",Name:"Airport Wings",Slot:"badge",Description:"Boss trophy for successfully clearing Missed Flight.",Unlocked:airportDone},
	}
	for i := range cosmetics { if loadout[cosmetics[i].Slot] == cosmetics[i].ID { cosmetics[i].Equipped = true } }
	level, into, next := levelFromXP(u.XP)
	return model.ProgressionState{Level:level,XP:u.XP,XPIntoLevel:into,XPForNext:next,Worlds:worlds,Bosses:[]model.BossState{boss},Achievements:achievements,Inventory:cosmetics},nil
}

func (s *Store) CompleteBoss(ctx context.Context,userID,bossID string,score int)(model.ProgressionState,error){
	if bossID!="airport-crisis"{return model.ProgressionState{},ErrNotFound}
	state,err:=s.GetProgression(ctx,userID);if err!=nil{return state,err};boss:=state.Bosses[0];if boss.Cleared{return state,nil};if !boss.Unlocked{return state,errors.New("boss gate is still locked: create evidence in Vocabulary, Listening and Speaking first")}
	if s.db!=nil{
		var turns int;if err=s.db.QueryRowContext(ctx,`SELECT COUNT(*) FROM attempts WHERE user_id=$1 AND activity='npc-conversation'`,userID).Scan(&turns);err!=nil{return state,err};if turns<3{return state,fmt.Errorf("boss conversation is not complete yet: %d/3 turns",turns)}
		tx,err:=s.db.BeginTx(ctx,nil);if err!=nil{return state,err};defer tx.Rollback();if score<0{score=0};if score>100{score=100};res,err:=tx.ExecContext(ctx,`INSERT INTO player_bosses(user_id,boss_id,score,reward_xp,completed_at) VALUES($1,$2,$3,150,NOW()) ON CONFLICT(user_id,boss_id) DO NOTHING`,userID,bossID,score);if err!=nil{return state,err};n,_:=res.RowsAffected();if n>0{if _,err=tx.ExecContext(ctx,`UPDATE users SET xp=xp+150 WHERE id=$1`,userID);err!=nil{return state,err}};if err=tx.Commit();err!=nil{return state,err};return s.GetProgression(ctx,userID)
	}
	mem:=s.progressionMemory();mem.mu.Lock();if mem.bosses[userID]==nil{mem.bosses[userID]=map[string]time.Time{}};if _,exists:=mem.bosses[userID][bossID];!exists{mem.bosses[userID][bossID]=time.Now().UTC();s.mu.Lock();acc:=s.mem.users[userID];acc.user.XP+=150;s.mem.users[userID]=acc;s.mu.Unlock()};mem.mu.Unlock();return s.GetProgression(ctx,userID)
}

func (s *Store) EquipCosmetic(ctx context.Context,userID,cosmeticID string)(model.ProgressionState,error){
	state,err:=s.GetProgression(ctx,userID);if err!=nil{return state,err};var chosen *model.Cosmetic;for i:=range state.Inventory{if state.Inventory[i].ID==cosmeticID{chosen=&state.Inventory[i];break}};if chosen==nil{return state,ErrNotFound};if !chosen.Unlocked{return state,errors.New("cosmetic is still locked")}
	if s.db!=nil{_,err=s.db.ExecContext(ctx,`INSERT INTO player_loadout(user_id,slot,cosmetic_id,updated_at) VALUES($1,$2,$3,NOW()) ON CONFLICT(user_id,slot) DO UPDATE SET cosmetic_id=EXCLUDED.cosmetic_id,updated_at=NOW()`,userID,chosen.Slot,chosen.ID);if err!=nil{return state,err};return s.GetProgression(ctx,userID)}
	mem:=s.progressionMemory();mem.mu.Lock();if mem.loadout[userID]==nil{mem.loadout[userID]=map[string]string{}};mem.loadout[userID][chosen.Slot]=chosen.ID;mem.mu.Unlock();return s.GetProgression(ctx,userID)
}

func (s *Store) bossCompletions(ctx context.Context,userID string)(map[string]*time.Time,error){
	out:=map[string]*time.Time{};if s.db!=nil{rows,err:=s.db.QueryContext(ctx,`SELECT boss_id,completed_at FROM player_bosses WHERE user_id=$1`,userID);if err!=nil{return out,err};defer rows.Close();for rows.Next(){var id string;var at time.Time;if err:=rows.Scan(&id,&at);err!=nil{return out,err};copy:=at;out[id]=&copy};return out,rows.Err()}
	mem:=s.progressionMemory();mem.mu.RLock();defer mem.mu.RUnlock();for id,at:=range mem.bosses[userID]{copy:=at;out[id]=&copy};return out,nil
}

func (s *Store) playerLoadout(ctx context.Context,userID string)(map[string]string,error){
	out:=map[string]string{};if s.db!=nil{rows,err:=s.db.QueryContext(ctx,`SELECT slot,cosmetic_id FROM player_loadout WHERE user_id=$1`,userID);if err!=nil{return out,err};defer rows.Close();for rows.Next(){var slot,id string;if err:=rows.Scan(&slot,&id);err!=nil{return out,err};out[slot]=id};return out,rows.Err()}
	mem:=s.progressionMemory();mem.mu.RLock();defer mem.mu.RUnlock();for slot,id:=range mem.loadout[userID]{out[slot]=id};return out,nil
}

func (s *Store) hasSkillEvidence(ctx context.Context,userID,skill string)(bool,error){
	if s.db!=nil{query:=`SELECT EXISTS(SELECT 1 FROM attempts WHERE user_id=$1 AND LOWER(skill)=LOWER($2) AND accuracy>=0.5)`;if strings.EqualFold(skill,"Listening"){query=`SELECT EXISTS(SELECT 1 FROM attempts WHERE user_id=$1 AND LOWER(skill) IN ('listening','dictation') AND accuracy>=0.5)`};var ok bool;args:=[]any{userID,skill};if strings.EqualFold(skill,"Listening"){args=[]any{userID}};err:=s.db.QueryRowContext(ctx,query,args...).Scan(&ok);return ok,err}
	skills,err:=s.Skills(ctx,userID);if err!=nil{return false,err};for _,sk:=range skills{if strings.EqualFold(sk.Name,skill)&&math.Abs(sk.Confidence-initialConfidence(sk.Name))>.01{return true,nil};if strings.EqualFold(skill,"Listening")&&strings.EqualFold(sk.Name,"Dictation")&&math.Abs(sk.Confidence-initialConfidence(sk.Name))>.01{return true,nil}};return false,nil
}

func skillConfidence(skills []model.Skill,name string)float64{for _,sk:=range skills{if strings.EqualFold(sk.Name,name){return sk.Confidence}};return 0}
func avgPercent(values ...float64)int{if len(values)==0{return 0};sum:=0.0;for _,v:=range values{sum+=v};return minInt(100,int(math.Round(sum/float64(len(values))*100)))}
func levelFromXP(xp int)(level,into,next int){if xp<0{xp=0};level=1;remaining:=xp;need:=100;for remaining>=need{remaining-=need;level++;need=100+(level-1)*50;if level>=50{break}};return level,remaining,need}
func percent(current,target int)int{if target<=0{return 100};return minInt(100,int(math.Round(float64(current)*100/float64(target))))}
func minInt(a,b int)int{if a<b{return a};return b}
func boolInt(v bool)int{if v{return 1};return 0}

const progressionSchemaSQL=`
CREATE TABLE IF NOT EXISTS player_bosses(user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,boss_id TEXT NOT NULL,score INTEGER NOT NULL DEFAULT 0,reward_xp INTEGER NOT NULL DEFAULT 0,completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),PRIMARY KEY(user_id,boss_id));
CREATE TABLE IF NOT EXISTS player_loadout(user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,slot TEXT NOT NULL,cosmetic_id TEXT NOT NULL,updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),PRIMARY KEY(user_id,slot));`
