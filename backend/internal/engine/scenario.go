package engine

import (
	"errors"
	"regexp"
	"strings"
	"unicode/utf8"
)

const ConversationRulesVersion = "conversation.v2"
const ConversationEvidence = "server-rule-based-reported-dialogue"

type ScenarioEvaluation struct {
	BossID       string             `json:"bossId"`
	Stage        int                `json:"stage"`
	Score        int                `json:"score"`
	Complete     bool               `json:"complete"`
	Completed    []string           `json:"completed"`
	Missing      []string           `json:"missing"`
	RulesVersion string             `json:"rulesVersion"`
	Evidence     string             `json:"evidence"`
	Turns        []ConversationTurn `json:"turns"`
	Reply        string             `json:"reply"`
}
type ConversationTurn struct {
	Index     int    `json:"index"`
	Accepted  bool   `json:"accepted"`
	Objective string `json:"objective"`
	Feedback  string `json:"feedback"`
}
type conversationObjective struct {
	name, reply string
	patterns    []*regexp.Regexp
	reject      *regexp.Regexp
}

func objective(name, reply, reject string, patterns ...string) conversationObjective {
	o := conversationObjective{name: name, reply: reply}
	for _, p := range patterns {
		o.patterns = append(o.patterns, regexp.MustCompile(`\b(?:`+p+`)\b`))
	}
	if reject != "" {
		o.reject = regexp.MustCompile(`\b(?:` + reject + `)\b`)
	}
	return o
}

// A bounded, ordered rubric for guided role-play, not a semantic/fluency model.
// Each distinct learner turn can satisfy only the currently requested objective.
var conversationRubrics = map[string][]conversationObjective{
	"airport-crisis": {
		objective("Explain the flight problem", "Tell me what happened to your flight.", `(?:did not|didn't|never) (?:miss|lose)|not (?:late|delayed)`, `i|my|our`, `missed|late|delayed`, `flight|plane|connection`),
		objective("Ask for a workable replacement", "I can help with a replacement. What flight would you like?", `(?:don't|do not|never|cannot|can't) (?:want|rebook|take)|no (?:replacement|flight)`, `rebook|next flight|another flight|earliest|later flight`, `could|can|please|would|i (?:want|need|prefer)`),
		objective("Confirm the plan", "There is a seat on the next flight. Confirm your choice and ask about boarding.", `(?:don't|do not|never|cannot|can't|won't|will not) (?:book|take|accept|board|want)|not confirmed`, `book it|take it|yes please|i accept`, `gate|boarding|board|flight`),
	},
	"hotel-reservation": {
		objective("Explain the missing reservation", "What is the problem with your reservation?", `(?:don't|do not|never) have|not booked`, `i|my|our`, `reservation|booking|booked`, `missing|cannot find|can't find|not find|not showing|confirmed`),
		objective("Provide booking evidence", "Could you give me a reference or the name on the booking?", `(?:don't|do not|cannot|can't) (?:have|provide|show)|no (?:email|confirmation|booking)`, `confirmation number|booking number|email|under my name|name is`, `my|is|have|here|sent`),
		objective("Confirm a practical stay detail", "I found your reservation. What detail would you like to check before settling in?", `(?:don't|do not) (?:need|want|care)`, `breakfast|checkout|check out|wifi|wi fi|key card`, `what|when|where|how|could|can|is|does`),
	},
	"city-transit": {
		objective("Explain the destination or last-train problem", "Where do you need to go tonight?", `(?:don't|do not) (?:need|want)|not going`, `i need|i want|i am going|i'm going|how (?:can|do) i get`, `station|airport|hotel|museum|centre|center|hospital|central`),
		objective("Ask for or choose a route", "There are several lines available. Ask about a route or choose one.", `(?:don't|do not|never) (?:take|want|use)|no route`, `fastest|route|transfer|change|line`, `which|what|how|could|can|i (?:will|prefer)|i'll`),
		objective("Confirm an operational detail", "That route works. Check the platform, ticket or departure time.", `(?:don't|do not) (?:need|want|care)`, `platform|ticket|depart|leave|what time`, `which|what|where|how|when|does|can|is`),
	},
	"cafe-connection": {
		objective("Introduce yourself", "Hi! Tell me a little about yourself.", `(?:not|never) (?:called|named)|my name is not|i am not|i'm not`, `my name is|i am|i'm|call me`),
		objective("Show curiosity about the other person", "Nice to meet you. Ask me something about myself.", `(?:don't|do not) (?:care|want)`, `what about you|where are you|what do you|do you like|how about you`),
		objective("Keep or close the connection naturally", "I enjoy meeting people here. How would you keep in touch or close the conversation?", `(?:don't|do not|never|won't|will not) (?:want|meet|see|talk)|not nice`, `nice to meet|good to meet|see you|would you like|can we|talk again`),
	},
	"weekend-plans": {
		objective("Make a suggestion", "What could we do together this weekend?", `(?:don't|do not|never) (?:want|go)|let's not`, `let's|how about|would you like|we could|why don't we`, `walk|coffee|cafe|park|cinema|movie|visit|play|lunch|dinner|museum|hike`),
		objective("Agree on a time or place", "I like that idea. Suggest when or where to meet.", `(?:don't|do not|cannot|can't|won't) (?:meet|come)|not on`, `saturday|sunday|tomorrow|at [0-9]|meet at`, `meet|come|at|on`),
		objective("Confirm the final plan", "That works for me. Please confirm our plan.", `(?:don't|do not|cannot|can't|won't|will not) (?:meet|come|agree)|not (?:confirmed|good)|cancel`, `sounds good|see you|so we meet|it's a plan|perfect|confirmed`),
	},
	"repair-misunderstanding": {
		objective("Signal the misunderstanding politely", "I thought you were cancelling the plan. Is that what you meant?", "", `sorry|didn't understand|did not understand|what do you mean|not sure what you mean`),
		objective("Rephrase the intended meaning", "Please explain what you meant instead.", `(?:don't|do not|cannot|can't) (?:explain|clarify)`, `what i mean|in other words|i meant|let me explain|to clarify`, `arrive|come|later|time|meet|change|plan`),
		objective("Confirm shared understanding", "So we are changing the time, not cancelling. Does that match your meaning?", `(?:don't|do not|cannot|can't|didn't) understand|not (?:clear|sure)|no sense`, `so you mean|got it|i understand|that makes sense|okay now|now i understand`),
	},
	"daily-standup": {
		objective("Report recent progress", "What concrete work did you finish since yesterday?", `(?:not|never) (?:finished|completed|done)|(?:didn't|did not) (?:finish|complete)`, `finished|completed|worked on|fixed|done`, `i|we|yesterday`, `fix|login|page|test|feature|bug|report|design|api|task|search`),
		objective("State the next action", "What will you work on next?", `(?:won't|will not|cannot|can't)`, `today|next|i will|i'll|plan to`, `add|test|build|fix|review|write|finish|implement|check|work`),
		objective("Surface a blocker or say there is none", "Is anything blocking your work? State the dependency, help needed, or that there are no blockers.", "", `no blockers|not blocked|need help with|blocked by|waiting for|dependency on`),
	},
	"requirement-clarity": {
		objective("Identify the ambiguity", "What part of the search requirement is unclear?", `not unclear|not ambiguous|don't need|do not need`, `not clear|unclear|clarify|ambiguous`, `requirement|search|faster|result|page|speed`),
		objective("Ask a concrete clarifying question", "Ask a specific question about the expected behavior.", `don't care|do not care`, `should|which|what happens|do you mean|what exactly|does this`, `empty|result|search|page|second|speed|query|user`),
		objective("Confirm the acceptance condition", "We need useful suggestions for empty results. Confirm the expected behavior.", `(?:don't|do not|cannot|can't) (?:confirm|understand)|not understood`, `so the requirement|acceptance|confirm that|understood|so it should|that means`, `show|display|suggest|result|search|load`),
	},
	"deadline-negotiation": {
		objective("State the delivery constraint", "Can you deliver the full feature by Friday? Explain any constraint.", `no risk|no problem`, `deadline|timeline|cannot|can't|risk|not enough time`, `friday|deliver|testing|time|feature|finish`),
		objective("Explain a trade-off", "Explain what would have to change to meet the date.", `no trade off|no tradeoff|no impact`, `scope|quality|testing|resource|priority|trade off|tradeoff`, `cut|reduce|hurt|less|more|delay|risk|affect|drop|trade off|tradeoff`),
		objective("Propose a workable alternative", "Offer a concrete alternative with a deliverable or date.", `(?:don't|do not|cannot|can't|won't) (?:deliver|propose|extend)|no option`, `could deliver|extend|phase|phased|mvp|option|instead|propose`, `friday|monday|week|day|release|report|feature|mvp`),
	},
}

func ValidateConversation(bossID string, messages []string) error {
	if _, ok := conversationRubrics[bossID]; !ok {
		return errors.New("unknown mission")
	}
	if len(messages) > 24 {
		return errors.New("a conversation allows at most 24 turns")
	}
	for _, message := range messages {
		if !utf8.ValidString(message) || len(message) > 1024 || strings.TrimSpace(message) == "" {
			return errors.New("each turn must contain 1 to 1024 UTF-8 bytes")
		}
	}
	return nil
}

var conversationWords = regexp.MustCompile(`[a-z0-9]+(?:'[a-z]+)?`)

func normalizedConversation(text string) string {
	return strings.Join(conversationWords.FindAllString(strings.ToLower(strings.ReplaceAll(text, "’", "'")), -1), " ")
}
func EvaluateBossConversation(bossID string, messages []string) ScenarioEvaluation {
	result := ScenarioEvaluation{BossID: bossID, Completed: []string{}, Missing: []string{}, Turns: []ConversationTurn{}, RulesVersion: ConversationRulesVersion, Evidence: ConversationEvidence}
	objectives := conversationRubrics[bossID]
	if ValidateConversation(bossID, messages) != nil || len(objectives) == 0 {
		return result
	}
	seen := map[string]bool{}
	for index, message := range messages {
		text := normalizedConversation(message)
		turn := ConversationTurn{Index: index, Feedback: "Address the current objective in a complete, specific sentence."}
		if result.Stage == len(objectives) {
			turn.Feedback = "Objectives already complete."
			result.Turns = append(result.Turns, turn)
			continue
		}
		o := objectives[result.Stage]
		turn.Objective = o.name
		words := strings.Fields(text)
		valid := len(words) >= 4 && !seen[text]
		unique := map[string]bool{}
		for _, word := range words {
			unique[word] = true
		}
		if len(unique) < 3 {
			valid = false
		}
		if seen[text] {
			turn.Feedback = "Repeated turns do not advance the conversation."
		}
		seen[text] = true
		if o.reject != nil && o.reject.MatchString(text) {
			valid = false
			turn.Feedback = "This reply contradicts the current objective. Clarify what you mean."
		}
		for _, pattern := range o.patterns {
			if !pattern.MatchString(text) {
				valid = false
			}
		}
		if valid {
			result.Completed = append(result.Completed, o.name)
			result.Stage++
			turn.Accepted = true
			turn.Feedback = "Objective addressed. Continue with the next reply."
		}
		result.Turns = append(result.Turns, turn)
	}
	for _, o := range objectives[result.Stage:] {
		result.Missing = append(result.Missing, o.name)
	}
	result.Score = result.Stage * 100 / len(objectives)
	result.Complete = result.Stage == len(objectives)
	if result.Complete {
		result.Reply = "You have addressed the three role-play objectives. Save your chapter completion when ready."
	} else {
		result.Reply = objectives[result.Stage].reply
	}
	return result
}
