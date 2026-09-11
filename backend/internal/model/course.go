package model

import "time"

type CourseLesson struct {
	Slug        string `json:"slug"`
	Title       string `json:"title"`
	Skill       string `json:"skill"`
	Level       string `json:"level"`
	Position    int    `json:"position"`
	EstimatedMins int  `json:"estimatedMins"`
}

type Course struct {
	ID          string         `json:"id"`
	Slug        string         `json:"slug"`
	Title       string         `json:"title"`
	Description string         `json:"description"`
	Level       string         `json:"level"`
	Status      string         `json:"status"`
	Lessons     []CourseLesson `json:"lessons"`
	CreatedAt   time.Time      `json:"createdAt"`
	UpdatedAt   time.Time      `json:"updatedAt"`
}

type CourseProgress struct {
	CourseID          string  `json:"courseId"`
	CourseSlug        string  `json:"courseSlug"`
	Enrolled          bool    `json:"enrolled"`
	CompletedLessons  int     `json:"completedLessons"`
	TotalLessons      int     `json:"totalLessons"`
	Percent           int     `json:"percent"`
	AverageScore      float64 `json:"averageScore"`
}

type SkillAnalytics struct { Skill string `json:"skill"`; AverageConfidence float64 `json:"averageConfidence"`; Learners int `json:"learners"` }
type LessonAnalytics struct { Slug string `json:"slug"`; Title string `json:"title"`; Started int `json:"started"`; Completed int `json:"completed"`; AverageScore float64 `json:"averageScore"` }
type AnalyticsSnapshot struct {
	Learners        int               `json:"learners"`
	Active7d        int               `json:"active7d"`
	Attempts7d      int               `json:"attempts7d"`
	AverageAccuracy float64           `json:"averageAccuracy"`
	CompletedLessons int              `json:"completedLessons"`
	Skills          []SkillAnalytics  `json:"skills"`
	Lessons         []LessonAnalytics `json:"lessons"`
}
