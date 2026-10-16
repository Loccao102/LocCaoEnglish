package learning

import (
	_ "embed"
	"encoding/json"

	"github.com/Loccao102/LocCaoEnglish/backend/internal/model"
)

const IELTSListeningRulesVersion = "ielts-listening.v1"
const IELTSListeningPack = "ielts-listening"

//go:embed ielts_listening_catalog.json
var ieltsListeningJSON []byte
var ieltsListeningCatalog IELTSReadingCatalog

func init() {
	if err := json.Unmarshal(ieltsListeningJSON, &ieltsListeningCatalog); err != nil {
		panic(err)
	}
}

// Questions and scoring use the same paper contract as Reading. Transcripts
// live only in the private audio snapshot, never in the issued public prompt.
func NewIELTSListening() (model.IELTSReadingPrompt, IELTSReadingSnapshot, map[string]string, string, string, error) {
	prompt, key, id, version, err := newIELTSObjective(ieltsListeningCatalog)
	transcripts := make(map[string]string, len(ieltsListeningCatalog.Sections))
	for _, part := range ieltsListeningCatalog.Sections {
		transcripts[part.ID] = part.Transcript
	}
	return prompt, key, transcripts, id, version, err
}

func GradeIELTSListening(prompt *model.IELTSReadingPrompt, snapshot *IELTSReadingSnapshot, answer string) (*model.IELTSReadingResult, error) {
	return gradeIELTSObjective(prompt, snapshot, answer, "listening")
}

func IsIELTSObjective(activity string) bool {
	return activity == "ielts-reading" || activity == "ielts-listening"
}
