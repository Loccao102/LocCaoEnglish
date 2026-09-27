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
| Word Link | Server-issued shuffled options and snapshot grading replace the ineffective shuffle/client score; banks remain small | CORE-001 pilot adds atomic daily progression and retry/resume; shared lifecycle, richer distractors and ranked grading still need CORE-002/003/005 |
| Word Graph | Link Mode retains the answer edges and Connections inspector | Hide answer relations while attempting; distinguish exploration from assessed recall |
| Collocation Factory | Fixed option positions and very small default bank; copy promises pressure absent from implementation | Shared round engine, new distractors and honest mode descriptions |
| Sentence Builder | Chunk bank uses authored order, sometimes already the solution; Reset allows answer-exposed retry | Shuffle indexed chunks; record first attempt separately from assisted retry |
| Grammar Repair | Fixed options, obvious errors in a short default bank | Varied distractors, presentation randomization and evidence-based difficulty |
| Reading Race | Two fixed passages and recurring answer positions | More passage/question types; optional pacing after answer/evidence model is sound |
| Story Choice | Obvious polite/rude branches; short scripted ending | Add plausible alternatives, persistent consequences and different valid solutions |
| Listen & Pick | Active route uses `ListeningPractice`; fixed options and unrestricted replays | Track replay assistance, broaden listening tasks and make fallback behavior explicit |
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
`MiniGames.ListeningPick` is not the active `/listening` implementation. Remove
or consolidate these obsolete paths during the learning-engine migration.
