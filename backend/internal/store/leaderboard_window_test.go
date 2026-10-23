package store

import (
	"context"
	"fmt"
	"reflect"
	"sort"
	"testing"
)

func TestCheckedLeaderboardWindowDoesNotEraseOwnerReceipt(t *testing.T) {
	ctx := context.Background()
	s, err := New("") // Isolated memory store; never connects to player data.
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(s.Close)
	ids := make([]string, 0, 25)
	attemptIDs := make(map[string]string, 25)
	for i := 0; i < 25; i++ {
		u, err := s.CreateUser(ctx, fmt.Sprintf("leader-window-%02d@example.test", i), "hash", fmt.Sprintf("Window learner %02d", i))
		if err != nil {
			t.Fatal(err)
		}
		a, answer := campaignRound(t, s, u.ID, "word-link", "window-round", "window-item")
		result := campaignSubmit(t, s, u.ID, a, answer)
		if !result.Correct || !result.ProgressionApplied || result.XPDelta != 20 {
			t.Fatalf("real round did not earn checked XP: %+v", result)
		}
		ids = append(ids, u.ID)
		attemptIDs[u.ID] = a.ID
	}
	sort.Strings(ids)

	all, err := s.TopUsers(ctx, 100)
	if err != nil {
		t.Fatal(err)
	}
	if len(all) != len(ids) {
		t.Fatalf("larger window should include all 25 checked learners, got %d", len(all))
	}
	for i, row := range all {
		if row.UserID != ids[i] || row.Rank != i+1 || row.XP != 20 {
			t.Fatalf("equal checked totals must rank by user ID: row %d = %+v", i, row)
		}
	}
	for _, limit := range []int{0, 20} {
		window, err := s.TopUsers(ctx, limit)
		if err != nil {
			t.Fatal(err)
		}
		if len(window) != 20 || !reflect.DeepEqual(window, all[:20]) {
			t.Fatalf("limit %d must return only the first 20 checked learners, got %+v", limit, window)
		}
		for _, row := range window {
			if row.UserID == ids[24] {
				t.Fatal("the 25th tied learner unexpectedly entered the top-20 window")
			}
		}
	}

	// A finite public ranking is not an owner receipt lookup. A learner can
	// retain a fully saved reward while being absent from the displayed window.
	owner := ids[24]
	receipt, err := s.GetLearningAttempt(ctx, owner, attemptIDs[owner])
	if err != nil {
		t.Fatal(err)
	}
	if receipt.UserID != owner || receipt.Status != "completed" || !receipt.Correct || !receipt.ProgressionApplied || receipt.XPDelta != 20 || receipt.CompletedAt.IsZero() {
		t.Fatalf("owner outside the top 20 lost its checked receipt: %+v", receipt)
	}
	u, err := s.GetUser(ctx, owner)
	if err != nil {
		t.Fatal(err)
	}
	if u.XP != 20 {
		t.Fatalf("owner outside the top 20 lost personal XP: %d", u.XP)
	}
}
