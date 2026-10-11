import { randomUUID } from "node:crypto";
import { test, expect, type Page, type APIRequestContext } from "@playwright/test";
import words from "../../backend/internal/learning/catalog.json";
import dictation from "../../backend/internal/learning/dictation_catalog.json";
import type { LearningAttempt } from "../../lib/learning-attempt";

const API = process.env.E2E_API_URL || "http://localhost:8080";
const root = `${API}/v1/player/bosses/airport-crisis`;
const lines = ["I missed my flight this afternoon.", "Could you rebook me on the next flight?", "Yes please, book it. Which gate should I use?"];
const version = "conversation.v2";
const input = (page: Page) => page.getByRole("textbox", { name: "Your reply" });
async function learner(request: APIRequestContext, unlock = true) {
  const created = await request.post(`${API}/v1/auth/register`, { data: { email: `mission-${randomUUID()}@example.test`, password: "SunlitTest123!", displayName: "Mission Learner" } });
  expect(created.ok(), await created.text()).toBe(true); const user = await created.json();
  const headers = { Authorization: `Bearer ${user.token}` };
  expect((await request.put(`${API}/v1/player/profile`, { headers, data: { goal: "travel", cefrLevel: "B1", dailyMinutes: 15, targetBand: 7, interests: ["travel"] } })).ok()).toBe(true);
  if (unlock) for (const activity of ["word-link", "dictation", "shadowing"]) {
    const response = await request.post(`${API}/v1/learning/attempts`, { headers, data: { activity, requestId: randomUUID(), cefrLevel: "B1", pack: "cefr-core" } });
    expect(response.ok(), await response.text()).toBe(true); const a: LearningAttempt = await response.json();
    const versions = { contentVersion: a.contentVersion, rulesVersion: a.rulesVersion };
    // Prerequisite fixture reports playback; it does not claim a human heard it.
    if (activity === "dictation") {
      const event = { requestId: randomUUID(), rate: 1, ...versions };
      for (const status of ["requested", "completed"]) expect((await request.post(`${API}/v1/learning/attempts/${a.attemptId}/audio`, { headers, data: { ...event, status, ...(status === "completed" ? { provider: "browser-speech-synthesis" } : {}) } })).ok()).toBe(true);
    }
    const answer = activity === "word-link" ? words.items.find(i => i.id === a.itemKey)!.correctAnswer : activity === "dictation" ? dictation.items.find(i => i.id === a.itemKey)!.transcript : a.prompt.question;
    const graded = await request.post(`${API}/v1/learning/attempts/${a.attemptId}/submit`, { headers, data: { ...versions, answer } });
    expect(graded.ok(), await graded.text()).toBe(true); expect((await graded.json()).correct).toBe(true);
  }
  return { ...user, headers };
}
async function signIn(page: Page, token: string) {
  await page.goto("/account"); await page.evaluate(token => { localStorage.setItem("loccao_token", token); window.dispatchEvent(new Event("loccao-auth-change")); }, token);
  await page.goto("/missions/airport");
}
async function send(page: Page, text: string) {
  await input(page).fill(text); await page.getByRole("button", { name: "Send reply" }).click();
  await expect(page.getByRole("button", { name: "Retry same reply" })).toHaveCount(0);
  await expect(page.getByText(text, { exact: true })).toBeVisible();
}

test("mission saves real dialogue after lost responses without per-turn XP", async ({ page, request }) => {
  const user = await learner(request); await signIn(page, user.token);
  let oldAttempts = 0; page.on("request", r => { if (r.url().endsWith("/v1/attempts")) oldAttempts++; });
  await input(page).fill("Private draft before reload"); await page.reload(); await expect(input(page)).toHaveValue("Private draft before reload");
  await send(page, "I did not miss my flight today."); await expect(page.getByText("OBJECTIVES 0/3")).toBeVisible();
  let lost: unknown;
  await page.route("**/bosses/airport-crisis/evaluate", async route => { lost = route.request().postDataJSON(); await route.abort("failed"); }, { times: 1 });
  await input(page).fill(lines[0]); await page.getByRole("button", { name: "Send reply" }).click();
  await expect(page.getByRole("button", { name: "Retry same reply" })).toBeVisible(); await expect(input(page)).toBeDisabled();
  const retry = page.waitForRequest(r => r.url().endsWith("/airport-crisis/evaluate"));
  await page.getByRole("button", { name: "Retry same reply" }).click(); expect((await retry).postDataJSON()).toEqual(lost);
  await expect(page.getByText("OBJECTIVES 1/3")).toBeVisible();
  await send(page, lines[1]); await expect(page.getByText("OBJECTIVES 2/3")).toBeVisible();
  await send(page, lines[2]); await expect(page.getByText("OBJECTIVES 3/3")).toBeVisible();
  expect((await (await request.get(`${API}/v1/me`, { headers: user.headers })).json()).user.xp).toBe(60);
  await page.route("**/bosses/airport-crisis/complete", async route => { const res = await route.fetch(); expect(res.ok(), await res.text()).toBe(true); await route.abort("failed"); }, { times: 1 });
  await page.getByRole("button", { name: "Save chapter completion" }).click(); await expect(page.getByRole("button", { name: "Retry same completion" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Restart dialogue" })).toBeDisabled();
  await page.reload(); await expect(page.getByText("Chapter reward saved · 150 XP")).toBeVisible();
  const receipt = await (await request.get(`${root}/receipt`, { headers: user.headers })).json();
  expect(receipt.messages).toEqual(["I did not miss my flight today.", ...lines]);
  expect(receipt.evaluation).toMatchObject({ evidence: "server-rule-based-reported-dialogue", rulesVersion: version, stage: 3 });
  const data = { messages: receipt.messages, rulesVersion: version };
  expect((await request.post(`${root}/complete`, { headers: user.headers, data })).ok()).toBe(true);
  expect((await request.post(`${root}/complete`, { headers: user.headers, data: { ...data, messages: lines } })).status()).toBe(409);
  expect((await (await request.get(`${API}/v1/me`, { headers: user.headers })).json()).user.xp).toBe(210);
  expect(oldAttempts).toBe(0);
});

test("mission API rejects forged scores, legacy NPC attempts, owner leakage and locked gates", async ({ request }) => {
  const user = await learner(request, false);
  expect((await request.post(`${root}/complete`, { headers: user.headers, data: { score: 100, messages: lines, rulesVersion: version } })).status()).toBe(400);
  expect((await request.post(`${root}/complete`, { headers: user.headers, data: { messages: lines, rulesVersion: version } })).status()).toBe(409);
  expect((await request.post(`${root}/evaluate`, { headers: user.headers, data: { messages: lines, rulesVersion: "old" } })).status()).toBe(409);
  expect((await request.get(`${root}/receipt`, { headers: user.headers })).status()).toBe(404);
  expect((await request.post(`${root}/complete`, { data: { messages: lines, rulesVersion: version } })).status()).toBe(401);
  expect((await request.get(`${root}/receipt`)).status()).toBe(401);
  for (const activity of ["npc-conversation", " NPC-CONVERSATION-AIRPORT ", "npc-conversation-deadline"]) {
    expect((await request.post(`${API}/v1/attempts`, { headers: user.headers, data: { activity, skill: "Speaking", itemKey: "fake", accuracy: 1 } })).status()).toBe(409);
  }
});

test("mission keeps pending completion and retries the identical transcript after reload", async ({ page, request }) => {
  const user = await learner(request); await signIn(page, user.token);
  for (const line of lines) await send(page, line);
  let payload: unknown;
  await page.route("**/bosses/airport-crisis/complete", async route => { payload = route.request().postDataJSON(); await route.abort("failed"); }, { times: 1 });
  await page.getByRole("button", { name: "Save chapter completion" }).click(); await expect(page.getByRole("button", { name: "Retry same completion" })).toBeVisible();
  await page.reload(); await expect(page.getByRole("button", { name: "Restart dialogue" })).toBeDisabled();
  const retry = page.waitForRequest(r => r.url().endsWith("/airport-crisis/complete")); await page.getByRole("button", { name: "Retry same completion" }).click();
  expect((await retry).postDataJSON()).toEqual(payload); await expect(page.getByText("Chapter reward saved · 150 XP")).toBeVisible();
});

test("mission ignores delayed evaluation after sign-out and restores the correct owner's draft", async ({ page, request }) => {
  const user = await learner(request); await signIn(page, user.token); await expect(input(page)).toBeEnabled();
  let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; }); let arrived!: () => void; const started = new Promise<void>(resolve => { arrived = resolve; });
  let finished!: () => void; const done = new Promise<void>(resolve => { finished = resolve; });
  await page.route("**/bosses/airport-crisis/evaluate", async route => { const result = await route.fetch(); arrived(); await gate; try { await route.fulfill({ response: result }); } finally { finished(); } }, { times: 1 });
  await input(page).fill(lines[0]); await page.getByRole("button", { name: "Send reply" }).click(); await started;
  await page.evaluate(() => { localStorage.removeItem("loccao_token"); window.dispatchEvent(new Event("loccao-auth-change")); });
  release(); await done; await expect(page.getByText(/Sign in to keep your mission/)).toBeVisible(); await expect(page.getByText(lines[0], { exact: true })).toHaveCount(0);
  await page.evaluate(token => { localStorage.setItem("loccao_token", token); window.dispatchEvent(new Event("loccao-auth-change")); }, user.token);
  await expect(page.getByText("OBJECTIVES 1/3")).toBeVisible(); await expect(page.getByText(lines[0], { exact: true })).toBeVisible();
});

test("mission isolates account drafts and preserves corrupt storage until explicit restart", async ({ page, request }) => {
  const first = await learner(request), second = await learner(request, false);
  await signIn(page, first.token); await input(page).fill("Only the first learner wrote this.");
  await page.evaluate(token => { localStorage.setItem("loccao_token", token); window.dispatchEvent(new Event("loccao-auth-change")); }, second.token);
  await expect(page.getByText("Complete the chapter checkpoints to enter this role-play.")).toBeVisible();
  await expect(input(page)).toHaveCount(0);
  await page.evaluate(token => { localStorage.setItem("loccao_token", token); window.dispatchEvent(new Event("loccao-auth-change")); }, first.token);
  await expect(input(page)).toHaveValue("Only the first learner wrote this.");
  const key = await page.evaluate(() => Object.keys(localStorage).find(k => k.startsWith("loccao.mission.v2.") && JSON.parse(localStorage.getItem(k)!).text === "Only the first learner wrote this.")!);
  await page.evaluate(key => localStorage.setItem(key, "broken-json"), key); await page.reload();
  await expect(page.getByRole("alert")).toBeVisible(); await expect(input(page)).toBeDisabled();
  expect(await page.evaluate(key => localStorage.getItem(key), key)).toBe("broken-json");
  await page.getByRole("button", { name: "Restart dialogue" }).click();
  await expect(input(page)).toBeEnabled(); await expect(input(page)).toHaveValue("");
});

test("mission remains playable with an explicit warning when draft storage is unavailable", async ({ page, request }) => {
  const user = await learner(request);
  await page.addInitScript(() => {
    const read = Storage.prototype.getItem, write = Storage.prototype.setItem;
    Storage.prototype.getItem = function(key) { if (key.startsWith("loccao.mission.")) throw new DOMException("Blocked", "SecurityError"); return read.call(this, key); };
    Storage.prototype.setItem = function(key, value) { if (key.startsWith("loccao.mission.")) throw new DOMException("Blocked", "SecurityError"); return write.call(this, key, value); };
  });
  await signIn(page, user.token); await expect(input(page)).toBeEnabled();
  await expect(page.getByText(/Browser storage is unavailable/)).toBeVisible();
  await send(page, lines[0]); await expect(page.getByText("OBJECTIVES 1/3")).toBeVisible();
  await page.getByRole("button", { name: "Reload saved state" }).click();
  await expect(page.getByText("OBJECTIVES 1/3")).toBeVisible();
  await send(page, lines[1]); await send(page, lines[2]);
  await page.route("**/bosses/airport-crisis/complete", async route => { await route.abort("failed"); }, { times: 1 });
  await page.getByRole("button", { name: "Save chapter completion" }).click();
  await expect(page.getByRole("button", { name: "Retry same completion" })).toBeVisible();
  await page.getByRole("button", { name: "Reload saved state" }).click();
  await expect(page.getByRole("button", { name: "Restart dialogue" })).toBeDisabled();
  await page.getByRole("button", { name: "Retry same completion" }).click();
  await expect(page.getByText("Chapter reward saved · 150 XP")).toBeVisible();
});

for (const height of [551, 844]) test(`mission is readable and usable on 390x${height}`, async ({ page, request }) => {
  await page.setViewportSize({ width: 390, height }); const user = await learner(request); await signIn(page, user.token);
  await send(page, lines[0]); await expect(page.getByText("OBJECTIVES 1/3")).toBeVisible();
  const box = await input(page).boundingBox(); expect(box!.width).toBeGreaterThan(250);
  expect(await input(page).evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(18);
  expect(await page.locator(".chat-bubble.user p").evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(18);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  for (const button of await page.getByRole("region", { name: "Mission conversation" }).getByRole("button").all()) expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(48);
  await page.screenshot({ path: `.cache/mission-${height}.png`, fullPage: true });
});
