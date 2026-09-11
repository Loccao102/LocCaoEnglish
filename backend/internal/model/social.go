package model

import "time"

type Presence struct {
	UserID      string    `json:"userId"`
	DisplayName string    `json:"displayName"`
	SeenAt      time.Time `json:"seenAt"`
}

type LeaderboardEntry struct {
	Rank        int    `json:"rank"`
	UserID      string `json:"userId"`
	DisplayName string `json:"displayName"`
	XP          int    `json:"xp"`
	Streak      int    `json:"streak"`
	Online      bool   `json:"online"`
}

type ChallengeEntry struct {
	UserID      string    `json:"userId"`
	DisplayName string    `json:"displayName"`
	Score       int       `json:"score"`
	SubmittedAt time.Time `json:"submittedAt"`
}

type Challenge struct {
	ID          string           `json:"id"`
	Title       string           `json:"title"`
	Skill       string           `json:"skill"`
	Activity    string           `json:"activity"`
	CreatorID   string           `json:"creatorId"`
	CreatorName string           `json:"creatorName"`
	Status      string           `json:"status"`
	WinnerID    string           `json:"winnerId,omitempty"`
	Entries     []ChallengeEntry `json:"entries"`
	CreatedAt   time.Time        `json:"createdAt"`
	ExpiresAt   time.Time        `json:"expiresAt"`
}
