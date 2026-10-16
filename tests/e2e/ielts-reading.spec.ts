import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { test, expect, type APIRequestContext, type Page } from "@playwright/test";
import catalog from "../../backend/internal/learning/ielts_reading_catalog.json";
import type { IELTSReadingPrompt, LearningAttempt } from "../../lib/learning-attempt";

const API = process.env.E2E_API_URL || "http://localhost:8080";
const activity = "ielts-reading", pack = "ielts-academic-reading";
type Question = IELTSReadingPrompt["sections"][number]["questions"][number];
type ReadingAttempt = LearningAttempt & { prompt: { reading: IELTSReadingPrompt } };
const questions = (a: ReadingAttempt) => a.prompt.reading.sections.flatMap(section => section.questions);
const correct = (question: Question) => question.options.find(option => option.text === catalog.sections.flatMap(section => section.questions).find(item => item.id === question.id)!.answer)!;
const card = (page: Page) => page.getByRole("region", { name: "IELTS Reading practice", exact: true });
const group = (page: Page, number: number) => card(page).getByRole("group", { name: new RegExp(`^${number}\\. `) });
const issued = (page: Page) => page.waitForResponse(response => response.url().endsWith("/v1/learning/attempts") && response.request().method() === "POST");
const versions = (a: ReadingAttempt) => ({ contentVersion: a.contentVersion, rulesVersion: a.rulesVersion });
const submitPath = (a: ReadingAttempt) => `${API}/v1/learning/attempts/${a.attemptId}/submit`;

// All fixture accounts share an IP with other suites. Wait for the real buckets
// rather than relaxing security limits or retrying failed assertions until green.
async function separateRateWindow() { test.setTimeout(90_000); await delay(60_100); }
test.beforeAll(separateRateWindow);
test.afterAll(separateRateWindow);

async function learner(request: APIRequestContext) {
  const response = await request.post(`${API}/v1/auth/register`, { data: { email: `ielts-reading-${randomUUID()}@example.test`, password: "SunlitTest123!", displayName: "Reading Learner" } });
  expect(response.ok(), await response.text()).toBe(true);
  const account = await response.json();
  return { ...account, headers: { Authorization: `Bearer ${account.token}` } };
}
async function signIn(page: Page, token: string) {
  await page.addInitScript(({ token, key }) => {
    if (!sessionStorage.getItem(key)) { localStorage.setItem("loccao_token", token); sessionStorage.setItem(key, "ready"); }
  }, { token, key: `reading-test-init-${randomUUID()}` });
  const opened = issued(page); await page.goto("/ielts/reading");
  const a: ReadingAttempt = await (await opened).json();
  await expect(group(page, 1)).toBeVisible(); return a;
}
async function issue(request: APIRequestContext, headers: Record<string, string>) {
  const response = await request.post(`${API}/v1/learning/attempts`, { headers, data: { activity, pack, cefrLevel: "B2", requestId: randomUUID() } });
  expect(response.ok(), await response.text()).toBe(true); return await response.json() as ReadingAttempt;
}
async function submitPartial(page: Page) {
  await card(page).getByRole("button", { name: "Submit choices", exact: true }).click();
  await card(page).getByRole("button", { name: "Submit with unanswered questions", exact: true }).click();
}
async function history(request: APIRequestContext, headers: Record<string, string>) {
  const response = await request.get(`${API}/v1/ielts/history`, { headers });
  expect(response.ok()).toBe(true); return (await response.json()).items as { attemptId?: string; source: string; evidence: string; legacy: boolean }[];
}

test("IELTS Reading API owns the answer key, validates selections and records one practice estimate without rewards", async ({ request, page }) => {
  await page.goto("/ielts/reading");
  await expect(page.getByRole("heading", { name: "Sign in to save your Reading practice" })).toBeVisible();
  expect((await request.post(`${API}/v1/learning/attempts`, { data: { activity, pack, cefrLevel: "B2", requestId: randomUUID() } })).status()).toBe(401);
  expect((await request.get(`${API}/v1/ielts/history`)).status()).toBe(401);
  const owner = await learner(request), other = await learner(request), a = await issue(request, owner.headers);
  expect(a).toMatchObject({ activity, pack, cefrLevel: "B2", rulesVersion: "ielts-reading.v1", mode: "account" });
  expect(a).not.toHaveProperty("result"); expect(a.prompt.reading.sections).toHaveLength(3);
  const all = questions(a); expect(all).toHaveLength(40);
  for (const question of all) {
    expect(Object.keys(question).sort()).toEqual(["id", "options", "prompt"]);
    expect(question.options).toHaveLength(4);
    for (const option of question.options) expect(Object.keys(option).sort()).toEqual(["id", "text"]);
  }
  expect(JSON.stringify(a)).not.toMatch(/correctOptions|correctOptionId|correctAnswer|"answer"/);
  const first = all[0], second = all[1];
  const invalid = ["{}", JSON.stringify([["missing-question", first.options[0].id]]), JSON.stringify([[first.id, "missing-option"]]), JSON.stringify([[first.id, correct(first).id], [first.id, correct(first).id]]), JSON.stringify([[second.id, correct(second).id], [first.id, correct(first).id]])];
  for (const answer of invalid) expect((await request.post(submitPath(a), { headers: owner.headers, data: { ...versions(a), answer } })).status()).toBe(400);
  const answer = JSON.stringify(all.map(question => [question.id, correct(question).id]));
  expect((await request.post(submitPath(a), { headers: owner.headers, data: { ...versions(a), answer, score: 40 } })).status()).toBe(400);
  expect((await request.post(submitPath(a), { headers: owner.headers, data: { ...versions(a), rulesVersion: "old", answer } })).status()).toBe(400);
  expect((await request.post(submitPath(a), { headers: other.headers, data: { ...versions(a), answer } })).status()).toBe(404);
  expect((await request.get(`${API}/v1/learning/attempts/${a.attemptId}`, { headers: other.headers })).status()).toBe(404);
  expect((await request.post(`${API}/v1/ielts/objective-score`, { headers: owner.headers, data: { section: "reading", testType: "academic", correct: 40, total: 40 } })).status()).toBe(409);
  expect((await request.post(`${API}/v1/ielts/band`, { headers: owner.headers, data: { section: "writing", testType: "academic", band: 9, source: "loccao-objective" } })).status()).toBe(409);
  const response = await request.post(submitPath(a), { headers: owner.headers, data: { ...versions(a), answer } });
  expect(response.ok(), await response.text()).toBe(true); const result = await response.json();
  expect(result).toMatchObject({ actualAnswer: answer, xpDelta: 0, newConfidence: 0, reviewAdded: false, progressionApplied: false, evidence: "server-objective-practice", ielts: { rawScore: 40, maxScore: 40, band: 9, provider: "loccao-objective", methodVersion: "ielts-anchors-interpolation.v1" } });
  expect(result.ielts.answers).toHaveLength(40); expect(result.ielts.answers.every((entry: { correct: boolean }) => entry.correct)).toBe(true);
  expect(await (await request.post(submitPath(a), { headers: owner.headers, data: { ...versions(a), answer } })).json()).toEqual(result);
  expect((await request.post(submitPath(a), { headers: owner.headers, data: { ...versions(a), answer: "[]" } })).status()).toBe(409);
  const saved = await history(request, owner.headers); expect(saved).toHaveLength(1);
  expect(saved[0]).toMatchObject({ attemptId: a.attemptId, source: "server-objective-practice", evidence: "server-objective-practice", legacy: false, provider: "loccao-objective", methodVersion: "ielts-anchors-interpolation.v1", contentVersion: a.contentVersion, rulesVersion: a.rulesVersion });
  expect(await history(request, other.headers)).toEqual([]);
  const listening = await request.post(`${API}/v1/ielts/objective-score`, { headers: owner.headers, data: { section: "listening", testType: "academic", correct: 20, total: 40 } });
  expect(listening.status()).toBe(409);
  expect((await (await request.get(`${API}/v1/me`, { headers: owner.headers })).json()).user.xp).toBe(0);
  const reviews = await request.get(`${API}/v1/review`, { headers: owner.headers });
  expect(reviews.ok()).toBe(true);
  // The existing review endpoint serializes its empty Go slice as null.
  expect((await reviews.json()).items ?? []).toEqual([]);
  const dashboard = await request.get(`${API}/v1/dashboard`, { headers: owner.headers });
  expect(dashboard.ok()).toBe(true); expect((await dashboard.json()).ieltsBand).toBeNull();
  await page.evaluate(token => { localStorage.setItem("loccao_token", token); window.dispatchEvent(new Event("loccao-auth-change")); }, owner.token);
  await page.goto("/camp");
  await expect(page.locator(".snapshot-band").getByText("No overall estimate yet", { exact: true })).toBeVisible();
  await expect(page.locator(".snapshot-band strong")).toHaveText("—");
  await expect(page.locator(".snapshot-band").getByText("6.0", { exact: true })).toHaveCount(0);
  await page.goto("/ielts");
  const historyCard = page.getByRole("region", { name: "IELTS practice history" });
  await expect(historyCard.getByRole("listitem")).toHaveCount(1);
  await expect(historyCard.getByText(/40\/40 correct · Server-checked Reading choices/)).toBeVisible();
  await page.evaluate(() => { localStorage.removeItem("loccao_token"); window.dispatchEvent(new Event("loccao-auth-change")); });
  await expect(historyCard.getByText(/Sign in to see your saved practice/)).toBeVisible();
  await expect(historyCard.getByRole("listitem")).toHaveCount(0);
  await expect(page.getByText(/latest estimate/)).toHaveCount(0);
});

test("IELTS Reading restores original choices and a committed result after a lost submit response", async ({ page, request }) => {
  let legacyWrites = 0;
  page.on("request", request => { if (request.method() === "POST" && ["/v1/attempts", "/v1/ielts/objective-score", "/v1/ielts/band"].some(path => request.url().endsWith(path))) legacyWrites++; });
  const user = await learner(request), a = await signIn(page, user.token), all = questions(a);
  const right = correct(all[0]), wrong = all[1].options.find(option => option.id !== correct(all[1]).id)!;
  await group(page, 1).getByRole("radio", { name: right.text, exact: true }).check();
  await group(page, 2).getByRole("radio", { name: wrong.text, exact: true }).check();
  await page.reload();
  await expect(group(page, 1).getByRole("radio", { name: right.text, exact: true })).toBeChecked();
  await expect(group(page, 2).getByRole("radio", { name: wrong.text, exact: true })).toBeChecked();
  let payload: { answer: string } | undefined;
  await page.route("**/v1/learning/attempts/*/submit", async route => { payload = route.request().postDataJSON(); const response = await route.fetch(); expect(response.ok(), await response.text()).toBe(true); await route.abort("failed"); }, { times: 1 });
  await submitPartial(page); await expect(card(page).getByRole("button", { name: "Retry same answer" })).toBeVisible();
  expect(JSON.parse(payload!.answer)).toEqual([[all[0].id, right.id], [all[1].id, wrong.id]]);
  await expect(card(page).locator("input[type=radio]:enabled")).toHaveCount(0);
  await expect(card(page).getByRole("button", { name: "Part 2", exact: true })).toBeDisabled();
  await page.reload(); await expect(card(page).getByRole("heading", { name: "Reading practice saved" })).toBeVisible();
  await expect(card(page).getByText("1/40 correct", { exact: true })).toBeVisible();
  await expect(group(page, 2).getByText(`Your answer: ${wrong.text}`, { exact: true })).toBeVisible();
  await expect(group(page, 2).getByText(`Correct answer: ${correct(all[1]).text}`, { exact: true })).toBeVisible();
  const restored = await (await request.get(`${API}/v1/learning/attempts/${a.attemptId}`, { headers: user.headers })).json();
  expect(restored.result.actualAnswer).toBe(payload!.answer);
  expect(restored.result.ielts.answers[0]).toMatchObject({ optionId: right.id, correct: true });
  expect(restored.result.ielts.answers[1]).toMatchObject({ optionId: wrong.id, correct: false });
  expect(restored.result.ielts.answers.slice(2).every((entry: { optionId: string; correct: boolean }) => entry.optionId === "" && !entry.correct)).toBe(true);
  expect((await history(request, user.headers)).filter(entry => entry.attemptId === a.attemptId)).toHaveLength(1);
  expect((await (await request.get(`${API}/v1/me`, { headers: user.headers })).json()).user.xp).toBe(0);
  expect(legacyWrites).toBe(0);
});

test("IELTS Reading locks a pending attempt and retries exactly the same choices after reload", async ({ page, request }) => {
  const user = await learner(request), a = await signIn(page, user.token), first = questions(a)[0], option = first.options[0];
  await group(page, 1).getByRole("radio", { name: option.text, exact: true }).check();
  let payload: unknown;
  await page.route("**/v1/learning/attempts/*/submit", async route => { payload = route.request().postDataJSON(); await route.abort("failed"); }, { times: 1 });
  await submitPartial(page); await expect(card(page).getByRole("button", { name: "Retry same answer" })).toBeVisible();
  await page.reload(); await expect(group(page, 1).getByRole("radio", { name: option.text, exact: true })).toBeChecked();
  await expect(card(page).locator("input[type=radio]:enabled")).toHaveCount(0);
  await expect(card(page).getByRole("button", { name: "Clear answer for question 1", exact: true })).toBeDisabled();
  const retry = page.waitForRequest(response => response.url().endsWith(`/${a.attemptId}/submit`));
  await card(page).getByRole("button", { name: "Retry same answer" }).click(); expect((await retry).postDataJSON()).toEqual(payload);
  await expect(card(page).getByRole("heading", { name: "Reading practice saved" })).toBeVisible();
  expect((await history(request, user.headers)).filter(entry => entry.attemptId === a.attemptId)).toHaveLength(1);
});

test("IELTS Reading ignores an old account response and restores the owner's saved result", async ({ page, request }) => {
  const first = await learner(request), second = await learner(request), a = await signIn(page, first.token);
  const option = correct(questions(a)[0]); await group(page, 1).getByRole("radio", { name: option.text, exact: true }).check();
  let release!: () => void, arrived!: () => void, finished!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; }), started = new Promise<void>(resolve => { arrived = resolve; }), done = new Promise<void>(resolve => { finished = resolve; });
  await page.route("**/v1/learning/attempts/*/submit", async route => {
    const response = await route.fetch(); expect(response.ok()).toBe(true); arrived(); await gate;
    try { await route.fulfill({ response }); } finally { finished(); }
  }, { times: 1 });
  await submitPartial(page); await started;
  const opened = issued(page);
  await page.evaluate(token => { localStorage.setItem("loccao_token", token); window.dispatchEvent(new Event("loccao-auth-change")); }, second.token);
  const next: ReadingAttempt = await (await opened).json(); expect(next.attemptId).not.toBe(a.attemptId);
  release(); await done;
  await expect(group(page, 1)).toBeVisible(); await expect(card(page).locator("input[type=radio]:checked")).toHaveCount(0);
  await expect(card(page).getByRole("heading", { name: "Reading practice saved" })).toHaveCount(0);
  expect(await history(request, second.headers)).toEqual([]);
  await page.evaluate(token => { localStorage.setItem("loccao_token", token); window.dispatchEvent(new Event("loccao-auth-change")); }, first.token);
  await expect(card(page).getByRole("heading", { name: "Reading practice saved" })).toBeVisible();
  await expect(card(page).getByText("1/40 correct", { exact: true })).toBeVisible();
});

test("IELTS Reading preserves corrupt storage until the learner explicitly starts a new attempt", async ({ page, request }) => {
  const user = await learner(request), a = await signIn(page, user.token);
  await group(page, 1).getByRole("radio").first().check();
  const key = await page.evaluate(() => Object.keys(localStorage).find(key => key.startsWith("loccao.verified-round.v1.") && key.includes(".ielts-reading."))!);
  expect(key).toBeTruthy(); await page.evaluate(key => localStorage.setItem(key, "broken-json"), key); await page.reload();
  await expect(card(page).getByRole("alert")).toContainText("Round could not load");
  expect(await page.evaluate(key => localStorage.getItem(key), key)).toBe("broken-json");
  await expect(card(page).getByRole("radio")).toHaveCount(0);
  const opened = issued(page); await card(page).getByRole("button", { name: "Start a new round", exact: true }).click();
  expect((await (await opened).json()).attemptId).not.toBe(a.attemptId);
  await expect(group(page, 1).getByRole("radio").first()).toBeEnabled();
  expect((await (await request.get(`${API}/v1/learning/attempts/${a.attemptId}`, { headers: user.headers })).json()).result).toBeUndefined();
  // A valid outer reference with a damaged choices payload needs its own
  // explicit recovery; it must not silently become a submitted empty answer.
  await page.evaluate(key => { const ref = JSON.parse(localStorage.getItem(key)!); ref.draft = '[ ["unknown-question", "unknown-option"] ]'; localStorage.setItem(key, JSON.stringify(ref)); }, key);
  await page.reload();
  await expect(card(page).getByRole("alert")).toContainText("Your saved choices could not be read. They have not been submitted.");
  await expect(card(page).getByRole("button", { name: "Submit choices", exact: true })).toBeDisabled();
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).draft, key)).toBe('[ ["unknown-question", "unknown-option"] ]');
  await card(page).getByRole("button", { name: "Discard invalid draft", exact: true }).click();
  await expect(group(page, 1).getByRole("radio").first()).toBeEnabled();
  await expect(card(page).locator("input[type=radio]:checked")).toHaveCount(0);
});

test("IELTS Reading can retry in memory when browser draft storage is unavailable", async ({ page, request }) => {
  const user = await learner(request);
  await page.addInitScript(() => {
    const read = Storage.prototype.getItem, write = Storage.prototype.setItem;
    Storage.prototype.getItem = function(key) { if (key.startsWith("loccao.verified-round.")) throw new DOMException("Blocked", "SecurityError"); return read.call(this, key); };
    Storage.prototype.setItem = function(key, value) { if (key.startsWith("loccao.verified-round.")) throw new DOMException("Blocked", "SecurityError"); return write.call(this, key, value); };
  });
  const a = await signIn(page, user.token), option = correct(questions(a)[0]);
  await expect(card(page).getByText(/Browser storage is unavailable/)).toBeVisible();
  await group(page, 1).getByRole("radio", { name: option.text, exact: true }).check();
  let payload: unknown;
  await page.route("**/v1/learning/attempts/*/submit", async route => { payload = route.request().postDataJSON(); await route.abort("failed"); }, { times: 1 });
  await submitPartial(page); await expect(card(page).getByRole("button", { name: "Retry same answer" })).toBeVisible();
  await expect(group(page, 1).getByRole("radio", { name: option.text, exact: true })).toBeChecked();
  await expect(card(page).locator("input[type=radio]:enabled")).toHaveCount(0);
  await expect(card(page).getByRole("button", { name: "Part 2", exact: true })).toBeDisabled();
  const retry = page.waitForRequest(response => response.url().endsWith(`/${a.attemptId}/submit`));
  await card(page).getByRole("button", { name: "Retry same answer" }).click(); expect((await retry).postDataJSON()).toEqual(payload);
  await expect(card(page).getByRole("heading", { name: "Reading practice saved" })).toBeVisible();
  expect((await history(request, user.headers)).filter(entry => entry.attemptId === a.attemptId)).toHaveLength(1);
});

for (const height of [551, 844]) test(`IELTS Reading supports forty questions, keyboard choices and readable feedback at 390x${height}`, async ({ page, request }) => {
  await page.setViewportSize({ width: 390, height });
  const user = await learner(request), a = await signIn(page, user.token);
  const all = questions(a), option = correct(all[0]);
  const radio = group(page, 1).getByRole("radio", { name: option.text, exact: true });
  await radio.focus(); await page.keyboard.press("Space"); await expect(radio).toBeChecked();
  await card(page).getByRole("button", { name: "Clear answer for question 1", exact: true }).click(); await expect(radio).not.toBeChecked();
  await radio.focus(); await page.keyboard.press("Space");
  let count = 0;
  for (let part = 0; part < 3; part++) {
    await card(page).getByRole("button", { name: `Part ${part + 1}`, exact: true }).click();
    await expect(card(page).getByRole("group")).toHaveCount(a.prompt.reading.sections[part].questions.length);
    count += await card(page).getByRole("group").count();
  }
  expect(count).toBe(40); await card(page).getByRole("button", { name: "Part 1", exact: true }).click();
  await expect(radio).toBeChecked();
  expect(await group(page, 1).locator("legend").evaluate(element => parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(18);
  for (const label of await group(page, 1).locator("label").all()) {
    expect((await label.boundingBox())!.height).toBeGreaterThanOrEqual(48);
    expect(await label.evaluate(element => parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(16);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await group(page, 1).evaluate(element => window.scrollTo({ top: window.scrollY + element.getBoundingClientRect().top - 110, behavior: "instant" }));
  await page.screenshot({ path: `.cache/ielts-reading-${height}.png` });
  await card(page).getByRole("button", { name: "Submit choices", exact: true }).click();
  await card(page).getByRole("button", { name: "Keep answering", exact: true }).click(); await expect(radio).toBeEnabled();
  await submitPartial(page); await expect(card(page).getByText("1/40 correct", { exact: true })).toBeVisible();
  await expect(group(page, 1).getByText(`Your answer: ${option.text}`, { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await card(page).getByRole("heading", { name: "Reading practice saved" }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: `.cache/ielts-reading-feedback-${height}.png` });
});
