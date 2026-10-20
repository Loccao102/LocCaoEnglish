import assert from "node:assert/strict";
import {createHash, randomUUID} from "node:crypto";

const base = process.env.E2E_API_URL || "http://localhost:8080";
async function call(path, method = "GET", body, token) {
  const response = await fetch(base + path, {method, headers: {"Content-Type": "application/json", ...(token ? {Authorization: `Bearer ${token}`} : {})}, ...(body ? {body: JSON.stringify(body)} : {})});
  return {status: response.status, data: await response.json()};
}
const root = "/v1/speaking/assessments";
assert.equal((await call(root)).status, 401);
const user = await call("/v1/auth/register", "POST", {email: `acoustic-integration-${randomUUID()}@example.test`, password: "SunlitTest123!", displayName: "Acoustic Integration"});
assert.equal(user.status, 201); const token = user.data.token;
const parent = await call("/v1/learning/attempts", "POST", {requestId: randomUUID(), activity: "shadowing", pack: "cefr-core", cefrLevel: "B1", excludeItemKeys: []}, token);
assert.equal(parent.status, 201);
const audio = Buffer.alloc(32044);
audio.write("RIFF"); audio.writeUInt32LE(audio.length - 8,4); audio.write("WAVEfmt ",8); audio.writeUInt32LE(16,16);
audio.writeUInt16LE(1,20); audio.writeUInt16LE(1,22); audio.writeUInt32LE(16000,24); audio.writeUInt32LE(32000,28); audio.writeUInt16LE(2,32); audio.writeUInt16LE(16,34); audio.write("data",36); audio.writeUInt32LE(32000,40);
for (let i=44; i<audio.length; i+=2) audio.writeInt16LE(i % 40 < 20 ? 3000 : -3000,i);
const input = {requestId: randomUUID(), attemptId: parent.data.attemptId, transcript: "My reported words", contentVersion: parent.data.contentVersion, transcriptRulesVersion: parent.data.rulesVersion, rulesVersion: "speaking-acoustic.v1", audioBase64: audio.toString("base64")};
const saved = await call(root, "POST", input, token);
assert.equal(saved.status, 200);
// The container fixture has no acoustic provider credentials. A quality fallback
// from the real AI service must become a saved failure, never an acoustic score.
assert.equal(saved.data.status, "failed"); assert.equal(saved.data.feedback, undefined);
assert.equal(saved.data.reference, parent.data.prompt.question); assert.equal(saved.data.transcript, input.transcript);
assert.equal(saved.data.sample.sha256, createHash("sha256").update(audio).digest("hex"));
assert.deepEqual((await call(root, "POST", input, token)).data, saved.data);
assert.deepEqual((await call(`${root}/by-request/${input.requestId}`, "GET", undefined, token)).data, saved.data);
assert.equal((await call(`${root}/${saved.data.id}/retry`, "POST", {generation: 1}, token)).status, 409);
assert.equal((await call(root, "POST", {...input, transcript: "changed"}, token)).status, 409);
const history = await call(root, "GET", undefined, token);
assert.equal(history.data.items.length, 1); assert.ok(!JSON.stringify(history.data).includes("audioBase64"));
assert.equal((await call("/v1/me", "GET", undefined, token)).data.user.xp, 0);
console.log("Acoustic saved failure, sample binding, exact retry, recovery and reward boundaries passed.");
