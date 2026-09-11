package model

type DailyQuest struct {
	ID       string `json:"id"`
	Title    string `json:"title"`
	Skill    string `json:"skill"`
	Activity string `json:"activity"`
	Route    string `json:"route"`
	XP       int    `json:"xp"`
	Complete bool   `json:"complete"`
}

type DailyRun struct {
	Date      string       `json:"date"`
	Quests    []DailyQuest `json:"quests"`
	Completed int          `json:"completed"`
	Total     int          `json:"total"`
	ChestXP   int          `json:"chestXp"`
	Claimable bool         `json:"claimable"`
	Claimed   bool         `json:"claimed"`
}
