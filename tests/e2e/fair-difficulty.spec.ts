import { test, expect, type Locator, type Page } from "@playwright/test";
import { festivalGames } from "../../lib/game/festival";

async function click(page: Page, control: Locator) {
  await expect(control).toBeVisible({ timeout: 15000 });
  await expect(control).toBeEnabled();
  await control.evaluate(element => element.scrollIntoView({ block: "center", behavior: "instant" }));
  const box = (await control.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}
async function clock(page: Page) {
  await page.clock.install();
  await page.addInitScript(() => {
    window.requestAnimationFrame = callback => window.setTimeout(() => callback(performance.now()), 160);
    window.cancelAnimationFrame = handle => window.clearTimeout(handle);
  });
}
const pause = async (page: Page) => page.clock.pauseAt(new Date(await page.evaluate(() => Date.now()) + 10_000));

test("advanced planting and deliveries are achievable through actual 3D movement", async ({ page }) => {
  test.setTimeout(120000); await clock(page);
  for (const kind of ["little-garden", "parcel-trail"]) {
    await page.clock.resume(); await page.goto(`/festival/${kind}`);
    await page.getByRole("radio", { name: /Challenge/ }).check();
    await click(page, page.getByRole("button", { name: "Let’s play →" })); await pause(page);
    const destinations = page.getByRole("group", { name: "Playfield destinations" });
    const walk = async (name: string) => {
      await click(page, destinations.getByRole("button", { name, exact: true }));
      await page.clock.runFor(3000);
    };
    for (let round = 0; round < 3; round++) {
      await expect(page.locator(".fair-objective")).toContainText(`ROUND ${round + 1} / 3`);
      const order = await page.locator(".fair-objective > strong").innerText();
      if (kind === "little-garden") {
        const [, seed, water] = order.match(/Plant a (\w+), water it (\d)/)!;
        await walk(seed[0].toUpperCase() + seed.slice(1)); await walk("Garden bed");
        for (let i = 0; i < Number(water); i++) {
          await walk("Water");
          await expect(page.locator(".fair-challenge-status")).toContainText(`Planted · ${i + 1} waterings`);
        }
        await walk("Garden bed");
      } else {
        await walk("Post box");
        for (const clue of order.split("Deliver in order: ")[1].slice(0, -1).split(" → ")) {
          await walk(clue.includes("stories") ? "Library" : clue.includes("bread") ? "Bakery" : "Greenhouse");
        }
      }
    }
    await expect(page.getByRole("heading", { name: "A memory made together" })).toBeVisible();
    await expect(page.getByLabel("3 stars", { exact: true })).toBeVisible();
  }
});

test("Adventure is the default and an assisted cafe clear keeps its own durable stars", async ({ page }) => {
  test.setTimeout(120000); await clock(page);
  await page.goto("/festival/tea-time");
  await expect(page.getByRole("radio", { name: /Adventure/ })).toBeChecked();
  await click(page, page.getByRole("button", { name: "Let’s play →" })); await pause(page);
  for (let round = 0; round < 3; round++) {
    await expect(page.locator(".fair-objective")).toContainText(`ROUND ${round + 1} / 3`);
    const card = page.getByRole("region", { name: "Visiting friend's order" });
    await click(page, card.getByRole("button", { name: /Recipe card/ }));
    const recipe = await card.locator("p").innerText();
    const [from, to] = recipe.match(/[\d.]+(?=–)|[\d.]+(?= seconds)/g)!.map(Number);
    expect(to - from).toBeCloseTo(1);
    for (const ingredient of recipe.split(" · ")[0].split(" → ")) {
      await click(page, page.getByRole("group", { name: "Playfield choices" }).getByRole("button", { name: ingredient, exact: true }));
    }
    await click(page, page.getByRole("button", { name: "Start steeping", exact: true }));
    await page.clock.runFor((from + to) / 2 * 1000);
    await click(page, page.getByRole("button", { name: "Lift tea", exact: true }));
    await click(page, page.getByRole("button", { name: "Serve tea →", exact: true }));
    await page.clock.runFor(3100);
  }
  await expect(page.getByRole("heading", { name: "A memory made together" })).toBeVisible();
  await expect(page.getByLabel("1 stars", { exact: true })).toBeVisible();
  await expect(page.getByText("325 points", { exact: true })).toBeVisible();
  await expect(page.getByText("Friendship stamp and best score saved on this device.")).toBeVisible();
  await page.clock.resume(); await page.reload();
  const levels = page.getByRole("group", { name: "Choose your challenge" });
  await expect(levels.locator("label").filter({ hasText: "Adventure" })).toContainText("★ · 1 clears");
  await expect(levels.locator("label").filter({ hasText: "Challenge" })).toContainText("Not yet cleared");
  await expect(levels.locator("label").filter({ hasText: "Practice" })).toContainText("Not yet cleared");
  expect(await page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith("loccao.fair.v2.guest.run.")).length)).toBe(1);
});

test("Challenge memory, assistance and countdown resume together without changing the rules", async ({ page }) => {
  test.setTimeout(90000); await clock(page); await page.goto("/festival/little-garden");
  await page.getByRole("radio", { name: /Challenge/ }).check();
  await click(page, page.getByRole("button", { name: "Let’s play →" })); await pause(page);
  const prompt = page.locator(".fair-objective > strong"), order = await prompt.innerText();
  await page.clock.runFor(8000); await expect(prompt).toContainText("Remember your order");
  await click(page, page.getByRole("button", { name: "Recall order (−1★)", exact: true }));
  await expect(prompt).toHaveText(order);
  await click(page, page.getByRole("button", { name: "Pause game", exact: true }));
  const status = page.locator(".fair-challenge-status"), before = await status.innerText();
  await page.clock.runFor(5000); expect(await status.innerText()).toBe(before);
  await page.clock.resume(); await page.reload();
  await expect(page.getByText(/Saved at round 1 · 3 hearts · Challenge/)).toBeVisible();
  // Selecting a different level affects a new run, never the saved run.
  await page.getByRole("radio", { name: /Practice/ }).check(); await pause(page);
  await click(page, page.getByRole("button", { name: "Continue saved game →" }));
  expect(await status.innerText()).toBe(before); await expect(prompt).toHaveText(order);
  await expect(status).toContainText("1 assistance · up to 2★");
  await page.clock.runFor(28000);
  await expect(page.getByLabel("2 hearts", { exact: true })).toBeVisible();
  await expect(status).toContainText("Challenge");
  await expect(page.getByText("Time ran out. This round has reset; plan your next attempt.", { exact: true })).toBeVisible();
});

test("all Challenge playfields keep their controls reachable on a short phone screen", async ({ page }, testInfo) => {
  test.setTimeout(150000); await page.setViewportSize({ width: 390, height: 551 }); await clock(page);
  for (const game of festivalGames) {
    await page.clock.resume(); await page.goto(`/festival/${game.id}`);
    await page.getByRole("radio", { name: /Challenge/ }).check();
    await click(page, page.getByRole("button", { name: "Let’s play →" })); await pause(page);
    await page.clock.runFor(320);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const labels = page.locator(".fair-object-label");
    await expect(labels.first()).toBeVisible();
    const boxes = await labels.evaluateAll(elements => elements.map(element => {
      const r = element.getBoundingClientRect();
      return { x:r.x, y:r.y, width:r.width, height:r.height, font:parseFloat(getComputedStyle(element).fontSize) };
    }));
    for (const box of boxes) {
      expect(box.width).toBeGreaterThanOrEqual(38); expect(box.height).toBeGreaterThanOrEqual(38); expect(box.font).toBeGreaterThanOrEqual(16);
      expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(391);
      expect(box.y).toBeGreaterThanOrEqual(0); expect(box.y + box.height).toBeLessThanOrEqual(552);
      for (const other of boxes) if (box !== other) expect(box.x + box.width <= other.x + 1 || other.x + other.width <= box.x + 1 || box.y + box.height <= other.y + 1 || other.y + other.height <= box.y + 1, `${game.name}: overlapping labels`).toBe(true);
    }
    if (game.kind === "tea") await page.screenshot({ path: testInfo.outputPath("challenge-cafe-mobile.png") });
  }
});
