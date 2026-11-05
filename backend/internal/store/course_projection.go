package store

import (
	"sort"

	"github.com/Loccao102/LocCaoEnglish/backend/internal/model"
)

func copyCourseReference(course model.Course) model.Course {
	course.Lessons = append([]model.CourseLesson{}, course.Lessons...)
	return course
}

// Course membership keeps its authored order; metadata/visibility come from the
// current lesson catalog rather than the seed captured when memory mode started.
func publishedCourseLessons(refs []model.CourseLesson, catalog map[string]model.Lesson) []model.CourseLesson {
	visible := make([]model.CourseLesson, 0, len(refs))
	for _, ref := range refs {
		lesson, ok := catalog[ref.Slug]
		if !ok || lesson.Status != "published" {
			continue
		}
		ref.Title, ref.Skill, ref.Level = lesson.Title, lesson.Skill, lesson.Level
		ref.EstimatedMins = lesson.EstimatedMins
		visible = append(visible, ref)
	}
	return visible
}

func (s *Store) publishedMemoryCourse(slug string) (model.Course, error) {
	state := s.courseMemory()
	state.mu.RLock()
	course, ok := state.courses[slug]
	course = copyCourseReference(course)
	state.mu.RUnlock()
	if !ok || course.Status != "published" {
		return model.Course{}, ErrNotFound
	}
	content := s.contentMemory()
	content.mu.RLock()
	course.Lessons = publishedCourseLessons(course.Lessons, content.lessons)
	content.mu.RUnlock()
	return course, nil
}

func (s *Store) publishedMemoryCourses() []model.Course {
	state := s.courseMemory()
	state.mu.RLock()
	out := make([]model.Course, 0, len(state.courses))
	for _, course := range state.courses {
		if course.Status == "published" {
			out = append(out, copyCourseReference(course))
		}
	}
	state.mu.RUnlock()
	content := s.contentMemory()
	content.mu.RLock()
	for i := range out {
		out[i].Lessons = publishedCourseLessons(out[i].Lessons, content.lessons)
	}
	content.mu.RUnlock()
	sort.Slice(out, func(i, j int) bool { return out[i].UpdatedAt.After(out[j].UpdatedAt) })
	return out
}

func (s *Store) memoryCourseProgress(userID, slug string) (model.CourseProgress, error) {
	state := s.courseMemory()
	state.mu.RLock()
	course, ok := state.courses[slug]
	course = copyCourseReference(course)
	enrolled := state.enrolled[userID][course.ID]
	state.mu.RUnlock()
	if !ok || course.Status != "published" {
		return model.CourseProgress{}, ErrNotFound
	}
	p := model.CourseProgress{CourseID: course.ID, CourseSlug: course.Slug, Enrolled: enrolled}
	content := s.contentMemory()
	content.mu.RLock()
	defer content.mu.RUnlock()
	visible := publishedCourseLessons(course.Lessons, content.lessons)
	p.TotalLessons = len(visible)
	started := 0
	for _, ref := range visible {
		lessonID := content.lessons[ref.Slug].ID
		item, exists := content.progress[userID][lessonID]
		if !exists || item.LessonID != lessonID {
			continue
		}
		if item.TotalExercises > 0 && item.CompletedExercises >= item.TotalExercises {
			p.CompletedLessons++
		}
		// Keep the existing PostgreSQL legacy report field: started bookmarks,
		// including partial ones. This is never checked mastery or reward evidence.
		if item.CompletedExercises > 0 {
			started++
			p.AverageScore += item.LastScore
		}
	}
	if started > 0 {
		p.AverageScore /= float64(started)
	}
	if p.TotalLessons > 0 {
		p.Percent = p.CompletedLessons * 100 / p.TotalLessons
	}
	return p, nil
}
