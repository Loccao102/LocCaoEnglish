# CEFR game direction: A1 → C2

LocCaoEnglish is moving from a collection of English exercises toward one playable learning world. CEFR is the learning spine; animation, characters and mini-games are the delivery system rather than the source of truth for progress.

## Progression worlds

| CEFR | Player fantasy | Language focus | Typical game pressure |
| --- | --- | --- | --- |
| A1 | Village newcomer | survival words, simple phrases, basic listening | recognition, matching, safe exploration |
| A2 | Helpful neighbour | everyday routines, directions, simple past/future | short sequences, timed but forgiving tasks |
| B1 | Independent traveller | connected speech, opinions, practical missions | multi-step quests and contextual choices |
| B2 | Confident collaborator | nuance, work/travel discussion, longer texts | distractors, trade-offs, evidence-based choices |
| C1 | Advanced explorer | precise vocabulary, inference, register, argument | branching missions, synthesis, subtle feedback |
| C2 | Master storyteller | idiom, ambiguity, rhetorical control, near-native nuance | open-ended challenges, dense context, expert judgement |

A level is not unlocked because a player watched an animation or accumulated cosmetic points. Trusted progression must come from versioned learning attempts and skill evidence.

## Shared game loop

1. Server issues an attempt with account owner, CEFR level, content version and rules version.
2. Client receives only the prompt and playable choices needed before answering.
3. Animation communicates context, state and feedback; it never grants learning XP from the render loop.
4. Player sends the actual choice, ordering, text or speech evidence.
5. Server grades objective tasks or records the provenance of AI/human-assisted evaluation.
6. The saved verdict updates mastery/review once. Network retries reuse the same attempt.
7. The same lifecycle powers multiple skins: village quests, festival games, travel missions, work scenes and later C1/C2 story arcs.

## First vertical slice

Word Link is the pilot. It now has server-owned A1, A2, B1, B2, C1 and C2 content. The start response does not expose the correct answer. Submit returns the authoritative verdict and correct answer for feedback. A repeated submit with the same answer returns the recorded result; a different answer for the same completed attempt conflicts.

Next migrations should reuse this contract rather than creating separate scoring logic: Grammar Repair, Sentence Builder, Collocation Factory, Reading Race, Listen & Pick and Dictation Rush. Speaking and IELTS need a separate evidence contract because transcript match, acoustic scoring and coaching estimates are not equivalent evidence.

## Animation principles

Characters should always have lightweight idle motion, reactions and contextual gestures. Correct answers can trigger celebratory animation; wrong answers should show a readable correction animation rather than punishment. A1/A2 scenes should be visually calm and concrete. B1/B2 can introduce denser scenes and mission chains. C1/C2 should become more cinematic and choice-driven, but language evidence must remain inspectable and versioned.
