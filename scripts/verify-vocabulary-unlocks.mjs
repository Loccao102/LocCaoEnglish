import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";

const base = process.env.E2E_API_URL || "http://localhost:8080";
const method = "vocabulary-unlocks.v1";
const banks = {};
for (const [activity, file] of Object.entries({ "word-link": "catalog", "collocation-factory": "collocation_catalog" })) {
  banks[activity] = JSON.parse(await readFile(new URL(`../backend/internal/learning/${file}.json`, import.meta.url), "utf8")).items;
}
async function call(path, verb = "GET", body, token) {
  const response = await fetch(base + path, { method: verb, headers: {
    "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }, ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: response.status, data: await response.json() };
}
async function register() {
  const result = await call("/v1/auth/register", "POST", { email: `vocabulary-${randomUUID()}@example.test`, password: "SunlitTest123!", displayName: "Vocabulary Integration" });
  assert.equal(result.status, 201);
  return result.data;
}
const owner = await register();
const state = async () => {
  const r = await call("/v1/player/progression", "GET", undefined, owner.token);
  assert.equal(r.status, 200); return r.data;
};
const words = s => s.worlds.find(w => w.id === "words");
const smith = s => s.achievements.find(a => a.id === "wordsmith");
const pin = s => s.inventory.find(c => c.id === "wordsmith-pin");
async function start(activity, item) {
  const r = await call("/v1/learning/attempts", "POST", {
    requestId: randomUUID(), activity, pack: item.pack, cefrLevel: item.cefrLevel,
    excludeItemKeys: banks[activity].filter(i => i.pack === item.pack && i.cefrLevel === item.cefrLevel && i.id !== item.id).map(i => i.id),
  }, owner.token);
  assert.equal(r.status, 201); assert.equal(r.data.itemKey, item.id); return r.data;
}
async function submit(attempt, answer) {
  const input = { answer, contentVersion: attempt.contentVersion, rulesVersion: attempt.rulesVersion };
  const r = await call(`/v1/learning/attempts/${attempt.attemptId}/submit`, "POST", input, owner.token);
  assert.equal(r.status, 200); return { input, result: r.data };
}
const initial = await state();
assert.equal(words(initial).unlocked, false); assert.equal(smith(initial).unlocked, false);
assert.equal(pin(initial).unlocked, false); assert.equal(words(initial).unlock.correctItems, 0);
assert.equal((await call("/v1/player/loadout", "PUT", { cosmeticId: "rookie-title" })).status, 401);
const vocabulary = banks["word-link"].filter(i => i.pack === "cefr-core").slice(0, 6);
for (const item of vocabulary.slice(0, 3)) {
  const a = await start("word-link", item); const { result } = await submit(a, item.correctAnswer);
  assert.equal(result.correct, true); assert.equal(result.xpDelta, 20);
}
const opened = await state(), wordsReceipt = words(opened).unlock.receipt;
assert.equal(words(opened).unlocked, true); assert.equal(smith(opened).unlocked, false);
assert.equal(wordsReceipt.method, method); assert.equal(wordsReceipt.source, "checked-practice");
assert.equal(wordsReceipt.evidence.length, 3);
const replay = await start("word-link", vocabulary[0]);
const savedReplay = await submit(replay, vocabulary[0].correctAnswer);
assert.equal(savedReplay.result.xpDelta, 0); assert.equal(savedReplay.result.progressionApplied, false);
assert.deepEqual((await submit(replay, vocabulary[0].correctAnswer)).result, savedReplay.result);
assert.deepEqual(words(await state()).unlock.receipt, wordsReceipt);
for (const item of vocabulary.slice(3)) await submit(await start("word-link", item), item.correctAnswer);
const sameActivity = await state();
assert.equal(smith(sameActivity).unlock.correctItems, 6);
assert.equal(smith(sameActivity).unlocked, false);
const collocation = banks["collocation-factory"].find(i => i.pack === "cefr-core" && i.cefrLevel === "A1");
await submit(await start("collocation-factory", collocation), collocation.correctAnswer);
const complete = await state(), receipt = smith(complete).unlock.receipt;
assert.equal(smith(complete).unlocked, true); assert.equal(pin(complete).unlocked, true);
assert.equal(receipt.evidence.length, 7); assert.equal(new Set(receipt.evidence.map(e => e.activity)).size, 2);
const snapshots = await Promise.all(Array.from({ length: 8 }, state));
for (const s of snapshots) assert.deepEqual(smith(s).unlock.receipt, receipt);
const equips = await Promise.all(Array.from({ length: 4 }, () => call("/v1/player/loadout", "PUT", { cosmeticId: "wordsmith-pin" }, owner.token)));
for (const r of equips) { assert.equal(r.status, 200); assert.equal(pin(r.data).equipped, true); }
const wrong = await start("word-link", vocabulary[0]);
await submit(wrong, wrong.prompt.options.find(answer => answer !== vocabulary[0].correctAnswer));
const final = await state();
assert.equal(final.xp, 140); assert.equal(pin(final).equipped, true);
assert.deepEqual(smith(final).unlock.receipt, receipt); assert.deepEqual(words(final).unlock.receipt, wordsReceipt);
const other = await register();
const otherState = await call("/v1/player/progression", "GET", undefined, other.token);
assert.equal(otherState.status, 200); assert.equal(pin(otherState.data).unlocked, false);
assert.equal((await call("/v1/player/loadout", "PUT", { cosmeticId: "wordsmith-pin" }, other.token)).status, 409);
console.log("Vocabulary milestones, immutable proofs, capped replay, concurrent equip and owner boundaries passed.");
