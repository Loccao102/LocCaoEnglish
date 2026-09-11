package store

import (
	"context"
	"database/sql"
	"sort"

	"github.com/Loccao102/LocCaoEnglish/backend/internal/model"
)

func (s *Store) Analytics(ctx context.Context)(model.AnalyticsSnapshot,error){
	var out model.AnalyticsSnapshot
	if s.db!=nil{
		if err:=s.db.QueryRowContext(ctx,`SELECT COUNT(*) FROM users WHERE email<>'demo@loccao.local'`).Scan(&out.Learners);err!=nil{return out,err}
		if err:=s.db.QueryRowContext(ctx,`SELECT COUNT(*),COUNT(DISTINCT user_id),COALESCE(AVG(accuracy),0) FROM attempts WHERE created_at>=NOW()-INTERVAL '7 days'`).Scan(&out.Attempts7d,&out.Active7d,&out.AverageAccuracy);err!=nil{return out,err}
		_ = s.db.QueryRowContext(ctx,`SELECT COUNT(*) FROM lesson_progress WHERE total_exercises>0 AND completed_exercises>=total_exercises`).Scan(&out.CompletedLessons)
		rows,err:=s.db.QueryContext(ctx,`SELECT us.skill,AVG(us.confidence),COUNT(*) FROM user_skills us JOIN users u ON u.id=us.user_id WHERE u.email<>'demo@loccao.local' GROUP BY us.skill ORDER BY AVG(us.confidence) ASC`);if err!=nil{return out,err};for rows.Next(){var item model.SkillAnalytics;if err:=rows.Scan(&item.Skill,&item.AverageConfidence,&item.Learners);err!=nil{rows.Close();return out,err};out.Skills=append(out.Skills,item)};if err:=rows.Close();err!=nil{return out,err}
		lessonRows,err:=s.db.QueryContext(ctx,`SELECT l.slug,l.title,COUNT(lp.user_id) FILTER(WHERE lp.completed_exercises>0),COUNT(lp.user_id) FILTER(WHERE lp.total_exercises>0 AND lp.completed_exercises>=lp.total_exercises),COALESCE(AVG(lp.last_score) FILTER(WHERE lp.completed_exercises>0),0) FROM lessons l LEFT JOIN lesson_progress lp ON lp.lesson_id=l.id WHERE l.status='published' GROUP BY l.id,l.slug,l.title ORDER BY l.updated_at DESC`);if err!=nil{return out,err};defer lessonRows.Close();for lessonRows.Next(){var item model.LessonAnalytics;if err:=lessonRows.Scan(&item.Slug,&item.Title,&item.Started,&item.Completed,&item.AverageScore);err!=nil{return out,err};out.Lessons=append(out.Lessons,item)};return out,lessonRows.Err()
	}
	s.mu.RLock();out.Learners=maxInt(0,len(s.mem.users)-1);sums:=map[string]float64{};counts:=map[string]int{};for userID,skills:=range s.mem.skills{if userID==s.demoID{continue};for name,skill:=range skills{sums[name]+=skill.Confidence;counts[name]++}};s.mu.RUnlock();for name,sum:=range sums{out.Skills=append(out.Skills,model.SkillAnalytics{Skill:name,AverageConfidence:sum/float64(counts[name]),Learners:counts[name]})};sort.Slice(out.Skills,func(i,j int)bool{return out.Skills[i].AverageConfidence<out.Skills[j].AverageConfidence});content:=s.contentMemory();content.mu.RLock();for _,lesson:=range content.lessons{if lesson.Status=="published"{out.Lessons=append(out.Lessons,model.LessonAnalytics{Slug:lesson.Slug,Title:lesson.Title})}};content.mu.RUnlock();return out,nil
}

var _ sql.NullFloat64
