# Gameplay audit · 27 September 2026

Scope: the 20 entries linked from `/games`, their active route components and
shared progression code. The table is a code/design audit; it is not a claim
that all learning activities received a full manual playthrough in this pass.

| Entry | Finding | Status / next core action |
| --- | --- | --- |
| Bubble Meadow | Original answers and positions were fixed | New seeded clues, choice ordering, clocks and moving Challenge targets; expand/context-test the small bank later |
| Little Garden | Selecting the named seed was the whole round | Added planting/watering sequence and memory demand; needs playtest tuning |
| Echo Pond | Fixed expanding melody, free replays | Seeded melodies, escalating length/speed and assistance accounting |
| Tea Time | Original recipe copied directly from prompt | Advanced modes always use visitors; narrower timing and indirect Challenge requests |
| Parcel Trail | Address repeated the answer | Multi-stop routes, indirect clues and memory demand |
| Cloud Hop | Completion independent of exploration | Required feathers and stronger Challenge movement; atlas records still aggregate across modes |
| Colour Studio | Only four fixed pairs | Ratio-sensitive mixtures; shade names/recipes still need a clearer teaching reference and calibration |
| Bridge Builder | Fixed rotations, unlimited trial turns | Seeded unsolved starts, path validation and solvable turn budgets; still three authored topologies |
| Word Link | A1–C2 server-owned content and shared recovery lifecycle now replace client scoring | Snapshot/version grading, guest isolation and daily progression claims added; content depth and competitive integrity still need work |
| Word Graph | Exploration now only teaches; separate server-graded practice hides edges/definitions/Connections and records the chosen word | Nine contextual travel relations, shared recovery and legacy-score rejection; practice does not claim unaided recall of a publicly available study map; expand/calibrate only after core migration |
| Collocation Factory | Previously fixed positions, repeated items within a set, and a legacy accuracy bypass | Contextual server catalog with three distinct questions per selectable level, readable choices, actual-answer feedback and legacy-route rejection; CEFR calibration and broader campaign selection still need work |
| Sentence Builder | Server snapshots now shuffle opaque chunk IDs, grade actual order, close feedback rounds and restore drafts/pending submissions; 27 contextual core/campaign items | Calibrate editorial CEFR tiers and playtest depth; correction/assistance modes remain out of scope and cannot award unassisted evidence |
| Grammar Repair | A1–C2 and campaign content now use the same server attempts/recovery hook as Word Link | Preserve varied distractors and level/pack identity; validate depth through playtests |
| Reading Race | Server snapshots replace client accuracy; nine A2–B2 passages, actual selections and post-submit evidence explanations | Three distinct passages per set, shared recovery, full passage in review and legacy rejection; CEFR calibration, wider content and optional pacing still need work |
| Story Choice | Server-owned five-scene decision graph with four endings, multiple effective opening choices and recovery branches; immutable decisions and one child per parent | Snapshot graph/history, owner/retry/expiry, readable controls and legacy rejection replace client scoring; more scenarios and B1 calibration need playtests |
| Listen & Pick | `/listening` uses server-owned choices/grades, recorded normal/slow playback and explicit browser fallback; 18 clips across six packs | More levels and measured difficulty remain; reported playback is not proof of unaided listening |
| Dictation Rush | `/dictation` uses server token alignment, immutable actual response, audio journal and owner-scoped drafts; 9 sentences at A2/B1/B2 | Guided practice; editorial difficulty still needs player calibration; broader bank and correction practice remain future work |
| Shadow Me | Guided transcript attempts now store actual text, server alignment and daily claim; coach/acoustic feedback is separate and cannot award XP | Transcript match is not pronunciation mastery; persistent acoustic receipts, provider validation and wider evidence policy remain CORE-004/005 |
| IELTS Lab | Reading/Listening submit client-computed tallies without original selections/version; Writing/Speaking do not currently save bands through their active UI | Migrate Reading to server-owned evidence-only receipts first, preserve legacy history and correct dashboard provenance/overall labels; see CORE-004 |
| Campaign missions | All nine routes use ordered contextual rubrics, original dialogue receipts and atomic first-clear rewards; no fixed per-turn learning accuracy | Pattern-based reported dialogue is not semantic/fluency assessment; paraphrase coverage, prerequisite trust and fresh-evidence memory parity remain CORE-004/005/006 |

## Cross-system priorities

IELTS route audit, 2026-10-12: `IeltsObjectiveMock` sends `correct`/`total` to
`/v1/ielts/objective-score`; each save creates a new history row, without request
identity. `/v1/ielts/band` accepts a client band/source, but `recordBand()` has no
active caller. Anonymous-demo handlers share the demo history. Listening marks
a part played before audio starts, so failure prevents replay. The common
dashboard also returns hardcoded IELTS 6.0/target 7.0. These are confirmed code
findings, not fixes delivered in the mission PR. The next bounded implementation
and acceptance criteria are in [CORE-004](ROADMAP.md#core-004--speaking-mission-và-ielts-evidence).

Update 2026-10-11: the nine CORE-003 routes and compatibility exports now share
the verified attempt lifecycle. A cross-activity audit found that Word Link and
Grammar could abandon a pending answer through their level selectors. The shared
hook now owns that permission and rejects stale transitions. Obsolete Grammar
client grading and duplicate Word Link/Grammar banks have been removed; Speaking
prompts are preserved. Acceptance evidence is linked in [ROADMAP](ROADMAP.md).
The original findings below remain historical context for CORE-004/005/007.

**P0 — learning evidence integrity.** The generic attempt API accepts reported
accuracy; several clients send the expected answer as the `answer` field. A
shared server-graded attempt model is needed before using these values for
mastery, competitive rankings or difficulty adaptation. Repetition and practice
are legitimate, but must not masquerade as fresh unassisted evidence.

**P1 — answer leakage and replay depth.** Many activities can be solved by
remembering option positions rather than language. Randomization alone is not
depth: content needs plausible distractors, varied objectives and meaningful
consequences. The fair foundation introduced in this increment handles rule
variation and persistence; the learning activities still need their own shared
attempt lifecycle.

**P1 — consistent progression meaning.** Story first-clear rewards, learning XP,
fair keepsakes, course badges and IELTS estimates represent different things.
Keep those contracts explicit. Fair difficulty stars now have separate records;
course atlas medals are still shared.

**P2 — tuning and instrumentation.** No measured evidence yet establishes a
balanced beginner-to-Challenge curve. Add opt-in/appropriate playtest analytics
and use failure reasons, assistance rates and replay behavior to tune the rules.
Keep readable labels and pause support while adding pressure.

## Dead-code caveat

`components/AirportMission.tsx` was an unused older three-turn automatic claim.
After verifying all nine `/missions/*` routes import `TravelMission`, it and its
unused score-only client helper were removed in the CORE-004 mission slice. Likewise,
`MiniGames.ListeningPick` now re-exports the active `ListeningPractice`; the obsolete
client grader and duplicate listening bank were removed in CORE-003.
