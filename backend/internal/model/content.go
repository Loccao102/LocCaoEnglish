package model

import "time"

type LessonExercise struct {
	ID          string   `json:"id"`
	Kind        string   `json:"kind"`
	Prompt      string   `json:"prompt"`
	Answer      string   `json:"answer"`
	Options     []string `json:"options"`
	Explanation string   `json:"explanation"`
	Position    int      `json:"position"`
	XP          int      `json:"xp"`
}

type Lesson struct {
	ID            string           `json:"id"`
	Slug          string           `json:"slug"`
	Title         string           `json:"title"`
	Description   string           `json:"description"`
	Level         string           `json:"level"`
	Skill         string           `json:"skill"`
	Topic         string           `json:"topic"`
	Status        string           `json:"status"`
	EstimatedMins int              `json:"estimatedMins"`
	Exercises     []LessonExercise `json:"exercises"`
	CreatedAt     time.Time        `json:"createdAt"`
	UpdatedAt     time.Time        `json:"updatedAt"`
}

type LessonProgress struct {
	LessonID           string    `json:"lessonId"`
	CompletedExercises int       `json:"completedExercises"`
	TotalExercises     int       `json:"totalExercises"`
	LastScore          float64   `json:"lastScore"`
	UpdatedAt          time.Time `json:"updatedAt"`
}
