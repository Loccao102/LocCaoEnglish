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
| Shadow Me | Guided transcript attempts store actual text/alignment/daily claim; signed acoustic feedback now retains sample-bound receipts without raw audio or rewards | Transcript matching is not pronunciation mastery; live provider calibration and wider evidence policy remain CORE-004/005 |
| IELTS Lab | Reading/Listening save original choices/results; Writing saves drafts/submissions/provider evidence; signed Speaking saves acoustic feedback independently | Receipt slices accepted; semantic mission depth, provider calibration and four-skill overall evidence remain |
| Campaign missions | All nine routes use ordered contextual rubrics, original dialogue receipts and atomic first-clear rewards; no fixed per-turn learning accuracy | Pattern-based reported dialogue is not semantic/fluency assessment; paraphrase coverage, prerequisite trust and fresh-evidence memory parity remain CORE-004/005/006 |

## Cross-system priorities

Acoustic acceptance, 2026-10-21 (CORE-004, [PR #20](https://github.com/Loccao102/LocCaoEnglish/pull/20),
main `99c8535`): signed
`SpeakingPractice` uses a dedicated receipt adapter bound to the owned phrase,
reported transcript and validated WAV hash. Provider feedback/history survive
reload without retaining or automatically resending audio. Explicit retries
need the original sample; failure never creates an acoustic score or reward.
Guest previews and transcript XP remain separate. See [ADR 009](decisions/009-acoustic-receipts.md)
and [validation](SYSTEM-VALIDATION.md#acoustic-receipts--2026-10-21).
Final head `b38ecf9` passed all six jobs at
[CI 149](https://github.com/Loccao102/LocCaoEnglish/actions/runs/39495797778),
including dedicated PostgreSQL/race/vet, real Go/Python failure/recovery and
**153/153 E2E (29.5m)** without retries/flaky tests. No production deployment or
live acoustic calibration claimed.

Writing acceptance, 2026-10-21 (CORE-004,
[PR #19](https://github.com/Loccao102/LocCaoEnglish/pull/19), main `40794e6`):
`WritingLab` uses `useWritingSession` and the dedicated server Writing contract.
Drafts sync on Save draft, browser recovery retains unsent edits, and submitted
essays stay immutable. Child revisions preserve their source and history. Provider
feedback must include four criteria, exact essay quotations and method/model
versions. Both browser and service word-count band fallbacks are removed; a
provider failure retains the essay without inventing a band. Completed Writing
receipts appear as provider estimates in IELTS history without learning rewards.
See [ADR 008](decisions/008-writing-receipts.md), [API](API.md) and
[ROADMAP](ROADMAP.md). No live provider calibration or production deployment claimed.
Final head `ceb477f` passed all six jobs at
[CI 145](https://github.com/Loccao102/LocCaoEnglish/actions/runs/39488459649),
including dedicated PostgreSQL/race/vet and 149/149 E2E without flaky retries.
Local final Writing coverage passed 13/13; Speaking acoustic persistence is next.

IELTS update, 2026-10-18 ([PR #18](https://github.com/Loccao102/LocCaoEnglish/pull/18),
main `b7b0333`): Reading and Listening now use `VerifiedIeltsPaper` and the shared
objective grader. Listening snapshots the original four parts/40 questions on
the server, hides keys/transcripts from active prompts, records per-part playback
and requires four completed reports before saving. Browser speech fallback
receives source text explicitly as assistance; reported playback is not proof of
human listening. Actual selections and wrong/blank verdicts survive exact retry,
reload and account boundaries. Atomic receipts preserve legacy history and
award no learning XP/confidence/review. Tally/legacy IELTS accuracy writes reject.
All six CI jobs and 136 browser/API cases passed on head `411163b`; see
[SYSTEM-VALIDATION](SYSTEM-VALIDATION.md) and [ADR 007](decisions/007-ielts-listening-evidence.md).
At that revision, Writing remained state-only with word-count heuristic bands and
no saved essay receipt; the implementation update above supersedes that finding.
Acoustic receipts and calibrated four-skill overall remain pending. No production deployment.

Historical IELTS update, 2026-10-16 (PR #17): `/ielts/reading` uses `VerifiedIeltsReading` and the
shared learning lifecycle. The server snapshots the original 40 questions,
grades opaque option IDs and saves one immutable result/history transaction,
without XP, confidence or review rewards. Reading tally and arbitrary band writes
are rejected. History requires an account and distinguishes server-checked,
client-reported and legacy estimates; the common dashboard no longer invents an
overall 6.0 or a chosen target. At that revision, Listening audio errors allowed
retry but its tally remained client-reported without an idempotent answer receipt;
the 2026-10-18 acceptance above supersedes that limitation. See
[ADR 006](decisions/006-ielts-reading-evidence.md) and the acceptance status in
[CORE-004](ROADMAP.md#core-004--speaking-mission-và-ielts-evidence).

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
