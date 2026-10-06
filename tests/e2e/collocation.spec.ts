import { test, expect } from "@playwright/test";
import type { LearningAttempt } from "../../lib/learning-attempt";
import catalog from "../../backend/internal/learning/collocation_catalog.json";

test("Collocation campaign completes three different scenarios and restores feedback", async ({ page }) => {
  const issued = () => page.waitForResponse(r => r.url().endsWith("/v1/learning/attempts") && r.request().method() === "POST");
  let opened = issued();
  await page.goto("/games/collocation-factory?pack=work-standup");
  let attempt: LearningAttempt = await (await opened).json();
  const seen = new Set<string>();
  const card = page.getByRole("region", { name: "Collocation practice" });
  for (let round = 0; round < 3; round++) {
    expect(seen.has(attempt.itemKey)).toBe(false);
    seen.add(attempt.itemKey);
    const item = catalog.items.find(i => i.id === attempt.itemKey)!;
    await expect(card.getByRole("heading", { name: item.question, exact: true })).toBeVisible();
    await expect(card.getByText(`Round ${round + 1}/3`, { exact: true })).toBeVisible();
    const answer = round === 0 ? attempt.prompt.options.find(o => o !== item.correctAnswer)! : item.correctAnswer;
    await card.getByRole("button", { name: answer, exact: true }).click();
    await expect(card.getByText(round === 0 ? "Review this collocation" : "✓ Natural pair", { exact: true })).toBeVisible();
    await expect(card.getByText(item.feedback, { exact: true })).toBeVisible();
    await expect(card.locator(".factory-options button:enabled")).toHaveCount(0);
    if (round === 0) {
      await page.reload();
      await expect(card.getByText(`Your choice: ${answer}`, { exact: true })).toBeVisible();
      await expect(card.getByText("Round 1/3", { exact: true })).toBeVisible();
    }
    if (round === 2) await expect(card.getByText("Set complete. Ready for another three?")).toBeVisible();
    opened = issued();
    await card.getByRole("button", { name: round === 2 ? "Play another set" : "Next collocation →", exact: true }).click();
    attempt = await (await opened).json();
  }
  await expect(card.getByText("Round 1/3", { exact: true })).toBeVisible();
  await expect(card.getByText(/Guest practice · no account XP/)).toBeVisible();
});

for (const height of [551, 844]) {
  test(`Collocation choices remain readable and usable on 390x${height}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height });
    await page.goto("/games/collocation-factory");
    const card = page.getByRole("region", { name: "Collocation practice" });
    const level = page.getByLabel("Collocation CEFR level");
    await expect(level).toBeEnabled();
    await level.selectOption("C2");
    const choices = card.locator(".factory-options button");
    await expect(choices).toHaveCount(4);
    await expect(level).toHaveValue("C2");
    await expect(choices.first()).toBeEnabled();
    for (const choice of await choices.all()) {
      const metrics = await choice.evaluate(el => ({ font: parseFloat(getComputedStyle(el).fontSize), height: el.getBoundingClientRect().height }));
      expect(metrics.font).toBeGreaterThanOrEqual(16);
      expect(metrics.height).toBeGreaterThanOrEqual(44);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await choices.first().focus();
    await page.keyboard.press("Enter");
    await expect(card.getByRole("button", { name: "Next collocation →" })).toBeVisible();
    await page.reload();
    await expect(level).toHaveValue("C2");
    await expect(card.locator(".mini-feedback-box")).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`collocation-${height}.png`), fullPage: true });
    await card.getByRole("button", { name: "Next collocation →" }).click();
    await expect(card.getByText("Round 2/3", { exact: true })).toBeVisible();
  });
}
