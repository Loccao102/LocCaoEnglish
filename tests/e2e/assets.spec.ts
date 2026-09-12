import { expect, test } from "@playwright/test";
import { villagePreview } from "../../data/village";

const progression = {
  level: 3, xp: 250, xpIntoLevel: 0, xpForNext: 200,
  worlds: villagePreview.map(world => ({ ...world, unlocked: world.id === "training" || world.id === "travel", progress: world.id === "travel" ? 33 : 0, unlockText: "Reach 700 XP" })),
  achievements: [{ id: "first-spark", title: "First Spark", description: "Earn 20 XP", icon: "✦", unlocked: true, progress: 20, target: 20 }],
  inventory: [{ id: "traveler-badge", name: "World Walker", description: "A passport badge", slot: "badge", unlocked: true, equipped: false }], bosses: [],
};

test("map preserves live unlocks, selection, navigation and loadout", async ({ page }) => {
  await page.route("**/v1/player/progression", route => route.fulfill({ json: progression }));
  await page.route("**/v1/player/loadout", async route => {
    expect(route.request().postDataJSON()).toEqual({ cosmeticId: "traveler-badge" });
    await route.fulfill({ json: { ...progression, inventory: [{ ...progression.inventory[0], equipped: true }] } });
  });
  await page.goto("/progress");
  await expect(page.getByRole("heading", { name: "Level 3 · 2/7 worlds open" })).toBeVisible();
  await expect(page.locator(".village-stop")).toHaveCount(7);
  const arena = page.getByRole("button", { name: /Battle Arena, locked/ });
  await arena.scrollIntoViewIfNeeded(); await arena.click();
  await expect(page.locator("#village-destination")).toContainText("Locked · Reach 700 XP");
  await expect(page.locator("#village-destination a")).toHaveCount(0);
  const travel = page.getByRole("button", { name: /Travel District, 33%/ });
  await travel.scrollIntoViewIfNeeded(); await travel.focus(); await page.keyboard.press("Enter");
  await expect(page.getByRole("link", { name: "Explore this world" })).toHaveAttribute("href", "/travel");
  await expect(travel).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: /BADGE World Walker/ }).click();
  await expect(page.getByRole("button", { name: /BADGE World Walker/ })).toContainText("EQUIPPED");
});

test("offline preview is explorable, does not invent progress and retries", async ({ page }) => {
  let live = false;
  await page.route("**/v1/player/progression", route => route.fulfill(live ? { json: progression } : { status: 503, json: { error: "Offline" } }));
  await page.goto("/progress");
  await expect(page.getByText("World preview · progress not connected")).toBeVisible();
  await expect(page.getByRole("heading", { name: /Level \d/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Explore this world" })).toHaveCount(0);
  await expect(page.locator(".village-stop")).toHaveCount(7);
  const dimensions = await page.evaluate(() => ({ page: document.documentElement.scrollWidth, viewport: innerWidth }));
  expect(dimensions.page).toBeLessThanOrEqual(dimensions.viewport);
  live = true;
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByRole("heading", { name: /Level 3/ })).toBeVisible();
});

test("collection filters all asset categories and downloads real files", async ({ page, request }) => {
  await page.goto("/art-studio");
  await expect(page.locator(".art-tile")).toHaveCount(41);
  await page.getByRole("button", { name: "Companions", exact: true }).click();
  await expect(page.locator(".art-tile")).toHaveCount(4);
  await expect(page.getByRole("img", { name: "Mầm · the explorer" })).toBeVisible();
  await page.getByRole("button", { name: "Paths", exact: true }).click();
  await expect(page.locator(".art-tile")).toHaveCount(10);
  await page.getByRole("button", { name: "Everything", exact: true }).click();
  const manifest = await request.get("/assets/sunlit-village/manifest.json");
  const data = await manifest.json();
  for (const src of new Set<string>(data.assets.map((asset: { src: string }) => asset.src))) expect((await request.get(src)).ok(), src).toBe(true);
  const pack = await request.get("/assets/sunlit-village-pack.zip");
  expect(pack.ok()).toBe(true); expect((await pack.body()).subarray(0, 2).toString()).toBe("PK");
  const dimensions = await page.evaluate(() => ({ page: document.documentElement.scrollWidth, viewport: innerWidth }));
  expect(dimensions.page).toBeLessThanOrEqual(dimensions.viewport);
});

test("Camp applies buildings and chest artwork without bypassing the reward gate", async ({ page }) => {
  await page.route("**/v1/**", route => route.fulfill({ status: 503, json: { error: "Offline" } }));
  await page.route("**/v1/player/progression", route => route.fulfill({ json: progression }));
  await page.route("**/v1/player/daily", route => route.fulfill({ json: { date: "2026-09-12", quests: [], completed: 0, total: 3, chestXp: 50, claimable: false, claimed: false } }));
  await page.goto("/camp");
  await expect(page.getByRole("region", { name: "Welcome to Sunlit Village" })).toBeVisible();
  await expect(page.getByRole("img", { name: "Reward chest · locked" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Clear all quests to unlock chest" })).toBeDisabled();
  await expect(page.locator(".sunlit-world-select [data-asset='travel-station']")).toBeVisible();
});
