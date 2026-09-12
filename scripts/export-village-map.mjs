// Node 22.18+ reads the same TypeScript placement data used by the application.
// This is an SVG export of the scene graph; the PNG source bytes stay intact.
import { readFileSync, writeFileSync } from 'node:fs';
import { villagePlaces, villageDecor } from '../data/village.ts';
const root = 'public/assets/sunlit-village';
const manifest = JSON.parse(readFileSync(`${root}/manifest.json`, 'utf8'));
const assets = new Map(manifest.assets.map(asset => [asset.id, asset]));
const escape = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const atlasDimensions = new Map();
const atlasDefs = ['characters', 'buildings', 'props'].map(name => {
  const bytes = readFileSync(`${root}/${name}.png`);
  atlasDimensions.set(name, bytes.readUInt32BE(16));
  return `<image id="atlas-${name}" width="${bytes.readUInt32BE(16)}" height="${bytes.readUInt32BE(20)}" href="data:image/png;base64,${bytes.toString('base64')}"/>`;
}).join('');
function sprite(id, x, y, size) {
  const asset = assets.get(id), cell = atlasDimensions.get(asset.category) / asset.columns;
  return `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="${asset.column * cell} ${asset.row * cell} ${cell} ${cell}" overflow="hidden"><use href="#atlas-${asset.category}"/></svg>`;
}
const terrain = readFileSync(`${root}/village-map.svg`, 'utf8').replace(/<svg[^>]*>/, '').replace(/<\/svg>$/, '');
let scene = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 820"><title>Làng Nắng — complete illustrated learning village</title><desc>An original English learning village with seven page-roof buildings, seed companions, nature and paths. This is a static illustration, with no player progress.</desc><defs>${atlasDefs}</defs>${terrain}`;
for (const [id, x, y, percent] of villageDecor) {
  const size = percent * 12;
  scene += sprite(id, x * 12 - size / 2, y * 8.2 - size / 2, size);
}
for (const place of villagePlaces) {
  const size = 192, x = place.x * 12, y = place.y * 8.2 - 33;
  scene += sprite(place.art, x - size / 2, y, size);
  const labelWidth = place.title.length * 7.2 + 28;
  scene += `<g><rect x="${x - labelWidth / 2}" y="${y + size - 2}" width="${labelWidth}" height="28" rx="14" fill="#FFFCF0" stroke="#CCDABB"/><text x="${x}" y="${y + size + 17}" text-anchor="middle" font-family="Trebuchet MS, sans-serif" font-size="12" font-weight="bold" fill="#234F48">${escape(place.title)}</text></g>`;
}
scene += '<text x="62" y="768" font-family="Trebuchet MS, sans-serif" font-size="13" letter-spacing="3" fill="#397D72">LÀNG NẮNG · THE LITTLE WORD LAGOON</text></svg>';
writeFileSync(`${root}/village-illustrated.svg`, scene);
console.log('Exported standalone illustrated SVG with embedded original atlas bytes.');
