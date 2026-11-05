import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { expect, test, type Page } from "@playwright/test";
import type { BossState, Dashboard, ProgressionState } from "../../lib/api";

test.setTimeout(60_000);

const API = process.env.E2E_API_URL || "http://localhost:8080";
const first = "campaign-render-fixture-A", second = "campaign-render-fixture-B";
const districts = [
  { id: "travel", path: "/travel", tags: ["AIRPORT", "HOTEL", "CITY TRANSIT"], ids: ["airport-crisis", "hotel-reservation", "city-transit"] },
  { id: "conversation", path: "/conversation", tags: ["CAFE", "MAKE PLANS", "CLARITY"], ids: ["cafe-connection", "weekend-plans", "repair-misunderstanding"] },
  { id: "work", path: "/work", tags: ["STAND-UP", "REQUIREMENTS", "DELIVERY"], ids: ["daily-standup", "requirement-clarity", "deadline-negotiation"] },
] as const;
const personal = (page: Page) => page.getByRole("region", { name: "Personal campaign progress", exact: true });
const learning = (page: Page) => page.getByRole("region", { name: "Personal learning summary", exact: true });
const refresh = (page: Page) => page.getByRole("button", { name: "Refresh campaign progress", exact: true });
const retry = (page: Page) => page.getByRole("button", { name: "Retry loading campaign", exact: true });

// These nine chapter states deliberately exercise rendering; they are never
// submitted to the API and do not claim backend gates or rewards were earned.
function progression(clears: number): ProgressionState {
  return { level: 1, xp: 0, xpIntoLevel: 0, xpForNext: 100, worlds: [], achievements: [], inventory: [],
    bosses: districts.flatMap(district => district.ids.map((id, index): BossState => ({
      id, title: `Saved chapter ${index + 1}`, worldId: district.id, route: `/missions/${id}`,
      cleared: index < clears, unlocked: index <= clears, rewardXp: 0,
      checkpoints: ["Vocabulary", "Listening", "Speaking"].map((skill, checkpoint) => ({
        id: `${id}-${checkpoint}`, title: `${skill} preparation`, skill, route: "/camp", complete: index < clears,
      })),
    }))) };
}
function dashboard(token: string, xp = token === first ? 731 : 42, due = token === first ? 17 : 2): Dashboard {
  return { user: { id: token, email: "render-fixture@example.test", displayName: token, xp, streak: 0 }, skills: [], dueReviews: due, ieltsBand: null, targetBand: null };
}
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}
async function identity(page: Page, token: string) {
  await page.evaluate(value => {
    if (value) localStorage.setItem("loccao_token", value); else localStorage.removeItem("loccao_token");
    window.dispatchEvent(new Event("loccao-auth-change"));
  }, token);
}
async function open(page: Page, token: string, path: string) {
  await page.addInitScript(({ token, key }) => {
    if (sessionStorage.getItem(key)) return;
    if (token) localStorage.setItem("loccao_token", token); else localStorage.removeItem("loccao_token");
    sessionStorage.setItem(key, "ready");
  }, { token, key: `campaign-owner-${randomUUID()}` });
  await page.goto(path);
}
async function paint(page: Page) {
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
}
async function renderFixtures(page: Page, demo = true) {
  const reads: { path: string; token: string }[] = [], writes: string[] = [];
  await page.route("**/v1/**", async route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    const token = (request.headers().authorization || "").replace(/^Bearer /, "");
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204 });
    if (request.method() !== "GET") { writes.push(path); return route.fulfill({ status: 405, json: { error: "Read-only render fixture" } }); }
    reads.push({ path, token });
    if (!token && !demo && ["/v1/player/progression", "/v1/dashboard"].includes(path)) return route.fulfill({ status: 401, json: { error: "Demo disabled" } });
    const data = path === "/v1/player/progression" ? progression(token === first || !token ? 1 : 0)
      : path === "/v1/dashboard" ? dashboard(token)
      : path === "/v1/me" ? { user: dashboard(token).user, role: "learner" }
      : path === "/v1/fair" ? { playerId: token, displayName: token, storageMode: "account", save: { version: 1, games: {} } }
      : path === "/v1/adventure" ? { playerId: token, displayName: token, storageMode: "account", save: { version: 1, completed: {}, xp: 0, coins: 23, owned: ["mam"], character: "mam" } }
      : null;
    return route.fulfill({ status: data ? 200 : 404, json: data || { error: "Unrelated fixture route" } });
  });
  return { reads, writes };
}
async function noPersonalActions(page: Page) {
  await expect(page.locator(".world-path").getByRole("link", { name: /Replay|Enter/ })).toHaveCount(0);
  await expect(page.locator(".boss-checkpoints .complete")).toHaveCount(0);
  await expect(page.getByText(/\d+\/\d+ chapters cleared/)).toHaveCount(0);
}

for (const district of districts) {
  test(`${district.id} campaign suppresses the previous owner and rejects late success and error responses`, async ({ page }) => {
    const fixtures = await renderFixtures(page);
    await open(page, first, district.path);
    await expect(page.getByText("1/3 chapters cleared", { exact: true })).toBeVisible();
    await expect(page.locator(".world-path").getByRole("link", { name: /Replay/ })).toHaveCount(1);
    let heldToken = second, fail = false;
    let captured = deferred(), release = deferred(), finished = deferred();
    await page.route("**/v1/player/progression", async route => {
      if (route.request().headers().authorization !== `Bearer ${heldToken}`) return route.fallback();
      const gate = { captured, release, finished }, error = fail;
      gate.captured.resolve(); await gate.release.promise;
      await route.fulfill(error ? { status: 503, json: { error: "Late old campaign response" } } : { json: progression(2) });
      gate.finished.resolve();
    });
    try {
      await identity(page, second);
      await noPersonalActions(page);
      await captured.promise;
      await expect(personal(page)).toContainText("Loading your saved campaign progress");
      release.resolve(); await finished.promise;
      await expect(page.getByText("2/3 chapters cleared", { exact: true })).toBeVisible();
      heldToken = first; captured = deferred(); release = deferred(); finished = deferred();
      await identity(page, first); await captured.promise;
      await identity(page, second);
      await expect(page.getByText("0/3 chapters cleared", { exact: true })).toBeVisible();
      release.resolve(); await finished.promise; await paint(page);
      await expect(page.getByText("0/3 chapters cleared", { exact: true })).toBeVisible();
      await expect(page.locator(".world-path").getByRole("link", { name: /Replay/ })).toHaveCount(0);
      captured = deferred(); release = deferred(); finished = deferred(); fail = true;
      await identity(page, first); await captured.promise;
      await identity(page, "");
      await expect(page.getByRole("link", { name: "Sign in for campaign progress", exact: true })).toBeVisible();
      await noPersonalActions(page);
      release.resolve(); await finished.promise; await paint(page);
      await expect(page.getByRole("link", { name: "Sign in for campaign progress", exact: true })).toBeVisible();
      await expect(personal(page)).not.toContainText(/unavailable|Late old/);
      expect(fixtures.writes).toEqual([]);
    } finally { release.resolve(); }
  });

  test(`${district.id} campaign retries network and expired reads and only displays the newest refresh`, async ({ page }, testInfo) => {
    await renderFixtures(page);
    let mode: "offline" | "expired" | "ready" | "reverse" = "offline", refreshes = 0;
    const captured = deferred(), release = deferred(), finished = deferred();
    const tokens: string[] = [];
    await page.route("**/v1/player/progression", async route => {
      tokens.push(route.request().headers().authorization);
      if (mode === "offline") return route.abort("failed");
      if (mode === "expired") return route.fulfill({ status: 401, json: { error: "Session expired" } });
      if (mode === "reverse" && ++refreshes === 1) {
        captured.resolve(); await release.promise;
        await route.fulfill({ json: progression(2) }); finished.resolve(); return;
      }
      return route.fulfill({ json: progression(mode === "ready" ? 1 : 0) });
    });
    try {
      await open(page, first, district.path);
      await expect(retry(page)).toBeVisible(); await noPersonalActions(page);
      for (const height of [551, 844]) {
        await page.setViewportSize({ width: 390, height });
        await personal(page).scrollIntoViewIfNeeded();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await page.screenshot({ path: testInfo.outputPath(`${district.id}-unavailable-${height}.png`) });
      }
      mode = "expired"; await retry(page).click();
      await expect(personal(page).getByRole("link", { name: "Sign in again", exact: true })).toBeVisible();
      await noPersonalActions(page);
      mode = "ready"; await identity(page, second);
      await expect(page.getByText("1/3 chapters cleared", { exact: true })).toBeVisible();
      mode = "reverse"; await refresh(page).click(); await captured.promise;
      await noPersonalActions(page);
      await refresh(page).click();
      await expect(page.getByText("0/3 chapters cleared", { exact: true })).toBeVisible();
      release.resolve(); await finished.promise; await paint(page);
      await expect(page.getByText("0/3 chapters cleared", { exact: true })).toBeVisible();
      expect(tokens).toEqual([`Bearer ${first}`, `Bearer ${first}`, `Bearer ${second}`, `Bearer ${second}`, `Bearer ${second}`]);
    } finally { release.resolve(); }
  });
}

for (const demo of [true, false]) test(`Guests browse district introductions without personal reads with demo ${demo ? "enabled" : "disabled"}`, async ({ page }) => {
  const fixtures = await renderFixtures(page, demo);
  for (const district of districts) {
    await open(page, "", district.path);
    await expect(page.getByRole("link", { name: "Sign in for campaign progress", exact: true })).toBeVisible();
    for (const tag of district.tags) await expect(page.locator(".world-path")).toContainText(tag);
    await noPersonalActions(page);
  }
  await page.goto("/journey");
  await expect(page.getByRole("link", { name: "Sign in for learning summary", exact: true })).toBeVisible();
  await expect(learning(page)).not.toContainText(/account XP|words to revisit/);
  expect(fixtures.reads.filter(read => ["/v1/player/progression", "/v1/dashboard"].includes(read.path))).toEqual([]);
  expect(fixtures.writes).toEqual([]);
});

test("Journey learning follows authentication before story and Fair reconnect, then rejects late learning responses", async ({ page }) => {
  const fixtures = await renderFixtures(page);
  await open(page, first, "/journey");
  await expect(learning(page)).toContainText("731 account XP");
  await expect(learning(page).getByRole("link")).toContainText("17 words to revisit");
  const storyPending = deferred(), fairPending = deferred(), releaseDomains = deferred();
  await page.route("**/v1/adventure", async route => { storyPending.resolve(); await releaseDomains.promise; await route.fallback(); });
  await page.route("**/v1/fair", async route => { fairPending.resolve(); await releaseDomains.promise; await route.fallback(); });
  let captured = deferred(), release = deferred(), finished = deferred(), heldToken = second;
  await page.route("**/v1/dashboard", async route => {
    if (route.request().headers().authorization !== `Bearer ${heldToken}`) return route.fallback();
    const gate = { captured, release, finished }, owner = heldToken;
    gate.captured.resolve(); await gate.release.promise;
    await route.fulfill({ json: owner === first ? dashboard(first, 9999, 99) : dashboard(second) }); gate.finished.resolve();
  });
  try {
    await identity(page, second); await Promise.all([storyPending.promise, fairPending.promise]);
    await captured.promise;
    await expect(learning(page)).not.toContainText(/731|17 words/);
    release.resolve(); await finished.promise;
    await expect(learning(page)).toContainText("42 account XP");
    await expect(learning(page).getByRole("link")).toContainText("2 words to revisit");
    await expect(page.getByRole("region", { name: "Journey progress", exact: true })).not.toContainText("42");
    heldToken = first; captured = deferred(); release = deferred(); finished = deferred();
    await identity(page, first); await captured.promise;
    await identity(page, second);
    await expect(learning(page)).toContainText("42 account XP");
    release.resolve(); await finished.promise; await paint(page);
    await expect(learning(page)).toContainText("42 account XP");
    await expect(learning(page)).not.toContainText(/9999|99 words/);
    releaseDomains.resolve();
    await identity(page, "");
    await expect(page.getByRole("link", { name: "Sign in for learning summary", exact: true })).toBeVisible();
    await expect(learning(page)).not.toContainText(/42 account XP|2 words to revisit/);
    await expect(page.getByRole("region", { name: "Journey progress", exact: true })).toContainText("Sun coins to spend");
    await expect(page.getByRole("region", { name: "Story chapters", exact: true })).toBeVisible();
    await expect(page.getByRole("region", { name: "Friendship collection", exact: true })).toBeVisible();
    expect(fixtures.writes).toEqual([]);
  } finally { release.resolve(); releaseDomains.resolve(); }
});

test("Journey learning retries unavailable and expired reads without reviving older refreshes or guest errors", async ({ page }, testInfo) => {
  await renderFixtures(page);
  let mode: "offline" | "expired" | "ready" | "reverse" | "late-error" = "offline", refreshes = 0;
  let captured = deferred(), release = deferred(), finished = deferred();
  await page.route("**/v1/dashboard", async route => {
    if (mode === "offline") return route.abort("failed");
    if (mode === "expired") return route.fulfill({ status: 401, json: { error: "Session expired" } });
    if (mode === "late-error" || mode === "reverse" && ++refreshes === 1) {
      const gate = { captured, release, finished }, fail = mode === "late-error";
      gate.captured.resolve(); await gate.release.promise;
      await route.fulfill(fail ? { status: 503, json: { error: "Old learning error" } } : { json: dashboard(first, 9999, 99) });
      gate.finished.resolve(); return;
    }
    return route.fulfill({ json: dashboard(second) });
  });
  const reload = page.getByRole("button", { name: "Refresh learning summary", exact: true });
  try {
    await open(page, first, "/journey");
    await expect(page.getByRole("button", { name: "Retry loading learning summary", exact: true })).toBeVisible();
    await expect(learning(page)).not.toContainText(/account XP|words to revisit/);
    for (const height of [551, 844]) {
      await page.setViewportSize({ width: 390, height });
      await learning(page).scrollIntoViewIfNeeded();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      expect(await learning(page).locator("p").evaluate(element => parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(16);
      const button = await learning(page).getByRole("button", { name: "Retry loading learning summary", exact: true }).boundingBox();
      expect(button!.height).toBeGreaterThanOrEqual(44);
      await page.screenshot({ path: testInfo.outputPath(`journey-learning-unavailable-${height}.png`) });
    }
    mode = "expired"; await page.getByRole("button", { name: "Retry loading learning summary", exact: true }).click();
    await expect(learning(page).getByRole("link", { name: "Sign in again", exact: true })).toBeVisible();
    mode = "ready"; await identity(page, second);
    await expect(learning(page)).toContainText("42 account XP");
    mode = "reverse"; await reload.click(); await captured.promise;
    await expect(learning(page)).not.toContainText("42 account XP");
    await reload.click(); await expect(learning(page)).toContainText("42 account XP");
    release.resolve(); await finished.promise; await paint(page);
    await expect(learning(page)).not.toContainText(/9999|99 words/);
    mode = "late-error"; captured = deferred(); release = deferred(); finished = deferred();
    await reload.click(); await captured.promise;
    await identity(page, "");
    await expect(page.getByRole("link", { name: "Sign in for learning summary", exact: true })).toBeVisible();
    release.resolve(); await finished.promise; await paint(page);
    await expect(learning(page)).not.toContainText(/unavailable|Old learning|account XP|words to revisit/);
  } finally { release.resolve(); }
});

test.describe("Real account campaign reads", () => {
  // Share the API's real auth limiter; isolate registrations from adjacent suites.
  const separateRateWindow = async () => { test.setTimeout(90_000); await delay(60_100); };
  test.beforeAll(separateRateWindow); test.afterAll(separateRateWindow);
  test("Real account district views match authenticated API reads without changing progress", async ({ page, request }) => {
    const accounts: { token: string; user: { id: string } }[] = [];
    for (let index = 0; index < 2; index++) {
      const response = await request.post(`${API}/v1/auth/register`, { data: { email: `campaign-owner-${randomUUID()}@example.test`, password: "SunlitTest123!", displayName: "Campaign reader" } });
      expect(response.status()).toBe(201); accounts.push(await response.json());
    }
    const baseline: ProgressionState[] = [];
    for (const owner of accounts) {
      const response = await request.get(`${API}/v1/player/progression`, { headers: { Authorization: `Bearer ${owner.token}` } });
      expect(response.ok()).toBe(true); baseline.push(await response.json());
    }
    const writes: string[] = [];
    page.on("request", request => { if (new URL(request.url()).pathname.startsWith("/v1/") && !["GET", "OPTIONS"].includes(request.method())) writes.push(request.url()); });
    for (const district of districts) {
      const firstRead = page.waitForResponse(response => response.url().endsWith("/v1/player/progression") && response.request().headers().authorization === `Bearer ${accounts[0].token}`);
      await open(page, accounts[0].token, district.path);
      expect((await firstRead).ok()).toBe(true);
      for (const [index, owner] of accounts.entries()) {
        if (index) {
          const nextRead = page.waitForResponse(response => response.url().endsWith("/v1/player/progression") && response.request().headers().authorization === `Bearer ${owner.token}`);
          await identity(page, owner.token);
          const response = await nextRead;
          expect(response.ok()).toBe(true); expect(await response.json()).toEqual(baseline[index]);
        }
        const bosses = baseline[index].bosses.filter(boss => boss.worldId === district.id);
        expect(bosses).toHaveLength(3);
        await expect(page.getByText(`${bosses.filter(boss => boss.cleared).length}/3 chapters cleared`, { exact: true })).toBeVisible();
        await expect(page.locator(".world-path").getByRole("link", { name: /Replay/ })).toHaveCount(bosses.filter(boss => boss.cleared).length);
      }
    }
    for (const [index, owner] of accounts.entries()) {
      const response = await request.get(`${API}/v1/player/progression`, { headers: { Authorization: `Bearer ${owner.token}` } });
      expect(response.ok()).toBe(true); expect(await response.json()).toEqual(baseline[index]);
    }
    expect(writes).toEqual([]);
  });
});
