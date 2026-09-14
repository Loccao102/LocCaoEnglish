import { test, expect as baseExpect, type Page } from "@playwright/test";
import { PerspectiveCamera, Vector3 } from "three";

test.setTimeout(90000);
const expect = baseExpect.configure({ timeout: 15000 });

async function clickWorld(page: Page, x: number, y: number, z: number) {
  const rect = (await page.locator(".fair-canvas canvas").boundingBox())!;
  const camera = new PerspectiveCamera(43, rect.width / rect.height, .1, 70);
  const distance = rect.width < rect.height ? 18 : 13.8;
  camera.position.set(0, distance * .85, distance * .88);
  camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
  const point = new Vector3(x, y, z).project(camera);
  await page.mouse.click(rect.x + (point.x + 1) / 2 * rect.width, rect.y + (1 - point.y) / 2 * rect.height);
}

async function start(page: Page, slug: string) {
  await page.goto(`/festival/${slug}`);
  await page.getByRole("button", { name: "Let’s play →" }).click();
}

async function won(page: Page, points: number) {
  await expect(page.getByRole("heading", { name: "A memory made together" })).toBeVisible();
  await expect(page.getByText(`${points} points`, { exact: true })).toBeVisible();
  await expect(page.getByText("Friendship stamp and best score saved on this device.")).toBeVisible();
}

test("Little Garden carries all three seeds to the bed through the 3D playfield", async ({ page }) => {
  await start(page, "little-garden");
  for (const [round, seed] of ["sunflower", "bluebell", "rose"].entries()) {
    await expect(page.locator(".fair-objective")).toContainText(`ROUND ${round + 1} / 3`);
    await clickWorld(page, (round - 1) * 3, .65, -2);
    await expect(page.locator(".fair-feedback")).toContainText(`Carrying a ${seed} seed`);
    await clickWorld(page, 0, .25, 2);
  }
  await won(page, 375);
});

test("Parcel Trail picks up and delivers every parcel without crossing into a wrong address", async ({ page }) => {
  await start(page, "parcel-trail");
  for (const round of [0, 1, 2]) {
    await expect(page.locator(".fair-objective")).toContainText(`ROUND ${round + 1} / 3`);
    await clickWorld(page, 0, .9, 2.5);
    await expect(page.locator(".fair-feedback")).toContainText("Deliver");
    await clickWorld(page, (round - 1) * 3.5, .8, -2);
  }
  await won(page, 375);
});

test("Echo Pond accepts its five melodies and can replay the current melody for free", async ({ page }) => {
  await start(page, "echo-pond");
  const choices = page.getByRole("group", { name: "Playfield choices" }).getByRole("button");
  for (let round = 0; round < 5; round++) {
    await expect(page.locator(".fair-objective")).toContainText(`ROUND ${round + 1} / 5`);
    await expect(choices.first()).toBeEnabled();
    if (round === 0) {
      await page.getByRole("button", { name: "↺ Hear it again" }).click();
      await expect(choices.first()).toBeDisabled();
      await expect(choices.first()).toBeEnabled();
    }
    for (const note of [0, 2, 1, 3, 0, 1].slice(0, round + 2)) await choices.nth(note).click();
  }
  await won(page, 575);
});

test("Bridge Builder rotates and sails across all three layouts using its controls", async ({ page }) => {
  await start(page, "bridge-builder");
  const choices = page.getByRole("group", { name: "Playfield choices" });
  const solutions = [[[3, 3], [4, 3], [5, 3]], [[6, 3], [3, 3], [0, 3], [1, 3], [2, 3]], [[0, 3], [1, 3], [4, 3], [3, 2], [6, 3], [7, 3], [8, 3]]];
  for (const [round, rotations] of solutions.entries()) {
    await expect(page.locator(".fair-objective")).toContainText(`ROUND ${round + 1} / 3`);
    for (const [tile, turns] of rotations) for (let i = 0; i < turns; i++) await choices.getByRole("button", { name: new RegExp(`Tile ${tile + 1}`) }).click();
    await page.getByRole("button", { name: "Send boat →" }).click();
  }
  await won(page, 375);
});

for (const frameMs of [32, 160]) test(`Cloud Hop passes all six rings with ${frameMs}ms render frames`, async ({ page }) => {
  test.setTimeout(180000); // Rendering controlled clock frames can be slow on software WebGL.
  await page.clock.install({ time: new Date("2026-09-15T00:00:00Z") });
  await page.addInitScript(frameMs => {
    // Compare an ordinary frame rate with a weak device drawing six frames per second.
    window.requestAnimationFrame = callback => window.setTimeout(() => callback(performance.now()), frameMs);
    window.cancelAnimationFrame = handle => window.clearTimeout(handle);
  }, frameMs);
  await start(page, "cloud-hop");
  await page.clock.pauseAt(new Date("2026-09-15T02:00:00Z"));
  // Control only elapsed time and real input; no direct access to the game session.
  const rings = [[-3, 1], [-3, -1.5], [0, -2.8], [3, -1.5], [3, 1], [0, 2.5]];
  for (const [round, [x, z]] of rings.entries()) {
    await expect(page.locator(".fair-objective")).toContainText(`ROUND ${round + 1} / 6`);
    await clickWorld(page, x, 1.05, z);
    // The two short vertical legs reach their puddles sooner than the diagonal legs.
    await page.clock.runFor(round === 1 || round === 4 ? 240 : 350);
    await page.keyboard.press("Space");
    await page.clock.runFor(2400);
    await expect(page.locator(".fair-hearts")).toHaveAttribute("aria-label", "3 hearts");
  }
  await won(page, 675);
});
