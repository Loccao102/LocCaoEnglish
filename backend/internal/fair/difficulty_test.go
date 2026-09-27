package fair

import (
	"testing"
	"time"
)

func TestDifficultyRecordsAreSeparateAndCloned(t *testing.T) {
	c := Completion{RunID: "12345678-1234-4123-8123-123456789012", GameID: "tea-time", Stars: 3}
	easy := Apply(NewSave(), c, time.Now())
	c.Difficulty = "expert"
	c.Stars = 1
	if Validate(c) != nil {
		t.Fatal("expert rejected")
	}
	hard := Apply(easy, c, time.Now())
	if len(easy.Games[c.GameID].Levels) != 1 {
		t.Fatal("apply mutated old difficulty records")
	}
	levels := hard.Games[c.GameID].Levels
	if levels["practice"].Stars != 3 || levels["expert"].Stars != 1 || levels["expert"].Visits != 1 {
		t.Fatalf("levels merged: %+v", levels)
	}
	clone := Clone(hard)
	delete(clone.Games[c.GameID].Levels, "expert")
	if len(hard.Games[c.GameID].Levels) != 2 {
		t.Fatal("clone shares nested records")
	}
	c.Difficulty = "invented"
	if Validate(c) == nil {
		t.Fatal("unknown difficulty accepted")
	}
}
