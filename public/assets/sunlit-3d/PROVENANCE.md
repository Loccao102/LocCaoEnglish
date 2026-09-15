# Sunlit Village 3D

These models were authored in this repository as original procedural mesh art for LocCao English. No existing game models, textures, characters or franchise designs were imported.

The source of truth is `lib/game/three/`: character hierarchy, six body animation clips, eight facial expression clips, seven chapter buildings, eight fair pavilions, terrain, roads, two bridges, trees, plants, props, word seeds and hinged chests. Mesh colours follow the project's Sunlit Village palette. No raster image is used to render the in-world player, NPCs, buildings or terrain.

The 24 `.glb` companion files contain rigid articulated joints and animation clips named `idle`, `walk`, `run`, `jump`, `wave`, and `celebrate`. They use glTF 2.0, Y-up, with the character facing +Z. This is a rigid mesh rig, not a deformable skin with painted bone weights.

`village.glb` is a reusable static world export; gameplay logic, camera control, simulated water, wind, pickup behavior and chest interaction remain in the game source. Browser-generated text labels are omitted from the export.

The 45-model collection also includes `friendship-fair.glb`, eight individual `fair-*.glb` pavilions, seven chapter building files, `bubble-tree.glb`, `field-chest.glb`, `word-seed.glb` and `butterfly.glb`. These modular exports reset their root transform to the local origin for placement in another scene. Doors and chest lids retain their named transform groups; their runtime interactions are implemented in code. The complete collection is bundled as `sunlit-3d-pack.zip` alongside this folder.

Regenerate the files with `npm run assets:3d`. The manifest records each export's SHA-256 digest and animation names. Runtime construction shares the source factories, so it does not depend on downloading these GLB files.

Three.js is used under its MIT license. Its package license remains in the dependency. The new authored game art follows this repository's ownership and licensing terms; no independent third-party art license is asserted.

Version 2 rebuilds the cast in a chibi style, using the project-owned `public/assets/sunlit-village/characters.png` as the reference for the four original friends. Mầm uses a cream bean silhouette, teal leaf crest, coral scarf and satchel; Nắng uses warm yellow, round glasses, a curled leaf and book; Mây uses blue, a coral cap and a map; Sỏi uses coral, teal overalls and a pencil. Twenty additional designs introduce animal, plant and sky silhouettes with authored hats, outfits, props and activity roles. No external character art was used.

All interface portraits in the new roster are rendered locally from the live 3D factories. They are cached in browser memory, not external image-generation outputs. This is a stylistic mesh interpretation of the reference, not an exact reproduction of painted texture or illustration shading. The character catalog and artwork choices are documented in `docs/CHIBI-CAST.md`.


Version 3 rounds the head, belly, mittens and animal ears further. Each character has an individual idle rhythm and eight facial states: happy, joy, curious, thinking, surprised, sad, sleepy and love. Expression clips are named expression-<state>; play one alongside a body clip. Stop the previous expression clip before activating another, or use an immediate transition, because intermediate scale blends can overlap facial features. Inactive facial groups have zero scale in GLB and are hidden by the runtime. All expression groups are included in the export.

The southern Friendship Fair is connected to the original island by a wooden promenade. Its eight original game pavilions and a separate fairground scene are included in this pack. The full fairground retains world coordinates; individual stalls reset to the local origin. Browser text labels and gameplay are provided by source code, not the static GLB scene.

The pack includes character-bible.json with all 24 designs, traits, stories, favourites, dreams and mannerisms, plus fair-games.json with eight game definitions and friendship memories. No third-party character art or story was used.
