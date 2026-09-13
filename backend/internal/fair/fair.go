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
	Version int               `json:"version"`
	Games   map[string]Record `json:"games"`
}
type Completion struct {
	RunID  string `json:"runId"`
	GameID string `json:"gameId"`
	Stars  int    `json:"stars"`
}

var ErrInvalid = errors.New("invalid fair completion")
var ErrConflict = errors.New("this run was already saved with a different result")
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
	return next
}
func Validate(c Completion) error {
	if _, ok := games[c.GameID]; !ok || c.Stars < 1 || c.Stars > 3 || !runPattern.MatchString(c.RunID) {
		return ErrInvalid
	}
	return nil
}
func Apply(save Save, c Completion, now time.Time) Save {
	next := Clone(save)
	r := next.Games[c.GameID]
	r.Best = max(r.Best, games[c.GameID].Rounds*100+c.Stars*25)
	r.Stars = max(r.Stars, c.Stars)
	r.Visits++
	r.LastPlayedAt = now.UTC()
	next.Games[c.GameID] = r
	return next
}
