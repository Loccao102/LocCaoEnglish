package learning

import (
	"crypto/rand"
	_ "embed"
	"encoding/hex"
	"encoding/json"
	"errors"
	"sort"
	"strings"

	ieltscore "github.com/Loccao102/LocCaoEnglish/backend/internal/ielts"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/model"
)

const IELTSReadingRulesVersion = "ielts-reading.v1"
const IELTSReadingMethodVersion = "ielts-anchors-interpolation.v1"
const IELTSReadingProvider = "loccao-objective"
const IELTSReadingEvidence = "server-objective-practice"
const IELTSReadingPack = "ielts-academic-reading"

//go:embed ielts_reading_catalog.json
var ieltsReadingJSON []byte

type IELTSReadingCatalog struct {
	ContentVersion string
	ID             string
	Title          string
	Sections       []struct {
		ID, Title, Passage string
		Questions          []struct {
			ID, Prompt, Answer string
			Options            []string
		}
	}
}

var ieltsReadingCatalog IELTSReadingCatalog

func init() {
	if err := json.Unmarshal(ieltsReadingJSON, &ieltsReadingCatalog); err != nil {
		panic(err)
	}
}

// The private key belongs to this issued snapshot, never an answer-position ID
// or a public request seed. It is retained when the catalog changes.
type IELTSReadingSnapshot struct {
	CorrectOptions map[string]string         `json:"correctOptions"`
	MethodVersion  string                    `json:"methodVersion"`
	Result         *model.IELTSReadingResult `json:"result,omitempty"`
}

func NewIELTSReading() (model.IELTSReadingPrompt, IELTSReadingSnapshot, string, string, error) {
	prompt := model.IELTSReadingPrompt{Title: ieltsReadingCatalog.Title, Sections: []model.IELTSReadingSection{}}
	private := IELTSReadingSnapshot{CorrectOptions: map[string]string{}, MethodVersion: IELTSReadingMethodVersion}
	for _, section := range ieltsReadingCatalog.Sections {
		public := model.IELTSReadingSection{ID: section.ID, Title: section.Title, Passage: section.Passage, Questions: []model.IELTSReadingQuestion{}}
		for _, question := range section.Questions {
			q := model.IELTSReadingQuestion{ID: question.ID, Prompt: question.Prompt, Options: []model.IELTSReadingOption{}}
			for _, option := range question.Options {
				var id [8]byte
				if _, err := rand.Read(id[:]); err != nil {
					return prompt, private, "", "", err
				}
				key := hex.EncodeToString(id[:])
				q.Options = append(q.Options, model.IELTSReadingOption{ID: key, Text: option})
				if option == question.Answer {
					private.CorrectOptions[q.ID] = key
				}
			}
			sort.Slice(q.Options, func(i, j int) bool { return q.Options[i].ID < q.Options[j].ID })
			public.Questions = append(public.Questions, q)
		}
		prompt.Sections = append(prompt.Sections, public)
	}
	return prompt, private, ieltsReadingCatalog.ID, ieltsReadingCatalog.ContentVersion, nil
}

// Resolve only a strict array of two-string tuples, in issued question order.
// Unanswered questions are omitted; [] is a valid submission worth zero marks.
func GradeIELTSReading(prompt *model.IELTSReadingPrompt, snapshot *IELTSReadingSnapshot, answer string) (*model.IELTSReadingResult, error) {
	invalid := errors.New("invalid IELTS reading selections or snapshot")
	if prompt == nil || snapshot == nil || snapshot.MethodVersion != IELTSReadingMethodVersion || len(answer) > 2048 || !strings.HasPrefix(strings.TrimSpace(answer), "[") {
		return nil, invalid
	}
	var tuples [][]string
	if err := json.Unmarshal([]byte(answer), &tuples); err != nil {
		return nil, invalid
	}
	questions := []model.IELTSReadingQuestion{}
	positions := map[string]int{}
	for _, section := range prompt.Sections {
		for _, q := range section.Questions {
			positions[q.ID] = len(questions)
			questions = append(questions, q)
		}
	}
	if len(questions) != 40 || len(positions) != 40 || len(snapshot.CorrectOptions) != 40 {
		return nil, invalid
	}
	selected := map[string]string{}
	previous := -1
	for _, tuple := range tuples {
		if len(tuple) != 2 {
			return nil, invalid
		}
		index, ok := positions[tuple[0]]
		if !ok || index <= previous {
			return nil, invalid
		}
		valid := false
		for _, option := range questions[index].Options {
			if option.ID == tuple[1] {
				valid = true
				break
			}
		}
		if !valid {
			return nil, invalid
		}
		selected[tuple[0]], previous = tuple[1], index
	}
	answers := make([]model.IELTSReadingAnswer, 0, 40)
	raw := 0
	for _, q := range questions {
		key, ok := snapshot.CorrectOptions[q.ID]
		if !ok || key == "" {
			return nil, invalid
		}
		keyFound := false
		for _, option := range q.Options {
			if option.ID == key {
				keyFound = true
			}
		}
		if !keyFound {
			return nil, invalid
		}
		correct := selected[q.ID] == key
		if correct {
			raw++
		}
		answers = append(answers, model.IELTSReadingAnswer{QuestionID: q.ID, OptionID: selected[q.ID], CorrectOptionID: key, Correct: correct})
	}
	score, err := ieltscore.Objective("reading", "academic", raw, 40)
	if err != nil {
		return nil, err
	}
	return &model.IELTSReadingResult{Section: score.Section, TestType: score.TestType, RawScore: raw, MaxScore: 40, Band: score.Band, Percentage: score.Percentage, Method: score.Method, MethodVersion: snapshot.MethodVersion, Provider: IELTSReadingProvider, Disclaimer: "Practice estimate from this local question set and an interpolated raw-score table. This set is not officially calibrated and this is not an official IELTS score or an overall band.", Answers: answers}, nil
}
