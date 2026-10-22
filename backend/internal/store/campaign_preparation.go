package store

import (
	"context"
	"time"

	"github.com/Loccao102/LocCaoEnglish/backend/internal/model"
	"github.com/lib/pq"
)

const CampaignPracticeRules = "campaign-practice.v1"

type campaignRequirement struct {
	ID         string
	Activities []string
}
type campaignGate struct {
	Previous, Goal  string
	MinXP, RewardXP int
	Requirements    []campaignRequirement
}

// The same policy drives GET readiness and the atomic first-clear check.
// These are guided activity prerequisites, not pack-specific mastery claims.
var campaignGates = map[string]campaignGate{
	"airport-crisis": {Goal: "travel", MinXP: 150, RewardXP: 150, Requirements: []campaignRequirement{
		{"airport-vocab", []string{"word-link"}}, {"airport-listening", []string{"listen-pick", "dictation"}}, {"airport-speaking", []string{"shadowing"}},
	}},
	"hotel-reservation": {Previous: "airport-crisis", RewardXP: 180, Requirements: []campaignRequirement{
		{"hotel-reading", []string{"story-choice"}}, {"hotel-grammar", []string{"grammar-repair"}}, {"hotel-speaking", []string{"shadowing"}},
	}},
	"city-transit": {Previous: "hotel-reservation", RewardXP: 220, Requirements: []campaignRequirement{
		{"transit-vocab", []string{"collocation-factory"}}, {"transit-listening", []string{"listen-pick"}}, {"transit-speaking", []string{"shadowing"}},
	}},
	"cafe-connection": {Goal: "conversation", MinXP: 250, RewardXP: 120, Requirements: []campaignRequirement{
		{"cafe-vocab", []string{"collocation-factory"}}, {"cafe-listen", []string{"listen-pick"}}, {"cafe-speak", []string{"shadowing"}},
	}},
	"weekend-plans": {Previous: "cafe-connection", RewardXP: 160, Requirements: []campaignRequirement{
		{"plans-grammar", []string{"sentence-builder"}}, {"plans-listen", []string{"listen-pick"}}, {"plans-speak", []string{"shadowing"}},
	}},
	"repair-misunderstanding": {Previous: "weekend-plans", RewardXP: 200, Requirements: []campaignRequirement{
		{"repair-grammar", []string{"grammar-repair"}}, {"repair-vocab", []string{"collocation-factory"}}, {"repair-speak", []string{"shadowing"}},
	}},
	"daily-standup": {Goal: "work", MinXP: 500, RewardXP: 140, Requirements: []campaignRequirement{
		{"standup-grammar", []string{"sentence-builder"}}, {"standup-vocab", []string{"collocation-factory"}}, {"standup-speak", []string{"shadowing"}},
	}},
	"requirement-clarity": {Previous: "daily-standup", RewardXP: 180, Requirements: []campaignRequirement{
		{"req-listen", []string{"listen-pick"}}, {"req-grammar", []string{"grammar-repair"}}, {"req-speak", []string{"shadowing"}},
	}},
	"deadline-negotiation": {Previous: "requirement-clarity", RewardXP: 240, Requirements: []campaignRequirement{
		{"deadline-vocab", []string{"collocation-factory"}}, {"deadline-grammar", []string{"sentence-builder", "grammar-repair"}}, {"deadline-speak", []string{"shadowing"}},
	}},
}

type CampaignPracticeEvidence struct {
	CheckpointID   string    `json:"checkpointId"`
	AttemptID      string    `json:"attemptId"`
	Activity       string    `json:"activity"`
	ContentVersion string    `json:"contentVersion"`
	RulesVersion   string    `json:"rulesVersion"`
	CompletedAt    time.Time `json:"completedAt"`
}
type CampaignPreparation struct {
	RulesVersion        string                     `json:"rulesVersion"`
	PreviousBossID      string                     `json:"previousBossId,omitempty"`
	PreviousCompletedAt *time.Time                 `json:"previousCompletedAt,omitempty"`
	Checkpoints         []CampaignPracticeEvidence `json:"checkpoints"`
}

// Keep only the latest correct completion per activity. Older receipts cannot
// satisfy any freshness window that the latest one fails. No reward is required:
// a new correct replay is practice even when its daily XP was already claimed.
func campaignPracticeSQL(ctx context.Context, q dailyQuery, owner string) (map[string]CampaignPracticeEvidence, error) {
	rows, err := q.QueryContext(ctx, `SELECT DISTINCT ON (activity) id,activity,content_version,rules_version,completed_at
	 FROM learning_attempts WHERE user_id=$1 AND status='completed' AND correct AND content_version<>'' AND completed_at IS NOT NULL
	 AND activity||':'||rules_version=ANY($2) ORDER BY activity,completed_at DESC,id DESC`, owner, pq.Array(practiceRulePairs()))
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := map[string]CampaignPracticeEvidence{}
	for rows.Next() {
		var e CampaignPracticeEvidence
		if err = rows.Scan(&e.AttemptID, &e.Activity, &e.ContentVersion, &e.RulesVersion, &e.CompletedAt); err != nil {
			return nil, err
		}
		e.CompletedAt = e.CompletedAt.UTC()
		out[e.Activity] = e
	}
	return out, rows.Err()
}

// Caller holds s.mu, including when this runs inside a first-clear critical section.
func (s *Store) campaignPracticeMemory(owner string) map[string]CampaignPracticeEvidence {
	out := map[string]CampaignPracticeEvidence{}
	for _, r := range s.learningAttempts {
		rules, supported := checkedPracticeRules[r.Activity]
		if !supported || r.RulesVersion != rules || r.ContentVersion == "" || r.UserID != owner || owner == "" || r.Status != "completed" || !r.Correct || r.CompletedAt.IsZero() {
			continue
		}
		old, found := out[r.Activity]
		if !found || r.CompletedAt.After(old.CompletedAt) || r.CompletedAt.Equal(old.CompletedAt) && r.ID > old.AttemptID {
			out[r.Activity] = CampaignPracticeEvidence{AttemptID: r.ID, Activity: r.Activity, ContentVersion: r.ContentVersion, RulesVersion: r.RulesVersion, CompletedAt: r.CompletedAt.UTC()}
		}
	}
	return out
}
func (s *Store) campaignPractice(ctx context.Context, owner string) (map[string]CampaignPracticeEvidence, error) {
	if s.db != nil {
		return campaignPracticeSQL(ctx, s.db, owner)
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.campaignPracticeMemory(owner), nil
}

func prepareCampaign(bossID string, done map[string]*time.Time, practice map[string]CampaignPracticeEvidence) CampaignPreparation {
	gate := campaignGates[bossID]
	p := CampaignPreparation{RulesVersion: CampaignPracticeRules, PreviousBossID: gate.Previous, Checkpoints: []CampaignPracticeEvidence{}}
	if gate.Previous != "" {
		at := done[gate.Previous]
		if at == nil {
			return p
		}
		copy := *at
		p.PreviousCompletedAt = &copy
	}
	for _, req := range gate.Requirements {
		var selected CampaignPracticeEvidence
		for _, activity := range req.Activities {
			e, ok := practice[activity]
			if !ok || p.PreviousCompletedAt != nil && !e.CompletedAt.After(*p.PreviousCompletedAt) {
				continue
			}
			if selected.AttemptID == "" || e.CompletedAt.After(selected.CompletedAt) || e.CompletedAt.Equal(selected.CompletedAt) && e.AttemptID > selected.AttemptID {
				selected = e
			}
		}
		if selected.AttemptID != "" {
			selected.CheckpointID = req.ID
			p.Checkpoints = append(p.Checkpoints, selected)
		}
	}
	return p
}
func campaignCheckpointReady(id, bossID string, done map[string]*time.Time, practice map[string]CampaignPracticeEvidence) bool {
	for _, e := range prepareCampaign(bossID, done, practice).Checkpoints {
		if e.CheckpointID == id {
			return true
		}
	}
	return false
}
func campaignGateOpen(id string, user model.User, profile model.PlayerProfile, done map[string]*time.Time, practice map[string]CampaignPracticeEvidence) bool {
	gate, ok := campaignGates[id]
	if !ok {
		return false
	}
	// Preserve earned/legacy clears; never fabricate their preparation.
	if done[id] != nil {
		return true
	}
	p := prepareCampaign(id, done, practice)
	if gate.Previous != "" && p.PreviousCompletedAt == nil {
		return false
	}
	if gate.Previous == "" && profile.Goal != gate.Goal && user.XP < gate.MinXP {
		return false
	}
	return len(p.Checkpoints) == len(gate.Requirements)
}
