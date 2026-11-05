import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { test, expect, type APIRequestContext, type Page } from "@playwright/test";

const API = process.env.E2E_API_URL || "http://localhost:8080";
const PASSWORD = "SunlitTest123!";

type Completion = { runId: string; gameId: string; stars: number; difficulty: "adventure" | "expert" };

async function conflictFixture(request: APIRequestContext) {
  const registration = await request.post(`${API}/v1/auth/register`, { data: {
    email: `fair-conflict-${randomUUID()}@example.test`, password: PASSWORD, displayName: "Fair Conflict Tester",
  } });
  expect(registration.ok(), await registration.text()).toBe(true);
  const account = await registration.json() as { token: string; user: { id: string } };
  const first: Completion = { runId: randomUUID(), gameId: "tea-time", stars: 3, difficulty: "adventure" };
  const second: Completion = { ...first, stars: 1, difficulty: "expert" };
  const headers = { Authorization: `Bearer ${account.token}` };
  const saved = await request.post(`${API}/v1/fair/completions`, { headers, data: first });
  expect(saved.ok(), await saved.text()).toBe(true);
  const queued = { ...second, at: new Date().toISOString() };
  const key = `loccao.fair.v2.${account.user.id}.run.${first.runId}`;
  return { account, first, second, headers, key, queued, queuedRaw: JSON.stringify(queued) };
}

async function seedQueue(page: Page, fixture: Awaited<ReturnType<typeof conflictFixture>>) {
  await page.addInitScript(({ token, key, raw }) => {
    localStorage.setItem("loccao_token", token);
    localStorage.setItem(key, raw);
  }, { token: fixture.account.token, key: fixture.key, raw: fixture.queuedRaw });
}

test("a Fair conflict is reconciled without deleting the queued copy", async ({ page, request }, testInfo) => {
  test.setTimeout(90_000);
  const fixture = await conflictFixture(request);
  await seedQueue(page, fixture);
  const later = { runId: randomUUID(), gameId: "bubble-meadow", stars: 2, difficulty: "adventure", at: new Date(Date.now() + 1000).toISOString() };
  await page.addInitScript(({ owner, later }) => localStorage.setItem(`loccao.fair.v2.${owner}.run.${later.runId}`, JSON.stringify(later)), { owner: fixture.account.user.id, later });
  await page.goto("/festival/tea-time");

  const conflict = page.getByRole("region", { name: "Saved memory conflicts" });
  const card = conflict.getByRole("article", { name: "Tea Time memory conflict" });
  await expect(card).toContainText("Saved result: 3 stars · Adventure");
  await expect(card).toContainText("Queued copy: 1 star · Challenge");
  await expect(card.getByRole("button", { name: "Keep local copy and use saved result" })).toBeVisible();

  for (const height of [551, 844]) {
    await page.setViewportSize({ width: 390, height });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const action = card.getByRole("button", { name: "Keep local copy and use saved result" });
    expect((await action.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    expect(Number.parseFloat(await action.evaluate(element => getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(16);
    await conflict.screenshot({ path: `.cache/fair-conflict-${height}.png` });
  }

  // Simulate a browser that can read the saved result but cannot create the
  // archive key. The original queue must remain visible and retryable.
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    (window as Window & { __fairOriginalSetItem?: Storage["setItem"] }).__fairOriginalSetItem = original;
    Storage.prototype.setItem = function (key: string, value: string) {
      if (key.includes(".resolved.")) throw new Error("archive storage blocked");
      return original.call(this, key, value);
    };
  });
  await card.getByRole("button", { name: "Keep local copy and use saved result" }).click();
  await expect(page.getByText("The local copy could not be confirmed in this browser. Your queued data is kept. Retry sync to check it again.", { exact: true })).toBeVisible();
  expect(await page.evaluate(key => localStorage.getItem(key), fixture.key)).toBe(fixture.queuedRaw);

  // Restore storage, resolve, and verify that only the exact queued payload is
  // archived. The server aggregate remains the first committed result.
  await page.evaluate(() => {
    const original = (window as Window & { __fairOriginalSetItem?: Storage["setItem"] }).__fairOriginalSetItem;
    if (original) Storage.prototype.setItem = original;
  });
  await card.getByRole("button", { name: "Keep local copy and use saved result" }).click();
  await expect(conflict.getByText("Kept local copies (1)", { exact: true })).toBeVisible();
  const archive = await page.evaluate(key => {
    const raw = localStorage.getItem(key.replace(".run.", ".resolved."));
    return raw ? JSON.parse(raw) : null;
  }, fixture.key);
  expect(archive).toMatchObject({ version: 1, method: "fair-conflict-archive.v1", queued: fixture.queued, saved: fixture.first });
  expect(await page.evaluate(key => localStorage.getItem(key), fixture.key)).toBe(fixture.queuedRaw);

  const saved = await request.get(`${API}/v1/fair`, { headers: fixture.headers });
  expect(saved.ok()).toBe(true);
  const canonical = (await saved.json()).save;
  expect(canonical.games["tea-time"]).toMatchObject({ visits: 1, stars: 3 });
  expect(canonical.games["bubble-meadow"]).toMatchObject({ visits: 1, stars: 2 });
  expect((await (await request.get(`${API}/v1/me`, { headers: fixture.headers })).json()).user.xp).toBe(0);
  await conflict.getByText("Kept local copies (1)", { exact: true }).click();
  await expect(conflict.getByRole("button", { name: "Download kept copies" })).toBeVisible();
  const downloadPending = page.waitForEvent("download");
  await conflict.getByRole("button", { name: "Download kept copies" }).click();
  const download = await downloadPending, downloadPath = await download.path();
  expect(downloadPath).not.toBeNull();
  const exported = JSON.parse(await readFile(downloadPath!, "utf8"));
  expect(exported).toMatchObject({ method: "fair-conflict-export.v1", playerId: fixture.account.user.id, copies: [{ queuedRaw: fixture.queuedRaw, saved: fixture.first }] });
  await page.reload();
  await expect(page.getByText("Kept local copies (1)", { exact: true })).toBeVisible();
  await expect(page.getByRole("article", { name: "Tea Time memory conflict" })).toHaveCount(0);
  expect(await page.evaluate(key => localStorage.getItem(key), fixture.key)).toBe(fixture.queuedRaw);
  await page.screenshot({ path: testInfo.outputPath("fair-conflict-resolved.png"), fullPage: true });
});

test("a late Fair receipt cannot restore an account after the user switches away", async ({ page, request }) => {
  test.setTimeout(60_000);
  const fixture = await conflictFixture(request);
  await seedQueue(page, fixture);
  let release!: () => void;
  let seen!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  const received = new Promise<void>(resolve => { seen = resolve; });
  await page.route(`**/v1/fair/completions/${fixture.first.runId}`, async route => {
    seen();
    await held;
    await route.continue();
  });
  await page.goto("/festival/tea-time");
  await received;
  await page.evaluate(() => {
    localStorage.removeItem("loccao_token");
    window.dispatchEvent(new Event("loccao-auth-change"));
  });
  release();
  await expect(page.getByRole("region", { name: "Saved memory conflicts" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Open account →" })).toBeVisible();
  expect(await page.evaluate(key => localStorage.getItem(key), fixture.key)).toBe(fixture.queuedRaw);
});

test("Fair receipts stay owner-scoped and locked courses do not create conflict archives", async ({ request }) => {
  const fixture = await conflictFixture(request);
  const missing = randomUUID();
  const receipt = await request.get(`${API}/v1/fair/completions/${fixture.first.runId}`, { headers: fixture.headers });
  expect(receipt.ok()).toBe(true);
  expect(await receipt.json()).toMatchObject({ method: "fair-keepsake.v1", playerId: fixture.account.user.id, completion: fixture.first });
  expect((await request.get(`${API}/v1/fair/completions/not-a-uuid`, { headers: fixture.headers })).status()).toBe(400);
  expect((await request.get(`${API}/v1/fair/completions/${missing}`, { headers: fixture.headers })).status()).toBe(404);
  expect((await request.get(`${API}/v1/fair/completions/${fixture.first.runId}`)).status()).toBe(401);
  const other = await conflictFixture(request);
  expect((await request.get(`${API}/v1/fair/completions/${fixture.first.runId}`, { headers: other.headers })).status()).toBe(404);

  const locked = { runId: randomUUID(), gameId: "cloud-hop", courseId: "cloud-02", stars: 3, elapsedMs: 40_000, feathers: 0 };
  const response = await request.post(`${API}/v1/fair/completions`, { headers: fixture.headers, data: locked });
  expect(response.status()).toBe(409);
  expect((await request.get(`${API}/v1/fair/completions/${locked.runId}`, { headers: fixture.headers })).status()).toBe(404);
});

test("a missing receipt on an older API keeps a conflicting queue without offering resolution", async ({ page, request }) => {
  const fixture = await conflictFixture(request);
  await seedQueue(page, fixture);
  await page.route(`**/v1/fair/completions/${fixture.first.runId}`, route => route.fulfill({ status: 404, json: { error: "old API has no receipt read" } }));
  await page.goto("/festival/tea-time");
  await expect(page.getByText("A queued memory could not be checked against its saved result. It is kept here; update the connection and retry sync.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Keep local copy and use saved result" })).toHaveCount(0);
  expect(await page.evaluate(key => localStorage.getItem(key), fixture.key)).toBe(fixture.queuedRaw);
  expect(await page.evaluate(key => localStorage.getItem(key.replace(".run.", ".resolved.")), fixture.key)).toBeNull();
});
