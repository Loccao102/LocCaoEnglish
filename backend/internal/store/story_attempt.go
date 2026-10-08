package store

import (
	"context"
	"encoding/json"
	"time"

	"github.com/Loccao102/LocCaoEnglish/backend/internal/learning"
	"github.com/Loccao102/LocCaoEnglish/backend/internal/model"
)

// Private definition stays in the stored snapshot. Only the current scene and
// already committed decisions cross the HTTP boundary.
type StorySnapshot struct {
	Definition learning.StoryDefinition `json:"definition"`
	NodeID     string                   `json:"nodeId"`
	RunID      string                   `json:"runId"`
	ParentID   string                   `json:"parentId,omitempty"`
	Deadline   time.Time                `json:"deadline"`
	History    []model.StoryDecision    `json:"history"`
}

func cloneStory(s *StorySnapshot) *StorySnapshot {
	if s == nil {
		return nil
	}
	raw, _ := json.Marshal(s)
	var copy StorySnapshot
	_ = json.Unmarshal(raw, &copy)
	return &copy
}
func (s *Store) StartStoryChoice(ctx context.Context, owner string, input model.LearningAttemptStartInput) (LearningAttemptRecord, bool, error) {
	definition := learning.StoryCatalog()
	if input.Pack != definition.Pack || input.CEFRLevel != definition.CEFRLevel || len(input.ExcludeItemKeys) != 0 {
		return LearningAttemptRecord{}, false, ErrAttemptInput
	}
	state := StorySnapshot{Definition: definition, NodeID: definition.Start, Deadline: time.Now().UTC().Add(24 * time.Hour), History: []model.StoryDecision{}}
	return s.startStoryNode(ctx, owner, input, state)
}
func (s *Store) startStoryNode(ctx context.Context, owner string, input model.LearningAttemptStartInput, state StorySnapshot) (LearningAttemptRecord, bool, error) {
	node, ok := state.Definition.Node(state.NodeID)
	if !ok || node.Ending != "" || len(node.Choices) < 2 {
		return LearningAttemptRecord{}, false, ErrAttemptInput
	}
	prompt := model.LearningAttemptPrompt{Title: node.Title, Passage: node.Text, Question: node.Question, Options: node.Options(input.RequestID)}
	snapshot := LearningSnapshot{Input: input, Prompt: prompt, Story: &state}
	return s.StartLearningAttempt(ctx, owner, input.RequestID, "story-choice", "Reading", "story-choice:"+state.Definition.Pack+":"+node.ID, input.CEFRLevel, state.Definition.ContentVersion, learning.StoryRulesVersion, node.Text+"\n\n"+node.Question, node.EffectiveAnswers(), "", snapshot)
}
func (s *Store) ContinueStoryChoice(ctx context.Context, owner, parentID string) (LearningAttemptRecord, error) {
	parent, err := s.GetLearningAttempt(ctx, owner, parentID)
	if err != nil {
		return LearningAttemptRecord{}, err
	}
	if parent.Activity != "story-choice" || parent.RulesVersion != learning.StoryRulesVersion || parent.Snapshot.Story == nil || parent.Status != "completed" {
		return LearningAttemptRecord{}, ErrAttemptConflict
	}
	state := cloneStory(parent.Snapshot.Story)
	node, ok := state.Definition.Node(state.NodeID)
	if !ok {
		return LearningAttemptRecord{}, ErrAttemptInput
	}
	choice, ok := node.Choice(parent.SubmittedAnswer)
	if !ok {
		return LearningAttemptRecord{}, ErrAttemptInput
	}
	next, ok := state.Definition.Node(choice.Next)
	if !ok || next.Ending != "" {
		return LearningAttemptRecord{}, ErrAttemptConflict
	}
	// Public start requires UUIDv4; this reserved key cannot be occupied by a
	// client-created root. The existing unique owner/request constraint resolves
	// concurrent continues to one child, without another reward transaction.
	input := model.LearningAttemptStartInput{RequestID: "story-next:" + parent.ID, Activity: "story-choice", Pack: parent.Snapshot.Input.Pack, CEFRLevel: parent.CEFRLevel, ExcludeItemKeys: []string{}}
	if saved, e := s.FindLearningRequest(ctx, owner, input); e == nil {
		return saved, nil
	} else if e != ErrNotFound {
		return LearningAttemptRecord{}, e
	}
	if !time.Now().Before(state.Deadline) {
		return LearningAttemptRecord{}, ErrAttemptExpired
	}
	if len(state.History) >= len(state.Definition.Nodes) {
		return LearningAttemptRecord{}, ErrAttemptInput
	}
	state.History = append(state.History, model.StoryDecision{Scene: node.Title, Answer: parent.SubmittedAnswer, Consequence: choice.Feedback, XP: parent.XPDelta})
	if state.RunID == "" {
		state.RunID = parent.ID
	}
	state.ParentID, state.NodeID = parent.ID, next.ID
	child, _, err := s.startStoryNode(ctx, owner, input, *state)
	return child, err
}
func StoryRoundOf(rec LearningAttemptRecord) *model.StoryRound {
	state := rec.Snapshot.Story
	if state == nil {
		return nil
	}
	runID := state.RunID
	if runID == "" {
		runID = rec.ID
	}
	return &model.StoryRound{RunID: runID, Step: len(state.History) + 1, History: append([]model.StoryDecision{}, state.History...)}
}
func storyChoiceOf(rec LearningAttemptRecord, answer string) (learning.StoryChoice, bool) {
	if rec.Snapshot.Story == nil {
		return learning.StoryChoice{}, false
	}
	node, ok := rec.Snapshot.Story.Definition.Node(rec.Snapshot.Story.NodeID)
	if !ok {
		return learning.StoryChoice{}, false
	}
	return node.Choice(answer)
}
func learningCorrect(rec LearningAttemptRecord, answer string) bool {
	if rec.Activity == "dictation" {
		return learning.GradeDictation(rec.CorrectAnswer, answer).Accuracy == 1
	}
	if rec.Activity == "story-choice" {
		choice, ok := storyChoiceOf(rec, answer)
		return ok && choice.Good
	}
	return sameAnswer(rec.CorrectAnswer, learningAnswerText(rec, answer))
}
func storyOutcome(rec LearningAttemptRecord) *model.StoryOutcome {
	if rec.Activity != "story-choice" || rec.Snapshot.Story == nil {
		return nil
	}
	choice, ok := storyChoiceOf(rec, rec.SubmittedAnswer)
	if !ok {
		return nil
	}
	next, ok := rec.Snapshot.Story.Definition.Node(choice.Next)
	if !ok {
		return nil
	}
	outcome := &model.StoryOutcome{Consequence: choice.Feedback, CanContinue: next.Ending == ""}
	if next.Ending != "" {
		outcome.Ending = next.Ending
		outcome.Title = next.Title
		outcome.Text = next.Text
	}
	return outcome
}
