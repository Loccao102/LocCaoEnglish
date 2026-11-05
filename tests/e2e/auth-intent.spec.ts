import { randomUUID } from "node:crypto";
import { expect, test, type Page, type Response } from "@playwright/test";

test.setTimeout(60_000);
const form = (page: Page) => page.locator(".auth-form");
const result = (token = "auth-owner-A") => ({ token, user: { id: token, email: "auth-fixture@example.test", displayName: token, xp: 0, streak: 0 } });
function gate() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}
async function fixtures(page: Page) {
  await page.route("**/v1/**", route => {
    if (new URL(route.request().url()).pathname === "/v1/me") {
      const token = (route.request().headers().authorization || "").replace(/^Bearer /, "");
      return route.fulfill({ json: { ...result(token), role: "learner" } });
    }
    return route.fulfill({ status: 404, json: { error: "Unrelated auth fixture" } });
  });
}
async function fill(page: Page, mode: "login" | "register") {
  if (mode === "register") {
    await form(page).getByRole("button", { name: "Create account", exact: true }).click();
    await page.getByLabel("Display name", { exact: true }).fill("Auth fixture");
  }
  await page.getByLabel("Email", { exact: true }).fill("auth-fixture@example.test");
  await page.getByLabel("Password", { exact: true }).fill("SunlitTest123!");
}
async function settled(page: Page, response: Response) {
  await response.finished();
  // Let the response JSON continuation and its React update finish before checking absence.
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
}

for (const mode of ["login", "register"] as const) {
  test(`late ${mode} cannot undo a later guest choice or duplicate a pending request`, async ({ page }) => {
    await fixtures(page);
    const captured = gate(), release = gate(); let writes = 0;
    await page.route(`**/v1/auth/${mode}`, async route => {
      writes++; expect(route.request().headers().authorization || "").toBe("");
      captured.resolve(); await release.promise;
      await route.fulfill({ json: result() });
    });
    try {
      await page.goto("/account"); await fill(page, mode);
      await form(page).evaluate(element => { const node = element as HTMLFormElement; node.requestSubmit(); node.requestSubmit(); });
      await captured.promise;
      await expect(page.getByLabel("Password", { exact: true })).toBeDisabled();
      await page.getByRole("button", { name: "Play as guest", exact: true }).click();
      await expect(page.getByLabel("Password", { exact: true })).toHaveValue("");
      const response = page.waitForResponse(`**/v1/auth/${mode}`);
      release.resolve(); await settled(page, await response);
      expect(writes).toBe(1);
      expect(await page.evaluate(() => localStorage.getItem("loccao_token"))).toBeNull();
      await expect(form(page)).toContainText("Signed out");
      await expect(page.getByRole("link", { name: "Continue account adventure →", exact: true })).toHaveCount(0);
    } finally { release.resolve(); }
  });
}

test("a different account selected in another tab wins over the pending login", async ({ page }) => {
  await fixtures(page); const captured = gate(), release = gate();
  await page.route("**/v1/auth/login", async route => { captured.resolve(); await release.promise; await route.fulfill({ json: result() }); });
  try {
    await page.goto("/account"); await fill(page, "login");
    await page.getByLabel("Password", { exact: true }).press("Enter"); await captured.promise;
    await page.evaluate(() => {
      localStorage.setItem("loccao_token", "auth-owner-B");
      window.dispatchEvent(new StorageEvent("storage", { key: "loccao_token", newValue: "auth-owner-B" }));
    });
    await expect(form(page)).toContainText("Signed in as auth-owner-B");
    const response = page.waitForResponse("**/v1/auth/login"); release.resolve(); await settled(page, await response);
    expect(await page.evaluate(() => localStorage.getItem("loccao_token"))).toBe("auth-owner-B");
    await expect(form(page)).not.toContainText("auth-owner-A");
  } finally { release.resolve(); }
});

test("leaving the account page invalidates a pending login without storing its token", async ({ page }) => {
  await fixtures(page); const captured = gate(), release = gate();
  await page.route("**/v1/auth/login", async route => { captured.resolve(); await release.promise; await route.fulfill({ json: result() }); });
  try {
    await page.goto("/account"); await fill(page, "login");
    await page.getByLabel("Password", { exact: true }).press("Enter"); await captured.promise;
    await page.getByRole("link", { name: "Lessons", exact: true }).click();
    await expect(page).toHaveURL(/\/learn$/);
    const response = page.waitForResponse("**/v1/auth/login"); release.resolve(); await settled(page, await response);
    expect(await page.evaluate(() => localStorage.getItem("loccao_token"))).toBeNull();
    await page.goto("/account");
    await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
  } finally { release.resolve(); }
});

test("failed, invalid and storage-blocked authentication never claims a saved sign-in", async ({ page }) => {
  await fixtures(page); let attempts = 0;
  await page.route("**/v1/auth/login", route => {
    attempts++;
    if (attempts === 1) return route.fulfill({ status: 503, json: { error: "Sign-in is temporarily unavailable" } });
    if (attempts === 2) return route.fulfill({ json: { user: result().user } });
    return route.fulfill({ json: result() });
  });
  await page.goto("/account"); await fill(page, "login");
  await page.getByLabel("Password", { exact: true }).press("Enter");
  await expect(form(page)).toContainText("temporarily unavailable");
  await expect(page.getByLabel("Password", { exact: true })).toHaveValue("");
  await page.getByLabel("Password", { exact: true }).fill("SunlitTest123!"); await page.getByLabel("Password", { exact: true }).press("Enter");
  await expect(form(page)).toContainText("Sign-in could not be confirmed");
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) { if (key === "loccao_token") throw new Error("Fixture storage blocked"); return original.call(this, key, value); };
  });
  await page.getByLabel("Password", { exact: true }).fill("SunlitTest123!"); await page.getByLabel("Password", { exact: true }).press("Enter");
  await expect(form(page)).toContainText("browser could not save the sign-in");
  expect(await page.evaluate(() => localStorage.getItem("loccao_token"))).toBeNull();
  await expect(page.getByRole("link", { name: "Continue account adventure →", exact: true })).toHaveCount(0);
  expect(attempts).toBe(3);
});

test("real registration, sign-out and login still select the same account", async ({ page }) => {
  const email = `auth-intent-${randomUUID()}@example.test`;
  await page.goto("/account");
  await form(page).getByRole("button", { name: "Create account", exact: true }).click();
  await page.getByLabel("Display name", { exact: true }).fill("Auth intent learner");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill("SunlitTest123!");
  await form(page).locator('button[type="submit"], button:not([type])').filter({ hasText: "Create account" }).click();
  await expect(form(page)).toContainText("Signed in as Auth intent learner");
  const firstToken = await page.evaluate(() => localStorage.getItem("loccao_token")); expect(firstToken).toBeTruthy();
  await page.getByRole("button", { name: "Play as guest", exact: true }).click();
  expect(await page.evaluate(() => localStorage.getItem("loccao_token"))).toBeNull();
  await form(page).getByRole("button", { name: "Sign in", exact: true }).first().click();
  await page.getByLabel("Password", { exact: true }).fill("SunlitTest123!"); await page.getByLabel("Password", { exact: true }).press("Enter");
  await expect(form(page)).toContainText("Signed in as Auth intent learner");
  await page.reload(); await expect(form(page)).toContainText("Signed in as Auth intent learner");
});
