import { test, expect } from "@playwright/test";

// Browser fault-injection tests. These do not replace the real API flows in word-link.spec.ts.
const attempt = {
  id: "a".repeat(32), contentId: "word-link:default:significant", contentVersion: 1, rulesVersion: 1,
  pack: "default", label: "CORE ENGLISH", round: 0, total: 5, word: "significant",
  prompt: "Choose the closest synonym", choices: [{ id: "b".repeat(32), label: "substantial" }, { id: "c".repeat(32), label: "minor" }],
  mode: "guest", expiresAt: "2099-01-01T00:00:00Z",
};
test("connection failure retries the same creation request; mobile choices remain readable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const ids: string[] = [];
  await page.route("**/v1/learning/word-link/attempts", async route => {
    ids.push(route.request().postDataJSON().requestId);
    if (ids.length === 1) await route.abort("failed");
    else await route.fulfill({ json: attempt });
  });
  await page.goto("/games/word-link");
  await page.getByRole("button", { name: "Retry connection" }).click();
  await expect(page.getByRole("button", { name: "substantial" })).toBeEnabled();
  expect(ids).toHaveLength(2);
  expect(ids[0]).toBe(ids[1]);
  await expect(page.getByText("Connection found ✓", { exact: true })).toHaveCount(0);
  const box = await page.getByRole("button", { name: "substantial" }).boundingBox();
  expect(box!.width).toBeGreaterThan(100);
  expect(box!.x + box!.width).toBeLessThanOrEqual(390);
  await page.screenshot({ path: ".cache/word-link-mobile.png", fullPage: true });
});

test("failed submit retains a locked choice across reload and retries identical payload", async ({ page }) => {
  await page.route("**/v1/learning/word-link/attempts", route => route.fulfill({ json: attempt }));
  await page.route(`**/v1/learning/word-link/attempts/${attempt.id}`, route => route.fulfill({ json: attempt }));
  const payloads: object[] = [];
  await page.route("**/v1/learning/word-link/attempts/*/submit", async route => {
    payloads.push(route.request().postDataJSON());
    if (payloads.length === 1) await route.abort("failed");
    else await route.fulfill({ json: { correct: true, actualAnswer: "substantial", correctAnswer: "substantial", note: "Correct connection.", xpDelta: 0, reviewAdded: false, progressionApplied: false, evidence: "server-objective", assisted: false, submittedAt: new Date().toISOString() } });
  });
  await page.goto("/games/word-link");
  await page.getByRole("button", { name: "substantial" }).click();
  await expect(page.getByRole("button", { name: "Retry same answer" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "minor" })).toBeDisabled();
  await page.getByRole("button", { name: "Retry same answer" }).click();
  await expect(page.getByText("Connection found ✓", { exact: true })).toBeVisible();
  expect(payloads).toHaveLength(2);
  expect(payloads[0]).toEqual(payloads[1]);
});
