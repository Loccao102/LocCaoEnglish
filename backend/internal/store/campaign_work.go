package store

import (
	"github.com/Loccao102/LocCaoEnglish/backend/internal/model"
	"time"
)

func buildWorkCampaign(user model.User, profile model.PlayerProfile, done map[string]*time.Time, practice map[string]CampaignPracticeEvidence) campaignBuild {
	standupAt, standupDone := done["daily-standup"]
	requirementAt, requirementDone := done["requirement-clarity"]
	deadlineAt, deadlineDone := done["deadline-negotiation"]
	standupGrammar := campaignCheckpointReady("standup-grammar", "daily-standup", done, practice)
	standupVocab := campaignCheckpointReady("standup-vocab", "daily-standup", done, practice)
	standupSpeak := campaignCheckpointReady("standup-speak", "daily-standup", done, practice)
	reqListen := campaignCheckpointReady("req-listen", "requirement-clarity", done, practice)
	reqGrammar := campaignCheckpointReady("req-grammar", "requirement-clarity", done, practice)
	reqSpeak := campaignCheckpointReady("req-speak", "requirement-clarity", done, practice)
	deadlineVocab := campaignCheckpointReady("deadline-vocab", "deadline-negotiation", done, practice)
	deadlineGrammar := campaignCheckpointReady("deadline-grammar", "deadline-negotiation", done, practice)
	deadlineSpeak := campaignCheckpointReady("deadline-speak", "deadline-negotiation", done, practice)
	worldOpen := profile.Goal == "work" || user.XP >= 500
	standup := model.BossState{ID: "daily-standup", Title: "Stand-up Under Pressure", WorldID: "work", Route: "/missions/standup", Unlocked: campaignGateOpen("daily-standup", user, profile, done, practice), Cleared: standupDone, RewardXP: campaignGates["daily-standup"].RewardXP, CompletedAt: standupAt, Checkpoints: []model.BossCheckpoint{{ID: "standup-grammar", Title: "Build concise update sentences", Skill: "Grammar", Route: "/games/sentence-builder?pack=work-standup", Complete: standupGrammar}, {ID: "standup-vocab", Title: "Build work collocations", Skill: "Vocabulary", Route: "/games/collocation-factory?pack=work-standup", Complete: standupVocab}, {ID: "standup-speak", Title: "Practise a clear delivery", Skill: "Speaking", Route: "/speaking?pack=work-standup", Complete: standupSpeak}}}
	requirements := model.BossState{ID: "requirement-clarity", Title: "Ambiguous Requirement", WorldID: "work", Route: "/missions/requirements", Unlocked: campaignGateOpen("requirement-clarity", user, profile, done, practice), Cleared: requirementDone, RewardXP: campaignGates["requirement-clarity"].RewardXP, CompletedAt: requirementAt, Checkpoints: []model.BossCheckpoint{{ID: "req-listen", Title: "Catch the stakeholder intent", Skill: "Listening", Route: "/listening?pack=work-requirements", Complete: reqListen}, {ID: "req-grammar", Title: "Repair clarification questions", Skill: "Grammar", Route: "/games/grammar-repair?pack=work-requirements", Complete: reqGrammar}, {ID: "req-speak", Title: "Practise precise questions", Skill: "Speaking", Route: "/speaking?pack=work-requirements", Complete: reqSpeak}}}
	deadline := model.BossState{ID: "deadline-negotiation", Title: "Impossible Deadline", WorldID: "work", Route: "/missions/deadline", Unlocked: campaignGateOpen("deadline-negotiation", user, profile, done, practice), Cleared: deadlineDone, RewardXP: campaignGates["deadline-negotiation"].RewardXP, CompletedAt: deadlineAt, Checkpoints: []model.BossCheckpoint{{ID: "deadline-vocab", Title: "Build trade-off language", Skill: "Vocabulary", Route: "/games/collocation-factory?pack=work-deadline", Complete: deadlineVocab}, {ID: "deadline-grammar", Title: "Frame alternatives clearly", Skill: "Grammar", Route: "/games/sentence-builder?pack=work-deadline", Complete: deadlineGrammar}, {ID: "deadline-speak", Title: "Practise calm negotiation", Skill: "Speaking", Route: "/speaking?pack=work-deadline", Complete: deadlineSpeak}}}
	bosses := []model.BossState{standup, requirements, deadline}
	cleared := boolInt(standupDone) + boolInt(requirementDone) + boolInt(deadlineDone)
	ready := countReady(standup.Checkpoints) + countReady(requirements.Checkpoints) + countReady(deadline.Checkpoints)
	progress := minInt(100, cleared*25+ready*8)
	if deadlineDone {
		progress = 100
	}
	return campaignBuild{World: model.WorldState{ID: "work", Title: "Work District", Description: "Stand-ups, requirement clarification and deadline negotiation for professional English.", Route: "/work", Icon: "▣", Unlocked: worldOpen, Progress: progress, UnlockText: "Choose Work as your goal or reach 500 XP"}, Bosses: bosses, Achievements: []model.Achievement{{ID: "standup-ready", Title: "Stand-up Ready", Description: "Deliver a useful stand-up update.", Icon: "▣", Unlocked: standupDone, Progress: boolInt(standupDone), Target: 1, RewardCosmetic: "standup-badge"}, {ID: "requirement-detective", Title: "Requirement Detective", Description: "Turn ambiguity into confirmed acceptance criteria.", Icon: "?", Unlocked: requirementDone, Progress: boolInt(requirementDone), Target: 1, RewardCosmetic: "analyst-title"}, {ID: "deadline-negotiator", Title: "Deadline Negotiator", Description: "Protect quality by proposing a workable trade-off.", Icon: "⌛", Unlocked: deadlineDone, Progress: boolInt(deadlineDone), Target: 1, RewardCosmetic: "delivery-aura"}, {ID: "work-master", Title: "Work District Master", Description: "Clear all three professional communication chapters.", Icon: "♛", Unlocked: deadlineDone, Progress: cleared, Target: 3, RewardCosmetic: "professional-frame"}}, Cosmetics: []model.Cosmetic{{ID: "standup-badge", Name: "Stand-up Ready", Slot: "badge", Description: "Badge for concise progress, plan and blocker reporting.", Unlocked: standupDone}, {ID: "analyst-title", Name: "Requirement Detective", Slot: "title", Description: "Title for asking the questions that remove ambiguity.", Unlocked: requirementDone}, {ID: "delivery-aura", Name: "Delivery Aura", Slot: "aura", Description: "Earned by negotiating scope and time without losing clarity.", Unlocked: deadlineDone}, {ID: "professional-frame", Name: "Professional Frame", Slot: "frame", Description: "Mastery frame for clearing the entire Work District.", Unlocked: deadlineDone}}}
}
