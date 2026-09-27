import { expect, test } from "@playwright/test";

test("world progression is visible to the player", async ({ page }) => {
  await page.goto("/progress");
  await expect(page.getByRole("heading", { name: /Level \d+/i })).toBeVisible();
  await expect(page.locator(".world-path").getByRole("heading", { name: "Training Grounds" })).toBeVisible();
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
  const options = page.locator(".word-option");
  await expect(options.first()).toBeVisible();
  await options.first().click();
  await expect(page.getByText(/Connection verified|Not quite/)).toBeVisible();
});

test("Grammar Repair uses the verified A1-C2 round lifecycle", async ({ page }) => {
  await page.goto("/games/grammar-repair");
  await expect(page.getByLabel("Grammar CEFR level")).toHaveValue("A1");
  const choices=page.locator(".verified-grammar-card .choice-stack button");
  await expect(choices.first()).toBeVisible();
  await choices.first().click();
  await expect(page.locator(".verified-grammar-card").getByText(/Correct repair|Review this pattern/)).toBeVisible();
});

test("campaign links load world-specific practice packs", async ({ page }) => {
  await page.goto("/games/word-link?pack=travel-airport");
  await expect(page.getByText("boarding pass", { exact: true })).toBeVisible();
  await page.goto("/games/collocation-factory?pack=work-standup");
  await expect(page.getByText(/WORK · STAND-UP/)).toBeVisible();
  await expect(page.getByText("fix + ?", { exact: true })).toBeVisible();
  await page.goto("/listening?pack=work-requirements");
  await expect(page.getByText(/WORK · REQUIREMENTS/)).toBeVisible();
  await expect(page.getByRole("button", { name: /play audio/i })).toBeVisible();
});

test("listening and social production surfaces load", async ({ page }) => {
  await page.goto("/listening");
  await expect(page.getByRole("heading", { name: "Listen & Pick" })).toBeVisible();
  await expect(page.getByRole("button", { name: /play audio/i })).toBeVisible();
  await page.goto("/social");
  await expect(page.getByRole("heading", { name: /Compete on practice/i })).toBeVisible();
  await expect(page.getByText(/LIVE CHALLENGES/i)).toBeVisible();
});

test("content studio rejects a learner account", async ({ page }) => {
  await page.goto("/admin/content");
  await expect(page.getByText(/Teacher\/admin role required/i)).toBeVisible();
});
