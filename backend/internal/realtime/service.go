package realtime

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/model"
)

type Service struct {
	client *redis.Client
	mu sync.RWMutex
	presence map[string]model.Presence
	challenges map[string]model.Challenge
}

func New(redisURL string) *Service {
	s:=&Service{presence:map[string]model.Presence{},challenges:map[string]model.Challenge{}}
	if strings.TrimSpace(redisURL)=="" { return s }
	opt,err:=redis.ParseURL(redisURL);if err!=nil{return s};client:=redis.NewClient(opt);ctx,cancel:=context.WithTimeout(context.Background(),2*time.Second);defer cancel();if client.Ping(ctx).Err()!=nil{_ = client.Close();return s};s.client=client;return s
}
func (s *Service) Close(){if s.client!=nil{_ = s.client.Close()}}
func (s *Service) Mode()string{if s.client!=nil{return "redis"};return "memory"}

func (s *Service) Touch(ctx context.Context,userID,name string)error{p:=model.Presence{UserID:userID,DisplayName:name,SeenAt:time.Now().UTC()};if s.client!=nil{raw,_:=json.Marshal(p);return s.client.Set(ctx,"loccao:presence:"+userID,raw,50*time.Second).Err()};s.mu.Lock();defer s.mu.Unlock();s.presence[userID]=p;return nil}
func (s *Service) Online(ctx context.Context)([]model.Presence,error){if s.client!=nil{var cursor uint64;out:=[]model.Presence{};for{keys,next,err:=s.client.Scan(ctx,cursor,"loccao:presence:*",100).Result();if err!=nil{return nil,err};for _,key:=range keys{raw,err:=s.client.Get(ctx,key).Bytes();if err==nil{var p model.Presence;if json.Unmarshal(raw,&p)==nil{out=append(out,p)}}};cursor=next;if cursor==0{break}};sort.Slice(out,func(i,j int)bool{return out[i].DisplayName<out[j].DisplayName});return out,nil};s.mu.Lock();defer s.mu.Unlock();cutoff:=time.Now().Add(-50*time.Second);out:=[]model.Presence{};for id,p:=range s.presence{if p.SeenAt.Before(cutoff){delete(s.presence,id);continue};out=append(out,p)};sort.Slice(out,func(i,j int)bool{return out[i].DisplayName<out[j].DisplayName});return out,nil}

func (s *Service) CreateChallenge(ctx context.Context,creatorID,creatorName,title,skill,activity string)(model.Challenge,error){if strings.TrimSpace(title)==""{title="Word Link Sprint"};if skill==""{skill="Vocabulary"};if activity==""{activity="word-link"};now:=time.Now().UTC();ch:=model.Challenge{ID:newID(),Title:title,Skill:skill,Activity:activity,CreatorID:creatorID,CreatorName:creatorName,Status:"open",Entries:[]model.ChallengeEntry{},CreatedAt:now,ExpiresAt:now.Add(2*time.Hour)};if s.client!=nil{raw,_:=json.Marshal(ch);pipe:=s.client.TxPipeline();pipe.Set(ctx,"loccao:challenge:"+ch.ID,raw,2*time.Hour);pipe.ZAdd(ctx,"loccao:challenges",redis.Z{Score:float64(now.Unix()),Member:ch.ID});pipe.Expire(ctx,"loccao:challenges",24*time.Hour);_,err:=pipe.Exec(ctx);return ch,err};s.mu.Lock();defer s.mu.Unlock();s.challenges[ch.ID]=ch;return ch,nil}
func (s *Service) ListChallenges(ctx context.Context,limit int)([]model.Challenge,error){if limit<=0||limit>50{limit=20};if s.client!=nil{ids,err:=s.client.ZRevRange(ctx,"loccao:challenges",0,int64(limit*2)).Result();if err!=nil{return nil,err};out:=[]model.Challenge{};for _,id:=range ids{raw,err:=s.client.Get(ctx,"loccao:challenge:"+id).Bytes();if err!=nil{continue};var ch model.Challenge;if json.Unmarshal(raw,&ch)==nil&&ch.ExpiresAt.After(time.Now()){out=append(out,ch);if len(out)>=limit{break}}};return out,nil};s.mu.Lock();defer s.mu.Unlock();now:=time.Now();out:=[]model.Challenge{};for id,ch:=range s.challenges{if ch.ExpiresAt.Before(now){delete(s.challenges,id);continue};out=append(out,ch)};sort.Slice(out,func(i,j int)bool{return out[i].CreatedAt.After(out[j].CreatedAt)});if len(out)>limit{out=out[:limit]};return out,nil}
func (s *Service) Submit(ctx context.Context,id,userID,name string,score int)(model.Challenge,error){if score<0{score=0};if score>100000{score=100000};if s.client!=nil{key:="loccao:challenge:"+id;var result model.Challenge;err:=s.client.Watch(ctx,func(tx *redis.Tx)error{raw,err:=tx.Get(ctx,key).Bytes();if errors.Is(err,redis.Nil){return errors.New("challenge not found")};if err!=nil{return err};var ch model.Challenge;if err:=json.Unmarshal(raw,&ch);err!=nil{return err};if ch.Status=="completed"{result=ch;return nil};updated:=false;for i:=range ch.Entries{if ch.Entries[i].UserID==userID{if score>ch.Entries[i].Score{ch.Entries[i].Score=score;ch.Entries[i].SubmittedAt=time.Now().UTC()};updated=true}};if !updated{ch.Entries=append(ch.Entries,model.ChallengeEntry{UserID:userID,DisplayName:name,Score:score,SubmittedAt:time.Now().UTC()})};if len(ch.Entries)>=2{ch.Status="completed";winner:=ch.Entries[0];for _,entry:=range ch.Entries[1:]{if entry.Score>winner.Score{winner=entry}};ch.WinnerID=winner.UserID};payload,_:=json.Marshal(ch);_,err=tx.TxPipelined(ctx,func(pipe redis.Pipeliner)error{pipe.Set(ctx,key,payload,time.Until(ch.ExpiresAt));return nil});result=ch;return err},key);return result,err};s.mu.Lock();defer s.mu.Unlock();ch,ok:=s.challenges[id];if !ok{return model.Challenge{},errors.New("challenge not found")};if ch.Status=="completed"{return ch,nil};found:=false;for i:=range ch.Entries{if ch.Entries[i].UserID==userID{if score>ch.Entries[i].Score{ch.Entries[i].Score=score;ch.Entries[i].SubmittedAt=time.Now().UTC()};found=true}};if !found{ch.Entries=append(ch.Entries,model.ChallengeEntry{UserID:userID,DisplayName:name,Score:score,SubmittedAt:time.Now().UTC()})};if len(ch.Entries)>=2{ch.Status="completed";winner:=ch.Entries[0];for _,entry:=range ch.Entries[1:]{if entry.Score>winner.Score{winner=entry}};ch.WinnerID=winner.UserID};s.challenges[id]=ch;return ch,nil}
func newID()string{b:=make([]byte,12);_,_=rand.Read(b);return hex.EncodeToString(b)}
