import { test, expect as baseExpect, type Page } from "@playwright/test";
import { PerspectiveCamera, Vector3 } from "three";

test.setTimeout(90000);
const expect=baseExpect.configure({timeout:15000});
const API = process.env.E2E_API_URL || "http://localhost:8080";
async function playTea(page: Page) {
  await page.goto("/festival/tea-time");
  await page.getByRole("button", { name: "Let’s play →" }).click();
  const bar = page.getByRole("group", { name: "Playfield choices" });
  for (const [round, recipe] of [["Tea", "Milk", "Honey"], ["Tea", "Mint", "Honey"], ["Tea", "Milk", "Mint"]].entries()) {
    await expect(page.locator(".fair-objective")).toContainText(`ROUND ${round + 1} / 3`);
    for (const ingredient of recipe) await bar.getByRole("button", { name: new RegExp(ingredient) }).click();
    await page.getByRole("button", { name: "Serve tea →" }).click();
  }
  await expect(page.getByRole("heading", { name: "A memory made together" })).toBeVisible();
}
async function createAccount(page: Page, suffix: string) {
  const email = `journey-${suffix}-${Date.now()}@example.test`;
  const response = await page.request.post(`${API}/v1/auth/register`, { data: { email, password: "SunlitTest123!", displayName: "Journey Tester" } });
  expect(response.ok(), await response.text()).toBe(true);
  const result = await response.json();
  await page.goto("/account");
  await page.evaluate(token => { localStorage.setItem("loccao_token", token); window.dispatchEvent(new Event("loccao-auth-change")); }, result.token);
  return result as { token: string; user: { id: string } };
}

test("a real tea game saves one guest memory and keeps it across reloads", async ({ page }) => {
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  await playTea(page);
  await expect(page.getByText("Friendship stamp and best score saved on this device.")).toBeVisible();
  await page.getByRole("link", { name: "Open friendship scrapbook" }).click();
  const card = page.locator(".fair-card").filter({ has: page.getByRole("heading", { name: "Tea Time" }) });
  await expect(card).toContainText("Best 375 · 1 memory made");
  await page.reload(); await expect(card).toContainText("Best 375 · 1 memory made");
  expect(errors).toEqual([]);
});

test("bubble picking moves the articulated player through all five rounds", async ({ page }) => {
  await page.goto("/festival/bubble-meadow"); await page.getByRole("button", { name: "Let’s play →" }).click();
  for (const [round, answer] of [0, 1, 2, 3, 0].entries()) {
    await expect(page.locator(".fair-objective")).toContainText(`ROUND ${round + 1} / 5`);
    const rect = (await page.locator(".fair-canvas canvas").boundingBox())!;
    const camera = new PerspectiveCamera(43, rect.width / rect.height, .1, 70), distance = rect.width < rect.height ? 18 : 13.8;
    camera.position.set(0, distance * .85, distance * .88); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
    const point = new Vector3((answer - 1.5) * 2.15, 1.2, -.5).project(camera);
    await page.mouse.click(rect.x + (point.x + 1) / 2 * rect.width, rect.y + (1 - point.y) / 2 * rect.height);
  }
  await expect(page.getByRole("heading", { name: "A memory made together" })).toBeVisible({ timeout: 20000 });
  await expect(page.getByText("575 points")).toBeVisible();
});

test("colour mixing, pause and keyboard navigation work together", async ({ page }) => {
  await page.goto("/festival/colour-studio"); await page.getByRole("button", { name: "Let’s play →" }).click();
  await page.keyboard.press("Escape"); await expect(page.getByRole("heading", { name: "A little breather" })).toBeVisible();
  await page.keyboard.press("1"); await page.getByRole("button", { name: "Resume game →" }).click();
  for (const [round, pair] of [[1, 2], [2, 3], [1, 3], [1, 4]].entries()) {
    await expect(page.locator(".fair-objective")).toContainText(`ROUND ${round + 1} / 4`);
    for (const key of pair) await page.keyboard.press(String(key));
    await page.getByRole("button", { name: "Mix paint →" }).click();
  }
  await expect(page.getByRole("heading", { name: "A memory made together" })).toBeVisible();
  await expect(page.getByText("475 points")).toBeVisible();
});

test("an offline account win is queued, survives navigation and syncs exactly once", async ({ page }) => {
  const account = await createAccount(page, "offline");
  await page.goto("/festival"); await expect(page.getByText(/Journey Tester’s scrapbook/)).toBeVisible();
  await page.route("**/v1/fair/completions", route => route.abort("failed"));
  await playTea(page);
  await expect(page.getByText("Memory kept on this device · waiting to sync to your account.")).toBeVisible();
  await page.getByRole("link", { name: "Open friendship scrapbook" }).click();
  await expect(page).toHaveURL(/\/festival$/); await page.reload(); await expect(page.getByText("1 memory waiting to sync")).toBeVisible();
  await page.unroute("**/v1/fair/completions"); await page.getByRole("button", { name: "Retry sync" }).click();
  await expect(page.getByText("1 memory waiting to sync")).toHaveCount(0);
  await expect(page.getByText("Best 375 · 1 memory made")).toBeVisible();
  const saved = await page.request.get(`${API}/v1/fair`, { headers: { Authorization: `Bearer ${account.token}` } });
  expect((await saved.json()).save.games["tea-time"].visits).toBe(1);
  await page.goto("/account"); await page.getByRole("button", { name: "Play as guest" }).click();
  await page.goto("/festival"); await expect(page.getByText("Guest scrapbook · saved on this device")).toBeVisible();
  await expect(page.getByText("Best 375 · 1 memory made")).toHaveCount(0);
});

test("a lost response can retry without duplicating an account memory", async ({ page }) => {
  await createAccount(page, "retry"); let loseResponse = true;
  await page.route("**/v1/fair/completions", async route => { const response = await route.fetch(); if (loseResponse) { loseResponse = false; await route.abort("failed"); } else await route.fulfill({ response }); });
  await playTea(page);
  await expect(page.getByText("Friendship stamp and best score saved to your account.")).toBeVisible();
  await page.goto("/festival"); await expect(page.getByText("Best 375 · 1 memory made")).toBeVisible();
});

test("the journey connects 24 friends, free companions and story milestones on mobile", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/journey");
  await expect(page.getByRole("heading", { name: /A little further/ })).toBeVisible();
  await expect(page.getByRole("group", { name: "Choose a friend" }).getByRole("button")).toHaveCount(24);
  await page.getByRole("group", { name: "Choose a friend" }).getByRole("button", { name: /^Moca/ }).click();
  await page.getByRole("button", { name: "Travel with Moca" }).click();
  await expect(page.getByText("Moca is ready to travel with you.")).toBeVisible();
  await page.reload(); await expect(page.locator(".journey-traveller")).toContainText("Moca");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("journey-mobile.png"), fullPage: true });
});

test("signing in through the account form switches both progress systems", async ({ page }) => {
  await page.goto("/account"); await page.getByRole("button", { name: "Create account", exact: true }).click();
  await page.getByLabel("Display name").fill("Sunlit Explorer");
  await page.getByLabel("Email", { exact: true }).fill(`ui-${Date.now()}@example.test`);
  await page.getByLabel("Password", { exact: true }).fill("SunlitTest123!");
  await page.locator("form").getByRole("button", { name: "Create account", exact: true }).last().click();
  await page.getByRole("link", { name: "Continue account adventure →" }).click();
  await expect(page.getByText(/Sunlit Explorer’s scrapbook/)).toBeVisible();
  await expect(page.getByRole("region", { name: "Journey progress" })).toContainText("0 / 7");
});

test("switching accounts never uploads another player's queued memory", async ({ page }) => {
  const first = await createAccount(page, "owner-a");
  const second = await createAccount(page, "owner-b");
  await page.evaluate(({ first, second }) => {
    localStorage.setItem(`loccao.fair.v2.${first.user.id}.run.32345678-1234-4123-8123-123456789012`, JSON.stringify({ runId: "32345678-1234-4123-8123-123456789012", gameId: "tea-time", stars: 3, at: new Date().toISOString() }));
    localStorage.setItem("loccao_token", second.token); window.dispatchEvent(new Event("loccao-auth-change"));
  }, { first, second });
  await page.goto("/festival"); await expect(page.getByText(/Journey Tester’s scrapbook/)).toBeVisible();
  await expect(page.getByText("Best 375 · 1 memory made")).toHaveCount(0);
  const untouched = await page.request.get(`${API}/v1/fair`, { headers: { Authorization: `Bearer ${second.token}` } });
  expect((await untouched.json()).save.games).toEqual({});
  await page.evaluate(token => { localStorage.setItem("loccao_token", token); window.dispatchEvent(new Event("loccao-auth-change")); }, first.token);
  await expect(page.getByText("Best 375 · 1 memory made")).toBeVisible();
});

test("blocked browser storage offers retry and an explicit way to keep playing", async ({ page }) => {
  await page.addInitScript(() => { const set = Storage.prototype.setItem; Storage.prototype.setItem = function(key, value) { if (key.startsWith("loccao.fair.v2.")) throw new DOMException("Site storage is full", "QuotaExceededError"); return set.call(this, key, value); }; });
  await playTea(page);
  await expect(page.getByRole("button", { name: "Retry saving memory" })).toBeVisible();
  await expect(page.getByText("Friendship stamp and best score saved on this device.")).toHaveCount(0);
  await page.getByRole("button", { name: "Leave this unsaved result & play again" }).click();
  await expect(page.locator(".fair-objective")).toContainText("ROUND 1 / 3");
  await expect(page.getByRole("button", { name: "Retry saving memory" })).toHaveCount(0);
});
