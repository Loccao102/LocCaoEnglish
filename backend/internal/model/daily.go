package model

import "time"

type DailyPlanSnapshot struct {
	Date         string       `json:"date"`
	RulesVersion string       `json:"rulesVersion"`
	Quests       []DailyQuest `json:"quests"`
	CreatedAt    time.Time    `json:"createdAt"`
}
type DailyQuestEvidence struct {
	QuestID   string `json:"questId"`
	Activity  string `json:"activity"`
	AttemptID string `json:"attemptId"`
}
type DailyClaimReceipt struct {
	Date         string               `json:"date"`
	RulesVersion string               `json:"rulesVersion"`
	RewardXP     int                  `json:"rewardXp"`
	ClaimedAt    time.Time            `json:"claimedAt"`
	Legacy       bool                 `json:"legacy"`
	Plan         *DailyPlanSnapshot   `json:"plan,omitempty"`
	Evidence     []DailyQuestEvidence `json:"evidence"`
}

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
	RulesVersion string             `json:"rulesVersion"`
	Method       string             `json:"method"`
	Receipt      *DailyClaimReceipt `json:"receipt,omitempty"`
	Date         string             `json:"date"`
	Quests       []DailyQuest       `json:"quests"`
	Completed    int                `json:"completed"`
	Total        int                `json:"total"`
	ChestXP      int                `json:"chestXp"`
	Claimable    bool               `json:"claimable"`
	Claimed      bool               `json:"claimed"`
}
