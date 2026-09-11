package store

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"regexp"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/Loccao102/LocCaoEnglish/backend/internal/model"
)

var slugPattern = regexp.MustCompile(`^[a-z0-9]+(?:-[a-z0-9]+)*$`)

type contentMemory struct {
	mu       sync.RWMutex
	lessons  map[string]model.Lesson
	progress map[string]map[string]model.LessonProgress
	roles    map[string]string
}

var contentMemories sync.Map

func (s *Store) contentMemory() *contentMemory {
	if value, ok := contentMemories.Load(s); ok { return value.(*contentMemory) }
	state := &contentMemory{lessons: map[string]model.Lesson{}, progress: map[string]map[string]model.LessonProgress{}, roles: map[string]string{}}
	for _, lesson := range seedLessons() { state.lessons[lesson.Slug] = cloneLesson(lesson) }
	actual, _ := contentMemories.LoadOrStore(s, state)
	return actual.(*contentMemory)
}

func (s *Store) EnsureContent(ctx context.Context) error {
	if s.db == nil { _ = s.contentMemory(); return nil }
	if err := s.ensureContentSchema(ctx); err != nil { return err }
	var count int
	if err := s.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM lessons`).Scan(&count); err != nil { return err }
	if count == 0 {
		for _, lesson := range seedLessons() {
			if _, err := s.SaveLesson(ctx, lesson, s.DemoID()); err != nil { return err }
		}
	}
	return nil
}

func (s *Store) ensureContentSchema(ctx context.Context) error {
	if s.db == nil { return nil }
	_, err := s.db.ExecContext(ctx, contentSchemaSQL)
	return err
}

func (s *Store) GetUser(ctx context.Context, userID string) (model.User, error) { return s.user(ctx, userID) }

func (s *Store) RoleForUser(ctx context.Context, userID string) (string, error) {
	u, err := s.user(ctx, userID); if err != nil { return "", err }
	bootstrap := configuredRole(u.Email)
	if s.db != nil {
		if err := s.ensureContentSchema(ctx); err != nil { return "", err }
		var role string
		err := s.db.QueryRowContext(ctx, `SELECT role FROM user_roles WHERE user_id=$1`, userID).Scan(&role)
		if errors.Is(err, sql.ErrNoRows) {
			role = bootstrap
			_, err = s.db.ExecContext(ctx, `INSERT INTO user_roles(user_id,role,updated_at) VALUES($1,$2,NOW()) ON CONFLICT(user_id) DO NOTHING`, userID, role)
		}
		if err != nil { return "", err }
		if bootstrap != "learner" && bootstrap != role {
			role = bootstrap
			_, _ = s.db.ExecContext(ctx, `UPDATE user_roles SET role=$2,updated_at=NOW() WHERE user_id=$1`, userID, role)
		}
		return role, nil
	}
	state := s.contentMemory(); state.mu.Lock(); defer state.mu.Unlock()
	if bootstrap != "learner" { state.roles[userID] = bootstrap; return bootstrap, nil }
	if role := state.roles[userID]; role != "" { return role, nil }
	state.roles[userID] = "learner"; return "learner", nil
}

func (s *Store) SetUserRole(ctx context.Context, userID, role string) error {
	if role != "learner" && role != "teacher" && role != "admin" { return errors.New("invalid role") }
	if _, err := s.user(ctx, userID); err != nil { return err }
	if s.db != nil {
		if err := s.ensureContentSchema(ctx); err != nil { return err }
		_, err := s.db.ExecContext(ctx, `INSERT INTO user_roles(user_id,role,updated_at) VALUES($1,$2,NOW()) ON CONFLICT(user_id) DO UPDATE SET role=EXCLUDED.role,updated_at=NOW()`, userID, role)
		return err
	}
	state := s.contentMemory(); state.mu.Lock(); defer state.mu.Unlock(); state.roles[userID] = role; return nil
}

func (s *Store) ListLessons(ctx context.Context, includeDraft bool) ([]model.Lesson, error) {
	if s.db != nil {
		if err := s.ensureContentSchema(ctx); err != nil { return nil, err }
		query := `SELECT slug FROM lessons`
		if !includeDraft { query += ` WHERE status='published'` }
		query += ` ORDER BY updated_at DESC`
		rows, err := s.db.QueryContext(ctx, query); if err != nil { return nil, err }; defer rows.Close()
		var slugs []string; for rows.Next() { var slug string; if err := rows.Scan(&slug); err != nil { return nil, err }; slugs = append(slugs, slug) }; if err := rows.Err(); err != nil { return nil, err }
		out := make([]model.Lesson, 0, len(slugs)); for _, slug := range slugs { lesson, err := s.GetLesson(ctx, slug, includeDraft); if err != nil { return nil, err }; out = append(out, lesson) }; return out, nil
	}
	state := s.contentMemory(); state.mu.RLock(); defer state.mu.RUnlock(); out := make([]model.Lesson, 0, len(state.lessons)); for _, lesson := range state.lessons { if includeDraft || lesson.Status == "published" { out = append(out, cloneLesson(lesson)) } }; sort.Slice(out, func(i,j int) bool { return out[i].UpdatedAt.After(out[j].UpdatedAt) }); return out,nil
}

func (s *Store) GetLesson(ctx context.Context, slug string, includeDraft bool) (model.Lesson, error) {
	slug = strings.TrimSpace(slug)
	if s.db != nil {
		if err := s.ensureContentSchema(ctx); err != nil { return model.Lesson{}, err }
		query := `SELECT id,slug,title,description,level,skill,topic,status,estimated_mins,created_at,updated_at FROM lessons WHERE slug=$1`
		if !includeDraft { query += ` AND status='published'` }
		var lesson model.Lesson
		err := s.db.QueryRowContext(ctx, query, slug).Scan(&lesson.ID,&lesson.Slug,&lesson.Title,&lesson.Description,&lesson.Level,&lesson.Skill,&lesson.Topic,&lesson.Status,&lesson.EstimatedMins,&lesson.CreatedAt,&lesson.UpdatedAt)
		if errors.Is(err, sql.ErrNoRows) { return model.Lesson{}, ErrNotFound }; if err != nil { return model.Lesson{}, err }
		rows, err := s.db.QueryContext(ctx, `SELECT id,kind,prompt,answer,options,explanation,position,xp FROM lesson_exercises WHERE lesson_id=$1 ORDER BY position ASC`, lesson.ID); if err != nil { return model.Lesson{}, err }; defer rows.Close()
		for rows.Next() { var ex model.LessonExercise; var raw []byte; if err := rows.Scan(&ex.ID,&ex.Kind,&ex.Prompt,&ex.Answer,&raw,&ex.Explanation,&ex.Position,&ex.XP); err != nil { return model.Lesson{}, err }; _ = json.Unmarshal(raw,&ex.Options); lesson.Exercises = append(lesson.Exercises,ex) }
		return lesson, rows.Err()
	}
	state := s.contentMemory(); state.mu.RLock(); defer state.mu.RUnlock(); lesson, ok := state.lessons[slug]; if !ok || (!includeDraft && lesson.Status != "published") { return model.Lesson{}, ErrNotFound }; return cloneLesson(lesson),nil
}

func (s *Store) SaveLesson(ctx context.Context, lesson model.Lesson, createdBy string) (model.Lesson, error) {
	lesson.Slug = normalizeSlug(lesson.Slug, lesson.Title); lesson.Title = strings.TrimSpace(lesson.Title); lesson.Description = strings.TrimSpace(lesson.Description); lesson.Skill = strings.TrimSpace(lesson.Skill); lesson.Topic = strings.TrimSpace(lesson.Topic); lesson.Level = strings.ToUpper(strings.TrimSpace(lesson.Level))
	if !slugPattern.MatchString(lesson.Slug) || lesson.Title == "" || lesson.Skill == "" { return model.Lesson{}, errors.New("valid slug, title and skill are required") }
	if lesson.Status != "draft" && lesson.Status != "published" { lesson.Status = "draft" }; if lesson.EstimatedMins <= 0 { lesson.EstimatedMins = maxInt(5, len(lesson.Exercises)*2) }
	for i := range lesson.Exercises { lesson.Exercises[i].Position = i; if lesson.Exercises[i].ID == "" { lesson.Exercises[i].ID = newID() }; if lesson.Exercises[i].XP <= 0 { lesson.Exercises[i].XP = 10 } }
	if s.db != nil {
		if err := s.ensureContentSchema(ctx); err != nil { return model.Lesson{}, err }
		tx, err := s.db.BeginTx(ctx,nil); if err != nil { return model.Lesson{},err }; defer tx.Rollback(); id := lesson.ID; if id == "" { id = newID() }
		var created, updated time.Time
		err = tx.QueryRowContext(ctx, `INSERT INTO lessons(id,slug,title,description,level,skill,topic,status,estimated_mins,created_by,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW(),NOW()) ON CONFLICT(slug) DO UPDATE SET title=EXCLUDED.title,description=EXCLUDED.description,level=EXCLUDED.level,skill=EXCLUDED.skill,topic=EXCLUDED.topic,status=EXCLUDED.status,estimated_mins=EXCLUDED.estimated_mins,updated_at=NOW() RETURNING id,created_at,updated_at`, id,lesson.Slug,lesson.Title,lesson.Description,lesson.Level,lesson.Skill,lesson.Topic,lesson.Status,lesson.EstimatedMins,createdBy).Scan(&id,&created,&updated); if err != nil { return model.Lesson{},err }
		if _,err=tx.ExecContext(ctx,`DELETE FROM lesson_exercises WHERE lesson_id=$1`,id);err!=nil{return model.Lesson{},err}
		for _,ex:=range lesson.Exercises { options,_:=json.Marshal(ex.Options); _,err=tx.ExecContext(ctx,`INSERT INTO lesson_exercises(id,lesson_id,kind,prompt,answer,options,explanation,position,xp) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,ex.ID,id,ex.Kind,ex.Prompt,ex.Answer,options,ex.Explanation,ex.Position,ex.XP); if err!=nil{return model.Lesson{},err} }
		if err=tx.Commit();err!=nil{return model.Lesson{},err}; return s.GetLesson(ctx,lesson.Slug,true)
	}
	state:=s.contentMemory();state.mu.Lock();defer state.mu.Unlock();now:=time.Now().UTC();if existing,ok:=state.lessons[lesson.Slug];ok{lesson.ID=existing.ID;lesson.CreatedAt=existing.CreatedAt}else{lesson.ID=idOrNew(lesson.ID);lesson.CreatedAt=now};lesson.UpdatedAt=now;state.lessons[lesson.Slug]=cloneLesson(lesson);return cloneLesson(lesson),nil
}

func (s *Store) DeleteLesson(ctx context.Context, slug string) error {
	if s.db != nil { if err:=s.ensureContentSchema(ctx);err!=nil{return err};res,err:=s.db.ExecContext(ctx,`DELETE FROM lessons WHERE slug=$1`,slug);if err!=nil{return err};n,_:=res.RowsAffected();if n==0{return ErrNotFound};return nil }
	state:=s.contentMemory();state.mu.Lock();defer state.mu.Unlock();if _,ok:=state.lessons[slug];!ok{return ErrNotFound};delete(state.lessons,slug);return nil
}

func (s *Store) SaveLessonProgress(ctx context.Context,userID,lessonID string,completed,total int,score float64)(model.LessonProgress,error){
	if score<0{score=0};if score>1{score=1};p:=model.LessonProgress{LessonID:lessonID,CompletedExercises:completed,TotalExercises:total,LastScore:score,UpdatedAt:time.Now().UTC()}
	if s.db!=nil{if err:=s.ensureContentSchema(ctx);err!=nil{return p,err};_,err:=s.db.ExecContext(ctx,`INSERT INTO lesson_progress(user_id,lesson_id,completed_exercises,total_exercises,last_score,updated_at) VALUES($1,$2,$3,$4,$5,NOW()) ON CONFLICT(user_id,lesson_id) DO UPDATE SET completed_exercises=GREATEST(lesson_progress.completed_exercises,EXCLUDED.completed_exercises),total_exercises=EXCLUDED.total_exercises,last_score=EXCLUDED.last_score,updated_at=NOW()`,userID,lessonID,completed,total,score);return p,err}
	state:=s.contentMemory();state.mu.Lock();defer state.mu.Unlock();if state.progress[userID]==nil{state.progress[userID]=map[string]model.LessonProgress{}};state.progress[userID][lessonID]=p;return p,nil
}

func configuredRole(email string) string { email=strings.ToLower(strings.TrimSpace(email)); if emailInEnv("ADMIN_EMAILS",email){return "admin"}; if emailInEnv("TEACHER_EMAILS",email){return "teacher"}; return "learner" }
func emailInEnv(key,email string)bool{for _,value:=range strings.FieldsFunc(os.Getenv(key),func(r rune)bool{return r==','||r==';'||r==' '||r=='\n'}){if strings.ToLower(strings.TrimSpace(value))==email{return true}};return false}
func normalizeSlug(slug,title string)string{slug=strings.ToLower(strings.TrimSpace(slug));if slug==""{slug=strings.ToLower(strings.TrimSpace(title))};slug=regexp.MustCompile(`[^a-z0-9]+`).ReplaceAllString(slug,"-");return strings.Trim(slug,"-")}
func idOrNew(id string)string{if id!=""{return id};return newID()}
func maxInt(a,b int)int{if a>b{return a};return b}
func cloneLesson(in model.Lesson)model.Lesson{out:=in;out.Exercises=append([]model.LessonExercise(nil),in.Exercises...);for i:=range out.Exercises{out.Exercises[i].Options=append([]string(nil),in.Exercises[i].Options...)};return out}

func seedLessons() []model.Lesson {
	now:=time.Now().UTC()
	return []model.Lesson{
		{ID:newID(),Slug:"airport-check-in-sprint",Title:"Airport Check-in Sprint",Description:"Handle check-in vocabulary, announcements and one spoken request before a flight.",Level:"B1",Skill:"Mixed",Topic:"Travel",Status:"published",EstimatedMins:12,CreatedAt:now,UpdatedAt:now,Exercises:[]model.LessonExercise{{ID:newID(),Kind:"choice",Prompt:"Your suitcase is too heavy. What is the most natural phrase?",Answer:"My bag is over the weight limit.",Options:[]string{"My bag is over the weight limit.","My bag has many kilos.","My luggage is very gravity."},Explanation:"Over the weight limit is the natural airport collocation.",XP:10},{ID:newID(),Kind:"input",Prompt:"Complete: Could I have a ___ seat, please?",Answer:"window",Explanation:"Window seat is a standard travel collocation.",XP:10},{ID:newID(),Kind:"speaking",Prompt:"Say: I missed my connection. Could you help me rebook the earliest available flight?",Answer:"I missed my connection. Could you help me rebook the earliest available flight?",Explanation:"Use a polite request after explaining the problem.",XP:15}}},
		{ID:newID(),Slug:"work-meeting-survival",Title:"Work Meeting Survival",Description:"Clarify, disagree politely and summarize an action item in a software-team meeting.",Level:"B1",Skill:"Speaking",Topic:"Work",Status:"published",EstimatedMins:10,CreatedAt:now,UpdatedAt:now,Exercises:[]model.LessonExercise{{ID:newID(),Kind:"choice",Prompt:"Choose the most professional clarification.",Answer:"Could you clarify what you mean by the rollout window?",Options:[]string{"What are you saying?","Could you clarify what you mean by the rollout window?","Say it again better."},Explanation:"Could you clarify… is direct but professional.",XP:10},{ID:newID(),Kind:"input",Prompt:"Complete: I see your point; ___, I’m concerned about the migration risk.",Answer:"however",Explanation:"However introduces a respectful contrast.",XP:10},{ID:newID(),Kind:"speaking",Prompt:"Give a 20-second update: what changed, what is blocked, and what happens next?",Answer:"",Explanation:"A useful status update is concise and action-oriented.",XP:15}}},
		{ID:newID(),Slug:"ielts-opinion-architecture",Title:"IELTS Opinion Architecture",Description:"Build a clear position, topic sentence and developed example before writing a full Task 2 essay.",Level:"B2",Skill:"Writing",Topic:"IELTS",Status:"published",EstimatedMins:15,CreatedAt:now,UpdatedAt:now,Exercises:[]model.LessonExercise{{ID:newID(),Kind:"choice",Prompt:"Which thesis is clearest for an agree/disagree essay?",Answer:"I largely agree because reliable public transport reduces congestion and improves access to work.",Options:[]string{"This topic has many advantages and disadvantages.","I largely agree because reliable public transport reduces congestion and improves access to work.","Transport is important in modern life."},Explanation:"A strong thesis states a position and previews the logic.",XP:10},{ID:newID(),Kind:"input",Prompt:"Write one topic sentence arguing that public transport improves economic access.",Answer:"",Explanation:"One paragraph should begin with one controlling idea.",XP:15},{ID:newID(),Kind:"input",Prompt:"Add one concrete example that develops the topic sentence rather than repeating it.",Answer:"",Explanation:"Development means explaining consequence or evidence, not paraphrasing the claim.",XP:15}}},
	}
}

const contentSchemaSQL = `
CREATE TABLE IF NOT EXISTS user_roles(user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,role TEXT NOT NULL DEFAULT 'learner' CHECK(role IN ('learner','teacher','admin')),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS lessons(id TEXT PRIMARY KEY,slug TEXT UNIQUE NOT NULL,title TEXT NOT NULL,description TEXT NOT NULL DEFAULT '',level TEXT NOT NULL DEFAULT 'B1',skill TEXT NOT NULL,topic TEXT NOT NULL DEFAULT '',status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published')),estimated_mins INTEGER NOT NULL DEFAULT 10,created_by TEXT,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS lesson_exercises(id TEXT PRIMARY KEY,lesson_id TEXT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,kind TEXT NOT NULL,prompt TEXT NOT NULL,answer TEXT NOT NULL DEFAULT '',options JSONB NOT NULL DEFAULT '[]'::jsonb,explanation TEXT NOT NULL DEFAULT '',position INTEGER NOT NULL DEFAULT 0,xp INTEGER NOT NULL DEFAULT 10);
CREATE TABLE IF NOT EXISTS lesson_progress(user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,lesson_id TEXT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,completed_exercises INTEGER NOT NULL DEFAULT 0,total_exercises INTEGER NOT NULL DEFAULT 0,last_score DOUBLE PRECISION NOT NULL DEFAULT 0,updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),PRIMARY KEY(user_id,lesson_id));
`

var _ = fmt.Sprintf
