package learning

import (
	"crypto/sha256"
	_ "embed"
	"encoding/binary"
	"encoding/json"
	"errors"
	"strings"
	"unicode"

	"github.com/Loccao102/LocCaoEnglish/backend/internal/model"
)

const DictationRulesVersion = "dictation.v1"

//go:embed dictation_catalog.json
var dictationJSON []byte

type DictationItem struct{ ID, CEFRLevel, Transcript, Feedback string }

var dictationCatalog struct {
	ContentVersion string
	Items          []DictationItem
}

func init() {
	if err := json.Unmarshal(dictationJSON, &dictationCatalog); err != nil {
		panic(err)
	}
}
func DictationContentVersion() string { return dictationCatalog.ContentVersion }
func PickDictation(level, pack, seed string, excluded []string) (DictationItem, error) {
	blocked := map[string]bool{}
	for _, id := range excluded {
		blocked[id] = true
	}
	var all, candidates []DictationItem
	for _, item := range dictationCatalog.Items {
		if pack == "cefr-core" && item.CEFRLevel == level {
			all = append(all, item)
			if !blocked[item.ID] {
				candidates = append(candidates, item)
			}
		}
	}
	if len(candidates) == 0 {
		candidates = all
	}
	if len(candidates) == 0 {
		return DictationItem{}, errors.New("dictation supports A2, B1 and B2 core practice")
	}
	sum := sha256.Sum256([]byte(seed + "|dictation"))
	return candidates[int(binary.BigEndian.Uint16(sum[:2]))%len(candidates)], nil
}

// V1 treats punctuation as word boundaries, except apostrophes inside words.
// Keep this normalization and tie-break order for saved v1 attempts on upgrades.
func DictationTokens(text string) []string {
	runes := []rune(strings.ToLower(strings.ReplaceAll(text, "’", "'")))
	var normalized strings.Builder
	for i, r := range runes {
		if unicode.IsLetter(r) || unicode.IsDigit(r) || r == '\'' && i > 0 && i+1 < len(runes) && unicode.IsLetter(runes[i-1]) && unicode.IsLetter(runes[i+1]) {
			normalized.WriteRune(r)
		} else {
			normalized.WriteByte(' ')
		}
	}
	return strings.Fields(normalized.String())
}

// Unit-cost Levenshtein alignment avoids cascading errors after an omitted word.
// Callers bound input to 2048 bytes before invoking this function.
func GradeDictation(expectedText, actualText string) *model.DictationGrade {
	expected, actual := DictationTokens(expectedText), DictationTokens(actualText)
	n, m := len(expected), len(actual)
	dp := make([][]int, n+1)
	for i := range dp {
		dp[i] = make([]int, m+1)
		dp[i][0] = i
	}
	for j := 0; j <= m; j++ {
		dp[0][j] = j
	}
	for i := 1; i <= n; i++ {
		for j := 1; j <= m; j++ {
			cost := 1
			if expected[i-1] == actual[j-1] {
				cost = 0
			}
			dp[i][j] = min(dp[i-1][j-1]+cost, dp[i-1][j]+1, dp[i][j-1]+1)
		}
	}
	grade := &model.DictationGrade{ExpectedWords: n, Words: []model.DictationWord{}}
	for i, j := n, m; i > 0 || j > 0; {
		word := model.DictationWord{}
		switch {
		case i > 0 && j > 0 && expected[i-1] == actual[j-1] && dp[i][j] == dp[i-1][j-1]:
			word.Kind, word.Expected, word.Actual = "match", expected[i-1], actual[j-1]
			grade.Matched++
			i--
			j--
		case i > 0 && j > 0 && dp[i][j] == dp[i-1][j-1]+1:
			word.Kind, word.Expected, word.Actual = "substitute", expected[i-1], actual[j-1]
			grade.Substituted++
			i--
			j--
		case i > 0 && dp[i][j] == dp[i-1][j]+1:
			word.Kind, word.Expected = "missing", expected[i-1]
			grade.Missing++
			i--
		default:
			word.Kind, word.Actual = "extra", actual[j-1]
			grade.Extra++
			j--
		}
		grade.Words = append(grade.Words, word)
	}
	for i, j := 0, len(grade.Words)-1; i < j; i, j = i+1, j-1 {
		grade.Words[i], grade.Words[j] = grade.Words[j], grade.Words[i]
	}
	if n > 0 {
		grade.Accuracy = max(0, 1-float64(dp[n][m])/float64(n))
	}
	return grade
}
