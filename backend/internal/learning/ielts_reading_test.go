package learning

import (
	"encoding/json"
	"reflect"
	"strings"
	"testing"
)

func TestIELTSCatalogAndSelections(t *testing.T) {
	for _, kind := range []string{"reading", "listening"} {
		t.Run(kind, func(t *testing.T) { testIELTSCatalog(t, kind) })
	}
}
func testIELTSCatalog(t *testing.T, kind string) {
	prompt, private, id, version, err := NewIELTSReading()
	catalog, parts, grade := ieltsReadingCatalog, 3, GradeIELTSReading
	if kind == "listening" {
		var transcripts map[string]string
		prompt, private, transcripts, id, version, err = NewIELTSListening()
		catalog, parts, grade = ieltsListeningCatalog, 4, GradeIELTSListening
		if len(transcripts) != 4 {
			t.Fatal("missing transcripts")
		}
		for _, part := range prompt.Sections {
			if part.Passage != "" || transcripts[part.ID] == "" {
				t.Fatal("transcript leaked/missing")
			}
		}
	}
	if err != nil || id == "" || version == "" || len(prompt.Sections) != parts {
		t.Fatal("missing catalog", err)
	}
	count := 0
	seen := map[string]bool{}
	ids := map[string]bool{}
	tuples := [][]string{}
	for i, section := range prompt.Sections {
		if kind == "reading" && section.Passage == "" || section.Title == "" || section.ID == "" {
			t.Fatal("missing section")
		}
		for j, q := range section.Questions {
			count++
			if seen[q.ID] || q.Prompt == "" || len(q.Options) != 4 {
				t.Fatal("invalid question", q.ID)
			}
			seen[q.ID] = true
			matches := 0
			for _, option := range q.Options {
				if len(option.ID) != 16 || ids[option.ID] || option.Text == "" {
					t.Fatal("not opaque unique option", option.ID)
				}
				ids[option.ID] = true
				if option.ID == private.CorrectOptions[q.ID] {
					matches++
					if option.Text != catalog.Sections[i].Questions[j].Answer {
						t.Fatal("wrong extracted answer")
					}
				}
			}
			if matches != 1 {
				t.Fatal("missing unique key")
			}
			tuples = append(tuples, []string{q.ID, private.CorrectOptions[q.ID]})
		}
	}
	if count != 40 {
		t.Fatal("expected 40 questions", count)
	}
	raw, _ := json.Marshal(prompt)
	for _, key := range []string{"correctOptions", "correctOptionId", "answer", "result", "methodVersion"} {
		if strings.Contains(string(raw), `"`+key+`"`) {
			t.Fatal("private field leaked", key)
		}
	}
	other, otherPrivate, _, _, err := NewIELTSReading()
	if kind == "listening" {
		other, otherPrivate, _, _, _, err = NewIELTSListening()
	}
	if err != nil || reflect.DeepEqual(private.CorrectOptions, otherPrivate.CorrectOptions) || reflect.DeepEqual(prompt, other) {
		t.Fatal("IDs reused across independent attempts")
	}
	answer, _ := json.Marshal(tuples)
	if len(answer) > 2048 {
		t.Fatal("full answer does not fit API bound")
	}
	result, err := grade(&prompt, &private, string(answer))
	if err != nil || result.Section != kind || result.RawScore != 40 || result.MaxScore != 40 || result.Percentage != 100 || len(result.Answers) != 40 || result.MethodVersion != IELTSReadingMethodVersion {
		t.Fatal("full result", result, err)
	}
	result, err = grade(&prompt, &private, "[]")
	if err != nil || result.RawScore != 0 || result.Band != 0 {
		t.Fatal("empty result", result, err)
	}
	for _, a := range result.Answers {
		if a.OptionID != "" || a.Correct || a.CorrectOptionID == "" {
			t.Fatal("unanswered grading", a)
		}
	}
	firstID, secondID := prompt.Sections[0].Questions[0].ID, prompt.Sections[0].Questions[1].ID
	wrong := ""
	for _, o := range prompt.Sections[0].Questions[1].Options {
		if o.ID != private.CorrectOptions[secondID] {
			wrong = o.ID
			break
		}
	}
	mixed, _ := json.Marshal([][]string{tuples[0], {secondID, wrong}})
	result, err = grade(&prompt, &private, string(mixed))
	if err != nil || result.RawScore != 1 || result.Answers[1].Correct || result.Answers[2].OptionID != "" {
		t.Fatal("mixed grading", result, err)
	}
	badInputs := []string{"null", "{}", "[null]", "[[]]", "[[\"R1\"]]", "[[\"missing\",\"id\"]]", "[[\"R1\",\"bad\"]]", "[1]", "[[]] true", strings.Repeat(" ", 2049)}
	for _, bad := range [][][]string{{tuples[0], tuples[0]}, {tuples[1], tuples[0]}, {{firstID, private.CorrectOptions[secondID]}}} {
		value, _ := json.Marshal(bad)
		badInputs = append(badInputs, string(value))
	}
	for _, bad := range badInputs {
		if _, err := grade(&prompt, &private, bad); err == nil {
			t.Fatal("invalid selections accepted", bad)
		}
	}
}
