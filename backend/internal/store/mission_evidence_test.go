package store

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"reflect"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/Loccao102/LocCaoEnglish/backend/internal/engine"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/model"
)

func TestMissionEvidencePersistence(t *testing.T) {
	urls := map[string]string{"memory": ""}
	if url := os.Getenv("TEST_DATABASE_URL"); url != "" {
		if !strings.Contains(url, "loccao_system_test") {
			t.Fatal("dedicated test DB required")
		}
		urls["postgres"] = url
	}
	for mode, url := range urls {
		t.Run(mode, func(t *testing.T) {
			ctx := context.Background()
			s, err := New(url)
			if err != nil {
				t.Fatal(err)
			}
			defer s.Close()
			for _, ensure := range []func(context.Context) error{s.EnsureIELTS, s.EnsurePlayerProfiles, s.EnsureProgression, s.EnsureProgression} {
				if err := ensure(ctx); err != nil {
					t.Fatal(err)
				}
			}
			if s.db != nil {
				migration, err := os.ReadFile("../../migrations/017_mission_evidence.sql")
				if err != nil {
					t.Fatal(err)
				}
				for i := 0; i < 2; i++ {
					if _, err = s.db.ExecContext(ctx, string(migration)); err != nil {
						t.Fatal(err)
					}
				}
			}
			u, err := s.CreateUser(ctx, fmt.Sprintf("mission-%d@example.test", time.Now().UnixNano()), "hash", "Role Player")
			if err != nil {
				t.Fatal(err)
			}
			if s.db != nil {
				defer s.db.ExecContext(ctx, `DELETE FROM users WHERE id=$1`, u.ID)
			}
			messages := []string{"I missed my flight today.", "Could you rebook me on the next flight?", "Yes please, book it. Which gate should I use?"}
			if _, err = s.CompleteBoss(ctx, u.ID, "airport-crisis", messages, engine.ConversationRulesVersion); err == nil {
				t.Fatal("locked gate accepted")
			}
			if _, err = s.GetMissionReceipt(ctx, u.ID, "airport-crisis"); !errors.Is(err, ErrNotFound) {
				t.Fatal("receipt created for failure", err)
			}
			if _, err = s.SavePlayerProfile(ctx, u.ID, model.PlayerProfile{Goal: "travel", CEFRLevel: "B1", DailyMinutes: 15, TargetBand: 7, Interests: []string{"travel"}}); err != nil {
				t.Fatal(err)
			}
			for _, activity := range []string{"word-link", "dictation", "shadowing"} {
				a, answer := campaignRound(t, s, u.ID, activity, "mission-"+activity, "mission-"+activity)
				if !campaignSubmit(t, s, u.ID, a, answer).Correct {
					t.Fatal("prerequisite fixture")
				}
			}
			before, _ := s.GetUser(ctx, u.ID)
			for _, version := range []string{"", "conversation.v1"} {
				if _, err = s.CompleteBoss(ctx, u.ID, "airport-crisis", messages, version); !errors.Is(err, ErrMissionInput) {
					t.Fatal("old version", err)
				}
			}
			if _, err = s.CompleteBoss(ctx, u.ID, "airport-crisis", []string{"hello there good morning"}, engine.ConversationRulesVersion); err == nil {
				t.Fatal("incomplete dialogue accepted")
			}
			second := s
			if url != "" {
				second, err = New(url)
				if err != nil {
					t.Fatal(err)
				}
				defer second.Close()
			}
			var wg sync.WaitGroup
			failures := make(chan error, 8)
			for i := 0; i < 8; i++ {
				wg.Add(1)
				go func(i int) {
					defer wg.Done()
					st := s
					if i%2 == 1 {
						st = second
					}
					r, e := st.CompleteBoss(ctx, u.ID, "airport-crisis", messages, engine.ConversationRulesVersion)
					if e == nil && !reflect.DeepEqual(r.Receipt.Messages, messages) {
						e = errors.New("actual transcript not retained")
					}
					failures <- e
				}(i)
			}
			wg.Wait()
			close(failures)
			for e := range failures {
				if e != nil {
					t.Fatal(e)
				}
			}
			after, _ := s.GetUser(ctx, u.ID)
			if after.XP-before.XP != 150 {
				t.Fatalf("reward repeated or missing: %d", after.XP-before.XP)
			}
			saved, err := second.GetMissionReceipt(ctx, u.ID, "airport-crisis")
			if err != nil || saved.Legacy || saved.Evaluation.Evidence != engine.ConversationEvidence {
				t.Fatal("receipt", saved, err)
			}
			if saved.Preparation == nil || saved.Preparation.RulesVersion != CampaignPracticeRules || len(saved.Preparation.Checkpoints) != 3 {
				t.Fatal("concurrent first clear lost preparation", saved.Preparation)
			}
			saved.Messages[0] = "tampered"
			again, _ := s.GetMissionReceipt(ctx, u.ID, "airport-crisis")
			if again.Messages[0] != messages[0] {
				t.Fatal("mutable memory receipt")
			}
			changed := append([]string{}, messages...)
			changed[0] += " Extra."
			if _, err = s.CompleteBoss(ctx, u.ID, "airport-crisis", changed, engine.ConversationRulesVersion); !errors.Is(err, ErrMissionConflict) {
				t.Fatal("changed payload accepted", err)
			}
			if _, err = s.GetMissionReceipt(ctx, "other-owner", "airport-crisis"); !errors.Is(err, ErrNotFound) {
				t.Fatal("foreign receipt visible", err)
			}
			// A pre-policy dialogue receipt stays readable without fabricated preparation.
			again.Preparation = nil
			err = nil
			if s.db != nil {
				raw, marshalErr := json.Marshal(again)
				if marshalErr != nil {
					t.Fatal(marshalErr)
				}
				_, err = s.db.ExecContext(ctx, `UPDATE player_bosses SET evidence=$3 WHERE user_id=$1 AND boss_id=$2`, u.ID, "airport-crisis", string(raw))
			} else {
				mem := s.progressionMemory()
				mem.mu.Lock()
				mem.receipts[u.ID]["airport-crisis"] = cloneMissionReceipt(again)
				mem.mu.Unlock()
			}
			if err != nil {
				t.Fatal(err)
			}
			oldDialogue, err := s.CompleteBoss(ctx, u.ID, "airport-crisis", messages, engine.ConversationRulesVersion)
			if err != nil || oldDialogue.Receipt.Legacy || oldDialogue.Receipt.Preparation != nil || !reflect.DeepEqual(oldDialogue.Receipt.Messages, messages) {
				t.Fatal("old dialogue upgraded or lost", oldDialogue.Receipt, err)
			}
			// Imported clears stay legacy, without fabricated transcript or a second reward.
			err = nil
			if s.db != nil {
				_, err = s.db.ExecContext(ctx, `INSERT INTO player_bosses(user_id,boss_id,score,reward_xp) VALUES($1,'hotel-reservation',99,180)`, u.ID)
			} else {
				mem := s.progressionMemory()
				mem.mu.Lock()
				mem.bosses[u.ID]["hotel-reservation"] = time.Now()
				mem.mu.Unlock()
			}
			if err != nil {
				t.Fatal(err)
			}
			legacy, err := s.GetMissionReceipt(ctx, u.ID, "hotel-reservation")
			if err != nil || !legacy.Legacy || legacy.Evaluation != nil {
				t.Fatal("legacy upgraded", legacy, err)
			}
			if b := campaignBoss(t, s, u.ID, "hotel-reservation"); !b.Cleared || !b.Unlocked {
				t.Fatal("legacy clear relocked", b)
			}
			if _, err = s.CompleteBoss(ctx, u.ID, "hotel-reservation", nil, engine.ConversationRulesVersion); err != nil {
				t.Fatal("legacy retry", err)
			}
			end, _ := s.GetUser(ctx, u.ID)
			if end.XP != after.XP {
				t.Fatal("legacy replay rewarded")
			}
			if s.db != nil {
				var count int
				if err = s.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM attempts WHERE user_id=$1 AND activity LIKE 'npc-conversation%'`, u.ID).Scan(&count); err != nil || count != 0 {
					t.Fatal("per-turn attempts created", count, err)
				}
			}
		})
	}
}
