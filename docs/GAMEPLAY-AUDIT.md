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
| Dictation Rush | Positional comparison ignores extra trailing words; editing after feedback permits repeated attempts | Token alignment and one submission per attempt; keep correction practice separate from new evidence |
| Shadow Me | Transcript matching and optional acoustic assessment represent different evidence; repeated analysis can submit again | Typed evidence provenance and attempt idempotency; do not treat transcript matching as pronunciation mastery |
| IELTS Lab | Multi-section practice hub, not one minigame; writing/speaking include coach estimates | Preserve estimate labels and separate objective scores from heuristic/acoustic evidence |
| Airport Boss | Active route uses `TravelMission` and server objective evaluation; conversation attempts nevertheless report fixed 0.85 accuracy | Remove fixed learning accuracy; replace substring-only objective coverage with stronger, ordered evidence |

## Cross-system priorities

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

`components/AirportMission.tsx` contains an older three-turn automatic claim, but
`app/missions/airport/page.tsx` renders `TravelMission`, and the current backend
requires evaluated objectives for a claim. The old component is not evidence
that the current route auto-wins after three arbitrary messages. Likewise,
`MiniGames.ListeningPick` now re-exports the active `ListeningPractice`; the obsolete
client grader and duplicate listening bank were removed in CORE-003. The older
AirportMission component remains separate debt for the mission migration.
