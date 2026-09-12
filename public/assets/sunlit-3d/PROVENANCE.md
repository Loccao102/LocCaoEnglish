# Sunlit Village 3D

These models were authored in this repository as original procedural mesh art for LocCao English. No existing game models, textures, characters or franchise designs were imported.

The source of truth is `lib/game/three/`: character hierarchy, six animation clips, seven buildings, terrain, roads, a bridge, trees, plants, props, word seeds and hinged chests. Mesh colours follow the project's Sunlit Village palette. No raster image is used to render the in-world player, NPCs, buildings or terrain.

The four `.glb` companion files contain rigid articulated joints and animation clips named `idle`, `walk`, `run`, `jump`, `wave`, and `celebrate`. They use glTF 2.0, Y-up, with the character facing +Z. This is a rigid mesh rig, not a deformable skin with painted bone weights.

`village.glb` is a reusable static world export; gameplay logic, camera control, simulated water, wind, pickup behavior and chest interaction remain in the game source. Browser-generated text labels are omitted from the export.

The collection also includes seven individual building files, `bubble-tree.glb`, `field-chest.glb`, `word-seed.glb` and `butterfly.glb`. These modular exports reset their root transform to the local origin for placement in another scene. Doors and chest lids retain their named transform groups; their runtime interactions are implemented in code. The complete collection is bundled as `sunlit-3d-pack.zip` alongside this folder.

Regenerate the files with `npm run assets:3d`. The manifest records each export's SHA-256 digest and animation names. Runtime construction shares the source factories, so it does not depend on downloading these GLB files.

Three.js is used under its MIT license. Its package license remains in the dependency. The new authored game art follows this repository's ownership and licensing terms; no independent third-party art license is asserted.
