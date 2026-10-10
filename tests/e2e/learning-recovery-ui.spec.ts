import { test, expect } from "@playwright/test";

// Fault-injection UI fixtures; separate from real API coverage in learning-recovery.spec.ts.
const attempt = {
  attemptId: "a".repeat(32), activity: "word-link", itemKey: "happy", cefrLevel: "A1", pack: "cefr-core",
  contentVersion: "test.v1", rulesVersion: "word-link.v1", status: "active", mode: "guest", expiresAt: "2099-01-01T00:00:00Z",
  prompt: { word: "happy", relation: "Choose the synonym", options: ["glad", "sad", "slow", "far"] },
};
const result = { attemptId: attempt.attemptId, status: "completed", correct: true, actualAnswer: "glad", correctAnswer: "glad", feedback: "Happy means glad.", xpDelta: 0, newConfidence: 0, level: 0, reviewAdded: false, progressionApplied: false, evidence: "server-objective", contentVersion: attempt.contentVersion, rulesVersion: attempt.rulesVersion };

test("creation failure keeps request identity and mobile options are readable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const requests: object[] = [];
  await page.route("**/v1/learning/attempts", async route => {
    requests.push(route.request().postDataJSON());
    if (requests.length === 1) await route.abort("failed"); else await route.fulfill({ json: attempt });
  });
  await page.goto("/games/word-link");
  await expect(page.getByRole("button", { name: "Retry same request", exact: true })).toBeVisible();
  await expect(page.getByRole("combobox")).toBeDisabled();
  await page.getByRole("button", { name: "Retry same request", exact: true }).click();
  await expect(page.getByRole("button", { name: "glad" })).toBeEnabled();
  expect(requests).toHaveLength(2); expect(requests[0]).toEqual(requests[1]);
  const box = await page.getByRole("button", { name: "glad" }).boundingBox();
  expect(box!.width).toBeGreaterThan(100); expect(box!.x + box!.width).toBeLessThanOrEqual(390);
  await page.screenshot({ path: ".cache/learning-mobile.png", fullPage: true });
});

test("submit failure retains locked choice after reload and resends exactly once", async ({ page }) => {
  await page.route("**/v1/learning/attempts", route => route.fulfill({ json: attempt }));
  await page.route(`**/v1/learning/attempts/${attempt.attemptId}`, route => route.fulfill({ json: attempt }));
  const payloads: object[] = [];
  await page.route("**/v1/learning/attempts/*/submit", async route => {
    payloads.push(route.request().postDataJSON());
    if (payloads.length === 1) await route.abort("failed"); else await route.fulfill({ json: result });
  });
  await page.goto("/games/word-link");
  await page.getByRole("button", { name: "glad" }).click();
  await expect(page.getByRole("button", { name: "Retry same answer" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "sad" })).toBeDisabled();
  await page.getByRole("button", { name: "Retry same answer" }).click();
  await expect(page.getByText("Connection verified ✓", { exact: true })).toBeVisible();
  expect(payloads).toHaveLength(2); expect(payloads[0]).toEqual(payloads[1]);
});

test("expired saved round offers recovery and level change survives reload", async ({ page }) => {
  let issued = { ...attempt, expiresAt: "2000-01-01T00:00:00Z" }, count = 0;
  await page.route("**/v1/learning/attempts", async route => {
    const input = route.request().postDataJSON();
    if (count++) issued = { ...attempt, cefrLevel: input.cefrLevel };
    await route.fulfill({ json: issued });
  });
  await page.route(`**/v1/learning/attempts/${attempt.attemptId}`, route => route.fulfill({ json: issued }));
  await page.goto("/games/word-link");
  await page.getByRole("button", { name: "Start a new round" }).click();
  await expect(page.getByRole("button", { name: "glad" })).toBeEnabled();
  await page.getByLabel("CEFR level", { exact: true }).selectOption("C2");
  await expect(page.getByText("C2 · Choose the synonym", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("CEFR level", { exact: true })).toHaveValue("C2");
  await expect(page.getByRole("button", { name: "glad" })).toBeEnabled();
});
