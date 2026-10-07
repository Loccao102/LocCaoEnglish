package learning

import (
	"crypto/sha256"
	_ "embed"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"sort"
	"strings"

	"github.com/Loccao102/LocCaoEnglish/backend/internal/model"
)

const SentenceRulesVersion = "sentence-builder.v1"

//go:embed sentence_catalog.json
var sentenceCatalogJSON []byte

type SentenceItem struct {
	ID        string   `json:"id"`
	Pack      string   `json:"pack"`
	CEFRLevel string   `json:"cefrLevel"`
	Question  string   `json:"question"`
	Chunks    []string `json:"chunks"`
	Feedback  string   `json:"feedback"`
}

var sentenceCatalog struct {
	ContentVersion string         `json:"contentVersion"`
	Items          []SentenceItem `json:"items"`
}

func init() {
	if err := json.Unmarshal(sentenceCatalogJSON, &sentenceCatalog); err != nil {
		panic(err)
	}
}

func SentenceContentVersion() string { return sentenceCatalog.ContentVersion }

func PickSentence(level, pack, seed string, excluded []string) (SentenceItem, error) {
	blocked := map[string]bool{}
	for _, id := range excluded {
		blocked[id] = true
	}
	var all, available []SentenceItem
	for _, item := range sentenceCatalog.Items {
		if item.Pack == pack && item.CEFRLevel == level {
			all = append(all, item)
			if !blocked[item.ID] {
				available = append(available, item)
			}
		}
	}
	if len(available) == 0 {
		available = all
	}
	if len(available) == 0 {
		return SentenceItem{}, fmt.Errorf("no sentence content for CEFR level and pack")
	}
	if pack != "cefr-core" {
		return available[0], nil
	}
	sum := sha256.Sum256([]byte(seed + "|sentence|" + level))
	return available[int(binary.BigEndian.Uint16(sum[:2]))%len(available)], nil
}

func ShuffledSentenceChunks(item SentenceItem, seed string) []model.SentenceChunk {
	chunks := make([]model.SentenceChunk, len(item.Chunks))
	for i, word := range item.Chunks {
		// Hashes hide original positions; repeated words still have different IDs.
		sum := sha256.Sum256([]byte(fmt.Sprintf("%s|%s|chunk|%d", seed, item.ID, i)))
		chunks[i] = model.SentenceChunk{ID: fmt.Sprintf("%x", sum[:12]), Text: word}
	}
	sort.Slice(chunks, func(i, j int) bool { return chunks[i].ID < chunks[j].ID })
	texts := make([]string, len(chunks))
	for i, chunk := range chunks {
		texts[i] = chunk.Text
	}
	// Never open a round already solved, even when the seeded shuffle is identity.
	if strings.EqualFold(strings.Join(texts, " "), strings.Join(item.Chunks, " ")) && len(chunks) > 1 {
		chunks = append(chunks[1:], chunks[0])
	}
	return chunks
}

// ResolveSentenceAnswer validates a complete permutation against the snapshot.
// Equal-text occurrences are interchangeable but no ID can be reused or omitted.
func ResolveSentenceAnswer(chunks []model.SentenceChunk, answer string) (string, error) {
	var ids []string
	if err := json.Unmarshal([]byte(answer), &ids); err != nil || len(chunks) < 2 || len(ids) != len(chunks) {
		return "", fmt.Errorf("use each sentence chunk exactly once")
	}
	words := map[string]string{}
	for _, chunk := range chunks {
		if chunk.ID == "" || chunk.Text == "" || words[chunk.ID] != "" {
			return "", fmt.Errorf("invalid sentence snapshot")
		}
		words[chunk.ID] = chunk.Text
	}
	texts := make([]string, len(ids))
	for i, id := range ids {
		word, ok := words[id]
		if !ok {
			return "", fmt.Errorf("unknown or repeated sentence chunk")
		}
		texts[i] = word
		delete(words, id)
	}
	return strings.Join(texts, " "), nil
}
