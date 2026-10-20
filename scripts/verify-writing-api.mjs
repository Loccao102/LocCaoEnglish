import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";

const base = process.env.E2E_API_URL || "http://localhost:8080";
async function call(path, method = "GET", body, token) {
  const response = await fetch(base + path, {method, headers: {"Content-Type": "application/json", ...(token ? {Authorization: `Bearer ${token}`} : {})}, ...(body ? {body: JSON.stringify(body)} : {})});
  return {status: response.status, data: await response.json()};
}
const root = "/v1/ielts/writing/attempts";
assert.equal((await call(root)).status, 401);
const registered = await call("/v1/auth/register", "POST", {email: `writing-integration-${randomUUID()}@example.test`, password: "SunlitTest123!", displayName: "Writing Integration"});
assert.equal(registered.status, 201);
const token = registered.data.token;
assert.equal((await call("/v1/ai/writing-score", "POST", {}, token)).status, 409);
const input = {requestId: randomUUID()};
const created = await call(root, "POST", input, token);
assert.equal(created.status, 201);
const id = created.data.id;
assert.equal((await call(root, "POST", input, token)).data.id, id);
const essay = "Public transport helps people travel to work and school. ".repeat(8);
const draft = {essay, version: 0, rulesVersion: created.data.rulesVersion};
const saved = await call(`${root}/${id}/draft`, "PUT", draft, token);
assert.equal(saved.status, 200); assert.equal(saved.data.essay, essay);
assert.equal((await call(`${root}/${id}/draft`, "PUT", draft, token)).data.version, 1);
const failed = await call(`${root}/${id}/submit`, "POST", {...draft, version: 1}, token);
assert.equal(failed.status, 200);
// CI intentionally has no paid provider. Failure must retain evidence, not
// masquerade as success or manufacture a local heuristic estimate.
assert.equal(failed.data.status, "failed"); assert.equal(failed.data.essay, essay);
assert.equal(failed.data.feedback, undefined);
const resumed = await call(`${root}/${id}`, "GET", undefined, token);
assert.deepEqual(resumed.data, failed.data);
assert.equal((await call("/v1/ielts/history", "GET", undefined, token)).data.items.length, 0);
assert.equal((await call(`${root}/${id}/draft`, "PUT", {...draft, version: 1}, token)).status, 409);
console.log("Writing account draft, exact retry, frozen failure and history boundaries passed.");
