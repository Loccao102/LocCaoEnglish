package httpapi

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/Loccao102/LocCaoEnglish/backend/internal/ai"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/auth"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/engine"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/model"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/store"
)

type Server struct{ store *store.Store; auth *auth.Service; ai *ai.Client }

func New(st *store.Store,a *auth.Service,aiClient *ai.Client)*Server{return &Server{store:st,auth:a,ai:aiClient}}

func (s *Server) Handler()http.Handler{
	mux:=http.NewServeMux()
	mux.HandleFunc("GET /health",s.health)
	mux.HandleFunc("POST /v1/auth/register",s.register)
	mux.HandleFunc("POST /v1/auth/login",s.login)
	mux.HandleFunc("GET /v1/dashboard",s.dashboard)
	mux.HandleFunc("GET /v1/skills",s.skills)
	mux.HandleFunc("GET /v1/plan/today",s.plan)
	mux.HandleFunc("POST /v1/attempts",s.attempt)
	mux.HandleFunc("GET /v1/review",s.reviewQueue)
	mux.HandleFunc("POST /v1/review/{itemKey}",s.reviewGrade)
	mux.HandleFunc("POST /v1/ai/writing-score",s.aiProxy("/v1/writing/score"))
	mux.HandleFunc("POST /v1/ai/speaking-feedback",s.aiProxy("/v1/speaking/feedback"))
	mux.HandleFunc("POST /v1/ai/exercises",s.aiProxy("/v1/exercises/generate"))
	mux.HandleFunc("POST /v1/conversation/reply",s.aiProxy("/v1/conversation/reply"))
	mux.HandleFunc("GET /v1/missions/airport",s.airportMission)
	return s.cors(mux)
}

func (s *Server) health(w http.ResponseWriter,r *http.Request){write(w,http.StatusOK,map[string]any{"status":"ok","store":s.store.Mode(),"time":time.Now().UTC()})}

func (s *Server) register(w http.ResponseWriter,r *http.Request){var in struct{Email,Password,DisplayName string};if !decode(w,r,&in){return};hash,err:=auth.HashPassword(in.Password);if err!=nil{problem(w,http.StatusBadRequest,err.Error());return};u,err:=s.store.CreateUser(r.Context(),in.Email,hash,in.DisplayName);if errors.Is(err,store.ErrEmailExists){problem(w,http.StatusConflict,err.Error());return};if err!=nil{problem(w,http.StatusInternalServerError,err.Error());return};token,_:=s.auth.Issue(u.ID);write(w,http.StatusCreated,map[string]any{"user":u,"token":token})}
func (s *Server) login(w http.ResponseWriter,r *http.Request){var in struct{Email,Password string};if !decode(w,r,&in){return};u,hash,err:=s.store.FindUserByEmail(r.Context(),in.Email);if err!=nil||hash==""||!auth.VerifyPassword(hash,in.Password){problem(w,http.StatusUnauthorized,"invalid email or password");return};token,_:=s.auth.Issue(u.ID);write(w,http.StatusOK,map[string]any{"user":u,"token":token})}
func (s *Server) dashboard(w http.ResponseWriter,r *http.Request){id,ok:=s.userID(w,r);if !ok{return};d,err:=s.store.Dashboard(r.Context(),id);if err!=nil{problem(w,500,err.Error());return};write(w,200,d)}
func (s *Server) skills(w http.ResponseWriter,r *http.Request){id,ok:=s.userID(w,r);if !ok{return};items,err:=s.store.Skills(r.Context(),id);if err!=nil{problem(w,500,err.Error());return};write(w,200,map[string]any{"skills":items})}
func (s *Server) plan(w http.ResponseWriter,r *http.Request){id,ok:=s.userID(w,r);if !ok{return};skills,err:=s.store.Skills(r.Context(),id);if err!=nil{problem(w,500,err.Error());return};reviews,_:=s.store.ReviewQueue(r.Context(),id,20);write(w,200,engine.BuildPlan(skills,reviews))}
func (s *Server) attempt(w http.ResponseWriter,r *http.Request){id,ok:=s.userID(w,r);if !ok{return};var in model.AttemptInput;if !decode(w,r,&in){return};if strings.TrimSpace(in.Skill)==""||strings.TrimSpace(in.ItemKey)==""{problem(w,400,"skill and itemKey are required");return};res,err:=s.store.RecordAttempt(r.Context(),id,in);if err!=nil{problem(w,500,err.Error());return};write(w,201,res)}
func (s *Server) reviewQueue(w http.ResponseWriter,r *http.Request){id,ok:=s.userID(w,r);if !ok{return};limit,_:=strconv.Atoi(r.URL.Query().Get("limit"));items,err:=s.store.ReviewQueue(r.Context(),id,limit);if err!=nil{problem(w,500,err.Error());return};write(w,200,map[string]any{"items":items})}
func (s *Server) reviewGrade(w http.ResponseWriter,r *http.Request){id,ok:=s.userID(w,r);if !ok{return};var in struct{Quality int `json:"quality"`};if !decode(w,r,&in){return};if err:=s.store.GradeReview(r.Context(),id,r.PathValue("itemKey"),in.Quality);errors.Is(err,store.ErrNotFound){problem(w,404,"review item not found");return}else if err!=nil{problem(w,500,err.Error());return};write(w,200,map[string]any{"ok":true})}

func (s *Server) aiProxy(path string)http.HandlerFunc{return func(w http.ResponseWriter,r *http.Request){if _,ok:=s.userID(w,r);!ok{return};var input map[string]any;if !decode(w,r,&input){return};var output map[string]any;if err:=s.ai.Post(r.Context(),path,input,&output);err!=nil{problem(w,http.StatusServiceUnavailable,"AI service is offline; the client can continue with local fallback scoring.");return};write(w,200,output)}}

func (s *Server) airportMission(w http.ResponseWriter,r *http.Request){write(w,200,map[string]any{"id":"airport-boss","title":"Airport Boss: Missed Flight","goal":"Rebook your flight by completing four English challenges.","stages":[]map[string]any{{"id":"word-link","title":"Check-in vocabulary","type":"vocabulary","route":"/games/word-link"},{"id":"dictation","title":"Understand the announcement","type":"listening","route":"/dictation"},{"id":"speaking","title":"Explain the problem","type":"speaking","route":"/speaking"},{"id":"npc","title":"Rebook with the airline agent","type":"conversation","route":"/missions/airport"}}})}

func (s *Server) userID(w http.ResponseWriter,r *http.Request)(string,bool){header:=strings.TrimSpace(r.Header.Get("Authorization"));if header==""{return s.store.DemoID(),true};parts:=strings.SplitN(header," ",2);if len(parts)!=2||!strings.EqualFold(parts[0],"Bearer"){problem(w,401,"invalid authorization header");return "",false};id,err:=s.auth.Parse(parts[1]);if err!=nil{problem(w,401,"invalid or expired token");return "",false};return id,true}
func (s *Server) cors(next http.Handler)http.Handler{return http.HandlerFunc(func(w http.ResponseWriter,r *http.Request){w.Header().Set("Access-Control-Allow-Origin","*");w.Header().Set("Access-Control-Allow-Headers","Authorization, Content-Type");w.Header().Set("Access-Control-Allow-Methods","GET, POST, OPTIONS");if r.Method==http.MethodOptions{w.WriteHeader(http.StatusNoContent);return};next.ServeHTTP(w,r)})}
func decode(w http.ResponseWriter,r *http.Request,out any)bool{dec:=json.NewDecoder(http.MaxBytesReader(w,r.Body,1<<20));dec.DisallowUnknownFields();if err:=dec.Decode(out);err!=nil{problem(w,400,"invalid JSON: "+err.Error());return false};return true}
func write(w http.ResponseWriter,status int,value any){w.Header().Set("Content-Type","application/json");w.WriteHeader(status);_ = json.NewEncoder(w).Encode(value)}
func problem(w http.ResponseWriter,status int,message string){write(w,status,map[string]any{"error":message})}
