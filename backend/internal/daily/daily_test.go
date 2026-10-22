package daily

import (
	"github.com/Loccao102/LocCaoEnglish/backend/internal/model"
	"reflect"
	"testing"
	"time"
)

func TestDayBoundsAndStableReachablePlans(t *testing.T) {
	before := time.Date(2026, 10, 20, 16, 59, 59, 0, time.UTC)
	if Day(before) != "2026-10-20" || Day(before.Add(time.Second)) != "2026-10-21" {
		t.Fatal("UTC+7 rollover")
	}
	start, end, e := Bounds("2026-10-21")
	if e != nil || start != time.Date(2026, 10, 20, 17, 0, 0, 0, time.UTC) || end.Sub(start) != 24*time.Hour {
		t.Fatal(start, end, e)
	}
	for _, day := range []string{"2026-2-01", "2026-02-30", "invalid", "0000-01-01"} {
		if _, _, e := Bounds(day); e == nil {
			t.Fatal("bad day", day)
		}
	}
	skills := []model.Skill{{Name: "Grammar", Confidence: .2}, {Name: "Vocabulary", Confidence: .2}, {Name: "Writing", Confidence: .1}}
	for _, goal := range []string{"travel", "work", "conversation", "ielts", ""} {
		p := Build("2026-10-21", skills, model.PlayerProfile{Goal: goal}, before)
		if Validate(p) != nil {
			t.Fatal(goal, p)
		}
		other := Build(p.Date, []model.Skill{skills[2], skills[1], skills[0]}, model.PlayerProfile{Goal: goal}, before)
		if !reflect.DeepEqual(p, other) {
			t.Fatal("tie order changes plan", goal)
		}
	}
	p := Build("2026-10-21", skills, model.PlayerProfile{}, before)
	p.Quests[0].Complete = true
	if Validate(p) == nil {
		t.Fatal("saved completion trusted")
	}
	p = Build("2026-10-21", skills, model.PlayerProfile{}, before)
	p.RulesVersion = "future"
	if Validate(p) == nil {
		t.Fatal("unknown plan version")
	}
}
