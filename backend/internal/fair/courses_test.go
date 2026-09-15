package fair

import (
	"testing"
	"time"
)

func TestCoursesProgressAndReplay(t *testing.T) {
	save := NewSave()
	for i, course := range courses {
		c := Completion{RunID: "12345678-1234-4123-8123-123456789012", GameID: course.GameID, CourseID: course.ID, Stars: 3, ElapsedMS: 45000}
		if err := Validate(c); err != nil || !CanPlay(save, c) {
			t.Fatalf("course %d unavailable: %v", i, err)
		}
		if i+1 < len(courses) {
			locked := c
			locked.CourseID = courses[i+1].ID
			if CanPlay(save, locked) {
				t.Fatal("future course is open")
			}
		}
		save = Apply(save, c, time.Now())
		c.Stars = 1
		c.Feathers = 3
		c.ElapsedMS = 65000
		save = Apply(save, c, time.Now())
		r := save.Courses[course.ID]
		if r.Medals != 3 || !r.Clean || r.Feathers != 3 || r.BestMS != 45000 || r.Visits != 2 {
			t.Fatalf("bad merged record: %+v", r)
		}
	}
	clone := Clone(save)
	delete(clone.Courses, "cloud-01")
	if len(save.Courses) != 6 {
		t.Fatal("course map was not cloned")
	}
	invalid := Completion{RunID: "12345678-1234-4123-8123-123456789012", GameID: "tea-time", CourseID: "cloud-01", Stars: 3, ElapsedMS: 1}
	if Validate(invalid) == nil {
		t.Fatal("course accepted for wrong game")
	}
	invalid.GameID = "cloud-hop"
	invalid.Feathers = 4
	if Validate(invalid) == nil {
		t.Fatal("impossible feather count accepted")
	}
}
