package acoustic

import (
	"crypto/sha256"
	"encoding/base64"
	"encoding/binary"
	"encoding/hex"
	"errors"
	"math"
	"strings"
	"time"
	"unicode/utf8"
)

const RulesVersion = "speaking-acoustic.v1"
const MethodVersion = "guided-pronunciation.v1"
const Provider = "azure-speech-pronunciation-assessment"
const Model = "provider-managed-unspecified"
const MaxAudioBytes = 400000

var ErrInput = errors.New("invalid pronunciation request or recording")
var ErrConflict = errors.New("this request does not match the saved recording")
var ErrNeedsAudio = errors.New("the original recording is no longer available; record a new take for another assessment")

type Sample struct {
	SHA256      string  `json:"sha256"`
	Bytes       int     `json:"bytes"`
	SampleRate  int     `json:"sampleRate"`
	DurationSec float64 `json:"durationSec"`
}

func Hash(b []byte) string { sum := sha256.Sum256(b); return hex.EncodeToString(sum[:]) }
func ValidSample(s Sample) bool {
	decoded, err := hex.DecodeString(s.SHA256)
	return err == nil && len(decoded) == 32 && s.SHA256 == strings.ToLower(s.SHA256) && s.Bytes >= 46 && s.Bytes <= MaxAudioBytes && s.SampleRate == 16000 && !math.IsNaN(s.DurationSec) && s.DurationSec >= 1.0/16000 && s.DurationSec <= 12
}
func DecodeWAV(encoded string) ([]byte, Sample, error) {
	if len(encoded) > base64.StdEncoding.EncodedLen(MaxAudioBytes) {
		return nil, Sample{}, ErrInput
	}
	b, err := base64.StdEncoding.Strict().DecodeString(encoded)
	if err != nil || len(b) < 44 || len(b) > MaxAudioBytes || string(b[:4]) != "RIFF" || string(b[8:12]) != "WAVE" || uint64(binary.LittleEndian.Uint32(b[4:8]))+8 != uint64(len(b)) {
		return nil, Sample{}, ErrInput
	}
	format, data := false, false
	dataLen := 0
	for pos := 12; pos < len(b); {
		if pos+8 > len(b) {
			return nil, Sample{}, ErrInput
		}
		size := int(binary.LittleEndian.Uint32(b[pos+4 : pos+8]))
		start, end := pos+8, pos+8+size
		if end < start || end > len(b) {
			return nil, Sample{}, ErrInput
		}
		switch string(b[pos : pos+4]) {
		case "fmt ":
			if format || size < 16 {
				return nil, Sample{}, ErrInput
			}
			f := b[start:end]
			if binary.LittleEndian.Uint16(f) != 1 || binary.LittleEndian.Uint16(f[2:]) != 1 || binary.LittleEndian.Uint32(f[4:]) != 16000 || binary.LittleEndian.Uint32(f[8:]) != 32000 || binary.LittleEndian.Uint16(f[12:]) != 2 || binary.LittleEndian.Uint16(f[14:]) != 16 {
				return nil, Sample{}, ErrInput
			}
			format = true
		case "data":
			if !format || data || size < 2 || size%2 != 0 || size > 16000*12*2 {
				return nil, Sample{}, ErrInput
			}
			data = true
			dataLen = size
		}
		pos = end + size%2
		if pos > len(b) {
			return nil, Sample{}, ErrInput
		}
	}
	if !format || !data {
		return nil, Sample{}, ErrInput
	}
	return b, Sample{SHA256: Hash(b), Bytes: len(b), SampleRate: 16000, DurationSec: float64(dataLen) / 32000}, nil
}

type Phoneme struct {
	Phoneme  string   `json:"phoneme"`
	Accuracy *float64 `json:"accuracy"`
}
type Word struct {
	Word      string    `json:"word"`
	Accuracy  *float64  `json:"accuracy"`
	ErrorType string    `json:"errorType"`
	Phonemes  []Phoneme `json:"phonemes"`
}
type Feedback struct {
	Provider           string              `json:"provider"`
	Model              string              `json:"model"`
	MethodVersion      string              `json:"methodVersion"`
	Locale             string              `json:"locale"`
	AudioSHA256        string              `json:"audioSHA256"`
	ReferenceSHA256    string              `json:"referenceSHA256"`
	AcousticAssessment bool                `json:"acousticAssessment"`
	Overall            *float64            `json:"overall"`
	Scores             map[string]*float64 `json:"scores"`
	Words              []Word              `json:"words"`
	Coaching           []string            `json:"coaching"`
	Disclaimer         string              `json:"disclaimer"`
}
type Receipt struct {
	ID                     string     `json:"id"`
	RequestID              string     `json:"requestId"`
	AttemptID              string     `json:"attemptId"`
	Reference              string     `json:"reference"`
	Transcript             string     `json:"transcript"`
	ContentVersion         string     `json:"contentVersion"`
	TranscriptRulesVersion string     `json:"transcriptRulesVersion"`
	RulesVersion           string     `json:"rulesVersion"`
	Sample                 Sample     `json:"sample"`
	Status                 string     `json:"status"`
	Generation             int        `json:"generation"`
	LeaseUntil             *time.Time `json:"leaseUntil,omitempty"`
	Feedback               *Feedback  `json:"feedback,omitempty"`
	Failure                string     `json:"failure,omitempty"`
	CreatedAt              time.Time  `json:"createdAt"`
	UpdatedAt              time.Time  `json:"updatedAt"`
	CompletedAt            *time.Time `json:"completedAt,omitempty"`
}
type StartInput struct {
	RequestID              string `json:"requestId"`
	AttemptID              string `json:"attemptId"`
	Transcript             string `json:"transcript"`
	ContentVersion         string `json:"contentVersion"`
	TranscriptRulesVersion string `json:"transcriptRulesVersion"`
	RulesVersion           string `json:"rulesVersion"`
	AudioBase64            string `json:"audioBase64"`
}
type RetryInput struct {
	Generation  int    `json:"generation"`
	AudioBase64 string `json:"audioBase64,omitempty"`
}

func ValidTranscript(s string) bool {
	return utf8.ValidString(s) && len(s) <= 2048 && !strings.ContainsRune(s, '\x00')
}
func ValidScore(v *float64) bool {
	return v != nil && !math.IsNaN(*v) && !math.IsInf(*v, 0) && *v >= 0 && *v <= 100
}
func Validate(f Feedback, r Receipt) error {
	if !f.AcousticAssessment || f.Provider != Provider || f.Model != Model || f.MethodVersion != MethodVersion || f.Locale != "en-US" || f.AudioSHA256 != r.Sample.SHA256 || f.ReferenceSHA256 != Hash([]byte(r.Reference)) || !ValidScore(f.Overall) {
		return ErrInput
	}
	for _, key := range []string{"accuracy", "fluency", "completeness"} {
		if !ValidScore(f.Scores[key]) {
			return ErrInput
		}
	}
	if len(f.Scores) > 4 {
		return ErrInput
	}
	for key, v := range f.Scores {
		if key != "accuracy" && key != "fluency" && key != "completeness" && key != "prosody" {
			return ErrInput
		}
		if v != nil && !ValidScore(v) {
			return ErrInput
		}
	}
	if len(f.Words) > 60 || len(f.Coaching) < 1 || len(f.Coaching) > 6 {
		return ErrInput
	}
	for _, tip := range f.Coaching {
		if strings.TrimSpace(tip) == "" || len(tip) > 2000 {
			return ErrInput
		}
	}
	for _, w := range f.Words {
		if strings.TrimSpace(w.Word) == "" || len(w.Word) > 400 || len(w.ErrorType) > 100 || len(w.Phonemes) > 50 || w.Accuracy != nil && !ValidScore(w.Accuracy) {
			return ErrInput
		}
		for _, p := range w.Phonemes {
			if strings.TrimSpace(p.Phoneme) == "" || len(p.Phoneme) > 100 || p.Accuracy != nil && !ValidScore(p.Accuracy) {
				return ErrInput
			}
		}
	}
	return nil
}
