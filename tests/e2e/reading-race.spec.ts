import { test, expect, type Page } from "@playwright/test";
import type { LearningAttempt } from "../../lib/learning-attempt";
import readings from "../../backend/internal/learning/reading_catalog.json";

const issued = (page: Page) => page.waitForResponse(r => r.url().endsWith("/v1/learning/attempts") && r.request().method() === "POST");
const itemFor = (a: LearningAttempt) => readings.items.find(item => item.id === a.itemKey)!;

test("Reading sets offer three distinct passages at each level and reveal explanations only after grading", async ({ page }, testInfo) => {
  let opened = issued(page);
  await page.goto("/reading");
  let a: LearningAttempt = await (await opened).json();
  const card = page.getByRole("region", { name: "Reading practice" });
  const level = card.getByRole("combobox", { name: "Reading level" });
  await expect(level.locator("option")).toHaveText(["A2", "B1", "B2"]);
  for (const target of ["B1", "A2", "B2"]) {
    if (a.cefrLevel !== target) {
      opened = issued(page); await level.selectOption(target); a = await (await opened).json();
    }
    const seen = new Set<string>();
    for (let n = 0; n < 3; n++) {
      expect(a.cefrLevel).toBe(target);
      expect(seen.has(a.itemKey)).toBe(false); seen.add(a.itemKey);
      const item = itemFor(a);
      expect(Object.keys(a.prompt).sort()).toEqual(["options", "passage", "question", "title"]);
      expect(a).not.toHaveProperty("result");
      await expect(card.getByRole("article")).toContainText(item.passage);
      await expect(card.getByText(item.feedback, { exact: false })).toHaveCount(0);
      expect(await page.content()).not.toContain(item.feedback);
      if (target === "B1" && n === 0) await page.screenshot({ path: testInfo.outputPath("reading-desktop.png"), fullPage: true });
      await card.getByRole("button", { name: item.correctAnswer, exact: true }).click();
      await expect(card.getByText("✓ Reading verified", { exact: true })).toBeVisible();
      await expect(card.getByRole("status")).toContainText(item.feedback);
      await expect(card.getByRole("status")).toContainText(item.evidence);
      if (n < 2) {
        opened = issued(page); await card.getByRole("button", { name: "Next passage →" }).click(); a = await (await opened).json();
      }
    }
    await expect(card.getByText("Set complete. Try another level or practise again.")).toBeVisible();
  }
  await page.reload();
  await expect(level).toHaveValue("B2");
  await expect(card.getByText("Round 3/3", { exact: true })).toBeVisible();
  opened = issued(page); await card.getByRole("button", { name: "Play another set" }).click();
  expect((await (await opened).json()).cefrLevel).toBe("B2");
  await expect(card.getByText("Round 1/3", { exact: true })).toBeVisible();
});

test("Reading retains the exact pending answer and wrong feedback through reload", async ({ page }) => {
  const opened = issued(page);
  await page.goto("/reading");
  const a: LearningAttempt = await (await opened).json(), item = itemFor(a);
  const card = page.getByRole("region", { name: "Reading practice" });
  const wrong = a.prompt.options.find(o => o !== item.correctAnswer)!;
  let payload: unknown;
  await page.route("**/v1/learning/attempts/*/submit", async route => { payload = route.request().postDataJSON(); await route.abort("failed"); }, { times: 1 });
  await card.getByRole("button", { name: wrong, exact: true }).click();
  await expect(card.getByRole("button", { name: "Retry same answer" })).toBeVisible();
  await page.reload();
  await expect(card.getByRole("group").locator("button:enabled")).toHaveCount(0);
  await expect(card.getByRole("combobox")).toBeDisabled();
  await expect(card.getByRole("article")).toContainText(a.prompt.passage!);
  const retried = page.waitForRequest(r => r.url().endsWith(`/${a.attemptId}/submit`));
  await card.getByRole("button", { name: "Retry same answer" }).click();
  expect((await retried).postDataJSON()).toEqual(payload);
  await expect(card.getByText("Follow the evidence", { exact: true })).toBeVisible();
  await page.reload();
  await expect(card.getByRole("status")).toContainText(`Your choice: ${wrong}`);
  await expect(card.getByRole("status")).toContainText(item.feedback);
  await expect(card.getByRole("group").locator("button:enabled")).toHaveCount(0);
});

for (const height of [551, 844]) {
  test(`Reading remains legible and keyboard playable at 390x${height}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height });
    const opened = issued(page);
    await page.goto("/reading");
    const a: LearningAttempt = await (await opened).json();
    const card = page.getByRole("region", { name: "Reading practice" });
    const choices = card.getByRole("group").getByRole("button");
    await expect(choices).toHaveCount(4);
    expect(await card.getByRole("article").locator("p").evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(18);
    for (const choice of await choices.all()) {
      expect((await choice.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      expect(await choice.evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath("reading-mobile.png"), fullPage: true });
    await card.getByRole("button", { name: itemFor(a).correctAnswer, exact: true }).focus();
    await page.keyboard.press("Enter");
    await expect(card.getByText("✓ Reading verified", { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: testInfo.outputPath("reading-feedback-mobile.png"), fullPage: true });
  });
}
