import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { inflateSync } from 'node:zlib';

const root = resolve('public/assets/sunlit-village');
const manifest = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'));
assert.equal(manifest.assets.length, 41);
assert.equal(new Set(manifest.assets.map(asset => asset.id)).size, 41);
const hashes = {};
function walk(dir) { return readdirSync(dir, { withFileTypes: true }).flatMap(item => item.isDirectory() ? walk(join(dir, item.name)) : [join(dir, item.name)]); }
for (const file of walk(root).filter(file => !file.endsWith('checksums.json')).sort()) hashes[relative(root, file).replaceAll('\\', '/')] = createHash('sha256').update(readFileSync(file)).digest('hex');
for (const asset of manifest.assets) {
  const file = resolve('public', `.${asset.src}`);
  assert(file.startsWith(root));
  assert(readFileSync(file).length > 0, `Missing ${asset.id}`);
  assert(asset.column < asset.columns && asset.row < asset.rows && asset.column >= 0 && asset.row >= 0);
}

// Decode PNG filters to verify real transparency, not just an alpha-channel flag.
for (const category of ['characters', 'buildings', 'props']) {
  const bytes = readFileSync(join(root, `${category}.png`));
  assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  const width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20);
  assert.equal(width, height); assert(width >= 1024);
  assert.equal(bytes[24], 8); assert.equal(bytes[25], 6); assert.equal(bytes[28], 0);
  const chunks = [];
  for (let offset = 8; offset < bytes.length;) { const size = bytes.readUInt32BE(offset); if (bytes.toString('ascii', offset + 4, offset + 8) === 'IDAT') chunks.push(bytes.subarray(offset + 8, offset + 8 + size)); offset += size + 12; }
  const raw = inflateSync(Buffer.concat(chunks));
  const stride = width * 4; let previous = new Uint8Array(stride), transparent = 0, opaque = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)], row = new Uint8Array(stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= 4 ? row[x - 4] : 0, b = previous[x], c = x >= 4 ? previous[x - 4] : 0;
      let predictor = 0;
      if (filter === 1) predictor = a;
      if (filter === 2) predictor = b;
      if (filter === 3) predictor = Math.floor((a + b) / 2);
      if (filter === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); predictor = pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      assert(filter <= 4);
      row[x] = (raw[y * (stride + 1) + 1 + x] + predictor) & 255;
      // ImageGen's antialiased exports peak at alpha 253. >=240 is visibly opaque art.
      if (x % 4 === 3) { if (row[x] === 0) transparent++; if (row[x] >= 240) opaque++; }
    }
    previous = row;
  }
  assert(transparent / (width * height) > .1, `${category}: real transparency required`);
  assert(opaque / (width * height) > .1, `${category}: visible art required`);
  console.log(`${category}: ${width}×${height} RGBA, ${(transparent / (width * height) * 100).toFixed(1)}% fully transparent, ${(bytes.length / 1048576).toFixed(2)} MiB`);
}
if (process.argv.includes('--write')) writeFileSync(join(root, 'checksums.json'), JSON.stringify(hashes, null, 2) + '\n');
else assert.deepEqual(hashes, JSON.parse(readFileSync(join(root, 'checksums.json'), 'utf8')), 'Asset integrity mismatch; review changes before updating checksums.');
console.log(`Verified ${manifest.assets.length} unique assets and ${Object.keys(hashes).length} file hashes.`);
