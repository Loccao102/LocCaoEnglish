package engine

import (
	"fmt"
	"sort"

	"github.com/Loccao102/LocCaoEnglish/backend/internal/model"
)

func BuildPlan(skills []model.Skill, reviews []model.ReviewItem) model.DailyPlan {
	ordered := append([]model.Skill(nil), skills...)
	sort.Slice(ordered, func(i, j int) bool { return ordered[i].Confidence < ordered[j].Confidence })
	items := make([]model.PlanItem, 0, 5)
	for i, skill := range ordered {
		if i >= 3 { break }
		activity, route, mins := prescription(skill.Name)
		items = append(items, model.PlanItem{ID: fmt.Sprintf("weak-%d", i), Title: activity, Skill: skill.Name, Activity: activity, Reason: fmt.Sprintf("%s confidence is %.0f%%, one of your weakest areas.", skill.Name, skill.Confidence*100), Minutes: mins, XP: 30 + i*5, Route: route, Priority: i + 1})
	}
	if len(reviews) > 0 {
		count := len(reviews); if count > 12 { count = 12 }
		items = append([]model.PlanItem{{ID:"review-due",Title:fmt.Sprintf("Review %d due items",count),Skill:"Memory",Activity:"Spaced review",Reason:"These items are due in your adaptive review queue.",Minutes:5+count/2,XP:20+count,Route:"/review",Priority:0}},items...)
	}
	total,xp:=0,0;for _,item:=range items{total+=item.Minutes;xp+=item.XP}
	focus:="Balanced practice";if len(ordered)>0{focus=ordered[0].Name+" recovery"}
	return model.DailyPlan{Focus:focus,TotalMins:total,PotentialXP:xp,Items:items}
}

func prescription(skill string)(string,string,int){switch skill{case "Speaking":return "Shadow & respond","/speaking",7;case "Writing":return "IELTS micro-writing","/ielts",10;case "Dictation":return "Dictation Rush","/dictation",6;case "Listening":return "Listen & reconstruct","/dictation",7;case "Vocabulary":return "Word Link","/games/word-link",6;case "Reading":return "Reading sprint","/games",8;case "Grammar":return "Sentence repair","/games",7};return "Focused practice","/games",7}
