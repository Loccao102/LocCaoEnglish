import { expect, test } from "@playwright/test";

test("world progression is visible to the player", async ({ page }) => {
  await page.goto("/worlds");
  await expect(page.getByRole("heading", { name: /Level \d+/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Training Grounds" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Achievements" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Rewards you can wear" })).toBeVisible();
});

test("structured lesson catalog comes from the backend", async ({ page }) => {
  await page.goto("/learn");
  await expect(page.getByRole("heading", { name: /Structured lessons/i })).toBeVisible();
  await expect(page.getByText("Airport Check-in Sprint", { exact: true })).toBeVisible();
  await page.getByText("Airport Check-in Sprint", { exact: true }).click();
  await expect(page.getByRole("heading", { name: "Airport Check-in Sprint" })).toBeVisible();
});

test("Word Link is actually playable", async ({ page }) => {
  await page.goto("/games/word-link");
  await page.getByRole("button", { name: "substantial" }).click();
  await expect(page.getByText(/Connection found/)).toBeVisible();
});

test("listening and social production surfaces load", async ({ page }) => {
  await page.goto("/listening");
  await expect(page.getByRole("heading", { name: "Listen & Pick" })).toBeVisible();
  await expect(page.getByRole("button", { name: /play announcement/i })).toBeVisible();
  await page.goto("/social");
  await expect(page.getByRole("heading", { name: /Compete on practice/i })).toBeVisible();
  await expect(page.getByText(/LIVE CHALLENGES/i)).toBeVisible();
});

test("content studio rejects a learner account", async ({ page }) => {
  await page.goto("/admin/content");
  await expect(page.getByText(/Teacher\/admin role required/i)).toBeVisible();
});
