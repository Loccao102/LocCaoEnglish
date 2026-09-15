import { test, expect } from "@playwright/test";
import { festivalGames } from "../../lib/game/festival";

test.setTimeout(120000);

for (const size of [{ width: 460, height: 551 }, { width: 390, height: 844 }]) {
  test(`all fair games keep readable, separate labels in a ${size.width}×${size.height} window`, async ({ page }, testInfo) => {
    await page.setViewportSize(size);
    for (const game of festivalGames) {
      await page.goto(`/festival/${game.id}`);
      await page.getByRole("button", { name: "Let’s play →" }).click();
      const labels = page.locator(".fair-object-label");
      await expect(labels.first()).toBeVisible();
      await expect.poll(() => labels.evaluateAll(elements => {
        const canvas = document.querySelector(".fair-canvas")!.getBoundingClientRect();
        const boxes = elements.map(element => element.getBoundingClientRect());
        return elements.every((element, i) => {
          const rect = boxes[i];
          return parseFloat(getComputedStyle(element).fontSize) >= 16 && rect.height >= 38 &&
            rect.left >= canvas.left && rect.right <= canvas.right && rect.top >= canvas.top && rect.bottom <= canvas.bottom &&
            boxes.every((other, j) => i === j || rect.right <= other.left || rect.left >= other.right || rect.bottom <= other.top || rect.top >= other.bottom);
        });
      }), { message: `${game.name}: labels must be legible, inside the playfield and not overlap` }).toBe(true);
      const canvas = (await page.locator(".fair-canvas").boundingBox())!;
      const objective = (await page.locator(".fair-objective").boundingBox())!;
      const feedback = (await page.locator(".fair-feedback").boundingBox())!;
      expect(objective.y + objective.height).toBeLessThanOrEqual(canvas.y);
      expect(feedback.y).toBeGreaterThanOrEqual(canvas.y + canvas.height);
      await page.screenshot({ path: testInfo.outputPath(`${game.id}.png`) });
    }
  });
}

test("zoom and window resizing preserve the current recipe and readable choices", async ({ page }) => {
  await page.goto("/festival/tea-time");
  await page.getByRole("button", { name: "Let’s play →" }).click();
  const choices = page.getByRole("group", { name: "Playfield choices" });
  await choices.getByRole("button", { name: "Tea", exact: true }).click();
  await page.setViewportSize({ width: 460, height: 551 });
  await expect(choices.getByRole("button", { name: "Tea", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await expect(page.getByRole("button", { name: "Fit playfield" })).toHaveText("120%");
  await choices.getByRole("button", { name: "Milk", exact: true }).click();
  await page.getByRole("button", { name: "Fit playfield" }).click();
  await choices.getByRole("button", { name: "Honey", exact: true }).click();
  await page.getByRole("button", { name: "Serve tea →" }).click();
  await expect(page.locator(".fair-objective")).toContainText("ROUND 2 / 3");
  await expect(page.locator(".fair-hearts")).toHaveAttribute("aria-label", "3 hearts");
});

test("maximum zoom keeps nearby and offscreen labels separate on a short phone screen", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 551 });
  for (const slug of ["echo-pond", "cloud-hop"]) {
    await page.goto(`/festival/${slug}`);
    await page.getByRole("button", { name: "Let’s play →" }).click();
    for (let i = 0; i < 4; i++) await page.getByRole("button", { name: "Zoom in", exact: true }).click();
    await expect(page.getByRole("button", { name: "Fit playfield" })).toHaveText("180%");
    await expect.poll(() => page.locator(".fair-object-label").evaluateAll(elements => {
      const boxes = elements.map(element => element.getBoundingClientRect());
      return boxes.every((box, i) => box.left >= 0 && box.right <= innerWidth &&
        boxes.every((other, j) => i === j || box.right <= other.left || box.left >= other.right || box.bottom <= other.top || box.top >= other.bottom));
    })).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`${slug}-zoom.png`) });
    await page.getByRole("button", { name: "Fit playfield" }).click();
    await expect(page.locator(".fair-objective")).toContainText("ROUND 1");
  }
});
