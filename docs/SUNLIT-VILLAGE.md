# Làng Nắng — Sunlit Village art direction and integration

The learning world is a small sunlit lagoon village. Its memorable detail is a shared shape language: words become speech-bubble windows, roofs turn like book pages, and the companions are seeds growing into confidence. Warm paper, honey and coral balance lagoon teal and green foliage. Lighting comes from the upper left. Do not introduce franchise-shaped silhouettes, branded accessories or copied maps.

## Deliverables

The reusable pack lives in `public/assets/sunlit-village/`; `public/assets/sunlit-village-pack.zip` is the downloadable delivery. `/art-studio` previews all 41 entries with category filters and downloads. Generated bitmap art retains its original transparent PNG bytes; editable SVG provides terrain, paths and the emblem. `village-illustrated.svg` is a standalone export of the complete map with embedded artwork, usable without the app. Exact prompts, provenance, SHA-256 hashes and the manifest are included.

| Category | Count | Source |
| --- | ---: | --- |
| Seed and pebble companions | 4 | characters.png, 2×2 |
| Learning buildings and homes | 9 | buildings.png, 3×3 |
| Nature, props and rewards | 16 | props.png, 4×4 |
| Modular paths | 10 | paths/*.svg |
| Terrain map | 1 | village-map.svg |
| Speech seed emblem | 1 | village-mark.svg |

## Visual rules

- Palette: ink #234F48, lagoon #258F86, leaf #B7DFB0, honey #F4C45E, coral #E88772, paper #FFF5D8.
- Display type: Trebuchet MS with system fallbacks; body uses the application's existing system stack. No external font requests.
- Preserve generous padding around each atlas region; do not place text inside artwork. HTML carries labels, progress and access state.
- Characters use a friendly three-quarter front view. Buildings and props use a raised three-quarter view. Paths are deterministic top-down map construction pieces.
- Use the same silhouette at every size. Minimum useful illustration size: roughly 64px; detailed buildings are strongest above 100px. Use the separate emblem for the 38px sidebar brand.
- Muted saturation plus a text label indicates locked destinations. Selected places have an ink label. Color alone never communicates state.

## Application wiring

`GameArt` resolves stable IDs from the manifest. `VillageMap` combines SVG terrain, static decorations and seven keyboard-operable destination buttons. The selected destination shows the current API title, description, progress and unlock condition. Only an unlocked world receives an entry link.

The offline state displays an explicitly labeled preview and no invented XP, unlocks, achievements or inventory. Unknown future API worlds continue to appear in the full detail list, with a fallback building; add a placement to `data/village.ts` to put them on the illustrated map.

Integrated surfaces: Camp welcome scene; World Select building cards; World Map and its world list; campaign spotlight buildings; daily chest state; profile and onboarding goal companions; sidebar emblem and companion. Existing backend access rules, lesson routes, reward API and learning logic are unchanged. Companions in profile/onboarding are tied to the goal, and are not advertised as an additional unlockable cosmetic system.

The map keeps a 740px minimum internal canvas on mobile, scrolls inside its own region, and leaves the surrounding page at viewport width. Tab focus and touch can reach every place. Reduced motion removes hover travel. All art is local; there are no additional runtime asset services or JavaScript dependencies.

## Rebuilding and validation

```bash
npm ci
npm run assets:build
npm run assets:export
npm run assets:verify
npm run typecheck
npm run build
npm run test:assets
```

`assets:build` recreates the geometric files and manifest. It does not regenerate the PNG art. `assets:export` uses Node 22.18+ to read the same typed placement data as the app and compose a standalone SVG without altering the original PNG bytes. After intentional asset changes, refresh the source copies in the pack, regenerate checksums with `node scripts/verify-sunlit-assets.mjs --write`, and recreate the downloadable ZIP. The e2e suite starts an isolated local Next server and uses fixture progression responses to check open/locked navigation, failed API recovery, chest state, gallery filtering and mobile overflow without requiring the backend stack.

Scope: this is the completed 2D web environment pack. A 3D model/rig or full walk/run sprite-animation production pipeline is a separate expansion, not an implied deliverable of these files.
