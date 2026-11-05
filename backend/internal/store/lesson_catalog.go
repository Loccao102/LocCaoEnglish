package store

import (
	"context"
	"database/sql"
	"encoding/json"

	"github.com/Loccao102/LocCaoEnglish/backend/internal/model"
)

func (s *Store) listLessonsPostgres(ctx context.Context, includeDraft bool) ([]model.Lesson, error) {
	if err := s.ensureContentSchema(ctx); err != nil {
		return nil, err
	}
	query := `SELECT l.id,l.slug,l.title,l.description,l.level,l.skill,l.topic,l.status,l.estimated_mins,l.created_at,l.updated_at,
 e.id,e.kind,e.prompt,e.answer,e.options,e.explanation,e.position,e.xp
 FROM lessons l LEFT JOIN lesson_exercises e ON e.lesson_id=l.id`
	if !includeDraft {
		query += ` WHERE l.status='published'`
	}
	// Keep lesson groups contiguous so the first row for each lesson preserves
	// catalog order, while the map below also tolerates a future join plan that
	// interleaves rows for equal timestamps.
	query += ` ORDER BY l.updated_at DESC,l.id ASC,e.position ASC`
	rows, err := s.db.QueryContext(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]model.Lesson, 0)
	indices := make(map[string]int)
	for rows.Next() {
		var lesson model.Lesson
		var exerciseID, kind, prompt, answer, explanation sql.NullString
		var options []byte
		var position, xp sql.NullInt64
		if err := rows.Scan(&lesson.ID, &lesson.Slug, &lesson.Title, &lesson.Description, &lesson.Level, &lesson.Skill, &lesson.Topic, &lesson.Status, &lesson.EstimatedMins, &lesson.CreatedAt, &lesson.UpdatedAt, &exerciseID, &kind, &prompt, &answer, &options, &explanation, &position, &xp); err != nil {
			return nil, err
		}
		index, ok := indices[lesson.ID]
		if !ok {
			index = len(out)
			indices[lesson.ID] = index
			out = append(out, lesson)
		}
		if exerciseID.Valid {
			exercise := model.LessonExercise{ID: exerciseID.String, Kind: kind.String, Prompt: prompt.String, Answer: answer.String, Explanation: explanation.String}
			if len(options) > 0 {
				_ = json.Unmarshal(options, &exercise.Options)
			}
			if position.Valid {
				exercise.Position = int(position.Int64)
			}
			if xp.Valid {
				exercise.XP = int(xp.Int64)
			}
			out[index].Exercises = append(out[index].Exercises, exercise)
		}
	}
	return out, rows.Err()
}
