// Objective activity banks live only in backend/internal/learning.
export type LearningPack = { label: string; speakingPrompts: string[] };
type PackOverride = Partial<Omit<LearningPack, "label">> & { label: string };

const base: LearningPack = {
  "label": "CORE ENGLISH",
  "speakingPrompts": [
    "Could I have a window seat, please?",
    "I usually prefer travelling by train because it is more comfortable.",
    "One of the main reasons people move to large cities is the availability of better job opportunities."
  ]
};

const packs: Record<string, PackOverride> = {
  "travel-airport": {
    "label": "TRAVEL · AIRPORT",
    "speakingPrompts": [
      "I missed my flight. Could you help me rebook, please?",
      "I would prefer the earliest available flight, even if it has a short connection.",
      "Could you confirm the gate and the boarding time for me?"
    ]
  },
  "travel-hotel": {
    "label": "TRAVEL · HOTEL",
    "speakingPrompts": [
      "I have a confirmed reservation, but I think it may be under my middle name.",
      "Could you check this confirmation number again, please?",
      "Could you tell me whether breakfast is included and what time checkout is?"
    ]
  },
  "travel-transit": {
    "label": "TRAVEL · TRANSIT",
    "speakingPrompts": [
      "What is the fastest route to Central Station?",
      "Where do I change from the blue line to the green line?",
      "Which platform do I need, and how many minutes do I have before the last train?"
    ]
  },
  "conversation-cafe": {
    "label": "CONVERSATION · CAFE",
    "speakingPrompts": [
      "Hi, my name is Loc. I don't think we've met before.",
      "What about you? What do you usually do after work or class?",
      "It was nice to meet you. Would you like to grab coffee again sometime?"
    ]
  },
  "conversation-plans": {
    "label": "CONVERSATION · MAKE PLANS",
    "speakingPrompts": [
      "How about going to the cinema this Saturday?",
      "Would three o'clock at the cafe near the lake work for you?",
      "Perfect. So we meet there at three. See you then."
    ]
  },
  "conversation-clarity": {
    "label": "CONVERSATION · CLARITY",
    "speakingPrompts": [
      "Sorry, I'm not sure what you mean. Could you explain that again?",
      "What I mean is that I may arrive later, not that I am cancelling.",
      "Got it. So the plan is still on, but the time may change."
    ]
  },
  "work-standup": {
    "label": "WORK · STAND-UP",
    "speakingPrompts": [
      "Yesterday I finished the authentication fix.",
      "Today I will add integration tests and review the API changes.",
      "I have no blockers right now, but I may need the product owner to confirm one edge case."
    ]
  },
  "work-requirements": {
    "label": "WORK · REQUIREMENTS",
    "speakingPrompts": [
      "The phrase 'better results' is unclear. Could we define what ranking behavior we expect?",
      "What exactly should happen when a search returns no exact matches?",
      "So the acceptance condition is one-second response time and exact title matches ranked first, correct?"
    ]
  },
  "work-deadline": {
    "label": "WORK · DELIVERY",
    "speakingPrompts": [
      "The Friday deadline creates a testing risk for the full scope.",
      "If we keep the quality bar, reducing scope is the safer trade-off.",
      "I propose a phased delivery: the core flow on Friday and reporting in the next release."
    ]
  }
};

export function getLearningPack(key?: string): LearningPack {
  const selected = key ? packs[key] : undefined;
  return { ...base, ...selected, label: selected?.label ?? base.label };
}
