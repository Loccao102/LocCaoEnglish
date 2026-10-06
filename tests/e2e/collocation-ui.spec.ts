import { test, expect } from "@playwright/test";
import type { LearningAttempt, LearningAttemptResult } from "../../lib/learning-attempt";

// UI fault fixtures only. Real API/account coverage lives in collocation.spec.ts
// and learning-recovery.spec.ts.
for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 551 }, { width: 390, height: 844 }]) {
  test(`Collocation pending choice and old snapshot remain usable at ${viewport.width}x${viewport.height}`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    const attempt: LearningAttempt = {
      attemptId: "c".repeat(32), activity: "collocation-factory", itemKey: "old-snapshot", cefrLevel: "A1", pack: "cefr-core",
      contentVersion: "2026-09-28.1", rulesVersion: "collocation-factory.v1", status: "active", mode: "guest",
      expiresAt: "2099-01-01T00:00:00Z", prompt: { word: "have", options: ["breakfast", "dinner", "lunch", "dessert"] },
    };
    const result: LearningAttemptResult = {
      attemptId: attempt.attemptId, status: "completed", correct: false, actualAnswer: "dinner", correctAnswer: "breakfast",
      feedback: "Have breakfast describes the morning meal.", xpDelta: 0, newConfidence: 0, level: 0,
      reviewAdded: false, progressionApplied: false, evidence: "server-objective", contentVersion: attempt.contentVersion, rulesVersion: attempt.rulesVersion,
    };
    await page.route("**/v1/learning/attempts", route => route.fulfill({ json: attempt }));
    await page.route(`**/v1/learning/attempts/${attempt.attemptId}`, route => route.fulfill({ json: attempt }));
    const submitted: unknown[] = [];
    await page.route("**/v1/learning/attempts/*/submit", async route => {
      submitted.push(route.request().postDataJSON());
      if (submitted.length === 1) await route.abort("failed");
      else await route.fulfill({ json: result });
    });
    await page.goto("/games/collocation-factory");
    const card = page.getByRole("region", { name: "Collocation practice" });
    await expect(card.getByRole("heading", { name: "Choose the natural word pair." })).toBeVisible();
    const choices = card.locator(".factory-options button");
    for (const choice of await choices.all()) {
      const dimensions = await choice.evaluate(el => ({ font: parseFloat(getComputedStyle(el).fontSize), height: el.getBoundingClientRect().height }));
      expect(dimensions.font).toBeGreaterThanOrEqual(16);
      expect(dimensions.height).toBeGreaterThanOrEqual(44);
    }
    await card.getByRole("button", { name: "dinner", exact: true }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("button", { name: "Retry same answer" })).toBeVisible();
    await expect(page.getByLabel("Collocation CEFR level")).toBeDisabled();
    await page.reload();
    await expect(card.locator(".factory-options button:enabled")).toHaveCount(0);
    await page.getByRole("button", { name: "Retry same answer" }).click();
    await expect(card.getByText("Your choice: dinner", { exact: true })).toBeVisible();
    await expect(card.getByText("have breakfast", { exact: true })).toBeVisible();
    expect(submitted).toHaveLength(2);
    expect(submitted[0]).toEqual(submitted[1]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath("collocation.png"), fullPage: true });
  });
}
