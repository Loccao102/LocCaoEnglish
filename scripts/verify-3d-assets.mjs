import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";

const directory = "public/assets/sunlit-3d", manifest = JSON.parse(readFileSync(`${directory}/manifest.json`, "utf8"));
const catalog = JSON.parse(readFileSync("backend/internal/adventure/catalog.json", "utf8"));
const characters = new Set(catalog.companions.map(friend => friend.id));
const ids = new Set();
for (const asset of manifest.assets) {
  assert(!ids.has(asset.id), `duplicate asset ${asset.id}`); ids.add(asset.id);
  const bytes = readFileSync(`public${asset.src}`);
  assert.equal(bytes.length, asset.bytes, `${asset.id}: file length`);
  assert.equal(createHash("sha256").update(bytes).digest("hex"), asset.sha256, `${asset.id}: checksum`);
  assert.equal(bytes.readUInt32LE(0), 0x46546c67, `${asset.id}: GLB header`);
  assert.equal(bytes.readUInt32LE(4), 2, `${asset.id}: GLB version`);
  assert.equal(bytes.readUInt32LE(8), bytes.length, `${asset.id}: binary length`);
  assert.equal(bytes.readUInt32LE(16), 0x4e4f534a, `${asset.id}: JSON chunk`);
  const gltf = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString("utf8"));
  assert.equal(gltf.asset.version, "2.0"); assert(gltf.meshes.length > 0, `${asset.id}: empty mesh`);
  if (characters.has(asset.id)) {
    assert.equal(gltf.animations.length, 14, `${asset.id}: expected six body and eight expression clips`);
    assert.equal(new Set(gltf.animations.map(clip => clip.name)).size, 14, `${asset.id}: duplicate animations`);
  }
}
for (const id of characters) assert(ids.has(id), `missing companion ${id}`);
assert.equal(ids.size, 45);
const exported = JSON.parse(readFileSync(`${directory}/fair-games.json`, "utf8"));
assert.deepEqual(exported.games, JSON.parse(readFileSync("backend/internal/fair/catalog.json", "utf8")), "exported fair metadata differs from the game catalog");
console.log(`Verified ${ids.size} GLBs and checksums, ${characters.size} animated companions, and the shared fair catalog.`);
