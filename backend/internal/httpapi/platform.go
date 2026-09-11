package httpapi

import (
	"errors"
	"net/http"

	"github.com/Loccao102/LocCaoEnglish/backend/internal/store"
)

func (s *Server) registerPlatformRoutes(mux *http.ServeMux){
	mux.HandleFunc("GET /v1/courses",s.courses)
	mux.HandleFunc("GET /v1/courses/{slug}",s.course)
	mux.HandleFunc("POST /v1/courses/{slug}/enroll",s.enrollCourse)
	mux.HandleFunc("GET /v1/courses/{slug}/progress",s.courseProgress)
	mux.HandleFunc("GET /v1/admin/analytics",s.adminAnalytics)
}
func(s *Server)courses(w http.ResponseWriter,r *http.Request){items,err:=s.store.ListCourses(r.Context());if err!=nil{problem(w,500,err.Error());return};write(w,200,map[string]any{"items":items})}
func(s *Server)course(w http.ResponseWriter,r *http.Request){item,err:=s.store.GetCourse(r.Context(),r.PathValue("slug"));if errors.Is(err,store.ErrNotFound){problem(w,404,"course not found");return};if err!=nil{problem(w,500,err.Error());return};write(w,200,item)}
func(s *Server)enrollCourse(w http.ResponseWriter,r *http.Request){id,ok:=s.userID(w,r);if!ok{return};p,err:=s.store.EnrollCourse(r.Context(),id,r.PathValue("slug"));if errors.Is(err,store.ErrNotFound){problem(w,404,"course not found");return};if err!=nil{problem(w,500,err.Error());return};write(w,200,p)}
func(s *Server)courseProgress(w http.ResponseWriter,r *http.Request){id,ok:=s.userID(w,r);if!ok{return};p,err:=s.store.CourseProgress(r.Context(),id,r.PathValue("slug"));if errors.Is(err,store.ErrNotFound){problem(w,404,"course not found");return};if err!=nil{problem(w,500,err.Error());return};write(w,200,p)}
func(s *Server)adminAnalytics(w http.ResponseWriter,r *http.Request){if _,ok:=s.requireRole(w,r,"teacher","admin");!ok{return};data,err:=s.store.Analytics(r.Context());if err!=nil{problem(w,500,err.Error());return};write(w,200,data)}
