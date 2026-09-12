# Sunlit Village / Làng Nắng — provenance and usage

Created for LocCaoEnglish on 2026-09-12.

## Origin

- `characters.png`, `buildings.png`, `props.png`: generated with the built-in OpenAI ImageGen tool from the original prompts in `prompts.json`. No reference images, named game styles, stock packs, third-party game files or franchise characters were supplied.
- `paths/*.svg`, `village-map.svg`, `village-mark.svg`: original geometric sources authored for this project. Rebuild with `node scripts/build-sunlit-assets.mjs` in the repository.
- Art direction: cream seed companions with leaf silhouettes and speech-bubble accessories; curled book-page architecture; lagoon, mint, honey and coral colors; upper-left daylight.
- Original generated PNG files are preserved, including embedded provenance metadata and alpha. Atlas cells are displayed through CSS; the application does not remove backgrounds or modify the original illustrations.

## Scope of the pack

41 reusable entries: 4 characters, 9 buildings, 16 props, 10 modular paths, 1 terrain map and 1 emblem. The 29 bitmap illustrations are atlas regions, not 29 separate PNG files. No animation frames, skeletal rigs, 3D meshes, audio or collision meshes are included in this 2D web pack.

Characters: Mầm (explorer), Nắng (librarian), Mây (wayfinder), Sỏi (maker). Names and shapes were developed for this brief, not adapted from a named franchise.

## Reuse and rights record

These files were commissioned for use and modification in LocCaoEnglish. No third-party asset license was accepted or bundled. No additional open-source or stock license is declared for the art by this delivery; repository ownership and the account's applicable generation terms govern use. Generated output is not a guarantee of worldwide uniqueness or trademark clearance. The record documents the creation process, not a legal clearance opinion.

## Technical format

- Atlas grids: characters 2×2, buildings 3×3, props 4×4. Row-major, zero-based coordinates in `manifest.json`.
- Derive a source region from actual dimensions: x0 = round(column × width / columns), x1 = round((column + 1) × width / columns); same rule for y. This accommodates fractional cell dimensions without pretending a fixed pixel size.
- CSS sampling: background-size = columns×100% rows×100%; position = column/(columns−1)×100%, row/(rows−1)×100% (zero for a single cell).
- Map terrain: 1200×820 SVG. The seven interactive buildings, decorative props and character are separate layers in `data/village.ts` and `VillageMap.tsx`.
- `village-illustrated.svg` assembles that same scene into one portable SVG with embedded, unchanged PNG atlas bytes. It has no player progression or interactivity. Export with `npm run assets:export` on Node 22.18+.
- Paths: 256×256 transparent top-down SVG; edge ports centered at pixel 128, 68px outer road width, 60px cream surface. Rotate T-junctions to obtain the remaining orientations. These are assembly pieces for map/UI use, not perspective-matched 3D floor meshes.
- `checksums.json` binds the delivered files to SHA-256 hashes. Verify with `npm run assets:verify`. The archive includes a copy of the editable geometry generator and map placement data.
