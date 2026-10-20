import { randomUUID } from "node:crypto";
import { test, expect, type Page } from "@playwright/test";
import type { LearningAttempt } from "../../lib/learning-attempt";

const API = process.env.E2E_API_URL || "http://localhost:8080";
const issued = (page: Page) => page.waitForResponse(r => r.url().endsWith("/v1/learning/attempts") && r.request().method() === "POST");
const card = (page: Page) => page.getByRole("region", { name: "Guided speaking practice" });
const field = (page: Page) => card(page).getByRole("textbox", { name: "Your transcript" });
const check = (page: Page) => card(page).getByRole("button", { name: "Check transcript", exact: true });

// Only the microphone/recognition provider is simulated. Attempts and grading are real.
async function microphone(page: Page) {
  await page.addInitScript(() => {
    const state = { calls: 0, stopped: 0, closed: 0, mode: "ok", text: "I said something different.", grant: null as null | (() => void), processor: null as any, recognition: null as any };
    Object.assign(window, { speakingMic: state });
    const stream = { getTracks: () => [{ stop: () => { state.stopped++; } }] };
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: async () => {
      state.calls++;
      if (state.mode === "denied") throw new Error("Microphone permission denied");
      if (state.mode === "hold") return new Promise(resolve => { state.grant = () => resolve(stream); });
      return stream;
    } } });
    class Context {
      sampleRate = 16000; state = "running"; destination = {}; microphone = false;
      createMediaStreamSource() { this.microphone = true; return { connect() {}, disconnect() {} }; }
      createScriptProcessor() { return state.processor = { connect() {}, disconnect() {}, onaudioprocess: null }; }
      createGain() { return { gain: { value: 0 }, connect() {}, disconnect() {} }; }
      async close() { this.state = "closed"; if (this.microphone) state.closed++; }
    }
    class Recognition {
      onresult: any; onerror: any; onend: any;
      start() {
        state.recognition = this;
        state.processor.onaudioprocess?.({ inputBuffer: { getChannelData: () => new Float32Array(256).fill(.1) } });
        this.onresult?.({ results: [[{ transcript: state.text }]] });
      }
      abort() {} stop() {}
    }
    Object.assign(window, { AudioContext: Context, SpeechRecognition: Recognition });
  });
}

async function acousticAccount(page: Page, request: import("@playwright/test").APIRequestContext) {
  const res = await request.post(`${API}/v1/auth/register`, {data: {email: `acoustic-${randomUUID()}@example.test`, password: "SunlitTest123!", displayName: "Acoustic learner"}});
  expect(res.ok()).toBe(true); const account = await res.json();
  await page.goto("/account");
  await page.evaluate(token => {localStorage.setItem("loccao_token", token); window.dispatchEvent(new Event("loccao-auth-change"));}, account.token);
  return account;
}

test("Saved acoustic failure survives response loss and reload without storing or resending audio", async ({page, request}) => {
  await microphone(page); const account = await acousticAccount(page, request);
  const opened = issued(page); await page.goto("/speaking"); const attempt: LearningAttempt = await (await opened).json();
  const panel = page.getByRole("complementary", {name: "Saved pronunciation assessments"});
  await expect(panel.getByText("No saved assessments yet.")).toBeVisible();
  await card(page).getByRole("button", {name: "Record your voice"}).click();
  await expect(field(page)).toHaveValue("I said something different.");
  await card(page).getByRole("button", {name: "Stop recording"}).click();
  let input: any, saved: any;
  await page.route("**/v1/speaking/assessments", async route => {
    if (route.request().method() !== "POST") {await route.continue(); return;}
    input = route.request().postDataJSON();
    const response = await route.fetch(); expect(response.ok()).toBe(true); saved = await response.json();
    await route.abort("failed");
  }, {times: 1});
  await panel.getByRole("button", {name: "Assess this recording", exact: true}).click();
  await expect(panel.getByRole("alert")).toContainText("reply was interrupted");
  expect(saved.status).toBe("failed"); expect(saved.feedback).toBeUndefined();
  expect(saved.reference).toBe(attempt.prompt.question); expect(saved.transcript).toBe("I said something different.");
  expect(input.audioBase64).toBeTruthy();
  const retry = page.waitForRequest(r => r.url().endsWith("/v1/speaking/assessments") && r.method() === "POST");
  await panel.getByRole("button", {name: "Assess this recording", exact: true}).click();
  expect((await retry).postDataJSON()).toEqual(input);
  await expect(panel.getByRole("status")).toContainText("Saved request: failed");
  await expect(panel.getByRole("button", {name: "Retry this recording"})).toBeEnabled();
  const headers = {Authorization: `Bearer ${account.token}`};
  const history = await (await request.get(`${API}/v1/speaking/assessments`, {headers})).json();
  expect(history.items).toHaveLength(1); expect(history.items[0].generation).toBe(1);
  const stored = await page.evaluate(() => JSON.stringify(localStorage));
  expect(stored).not.toContain('"audioBase64"'); expect(stored).not.toContain(input.audioBase64);
  let uploads = 0; page.on("request", r => {if (r.method() === "POST" && r.url().includes("/speaking/assessments")) uploads++;});
  await page.reload();
  await expect(panel.getByRole("status")).toContainText("original audio is not available");
  await expect(panel.getByRole("button", {name: "Assess this recording", exact: true})).toBeDisabled();
  await panel.getByRole("button", {name: "Refresh saved status"}).click();
  await expect(panel.getByRole("status")).toContainText("Saved request: failed"); expect(uploads).toBe(0);
  expect((await (await request.get(`${API}/v1/me`, {headers})).json()).user.xp).toBe(0);
  expect((await request.post(`${API}/v1/speaking/assessments/${saved.id}/retry`, {headers, data: {generation: 1}})).status()).toBe(409);
  expect((await request.get(`${API}/v1/speaking/assessments/${saved.id}`)).status()).toBe(401);
  await page.evaluate(() => {localStorage.removeItem("loccao_token"); window.dispatchEvent(new Event("loccao-auth-change"));});
  await expect(panel).toHaveCount(0); await expect(field(page)).toHaveValue("");
});

test("A late acoustic reply stays with its original account", async ({page, request}) => {
  await microphone(page); const first = await acousticAccount(page, request);
  const otherResponse = await request.post(`${API}/v1/auth/register`, {data: {email: `acoustic-other-${randomUUID()}@example.test`, password: "SunlitTest123!", displayName: "Other speaker"}});
  expect(otherResponse.ok()).toBe(true); const other = await otherResponse.json();
  await page.goto("/speaking"); const panel = page.getByRole("complementary", {name: "Saved pronunciation assessments"});
  await expect(panel.getByText("No saved assessments yet.")).toBeVisible();
  await card(page).getByRole("button", {name: "Record your voice"}).click(); await expect(field(page)).toHaveValue("I said something different.");
  await card(page).getByRole("button", {name: "Stop recording"}).click();
  let release!: () => void, committed!: () => void;
  const held = new Promise<void>(resolve => {release = resolve;});
  const saved = new Promise<void>(resolve => {committed = resolve;});
  await page.route("**/v1/speaking/assessments", async route => {
    if (route.request().method() !== "POST") {await route.continue(); return;}
    const response = await route.fetch(); expect(response.ok()).toBe(true); committed(); await held;
    await route.fulfill({response});
  });
  await panel.getByRole("button", {name: "Assess this recording", exact: true}).click(); await saved;
  await page.evaluate(token => {localStorage.setItem("loccao_token", token); window.dispatchEvent(new Event("loccao-auth-change"));}, other.token);
  await expect(field(page)).toHaveValue(""); await expect(panel.getByText("No saved assessments yet.")).toBeVisible();
  release();
  await panel.getByRole("button", {name: "Refresh saved status"}).click();
  await expect(panel.getByText("No saved assessments yet.")).toBeVisible(); await expect(panel.getByText(/Saved request: failed/)).toHaveCount(0);
  await page.evaluate(token => {localStorage.setItem("loccao_token", token); window.dispatchEvent(new Event("loccao-auth-change"));}, first.token);
  await expect(panel.getByRole("status")).toContainText("Saved request: failed");
  await expect(panel.getByRole("button", {name: "Assess this recording", exact: true})).toBeDisabled();
});

for (const height of [551, 844]) test(`Saved acoustic zero and word evidence remain readable at 390x${height}`, async ({page, request}) => {
  await page.setViewportSize({width: 390, height}); await microphone(page); await acousticAccount(page, request);
  // UI-only provider fixture. HTTP/store/provider success is verified separately in Go/Python.
  let receipt: any = null, posts = 0;
  await page.route("**/v1/speaking/assessments**", async route => {
    if (route.request().method() === "GET") {await route.fulfill({json: route.request().url().includes("by-request") ? receipt : {items: receipt ? [receipt] : []}}); return;}
    posts++; const input = route.request().postDataJSON();
    receipt = {...input, audioBase64: undefined, id: "ui-acoustic-fixture", reference: "Hello, could I have some tea please?", status: "completed", generation: 1, createdAt: "2026-10-21T00:00:00Z", updatedAt: "2026-10-21T00:00:00Z", sample: {sha256: "a".repeat(64), bytes: 556, sampleRate: 16000, durationSec: .016}, feedback: {provider: "azure-speech-pronunciation-assessment", model: "provider-managed-unspecified", methodVersion: "guided-pronunciation.v1", acousticAssessment: true, overall: 0, scores: {accuracy: 0, fluency: 0, completeness: 0, prosody: null}, words: [{word: "Hello", accuracy: 0, errorType: "Mispronunciation", phonemes: [{phoneme: "h", accuracy: 0}]}], coaching: ["Repeat the opening sound slowly."], disclaimer: "Practice feedback, not an official IELTS score."}};
    await route.fulfill({json: receipt});
  });
  await page.goto("/speaking"); const panel = page.getByRole("complementary", {name: "Saved pronunciation assessments"});
  await expect(panel.getByText("No saved assessments yet.")).toBeVisible();
  await card(page).getByRole("button", {name: "Record your voice"}).click(); await expect(field(page)).toHaveValue("I said something different.");
  await card(page).getByRole("button", {name: "Stop recording"}).click();
  await panel.getByRole("button", {name: "Assess this recording", exact: true}).click();
  await panel.getByText("0 / 100 · Hello, could I have some tea please?", {exact: true}).click();
  await expect(panel.getByText("accuracy: 0 / 100", {exact: true})).toBeVisible();
  await expect(panel.getByText("prosody: Unavailable", {exact: true})).toBeVisible();
  await panel.getByText("Word and sound feedback", {exact: true}).click();
  await expect(panel.getByText("h: 0", {exact: true})).toBeVisible();
  await panel.getByText("h: 0", {exact: true}).scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({path: `test-results/acoustic-${height}.png`, fullPage: true});
  await page.reload(); await expect(panel.getByText(/0 \/ 100 · Hello/)).toBeVisible(); expect(posts).toBe(1);
  await page.evaluate(() => {localStorage.removeItem("loccao_token"); window.dispatchEvent(new Event("loccao-auth-change"));});
  await expect(panel).toHaveCount(0);
});

test("Speaking preserves actual draft and pending answer, then explains alignment", async ({ page, request }) => {
  const opened = issued(page); await page.goto("/speaking?pack=travel-airport");
  const a: LearningAttempt = await (await opened).json();
  expect(a.activity).toBe("shadowing"); expect(a.prompt.title).toBe("TRAVEL · AIRPORT");
  const actual = a.prompt.question + " extra";
  await field(page).fill(actual); await page.reload(); await expect(field(page)).toHaveValue(actual);
  let payload: unknown;
  await page.route("**/v1/learning/attempts/*/submit", async route => { payload = route.request().postDataJSON(); await route.abort("failed"); }, { times: 1 });
  await check(page).click(); await expect(page.getByRole("button", { name: "Retry same answer" })).toBeVisible();
  await expect(field(page)).toHaveAttribute("readonly", ""); await page.reload();
  await expect(field(page)).toHaveValue(actual);
  const retry = page.waitForRequest(r => r.url().endsWith(`/${a.attemptId}/submit`));
  await page.getByRole("button", { name: "Retry same answer" }).click(); expect((await retry).postDataJSON()).toEqual(payload);
  await expect(card(page).getByText("0 missing · 1 extra · 0 replaced")).toBeVisible();
  const saved = await (await request.get(`${API}/v1/learning/attempts/${a.attemptId}`)).json();
  expect(saved.result).toMatchObject({ actualAnswer: actual, correctAnswer: a.prompt.question, evidence: "server-guided-transcript-match", xpDelta: 0, progressionApplied: false });
  await page.reload(); await expect(field(page)).toHaveValue(actual); await expect(check(page)).toHaveCount(0);
});

test("Speaking account result survives response loss and rejects client reward claims", async ({ page, request }) => {
  const registered = await request.post(`${API}/v1/auth/register`, { data: { email: `speaking-${randomUUID()}@example.test`, password: "SunlitTest123!", displayName: "Speaker" } });
  expect(registered.ok()).toBe(true); const user = await registered.json();
  await page.goto("/account");
  await page.evaluate(token => { localStorage.setItem("loccao_token", token); window.dispatchEvent(new Event("loccao-auth-change")); }, user.token);
  const opened = issued(page); await page.goto("/speaking"); const a: LearningAttempt = await (await opened).json();
  await field(page).fill(a.prompt.question!);
  await page.route("**/v1/learning/attempts/*/submit", async route => { expect((await route.fetch()).ok()).toBe(true); await route.abort("failed"); }, { times: 1 });
  await check(page).click(); await expect(page.getByRole("button", { name: "Retry same answer" })).toBeVisible();
  await page.reload(); await expect(card(page).getByText("Your transcript matches", { exact: true })).toBeVisible();
  await expect(page.getByText("+20 XP · Progress saved.", { exact: true })).toBeVisible();
  const headers = { Authorization: `Bearer ${user.token}` }, data = { answer: a.prompt.question, contentVersion: a.contentVersion, rulesVersion: a.rulesVersion };
  const path = `${API}/v1/learning/attempts/${a.attemptId}`;
  expect((await request.post(`${path}/submit`, { headers, data })).ok()).toBe(true);
  expect((await request.post(`${path}/submit`, { headers, data: { ...data, answer: data.answer + " extra" } })).status()).toBe(409);
  expect((await request.post(`${path}/submit`, { headers, data: { ...data, accuracy: 1 } })).status()).toBe(400);
  expect((await request.get(path)).status()).toBe(404);
  for (const activity of [" SHADOWING ", " PRONUNCIATION-ASSESSMENT "]) {
    expect((await request.post(`${API}/v1/attempts`, { headers, data: { activity, skill: "Speaking", itemKey: "fake", accuracy: 1 } })).status()).toBe(409);
  }
  expect((await (await request.get(`${API}/v1/me`, { headers })).json()).user.xp).toBe(20);
  await page.evaluate(() => { localStorage.removeItem("loccao_token"); window.dispatchEvent(new Event("loccao-auth-change")); });
  await expect(field(page)).toHaveValue(""); await field(page).fill("Guest words");
  await page.evaluate(token => { localStorage.setItem("loccao_token", token); window.dispatchEvent(new Event("loccao-auth-change")); }, user.token);
  await expect(field(page)).toHaveValue(a.prompt.question!);
});

test("Coach failures preserve independent feedback without fabricating scores or granting progress", async ({ page }) => {
  await microphone(page);
  let coachCalls = 0, acousticCalls = 0, rewards = 0;
  page.on("request", r => { if (r.url().endsWith("/v1/attempts") || r.url().endsWith("/submit")) rewards++; });
  await page.route("**/v1/ai/speaking-feedback", async route => {
    coachCalls++; expect(route.request().postDataJSON().transcript).toBe("I said something different.");
    await route.fulfill({ json: { provider: "test-transcript-coach", coaching: ["Try shorter thought groups."], overall: 9, scores: { pronunciationProxy: 9 } } });
  });
  await page.route("**/v1/ai/pronunciation-score", async route => {
    acousticCalls++; expect(route.request().postDataJSON().audioBase64).toBeTruthy();
    if (acousticCalls === 1) await route.abort("failed");
    else await route.fulfill({ json: { provider: "not-configured", acousticAssessment: false, overall: 99, scores: {}, words: [] } });
  });
  await page.goto("/ielts/speaking");
  await expect(card(page).getByText(/Browser speech recognition may use an online service/)).toBeVisible();
  await card(page).getByRole("button", { name: "Record your voice" }).click();
  await expect(field(page)).toHaveValue("I said something different.");
  await card(page).getByRole("button", { name: "Stop recording" }).click();
  await card(page).getByRole("button", { name: "Get coach feedback" }).click();
  await expect(card(page).getByText("Try shorter thought groups.")).toBeVisible();
  await expect(card(page).getByText(/Pronunciation service is unavailable/)).toBeVisible();
  await expect(card(page).getByText(/9 \/ 100|99 \/ 100|pronunciation proxy/i)).toHaveCount(0);
  await card(page).getByRole("button", { name: "Retry coach feedback" }).click();
  await expect(card(page).getByText("Acoustic assessment is unavailable. No pronunciation score.")).toBeVisible();
  await expect(card(page).getByRole("button", { name: "Feedback received" })).toBeDisabled();
  expect(coachCalls).toBe(1); expect(acousticCalls).toBe(2); expect(rewards).toBe(0);
  await page.reload(); await expect(field(page)).toHaveValue("I said something different.");
  await expect(card(page).getByText(/Recordings are not restored after reload/)).toBeVisible();
});

test("Acoustic feedback validates the provider score, including a real zero, without grading text", async ({ page }) => {
  await microphone(page); let calls = 0, submits = 0;
  page.on("request", r => { if (r.url().endsWith("/submit") || r.url().endsWith("/v1/attempts")) submits++; });
  await page.route("**/v1/ai/speaking-feedback", route => route.fulfill({ json: { provider: "text-fixture", coaching: [] } }));
  await page.route("**/v1/ai/pronunciation-score", route => {
    calls++; return route.fulfill({ json: { provider: "acoustic-fixture", acousticAssessment: true, overall: calls === 1 ? 101 : 0, words: [], scores: {} } });
  });
  await page.goto("/speaking"); await card(page).getByRole("button", { name: "Record your voice" }).click();
  await expect(field(page)).toHaveValue("I said something different.");
  await card(page).getByRole("button", { name: "Stop recording" }).click();
  await card(page).getByRole("button", { name: "Get coach feedback" }).click();
  await expect(card(page).getByText("Pronunciation feedback was invalid. No acoustic score is available.")).toBeVisible();
  await card(page).getByRole("button", { name: "Retry coach feedback" }).click();
  await expect(card(page).getByText("0 / 100 · acoustic assessment", { exact: true })).toBeVisible();
  expect(submits).toBe(0);
  expect(await page.evaluate(() => Object.values(localStorage).some(value => value.includes('"audioBase64"')))).toBe(false);
});

test("Microphone denial and late permission clean up across account changes", async ({ page }) => {
  await microphone(page); await page.goto("/speaking");
  await page.evaluate(() => { (window as any).speakingMic.mode = "denied"; });
  await card(page).getByRole("button", { name: "Record your voice" }).click();
  await expect(card(page).getByText("Microphone permission denied", { exact: true })).toBeVisible();
  await page.evaluate(() => { (window as any).speakingMic.mode = "hold"; });
  await card(page).getByRole("button", { name: "Record your voice" }).click();
  await expect(card(page).getByRole("button", { name: "Waiting for microphone…" })).toBeDisabled();
  // Account transition cleans up even while getUserMedia is still pending.
  await page.evaluate(() => { window.dispatchEvent(new Event("loccao-auth-change")); });
  await expect(card(page).getByRole("button", { name: "Record your voice" })).toBeEnabled();
  await page.evaluate(() => { (window as any).speakingMic.grant(); });
  await expect.poll(() => page.evaluate(() => (window as any).speakingMic.stopped)).toBe(1);
  await expect(field(page)).toHaveValue("");
  await page.evaluate(() => { (window as any).speakingMic.mode = "ok"; });
  await card(page).getByRole("button", { name: "Record your voice" }).click();
  await expect(field(page)).toHaveValue("I said something different.");
  await page.evaluate(() => { window.dispatchEvent(new Event("loccao-auth-change")); });
  await expect.poll(() => page.evaluate(() => (window as any).speakingMic.stopped)).toBe(2);
  await expect.poll(() => page.evaluate(() => (window as any).speakingMic.closed)).toBe(1);
});

test("Speaking stops capture when hidden or leaving through in-app navigation", async ({ page }) => {
  await microphone(page); await page.goto("/speaking");
  await card(page).getByRole("button", { name: "Record your voice" }).click();
  await expect(field(page)).toHaveValue("I said something different.");
  await page.evaluate(() => { Object.defineProperty(document, "hidden", { configurable: true, value: true }); document.dispatchEvent(new Event("visibilitychange")); });
  await expect(card(page).getByRole("button", { name: "Record your voice" })).toBeEnabled();
  await expect.poll(() => page.evaluate(() => (window as any).speakingMic.stopped)).toBe(1);
  await page.evaluate(() => { Object.defineProperty(document, "hidden", { configurable: true, value: false }); });
  await card(page).getByRole("button", { name: "Record your voice" }).click();
  await expect(card(page).getByRole("button", { name: "Stop recording" })).toBeVisible();
  await page.getByRole("navigation", { name: "Learning navigation" }).getByRole("link", { name: "Review", exact: true }).click();
  await expect(card(page)).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => (window as any).speakingMic.stopped)).toBe(2);
  await expect.poll(() => page.evaluate(() => (window as any).speakingMic.closed)).toBe(2);
});

test("Speaking ignores delayed coach responses after owner changes", async ({ page }) => {
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  let started = false, finished = false;
  await page.route("**/v1/ai/speaking-feedback", async route => { started = true; await held; await route.fulfill({ json: { provider: "old-session", coaching: ["Private old feedback"] } }).catch(() => {}); finished = true; });
  await page.goto("/speaking"); await field(page).fill("Old words");
  await card(page).getByRole("button", { name: "Get coach feedback" }).click();
  await expect.poll(() => started).toBe(true);
  await page.evaluate(() => { window.dispatchEvent(new Event("loccao-auth-change")); });
  release(); await expect(card(page).getByRole("button", { name: "Get coach feedback" })).toBeEnabled();
  await expect.poll(() => finished).toBe(true);
  await expect(card(page).getByText("Private old feedback")).toHaveCount(0);
});

for (const height of [551, 844]) test(`Speaking controls and three distinct phrases at 390x${height}`, async ({ page }) => {
  await page.setViewportSize({ width: 390, height });
  let opened = issued(page); await page.goto("/speaking?pack=work-deadline"); let a: LearningAttempt = await (await opened).json();
  const seen = new Set<string>();
  for (let i = 0; i < 3; i++) {
    expect(a.pack).toBe("work-deadline"); expect(seen.has(a.itemKey)).toBe(false); seen.add(a.itemKey);
    await field(page).fill(a.prompt.question!);
    expect(await field(page).evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(18);
    await check(page).scrollIntoViewIfNeeded(); expect((await check(page).boundingBox())!.height).toBeGreaterThanOrEqual(48);
    await check(page).click(); await expect(card(page).getByText("100% transcript match", { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (i === 0) await page.screenshot({ path: `.cache/speaking-${height}.png`, fullPage: true });
    opened = issued(page); await card(page).getByRole("button", { name: "Next phrase →" }).click(); a = await (await opened).json();
  }
});
