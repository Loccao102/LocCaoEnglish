package store

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"time"
)

var dailyClaims sync.Map

func playerDayBounds() (string,time.Time,time.Time) {
	zone:=time.FixedZone("UTC+7",7*60*60); now:=time.Now().In(zone); y,m,d:=now.Date(); startLocal:=time.Date(y,m,d,0,0,0,0,zone); endLocal:=startLocal.Add(24*time.Hour); return startLocal.Format("2006-01-02"),startLocal.UTC(),endLocal.UTC()
}

func (s *Store) DailyEvidence(ctx context.Context,userID string)(map[string]bool,error){
	out:=map[string]bool{}; _,start,end:=playerDayBounds()
	if s.db!=nil { rows,err:=s.db.QueryContext(ctx,`SELECT LOWER(skill),LOWER(activity) FROM attempts WHERE user_id=$1 AND created_at >= $2 AND created_at < $3`,userID,start,end);if err!=nil{return out,err};defer rows.Close();for rows.Next(){var skill,activity string;if err:=rows.Scan(&skill,&activity);err!=nil{return out,err};out["skill:"+skill]=true;out["activity:"+activity]=true};return out,rows.Err() }
	skills,err:=s.Skills(ctx,userID);if err!=nil{return out,err};for _,sk:=range skills{if diff:=sk.Confidence-initialConfidence(sk.Name);diff>.01||diff<-.01{out["skill:"+strings.ToLower(sk.Name)]=true}};return out,nil
}

func (s *Store) DailyClaimed(ctx context.Context,userID,date string)(bool,error){
	if s.db!=nil { if _,err:=s.db.ExecContext(ctx,dailySchemaSQL);err!=nil{return false,err};var exists bool;err:=s.db.QueryRowContext(ctx,`SELECT EXISTS(SELECT 1 FROM daily_claims WHERE user_id=$1 AND day=$2::date)`,userID,date).Scan(&exists);return exists,err }
	_,ok:=dailyClaims.Load(userID+":"+date);return ok,nil
}

func (s *Store) ClaimDailyReward(ctx context.Context,userID,date string,reward int)(bool,error){
	if reward<=0{reward=50}
	if s.db!=nil { if _,err:=s.db.ExecContext(ctx,dailySchemaSQL);err!=nil{return false,err};tx,err:=s.db.BeginTx(ctx,nil);if err!=nil{return false,err};defer tx.Rollback();res,err:=tx.ExecContext(ctx,`INSERT INTO daily_claims(user_id,day,reward_xp,claimed_at) VALUES($1,$2::date,$3,NOW()) ON CONFLICT(user_id,day) DO NOTHING`,userID,date,reward);if err!=nil{return false,err};n,_:=res.RowsAffected();if n==0{return false,nil};if _,err=tx.ExecContext(ctx,`UPDATE users SET xp=xp+$2 WHERE id=$1`,userID,reward);err!=nil{return false,err};if err=tx.Commit();err!=nil{return false,err};return true,nil }
	key:=userID+":"+date;if _,loaded:=dailyClaims.LoadOrStore(key,true);loaded{return false,nil};s.mu.Lock();defer s.mu.Unlock();acc,ok:=s.mem.users[userID];if !ok{return false,ErrNotFound};acc.user.XP+=reward;s.mem.users[userID]=acc;return true,nil
}

func CurrentPlayerDay() string { day,_,_:=playerDayBounds();return day }

func DailyQuestComplete(evidence map[string]bool,skill,activity string)bool{
	if evidence["skill:"+strings.ToLower(strings.TrimSpace(skill))]{return true};if evidence["activity:"+strings.ToLower(strings.TrimSpace(activity))]{return true};return false
}

const dailySchemaSQL=`CREATE TABLE IF NOT EXISTS daily_claims(user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,day DATE NOT NULL,reward_xp INTEGER NOT NULL DEFAULT 50,claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),PRIMARY KEY(user_id,day));`

var _ = fmt.Sprintf
