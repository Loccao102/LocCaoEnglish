import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

const base = process.env.E2E_API_URL || "http://localhost:8080";
async function call(path, method = "GET", body, token) {
  const response = await fetch(base + path, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(20_000),
  });
  return { status: response.status, data: await response.json() };
}
async function read(path, token) {
  const result = await call(path, "GET", undefined, token);
  assert.equal(result.status, 200, `GET ${path}`);
  return result.data;
}
async function register(name) {
  const result = await call("/v1/auth/register", "POST", {
    email: `profile-owner-${randomUUID()}@example.test`, password: "SunlitTest123!", displayName: name,
  });
  assert.equal(result.status, 201, "create isolated profile fixture account");
  return result.data;
}
const fields = ({ goal, cefrLevel, dailyMinutes, targetBand, interests }) => ({ goal, cefrLevel, dailyMinutes, targetBand, interests });
const owner = await register("Profile Owner A"), other = await register("Profile Owner B");
for (const account of [owner, other]) {
  const me = await read("/v1/me", account.token);
  const profile = await read("/v1/player/profile", account.token);
  assert.equal(me.user.id, account.user.id);
  assert.equal(profile.userId, me.user.id, "profile belongs to authenticated me");
}
const otherFields = { goal: "conversation", cefrLevel: "B1", dailyMinutes: 15, targetBand: 7, interests: ["daily-life"] };
const otherSaved = await call("/v1/player/profile", "PUT", otherFields, other.token);
assert.equal(otherSaved.status, 200);
assert.equal(otherSaved.data.userId, other.user.id);

const demoBefore = await call("/v1/player/profile");
assert.ok([200, 401].includes(demoBefore.status), "configured anonymous GET remains compatible");
const input = {
  userId: other.user.id, goal: " WORK ", cefrLevel: " b2 ", dailyMinutes: 999, targetBand: 6.26,
  interests: [" Travel ", "travel", "", "TECHNOLOGY", "work", "daily-life", "movies", "gaming", "education", "business", "ninth"],
};
for (const token of [undefined, "invalid-token"]) {
  const rejected = await call("/v1/player/profile", "PUT", input, token);
  assert.equal(rejected.status, 401, "anonymous/invalid profile PUT must not write shared demo");
}
const demoAfter = await call("/v1/player/profile");
assert.equal(demoAfter.status, demoBefore.status);
if (demoBefore.status === 200) {
  assert.equal(demoAfter.data.userId, demoBefore.data.userId);
  assert.deepEqual(fields(demoAfter.data), fields(demoBefore.data));
  assert.equal(demoAfter.data.onboarded, demoBefore.data.onboarded);
}

const dashboardBefore = await read("/v1/dashboard", owner.token);
const planBefore = await read("/v1/player/daily", owner.token);
const normalized = {
  goal: "work", cefrLevel: "B2", dailyMinutes: 120, targetBand: 6.5,
  interests: ["travel", "technology", "work", "daily-life", "movies", "gaming", "education", "business"],
};
const saved = await call("/v1/player/profile", "PUT", input, owner.token);
assert.equal(saved.status, 200);
assert.equal(saved.data.userId, owner.user.id, "foreign body userId must not select profile owner");
assert.equal(saved.data.onboarded, true);
assert.ok(Number.isFinite(Date.parse(saved.data.updatedAt)));
assert.deepEqual(fields(saved.data), normalized);
assert.deepEqual(await read("/v1/player/profile", owner.token), saved.data, "normalized settings survive read-back");
assert.deepEqual(await read("/v1/player/profile", other.token), otherSaved.data, "owner A cannot change B's profile");

// PUT remains last-write-wins preferences. Retrying the same fields is safe for
// state; updatedAt is a write time, not an immutable completion receipt.
const retried = await call("/v1/player/profile", "PUT", input, owner.token);
assert.equal(retried.status, 200);
assert.deepEqual(fields(retried.data), normalized);
const invalid = await call("/v1/player/profile", "PUT", { ...input, cefrLevel: "future-level" }, owner.token);
assert.equal(invalid.status, 400);
assert.deepEqual(await read("/v1/player/profile", owner.token), retried.data, "invalid fields preserve saved preferences");
const dashboardAfter = await read("/v1/dashboard", owner.token);
assert.deepEqual(dashboardAfter.user, dashboardBefore.user, "profile writes do not award personal XP/streak");
assert.deepEqual(dashboardAfter.skills, dashboardBefore.skills, "profile writes do not change skill confidence/practice");
assert.equal(dashboardAfter.dueReviews, dashboardBefore.dueReviews);
assert.equal(dashboardAfter.ieltsBand, dashboardBefore.ieltsBand);
assert.equal(dashboardAfter.targetBand, normalized.targetBand, "dashboard reflects the saved target preference");
assert.deepEqual(await read("/v1/player/daily", owner.token), planBefore, "profile writes do not move an existing daily snapshot");
console.log("Profile token ownership, guest write rejection, normalization/read-back, reward separation and frozen daily plan passed.");
