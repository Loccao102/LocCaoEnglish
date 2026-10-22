package store

import (
	"time"

	"github.com/Loccao102/LocCaoEnglish/backend/internal/model"
)

type campaignBuild struct {
	World        model.WorldState
	Bosses       []model.BossState
	Achievements []model.Achievement
	Cosmetics    []model.Cosmetic
}

func buildTravelCampaign(user model.User, profile model.PlayerProfile, done map[string]*time.Time, practice map[string]CampaignPracticeEvidence) campaignBuild {
	airportAt, airportDone := done["airport-crisis"]
	hotelAt, hotelDone := done["hotel-reservation"]
	transitAt, transitDone := done["city-transit"]
	airportVocab := campaignCheckpointReady("airport-vocab", "airport-crisis", done, practice)
	airportListen := campaignCheckpointReady("airport-listening", "airport-crisis", done, practice)
	airportSpeak := campaignCheckpointReady("airport-speaking", "airport-crisis", done, practice)
	hotelRead := campaignCheckpointReady("hotel-reading", "hotel-reservation", done, practice)
	hotelGrammar := campaignCheckpointReady("hotel-grammar", "hotel-reservation", done, practice)
	hotelSpeak := campaignCheckpointReady("hotel-speaking", "hotel-reservation", done, practice)
	transitVocab := campaignCheckpointReady("transit-vocab", "city-transit", done, practice)
	transitListen := campaignCheckpointReady("transit-listening", "city-transit", done, practice)
	transitSpeak := campaignCheckpointReady("transit-speaking", "city-transit", done, practice)
	worldOpen := profile.Goal == "travel" || user.XP >= 150
	airport := model.BossState{ID: "airport-crisis", Title: "Missed Flight", WorldID: "travel", Route: "/missions/airport", Unlocked: campaignGateOpen("airport-crisis", user, profile, done, practice), Cleared: airportDone, RewardXP: campaignGates["airport-crisis"].RewardXP, CompletedAt: airportAt, Checkpoints: []model.BossCheckpoint{{ID: "airport-vocab", Title: "Build airport vocabulary", Skill: "Vocabulary", Route: "/games/word-link?pack=travel-airport", Complete: airportVocab}, {ID: "airport-listening", Title: "Understand a gate announcement", Skill: "Listening", Route: "/listening?pack=travel-airport", Complete: airportListen}, {ID: "airport-speaking", Title: "Explain the problem clearly", Skill: "Speaking", Route: "/speaking?pack=travel-airport", Complete: airportSpeak}}}
	hotel := model.BossState{ID: "hotel-reservation", Title: "Reservation Missing", WorldID: "travel", Route: "/missions/hotel", Unlocked: campaignGateOpen("hotel-reservation", user, profile, done, practice), Cleared: hotelDone, RewardXP: campaignGates["hotel-reservation"].RewardXP, CompletedAt: hotelAt, Checkpoints: []model.BossCheckpoint{{ID: "hotel-reading", Title: "Read the booking situation", Skill: "Reading", Route: "/games/story-choice", Complete: hotelRead}, {ID: "hotel-grammar", Title: "Repair polite requests", Skill: "Grammar", Route: "/games/grammar-repair?pack=travel-hotel", Complete: hotelGrammar}, {ID: "hotel-speaking", Title: "Practise a calm request", Skill: "Speaking", Route: "/speaking?pack=travel-hotel", Complete: hotelSpeak}}}
	transit := model.BossState{ID: "city-transit", Title: "Last Train Transfer", WorldID: "travel", Route: "/missions/transit", Unlocked: campaignGateOpen("city-transit", user, profile, done, practice), Cleared: transitDone, RewardXP: campaignGates["city-transit"].RewardXP, CompletedAt: transitAt, Checkpoints: []model.BossCheckpoint{{ID: "transit-vocab", Title: "Build transport collocations", Skill: "Vocabulary", Route: "/games/collocation-factory?pack=travel-transit", Complete: transitVocab}, {ID: "transit-listening", Title: "Catch platform information", Skill: "Listening", Route: "/listening?pack=travel-transit", Complete: transitListen}, {ID: "transit-speaking", Title: "Ask for directions naturally", Skill: "Speaking", Route: "/speaking?pack=travel-transit", Complete: transitSpeak}}}
	bosses := []model.BossState{airport, hotel, transit}
	cleared := boolInt(airportDone) + boolInt(hotelDone) + boolInt(transitDone)
	ready := countReady(airport.Checkpoints) + countReady(hotel.Checkpoints) + countReady(transit.Checkpoints)
	progress := minInt(100, cleared*25+ready*8)
	if transitDone {
		progress = 100
	}
	return campaignBuild{World: model.WorldState{ID: "travel", Title: "Travel District", Description: "Airport, hotel and city-transit survival English in a three-chapter campaign.", Route: "/travel", Icon: "✈", Unlocked: worldOpen, Progress: progress, UnlockText: "Choose Travel as your goal or reach 150 XP"}, Bosses: bosses, Achievements: []model.Achievement{{ID: "airport-survivor", Title: "Airport Survivor", Description: "Clear the Missed Flight boss.", Icon: "✈", Unlocked: airportDone, Progress: boolInt(airportDone), Target: 1, RewardCosmetic: "airport-wings"}, {ID: "hotel-diplomat", Title: "Hotel Diplomat", Description: "Resolve a missing reservation politely.", Icon: "◆", Unlocked: hotelDone, Progress: boolInt(hotelDone), Target: 1, RewardCosmetic: "hotel-title"}, {ID: "city-navigator", Title: "City Navigator", Description: "Clear the Last Train Transfer boss.", Icon: "◎", Unlocked: transitDone, Progress: boolInt(transitDone), Target: 1, RewardCosmetic: "city-frame"}, {ID: "travel-master", Title: "Travel District Master", Description: "Clear all three Travel District bosses.", Icon: "♛", Unlocked: transitDone, Progress: cleared, Target: 3, RewardCosmetic: "passport-aura"}}, Cosmetics: []model.Cosmetic{{ID: "airport-wings", Name: "Airport Wings", Slot: "badge", Description: "Boss trophy for surviving a missed-flight negotiation.", Unlocked: airportDone}, {ID: "hotel-title", Name: "Hotel Diplomat", Slot: "title", Description: "A title earned by resolving a reservation problem politely.", Unlocked: hotelDone}, {ID: "city-frame", Name: "City Navigator Frame", Slot: "frame", Description: "A transit-map frame earned after the final Travel chapter.", Unlocked: transitDone}, {ID: "passport-aura", Name: "Passport Aura", Slot: "aura", Description: "Travel District mastery aura for clearing all three chapters.", Unlocked: transitDone}}}
}

func buildConversationCampaign(user model.User, profile model.PlayerProfile, done map[string]*time.Time, practice map[string]CampaignPracticeEvidence) campaignBuild {
	cafeAt, cafeDone := done["cafe-connection"]
	plansAt, plansDone := done["weekend-plans"]
	repairAt, repairDone := done["repair-misunderstanding"]
	cafeVocab := campaignCheckpointReady("cafe-vocab", "cafe-connection", done, practice)
	cafeListen := campaignCheckpointReady("cafe-listen", "cafe-connection", done, practice)
	cafeSpeak := campaignCheckpointReady("cafe-speak", "cafe-connection", done, practice)
	plansGrammar := campaignCheckpointReady("plans-grammar", "weekend-plans", done, practice)
	plansListen := campaignCheckpointReady("plans-listen", "weekend-plans", done, practice)
	plansSpeak := campaignCheckpointReady("plans-speak", "weekend-plans", done, practice)
	repairGrammar := campaignCheckpointReady("repair-grammar", "repair-misunderstanding", done, practice)
	repairVocab := campaignCheckpointReady("repair-vocab", "repair-misunderstanding", done, practice)
	repairSpeak := campaignCheckpointReady("repair-speak", "repair-misunderstanding", done, practice)
	worldOpen := profile.Goal == "conversation" || user.XP >= 250
	cafe := model.BossState{ID: "cafe-connection", Title: "Break the Ice", WorldID: "conversation", Route: "/missions/cafe", Unlocked: campaignGateOpen("cafe-connection", user, profile, done, practice), Cleared: cafeDone, RewardXP: campaignGates["cafe-connection"].RewardXP, CompletedAt: cafeAt, Checkpoints: []model.BossCheckpoint{{ID: "cafe-vocab", Title: "Build natural social phrases", Skill: "Vocabulary", Route: "/games/collocation-factory?pack=conversation-cafe", Complete: cafeVocab}, {ID: "cafe-listen", Title: "Catch everyday details", Skill: "Listening", Route: "/listening?pack=conversation-cafe", Complete: cafeListen}, {ID: "cafe-speak", Title: "Warm up your delivery", Skill: "Speaking", Route: "/speaking?pack=conversation-cafe", Complete: cafeSpeak}}}
	plans := model.BossState{ID: "weekend-plans", Title: "Make the Plan", WorldID: "conversation", Route: "/missions/plans", Unlocked: campaignGateOpen("weekend-plans", user, profile, done, practice), Cleared: plansDone, RewardXP: campaignGates["weekend-plans"].RewardXP, CompletedAt: plansAt, Checkpoints: []model.BossCheckpoint{{ID: "plans-grammar", Title: "Build suggestion patterns", Skill: "Grammar", Route: "/games/sentence-builder?pack=conversation-plans", Complete: plansGrammar}, {ID: "plans-listen", Title: "Catch time and preference", Skill: "Listening", Route: "/listening?pack=conversation-plans", Complete: plansListen}, {ID: "plans-speak", Title: "Practise natural rhythm", Skill: "Speaking", Route: "/speaking?pack=conversation-plans", Complete: plansSpeak}}}
	repair := model.BossState{ID: "repair-misunderstanding", Title: "Repair the Misunderstanding", WorldID: "conversation", Route: "/missions/misunderstanding", Unlocked: campaignGateOpen("repair-misunderstanding", user, profile, done, practice), Cleared: repairDone, RewardXP: campaignGates["repair-misunderstanding"].RewardXP, CompletedAt: repairAt, Checkpoints: []model.BossCheckpoint{{ID: "repair-grammar", Title: "Control clarification grammar", Skill: "Grammar", Route: "/games/grammar-repair?pack=conversation-clarity", Complete: repairGrammar}, {ID: "repair-vocab", Title: "Build clarification phrases", Skill: "Vocabulary", Route: "/games/collocation-factory?pack=conversation-clarity", Complete: repairVocab}, {ID: "repair-speak", Title: "Practise calm rephrasing", Skill: "Speaking", Route: "/speaking?pack=conversation-clarity", Complete: repairSpeak}}}
	bosses := []model.BossState{cafe, plans, repair}
	cleared := boolInt(cafeDone) + boolInt(plansDone) + boolInt(repairDone)
	ready := countReady(cafe.Checkpoints) + countReady(plans.Checkpoints) + countReady(repair.Checkpoints)
	progress := minInt(100, cleared*25+ready*8)
	if repairDone {
		progress = 100
	}
	return campaignBuild{World: model.WorldState{ID: "conversation", Title: "Conversation District", Description: "Small talk, making plans and repairing misunderstandings through social role-play.", Route: "/conversation", Icon: "☏", Unlocked: worldOpen, Progress: progress, UnlockText: "Choose Conversation as your goal or reach 250 XP"}, Bosses: bosses, Achievements: []model.Achievement{{ID: "first-connection", Title: "First Connection", Description: "Clear Break the Ice.", Icon: "☕", Unlocked: cafeDone, Progress: boolInt(cafeDone), Target: 1, RewardCosmetic: "social-spark"}, {ID: "plan-maker", Title: "Plan Maker", Description: "Make and confirm a weekend plan.", Icon: "⌁", Unlocked: plansDone, Progress: boolInt(plansDone), Target: 1, RewardCosmetic: "planner-title"}, {ID: "clarity-keeper", Title: "Clarity Keeper", Description: "Repair a misunderstanding without abandoning the conversation.", Icon: "↔", Unlocked: repairDone, Progress: boolInt(repairDone), Target: 1, RewardCosmetic: "clarity-aura"}, {ID: "conversation-master", Title: "Conversation District Master", Description: "Clear all three social chapters.", Icon: "♛", Unlocked: repairDone, Progress: cleared, Target: 3, RewardCosmetic: "conversation-frame"}}, Cosmetics: []model.Cosmetic{{ID: "social-spark", Name: "Social Spark", Slot: "badge", Description: "A badge for starting and sustaining a new conversation.", Unlocked: cafeDone}, {ID: "planner-title", Name: "Plan Maker", Slot: "title", Description: "A title for turning a suggestion into a clear plan.", Unlocked: plansDone}, {ID: "clarity-aura", Name: "Clarity Aura", Slot: "aura", Description: "Earned by clarifying meaning instead of giving up.", Unlocked: repairDone}, {ID: "conversation-frame", Name: "Conversation Frame", Slot: "frame", Description: "Mastery frame for clearing the whole Conversation District.", Unlocked: repairDone}}}
}
