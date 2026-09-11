package store

import (
	"context"
	"database/sql"
	"sort"
	"sync"
	"time"

	"github.com/Loccao102/LocCaoEnglish/backend/internal/model"
)

type ieltsMemory struct{mu sync.RWMutex;attempts map[string][]model.IELTSAttempt};var ieltsMemories sync.Map
func(s *Store)ieltsMemory()*ieltsMemory{if v,ok:=ieltsMemories.Load(s);ok{return v.(*ieltsMemory)};state:=&ieltsMemory{attempts:map[string][]model.IELTSAttempt{}};actual,_:=ieltsMemories.LoadOrStore(s,state);return actual.(*ieltsMemory)}
func(s *Store)EnsureIELTS(ctx context.Context)error{if s.db==nil{_=s.ieltsMemory();return nil};_,err:=s.db.ExecContext(ctx,ieltsSchemaSQL);return err}
func(s *Store)SaveIELTSAttempt(ctx context.Context,userID string,a model.IELTSAttempt)(model.IELTSAttempt,error){if a.ID==""{a.ID=newID()};a.CreatedAt=time.Now().UTC();if s.db!=nil{_,err:=s.db.ExecContext(ctx,`INSERT INTO ielts_attempts(id,user_id,section,test_type,raw_score,max_score,band,source,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,a.ID,userID,a.Section,a.TestType,a.RawScore,a.MaxScore,a.Band,a.Source,a.CreatedAt);return a,err};state:=s.ieltsMemory();state.mu.Lock();state.attempts[userID]=append(state.attempts[userID],a);state.mu.Unlock();return a,nil}
func(s *Store)IELTSHistory(ctx context.Context,userID string,limit int)([]model.IELTSAttempt,error){if limit<=0||limit>100{limit=30};if s.db!=nil{rows,err:=s.db.QueryContext(ctx,`SELECT id,section,test_type,raw_score,max_score,band,source,created_at FROM ielts_attempts WHERE user_id=$1 ORDER BY created_at DESC LIMIT $2`,userID,limit);if err!=nil{return nil,err};defer rows.Close();out:=[]model.IELTSAttempt{};for rows.Next(){var a model.IELTSAttempt;var raw,max sql.NullInt64;if err:=rows.Scan(&a.ID,&a.Section,&a.TestType,&raw,&max,&a.Band,&a.Source,&a.CreatedAt);err!=nil{return nil,err};if raw.Valid{v:=int(raw.Int64);a.RawScore=&v};if max.Valid{v:=int(max.Int64);a.MaxScore=&v};out=append(out,a)};return out,rows.Err()};state:=s.ieltsMemory();state.mu.RLock();items:=append([]model.IELTSAttempt(nil),state.attempts[userID]...);state.mu.RUnlock();sort.Slice(items,func(i,j int)bool{return items[i].CreatedAt.After(items[j].CreatedAt)});if len(items)>limit{items=items[:limit]};return items,nil}
const ieltsSchemaSQL=`CREATE TABLE IF NOT EXISTS ielts_attempts(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,section TEXT NOT NULL,test_type TEXT NOT NULL DEFAULT 'academic',raw_score INTEGER,max_score INTEGER,band DOUBLE PRECISION NOT NULL,source TEXT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());CREATE INDEX IF NOT EXISTS idx_ielts_attempts_user_created ON ielts_attempts(user_id,created_at DESC);`
