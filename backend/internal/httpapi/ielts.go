package httpapi

import(
	"net/http"
	"strings"

	ieltscore "github.com/Loccao102/LocCaoEnglish/backend/internal/ielts"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/model"
)

func(s *Server)registerIELTSRoutes(mux *http.ServeMux){mux.HandleFunc("POST /v1/ielts/objective-score",s.ieltsObjectiveScore);mux.HandleFunc("POST /v1/ielts/band",s.ieltsBand);mux.HandleFunc("POST /v1/ielts/overall",s.ieltsOverall);mux.HandleFunc("GET /v1/ielts/history",s.ieltsHistory)}
func(s *Server)ieltsObjectiveScore(w http.ResponseWriter,r *http.Request){id,ok:=s.userID(w,r);if!ok{return};var in struct{Section string `json:"section"`;TestType string `json:"testType"`;Correct int `json:"correct"`;Total int `json:"total"`};if!decode(w,r,&in){return};result,err:=ieltscore.Objective(in.Section,in.TestType,in.Correct,in.Total);if err!=nil{problem(w,400,err.Error());return};raw,max:=result.RawScore,result.MaxScore;attempt,err:=s.store.SaveIELTSAttempt(r.Context(),id,model.IELTSAttempt{Section:result.Section,TestType:result.TestType,RawScore:&raw,MaxScore:&max,Band:result.Band,Source:"objective-practice-estimate"});if err!=nil{problem(w,500,err.Error());return};write(w,200,map[string]any{"result":result,"attempt":attempt})}
func(s *Server)ieltsBand(w http.ResponseWriter,r *http.Request){id,ok:=s.userID(w,r);if!ok{return};var in struct{Section string `json:"section"`;TestType string `json:"testType"`;Band float64 `json:"band"`;Source string `json:"source"`};if!decode(w,r,&in){return};section:=strings.ToLower(strings.TrimSpace(in.Section));if section!="writing"&&section!="speaking"{problem(w,400,"section must be writing or speaking");return};if in.Band<0||in.Band>9{problem(w,400,"band must be between 0 and 9");return};if in.TestType==""{in.TestType="academic"};if in.Source==""{in.Source="practice-coach"};attempt,err:=s.store.SaveIELTSAttempt(r.Context(),id,model.IELTSAttempt{Section:section,TestType:in.TestType,Band:ieltscore.RoundOverall(in.Band),Source:in.Source});if err!=nil{problem(w,500,err.Error());return};write(w,200,attempt)}
func(s *Server)ieltsOverall(w http.ResponseWriter,r *http.Request){var in model.IELTSOverallInput;if!decode(w,r,&in){return};band,err:=ieltscore.Overall(in.Listening,in.Reading,in.Writing,in.Speaking);if err!=nil{problem(w,400,err.Error());return};write(w,200,map[string]any{"overall":band,"average":(in.Listening+in.Reading+in.Writing+in.Speaking)/4,"method":"IELTS overall-band half-step rounding"})}
func(s *Server)ieltsHistory(w http.ResponseWriter,r *http.Request){id,ok:=s.userID(w,r);if!ok{return};items,err:=s.store.IELTSHistory(r.Context(),id,30);if err!=nil{problem(w,500,err.Error());return};write(w,200,map[string]any{"items":items})}
