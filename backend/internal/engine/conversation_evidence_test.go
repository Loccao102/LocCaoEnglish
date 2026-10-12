package engine

import (
	"strings"
	"testing"
)

func TestOrderedMissionRubrics(t *testing.T) {
	cases := map[string][]string{
		"airport-crisis":          {"I missed my flight this afternoon.", "Could you rebook me on the next flight?", "Yes please, book it. Which gate should I use?"},
		"hotel-reservation":       {"My confirmed reservation is missing.", "My confirmation number is ABC123.", "What time is breakfast tomorrow?"},
		"city-transit":            {"I need to get to Central station.", "Which line is the fastest route?", "Which platform does the train leave from?"},
		"cafe-connection":         {"Hi, my name is Loc.", "What do you enjoy doing?", "It was nice to meet you."},
		"weekend-plans":           {"How about visiting the museum?", "Let's meet at ten on Saturday.", "Sounds good, see you there."},
		"repair-misunderstanding": {"Sorry, I did not understand.", "What I meant is that I can arrive later.", "Got it, now I understand."},
		"daily-standup":           {"Yesterday I finished the login fix.", "Today I will add tests.", "I have no blockers today."},
		"requirement-clarity":     {"The search requirement is unclear.", "What exactly should happen for empty results?", "So the requirement is to show suggestions for empty results."},
		"deadline-negotiation":    {"There is not enough time to deliver the full feature by Friday.", "Cutting testing would hurt quality.", "I propose a phased delivery: the MVP Friday and reports next week."},
	}
	for id, lines := range cases {
		t.Run(id, func(t *testing.T) {
			good := EvaluateBossConversation(id, lines)
			if !good.Complete || good.Stage != 3 || good.Evidence != ConversationEvidence || len(good.Turns) != 3 {
				t.Fatalf("valid conversation: %+v", good)
			}
			reversed := []string{lines[2], lines[1], lines[0]}
			if got := EvaluateBossConversation(id, reversed); got.Complete || got.Stage != 1 {
				t.Fatalf("retroactive credit: %+v", got)
			}
			stuffed := strings.Join(lines, " ")
			if got := EvaluateBossConversation(id, []string{stuffed, stuffed, stuffed}); got.Stage > 1 {
				t.Fatalf("repeated stuffing: %+v", got)
			}
			if got := EvaluateBossConversation(id, []string{"hello hello hello hello", lines[0], lines[1], lines[2]}); !got.Complete || got.Turns[0].Accepted {
				t.Fatalf("recovery after irrelevant input: %+v", got)
			}
		})
	}
}
func TestMissionRejectsContradictionsAndKeywordOnlyAnswers(t *testing.T) {
	for _, lines := range [][]string{
		{"missed rebook boarding"},
		{"I did not miss my flight.", "Could you rebook me on the next flight?", "Yes please, book it. Which gate should I use?"},
		{"I missed my flight today.", "I do not want another flight please.", "Yes please, book it. Which gate should I use?"},
		{"I missed my flight today.", "Could you rebook me on another flight?", "I don't want to take it or board the flight."},
	} {
		if got := EvaluateBossConversation("airport-crisis", lines); got.Complete {
			t.Fatalf("contradictory transcript cleared: %+v", got)
		}
	}
	for _, lines := range [][]string{{""}, {strings.Repeat("a", 1025)}, make([]string, 25)} {
		if ValidateConversation("airport-crisis", lines) == nil {
			t.Fatal("invalid input accepted")
		}
	}
	if ValidateConversation("unknown", nil) == nil || EvaluateBossConversation("unknown", nil).Complete {
		t.Fatal("unknown mission")
	}
}
