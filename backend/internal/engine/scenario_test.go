package engine

import "testing"

func TestAirportBossNeedsObjectivesNotJustTurns(t *testing.T) {
	bad := EvaluateBossConversation("airport-crisis", []string{"hello", "hello again", "thanks"})
	if bad.Complete { t.Fatal("three empty turns must not clear the boss") }
	good := EvaluateBossConversation("airport-crisis", []string{
		"I missed my flight this afternoon.",
		"Could you rebook me on the earliest next flight?",
		"Yes please, book it. Which gate should I use?",
	})
	if !good.Complete || good.Score != 100 { t.Fatalf("expected complete airport mission, got %+v", good) }
}

func TestHotelAndTransitObjectives(t *testing.T) {
	hotel := EvaluateBossConversation("hotel-reservation", []string{
		"My reservation cannot be found.",
		"The confirmation number is 4821 and it is under my name.",
		"Could you also tell me whether breakfast is included?",
	})
	if !hotel.Complete { t.Fatalf("hotel should complete: %+v", hotel) }
	transit := EvaluateBossConversation("city-transit", []string{
		"I need to get to Central Station before the last train.",
		"What is the fastest route and where do I change lines?",
		"Which platform do I need, and how many minutes do I have?",
	})
	if !transit.Complete { t.Fatalf("transit should complete: %+v", transit) }
}
