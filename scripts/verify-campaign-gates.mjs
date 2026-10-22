import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";

const base = process.env.E2E_API_URL || "http://localhost:8080";
async function call(path, method = "GET", body, token) {
  const response = await fetch(base + path, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: response.status, data: await response.json() };
}
const banks = {};
for (const [activity, file] of Object.entries({
  "word-link": "catalog", "grammar-repair": "grammar_catalog", "collocation-factory": "collocation_catalog",
  "sentence-builder": "sentence_catalog", "story-choice": "story_catalog", "listen-pick": "listening_catalog",
})) banks[activity] = JSON.parse(await readFile(new URL(`../backend/internal/learning/${file}.json`, import.meta.url), "utf8"));

const created = await call("/v1/auth/register", "POST", { email: `campaign-${randomUUID()}@example.test`, password: "SunlitTest123!", displayName: "Campaign Integration" });
assert.equal(created.status, 201);
const { token, user } = created.data;
async function practise(activity) {
  const opened = await call("/v1/learning/attempts", "POST", { requestId: randomUUID(), activity, pack: activity === "story-choice" ? "hotel-check-in" : "cefr-core", cefrLevel: "B1", excludeItemKeys: [] }, token);
  assert.equal(opened.status, 201, JSON.stringify(opened.data));
  const a = opened.data;
  let answer = a.prompt.question;
  if (activity === "story-choice") answer = banks[activity].nodes.find(n => n.id === "arrival").choices.find(c => c.good).label;
  else if (activity === "sentence-builder") {
    const chunks = [...a.prompt.chunks], reference = banks[activity].items.find(i => i.id === a.itemKey).chunks;
    answer = JSON.stringify(reference.map(text => chunks.splice(chunks.findIndex(c => c.text === text), 1)[0].id));
  } else if (banks[activity]) answer = banks[activity].items.find(i => i.id === a.itemKey).correctAnswer;
  const versions = { contentVersion: a.contentVersion, rulesVersion: a.rulesVersion };
  if (activity === "listen-pick") {
    const event = { requestId: randomUUID(), rate: 1, ...versions };
    for (const status of ["requested", "completed"]) {
      const played = await call(`/v1/learning/attempts/${a.attemptId}/audio`, "POST", { ...event, status, ...(status === "completed" ? { provider: "browser-speech-synthesis" } : {}) }, token);
      assert.equal(played.status, 200);
    }
  }
  const input = { answer, ...versions };
  const result = await call(`/v1/learning/attempts/${a.attemptId}/submit`, "POST", input, token);
  assert.equal(result.status, 200, JSON.stringify(result.data)); assert.equal(result.data.correct, true);
  return { a, input };
}
const chapters = [
  ["travel", "airport-crisis", null, 150, ["word-link", "listen-pick", "shadowing"], ["I missed my flight this afternoon.", "Could you rebook me on the next flight?", "Yes please, book it. Which gate should I use?"]],
  ["travel", "hotel-reservation", "airport-crisis", 180, ["story-choice", "grammar-repair", "shadowing"], ["My confirmed reservation is missing.", "My confirmation number is ABC123.", "What time is breakfast tomorrow?"]],
  ["travel", "city-transit", "hotel-reservation", 220, ["collocation-factory", "listen-pick", "shadowing"], ["I need to get to Central station.", "Which line is the fastest route?", "Which platform does the train leave from?"]],
  ["conversation", "cafe-connection", null, 120, ["collocation-factory", "listen-pick", "shadowing"], ["Hi, my name is Loc.", "What do you enjoy doing?", "It was nice to meet you."]],
  ["conversation", "weekend-plans", "cafe-connection", 160, ["sentence-builder", "listen-pick", "shadowing"], ["How about visiting the museum?", "Let's meet at ten on Saturday.", "Sounds good, see you there."]],
  ["conversation", "repair-misunderstanding", "weekend-plans", 200, ["grammar-repair", "collocation-factory", "shadowing"], ["Sorry, I did not understand.", "What I meant is that I can arrive later.", "Got it, now I understand."]],
  ["work", "daily-standup", null, 140, ["sentence-builder", "collocation-factory", "shadowing"], ["Yesterday I finished the login fix.", "Today I will add tests.", "I have no blockers today."]],
  ["work", "requirement-clarity", "daily-standup", 180, ["listen-pick", "grammar-repair", "shadowing"], ["The search requirement is unclear.", "What exactly should happen for empty results?", "So the requirement is to show suggestions for empty results."]],
  ["work", "deadline-negotiation", "requirement-clarity", 240, ["collocation-factory", "sentence-builder", "shadowing"], ["There is not enough time to deliver the full feature by Friday.", "Cutting testing would hurt quality.", "I propose a phased delivery: the MVP Friday and reports next week."]],
];
let goal;
const clears = new Map();
for (const [world, id, previous, reward, activities, messages] of chapters) {
  if (goal !== world) {
    assert.equal((await call("/v1/player/profile", "PUT", { goal: world, cefrLevel: "B1", dailyMinutes: 15, targetBand: 7, interests: [] }, token)).status, 200);
    goal = world;
  }
  const root = `/v1/player/bosses/${id}`;
  if (previous) {
    const state = await call("/v1/player/progression", "GET", undefined, token);
    const boss = state.data.bosses.find(b => b.id === id);
    assert.equal(boss.unlocked, false); assert.equal(boss.checkpoints.filter(c => c.complete).length, 0);
    assert.equal((await call(`${root}/complete`, "POST", { messages, rulesVersion: "conversation.v2" }, token)).status, 409);
  }
  for (const activity of activities) await practise(activity);
  const before = await call("/v1/me", "GET", undefined, token);
  const payload = { messages, rulesVersion: "conversation.v2" };
  const completions = await Promise.all(Array.from({ length: previous ? 1 : 4 }, () => call(`${root}/complete`, "POST", payload, token)));
  for (const c of completions) { assert.equal(c.status, 200, JSON.stringify(c.data)); assert.deepEqual(c.data.receipt, completions[0].data.receipt); }
  const receipt = completions[0].data.receipt;
  assert.equal(receipt.preparation.rulesVersion, "campaign-practice.v1"); assert.equal(receipt.preparation.checkpoints.length, 3);
  if (previous) {
    assert.equal(receipt.preparation.previousBossId, previous);
    assert.equal(receipt.preparation.previousCompletedAt, clears.get(previous));
    for (const proof of receipt.preparation.checkpoints) assert.ok(Date.parse(proof.completedAt) > Date.parse(clears.get(previous)));
  }
  assert.equal((await call("/v1/me", "GET", undefined, token)).data.user.xp - before.data.user.xp, reward);
  assert.deepEqual((await call(`${root}/receipt`, "GET", undefined, token)).data, receipt);
  clears.set(id, completions[0].data.progression.bosses.find(b => b.id === id).completedAt);
}
assert.equal((await call("/v1/player/progression", "GET", undefined, token)).data.bosses.filter(b => b.cleared).length, 9);
assert.equal((await call("/v1/player/bosses/airport-crisis/receipt")).status, 401);
assert.ok(user.id);
console.log("All nine campaign gates, fresh chapter practice, atomic preparation/dialogue receipts, concurrent roots and one-time rewards passed.");
