import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Editable geometric sources. Illustration atlases are generated separately.
const root = resolve('public/assets/sunlit-village');
mkdirSync(`${root}/paths`, { recursive: true });
const palette = { ink: '#234F48', lagoon: '#258F86', mint: '#B7DFB0', honey: '#F4C45E', coral: '#E88772', cream: '#FFF5D8', water: '#C5E9E4' };
const groups = {
  characters: [
    ['mam', 'Mầm · the explorer', 'A seed explorer with a coral scarf and a speech-bubble satchel.'],
    ['nang', 'Nắng · the librarian', 'A honey seed librarian who collects new words.'],
    ['may', 'Mây · the wayfinder', 'A blue seed guide with a map and a travel cap.'],
    ['soi', 'Sỏi · the maker', 'A coral pebble inventor with a pencil and teal overalls.'],
  ],
  buildings: [
    ['training-school', 'Page-roof school', 'Training Grounds'], ['travel-station', 'Sunrail station', 'Travel District'],
    ['conversation-cafe', 'Little Words café', 'Conversation District'], ['work-studio', 'Pencilworks studio', 'Work District'],
    ['word-greenhouse', 'Word conservatory', 'Word Network'], ['arena-amphitheatre', 'Recall amphitheatre', 'Battle Arena'],
    ['ielts-lighthouse', 'Four-skill lighthouse', 'IELTS Tower'], ['coral-cottage', 'Coral cottage', 'A warm residential home.'],
    ['lagoon-townhouse', 'Lagoon townhouse', 'A balcony home for the village.'],
  ],
  props: [
    ['bubble-tree', 'Bubble-leaf tree'], ['flower-bush', 'Coral flower bush'], ['pebble-pair', 'Seafoam pebbles'], ['leaf-planter', 'Leaf planter'],
    ['bench', 'Reading bench'], ['sun-lamp', 'Sun lantern'], ['mailbox', 'Letter box'], ['signpost', 'Wayfinding sign'],
    ['chest-closed', 'Daily chest · closed'], ['chest-open', 'Daily chest · open'], ['travel-map', 'Pocket map'], ['satchel', 'Word satchel'],
    ['sun-medal', 'Sun medal'], ['book-stack', 'Book stack'], ['ferry', 'Lagoon ferry'], ['footbridge', 'Reading bridge'],
  ],
};
const assets = Object.entries(groups).flatMap(([category, entries]) => {
  const columns = category === 'characters' ? 2 : category === 'buildings' ? 3 : 4;
  return entries.map(([id, name, description], index) => ({ id, name, description: description || name, category, src: `/assets/sunlit-village/${category}.png`, columns, rows: columns, column: index % columns, row: Math.floor(index / columns) }));
});
const pathShapes = {
  'straight-ew': 'M0 128H256', 'straight-ns': 'M128 0V256',
  'corner-ne': 'M128 0V86Q128 128 170 128H256', 'corner-nw': 'M128 0V86Q128 128 86 128H0',
  'corner-se': 'M128 256V170Q128 128 170 128H256', 'corner-sw': 'M128 256V170Q128 128 86 128H0',
  'junction-n': 'M0 128H256M128 128V0', 'junction-s': 'M0 128H256M128 128V256',
  'crossroads': 'M0 128H256M128 0V256', 'plaza': 'M0 128H256M128 0V256',
};
for (const [id, d] of Object.entries(pathShapes)) {
  const plaza = id === 'plaza' ? '<circle cx="128" cy="128" r="76" fill="#FFF5D8" stroke="#D7BE84" stroke-width="4"/><circle cx="128" cy="128" r="51" fill="none" stroke="#E5D19F" stroke-width="3" stroke-dasharray="4 12"/><path d="M128 98L137 119L158 128L137 137L128 158L119 137L98 128L119 119Z" fill="#F4C45E"/>' : '';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><title>Sunlit Village ${id}</title><path d="${d}" fill="none" stroke="#D7BE84" stroke-width="68"/><path d="${d}" fill="none" stroke="#FFF5D8" stroke-width="60"/><path d="${d}" fill="none" stroke="#E5D19F" stroke-width="46" stroke-dasharray="2 22"/>${plaza}</svg>`;
  writeFileSync(`${root}/paths/${id}.svg`, svg);
  assets.push({ id: `path-${id}`, name: id.replaceAll('-', ' '), description: '256 × 256 modular top-down path. Edge ports at 128; 68px outer width.', category: 'paths', src: `/assets/sunlit-village/paths/${id}.svg`, columns: 1, rows: 1, column: 0, row: 0 });
}

const island = 'M174 231Q154 151 257 136Q306 67 415 114Q485 34 597 70Q694 20 766 86Q868 58 928 143Q1058 141 1048 254Q1138 339 1060 410Q1111 502 1038 552Q1017 641 902 642Q853 736 738 691Q626 765 531 701Q418 750 346 686Q208 705 205 614Q101 604 140 505Q75 426 137 348Q104 274 174 231Z';
const route = 'M246 529C235 432 371 477 390 347S532 288 621 254S793 91 854 160S991 237 977 302S868 343 866 459S706 599 637 581S559 489 491 533S372 661 246 529';
let details = '';
for (let i = 0; i < 70; i++) {
  const x = 175 + (i * 131 % 865), y = 140 + (i * 83 % 510);
  details += `<g transform="translate(${x} ${y})" opacity=".48"><path d="M0 5q-6-10-9-7M0 5q1-12 6-12" fill="none" stroke="#72B687" stroke-width="2" stroke-linecap="round"/></g>`;
}
const terrain = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 820"><title>Sunlit Village — seven learning destinations</title><defs><linearGradient id="sea" x2="0" y2="1"><stop stop-color="#D8EFDD"/><stop offset="1" stop-color="#A9DCD9"/></linearGradient><linearGradient id="land" x2=".7" y2="1"><stop stop-color="#D7EDBC"/><stop offset="1" stop-color="#A9D6A6"/></linearGradient><pattern id="waves" width="92" height="62" patternUnits="userSpaceOnUse"><path d="M5 24q9 5 19 0m35 29q8 4 16 0" fill="none" stroke="#F5FFEF" stroke-width="2" opacity=".4"/></pattern><clipPath id="shore"><path d="${island}"/></clipPath></defs><path fill="url(#sea)" d="M0 0h1200v820H0z"/><path fill="url(#waves)" d="M0 0h1200v820H0z"/><path d="${island}" transform="translate(0 21)" fill="#85C3B3" opacity=".45" stroke="#B7E3D2" stroke-width="38"/><path d="${island}" transform="translate(0 11)" fill="#C5AF79" stroke="#C5AF79" stroke-width="4"/><path d="${island}" fill="url(#land)" stroke="#F3E6B9" stroke-width="20"/><g clip-path="url(#shore)"><ellipse cx="735" cy="440" rx="185" ry="115" fill="#BDDFAB"/><ellipse cx="420" cy="278" rx="195" ry="105" fill="#CDE6B3"/>${details}<path d="${route}" fill="none" stroke="#B4CD96" stroke-width="47" transform="translate(0 5)"/><path d="${route}" fill="none" stroke="#DFC997" stroke-width="39"/><path d="${route}" fill="none" stroke="#FFF1CC" stroke-width="33"/><path d="${route}" fill="none" stroke="#E9D8AF" stroke-width="25" stroke-dasharray="2 18"/><ellipse cx="246" cy="529" rx="63" ry="36" fill="#FFF1CC" stroke="#DFC997" stroke-width="3"/><ellipse cx="246" cy="529" rx="37" ry="20" fill="none" stroke="#E1C991" stroke-width="2"/><path d="M557 398C579 366 660 365 694 391S681 449 632 444S526 431 557 398" fill="#86CBBE" stroke="#DCF0C4" stroke-width="10"/><path d="M575 413q27 11 53 0m9-20q17 7 34 0" fill="none" stroke="#D9F3DD" stroke-width="3"/><path d="M615 397q-6-15 8-14q15 4 3 17" fill="#B4DDA1"/><path d="M0 730Q600 740 1200 716" fill="none" stroke="#9BCA96" stroke-width="40" opacity=".5"/></g><g fill="#E8F7DA" opacity=".9"><ellipse cx="122" cy="124" rx="65" ry="17"/><ellipse cx="102" cy="115" rx="30" ry="17"/><ellipse cx="136" cy="108" rx="34" ry="22"/><ellipse cx="1083" cy="635" rx="65" ry="18"/><ellipse cx="1060" cy="625" rx="27" ry="17"/><ellipse cx="1093" cy="620" rx="31" ry="20"/></g><g transform="translate(1091 704)" fill="none" stroke="#508F82" stroke-width="2" opacity=".6"><circle r="28"/><path d="M0-43V43M-43 0H43"/><path d="M0-24L8 0L0 24L-8 0Z" fill="#FFF5D8"/></g></svg>`;
writeFileSync(`${root}/village-map.svg`, terrain);
writeFileSync(`${root}/village-mark.svg`, '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><title>LocCao speech seed</title><rect width="64" height="64" rx="21" fill="#FFF5D8"/><path d="M18 29Q18 15 33 17Q50 17 49 31Q49 43 34 44L23 52V42Q18 38 18 29" fill="#258F86"/><path d="M32 21Q18 20 22 8Q34 9 32 21M34 19Q35 6 47 8Q47 20 34 19" fill="#81BA84"/><circle cx="29" cy="29" r="2" fill="#FFF5D8"/><circle cx="40" cy="29" r="2" fill="#FFF5D8"/><path d="M29 35Q35 40 40 35" fill="none" stroke="#FFF5D8" stroke-width="2" stroke-linecap="round"/></svg>');
assets.push({ id: 'village-map', name: 'Sunlit Village map', description: '1200 × 820 terrain with seven connected destinations. The interactive buildings are separate layers.', category: 'maps', src: '/assets/sunlit-village/village-map.svg', columns: 1, rows: 1, column: 0, row: 0 });
assets.push({ id: 'village-mark', name: 'Speech seed emblem', description: 'An original sprouting speech-bubble emblem.', category: 'identity', src: '/assets/sunlit-village/village-mark.svg', columns: 1, rows: 1, column: 0, row: 0 });
const manifest = { name: 'Sunlit Village / Làng Nắng', version: '1.0.0', palette, atlasConvention: 'Row-major equal cells, zero based. Pixel bounds are derived from actual atlas dimensions, not assumed.', assets };
writeFileSync(`${root}/manifest.json`, JSON.stringify(manifest, null, 2) + '\n');
console.log(`Built ${Object.keys(pathShapes).length} modular path SVGs, map, emblem and ${assets.length}-asset manifest.`);
