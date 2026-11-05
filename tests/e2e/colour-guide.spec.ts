import { expect, test, type Locator, type Page } from "@playwright/test";

async function click(page: Page, control: Locator) {
  await expect(control).toBeVisible();
  await expect(control).toBeEnabled();
  await control.evaluate(el => el.scrollIntoView({ block: "center", behavior: "instant" }));
  const box = (await control.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}
async function setup(page: Page, mode: string) {
  await page.clock.install();
  await page.addInitScript(() => {
    window.requestAnimationFrame = callback => window.setTimeout(() => callback(performance.now()), 160);
    window.cancelAnimationFrame = handle => window.clearTimeout(handle);
  });
  await page.goto("/festival/colour-studio");
  await page.getByRole("radio", { name: new RegExp(mode) }).check();
  await expect(page.getByRole("dialog")).toContainText(mode === "Practice" ? "Choose two paint pots" : mode === "Adventure" ? "Measure three paint drops" : "Balance four drops");
  await click(page, page.getByRole("button", { name: "Let’s play →" }));
  await page.clock.pauseAt(new Date(await page.evaluate(() => Date.now()) + 10_000));
}
async function paint(page: Page, names: string[]) {
  for (const name of names) await click(page, page.getByRole("group", { name: "Playfield choices" }).getByRole("button", { name, exact: true }));
  await click(page, page.getByRole("button", { name: "Mix paint →", exact: true }));
  await page.clock.runFor(3100);
}

for (const [mode, drops] of [["Adventure", 3], ["Challenge", 4]] as const) {
  test(`${mode} paint ratios teach parts, pause safely and keep assisted recipes across reload`, async ({ page }) => {
    test.setTimeout(120_000);
    await setup(page, mode);
    const status = page.getByLabel("Challenge rules"), hint = page.getByRole("button", { name: "Recipe (−1★)", exact: true });
    const before = await status.innerText();
    await click(page, page.getByRole("button", { name: "? How to play", exact: true }));
    const guide = page.getByRole("region", { name: "Paint mixing guide" });
    await expect(guide).toContainText(`${drops} drops in total`);
    await expect(guide).toContainText("Red : Yellow = 1 : 2");
    await expect(guide).toContainText("Red : Yellow = 2 : 1");
    await expect(guide).toContainText("not the recipe for your current target");
    await expect(page.getByLabel("Target paint recipe")).toHaveCount(0);
    await page.clock.runFor(5000);
    expect(await status.innerText()).toBe(before);
    for (const height of [551, 844]) {
      await page.setViewportSize({ width: 390, height });
      await guide.getByRole("heading").scrollIntoViewIfNeeded();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      expect(await guide.locator("p").first().evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
      await page.screenshot({ path: `.cache/colour-guide-${mode}-${height}.png` });
      const resume = page.getByRole("button", { name: "Resume game →", exact: true });
      await resume.scrollIntoViewIfNeeded();
      const box = (await resume.boundingBox())!;
      expect(box.y).toBeGreaterThanOrEqual(0); expect(box.y + box.height).toBeLessThanOrEqual(height);
      await page.screenshot({ path: `.cache/colour-guide-actions-${mode}-${height}.png` });
    }
    await click(page, page.getByRole("button", { name: "Resume game →", exact: true }));
    await expect(status).toContainText("Unassisted");
    for (let round = 0; round < 4; round++) {
      await expect(page.locator(".fair-objective")).toContainText(`ROUND ${round + 1} / 4`);
      await click(page, hint);
      const recipe = page.getByLabel("Target paint recipe");
      const text = await recipe.innerText();
      const parts = [...text.matchAll(/(\d+) (Red|Yellow|Blue|White)/g)];
      const choices = parts.flatMap(part => Array<string>(Number(part[1])).fill(part[2]));
      expect(choices).toHaveLength(drops);
      await expect(status).toContainText(`${round + 1} assistance`);
      await expect(page.getByRole("button", { name: "Hint opened", exact: true })).toBeDisabled();
      if (round === 0) {
        await click(page, page.getByRole("button", { name: "Pause game", exact: true }));
        const saved = await status.innerText();
        await page.clock.resume(); await page.reload();
        await expect(page.getByText(new RegExp(`Saved at round 1 · 3 hearts · ${mode}`))).toBeVisible();
        await page.clock.pauseAt(new Date(await page.evaluate(() => Date.now()) + 10_000));
        await click(page, page.getByRole("button", { name: "Continue saved game →", exact: true }));
        await expect(recipe).toHaveText(text);
        expect(await status.innerText()).toBe(saved);
      }
      // Paint order is irrelevant; reverse the recipe to exercise equal-part counts.
      await paint(page, choices.reverse());
    }
    await expect(page.getByRole("heading", { name: "A memory made together" })).toBeVisible();
    await expect(page.getByLabel("1 stars", { exact: true })).toBeVisible();
    await expect(page.getByText("425 points", { exact: true })).toBeVisible();
  });
}

test("Practice paint help keeps the two-drop recipes and full-heart result", async ({ page }) => {
  test.setTimeout(90_000);
  await setup(page, "Practice");
  await click(page, page.getByRole("button", { name: "? How to play", exact: true }));
  await expect(page.getByRole("region", { name: "Paint mixing guide" })).toContainText("2 drops in total");
  await expect(page.getByLabel("Challenge rules")).toHaveCount(0);
  await click(page, page.getByRole("button", { name: "Resume game →", exact: true }));
  for (const pair of [["Red", "Yellow"], ["Yellow", "Blue"], ["Red", "Blue"], ["Red", "White"]]) await paint(page, pair);
  await expect(page.getByRole("heading", { name: "A memory made together" })).toBeVisible();
  await expect(page.getByLabel("3 stars", { exact: true })).toBeVisible();
  await expect(page.getByText("475 points", { exact: true })).toBeVisible();
});
