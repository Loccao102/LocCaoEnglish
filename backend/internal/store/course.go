package store

import (
	"context"
	"database/sql"
	"errors"
	"sort"
	"sync"
	"time"

	"github.com/Loccao102/LocCaoEnglish/backend/internal/model"
)

type courseMemory struct { mu sync.RWMutex; courses map[string]model.Course; enrolled map[string]map[string]bool }
var courseMemories sync.Map

func (s *Store) courseMemory() *courseMemory {
	if value, ok := courseMemories.Load(s); ok { return value.(*courseMemory) }
	now:=time.Now().UTC(); lessons:=seedLessons(); summaries:=make([]model.CourseLesson,0,len(lessons)); for i,l:=range lessons { summaries=append(summaries,model.CourseLesson{Slug:l.Slug,Title:l.Title,Skill:l.Skill,Level:l.Level,Position:i,EstimatedMins:l.EstimatedMins}) }
	state:=&courseMemory{courses:map[string]model.Course{"english-b1-foundations":{ID:newID(),Slug:"english-b1-foundations",Title:"English B1 Foundations",Description:"A practical route through travel, work communication and structured writing.",Level:"B1-B2",Status:"published",Lessons:summaries,CreatedAt:now,UpdatedAt:now}},enrolled:map[string]map[string]bool{}}
	actual,_:=courseMemories.LoadOrStore(s,state);return actual.(*courseMemory)
}

func (s *Store) EnsureCourses(ctx context.Context) error {
	if s.db==nil { _=s.courseMemory(); return nil }
	if _,err:=s.db.ExecContext(ctx,courseSchemaSQL);err!=nil{return err}
	var id string
	err:=s.db.QueryRowContext(ctx,`SELECT id FROM courses WHERE slug='english-b1-foundations'`).Scan(&id)
	if errors.Is(err,sql.ErrNoRows){id=newID();_,err=s.db.ExecContext(ctx,`INSERT INTO courses(id,slug,title,description,level,status,created_at,updated_at) VALUES($1,'english-b1-foundations','English B1 Foundations','A practical route through travel, work communication and structured writing.','B1-B2','published',NOW(),NOW())`,id)}
	if err!=nil{return err}
	slugs:=[]string{"airport-check-in-sprint","work-meeting-survival","ielts-opinion-architecture"};for i,slug:=range slugs{_,err=s.db.ExecContext(ctx,`INSERT INTO course_lessons(course_id,lesson_id,position) SELECT $1,id,$3 FROM lessons WHERE slug=$2 ON CONFLICT(course_id,lesson_id) DO UPDATE SET position=EXCLUDED.position`,id,slug,i);if err!=nil{return err}}
	return nil
}

func (s *Store) ListCourses(ctx context.Context)([]model.Course,error){
	if s.db!=nil{rows,err:=s.db.QueryContext(ctx,`SELECT slug FROM courses WHERE status='published' ORDER BY updated_at DESC`);if err!=nil{return nil,err};defer rows.Close();var slugs []string;for rows.Next(){var slug string;if err:=rows.Scan(&slug);err!=nil{return nil,err};slugs=append(slugs,slug)};out:=make([]model.Course,0,len(slugs));for _,slug:=range slugs{c,err:=s.GetCourse(ctx,slug);if err!=nil{return nil,err};out=append(out,c)};return out,rows.Err()}
	state:=s.courseMemory();state.mu.RLock();defer state.mu.RUnlock();out:=make([]model.Course,0,len(state.courses));for _,c:=range state.courses{if c.Status=="published"{out=append(out,c)}};sort.Slice(out,func(i,j int)bool{return out[i].UpdatedAt.After(out[j].UpdatedAt)});return out,nil
}

func (s *Store) GetCourse(ctx context.Context,slug string)(model.Course,error){
	if s.db!=nil{var c model.Course;err:=s.db.QueryRowContext(ctx,`SELECT id,slug,title,description,level,status,created_at,updated_at FROM courses WHERE slug=$1 AND status='published'`,slug).Scan(&c.ID,&c.Slug,&c.Title,&c.Description,&c.Level,&c.Status,&c.CreatedAt,&c.UpdatedAt);if errors.Is(err,sql.ErrNoRows){return c,ErrNotFound};if err!=nil{return c,err};rows,err:=s.db.QueryContext(ctx,`SELECT l.slug,l.title,l.skill,l.level,cl.position,l.estimated_mins FROM course_lessons cl JOIN lessons l ON l.id=cl.lesson_id WHERE cl.course_id=$1 AND l.status='published' ORDER BY cl.position`,c.ID);if err!=nil{return c,err};defer rows.Close();for rows.Next(){var item model.CourseLesson;if err:=rows.Scan(&item.Slug,&item.Title,&item.Skill,&item.Level,&item.Position,&item.EstimatedMins);err!=nil{return c,err};c.Lessons=append(c.Lessons,item)};return c,rows.Err()}
	state:=s.courseMemory();state.mu.RLock();defer state.mu.RUnlock();c,ok:=state.courses[slug];if!ok||c.Status!="published"{return model.Course{},ErrNotFound};return c,nil
}

func (s *Store) EnrollCourse(ctx context.Context,userID,slug string)(model.CourseProgress,error){
	c,err:=s.GetCourse(ctx,slug);if err!=nil{return model.CourseProgress{},err}
	if s.db!=nil{_,err=s.db.ExecContext(ctx,`INSERT INTO course_enrollments(user_id,course_id,enrolled_at,updated_at) VALUES($1,$2,NOW(),NOW()) ON CONFLICT(user_id,course_id) DO UPDATE SET updated_at=NOW()`,userID,c.ID);if err!=nil{return model.CourseProgress{},err};return s.CourseProgress(ctx,userID,slug)}
	state:=s.courseMemory();state.mu.Lock();if state.enrolled[userID]==nil{state.enrolled[userID]=map[string]bool{}};state.enrolled[userID][c.ID]=true;state.mu.Unlock();return s.CourseProgress(ctx,userID,slug)
}

func (s *Store) CourseProgress(ctx context.Context,userID,slug string)(model.CourseProgress,error){
	c,err:=s.GetCourse(ctx,slug);if err!=nil{return model.CourseProgress{},err};p:=model.CourseProgress{CourseID:c.ID,CourseSlug:c.Slug,TotalLessons:len(c.Lessons)}
	if s.db!=nil{_ = s.db.QueryRowContext(ctx,`SELECT EXISTS(SELECT 1 FROM course_enrollments WHERE user_id=$1 AND course_id=$2)`,userID,c.ID).Scan(&p.Enrolled);var avg sql.NullFloat64;err=s.db.QueryRowContext(ctx,`SELECT COUNT(*) FILTER(WHERE lp.total_exercises>0 AND lp.completed_exercises>=lp.total_exercises),AVG(lp.last_score) FILTER(WHERE lp.completed_exercises>0) FROM course_lessons cl LEFT JOIN lesson_progress lp ON lp.lesson_id=cl.lesson_id AND lp.user_id=$2 WHERE cl.course_id=$1`,c.ID,userID).Scan(&p.CompletedLessons,&avg);if err!=nil{return p,err};if avg.Valid{p.AverageScore=avg.Float64};if p.TotalLessons>0{p.Percent=p.CompletedLessons*100/p.TotalLessons};return p,nil}
	state:=s.courseMemory();state.mu.RLock();p.Enrolled=state.enrolled[userID][c.ID];state.mu.RUnlock();content:=s.contentMemory();content.mu.RLock();progress:=content.progress[userID];for _,lesson:=range c.Lessons{for lessonID,item:=range progress{_ = lessonID;if item.TotalExercises>0&&item.CompletedExercises>=item.TotalExercises{if source,ok:=content.lessons[lesson.Slug];ok&&source.ID==item.LessonID{p.CompletedLessons++;p.AverageScore+=item.LastScore}}}};content.mu.RUnlock();if p.CompletedLessons>0{p.AverageScore/=float64(p.CompletedLessons)};if p.TotalLessons>0{p.Percent=p.CompletedLessons*100/p.TotalLessons};return p,nil
}

const courseSchemaSQL=`
CREATE TABLE IF NOT EXISTS courses(id TEXT PRIMARY KEY,slug TEXT UNIQUE NOT NULL,title TEXT NOT NULL,description TEXT NOT NULL DEFAULT '',level TEXT NOT NULL DEFAULT 'B1',status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published')),created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS course_lessons(course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,lesson_id TEXT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,position INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(course_id,lesson_id));
CREATE TABLE IF NOT EXISTS course_enrollments(user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),PRIMARY KEY(user_id,course_id));
`
