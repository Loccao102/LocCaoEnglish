package realtime

import (
	"context"
	"encoding/json"
	"sync"
	"time"
)

type eventHub struct { mu sync.RWMutex; subscribers map[chan string]struct{} }
var localEventHubs sync.Map

func (s *Service) hub() *eventHub { if value,ok:=localEventHubs.Load(s);ok{return value.(*eventHub)};hub:=&eventHub{subscribers:map[chan string]struct{}{}};actual,_:=localEventHubs.LoadOrStore(s,hub);return actual.(*eventHub) }

func (s *Service) Broadcast(ctx context.Context,eventType string,data any){payload,_:=json.Marshal(map[string]any{"type":eventType,"data":data,"at":time.Now().UTC()});message:=string(payload);if s.client!=nil{_ = s.client.Publish(ctx,"loccao:events",message).Err();return};hub:=s.hub();hub.mu.RLock();defer hub.mu.RUnlock();for ch:=range hub.subscribers{select{case ch<-message:default:}}}

func (s *Service) Subscribe(ctx context.Context)(<-chan string,func()){
	if s.client!=nil{pubsub:=s.client.Subscribe(ctx,"loccao:events");out:=make(chan string,32);done:=make(chan struct{});var once sync.Once;closeFn:=func(){once.Do(func(){close(done);_ = pubsub.Close()})};go func(){defer close(out);messages:=pubsub.Channel();for{select{case<-ctx.Done():closeFn();return;case<-done:return;case msg,ok:=<-messages:if!ok{return};select{case out<-msg.Payload:default:}}}}();return out,closeFn}
	hub:=s.hub();ch:=make(chan string,32);hub.mu.Lock();hub.subscribers[ch]=struct{}{};hub.mu.Unlock();var once sync.Once;closeFn:=func(){once.Do(func(){hub.mu.Lock();delete(hub.subscribers,ch);close(ch);hub.mu.Unlock()})};go func(){<-ctx.Done();closeFn()}();return ch,closeFn
}
