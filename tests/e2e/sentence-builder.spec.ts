import { test, expect, type Page } from "@playwright/test";
import type { LearningAttempt } from "../../lib/learning-attempt";
import catalog from "../../backend/internal/learning/sentence_catalog.json";

const issued = (page: Page) => page.waitForResponse(r => r.url().endsWith("/v1/learning/attempts") && r.request().method() === "POST");
function orderedIDs(a: LearningAttempt) {
  const available = [...a.prompt.chunks!];
  return catalog.items.find(i => i.id === a.itemKey)!.chunks.map(text => {
    const index = available.findIndex(c => c.text === text);
    return available.splice(index, 1)[0].id;
  });
}

test("Sentence campaign preserves a draft, grades actual order and completes three distinct rounds", async ({ page }, testInfo) => {
  let opened = issued(page);
  await page.goto("/games/sentence-builder?pack=work-standup");
  let a: LearningAttempt = await (await opened).json();
  const card = page.getByRole("region", { name: "Sentence practice" });
  const bank = card.getByRole("group", { name: "Available pieces" });
  const seen = new Set<string>();
  for (let n = 0; n < 3; n++) {
    expect(seen.has(a.itemKey)).toBe(false); seen.add(a.itemKey);
    const ids = orderedIDs(a);
    if (n === 0) ids.reverse();
    await bank.locator(`[data-chunk-id="${ids[0]}"]`).click();
    if (n === 0) {
      await expect(card.getByRole("button", { name: "Check sentence" })).toBeDisabled();
      await page.reload();
      await expect(card.getByRole("group", { name: "Your sentence" }).getByRole("button")).toHaveCount(1);
      await expect(bank.locator(`[data-chunk-id="${ids[0]}"]`)).toBeDisabled();
      await card.getByRole("button", { name: "Undo", exact: true }).click();
      await expect(bank.locator(`[data-chunk-id="${ids[0]}"]`)).toBeEnabled();
      await bank.locator(`[data-chunk-id="${ids[0]}"]`).click();
    }
    for (const id of ids.slice(1)) await bank.locator(`[data-chunk-id="${id}"]`).click();
    const submitted = page.waitForResponse(r => r.url().endsWith(`/${a.attemptId}/submit`));
    await card.getByRole("button", { name: "Check sentence" }).click();
    const verdict = await (await submitted).json();
    expect(verdict.correct).toBe(n !== 0);
    expect(verdict.actualAnswer).toBe(ids.map(id => a.prompt.chunks!.find(c => c.id === id)!.text).join(" "));
    await expect(card.getByText(n === 0 ? "Review this sentence" : "✓ Sentence complete", { exact: true })).toBeVisible();
    await expect(card.getByRole("button", { name: "Reset", exact: true })).toHaveCount(0);
    await expect(card.getByRole("button", { name: "Check sentence" })).toHaveCount(0);
    if (n === 0) {
      await page.reload();
      await expect(card.getByText(`Your sentence: ${verdict.actualAnswer}`, { exact: true })).toBeVisible();
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: testInfo.outputPath("sentence-desktop.png"), fullPage: true });
    }
    if (n === 2) await expect(card.getByText("Set complete. Ready for another three?")).toBeVisible();
    opened = issued(page);
    await card.getByRole("button", { name: n === 2 ? "Play another set" : "Next sentence →" }).click();
    a = await (await opened).json();
  }
  await expect(card.getByText("Round 1/3", { exact: true })).toBeVisible();
});

for (const height of [551, 844]) {
  test(`Sentence repeated pieces, keyboard and CEFR work on 390x${height}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height });
    const opened = issued(page);
    await page.goto("/games/sentence-builder");
    let a: LearningAttempt = await (await opened).json();
    const card = page.getByRole("region", { name: "Sentence practice" });
    // The three-question A1 bank guarantees reaching the repeated article item.
    for (let n = 0; n < 3; n++) {
      const ids = orderedIDs(a);
      for (const id of ids) {
        const choice = card.locator(`[data-chunk-id="${id}"]`);
        const metrics = await choice.evaluate(el => ({ font: parseFloat(getComputedStyle(el).fontSize), height: el.getBoundingClientRect().height }));
        expect(metrics.font).toBeGreaterThanOrEqual(16); expect(metrics.height).toBeGreaterThanOrEqual(44);
        await choice.focus(); await page.keyboard.press("Enter");
      }
      if (a.itemKey === "sentence-a1-3") {
        await expect(card.getByRole("group", { name: "Your sentence" }).getByRole("button", { name: /: a$/ })).toHaveCount(2);
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.screenshot({ path: testInfo.outputPath("sentence-mobile.png"), fullPage: true });
      }
      await card.getByRole("button", { name: "Check sentence" }).click();
      await expect(card.getByText("✓ Sentence complete", { exact: true })).toBeVisible();
      if (a.itemKey === "sentence-a1-3") break;
      const next = issued(page); await card.getByRole("button", { name: "Next sentence →" }).click(); a = await (await next).json();
    }
    expect(a.itemKey).toBe("sentence-a1-3");
    const level = page.getByLabel("Sentence CEFR level");
    await level.selectOption("C2");
    await expect(card.getByRole("group", { name: "Available pieces" }).getByRole("button").first()).toBeEnabled();
    await page.reload(); await expect(level).toHaveValue("C2");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test("Sentence pending order is locked across reload and retried unchanged", async ({ page }) => {
  const opened = issued(page);
  await page.goto("/games/sentence-builder");
  const a: LearningAttempt = await (await opened).json();
  const card = page.getByRole("region", { name: "Sentence practice" });
  for (const id of orderedIDs(a)) await card.locator(`[data-chunk-id="${id}"]`).click();
  let payload: unknown;
  await page.route("**/v1/learning/attempts/*/submit", async route => {
    payload = route.request().postDataJSON(); await route.abort("failed");
  }, { times: 1 });
  await card.getByRole("button", { name: "Check sentence" }).click();
  await expect(page.getByRole("button", { name: "Retry same answer" })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Sentence CEFR level")).toBeDisabled();
  await expect(card.getByRole("button", { name: "Reset", exact: true })).toBeDisabled();
  await expect(card.getByRole("group", { name: "Your sentence" }).locator("button:enabled")).toHaveCount(0);
  const retry = page.waitForRequest(r => r.url().endsWith(`/${a.attemptId}/submit`));
  await page.getByRole("button", { name: "Retry same answer" }).click();
  expect((await retry).postDataJSON()).toEqual(payload);
  await expect(card.getByText("✓ Sentence complete", { exact: true })).toBeVisible();
});
