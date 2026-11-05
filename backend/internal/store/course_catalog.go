package store

import (
	"context"
	"database/sql"

	"github.com/Loccao102/LocCaoEnglish/backend/internal/model"
)

const courseCatalogSelect = `
SELECT c.id,c.slug,c.title,c.description,c.level,c.status,c.created_at,c.updated_at,
       l.id,l.slug,l.title,l.skill,l.level,cl.position,l.estimated_mins
FROM courses c
LEFT JOIN course_lessons cl ON cl.course_id=c.id
LEFT JOIN lessons l ON l.id=cl.lesson_id AND l.status='published'
`

func (s *Store) listCoursesPostgres(ctx context.Context) ([]model.Course, error) {
	return s.queryCourseCatalog(ctx, nil)
}

func (s *Store) getCoursePostgres(ctx context.Context, slug string) (model.Course, error) {
	courses, err := s.queryCourseCatalog(ctx, &slug)
	if err != nil {
		return model.Course{}, err
	}
	if len(courses) == 0 {
		return model.Course{Lessons: []model.CourseLesson{}}, ErrNotFound
	}
	return courses[0], nil
}

// queryCourseCatalog uses one joined read so every course and its visible
// lesson metadata come from the same database snapshot. A nil slug lists all
// published courses; a non-nil slug, including an empty string, is a lookup.
func (s *Store) queryCourseCatalog(ctx context.Context, slug *string) ([]model.Course, error) {
	query := courseCatalogSelect + `WHERE c.status='published'`
	args := []any(nil)
	if slug != nil {
		query += ` AND c.slug=$1`
		args = []any{*slug}
	}
	query += ` ORDER BY c.updated_at DESC,c.id ASC,cl.position ASC`

	rows, err := s.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	courses := make([]model.Course, 0)
	indices := make(map[string]int)
	for rows.Next() {
		var course model.Course
		var lessonID, lessonSlug, lessonTitle, lessonSkill, lessonLevel sql.NullString
		var lessonPosition, lessonEstimatedMins sql.NullInt64
		if err := rows.Scan(
			&course.ID, &course.Slug, &course.Title, &course.Description, &course.Level,
			&course.Status, &course.CreatedAt, &course.UpdatedAt,
			&lessonID, &lessonSlug, &lessonTitle, &lessonSkill, &lessonLevel,
			&lessonPosition, &lessonEstimatedMins,
		); err != nil {
			return nil, err
		}

		index, ok := indices[course.ID]
		if !ok {
			course.Lessons = make([]model.CourseLesson, 0)
			index = len(courses)
			indices[course.ID] = index
			courses = append(courses, course)
		}
		if !lessonID.Valid {
			continue
		}
		courses[index].Lessons = append(courses[index].Lessons, model.CourseLesson{
			Slug: lessonSlug.String, Title: lessonTitle.String, Skill: lessonSkill.String,
			Level: lessonLevel.String, Position: int(lessonPosition.Int64),
			EstimatedMins: int(lessonEstimatedMins.Int64),
		})
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return courses, nil
}
