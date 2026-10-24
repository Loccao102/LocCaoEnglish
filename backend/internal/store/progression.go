package store

import (
	"context"
	"errors"
	"math"
	"strings"
	"sync"
	"time"

	"github.com/Loccao102/LocCaoEnglish/backend/internal/model"
)

type progressionMemory struct {
	mu                sync.RWMutex
	bosses            map[string]map[string]time.Time
	loadout           map[string]map[string]string
	receipts          map[string]map[string]MissionReceipt
	grants            map[string]map[string]model.VocabularyUnlockReceipt
	vocabularyCutover bool
}

var progressionMemories sync.Map

func (s *Store) progressionMemory() *progressionMemory {
	if v, ok := progressionMemories.Load(s); ok {
		return v.(*progressionMemory)
	}
	state := &progressionMemory{
		bosses: map[string]map[string]time.Time{}, loadout: map[string]map[string]string{},
		receipts: map[string]map[string]MissionReceipt{},
		grants:   map[string]map[string]model.VocabularyUnlockReceipt{},
	}
	actual, _ := progressionMemories.LoadOrStore(s, state)
	return actual.(*progressionMemory)
}

func (s *Store) EnsureProgression(ctx context.Context) error {
	if s.db == nil {
		s.ensureVocabularyUnlocksMemory()
		return nil
	}
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if _, err = tx.ExecContext(ctx, `SELECT pg_advisory_xact_lock(140014,1)`); err != nil {
		return err
	}
	if _, err = tx.ExecContext(ctx, progressionSchemaSQL); err != nil {
		return err
	}
	if _, err = tx.ExecContext(ctx, vocabularyUnlockSchemaSQL); err != nil {
		return err
	}
	return tx.Commit()
}
func (s *Store) GetProgression(ctx context.Context, userID string) (model.ProgressionState, error) {
	u, err := s.GetUser(ctx, userID)
	if err != nil {
		return model.ProgressionState{}, err
	}
	profile, err := s.GetPlayerProfile(ctx, userID)
	if err != nil {
		return model.ProgressionState{}, err
	}
	unlocks, err := s.syncVocabularyUnlocks(ctx, userID)
	if err != nil {
		return model.ProgressionState{}, err
	}
	history, _ := s.IELTSHistory(ctx, userID, 100)
	done, err := s.bossCompletions(ctx, userID)
	if err != nil {
		return model.ProgressionState{}, err
	}
	loadout, err := s.playerLoadout(ctx, userID)
	if err != nil {
		return model.ProgressionState{}, err
	}
	practice, err := s.campaignPractice(ctx, userID)
	if err != nil {
		return model.ProgressionState{}, err
	}
	travel := buildTravelCampaign(u, profile, done, practice)
	conversation := buildConversationCampaign(u, profile, done, practice)
	work := buildWorkCampaign(u, profile, done, practice)
	words, smith := unlocks["word-network"], unlocks["wordsmith"]
	wordNet := words.Receipt != nil
	arena := u.XP >= 700
	ieltsOpen := profile.Goal == "ielts" || u.XP >= 1000 || len(history) > 0
	sections := map[string]bool{}
	for _, h := range history {
		sections[strings.ToLower(h.Section)] = true
	}
	ieltsProgress := minInt(100, len(sections)*25)
	worlds := []model.WorldState{{ID: "training", Title: "Training Grounds", Description: "Daily quests, Recovery and the Arcade build your core stats.", Route: "/learn", Icon: "⌂", Unlocked: true, Progress: minInt(100, percent(u.XP, 150)), UnlockText: "Always open"}, travel.World, conversation.World, work.World, {ID: "words", Title: "Word Network", Description: "Explore meaning, collocations and word families as a connected map.", Route: "/word-graph", Icon: "◇", Unlocked: wordNet, Progress: percent(words.CorrectItems, words.TargetItems), UnlockText: "Complete 3 different vocabulary items correctly or reach 300 personal XP", Unlock: &words}, {ID: "arena", Title: "Battle Arena", Description: "Challenge other learners and put fast recall under pressure.", Route: "/social", Icon: "⚔", Unlocked: arena, Progress: minInt(100, percent(u.XP, 700)), UnlockText: "Reach 700 XP"}, {ID: "ielts", Title: "IELTS Tower", Description: "Clear four floors and build a four-skill practice estimate.", Route: "/ielts", Icon: "▤", Unlocked: ieltsOpen, Progress: ieltsProgress, UnlockText: "Choose IELTS as your goal, reach 1,000 XP, or complete an IELTS floor"}}
	bosses := append(append(append([]model.BossState{}, travel.Bosses...), conversation.Bosses...), work.Bosses...)
	unlockedWorlds := 0
	for _, w := range worlds {
		if w.Unlocked {
			unlockedWorlds++
		}
	}
	achievements := []model.Achievement{{ID: "first-spark", Title: "First Spark", Description: "Earn your first 20 XP.", Icon: "✦", Unlocked: u.XP >= 20, Progress: minInt(u.XP, 20), Target: 20}, {ID: "world-walker", Title: "World Walker", Description: "Unlock three learning worlds.", Icon: "◫", Unlocked: unlockedWorlds >= 3, Progress: minInt(unlockedWorlds, 3), Target: 3, RewardCosmetic: "traveler-badge"}, {ID: "seven-day-flame", Title: "Seven Day Flame", Description: "Keep a seven-day learning streak.", Icon: "🔥", Unlocked: u.Streak >= 7, Progress: minInt(u.Streak, 7), Target: 7}, {ID: "wordsmith", Title: "Wordsmith", Description: "Complete 7 different vocabulary items correctly across at least 2 activities.", Icon: "◇", Unlocked: smith.Receipt != nil, Progress: minInt(7, smith.CorrectItems), Target: 7, RewardCosmetic: "wordsmith-pin", Unlock: &smith}, {ID: "tower-entry", Title: "Tower Entry", Description: "Complete your first IELTS Tower floor.", Icon: "▤", Unlocked: len(history) > 0, Progress: minInt(len(history), 1), Target: 1, RewardCosmetic: "ielts-aura"}}
	achievements = append(achievements, travel.Achievements...)
	achievements = append(achievements, conversation.Achievements...)
	achievements = append(achievements, work.Achievements...)
	cosmetics := []model.Cosmetic{{ID: "rookie-title", Name: "Adventurer", Slot: "title", Description: "The title every learner starts with.", Unlocked: true}, {ID: "traveler-badge", Name: "World Walker", Slot: "badge", Description: "A passport-style badge for opening three worlds.", Unlocked: unlockedWorlds >= 3}, {ID: "wordsmith-pin", Name: "Wordsmith Pin", Slot: "badge", Description: "A keepsake for 7 different correct vocabulary items across 2 activities.", Unlocked: smith.Receipt != nil, Unlock: &smith}, {ID: "arena-frame", Name: "Arena Frame", Slot: "frame", Description: "A competitive profile frame unlocked with the Battle Arena.", Unlocked: arena}, {ID: "ielts-aura", Name: "Tower Aura", Slot: "aura", Description: "Unlocked after your first IELTS Tower floor.", Unlocked: len(history) > 0}}
	cosmetics = append(cosmetics, travel.Cosmetics...)
	cosmetics = append(cosmetics, conversation.Cosmetics...)
	cosmetics = append(cosmetics, work.Cosmetics...)
	for i := range cosmetics {
		if loadout[cosmetics[i].Slot] == cosmetics[i].ID {
			cosmetics[i].Equipped = true
		}
	}
	level, into, next := levelFromXP(u.XP)
	return model.ProgressionState{Level: level, XP: u.XP, XPIntoLevel: into, XPForNext: next, Worlds: worlds, Bosses: bosses, Achievements: achievements, Inventory: cosmetics}, nil
}
func countReady(items []model.BossCheckpoint) int {
	n := 0
	for _, item := range items {
		if item.Complete {
			n++
		}
	}
	return n
}
func (s *Store) EquipCosmetic(ctx context.Context, userID, cosmeticID string) (model.ProgressionState, error) {
	state, err := s.GetProgression(ctx, userID)
	if err != nil {
		return state, err
	}
	var chosen *model.Cosmetic
	for i := range state.Inventory {
		if state.Inventory[i].ID == cosmeticID {
			chosen = &state.Inventory[i]
			break
		}
	}
	if chosen == nil {
		return state, ErrNotFound
	}
	if !chosen.Unlocked {
		return state, errors.New("cosmetic is still locked")
	}
	if s.db != nil {
		_, err = s.db.ExecContext(ctx, `INSERT INTO player_loadout(user_id,slot,cosmetic_id,updated_at) VALUES($1,$2,$3,NOW()) ON CONFLICT(user_id,slot) DO UPDATE SET cosmetic_id=EXCLUDED.cosmetic_id,updated_at=NOW()`, userID, chosen.Slot, chosen.ID)
		if err != nil {
			return state, err
		}
		return s.GetProgression(ctx, userID)
	}
	mem := s.progressionMemory()
	mem.mu.Lock()
	if mem.loadout[userID] == nil {
		mem.loadout[userID] = map[string]string{}
	}
	mem.loadout[userID][chosen.Slot] = chosen.ID
	mem.mu.Unlock()
	return s.GetProgression(ctx, userID)
}
func (s *Store) bossCompletions(ctx context.Context, userID string) (map[string]*time.Time, error) {
	out := map[string]*time.Time{}
	if s.db != nil {
		return campaignCompletionsSQL(ctx, s.db, userID)
	}
	mem := s.progressionMemory()
	mem.mu.RLock()
	defer mem.mu.RUnlock()
	for id, at := range mem.bosses[userID] {
		copy := at
		out[id] = &copy
	}
	return out, nil
}
func (s *Store) playerLoadout(ctx context.Context, userID string) (map[string]string, error) {
	out := map[string]string{}
	if s.db != nil {
		rows, err := s.db.QueryContext(ctx, `SELECT slot,cosmetic_id FROM player_loadout WHERE user_id=$1`, userID)
		if err != nil {
			return out, err
		}
		defer rows.Close()
		for rows.Next() {
			var slot, id string
			if err := rows.Scan(&slot, &id); err != nil {
				return out, err
			}
			out[slot] = id
		}
		return out, rows.Err()
	}
	mem := s.progressionMemory()
	mem.mu.RLock()
	defer mem.mu.RUnlock()
	for slot, id := range mem.loadout[userID] {
		out[slot] = id
	}
	return out, nil
}
func levelFromXP(xp int) (level, into, next int) {
	if xp < 0 {
		xp = 0
	}
	level = 1
	remaining := xp
	need := 100
	for remaining >= need {
		remaining -= need
		level++
		need = 100 + (level-1)*50
		if level >= 50 {
			break
		}
	}
	return level, remaining, need
}
func percent(current, target int) int {
	if target <= 0 {
		return 100
	}
	return minInt(100, int(math.Round(float64(current)*100/float64(target))))
}
func minInt(a, b int) int {
	if a < b {
		return a
	}
	return b
}
func boolInt(v bool) int {
	if v {
		return 1
	}
	return 0
}

const progressionSchemaSQL = `CREATE TABLE IF NOT EXISTS player_bosses(user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,boss_id TEXT NOT NULL,score INTEGER NOT NULL DEFAULT 0,reward_xp INTEGER NOT NULL DEFAULT 0,completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),PRIMARY KEY(user_id,boss_id));ALTER TABLE player_bosses ADD COLUMN IF NOT EXISTS evidence JSONB;CREATE TABLE IF NOT EXISTS player_loadout(user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,slot TEXT NOT NULL,cosmetic_id TEXT NOT NULL,updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),PRIMARY KEY(user_id,slot));`
