# Fair playtest protocol

Roadmap: [CORE-007](ROADMAP.md#core-007--độ-khó-và-chiều-sâu-có-bằng-chứng).
Owner: Codex. Prepared 2026-11-05. This is a study plan, not a result report.
No participants have been recruited, no sessions observed and no difficulty
parameters tuned from human evidence. Status remains in ROADMAP only.

## What the study must answer

Can players understand a goal, make a meaningful decision, learn from an error
and choose to replay? Compare Practice, Adventure and Challenge separately.
Successful automated clears establish feasibility, not enjoyment or a balanced
curve. English level is not a proxy for motor ability or sequence memory.
Fair records are personal keepsakes, not evidence of English mastery.

Use the current [session contract](GAMEPLAY-FOUNDATION.md) and live catalog;
do not copy these observations into a second scoring engine. The source of
parameters is `lib/game/challenge.ts`, the source of rounds and hosts is
`backend/internal/fair/catalog.json`, and `FestivalSession` decides outcomes.

## Entry conditions

- Use an agreed, disposable staging environment and a specific tested source
  commit. Record the URL, commit, schema/migration versions and CI run before
  inviting anyone. No production deployment is authorized by this plan.
- Confirm saving, retry, account isolation, pause and phone controls on that
  environment first. Do not study a known data-loss or reward bug.
- Recruit consenting volunteers; explain they can pause or stop at any time.
  Use guests or dedicated test accounts without personal learning histories.
  Follow any applicable consent requirements before involving children.
- Ask for a self-reported English range A1–A2, B1–B2 or C1–C2, game familiarity,
  preferred input and optional accessibility needs. Do not infer a tested CEFR
  score, diagnosis or age from these answers.
- Plan an initial qualitative sample of two volunteers per range, with phone
  touch and keyboard/mouse represented across the sample. This is a recruitment
  target, not collected data or a statistically representative estimate.

Sessions can be split to avoid fatigue. Each volunteer tries two selected games
and at least two modes; rotate assignments so all eight games and three modes
are observed across the study. Rotate mode order between volunteers and note
prior practice rather than claiming an uncontaminated comparison. Do not force
a higher mode after repeated frustration; record a declined or stopped trial.

## Decisions and errors to observe

| Game | Intended learning/decision | Error distinction | Mode comparison |
| --- | --- | --- | --- |
| Bubble Meadow | Interpret an English clue and distinguish plausible meanings | Clue misunderstanding, wrong meaning, walking/target error | Fixed Practice clues vs seeded contextual choices; Challenge adds closer meanings and movement |
| Little Garden | Follow a seed/plant/water instruction in order | Wrong seed, wrong stage, wrong watering count, memory, navigation | Practice planting vs requested watering; Challenge hides the order after seven seconds |
| Echo Pond | Retain and reproduce an audiovisual sequence | Missed cue, sequence order, key/target confusion, sound unavailable | Practice 2–6 notes vs Adventure 3–7 and Challenge 4–8; does not test English listening comprehension |
| Tea Time | Interpret an order, sequence ingredients and time a brew | Order meaning, ingredient sequence, strength band, input delay | Separate recipe practice from visitor orders; advanced modes narrow bands and Challenge uses indirect requests |
| Parcel Trail | Interpret destination clues and plan a route | Place meaning, stop order, forgotten destination, navigation | One Practice delivery vs two/three stops; Challenge hides the order |
| Cloud Hop | Plan a route, jump and choose feather detours | Missed jump, hazard contact, camera/input, route planning | No countdown; advanced modes require one/all feathers, with wind and moving rings |
| Colour Studio | Read colour names and reason about equal parts | Wrong pigment, right pigments/wrong counts, total drops, unclear reference | Practice two drops; Adventure three; Challenge four with white. Compare ratio-guide use with exact-recipe assistance |
| Bridge Builder | Plan reciprocal path connections within a rotation budget | Disconnected ports, bank direction, wrong tile, exhausted budget | Same three authored topologies today; advanced rotations/turn allowance alone do not establish deeper topology |

The experiment should separate physical targeting or unreadable labels from
the decision being taught. Never call a small hit target a useful difficulty
increase. For Colour Studio ask the player to explain 1:2 vs 2:1 with the same
pigments. The game uses discrete authored recipes; swatches are illustrative,
not a physical pigment simulation or proof of colour-science accuracy.

## Current pressure parameters

These are a dated reading of the source, not new settings to apply:

| Game | Adventure | Challenge |
| --- | --- | --- |
| Bubble Meadow | 24 seconds/catch | 16 seconds/catch |
| Little Garden | 45 seconds/round | 35 seconds/round |
| Echo Pond | 18 seconds to answer; 3–7 notes | 12 seconds to answer; 4–8 notes |
| Tea Time | 45 seconds/order; 1 second steeping band | 30 seconds/order; 0.6 second band |
| Parcel Trail | 60 seconds/parcel; two stops | 45 seconds/parcel; three stops |
| Cloud Hop | No countdown; at least one feather | No countdown; all three feathers |
| Colour Studio | 45 seconds/mix; three drops | 30 seconds/mix; four drops |
| Bridge Builder | 90 seconds/layout; solved-path turns + 5 | 60 seconds/layout; solved-path turns + 2 |

General help/pause stops the active countdown. The automatic Echo demonstration
does not consume answer time. Exact recipe/order help and optional melody replays
have assistance consequences defined by the session. Observe comprehension of
that disclosure; do not silently make hints free to improve completion rates.

## Observation procedure

1. Record trial ID, source commit, mode, game, course/round, displayed goal and
   pseudonymous participant code. For a replayable defect, obtain only the run
   UUID/seed and generator version from a dedicated test checkpoint with consent.
   A resumed run retains its seed; a new run may have a different puzzle.
2. Let the player read the existing instructions. Ask “What will you try?” before
   supplying advice. Record whether the initial goal is understood in their
   words; do not mark completion itself as proof of comprehension.
3. Start an observer timer at the first active input. Track active solve time,
   pause/help time and observation wall time separately. The engine's stored
   elapsed value is a separate technical field; do not assume identical clocks.
4. Count incorrect submissions, timeouts, navigation/input mistakes, voluntary
   assistance and unsolicited observer help separately. Note whether feedback
   led to a changed strategy. A timeout that resets a round is not a new run.
5. Record win/loss, hearts, assistance, displayed stars, rounds reached, save
   state and interruptions. Keep incomplete trials with their reason. Do not
   exclude losses or unavailable saves to make a mode look easier.
6. Offer a fresh replay without a reward promise. Record accept/decline and the
   player's reason. Do not treat a prompted replay as organic retention.
7. Ask what was clear, confusing or frustrating, what changed in their approach,
   and whether the next mode required a different decision. Paraphrase without
   collecting names or identifiable quotations.

Observe both 390×551 and 390×844 layouts with real touch where available; browser
emulation supplements that evidence. Include keyboard navigation, sound off and
an optional reduced-motion trial. Record input/device differences alongside
results. Do not require a participant to disclose an accessibility condition.

## Minimal record template

Copy one blank row per trial into an access-controlled study record. This file
contains no synthetic participant results.

| Field | Record |
| --- | --- |
| Participant/trial code, date | |
| Self-reported English range, familiarity, input/device/viewport | |
| Source commit, CI run, staging/schema version | |
| Game, mode, course, round/seed version if needed | |
| First-run/resume/replay, mode order/prior exposure | |
| Goal understood before help; intended first action | |
| Active solve seconds / help-pause seconds / wall seconds | |
| Incorrect submissions / timeouts / input errors | |
| Voluntary hints / observer interventions | |
| Completion or stop reason; rounds, hearts, assistance, stars | |
| Local/queued/confirmed save; retry result if relevant | |
| Replay offered, accepted/declined, reason | |
| Feedback changed strategy? Confusion/frustration paraphrase | |

## Data and retention

This plan adds **no server telemetry, analytics endpoint or background capture**.
Collect manual observations only after consent, in a separate restricted study
record. Do not commit participant rows, tokens, email, IP, raw audio/video,
full checkpoints or personal learning answers to GitHub or public CI artifacts.
Keep recruitment contact details separate from trial codes if recruitment needs
them. Prefer no recording over collecting screenshots with account information.

Proposed retention: delete raw observation notes and any consented test-only
diagnostic reference within 30 days after the study; retain only anonymized,
non-identifiable aggregate findings and resulting parameter decisions in docs.
The study owner must confirm custody, consent and deletion arrangements before
collection. The repository does not currently enforce that manual retention.
Any future persisted telemetry needs a separate data/retention contract first.

## Decisions after the study

Report actual counts with denominators and exposure/input context. Summarize
completion, active time, errors, assistance and replay by game/mode/cohort; small
groups may need qualitative reporting to avoid identifying an individual. Do not
invent success thresholds after seeing the data or claim statistical certainty
from this small sample. Keep missing/incomplete trials visible.

Prioritize unclear instructions, wrong feedback and touch failures before
changing pressure. A tuning proposal must state the observed issue, affected
skill, parameter/contract change, regression plan and a follow-up human check.
Seed-generator changes require an explicit version/checkpoint decision.

Bridge topology expansion still needs design, solvability/budget checks and
human validation. Ratio-guide code alone does not establish Colour Studio's
reference quality. Neither this protocol nor a green build completes CORE-007;
the roadmap requires recorded playtests and evidence-based adjustments.
