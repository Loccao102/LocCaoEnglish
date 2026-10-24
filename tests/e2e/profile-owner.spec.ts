import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import type { PlayerProfile } from "../../lib/api";

const API = process.env.E2E_API_URL || "http://localhost:8080";
const PREFIX = "loccao.profile-settings.v1.";
const LEGACY = "loccao_player_build";
type Account = { token: string; user: { id: string }; headers: Record<string, string> };
type Fields = Pick<PlayerProfile, "goal" | "cefrLevel" | "dailyMinutes" | "targetBand" | "interests">;
const defaults: Fields = { goal: "conversation", cefrLevel: "B1", dailyMinutes: 15, targetBand: 7, interests: ["daily-life"] };
const editor = (page: Page) => page.getByRole("region", { name: "Learning goal settings", exact: true });
const notice = (page: Page) => page.getByRole("region", { name: "Settings status", exact: true });
const save = (page: Page) => editor(page).getByRole("button", { name: "Save player build", exact: true });
const refresh = (page: Page) => notice(page).getByRole("button", { name: "Refresh saved settings", exact: true });
const goal = (page: Page, name: string) => editor(page).getByRole("button", { name, exact: false });
const fields = ({ goal, cefrLevel, dailyMinutes, targetBand, interests }: PlayerProfile): Fields => ({ goal, cefrLevel, dailyMinutes, targetBand, interests });

// Keep the real shared auth limit: isolate this suite's account fixtures from
// neighbouring files without replaying failed assertions or relaxing the API.
async function separateRateWindow() { test.setTimeout(90_000); await delay(60_100); }
test.beforeAll(separateRateWindow);
test.afterAll(separateRateWindow);

async function account(request: APIRequestContext): Promise<Account> {
  const response = await request.post(`${API}/v1/auth/register`, { data: {
    email: `profile-owner-${randomUUID()}@example.test`, password: "SunlitTest123!", displayName: "Settings explorer",
  } });
  expect(response.status()).toBe(201); const result = await response.json();
  return { ...result, headers: { Authorization: `Bearer ${result.token}` } };
}
async function read<T>(request: APIRequestContext, path: string, owner: Account): Promise<T> {
  const response = await request.get(`${API}${path}`, { headers: owner.headers });
  expect(response.ok()).toBe(true); return response.json();
}
async function write(request: APIRequestContext, owner: Account, input: Fields) {
  const response = await request.put(`${API}/v1/player/profile`, { headers: owner.headers, data: input });
  expect(response.ok()).toBe(true); return response.json() as Promise<PlayerProfile>;
}
async function signIn(page: Page, owner: Account, path = "/onboarding") {
  await page.addInitScript(({ token, key }) => {
    if (!sessionStorage.getItem(key)) { localStorage.setItem("loccao_token", token); sessionStorage.setItem(key, "ready"); }
  }, { token: owner.token, key: `profile-owner-${randomUUID()}` });
  await page.goto(path);
}
async function identity(page: Page, token: string) {
  await page.evaluate(value => {
    if (value) localStorage.setItem("loccao_token", value); else localStorage.removeItem("loccao_token");
    window.dispatchEvent(new Event("loccao-auth-change"));
  }, token);
}
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}
async function paint(page: Page) {
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
}
async function finishPlacement(page: Page) {
  for (let index = 0; index < 12; index++) {
    await page.locator(".placement-question .choice-stack button").first().click();
    await page.getByRole("button", { name: index === 11 ? "Finish calibration →" : "Lock answer →", exact: true }).click();
  }
}

test("Real account settings save and reload without importing ownerless preferences or granting rewards", async ({ page, request }) => {
  const owner = await account(request);
  const dashboardBefore = await read<{ user: unknown; skills: unknown }>(request, "/v1/dashboard", owner);
  const dailyBefore = await read<unknown>(request, "/v1/player/daily", owner);
  const legacy = JSON.stringify({ ...defaults, goal: "travel", dailyMinutes: 60 });
  await page.addInitScript(({ key, raw }) => localStorage.setItem(key, raw), { key: LEGACY, raw: legacy });
  await signIn(page, owner);
  await expect(save(page)).toBeEnabled();
  await expect(goal(page, "Speak comfortably")).toHaveAttribute("aria-pressed", "true");
  await expect(editor(page).getByRole("button", { name: "Review earlier device settings", exact: true })).toHaveCount(0);
  await goal(page, "Use English at work").click();
  await editor(page).getByLabel("Starting practice level", { exact: true }).selectOption("B2");
  await editor(page).getByRole("button", { name: "30m", exact: true }).click();
  await editor(page).getByRole("button", { name: "technology", exact: true }).click();
  await save(page).click();
  await expect(notice(page)).toContainText("Saved to your account.");
  await page.reload();
  await expect(save(page)).toBeEnabled();
  await expect(goal(page, "Use English at work")).toHaveAttribute("aria-pressed", "true");
  await expect(editor(page).getByLabel("Starting practice level", { exact: true })).toHaveValue("B2");
  await expect(editor(page).getByRole("button", { name: "30m", exact: true })).toHaveAttribute("aria-pressed", "true");
  const profile = await read<PlayerProfile>(request, "/v1/player/profile", owner);
  expect(fields(profile)).toEqual({ ...defaults, goal: "work", cefrLevel: "B2", dailyMinutes: 30, interests: ["daily-life", "technology"] });
  const dashboardAfter = await read<{ user: unknown; skills: unknown }>(request, "/v1/dashboard", owner);
  expect(dashboardAfter.user).toEqual(dashboardBefore.user); expect(dashboardAfter.skills).toEqual(dashboardBefore.skills);
  expect(await read(request, "/v1/player/daily", owner)).toEqual(dailyBefore);
  expect(await page.evaluate(key => localStorage.getItem(key), LEGACY)).toBe(legacy);
  for (const height of [551, 844]) {
    await page.setViewportSize({ width: 390, height });
    await editor(page).evaluate(el => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 110));
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `.cache/profile-settings-${height}.png` });
    await save(page).evaluate(el => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 150));
    await page.screenshot({ path: `.cache/profile-save-${height}.png` });
  }
});

test("A late settings GET cannot load account A preferences into account B", async ({ page, request }) => {
  const first = await account(request), other = await account(request);
  await write(request, first, { ...defaults, goal: "travel", dailyMinutes: 60 });
  const captured = deferred(), release = deferred(), finished = deferred();
  await page.route("**/v1/player/profile", async route => {
    if (route.request().method() !== "GET" || route.request().headers().authorization !== first.headers.Authorization) return route.continue();
    const response = await route.fetch(); expect(response.ok()).toBe(true); captured.resolve(); await release.promise;
    await route.fulfill({ response }); finished.resolve();
  });
  try {
    await signIn(page, first); await captured.promise;
    await expect(save(page)).toHaveCount(0);
    await identity(page, other.token); await expect(save(page)).toBeEnabled();
    await expect(goal(page, "Speak comfortably")).toHaveAttribute("aria-pressed", "true");
    release.resolve(); await finished.promise; await paint(page);
    await expect(goal(page, "Speak comfortably")).toHaveAttribute("aria-pressed", "true");
    await expect(goal(page, "Travel without panic")).toHaveAttribute("aria-pressed", "false");
    expect(fields(await read<PlayerProfile>(request, "/v1/player/profile", other))).toEqual(defaults);
  } finally { release.resolve(); }
});

test("Pending settings PUT captures its owner and cannot replace another account or the guest after logout", async ({ page, request }) => {
  const first = await account(request), other = await account(request);
  await signIn(page, first); await expect(save(page)).toBeEnabled();
  const committed = deferred(), release = deferred(), finished = deferred(); let puts = 0;
  await page.route("**/v1/player/profile", async route => {
    if (route.request().method() !== "PUT") return route.continue();
    puts++; expect(route.request().headers().authorization).toBe(first.headers.Authorization);
    const response = await route.fetch(); expect(response.ok()).toBe(true); committed.resolve(); await release.promise;
    await route.fulfill({ response }); finished.resolve();
  });
  try {
    await goal(page, "Use English at work").click(); await save(page).click(); await committed.promise;
    await identity(page, other.token); await expect(save(page)).toBeEnabled();
    await expect(goal(page, "Speak comfortably")).toHaveAttribute("aria-pressed", "true");
    await identity(page, "");
    await expect(editor(page).getByRole("button", { name: "Save on this device", exact: true })).toBeEnabled();
    release.resolve(); await finished.promise; await paint(page);
    await expect(goal(page, "Speak comfortably")).toHaveAttribute("aria-pressed", "true");
    await expect(notice(page)).not.toContainText("Saved to your account."); expect(puts).toBe(1);
    expect((await read<PlayerProfile>(request, "/v1/player/profile", first)).goal).toBe("work");
    expect(fields(await read<PlayerProfile>(request, "/v1/player/profile", other))).toEqual(defaults);
  } finally { release.resolve(); }
});

test("Lost committed save blocks duplicate PUT, survives failed refresh, and reload confirms matching saved fields", async ({ page, request }) => {
  const owner = await account(request); await signIn(page, owner); await expect(save(page)).toBeEnabled();
  let puts = 0, failRead = false;
  await page.route("**/v1/player/profile", async route => {
    if (route.request().method() === "PUT") {
      puts++; const response = await route.fetch(); expect(response.ok()).toBe(true); return route.abort("failed");
    }
    if (failRead) return route.fulfill({ status: 503, json: { error: "Temporarily offline" } });
    return route.continue();
  });
  await goal(page, "Travel without panic").click();
  await save(page).evaluate(button => { (button as HTMLButtonElement).click(); (button as HTMLButtonElement).click(); });
  await expect(notice(page)).toContainText("Save could not be confirmed");
  await expect(save(page)).toBeDisabled(); expect(puts).toBe(1);
  failRead = true; await refresh(page).click();
  await expect(notice(page)).toContainText("Your save is still unconfirmed");
  await expect(save(page)).toBeDisabled(); expect(puts).toBe(1);
  failRead = false; await page.reload();
  await expect(notice(page)).toContainText("Your changes match the settings now saved on your account.");
  await expect(save(page)).toBeEnabled();
  await expect(goal(page, "Travel without panic")).toHaveAttribute("aria-pressed", "true"); expect(puts).toBe(1);
  expect((await read<PlayerProfile>(request, "/v1/player/profile", owner)).goal).toBe("travel");
});

test("Uncommitted save keeps both versions until an explicit saved-or-draft choice", async ({ page, request }) => {
  const owner = await account(request); await signIn(page, owner); await expect(save(page)).toBeEnabled();
  let puts = 0;
  await page.route("**/v1/player/profile", route => {
    if (route.request().method() !== "PUT") return route.continue();
    puts++; return route.abort("failed");
  });
  await goal(page, "Use English at work").click(); await save(page).click();
  await expect(notice(page)).toContainText("Save could not be confirmed");
  await refresh(page).click();
  await expect(notice(page).getByRole("region", { name: "Saved settings", exact: true })).toContainText("Speak comfortably");
  await expect(notice(page).getByRole("region", { name: "My changes", exact: true })).toContainText("Use English at work");
  await expect(save(page)).toBeDisabled(); expect(puts).toBe(1);
  await notice(page).getByRole("button", { name: "Review my changes", exact: true }).click();
  await expect(save(page)).toBeEnabled();
  await expect(goal(page, "Use English at work")).toHaveAttribute("aria-pressed", "true"); expect(puts).toBe(1);
  await save(page).click(); await expect(notice(page)).toContainText("Save could not be confirmed");
  await refresh(page).click();
  await notice(page).getByRole("button", { name: "Use saved settings", exact: true }).click();
  await expect(save(page)).toBeEnabled();
  await expect(goal(page, "Speak comfortably")).toHaveAttribute("aria-pressed", "true");
  expect(puts).toBe(2); expect(fields(await read<PlayerProfile>(request, "/v1/player/profile", owner))).toEqual(defaults);
});

test("Guest settings use explicit legacy review and preserve unreadable device data without personal requests", async ({ page, request }) => {
  const legacy = JSON.stringify({ ...defaults, goal: "travel", dailyMinutes: 45 });
  const unreadable = JSON.stringify({ version: 99, owner: "guest", status: "confirmed", fields: { ...defaults, goal: "work" } });
  await page.addInitScript(({ legacyKey, legacy, key, unreadable }) => {
    localStorage.setItem(legacyKey, legacy); localStorage.setItem(key, unreadable);
  }, { legacyKey: LEGACY, legacy, key: PREFIX + "guest", unreadable });
  let personalRequests = 0;
  page.on("request", request => { if (request.url().endsWith("/v1/player/profile")) personalRequests++; });
  expect((await request.put(`${API}/v1/player/profile`, { data: defaults })).status()).toBe(401);
  await page.goto("/onboarding");
  const localSave = editor(page).getByRole("button", { name: "Save on this device", exact: true });
  await expect(localSave).toBeEnabled();
  await expect(notice(page)).toContainText("Earlier device settings could not be read safely");
  await expect(goal(page, "Speak comfortably")).toHaveAttribute("aria-pressed", "true");
  await editor(page).getByRole("button", { name: "Review earlier device settings", exact: true }).click();
  await expect(editor(page).getByRole("region", { name: "Earlier device settings", exact: true })).toContainText("Travel without panic");
  await expect(goal(page, "Speak comfortably")).toHaveAttribute("aria-pressed", "true");
  await editor(page).getByRole("button", { name: "Use earlier device settings", exact: true }).click();
  await expect(goal(page, "Travel without panic")).toHaveAttribute("aria-pressed", "true");
  await localSave.click();
  await expect(notice(page)).toContainText("Device settings could not be saved");
  await expect(localSave).toBeEnabled();
  await expect(editor(page).getByRole("link", { name: "Continue to camp →", exact: true })).toHaveCount(0);
  expect(await page.evaluate(key => localStorage.getItem(key), PREFIX + "guest")).toBe(unreadable);
  expect(await page.evaluate(key => localStorage.getItem(key), LEGACY)).toBe(legacy);
  expect(personalRequests).toBe(0);
});

test("Blocked device draft storage still permits an honest online account save", async ({ page, request }) => {
  const owner = await account(request);
  await page.addInitScript(prefix => {
    const originalGet = Storage.prototype.getItem, originalSet = Storage.prototype.setItem;
    Storage.prototype.getItem = function(key) { if (key.startsWith(prefix)) throw new DOMException("Blocked", "SecurityError"); return originalGet.call(this, key); };
    Storage.prototype.setItem = function(key, value) { if (key.startsWith(prefix)) throw new DOMException("Blocked", "SecurityError"); originalSet.call(this, key, value); };
  }, PREFIX);
  await signIn(page, owner); await expect(save(page)).toBeEnabled();
  await expect(notice(page)).toContainText("Device storage is unavailable");
  await goal(page, "Use English at work").click(); await save(page).click();
  await expect(notice(page)).toContainText("Saved to your account.");
  await expect(notice(page)).toContainText("Device storage is unavailable"); await expect(save(page)).toBeEnabled();
  expect((await read<PlayerProfile>(request, "/v1/player/profile", owner)).goal).toBe("work");
  await page.reload(); await expect(save(page)).toBeEnabled();
  await expect(goal(page, "Use English at work")).toHaveAttribute("aria-pressed", "true");
});

test("Guest and signed-in placement preserve their preference owner and award no learning rewards", async ({ page, request }) => {
  let legacyWrites = 0, profilePuts = 0, profileGets = 0;
  page.on("request", request => {
    if (request.url().endsWith("/v1/attempts") && request.method() !== "GET") legacyWrites++;
    if (request.url().endsWith("/v1/player/profile")) { if (request.method() === "PUT") profilePuts++; else profileGets++; }
  });
  await page.addInitScript(({ key, defaults }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({ version: 1, owner: "guest", status: "confirmed", fields: { ...defaults, goal: "travel" } }));
  }, { key: PREFIX + "guest", defaults });
  await page.goto("/placement"); await finishPlacement(page);
  await expect(page.getByRole("heading", { name: /Suggested starting level:/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "Start main quest: Travel District →", exact: true })).toBeVisible();
  expect(profileGets).toBe(0); expect(profilePuts).toBe(0); expect(legacyWrites).toBe(0);
  const guestDraft = await page.evaluate(key => localStorage.getItem(key), PREFIX + "guest");
  const owner = await account(request); await write(request, owner, { ...defaults, goal: "work" });
  const before = await read<{ user: unknown; skills: unknown }>(request, "/v1/dashboard", owner);
  await identity(page, owner.token); await page.goto("/placement"); await finishPlacement(page);
  await expect(page.getByRole("heading", { name: /Suggested starting level:/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "Start main quest: Work District →", exact: true })).toBeVisible();
  expect(profilePuts).toBe(1); expect(legacyWrites).toBe(0);
  const after = await read<{ user: unknown; skills: unknown }>(request, "/v1/dashboard", owner);
  expect(after.user).toEqual(before.user); expect(after.skills).toEqual(before.skills);
  expect(await page.evaluate(key => localStorage.getItem(key), PREFIX + "guest")).toBe(guestDraft);
});
