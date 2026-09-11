package model

import "time"

type WorldState struct {
	ID          string `json:"id"`
	Title       string `json:"title"`
	Description string `json:"description"`
	Route       string `json:"route"`
	Icon        string `json:"icon"`
	Unlocked    bool   `json:"unlocked"`
	Progress    int    `json:"progress"`
	UnlockText  string `json:"unlockText"`
}

type BossCheckpoint struct {
	ID       string `json:"id"`
	Title    string `json:"title"`
	Skill    string `json:"skill"`
	Route    string `json:"route"`
	Complete bool   `json:"complete"`
}

type BossState struct {
	ID          string           `json:"id"`
	Title       string           `json:"title"`
	WorldID     string           `json:"worldId"`
	Route       string           `json:"route"`
	Unlocked    bool             `json:"unlocked"`
	Cleared     bool             `json:"cleared"`
	RewardXP    int              `json:"rewardXp"`
	Checkpoints []BossCheckpoint `json:"checkpoints"`
	CompletedAt *time.Time       `json:"completedAt,omitempty"`
}

type Achievement struct {
	ID             string `json:"id"`
	Title          string `json:"title"`
	Description    string `json:"description"`
	Icon           string `json:"icon"`
	Unlocked       bool   `json:"unlocked"`
	Progress       int    `json:"progress"`
	Target         int    `json:"target"`
	RewardCosmetic string `json:"rewardCosmetic,omitempty"`
}

type Cosmetic struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Slot        string `json:"slot"`
	Description string `json:"description"`
	Unlocked    bool   `json:"unlocked"`
	Equipped    bool   `json:"equipped"`
}

type ProgressionState struct {
	Level         int           `json:"level"`
	XP            int           `json:"xp"`
	XPIntoLevel   int           `json:"xpIntoLevel"`
	XPForNext     int           `json:"xpForNext"`
	Worlds        []WorldState  `json:"worlds"`
	Bosses        []BossState   `json:"bosses"`
	Achievements  []Achievement `json:"achievements"`
	Inventory     []Cosmetic    `json:"inventory"`
}

type EquipCosmeticInput struct {
	CosmeticID string `json:"cosmeticId"`
}
