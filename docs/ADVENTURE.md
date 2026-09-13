# The Seven Sun Pages

The home screen is a 3D exploration game. Three.js renders original mesh characters, buildings, terrain and objects in a perspective world. The existing study tools remain in a separate learning journal.

## Player journey

1. Begin or continue an adventure from the title screen.
2. Walk around Sunlit Village. The camera follows the character; buildings, the pond and the shoreline have collision boundaries.
3. Approach a guide or choose an open destination on the map to walk there automatically.
4. Start one of the guide’s unlocked quests. Each quest has three English challenges with feedback after each answer.
5. Answer at least two correctly to earn two or three stars. A failed run gives no currency or chapter progress and can be retried immediately.
6. Collect XP and sun coins on the first successful clear. Replays can improve stars without awarding currency again.
7. Complete the second quest in each place to restore a Sun Page and unlock the next chapter.
8. Spend sun coins on companions in the bag. All 24 companions have the same gameplay abilities. Twenty new friends are available to equip for free.
9. Restore all seven pages for the story ending, then explore, replay, or open additional practice.

There is no timer or paid energy. Listening uses browser speech synthesis on demand, with a transcript available when audio is unavailable or unwanted. The original Sunlit Village art direction carries into the 3D models. The live world does not use flat character or building images; the illustration collection supplies interface portraits, maps and rewards. No third-party game art was introduced.

Optional exploration adds eight word seeds and three chests with hinged lids. Walking near a seed collects a word and its meaning in the bag; opening a chest reveals a village note. Field notes are device-local souvenirs and do not award server XP or coins.

## Content

| Chapter | Place | Quests |
| --- | --- | --- |
| 1 | Pagewood School | A little hello; The first sun page |
| 2 | Little Words Café | One warm conversation; A table for two |
| 3 | Sunrail Station | A ticket somewhere new; The missing departure |
| 4 | Word Conservatory | Plant a word garden; The page that blooms |
| 5 | Pencilworks Studio | Make a plan together; A promise you can keep |
| 6 | Recall Amphitheatre | The word festival; A festival for everyone |
| 7 | Sunpage Lighthouse | Climb toward the light; The story we made |

The canonical titles, prose, questions, positions, prerequisites and rewards are in `backend/internal/adventure/catalog.json`. Both TypeScript and Go consume this file. It contains 14 quests and 42 questions. There are 1,050 adventure XP and 280 sun coins available from first clears. The original four companions retain their 0 / 50 / 80 / 120 coin prices; the twenty added characters cost zero. Existing purchased IDs and saves remain valid.

## Controls and routes

| Action | Control |
| --- | --- |
| Move | WASD, arrow keys, touch direction pad |
| Run | Hold Shift, or toggle Run |
| Jump | Space or Jump button; solid collision boundaries still apply |
| Camera | Right-drag to orbit; wheel or buttons to zoom; R to reset |
| Walk to a point | Click/tap the ground |
| Walk to a guide | Click the guide/building or choose an open map destination |
| Talk / open chest | E or the nearby interaction button |
| Journal / Map / Bag | J / M / B or the toolbar |
| Pause | Escape or the pause button |

Losing browser focus pauses the game and clears held movement inputs. Modal panels suspend world controls and contain keyboard focus. Speech stops when a challenge is paused or closed. Reduced-motion settings disable decorative world animation and particles and remove camera easing. Essential movement and interaction animations remain visible. The HUD includes a mute control for synthesized footsteps, jumps, pickups and chest sounds; sound starts only after a player gesture.

| Route | Role |
| --- | --- |
| `/`, `/play` | Fullscreen adventure |
| `/worlds` | Adventure with map opened after Begin/Continue |
| `/camp` | Learning journal, adaptive daily quests and practice links |
| `/progress` | Existing learning XP, world evidence, trophies and cosmetics |
| `/account` | Sign in/register and account profile |
| `/art-studio` | Original asset gallery and downloads |
| `/characters` | 24-character roster, 3D turntable, six animation previews and individual GLB downloads |
| Existing practice routes | Retained; accessible through guides and the learning journal |

## Code structure

- `components/game/AdventureGame.tsx`: title, world, HUD, dialogue, pause and game flow.
- `components/game/WorldCanvas.tsx`: client-only lazy renderer loading, WebGL error/retry UI and lifecycle cleanup.
- `components/game/useWorldController.ts`: camera-relative input, acceleration, braking, jump gravity, movement substeps, proximity, automatic walking and positional autosave. It exposes a simulation step; the renderer owns the single frame loop.
- `lib/game/three/renderer.ts`: perspective camera, raycast interactions, lighting, shadows, NPC behavior, animation selection, pickups, doors, chests and particles. Scene transforms update outside React.
- `lib/game/three/characters.ts` and `character-details.ts`: chibi mesh rigs, species shapes, faces, hats, outfits, props and six named animation clips per companion; no raster sprites or deformable skin weights.
- `lib/game/companions.ts`: lookups and activity-host mappings from the same canonical catalog as the Go service.
- `lib/game/three/portraits.ts`: a single temporary WebGL renderer queues portraits of the actual models, caches the resulting images, then releases its graphics context.
- `components/game/CharacterShowcase.tsx`, `CharacterPreview.tsx` and `CompanionCollection.tsx`: collection browsing and animated previews, also reused in the Bag.
- `components/game/LearningCompanion.tsx`: the matching friend greets learners on each of 24 learning routes.
- `lib/game/three/environment.ts`: original mesh factories for the island, lagoon, bridge, roads, seven buildings, trees and props.
- `lib/game/three/primitives.ts`: shared geometry/material ownership, static geometry merging and interface labels.
- `lib/game/three/audio.ts`: original synthesized effects, unlocked by gesture.
- `lib/game/discoveries.ts`: word seeds and chest-note content.
- `lib/game/world.ts`: shoreline, collision movement and A* navigation. Path endpoints connect to visible, walkable grid points and paths avoid diagonal corner cutting.
- `lib/game/scenery.ts`: decorative placement and collision shapes.
- `components/game/QuestChallenge.tsx`: question interaction, feedback, completion submission, retry and results.
- `components/game/AdventurePanels.tsx`: journal, map and companion inventory.
- `components/game/GameDialog.tsx`: keyboard focus handling for overlays.
- `components/game/useAdventure.ts`: identity, guest persistence, account requests and save errors.
- `lib/game/progress.ts`: guest grading, progression and restoration of versioned saves.
- `backend/internal/adventure/`: shared content and authoritative action rules.
- `backend/internal/store/adventure.go`: atomic account saves and learning evidence.
- `backend/internal/httpapi/adventure.go`: authenticated HTTP endpoints.
- `app/adventure.css`: scoped game presentation and responsive controls.
- `scripts/export-3d-village.mjs`: reproducible GLB and ZIP production from the runtime model factories, including hashes and provenance.

The bridge is traversable through a narrow channel across the lagoon collider. Jumping is a grounded exploration animation with gravity, not a way to bypass buildings or island boundaries. Building doors respond to proximity, while their guides launch chapter challenges; separate indoor levels are not part of this version.

The 3D pack in `public/assets/sunlit-3d/` contains 36 GLB files: twenty-four animated characters, seven buildings, four small environment assets and one complete world. Modular exports are centered at their local origin. The full world is a static scene export; browser labels, game logic and environmental animation remain in source. Runtime factories avoid downloading the large world export. WebGL 2 is required, with an explicit recovery message when unavailable. Pixel ratio and shadow resolution are capped on small screens, but device performance has not been benchmarked.

## Persistence contract

Guest storage uses `loccao.adventure.guest.v1` and contains the versioned save, position, whether the adventure has started, and tracked quest. Invalid saves fall back to valid initial state; restored XP and coins are reconstructed from contiguous quest completion and owned companions. Local guest saves are user-editable and do not grant account rewards.

Account save endpoints require a real bearer token even when legacy anonymous demo mode is enabled:

```text
GET  /v1/adventure
POST /v1/adventure/actions
```

```json
{"kind":"complete","questId":"first-hello","answers":["Nice to meet you.","My name is Mam.","I’m good, thanks."]}
```

```json
{"kind":"equip","character":"nang"}
```

The server accepts answers and companion IDs, never client-supplied XP, coins or completion flags. It grades against the shared catalog, checks prerequisites and prices, and returns the updated save and completion verdict. Retried successful quest submissions cannot grant a second reward. Companion purchases are also safe to retry: an already-owned companion is simply equipped.

PostgreSQL stores each account save in `player_adventures`. `EnsureAdventure` applies the table definition at API startup; `backend/migrations/010_adventure.sql` contains the same idempotent DDL. An action holds a row lock and updates the save, first-clear account XP, skill evidence and review items in one transaction. The existing in-memory development store also supports adventure actions, but its data disappears on server restart; the game displays this limitation.

Position, tracked quest and field notes are stored locally per account under `loccao.adventure.meta.<playerId>.v1`. Field-note IDs are validated against the authored catalog. Quest progress, XP, coins and companion ownership are server-owned. Current challenge answers survive an in-tab pause, but are deliberately discarded when leaving the challenge or reloading; completed quests are retained.

A signed-in connection error offers retry, sign-in or an explicit separate guest adventure. It does not silently substitute the shared demo player. An action error preserves the submitted answers so the player can retry. Guest saves are not uploaded automatically on sign-in.

## Running and delivery status

The frontend can run the guest adventure with `npm run dev` without the API. For account saves, run the complete stack with the repository’s documented `docker compose up --build` command. Production accounts need PostgreSQL for durable storage. Frontend and API must be deployed together because the game uses new adventure endpoints.

The Next.js production build, including TypeScript compilation, was completed during implementation. Automated gameplay, browser, integration and backend test suites were not run after the user requested skipping testing. Backend test files authored before that request remain available, and old browser specifications were updated to follow the relocated study routes. This is an implementation handoff, not a claim that end-to-end gameplay has been validated.

The existing AI conversations and pronunciation tools retain their own service requirements.

