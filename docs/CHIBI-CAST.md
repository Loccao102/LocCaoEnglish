# Sunlit Village chibi cast

The 24-character cast is defined in the canonical adventure catalog. The frontend uses its artwork fields and activity routes; the Go service uses the same IDs and prices for equip actions.

## Art direction

Reference: `public/assets/sunlit-village/characters.png` (SHA-256: `db937dfa253c677aacbd945b217c0c40aca891eb08205d28404f0ff427709323`). The reference belongs to the existing project illustration collection and was not modified.

- Soft bean silhouettes, an overlapping oversized head and belly, no exposed neck, tiny hands and boots.
- Large dark oval eyes with two small catchlights; each eye and its highlights blink as one group. Flat warm blush, gentle eyebrows, small open smiles or a closed smile for the quiet friends.
- Mầm: cream skin, coral scarf, teal satchel and a two-leaf crest. Nắng: yellow skin, round glasses, a curled leaf, book and teal apron. Mây: blue skin, coral cap and map. Sỏi: coral pebble skin, teal overalls and a pencil.
- Additional friends have distinct hats, ears, silhouettes, clothing and props. Variations include bunny, bear, panda, cat, fox, chick, drop, avocado, strawberry, orange, rice and seed forms.
- The 3D result interprets the reference's shapes, colours and accessories. It does not reproduce its painted texture exactly. No external game model, franchise character or third-party illustration was used.

## Cast and learning hosts

| Friend | Shape / headwear | Clothing / prop | Activity | Route | Sun coins |
| --- | --- | --- | --- | --- | ---: |
| Mầm (mam) | seed / sprout | scarf / satchel | Word Link | /games/word-link | 0 |
| Nắng (nang) | seed / curl | apron / book | Lessons | /learn | 50 |
| Mây (may) | seed / cap | scarf / map | Travel District | /travel | 80 |
| Sỏi (soi) | pebble / none | overalls / pencil | Work District | /work | 120 |
| Bếp (bep) | seed / chef | apron / spoon | Story Choice | /games/story-choice | 0 |
| Bông (bong) | bunny / bow | vest / book | Reading Race | /reading | 0 |
| Giọt (giot) | drop / headphones | scarf / none | Listen & Pick | /listening | 0 |
| Hạt (hat) | chick / tuft | bowtie / microphone | Speaking Studio | /speaking | 0 |
| Cốm (com) | seed / leaf | overalls / watering | Word Graph | /word-graph | 0 |
| Mít (mit) | seed / detective | vest / lens | Collocation Factory | /games/collocation-factory | 0 |
| Đào (dao) | seed / beret | scarf / letter | Dictation | /dictation | 0 |
| Dâu (dau) | berry / crown | apron / brush | Sentence Builder | /games/sentence-builder | 0 |
| Bơ (bo) | avocado / leaf | vest / quill | IELTS Writing | /ielts/writing | 0 |
| Na (na) | seed / triple | bowtie / cards | Placement Adventure | /placement | 0 |
| Me (me) | seed / aviator | scarf / map | Airport Mission | /missions/airport | 0 |
| Quýt (quyt) | orange / conductor | vest / ticket | City Transit | /missions/transit | 0 |
| Sen (sen) | seed / lotus | scarf / book | IELTS Studio | /ielts | 0 |
| Trúc (truc) | panda / none | scarf / cards | Spaced Review | /review | 0 |
| Gạo (gao) | rice / nightcap | scarf / star | IELTS Listening | /ielts/listening | 0 |
| Đường (duong) | bear / pom | scarf / key | Hotel Mission | /missions/hotel | 0 |
| Moca (moca) | bear / none | apron / cup | Conversation Café | /conversation | 0 |
| Tím (tim) | cat / bow | vest / pencil | Grammar Repair | /games/grammar-repair | 0 |
| Cuộn (cuon) | fox / beret | vest / scroll | IELTS Reading | /ielts/reading | 0 |
| Bụi (bui) | seed / mushroom | scarf / satchel | Practice Workshop | /practice-generator | 0 |

The four original IDs and prices remain unchanged. The twenty new friends cost zero, so the finite story rewards cannot prevent players from using them. Guest saves restore only known IDs; account actions remain authoritative on the Go server. Rebuild the API to embed the expanded catalog before equipping a new friend in an account save.

Seven chapter guides use distinct cast members: Nắng, Moca, Mây, Cốm, Sỏi, Bông and Sen. All 24 characters are selectable in the Bag and each hosts one existing learning route; this is not a claim of 24 newly created games.

## Rendering and delivery

`lib/game/three/characters.ts` owns the rigid joint hierarchy, six body clips and eight facial-expression clips. `character-details.ts` supplies original reusable hats, outfits and held objects. Shared static geometry is merged by material inside joint groups. The world caches equipped rigs and disposes them when leaving the scene.

The roster and HUD portraits are rendered from those same models using one queued, temporary WebGL context, then cached as browser-memory images. The character page and Bag share a live turntable with six body animation choices and eight expression choices. Reduced-motion preferences suppress decorative idle motion; animation previews remain available on explicit selection.

Run `npm run assets:3d` to regenerate 24 animated companion GLBs and 21 environment GLBs (45 total), the manifest and the ZIP. Every character has idle, walk, run, jump, wave and celebrate clips plus eight expression-* clips. The download pack includes all models and provenance; runtime does not fetch the GLB exports.

Implementation checks are limited to model export, frontend production compilation and visual art/layout review. Gameplay and backend test suites remain skipped at the user's request.

## Round chibi revision and character development

Version 3 widens and shortens the heads, rounds the bellies and mittens, and replaces pointed cat/fox ears with soft rounded ears. Brows, eyes, mouths, cheek tears and heart eyes are authored 3D geometry. Eyes and catchlights blink together. Their ordinary, joyful, curious, thoughtful, surprised, sad, sleepy and affectionate expressions can be previewed independently of body animation.

lib/game/personalities.ts is the character bible for 24 distinct traits, talents, favourite things, dreams, stories, habits and default expressions. Idle bob, sway, nod and tilt vary by character. World reactions change on greeting, jumping, sprinting and celebration. Fair hosts react with curiosity, sadness or joy to game events. The source character IDs, artwork and original chapter prices remain canonical in the adventure catalog.

The Friendship Fair adds eight distinct games hosted by Mầm, Cốm, Giọt, Moca, Quýt, Mây, Dâu and Sỏi. Helpers include Nắng, Bụi, Hạt, Bếp, Đào, Me, Tím and Na. See FRIENDSHIP-FAIR.md for mechanics and persistence. Character stories and game definitions are also exported in the downloadable asset pack.
