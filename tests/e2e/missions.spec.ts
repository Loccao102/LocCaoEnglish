import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { test, expect, type Page, type APIRequestContext } from "@playwright/test";
import words from "../../backend/internal/learning/catalog.json";
import dictation from "../../backend/internal/learning/dictation_catalog.json";
import grammar from "../../backend/internal/learning/grammar_catalog.json";
import collocations from "../../backend/internal/learning/collocation_catalog.json";
import story from "../../backend/internal/learning/story_catalog.json";
import type { LearningAttempt } from "../../lib/learning-attempt";

const API = process.env.E2E_API_URL || "http://localhost:8080";
const root = `${API}/v1/player/bosses/airport-crisis`;
const lines = ["I missed my flight this afternoon.", "Could you rebook me on the next flight?", "Yes please, book it. Which gate should I use?"];
const version = "conversation.v2";
const input = (page: Page) => page.getByRole("textbox", { name: "Your reply" });
// All browser/API fixtures share one source IP. This suite creates prerequisite
// evidence for several independent accounts, so it needs its own rate window.
// Let the real 60s buckets expire before/after it; do not reset Redis, raise the
// limits or silently retry failed assertions. The explicit 429 case stays below.
async function separateRateWindow() {
  test.setTimeout(90_000);
  await delay(60_100);
}
test.beforeAll(separateRateWindow);
test.afterAll(separateRateWindow);

test.beforeEach(async ({ page }) => {
  page.on("response", response => {
    if (response.status() === 429) console.warn(`Mission request throttled: ${new URL(response.url()).pathname}`);
  });
});
async function learner(request: APIRequestContext, unlock = true) {
  const created = await request.post(`${API}/v1/auth/register`, { data: { email: `mission-${randomUUID()}@example.test`, password: "SunlitTest123!", displayName: "Mission Learner" } });
  expect(created.ok(), await created.text()).toBe(true); const user = await created.json();
  const headers = { Authorization: `Bearer ${user.token}` };
  expect((await request.put(`${API}/v1/player/profile`, { headers, data: { goal: "travel", cefrLevel: "B1", dailyMinutes: 15, targetBand: 7, interests: ["travel"] } })).ok()).toBe(true);
  if (unlock) for (const activity of ["word-link", "dictation", "shadowing"]) await practiceRound(request, headers, activity);
  return { ...user, headers };
}
async function practiceRound(request: APIRequestContext, headers: Record<string, string>, activity: string, wrong = false) {
    const response = await request.post(`${API}/v1/learning/attempts`, { headers, data: { activity, requestId: randomUUID(), cefrLevel: "B1", pack: activity === "story-choice" ? "hotel-check-in" : "cefr-core" } });
    expect(response.ok(), await response.text()).toBe(true); const a: LearningAttempt = await response.json();
    const versions = { contentVersion: a.contentVersion, rulesVersion: a.rulesVersion };
    // Prerequisite fixture reports playback; it does not claim a human heard it.
    if (activity === "dictation") {
      const event = { requestId: randomUUID(), rate: 1, ...versions };
      for (const status of ["requested", "completed"]) expect((await request.post(`${API}/v1/learning/attempts/${a.attemptId}/audio`, { headers, data: { ...event, status, ...(status === "completed" ? { provider: "browser-speech-synthesis" } : {}) } })).ok()).toBe(true);
    }
    const correct = activity === "word-link" ? words.items.find(i => i.id === a.itemKey)!.correctAnswer
      : activity === "dictation" ? dictation.items.find(i => i.id === a.itemKey)!.transcript
      : activity === "grammar-repair" ? grammar.items.find(i => i.id === a.itemKey)!.correctAnswer
      : activity === "collocation-factory" ? collocations.items.find(i => i.id === a.itemKey)!.correctAnswer
      : activity === "story-choice" ? story.nodes.find(n => n.id === "arrival")!.choices!.find(c => c.good)!.label
      : a.prompt.question;
    const answer = wrong ? a.prompt.options.find(option => option !== correct)! : correct;
    const graded = await request.post(`${API}/v1/learning/attempts/${a.attemptId}/submit`, { headers, data: { ...versions, answer } });
    expect(graded.ok(), await graded.text()).toBe(true);
    const result = await graded.json(); expect(result.correct).toBe(!wrong);
    return { attempt: a, result, input: { ...versions, answer } };
}
async function signIn(page: Page, token: string) {
  // Install the test account before the first mission document. Visiting the
  // account page just to set a token caused an unnecessary second app bootstrap.
  await page.addInitScript(({ token, key }) => {
    if (!sessionStorage.getItem(key)) { localStorage.setItem("loccao_token", token); sessionStorage.setItem(key, "ready"); }
  }, { token, key: `mission-test-init-${randomUUID()}` });
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
  expect(receipt.preparation.rulesVersion).toBe("campaign-practice.v1");
  expect(receipt.preparation.checkpoints.map((c: { checkpointId: string }) => c.checkpointId)).toEqual(["airport-vocab", "airport-listening", "airport-speaking"]);
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
  await expect(page.locator(".feedback-banner[role=alert]")).toBeVisible(); await expect(input(page)).toBeDisabled();
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

test("mission explains a throttled load and lets the player retry without clearing the draft", async ({ page, request }) => {
  const user = await learner(request); await signIn(page, user.token); await input(page).fill("My reply survives a temporary limit.");
  await page.route("**/v1/player/progression", route => route.fulfill({ status: 429, headers: { "Retry-After": "1" }, json: { error: "rate limit exceeded" } }), { times: 1 });
  await page.reload(); await expect(page.locator(".feedback-banner[role=alert]")).toHaveText("rate limit exceeded");
  await page.getByRole("button", { name: "Retry loading mission" }).click();
  await expect(input(page)).toHaveValue("My reply survives a temporary limit.");
});

test("mission retries a failed saved receipt without reclaiming the chapter reward", async ({ page, request }) => {
  const user = await learner(request);
  const completed = await request.post(`${root}/complete`, { headers: user.headers, data: { messages: lines, rulesVersion: version } });
  expect(completed.ok(), await completed.text()).toBe(true);
  let claims = 0;
  page.on("request", r => { if (r.url().endsWith("/airport-crisis/complete")) claims++; });
  await page.route("**/bosses/airport-crisis/receipt", route => route.fulfill({ status: 503, json: { error: "Saved dialogue is temporarily unavailable." } }), { times: 1 });
  await signIn(page, user.token);
  await expect(page.locator(".feedback-banner[role=alert]")).toHaveText("Saved dialogue is temporarily unavailable.");
  await expect(page.getByText("Chapter reward saved · 150 XP")).toBeVisible();
  await expect(page.getByText("Your submitted dialogue and rule-based result are saved to your account.")).toHaveCount(0);
  await expect(page.getByText("Your chapter is complete, but its saved dialogue could not be loaded.")).toBeVisible();
  await page.getByRole("button", { name: "Retry loading saved completion" }).click();
  for (const line of lines) await expect(page.getByText(line, { exact: true })).toBeVisible();
  await expect(page.getByText("Your submitted dialogue and rule-based result are saved to your account.")).toBeVisible();
  await expect(page.getByText("Your three preparation rounds are saved with this chapter.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Retry loading saved completion" })).toHaveCount(0);
  expect(claims).toBe(0);
  expect((await (await request.get(`${API}/v1/me`, { headers: user.headers })).json()).user.xp).toBe(210);
});

// These two cases only read the gate and evaluate one turn; isolated browser
// contexts can share prerequisite evidence without repeating nine setup calls.
let mobileUser: Awaited<ReturnType<typeof learner>> | undefined;
for (const height of [551, 844]) test(`mission is readable and usable on 390x${height}`, async ({ page, request }) => {
  await page.setViewportSize({ width: 390, height }); mobileUser ??= await learner(request); await signIn(page, mobileUser.token);
  await send(page, lines[0]); await expect(page.getByText("OBJECTIVES 1/3")).toBeVisible();
  const box = await input(page).boundingBox(); expect(box!.width).toBeGreaterThan(250);
  expect(await input(page).evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(18);
  expect(await page.locator(".chat-bubble.user p").evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(18);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  for (const button of await page.getByRole("region", { name: "Mission conversation" }).getByRole("button").all()) expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(48);
  await page.screenshot({ path: `.cache/mission-${height}.png`, fullPage: true });
});

test("campaign needs the correct activity rather than wrong answers or another learner's practice", async ({ request }) => {
  const user = await learner(request, false), other = await learner(request);
  await practiceRound(request, user.headers, "word-link", true);
  await practiceRound(request, user.headers, "collocation-factory");
  for (const activity of ["dictation", "shadowing"]) await practiceRound(request, user.headers, activity);
  const state = await (await request.get(`${API}/v1/player/progression`, { headers: user.headers })).json();
  const boss = state.bosses.find((b: { id: string }) => b.id === "airport-crisis");
  expect(boss.unlocked).toBe(false);
  expect(boss.checkpoints.map((c: { complete: boolean }) => c.complete)).toEqual([false, true, true]);
  expect((await request.post(`${root}/complete`, { headers: user.headers, data: { messages: lines, rulesVersion: version } })).status()).toBe(409);
  expect((await request.get(`${root}/receipt`, { headers: other.headers })).status()).toBe(404);
  await practiceRound(request, user.headers, "word-link");
  const saved = await request.post(`${root}/complete`, { headers: user.headers, data: { messages: lines, rulesVersion: version } });
  expect(saved.ok(), await saved.text()).toBe(true);
  const completion = await saved.json(); expect(completion.receipt.preparation.checkpoints).toHaveLength(3);
  expect((await request.get(`${root}/receipt`, { headers: other.headers })).status()).toBe(404);
});

test("next chapter requires practice completed after the previous clear and saves that proof", async ({ page, request }) => {
  const user = await learner(request);
  const old = await practiceRound(request, user.headers, "shadowing");
  for (const activity of ["story-choice", "grammar-repair"]) await practiceRound(request, user.headers, activity);
  const complete = await request.post(`${root}/complete`, { headers: user.headers, data: { messages: lines, rulesVersion: version } });
  expect(complete.ok(), await complete.text()).toBe(true);
  const cleared = await complete.json(), airport = cleared.progression.bosses.find((b: { id: string }) => b.id === "airport-crisis");
  await signIn(page, user.token); await page.goto("/missions/hotel");
  await expect(page.getByText("GATE LOCKED", { exact: true })).toBeVisible();
  await expect(page.locator(".mission-stage.complete")).toHaveCount(0);
  expect((await request.post(`${API}/v1/learning/attempts/${old.attempt.attemptId}/submit`, { headers: user.headers, data: old.input })).ok()).toBe(true);
  await page.reload(); await expect(page.locator(".mission-stage.complete")).toHaveCount(0);
  const replay = await practiceRound(request, user.headers, "story-choice");
  expect(replay.result.xpDelta).toBe(0); // A new correct capped round still prepares the chapter.
  for (const activity of ["grammar-repair", "shadowing"]) await practiceRound(request, user.headers, activity);
  await page.reload(); await expect(page.locator(".mission-stage.complete")).toHaveCount(3);
  await expect(input(page)).toBeEnabled();
  const hotelLines = ["My confirmed reservation is missing.", "My confirmation number is ABC123.", "What time is breakfast tomorrow?"];
  for (const line of hotelLines) await send(page, line);
  await page.getByRole("button", { name: "Save chapter completion" }).click();
  await expect(page.getByText("Your three preparation rounds are saved with this chapter.")).toBeVisible();
  const saved = await (await request.get(`${API}/v1/player/bosses/hotel-reservation/receipt`, { headers: user.headers })).json();
  expect(saved.preparation).toMatchObject({ rulesVersion: "campaign-practice.v1", previousBossId: "airport-crisis", previousCompletedAt: airport.completedAt });
  expect(saved.preparation.checkpoints).toHaveLength(3);
  for (const proof of saved.preparation.checkpoints) {
    expect(Date.parse(proof.completedAt)).toBeGreaterThan(Date.parse(airport.completedAt));
    const attempt = await request.get(`${API}/v1/learning/attempts/${proof.attemptId}`, { headers: user.headers });
    expect(attempt.ok(), await attempt.text()).toBe(true); expect((await attempt.json()).result.correct).toBe(true);
  }
});

test("earlier dialogue receipt keeps the clear without inventing preparation evidence", async ({ page, request }) => {
  const user = await learner(request);
  expect((await request.post(`${root}/complete`, { headers: user.headers, data: { messages: lines, rulesVersion: version } })).ok()).toBe(true);
  await page.route("**/bosses/airport-crisis/receipt", async route => {
    const response = await route.fetch(), old = await response.json(); delete old.preparation;
    await route.fulfill({ response, json: old });
  });
  let claims = 0; page.on("request", r => { if (r.url().endsWith("/airport-crisis/complete")) claims++; });
  await signIn(page, user.token);
  await expect(page.getByText("Chapter reward saved · 150 XP")).toBeVisible();
  await expect(page.getByText("This earlier clear is kept. Its preparation rounds were not recorded.")).toBeVisible();
  await expect(page.locator(".mission-progress strong")).toHaveText("100%");
  for (const line of lines) await expect(page.getByText(line, { exact: true })).toBeVisible();
  expect(claims).toBe(0);
});
