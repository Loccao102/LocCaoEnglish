# The Friendship Fair

The fair is an original southern island in Sunlit Village. Eight neighbours each built an activity around their own talent. It is available from the adventure toolbar, the map, `/festival`, and the southern bridge. All games are open without chapter or currency gates.

## Games

| Game | Host | Mechanic | Completion |
| --- | --- | --- | --- |
| Bubble Meadow | Mầm | Walk into a floating word bubble matching a written clue; click-to-walk and keyboard movement | 5 catches |
| Little Garden | Cốm | Pick a seed, carry it to the bed and plant it; exchange a seed before planting | 3 plants |
| Echo Pond | Giọt | Watch and hear four stones, repeat a growing sequence; replay the cue as needed | 5 melodies of 2–6 notes |
| Tea Time | Moca | Build an ordered three-ingredient recipe, then serve; clear the cup without a penalty | 3 recipes |
| Parcel Trail | Quýt | Collect a parcel and walk it to the library, bakery or greenhouse named in the address | 3 deliveries |
| Cloud Hop | Mây | Move and jump through ordered rings, avoid puddles and return to a checkpoint on a mistake | 6 rings |
| Colour Studio | Dâu | Combine two primary/white paint pots into a requested colour; see the mix on a flower sculpture | 4 mixes |
| Bridge Builder | Sỏi | Rotate nine path tiles, connect reciprocal edges from entrance to exit, and send a boat | 3 layouts |

Each session starts with three hearts. Mistakes show specific feedback and remove one heart. A successful round awards 100 points; completing a game adds 25 points per remaining heart and records 1–3 stars. A finished game unlocks its host's friendship memory. Replays can improve best scores and stars. There is no countdown, payment, energy gate or account-currency reward.

The 3D arena uses the same original companion factory as the village and character page. Walking games have acceleration and braking, click destinations, contact-triggered interactions, bounded ground, solid building/bed/post-box bases and visible carried items. Cloud Hop adds vertical velocity, gravity, airborne ring collection and hazard checkpoints. Recipe games show ingredient layers or mixed paint. Bridge Builder validates a connected graph, then moves a little boat along the successful path. Correct actions produce a celebration; mistakes produce a sad expression and encouraging feedback.

## Source structure

- `lib/game/festival.ts`: typed game catalog, stall positions and shoreline; metadata comes from the Go-embedded `backend/internal/fair/catalog.json`.
- `lib/game/festival-session.ts`: session state machine, round data, recipes, sequence playback and path connectivity.
- `lib/game/three/festival-arena.ts`: scene geometry, player simulation, ray picking, audio cues and visual reactions.
- `lib/game/three/fairground.ts`: island, promenade, entrance, central sculpture and eight modular pavilions.
- `components/game/FestivalGame.tsx`: instructions, HUD, accessible choice controls, touch movement, pause/help/result dialogs and saving completed results.
- `components/game/FestivalHub.tsx`: game discovery and friendship scrapbook.
- `components/game/FairProgressProvider.tsx` and `lib/game/fair-progress.ts`: verified account identity, durable browser queue, legacy guest migration and idempotent uploads.
- `backend/internal/fair`, `backend/internal/store/fair.go`: account records, score rules and transactional completion ledger.
- `components/game/PlayerJourney.tsx` and `lib/game/journey.ts`: shared story timeline, 24 companion milestone sets, next activities and companion selection.
- `lib/game/personalities.ts`: 24 original character profiles and eight expression definitions.
- `lib/game/three/expressions.ts`: curved facial meshes and portable expression animation clips.

## Persistence and input

Guests retain the original `loccao.friendship-fair.v1` scrapbook as a baseline. New guest completions use an append-only local journal; duplicate run IDs cannot add a second visit. Accounts use authenticated `GET /v1/fair` and `POST /v1/fair/completions`, with a UUID per completed run. Go validates known games and 1–3 stars, derives scores, and commits the run ledger and account summary atomically in PostgreSQL. Account saves never merge with guest saves automatically.

Completed account runs are queued under a distinct browser key per account and run before upload. Lost responses can retry safely; queued records survive page navigation and reload and can sync on reconnection or Retry sync. A verified account can reopen its cached scrapbook offline; a new or expired session must connect/sign in. The UI distinguishes local, queued, confirmed account and temporary memory-server states. Fair results are personal client-reported keepsakes and do not award learning evidence, XP, coins or competitive points.

`/journey` derives three friendship milestones for every one of the 24 characters: a chapter greeting quest, a restored chapter page and one fair memory. Complete all three to reveal the character’s dream. The same page links story progression, deeper learning and fair activities, and saves companion selection through the adventure service.

Current rounds, carried items and partial recipes remain in memory only. Pause/help preserves a round while the page stays open. Leaving a game discards an unfinished round. Winning records the result once for that session. Window blur and document hiding pause play until explicitly resumed. Muting removes sound while the numbered visual cue sequence remains available. Reduced motion suppresses decorative bobbing and idle loops while intentional movement and game cues remain visible.

Mouse/touch can select 3D objects; non-walking games also provide regular buttons and number keys. WASD/arrows and touch arrows move the companion in walking games. Space or the Jump button triggers Cloud Hop jumps. Escape pauses or resumes. Dialogs trap focus and make the playfield/UI inert.

## Asset delivery

`npm run assets:3d` exports the runtime factories as 45 GLBs: 24 characters, 7 chapter buildings, 8 fair pavilions, 4 small environment assets, the complete village and the fairground scene. Each companion includes 6 body clips and 8 expression clips. The ZIP includes the manifest, provenance, `character-bible.json` and `fair-games.json`. Original illustration files are unchanged.

See [system validation](SYSTEM-VALIDATION.md) for the current build, backend, PostgreSQL, AI and browser results. Round timers use elapsed time independently of physics frame caps; bubble click-to-walk uses a clear approach lane, and software rendering disables expensive shadows.
