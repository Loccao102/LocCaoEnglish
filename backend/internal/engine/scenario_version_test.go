package engine

import (
	"errors"
	"testing"
)

func TestConversationRulesV3AddsOnlyAuthoredParaphrases(t *testing.T) {
	cases := []struct {
		name  string
		boss  string
		lines []string
	}{
		{
			name: "departure time",
			boss: "city-transit",
			lines: []string{
				"I need to get to Central station.",
				"Which line is the fastest route?",
				"Could you tell me the departure time?",
			},
		},
		{
			name: "day and time proposal",
			boss: "weekend-plans",
			lines: []string{
				"How about visiting the museum?",
				"How about Sunday afternoon?",
				"Sounds good, see you there.",
			},
		},
		{
			name: "explicit misunderstanding",
			boss: "repair-misunderstanding",
			lines: []string{
				"I misunderstood your cancellation message.",
				"What I meant is that I can arrive later.",
				"Got it, now I understand.",
			},
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			old, err := EvaluateBossConversationForVersion(tc.boss, tc.lines, ConversationRulesVersion)
			if err != nil {
				t.Fatal(err)
			}
			if old.Complete {
				t.Fatalf("v2 unexpectedly accepted v3 paraphrase: %+v", old)
			}
			latest, err := EvaluateBossConversationForVersion(tc.boss, tc.lines, LatestConversationRulesVersion)
			if err != nil {
				t.Fatal(err)
			}
			if !latest.Complete || latest.RulesVersion != LatestConversationRulesVersion {
				t.Fatalf("v3 did not accept authored paraphrase: %+v", latest)
			}
		})
	}
}

func TestConversationRulesV3RejectsNegatedParaphrases(t *testing.T) {
	cases := []struct {
		boss  string
		lines []string
	}{
		{
			boss: "city-transit",
			lines: []string{
				"I need to get to Central station.",
				"Which line is the fastest route?",
				"Could you tell me the departure time? I do not need to check it.",
			},
		},
		{
			boss: "weekend-plans",
			lines: []string{
				"How about visiting the museum?",
				"How about not meeting on Sunday afternoon?",
				"Sounds good, see you there.",
			},
		},
		{
			boss: "repair-misunderstanding",
			lines: []string{
				"I never misunderstood your cancellation message.",
				"What I meant is that I can arrive later.",
				"Got it, now I understand.",
			},
		},
	}
	for _, tc := range cases {
		t.Run(tc.boss, func(t *testing.T) {
			got, err := EvaluateBossConversationForVersion(tc.boss, tc.lines, LatestConversationRulesVersion)
			if err != nil {
				t.Fatal(err)
			}
			if got.Complete {
				t.Fatalf("negated paraphrase cleared mission: %+v", got)
			}
		})
	}
}

func TestConversationRulesV3AcceptsDirectDepartureQuestion(t *testing.T) {
	lines := []string{
		"I need to get to Central station.",
		"Which line is the fastest route?",
		"What is the departure time?",
	}
	got, err := EvaluateBossConversationForVersion("city-transit", lines, LatestConversationRulesVersion)
	if err != nil {
		t.Fatal(err)
	}
	if !got.Complete {
		t.Fatalf("natural departure-time question rejected: %+v", got)
	}
}

func TestConversationRulesVersionValidation(t *testing.T) {
	if !SupportedConversationRulesVersion(ConversationRulesVersion) || !SupportedConversationRulesVersion(LatestConversationRulesVersion) {
		t.Fatal("supported conversation rules version rejected")
	}
	if SupportedConversationRulesVersion("conversation.future") {
		t.Fatal("future conversation rules version accepted")
	}
	if err := ValidateConversationForVersion("airport-crisis", nil, "conversation.future"); !errors.Is(err, ErrUnsupportedConversationRules) {
		t.Fatalf("unsupported version error = %v", err)
	}
}
