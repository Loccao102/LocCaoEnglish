import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import words from "../../backend/internal/learning/catalog.json";
import type { LearningAttempt, LearningAttemptResult } from "../../lib/learning-attempt";

const API = process.env.E2E_API_URL || "http://localhost:8080";
type Account = { token: string; user: { id: string; displayName: string }; headers: Record<string, string> };
type Practice = { method: string; sampleCount: number; correctCount: number; windowSize: number; lastCompletedAt: string | null; evidenceKind: string };
type Skill = { name: string; confidence: number; practice?: Practice };
type Dashboard = { user: { id: string; displayName: string; xp: number }; skills: Skill[] };
const journal = (page: Page) => page.getByRole("region", { name: "Skill practice journal" });
const skillCard = (page: Page, skill: string) => journal(page).getByRole("article", { name: `${skill} practice`, exact: true });
const suggestions = (page: Page) => page.getByRole("region", { name: "Practice suggestions" });
const snapshot = (page: Page) => page.getByRole("region", { name: "Player practice snapshot" });

// The auth limit is shared by all E2E files on the source IP. Isolate this account
// burst without changing real server limits or retrying a failed application step.
async function separateRateWindow() {
  test.setTimeout(90_000);
  await delay(60_100);
}
test.beforeAll(separateRateWindow);
test.afterAll(separateRateWindow);

async function account(request: APIRequestContext): Promise<Account> {
  const response = await request.post(`${API}/v1/auth/register`, {
    data: { email: `skill-practice-${randomUUID()}@example.test`, password: "SunlitTest123!", displayName: `Practice ${randomUUID().slice(0, 8)}` },
  });
  expect(response.ok()).toBe(true);
  const result = await response.json();
  return { ...result, headers: { Authorization: `Bearer ${result.token}` } };
}

async function signIn(page: Page, user: Account) {
  await page.goto("/account");
  await changeAccount(page, user.token);
}

async function changeAccount(page: Page, token: string) {
  await page.evaluate(value => {
    localStorage.setItem("loccao_token", value);
    window.dispatchEvent(new Event("loccao-auth-change"));
  }, token);
}

async function dashboard(request: APIRequestContext, user: Account): Promise<Dashboard> {
  const response = await request.get(`${API}/v1/dashboard`, { headers: user.headers });
  expect(response.ok()).toBe(true);
  return response.json();
}

async function openWord(request: APIRequestContext, user: Account, itemKey?: string): Promise<LearningAttempt> {
  const response = await request.post(`${API}/v1/learning/attempts`, {
    headers: user.headers,
    data: {
      requestId: randomUUID(), activity: "word-link", pack: "cefr-core", cefrLevel: "A1",
      excludeItemKeys: itemKey ? words.items.filter(item => item.pack === "cefr-core" && item.cefrLevel === "A1" && item.id !== itemKey).map(item => item.id) : [],
    },
  });
  expect(response.ok()).toBe(true);
  const attempt: LearningAttempt = await response.json();
  if (itemKey) expect(attempt.itemKey).toBe(itemKey);
  return attempt;
}

async function answerWord(request: APIRequestContext, user: Account, attempt: LearningAttempt, correct = true): Promise<LearningAttemptResult> {
  const reference = words.items.find(item => item.id === attempt.itemKey)!.correctAnswer;
  const answer = correct ? reference : attempt.prompt.options.find(option => option !== reference)!;
  const response = await request.post(`${API}/v1/learning/attempts/${attempt.attemptId}/submit`, {
    headers: user.headers, data: { answer, contentVersion: attempt.contentVersion, rulesVersion: attempt.rulesVersion },
  });
  expect(response.ok()).toBe(true);
  return response.json();
}

test("A new account has no checked samples despite its legacy confidence values", async ({ page, request }) => {
  const user = await account(request), data = await dashboard(request, user);
  expect(data.skills.some(skill => skill.confidence > 0)).toBe(true);
  for (const skill of data.skills) {
    expect(skill.practice).toMatchObject({ method: "skill-practice.v1", sampleCount: 0, correctCount: 0, windowSize: 20, lastCompletedAt: null });
  }
  const skillResponse = await request.get(`${API}/v1/skills`, { headers: user.headers });
  expect(skillResponse.ok()).toBe(true);
  expect((await skillResponse.json()).skills).toEqual(data.skills);

  await signIn(page, user);
  await page.goto("/camp");
  await expect(skillCard(page, "Vocabulary")).toContainText("No checked practice yet");
  await expect(skillCard(page, "Speaking")).toContainText("does not assess pronunciation");
  await expect(skillCard(page, "Writing")).toContainText("Writing has its own feedback history");
  await expect(journal(page)).not.toContainText(/\d+%|Mastered|Travel skill map/);
  await expect(snapshot(page)).not.toContainText(/\d+%/);
  const plan = await (await request.get(`${API}/v1/player/questline`, { headers: user.headers })).json();
  expect(plan.potentialXp).toBe(0);
  expect(plan.items.every((item: { xp: number }) => item.xp === 0)).toBe(true);
  await expect(suggestions(page).locator(".plan-step").first()).toHaveAttribute("href", plan.items[0].route);
  await expect(suggestions(page)).not.toContainText(/up to \d+ XP|\+\d+ XP|weakest areas/);
  for (const height of [551, 844]) {
    await page.setViewportSize({ width: 390, height });
    await journal(page).getByRole("heading", { name: "Your recent practice" }).scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(Number.parseFloat(await skillCard(page, "Vocabulary").locator(".practice-skill-count").evaluate(el => getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
    await page.screenshot({ path: `.cache/skill-practice-journal-${height}.png` });
    await suggestions(page).getByRole("heading").scrollIntoViewIfNeeded();
    await expect(suggestions(page).locator(".plan-step").first()).toBeVisible();
    await page.screenshot({ path: `.cache/skill-practice-suggestions-${height}.png` });
  }
});

test("A real wrong answer and capped correct replay replace one practice sample after reload", async ({ page, request }) => {
  const user = await account(request);
  await signIn(page, user);
  const opened = page.waitForResponse(response => response.url().endsWith("/v1/learning/attempts") && response.request().method() === "POST");
  await page.goto("/games/word-link");
  const attempt: LearningAttempt = await (await opened).json();
  const reference = words.items.find(item => item.id === attempt.itemKey)!.correctAnswer;
  const wrong = attempt.prompt.options.find(option => option !== reference)!;
  await page.locator(".word-option").filter({ hasText: wrong }).click();
  await expect(page.getByText(`Not quite — ${reference}`, { exact: true })).toBeVisible();
  const beforeReplay = await dashboard(request, user);
  expect(beforeReplay.skills.find(skill => skill.name === "Vocabulary")!.practice).toMatchObject({ sampleCount: 1, correctCount: 0 });
  await page.goto("/camp");
  await expect(skillCard(page, "Vocabulary")).toContainText("0 correct · 1 checked");
  await expect(suggestions(page).locator('.plan-step[href="/games/word-link"]')).toContainText("0 of your 1 recent different items were correct");

  const replay = await openWord(request, user, attempt.itemKey);
  const result = await answerWord(request, user, replay);
  expect(result).toMatchObject({ correct: true, progressionApplied: false, xpDelta: 0 });
  const latest = await dashboard(request, user);
  expect(latest.skills.find(skill => skill.name === "Vocabulary")!.practice).toMatchObject({ sampleCount: 1, correctCount: 1 });
  expect(latest.user.xp).toBe(0);
  expect(latest.skills.map(({ name, confidence }) => ({ name, confidence }))).toEqual(beforeReplay.skills.map(({ name, confidence }) => ({ name, confidence })));
  expect(await answerWord(request, user, replay)).toEqual(result);
  expect((await dashboard(request, user)).skills).toEqual(latest.skills);
  await page.reload();
  await expect(skillCard(page, "Vocabulary")).toContainText("1 correct · 1 checked");
  await expect(journal(page)).not.toContainText(/\d+%|Mastered/);
});

test("Guests see sign-in boundaries instead of shared demo skill mastery", async ({ page }) => {
  const personalReads: string[] = [];
  page.on("request", request => {
    if (["/v1/dashboard", "/v1/skills", "/v1/player/questline"].some(path => request.url().endsWith(path))) personalReads.push(request.url());
  });
  await page.goto("/camp");
  await expect(journal(page).getByRole("link", { name: "Sign in for your practice journal" })).toBeVisible();
  await expect(suggestions(page).getByRole("link", { name: "Sign in for practice suggestions" })).toBeVisible();
  await expect(journal(page).getByRole("article")).toHaveCount(0);
  await expect(journal(page)).not.toContainText(/\d+%|Mastered|Travel skill map/);
  expect(personalReads).toEqual([]);
});

test("Older dashboard and plan responses do not invent personal results or confidence suggestions", async ({ page, request }) => {
  const user = await account(request);
  await signIn(page, user);
  await page.route("**/v1/dashboard", async route => {
    const response = await route.fetch();
    expect(response.ok()).toBe(true);
    const data: Dashboard = await response.json();
    for (const skill of data.skills) delete skill.practice;
    await route.fulfill({ response, json: data });
  });
  await page.route("**/v1/player/questline", async route => {
    const response = await route.fetch();
    expect(response.ok()).toBe(true);
    const data = await response.json();
    delete data.method;
    data.focus = "Your weakest areas";
    data.potentialXp = 999;
    await route.fulfill({ response, json: data });
  });
  await page.goto("/camp");
  await expect(skillCard(page, "Vocabulary")).toContainText("Practice summary unavailable");
  await expect(journal(page)).not.toContainText(/\d+%|\d+ correct · \d+ checked|Mastered/);
  await expect(snapshot(page)).not.toContainText(/\d+%/);
  await expect(suggestions(page).getByRole("button", { name: "Retry loading suggestions" })).toBeVisible();
  await expect(suggestions(page).locator(".plan-step")).toHaveCount(0);
  await expect(suggestions(page)).not.toContainText(/Your weakest areas|999|up to \d+ XP/);
});

test("Unavailable practice and suggestions expose retry without inventing offline results", async ({ page, request }) => {
  const user = await account(request);
  await signIn(page, user);
  await page.route("**/v1/dashboard", route => route.fulfill({ status: 503, json: { error: "Practice temporarily unavailable" } }), { times: 1 });
  await page.route("**/v1/player/questline", route => route.fulfill({ status: 503, json: { error: "Suggestions temporarily unavailable" } }), { times: 1 });
  await page.goto("/camp");
  const retryPractice = journal(page).getByRole("button", { name: "Retry loading practice" });
  await expect(retryPractice).toBeVisible();
  await expect(journal(page).getByRole("article")).toHaveCount(0);
  await expect(journal(page)).not.toContainText(/\d+ correct · \d+ checked|\d+%/);
  await expect(snapshot(page).getByRole("button", { name: "Retry loading progress" })).toBeVisible();
  const retry = suggestions(page).getByRole("button", { name: "Retry loading suggestions" });
  await expect(retry).toBeVisible();
  await expect(suggestions(page).locator(".plan-step")).toHaveCount(0);
  await expect(suggestions(page)).not.toContainText(/Speaking recovery|weakest areas|up to \d+ XP/);
  await retryPractice.click();
  await expect(skillCard(page, "Vocabulary")).toContainText("No checked practice yet");
  await expect(snapshot(page)).toContainText(user.user.displayName);
  await expect(retryPractice).toHaveCount(0);
  const loaded = page.waitForResponse(response => response.url().endsWith("/v1/player/questline") && response.ok());
  await retry.click();
  const plan = await (await loaded).json();
  await expect(suggestions(page).locator(".plan-step")).toHaveCount(plan.items.length);
  await expect(suggestions(page).locator(".plan-step").first()).toHaveAttribute("href", plan.items[0].route);
  await expect(retry).toHaveCount(0);
});

test("Late practice and suggestion responses cannot replace the newly signed-in account", async ({ page, request }) => {
  const first = await account(request), other = await account(request);
  await answerWord(request, first, await openWord(request, first), false);
  const firstPlan = await (await request.get(`${API}/v1/player/questline`, { headers: first.headers })).json();
  await signIn(page, first);
  const paths = ["/v1/dashboard", "/v1/player/questline"];
  let release!: () => void;
  const hold = new Promise<void>(resolve => { release = resolve; });
  const captured = new Map<string, Promise<void>>();
  const completed = new Map<string, Promise<void>>();
  for (const path of paths) {
    let markCaptured!: () => void, markCompleted!: () => void;
    captured.set(path, new Promise<void>(resolve => { markCaptured = resolve; }));
    completed.set(path, new Promise<void>(resolve => { markCompleted = resolve; }));
    await page.route(`**${path}`, async route => {
      if (route.request().headers().authorization !== first.headers.Authorization) return route.continue();
      const response = await route.fetch();
      expect(response.ok()).toBe(true);
      markCaptured();
      await hold;
      await route.fulfill({ response });
      markCompleted();
    });
  }
  try {
    await page.goto("/camp", { waitUntil: "domcontentloaded" });
    await Promise.all(captured.values());
    await changeAccount(page, other.token);
    await expect(page.locator(".snapshot-person")).toContainText(other.user.displayName);
    await expect(skillCard(page, "Vocabulary")).toContainText("No checked practice yet");
    const otherPlan = await (await request.get(`${API}/v1/player/questline`, { headers: other.headers })).json();
    expect(firstPlan.items[0].route).not.toBe(otherPlan.items[0].route);
    expect(firstPlan.focus).not.toBe(otherPlan.focus);
    await expect(suggestions(page).getByRole("heading", { name: otherPlan.focus, exact: true })).toBeVisible();
    await expect(suggestions(page).locator(".plan-step").first()).toHaveAttribute("href", otherPlan.items[0].route);
    release();
    await Promise.all(completed.values());
    // Give the fulfilled old requests a browser paint before inspecting the
    // account boundary. This observes late response handling, without a delay.
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    await expect(page.locator(".snapshot-person")).toContainText(other.user.displayName);
    await expect(skillCard(page, "Vocabulary")).toContainText("No checked practice yet");
    await expect(suggestions(page).locator(".plan-step").first()).toHaveAttribute("href", otherPlan.items[0].route);
    await expect(suggestions(page).getByRole("heading", { name: otherPlan.focus, exact: true })).toBeVisible();
    await expect(journal(page)).not.toContainText("0 correct · 1 checked");
  } finally {
    release();
  }
});
