package ielts

import (
	"errors"
	"math"
	"strings"
)

type Anchor struct { Raw int; Band float64 }

type ObjectiveResult struct {
	Section    string  `json:"section"`
	TestType   string  `json:"testType"`
	RawScore   int     `json:"rawScore"`
	MaxScore   int     `json:"maxScore"`
	Band       float64 `json:"band"`
	Percentage int     `json:"percentage"`
	Method     string  `json:"method"`
	Disclaimer string  `json:"disclaimer"`
}

var listeningAnchors=[]Anchor{{16,5},{23,6},{30,7},{35,8}}
var academicReadingAnchors=[]Anchor{{15,5},{23,6},{30,7},{35,8}}
var generalReadingAnchors=[]Anchor{{15,4},{23,5},{30,6},{35,7}}

func Objective(section,testType string,raw,max int)(ObjectiveResult,error){
	section=strings.ToLower(strings.TrimSpace(section));testType=strings.ToLower(strings.TrimSpace(testType));if testType==""{testType="academic"}
	if section!="listening"&&section!="reading"{return ObjectiveResult{},errors.New("section must be listening or reading")};if max<=0||raw<0||raw>max{return ObjectiveResult{},errors.New("invalid raw score")}
	normalized:=raw;if max!=40{normalized=int(math.Round(float64(raw)*40/float64(max)))};if normalized>40{normalized=40}
	anchors:=listeningAnchors;if section=="reading"{if testType=="general"{anchors=generalReadingAnchors}else{testType="academic";anchors=academicReadingAnchors}}
	band:=estimate(anchors,normalized)
	return ObjectiveResult{Section:section,TestType:testType,RawScore:raw,MaxScore:max,Band:band,Percentage:int(math.Round(float64(raw)*100/float64(max))),Method:"Interpolated from IELTS-published average raw-score anchors, normalized to 40 questions.",Disclaimer:"Practice band estimate only. IELTS states that the precise raw marks needed for a band can vary slightly between test versions."},nil
}

func Overall(listening,reading,writing,speaking float64)(float64,error){values:=[]float64{listening,reading,writing,speaking};sum:=0.0;for _,v:=range values{if v<0||v>9{return 0,errors.New("band scores must be between 0 and 9")};sum+=v};return RoundOverall(sum/4),nil}

func RoundOverall(value float64)float64{return math.Floor(value*2+0.5)/2}
func roundHalf(value float64)float64{return math.Round(value*2)/2}
func estimate(anchors []Anchor,raw int)float64{
	if raw<=0{return 0};var value float64
	if raw<=anchors[0].Raw{a,b:=anchors[0],anchors[1];slope:=(b.Band-a.Band)/float64(b.Raw-a.Raw);value=a.Band+float64(raw-a.Raw)*slope}else if raw>=anchors[len(anchors)-1].Raw{a,b:=anchors[len(anchors)-2],anchors[len(anchors)-1];slope:=(b.Band-a.Band)/float64(b.Raw-a.Raw);value=b.Band+float64(raw-b.Raw)*slope}else{for i:=0;i<len(anchors)-1;i++{a,b:=anchors[i],anchors[i+1];if raw>=a.Raw&&raw<=b.Raw{ratio:=float64(raw-a.Raw)/float64(b.Raw-a.Raw);value=a.Band+ratio*(b.Band-a.Band);break}}}
	if value<1{value=1};if value>9{value=9};return roundHalf(value)
}
