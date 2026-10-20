package writing

import (
	"math"
	"testing"
)

func TestFeedbackRequiresActualEvidenceAndCompleteFiniteBands(t *testing.T) {
	essay := "Public transport can support workers."
	makeFeedback := func() Feedback {
		zero := 0.0
		f := Feedback{Provider: "configured-llm", Model: "test", EvaluatorVersion: EvaluatorVersion, RulesVersion: RulesVersion, Overall: &zero, Criteria: map[string]Criterion{}, Strengths: []string{"Topic identified."}, Improvements: []string{"Explain why."}}
		for _, key := range Criteria {
			f.Criteria[key] = Criterion{Band: &zero, Evidence: "Public transport", Comment: "Develop this idea."}
		}
		return f
	}
	if err := ValidateFeedback(makeFeedback(), essay); err != nil {
		t.Fatal("real zero rejected", err)
	}
	cases := map[string]func(*Feedback){
		"missing overall": func(f *Feedback) { f.Overall = nil },
		"infinite":        func(f *Feedback) { v := math.Inf(1); f.Overall = &v },
		"not half":        func(f *Feedback) { v := 6.2; f.Overall = &v },
		"invented quote": func(f *Feedback) {
			c := f.Criteria[Criteria[0]]
			c.Evidence = "not in essay"
			f.Criteria[Criteria[0]] = c
		},
		"missing criterion":    func(f *Feedback) { delete(f.Criteria, Criteria[0]) },
		"missing band":         func(f *Feedback) { c := f.Criteria[Criteria[0]]; c.Band = nil; f.Criteria[Criteria[0]] = c },
		"fake provider":        func(f *Feedback) { f.Provider = "local-heuristic" },
		"wrong rubric":         func(f *Feedback) { f.RulesVersion = "future" },
		"empty advice":         func(f *Feedback) { f.Improvements = []string{" "} },
		"inconsistent overall": func(f *Feedback) { v := 6.0; f.Overall = &v },
	}
	for name, change := range cases {
		t.Run(name, func(t *testing.T) {
			f := makeFeedback()
			change(&f)
			if ValidateFeedback(f, essay) == nil {
				t.Fatal("accepted invalid feedback")
			}
		})
	}
}
