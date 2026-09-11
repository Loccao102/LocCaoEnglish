package engine

import (
	"fmt"
	"strings"

	"github.com/Loccao102/LocCaoEnglish/backend/internal/model"
)

func BuildPlanForProfile(skills []model.Skill, reviews []model.ReviewItem, profile model.PlayerProfile) model.DailyPlan {
	base:=BuildPlan(skills,reviews)
	if !profile.Onboarded { return base }
	goal:=goalQuest(profile)
	items:=append([]model.PlanItem{goal},base.Items...)
	seen:=map[string]bool{};dedup:=make([]model.PlanItem,0,len(items));for _,item:=range items{key:=item.Route+"|"+item.Activity;if seen[key]{continue};seen[key]=true;dedup=append(dedup,item)}
	target:=profile.DailyMinutes;if target<5{target=15};picked:=make([]model.PlanItem,0,4);total,xp:=0,0;for _,item:=range dedup{if len(picked)>=4{break};picked=append(picked,item);total+=item.Minutes;xp+=item.XP;if total>=target{break}}
	base.Items=picked;base.TotalMins=total;base.PotentialXP=xp;base.Focus=fmt.Sprintf("%s build · %s",strings.Title(profile.Goal),base.Focus);return base
}

func goalQuest(profile model.PlayerProfile) model.PlanItem {
	switch profile.Goal {
	case "ielts":
		return model.PlanItem{ID:"goal-ielts",Title:"Climb one IELTS Tower floor",Skill:"IELTS",Activity:"Challenge mode",Reason:fmt.Sprintf("Your target is band %.1f. Keep all four skills moving, not just your strongest one.",profile.TargetBand),Minutes:15,XP:45,Route:"/ielts",Priority:0}
	case "travel":
		return model.PlanItem{ID:"goal-travel",Title:"Travel survival mission",Skill:"Speaking",Activity:"Scenario mission",Reason:"Your build prioritizes travel English, so today starts with language you can use under pressure.",Minutes:12,XP:45,Route:"/missions/airport",Priority:0}
	case "work":
		return model.PlanItem{ID:"goal-work",Title:"Workplace speaking sprint",Skill:"Speaking",Activity:"Professional response",Reason:"Your build prioritizes practical English for meetings, interviews and collaboration.",Minutes:10,XP:40,Route:"/speaking",Priority:0}
	default:
		return model.PlanItem{ID:"goal-conversation",Title:"Conversation combo",Skill:"Speaking",Activity:"Speak & respond",Reason:"Your build prioritizes comfortable everyday conversation, so speaking appears early in the run.",Minutes:9,XP:40,Route:"/speaking",Priority:0}
	}
}
