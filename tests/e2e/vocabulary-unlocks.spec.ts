import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { test, expect, type APIRequestContext, type Page } from "@playwright/test";
import words from "../../backend/internal/learning/catalog.json";
import collocations from "../../backend/internal/learning/collocation_catalog.json";
import type { LearningAttempt, LearningAttemptResult } from "../../lib/learning-attempt";
import type { ProgressionState } from "../../lib/api";

const API = process.env.E2E_API_URL || "http://localhost:8080";
const METHOD = "vocabulary-unlocks.v1";
type Account = { token: string; user: { id: string }; headers: Record<string, string> };
type Item = { id: string; pack: string; cefrLevel: string; correctAnswer: string };
const wordItems = words.items.filter(item => item.pack === "cefr-core").slice(0, 6);
const collocationItem = collocations.items.find(item => item.pack === "cefr-core" && item.cefrLevel === "A1")!;
const wordWorld = (page: Page) => page.getByRole("article", { name: "Word Network world", exact: true });
const pin = (page: Page) => page.getByRole("button", { name: "Equip Wordsmith Pin", exact: true });
const wordsState = (state: ProgressionState) => state.worlds.find(world => world.id === "words")!;
const wordsmith = (state: ProgressionState) => state.achievements.find(item => item.id === "wordsmith")!;
const pinState = (state: ProgressionState) => state.inventory.find(item => item.id === "wordsmith-pin")!;

// This file creates independent real learners; isolate its auth burst from the
// other files without changing server limits or retrying failed assertions.
async function separateRateWindow() { test.setTimeout(90_000); await delay(60_100); }
test.beforeAll(separateRateWindow);
test.afterAll(separateRateWindow);

async function account(request: APIRequestContext): Promise<Account> {
  const response = await request.post(`${API}/v1/auth/register`, { data: {
    email: `vocabulary-grant-${randomUUID()}@example.test`, password: "SunlitTest123!", displayName: "Vocabulary explorer",
  } });
  expect(response.ok()).toBe(true); const result = await response.json();
  return { ...result, headers: { Authorization: `Bearer ${result.token}` } };
}
async function signIn(page: Page, owner: Account, path = "/progress") {
  await page.addInitScript(({ token, key }) => {
    if (!sessionStorage.getItem(key)) { localStorage.setItem("loccao_token", token); sessionStorage.setItem(key, "ready"); }
  }, { token: owner.token, key: `vocabulary-owner-${randomUUID()}` });
  await page.goto(path);
}
async function switchAccount(page: Page, owner: Account) {
  await page.evaluate(token => { localStorage.setItem("loccao_token", token); window.dispatchEvent(new Event("loccao-auth-change")); }, owner.token);
}
async function progression(request: APIRequestContext, owner: Account): Promise<ProgressionState> {
  const response = await request.get(`${API}/v1/player/progression`, { headers: owner.headers });
  expect(response.ok()).toBe(true); return response.json();
}
async function start(request: APIRequestContext, owner: Account, activity: "word-link" | "collocation-factory", item: Item): Promise<LearningAttempt> {
  const catalog = activity === "word-link" ? words.items : collocations.items;
  const response = await request.post(`${API}/v1/learning/attempts`, { headers: owner.headers, data: {
    requestId: randomUUID(), activity, pack: item.pack, cefrLevel: item.cefrLevel,
    excludeItemKeys: catalog.filter(other => other.pack === item.pack && other.cefrLevel === item.cefrLevel && other.id !== item.id).map(other => other.id),
  } });
  expect(response.ok()).toBe(true); const attempt = await response.json(); expect(attempt.itemKey).toBe(item.id); return attempt;
}
async function submit(request: APIRequestContext, owner: Account, attempt: LearningAttempt, answer: string): Promise<LearningAttemptResult> {
  const response = await request.post(`${API}/v1/learning/attempts/${attempt.attemptId}/submit`, { headers: owner.headers,
    data: { answer, contentVersion: attempt.contentVersion, rulesVersion: attempt.rulesVersion } });
  expect(response.ok()).toBe(true); return response.json();
}
async function practice(request: APIRequestContext, owner: Account, activity: "word-link" | "collocation-factory", item: Item) {
  const attempt = await start(request, owner, activity, item);
  const result = await submit(request, owner, attempt, item.correctAnswer);
  expect(result.correct).toBe(true); return { attempt, result };
}
async function prepare(request: APIRequestContext, owner: Account, count = 7) {
  for (const item of wordItems.slice(0, Math.min(count, 6))) await practice(request, owner, "word-link", item);
  if (count === 7) await practice(request, owner, "collocation-factory", collocationItem);
  return progression(request, owner);
}
async function paint(page: Page) {
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
}

test("Real distinct vocabulary work opens two saved milestones without replay rewards", async ({ page, request }) => {
  const owner = await account(request);
  const dashboard = await (await request.get(`${API}/v1/dashboard`, { headers: owner.headers })).json();
  expect(dashboard.skills.find((skill: { name: string }) => skill.name === "Vocabulary").confidence).toBe(.74);
  const initial = await progression(request, owner);
  expect(wordsState(initial)).toMatchObject({ unlocked: false, unlock: { method: METHOD, correctItems: 0, targetItems: 3 } });
  expect(wordsmith(initial)).toMatchObject({ unlocked: false, unlock: { correctItems: 0, targetItems: 7, targetActivities: 2 } });
  expect(pinState(initial).unlocked).toBe(false);
  await signIn(page, owner);
  await expect(wordWorld(page).getByRole("link", { name: "Enter world →" })).toHaveCount(0);
  await expect(wordWorld(page)).toContainText("0/3 different vocabulary items answered correctly · 0/1 activity");
  await expect(pin(page)).toBeDisabled();
  await expect(wordWorld(page)).not.toContainText(/74%|55%|explored/);

  const opened = page.waitForResponse(response => response.url().endsWith("/v1/learning/attempts") && response.request().method() === "POST");
  await page.goto("/games/word-link"); const first: LearningAttempt = await (await opened).json();
  const firstItem = words.items.find(item => item.id === first.itemKey)!;
  await page.locator(".word-option").filter({ hasText: firstItem.correctAnswer }).click();
  await expect(page.getByText("Connection verified ✓", { exact: true })).toBeVisible();
  const replay = await practice(request, owner, "word-link", firstItem);
  expect(replay.result).toMatchObject({ progressionApplied: false, xpDelta: 0 });
  expect(await submit(request, owner, replay.attempt, firstItem.correctAnswer)).toEqual(replay.result);
  expect(wordsState(await progression(request, owner)).unlock).toMatchObject({ correctItems: 1 });
  const firstLevel = words.items.filter(item => item.pack === "cefr-core" && item.cefrLevel === "A1");
  for (const item of firstLevel.filter(item => item.id !== first.itemKey)) await practice(request, owner, "word-link", item);
  const three = await progression(request, owner);
  expect(wordsState(three)).toMatchObject({ unlocked: true, unlock: { correctItems: 3, receipt: { method: METHOD, source: "checked-practice", unlockId: "word-network" } } });
  expect(wordsState(three).unlock!.receipt!.evidence).toHaveLength(3);
  expect(pinState(three).unlocked).toBe(false);
  await page.goto("/progress");
  await expect(wordWorld(page).getByRole("link", { name: "Enter world →" })).toBeVisible();
  await expect(wordWorld(page)).toContainText("Checked vocabulary practice");
  await expect(pin(page)).toBeDisabled();
  for (const item of wordItems.filter(item => item.cefrLevel !== "A1")) await practice(request, owner, "word-link", item);
  const six = await progression(request, owner);
  expect(wordsmith(six)).toMatchObject({ unlocked: false, unlock: { correctItems: 6, activityCount: 1 } });
  await page.reload();
  await expect(page.getByRole("article", { name: "Wordsmith achievement", exact: true })).toContainText("6/7 different vocabulary items answered correctly · 1/2 activities");
  await expect(pin(page)).toBeDisabled();
  await practice(request, owner, "collocation-factory", collocationItem);
  const seven = await progression(request, owner);
  expect(wordsmith(seven)).toMatchObject({ unlocked: true, unlock: { correctItems: 7, activityCount: 2, receipt: { source: "checked-practice", unlockId: "wordsmith" } } });
  expect(pinState(seven).unlock!.receipt).toEqual(wordsmith(seven).unlock!.receipt);
  const wrong = await start(request, owner, "word-link", firstItem);
  expect(await submit(request, owner, wrong, wrong.prompt.options.find(option => option !== firstItem.correctAnswer)!)).toMatchObject({ correct: false, xpDelta: 0 });
  const afterWrong = await progression(request, owner);
  expect(wordsState(afterWrong).unlock!.receipt).toEqual(wordsState(three).unlock!.receipt);
  expect(wordsmith(afterWrong).unlock!.receipt).toEqual(wordsmith(seven).unlock!.receipt);
  expect(wordsmith(afterWrong).unlock!.correctItems).toBe(7);

  await page.goto("/progress");
  await expect(page.getByRole("article", { name: "Wordsmith achievement", exact: true })).toContainText("7/7 different vocabulary items answered correctly · 2/2 activities");
  await expect(pin(page)).toBeEnabled();
  await pin(page).click(); await expect(pin(page)).toContainText("EQUIPPED");
  await page.reload(); await expect(pin(page)).toContainText("EQUIPPED");
  const equipped = await progression(request, owner); expect(equipped.xp).toBe(140); expect(pinState(equipped).equipped).toBe(true);
  for (const height of [551, 844]) {
    await page.setViewportSize({ width: 390, height });
    await wordWorld(page).evaluate(el => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 110));
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `.cache/vocabulary-world-${height}.png` });
    await pin(page).evaluate(el => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 110));
    await page.screenshot({ path: `.cache/vocabulary-pin-${height}.png` });
  }
  await page.goto("/camp");
  const campWords = page.getByRole("region", { name: "World selection" }).getByLabel("Word Network world", { exact: true });
  await expect(campWords).toContainText("Checked vocabulary practice");
  await expect(campWords).not.toContainText(/explored|74%/);
  await page.goto("/account");
  await expect(page.getByRole("article", { name: "Wordsmith achievement", exact: true })).toContainText("Checked vocabulary practice");
});

test("Guests cannot change shared demo equipment and see personal sign-in boundaries", async ({ page, request }) => {
  const reads: string[] = [];
  page.on("request", request => { if (request.url().endsWith("/v1/player/progression")) reads.push(request.url()); });
  expect((await request.put(`${API}/v1/player/loadout`, { data: { cosmeticId: "rookie-title" } })).status()).toBe(401);
  await page.goto("/progress");
  await expect(page.getByRole("link", { name: "Sign in for personal progress" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Practise vocabulary →", exact: true })).toHaveAttribute("href", "/games/word-link");
  await expect(page.getByRole("link", { name: "Explore word connections →", exact: true })).toHaveAttribute("href", "/word-graph");
  await expect(pin(page)).toHaveCount(0);
  await page.goto("/camp");
  await expect(page.getByRole("link", { name: "Sign in for your worlds" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Sign in for your campaign" })).toBeVisible();
  await page.goto("/account");
  await expect(page.getByRole("heading", { name: "A home for your story.", exact: true })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Email", exact: true })).toBeVisible();
  await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
  await expect(page.getByRole("article", { name: "Wordsmith achievement", exact: true })).toHaveCount(0);
  expect(reads).toEqual([]);
});

test("A late progression read cannot replace the newly signed-in account", async ({ page, request }) => {
  const first = await account(request), other = await account(request); await prepare(request, first, 3);
  let release!: () => void, captured!: () => void, finished!: () => void;
  const hold = new Promise<void>(resolve => { release = resolve; });
  const arrived = new Promise<void>(resolve => { captured = resolve; });
  const done = new Promise<void>(resolve => { finished = resolve; });
  await page.route("**/v1/player/progression", async route => {
    if (route.request().headers().authorization !== first.headers.Authorization) return route.continue();
    const response = await route.fetch(); expect(response.ok()).toBe(true); captured(); await hold;
    await route.fulfill({ response }); finished();
  });
  try {
    await signIn(page, first); await arrived; await switchAccount(page, other);
    await expect(wordWorld(page).getByRole("link", { name: "Enter world →" })).toHaveCount(0);
    await expect(wordWorld(page)).toContainText("0/3 different vocabulary items answered correctly · 0/1 activity");
    release(); await done; await paint(page);
    await expect(wordWorld(page).getByRole("link", { name: "Enter world →" })).toHaveCount(0);
    await expect(pin(page)).toBeDisabled();
    expect(wordsState(await progression(request, other)).unlocked).toBe(false);
    await page.goto("/camp");
    const campWords = page.getByRole("region", { name: "World selection" }).getByLabel("Word Network world", { exact: true });
    await expect(campWords).toHaveClass(/locked/);
    await expect(campWords).toContainText("Vocabulary practice milestone");
    await expect(campWords).not.toContainText("Checked vocabulary practice");
    await page.goto("/account");
    await expect(page.getByRole("article", { name: "Wordsmith achievement", exact: true })).toContainText("0/7 different vocabulary items answered correctly");
  } finally { release(); }
});

test("A late equipment response stays with its original owner", async ({ page, request }) => {
  const first = await account(request), other = await account(request); await prepare(request, first);
  await signIn(page, first); await expect(pin(page)).toBeEnabled();
  let release!: () => void, captured!: () => void, finished!: () => void;
  const hold = new Promise<void>(resolve => { release = resolve; });
  const committed = new Promise<void>(resolve => { captured = resolve; });
  const done = new Promise<void>(resolve => { finished = resolve; });
  await page.route("**/v1/player/loadout", async route => {
    expect(route.request().headers().authorization).toBe(first.headers.Authorization);
    expect(route.request().postDataJSON()).toEqual({ cosmeticId: "wordsmith-pin" });
    const response = await route.fetch(); expect(response.ok()).toBe(true); captured(); await hold;
    await route.fulfill({ response }); finished();
  });
  try {
    await pin(page).click(); await committed; await switchAccount(page, other);
    await expect(pin(page)).toBeDisabled(); await expect(pin(page)).not.toContainText("EQUIPPED");
    release(); await done; await paint(page);
    await expect(pin(page)).toBeDisabled(); await expect(pin(page)).not.toContainText("EQUIPPED");
    expect(pinState(await progression(request, first)).equipped).toBe(true);
    expect(pinState(await progression(request, other))).toMatchObject({ unlocked: false, equipped: false });
  } finally { release(); }
});

test("Lost equipment confirmation refreshes saved rewards without a duplicate mutation", async ({ page, request }) => {
  const owner = await account(request); const before = await prepare(request, owner); await signIn(page, owner);
  let puts = 0;
  await page.route("**/v1/player/loadout", async route => { puts++; const response = await route.fetch(); expect(response.ok()).toBe(true); await route.abort("failed"); });
  await pin(page).click();
  await expect(page.getByRole("region", { name: "Personal progression", exact: true }).getByRole("alert")).toContainText("Equipment change could not be confirmed");
  await expect(pin(page)).toBeDisabled();
  await page.getByRole("button", { name: "Refresh saved rewards", exact: true }).click();
  await expect(pin(page)).toContainText("EQUIPPED"); expect(puts).toBe(1);
  const after = await progression(request, owner); expect(after.xp).toBe(before.xp);
  expect(wordsmith(after).unlock!.receipt).toEqual(wordsmith(before).unlock!.receipt);
});

test("Older API details stay unknown and preserved legacy grants are labelled honestly", async ({ page, request }) => {
  const owner = await account(request); const base = await progression(request, owner);
  // Presentation-only compatibility fixture. Actual cutover preservation is
  // verified against memory/PostgreSQL by the migration tests.
  let legacy = false;
  await page.route("**/v1/player/progression", route => {
    const state: ProgressionState = JSON.parse(JSON.stringify(base));
    for (const item of [wordsState(state), wordsmith(state), pinState(state)]) {
      item.unlocked = true;
      if (!legacy) delete item.unlock;
      else item.unlock = { ...item.unlock!, receipt: { unlockId: "id" in item && item.id === "words" ? "word-network" : "wordsmith", method: METHOD, source: "legacy-personal", recordedAt: "2026-10-24T00:00:00Z" } };
    }
    return route.fulfill({ json: state });
  });
  await signIn(page, owner);
  await expect(wordWorld(page)).toContainText("Unlock details unavailable");
  await expect(wordWorld(page)).not.toContainText("Checked vocabulary practice");
  await expect(page.getByRole("article", { name: "Wordsmith achievement", exact: true })).toContainText("Unlock details unavailable");
  await expect(pin(page)).toContainText("Unlock details unavailable");
  await expect(pin(page)).not.toContainText("Checked vocabulary practice");
  legacy = true; await page.reload();
  await expect(wordWorld(page)).toContainText("Previously unlocked · kept");
  await expect(page.getByRole("article", { name: "Wordsmith achievement", exact: true })).toContainText("Previously unlocked · kept");
  await expect(pin(page)).toContainText("Previously unlocked · kept");
  await expect(wordWorld(page)).not.toContainText(/74%|mastery|explored/);
});
