import { test, expect, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";

async function labelWrites(page: Page, milliseconds = 250) {
  return page.locator(".fair-label-layer").evaluate((layer, duration) => new Promise<number>(resolve => {
    let writes = 0;
    const observer = new MutationObserver(records => { writes += records.length; });
    observer.observe(layer, { attributes: true, subtree: true });
    window.setTimeout(() => { observer.disconnect(); resolve(writes); }, duration);
  }), milliseconds);
}

for (const mode of ["Adventure", "Challenge"]) test(`static ${mode} labels avoid repeated DOM writes while timers and input remain live`, async ({ page }, testInfo) => {
  await page.goto("/festival/colour-studio");
  await page.getByRole("radio", { name: new RegExp(mode) }).check();
  await page.getByRole("button", { name: "Let’s play →" }).click();
  const choices = page.getByRole("group", { name: "Playfield choices" });
  const red = choices.getByRole("button", { name: "Red", exact: true });
  await expect(red).toBeEnabled();
  await page.getByRole("button", { name: "Pause game", exact: true }).click();
  // Let the overlay/resize settle before observing only label attributes.
  await page.waitForTimeout(100);
  const pausedWrites = await labelWrites(page);
  expect(pausedWrites, "unchanged paused labels should not be rewritten every animation frame").toBe(0);
  await page.setViewportSize({ width: 390, height: 551 });
  await expect.poll(() => page.locator(".fair-object-label").evaluateAll(elements => elements.every(element => {
    const box = element.getBoundingClientRect();
    return box.left >= 0 && box.right <= innerWidth && box.top >= 0 && box.bottom <= innerHeight;
  }))).toBe(true);
  await page.getByRole("button", { name: /Continue playing|Resume game|Resume/ }).click();
  await expect(red).toBeEnabled();
  await red.click();
  await expect(red).toHaveAttribute("aria-pressed", "true");
  const runningWrites = await labelWrites(page);
  expect(runningWrites, "a live countdown alone should not relayout stationary labels").toBe(0);
  const remaining = async () => Number((await page.locator(".fair-challenge-status").innerText()).match(/(\d+)s/)![1]);
  const before = await remaining();
  await expect.poll(remaining).toBeLessThan(before);
  const measurement = JSON.stringify({ mode, sampleMs: 250, pausedWrites, runningWrites });
  await testInfo.attach("label-mutations", { body: measurement, contentType: "application/json" });
  await mkdir(".cache", { recursive: true });
  await writeFile(`.cache/fair-label-cost-${mode}.json`, measurement);
});

test("moving Challenge targets still update projected label positions", async ({ page }) => {
  await page.goto("/festival/bubble-meadow");
  await page.getByRole("radio", { name: /Challenge/ }).check();
  await page.getByRole("button", { name: "Let’s play →" }).click();
  await expect(page.locator(".fair-object-label").first()).toBeEnabled();
  const before = await page.locator(".fair-object-label").evaluateAll(elements => elements.map(element => {
    const box = element.getBoundingClientRect(); return { left: box.left, top: box.top };
  }));
  expect(await labelWrites(page), "moving targets must invalidate the cached label projection").toBeGreaterThan(0);
  await expect.poll(() => page.locator(".fair-object-label").evaluateAll((elements, positions) => elements.some((element, index) => {
    const box = element.getBoundingClientRect(), old = positions[index];
    return old && Math.hypot(box.left - old.left, box.top - old.top) > 0.1;
  }), before)).toBe(true);
});
