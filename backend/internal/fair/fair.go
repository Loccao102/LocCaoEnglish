// Package fair stores personal keepsakes. These client-reported completions never
// grant account XP, currency, learning evidence or competitive leaderboard points.
package fair

import (
	_ "embed"
	"encoding/json"
	"errors"
	"regexp"
	"time"
)

//go:embed catalog.json
var catalogJSON []byte

//go:embed courses.json
var coursesJSON []byte

type Course struct {
	ID     string `json:"id"`
	GameID string `json:"gameId"`
}
type CourseRecord struct {
	Medals   int  `json:"medals"`
	Clean    bool `json:"clean"`
	Feathers int  `json:"feathers"`
	BestMS   int  `json:"bestMs"`
	Visits   int  `json:"visits"`
}

var courses = func() []Course {
	var list []Course
	if err := json.Unmarshal(coursesJSON, &list); err != nil {
		panic(err)
	}
	return list
}()

type Game struct {
	ID     string `json:"id"`
	Rounds int    `json:"rounds"`
}
type Record struct {
	Best         int       `json:"best"`
	Stars        int       `json:"stars"`
	Visits       int       `json:"visits"`
	LastPlayedAt time.Time `json:"lastPlayedAt"`
}
type Save struct {
	Version int                     `json:"version"`
	Games   map[string]Record       `json:"games"`
	Courses map[string]CourseRecord `json:"courses,omitempty"`
}
type Completion struct {
	RunID     string `json:"runId"`
	GameID    string `json:"gameId"`
	Stars     int    `json:"stars"`
	CourseID  string `json:"courseId,omitempty"`
	ElapsedMS int    `json:"elapsedMs,omitempty"`
	Feathers  int    `json:"feathers,omitempty"`
}

var ErrInvalid = errors.New("invalid fair completion")
var ErrConflict = errors.New("this run was already saved with a different result")
var ErrLocked = errors.New("complete the previous course before starting this one")
var runPattern = regexp.MustCompile(`^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$`)
var games = func() map[string]Game {
	var list []Game
	if err := json.Unmarshal(catalogJSON, &list); err != nil {
		panic(err)
	}
	result := map[string]Game{}
	for _, game := range list {
		result[game.ID] = game
	}
	return result
}()

func NewSave() Save { return Save{Version: 1, Games: map[string]Record{}} }
func Clone(save Save) Save {
	next := NewSave()
	for id, record := range save.Games {
		next.Games[id] = record
	}
	if len(save.Courses) > 0 {
		next.Courses = map[string]CourseRecord{}
		for id, record := range save.Courses {
			next.Courses[id] = record
		}
	}
	return next
}
func Validate(c Completion) error {
	if _, ok := games[c.GameID]; !ok || c.Stars < 1 || c.Stars > 3 || !runPattern.MatchString(c.RunID) {
		return ErrInvalid
	}
	if c.CourseID != "" {
		found := false
		for _, course := range courses {
			if course.ID == c.CourseID && course.GameID == c.GameID {
				found = true
			}
		}
		if !found || c.ElapsedMS < 1 || c.ElapsedMS > 86400000 || c.Feathers < 0 || c.Feathers > 3 {
			return ErrInvalid
		}
	} else if c.ElapsedMS != 0 || c.Feathers != 0 {
		return ErrInvalid
	}
	return nil
}
func CanPlay(save Save, c Completion) bool {
	if c.CourseID == "" {
		return true
	}
	previous := ""
	for _, course := range courses {
		if course.GameID != c.GameID {
			continue
		}
		if course.ID == c.CourseID {
			return previous == "" || save.Courses[previous].Visits > 0 || previous == "cloud-01" && save.Games["cloud-hop"].Visits > 0
		}
		previous = course.ID
	}
	return false
}
func Apply(save Save, c Completion, now time.Time) Save {
	next := Clone(save)
	r := next.Games[c.GameID]
	r.Best = max(r.Best, games[c.GameID].Rounds*100+c.Stars*25)
	r.Stars = max(r.Stars, c.Stars)
	r.Visits++
	r.LastPlayedAt = now.UTC()
	next.Games[c.GameID] = r
	if c.CourseID != "" {
		if next.Courses == nil {
			next.Courses = map[string]CourseRecord{}
		}
		course := next.Courses[c.CourseID]
		course.Clean = course.Clean || c.Stars == 3
		course.Feathers = max(course.Feathers, c.Feathers)
		course.Medals = 1
		if course.Clean {
			course.Medals++
		}
		if course.Feathers == 3 {
			course.Medals++
		}
		if course.BestMS == 0 || c.ElapsedMS < course.BestMS {
			course.BestMS = c.ElapsedMS
		}
		course.Visits++
		next.Courses[c.CourseID] = course
	}
	return next
}
