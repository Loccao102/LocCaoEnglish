import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { expect, test, type Page } from "@playwright/test";
import type { ReviewItem } from "../../lib/api";
import type { ReviewGradeReceipt } from "../../lib/review-schedule";
import type { LearningAttempt } from "../../lib/learning-attempt";
import words from "../../backend/internal/learning/catalog.json";

const API = process.env.E2E_API_URL || "http://localhost:8080";
const first = "review-render-A", second = "review-render-B", rules = "review-schedule.v1";
const panel = (page: Page) => page.getByRole("region", { name: "Personal review queue", exact: true });
const key = (owner: string) => `loccao.review-grade.v1.${owner}`;
const item = (owner = first): ReviewItem => ({ itemKey: `${owner}:happy`, kind: "word-link", prompt: `${owner} recall clue`, answer: "glad", dueAt: "2020-01-01T00:00:00Z", intervalDays: 1, ease: 2.5, failures: 1 });
const receipt = (input: { requestId: string; itemKey: string; quality: number; expectedDueAt: string; rulesVersion: string }): ReviewGradeReceipt => ({ ...input, rulesVersion: rules, scheduledAt: "2026-11-05T00:00:00Z", dueAt: "2026-11-08T00:00:00Z", intervalDays: 3, ease: 2.5, failures: 1 });

test.beforeAll(async () => { test.setTimeout(90_000); await delay(60_100); });
test.afterAll(async () => { test.setTimeout(90_000); await delay(60_100); });

async function identity(page: Page, token: string) {
  await page.evaluate(value => { localStorage.setItem("loccao_token", value); window.dispatchEvent(new Event("loccao-auth-change")); }, token);
}
async function open(page: Page, token: string) {
  await page.addInitScript(({ token, id }) => {
    if (!sessionStorage.getItem(id)) { localStorage.setItem("loccao_token", token); sessionStorage.setItem(id, "ready"); }
  }, { token, id: `review-init-${randomUUID()}` });
  await page.goto("/review");
}
async function fixtures(page: Page) {
  const writes: { token: string; body: { requestId: string; itemKey: string; quality: number; expectedDueAt: string; rulesVersion: string } }[] = [];
  const reads: string[] = [], saved = new Map<string, ReviewGradeReceipt>();
  const queues = new Map<string, ReviewItem[]>([[first, [item()]], [second, [item(second)]]]);
  await page.route("**/v1/**", async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname;
    const token = (request.headers().authorization || "").replace(/^Bearer /, "");
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204 });
    if (path === "/v1/me") return route.fulfill({ json: { user: { id: token, email: "review-render@example.test", displayName: "Review fixture", xp: 0, streak: 0 }, role: "learner" } });
    if (path === "/v1/review") { reads.push(token); return route.fulfill({ json: { items: queues.get(token) || [], rulesVersion: rules, dueOnly: url.searchParams.get("dueOnly") === "true" } }); }
    if (path.startsWith("/v1/review/grades/")) {
      const value = saved.get(`${token}:${decodeURIComponent(path.split("/").pop()!)}`);
      return route.fulfill(value ? { json: value } : { status: 404, json: { error: "Receipt not found" } });
    }
    if (request.method() === "POST" && path.endsWith("/grades")) {
      const body = { ...request.postDataJSON(), itemKey: decodeURIComponent(path.slice("/v1/review/".length, -"/grades".length)) }; writes.push({ token, body });
      const result = saved.get(`${token}:${body.requestId}`) || receipt(body);
      saved.set(`${token}:${body.requestId}`, result);
      queues.set(token, (queues.get(token) || []).filter(row => row.itemKey !== body.itemKey));
      return route.fulfill({ json: result });
    }
    return route.fulfill({ status: 404, json: { error: "Unrelated render fixture" } });
  });
  return { writes, reads, saved, queues };
}
async function choose(page: Page, rating = "Good") {
  await page.getByRole("button", { name: "Reveal answer", exact: true }).click();
  await page.getByRole("button", { name: rating, exact: true }).click();
}

test("review guests do not read or grade the shared demo queue", async ({ page }) => {
  const seen = await fixtures(page); await open(page, "");
  await expect(page.getByRole("link", { name: "Sign in for reviews" })).toBeVisible();
  expect(seen.reads).toEqual([]); expect(seen.writes).toEqual([]);
  await expect(page.getByText("Review queue clear")).toHaveCount(0);
});

test("a failed scheduling response keeps the item and exact rating through reload", async ({ page }) => {
  const seen = await fixtures(page); await open(page, first);
  let lost: unknown;
  await page.route("**/v1/review/*/grades", async route => { lost = route.request().postDataJSON(); await route.abort("failed"); }, { times: 1 });
  await choose(page);
  await expect(panel(page)).toContainText("Review response awaiting confirmation");
  await expect(panel(page)).toContainText(item().prompt);
  await expect(page.getByRole("button", { name: "Easy", exact: true })).toBeDisabled();
  await expect(panel(page)).not.toContainText("Review schedule saved");
  await page.reload();
  await expect(page.getByRole("button", { name: "Retry same review response" })).toBeEnabled();
  const retry = page.waitForRequest(request => request.method() === "POST" && request.url().endsWith("/grades"));
  await page.getByRole("button", { name: "Retry same review response" }).click();
  expect((await retry).postDataJSON()).toEqual(lost);
  await expect(panel(page)).toContainText("Review schedule saved");
  await expect(panel(page).getByRole("heading", { name: "No reviews due" })).toBeVisible();
  expect(seen.writes).toHaveLength(1);
  expect(await page.evaluate(storageKey => localStorage.getItem(storageKey), key(first))).toBeNull();
});

test("account changes keep pending review identity separate and ignore a late grade response", async ({ page }) => {
  const seen = await fixtures(page); await open(page, first);
  let release!: () => void, captured!: () => void, finished!: () => void;
  const gate = new Promise<void>(done => { release = done; }), started = new Promise<void>(done => { captured = done; }), ended = new Promise<void>(done => { finished = done; });
  await page.route("**/v1/review/*/grades", async route => {
    if (route.request().headers().authorization !== `Bearer ${first}`) return route.fallback();
    const body = { ...route.request().postDataJSON(), itemKey: item().itemKey }; captured(); await gate;
    await route.fulfill({ json: receipt(body) }); finished();
  });
  try {
    await choose(page); await started;
    await identity(page, second);
    await expect(panel(page)).toContainText(item(second).prompt);
    await expect(panel(page)).not.toContainText(item().prompt);
    release(); await ended;
    await expect(panel(page)).not.toContainText("Review schedule saved");
    await expect(panel(page)).toContainText(item(second).prompt);
    expect(seen.writes).toEqual([]);
    expect(await page.evaluate(storageKey => JSON.parse(localStorage.getItem(storageKey)!).owner, key(first))).toBe(first);
    expect(await page.evaluate(storageKey => localStorage.getItem(storageKey), key(second))).toBeNull();
    await identity(page, "");
    await expect(page.getByRole("link", { name: "Sign in for reviews" })).toBeVisible();
    await expect(page.getByText(item(second).prompt, { exact: true })).toHaveCount(0);
  } finally { release(); }
});

test("corrupt references are kept and blocked storage still permits an exact in-tab retry", async ({ page }) => {
  const seen = await fixtures(page);
  await page.addInitScript(storageKey => localStorage.setItem(storageKey, "{unreadable-reference"), key(first));
  await open(page, first);
  await expect(page.getByRole("button", { name: "Leave unreadable review reference" })).toBeVisible();
  expect(await page.evaluate(storageKey => localStorage.getItem(storageKey), key(first))).toBe("{unreadable-reference");
  expect(seen.writes).toEqual([]);
  await page.getByRole("button", { name: "Leave unreadable review reference" }).click();
  await expect(page.getByRole("button", { name: "Reveal answer" })).toBeVisible();
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (name, value) { if (name.startsWith("loccao.review-grade.")) throw new Error("Blocked test storage"); return original.call(this, name, value); };
  });
  await page.route("**/v1/review/*/grades", route => route.abort("failed"), { times: 1 });
  await choose(page, "Hard");
  await expect(panel(page)).toContainText("kept in this tab");
  await page.getByRole("button", { name: "Retry same review response" }).click();
  await expect(panel(page)).toContainText("Review schedule saved");
  expect(seen.writes).toHaveLength(1); expect(seen.writes[0].body.quality).toBe(3);
});

test("older APIs and unavailable queues do not invent a clear queue; phone controls remain readable", async ({ page }) => {
  await fixtures(page);
  let mode: "old" | "offline" | "ready" = "old";
  await page.route("**/v1/review?**", route => mode === "offline" ? route.abort("failed") : route.fulfill({ json: mode === "old" ? { items: [] } : { items: [item()], rulesVersion: rules, dueOnly: true } }));
  await open(page, first);
  await expect(panel(page)).toContainText("could not be confirmed");
  await expect(panel(page).getByRole("heading", { name: "No reviews due" })).toHaveCount(0);
  mode = "offline"; await page.getByRole("button", { name: "Refresh saved review queue" }).click();
  await expect(panel(page)).toContainText("could not be confirmed");
  mode = "ready"; await page.getByRole("button", { name: "Refresh saved review queue" }).click();
  await expect(page.getByRole("button", { name: "Reveal answer" })).toBeVisible();
  await page.getByRole("button", { name: "Reveal answer" }).click();
  for (const height of [551, 844]) {
    await page.setViewportSize({ width: 390, height });
    const good = page.getByRole("button", { name: "Good", exact: true });
    await good.scrollIntoViewIfNeeded();
    expect((await good.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `.cache/review-ready-${height}.png`, fullPage: true });
  }
});

test("a stale review snapshot requires an explicit choice before another rating", async ({ page }) => {
  const seen = await fixtures(page); await open(page, first);
  let original: { requestId: string; expectedDueAt: string } | null = null;
  await page.route("**/v1/review/*/grades", async route => {
    original = route.request().postDataJSON();
    seen.queues.set(first, [{ ...item(), dueAt: "2021-01-01T00:00:00Z" }]);
    await route.fulfill({ status: 409, json: { error: "Review snapshot changed" } });
  }, { times: 1 });
  await choose(page);
  await expect(panel(page)).not.toContainText("Review schedule saved");
  await page.getByRole("button", { name: "Refresh saved review queue" }).click();
  await expect(page.getByRole("button", { name: "Leave outdated review reference" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Retry same review response" })).toBeDisabled();
  await page.getByRole("button", { name: "Leave outdated review reference" }).click();
  await expect(page.getByRole("button", { name: "Reveal answer" })).toBeVisible();
  await choose(page);
  await expect(panel(page)).toContainText("Review schedule saved");
  expect(seen.writes).toHaveLength(1);
  expect(seen.writes[0].body.requestId).not.toBe(original!.requestId);
  expect(seen.writes[0].body.expectedDueAt).toBe("2021-01-01T00:00:00Z");
});

test("real saved schedules recover a lost committed response and exact retry is immutable", async ({ page, request }) => {
  test.setTimeout(90_000);
  async function register() {
    const response = await request.post(`${API}/v1/auth/register`, { data: { email: `review-${randomUUID()}@example.test`, password: "SunlitTest123!", displayName: "Review learner" } });
    expect(response.ok(), await response.text()).toBe(true);
    const data = await response.json(); return { ...data, headers: { Authorization: `Bearer ${data.token}` } };
  }
  const user = await register(), other = await register();
  const started = await request.post(`${API}/v1/learning/attempts`, { headers: user.headers, data: { activity: "word-link", requestId: randomUUID(), cefrLevel: "A1", pack: "cefr-core" } });
  expect(started.ok(), await started.text()).toBe(true);
  const attempt: LearningAttempt = await started.json(), correct = words.items.find(row => row.id === attempt.itemKey)!.correctAnswer;
  const answer = attempt.prompt.options.find(value => value !== correct)!;
  const graded = await request.post(`${API}/v1/learning/attempts/${attempt.attemptId}/submit`, { headers: user.headers, data: { answer, contentVersion: attempt.contentVersion, rulesVersion: attempt.rulesVersion } });
  expect(graded.ok(), await graded.text()).toBe(true); expect((await graded.json()).correct).toBe(false);
  await open(page, user.token);
  let submitted!: { requestId: string; quality: number; expectedDueAt: string; rulesVersion: string }, saved!: ReviewGradeReceipt;
  let writes = 0;
  page.on("request", req => { if (req.method() === "POST" && req.url().endsWith("/grades")) writes++; });
  await page.route("**/v1/review/*/grades", async route => {
    submitted = route.request().postDataJSON();
    const response = await route.fetch(); expect(response.ok(), await response.text()).toBe(true);
    saved = await response.json(); await route.abort("failed");
  }, { times: 1 });
  await choose(page);
  await expect(page.getByRole("button", { name: "Retry same review response" })).toBeVisible();
  await expect(panel(page)).not.toContainText("Review schedule saved");
  for (const height of [551, 844]) {
    await page.setViewportSize({ width: 390, height });
    await page.screenshot({ path: `.cache/review-pending-${height}.png`, fullPage: true });
  }
  await page.reload();
  await expect(panel(page)).toContainText("Review schedule saved");
  await expect(panel(page).getByRole("heading", { name: "No reviews due" })).toBeVisible();
  expect(writes).toBe(1);
  const path = `${API}/v1/review/${encodeURIComponent(attempt.itemKey)}/grades`;
  const retry = await request.post(path, { headers: user.headers, data: submitted });
  expect(retry.ok(), await retry.text()).toBe(true); expect(await retry.json()).toEqual(saved);
  expect((await request.post(path, { headers: user.headers, data: { ...submitted, quality: 1 } })).status()).toBe(409);
  expect((await request.get(`${API}/v1/review/grades/${submitted.requestId}`, { headers: other.headers })).status()).toBe(404);
  expect((await request.post(`${API}/v1/review/${encodeURIComponent(attempt.itemKey)}`, { headers: user.headers, data: { quality: 4 } })).status()).toBe(409);
  expect((await (await request.get(`${API}/v1/me`, { headers: user.headers })).json()).user.xp).toBe(0);
});
