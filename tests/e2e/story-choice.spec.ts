import { test, expect, type Page } from "@playwright/test";
import type { LearningAttempt } from "../../lib/learning-attempt";
import story from "../../backend/internal/learning/story_catalog.json";

const issued = (page: Page) => page.waitForResponse(r => r.url().endsWith("/v1/learning/attempts") && r.request().method() === "POST");
const continued = (page: Page) => page.waitForResponse(r => /\/v1\/learning\/attempts\/[^/]+\/continue$/.test(r.url()));
const choice = (node: string, next: string) => story.nodes.find(n => n.id === node)!.choices!.find(c => c.next === next)!.label;
const card = (page: Page) => page.getByRole("region", { name: "Story choice practice" });

test("Story keeps its branch and one child after losing a committed continue response", async ({ page }, testInfo) => {
  let opened = issued(page);
  await page.goto("/games/story-choice");
  const root: LearningAttempt = await (await opened).json();
  expect(root.story?.step).toBe(1);
  expect(root).not.toHaveProperty("result");
  expect(Object.keys(root.prompt).sort()).toEqual(["options", "passage", "question", "title"]);
  const html = await page.content();
  for (const n of story.nodes) for (const c of n.choices || []) expect(html).not.toContain(c.feedback);
  await page.screenshot({ path: testInfo.outputPath("story-desktop.png"), fullPage: true });
  await card(page).getByRole("button", { name: choice("arrival", "identity"), exact: true }).click();
  await expect(card(page).getByText("✓ Effective decision", { exact: true })).toBeVisible();
  let committed: LearningAttempt | undefined;
  await page.route("**/v1/learning/attempts/*/continue", async route => {
    const response = await route.fetch(); expect(response.ok()).toBe(true);
    committed = await response.json();
    await route.abort("failed");
  }, { times: 1 });
  await card(page).getByRole("button", { name: "Continue the story →" }).click();
  await expect(card(page).getByRole("button", { name: "Retry same request" })).toBeVisible();
  opened = continued(page);
  await page.reload();
  const recovered: LearningAttempt = await (await opened).json();
  expect(recovered.attemptId).toBe(committed?.attemptId);
  expect(recovered.story?.runId).toBe(root.attemptId);
  expect(recovered.story?.history[0].answer).toBe(choice("arrival", "identity"));
  await expect(card(page).getByRole("heading", { name: "Two similar names" })).toBeVisible();
  for (const [node, next] of [["identity", "details"], ["details", "clarify"], ["clarify", "confirmed"]]) {
    await card(page).getByRole("button", { name: choice(node, next), exact: true }).click();
    await expect(card(page).getByRole("status")).toContainText(story.nodes.find(n => n.id === node)!.choices!.find(c => c.next === next)!.feedback);
    await page.reload();
    await expect(card(page).getByRole("group").locator("button:enabled")).toHaveCount(0);
    if (next !== "confirmed") {
      opened = continued(page);
      await card(page).getByRole("button", { name: "Continue the story →" }).click();
      await opened;
    }
  }
  await expect(card(page).getByText("Stay confirmed", { exact: true })).toBeVisible();
  await expect(card(page).getByText("Decision 4", { exact: true })).toBeVisible();
  await card(page).getByText("Your decisions (3)", { exact: true }).click();
  await expect(card(page).locator("details")).toContainText(choice("details", "clarify"));
  opened = issued(page);
  await card(page).getByRole("button", { name: "Try a new story" }).click();
  const fresh: LearningAttempt = await (await opened).json();
  expect(fresh.attemptId).not.toBe(root.attemptId);
  expect(fresh.story?.history).toEqual([]);
});

test("Story locks a pending wrong decision and reaches its unresolved ending", async ({ page }) => {
  const opened = issued(page);
  await page.goto("/games/story-choice");
  const root: LearningAttempt = await (await opened).json();
  let payload: unknown;
  await page.route("**/v1/learning/attempts/*/submit", async route => { payload = route.request().postDataJSON(); await route.abort("failed"); }, { times: 1 });
  await card(page).getByRole("button", { name: choice("arrival", "payment"), exact: true }).click();
  await expect(card(page).getByRole("button", { name: "Retry same answer" })).toBeVisible();
  await page.reload();
  await expect(card(page).getByRole("group").locator("button:enabled")).toHaveCount(0);
  const retried = page.waitForRequest(r => r.url().endsWith(`/${root.attemptId}/submit`));
  await card(page).getByRole("button", { name: "Retry same answer" }).click();
  expect((await retried).postDataJSON()).toEqual(payload);
  await expect(card(page).getByText("Consider the consequence", { exact: true })).toBeVisible();
  const next = continued(page);
  await card(page).getByRole("button", { name: "Continue the story →" }).click();
  await next;
  await card(page).getByRole("button", { name: choice("payment", "duplicate"), exact: true }).click();
  await expect(card(page).getByText("An avoidable second charge", { exact: true })).toBeVisible();
  await expect(card(page).getByText("Goal still unresolved", { exact: true })).toBeVisible();
  await page.reload();
  await expect(card(page).getByText("An avoidable second charge", { exact: true })).toBeVisible();
  await expect(card(page).getByRole("button", { name: "Continue the story →" })).toHaveCount(0);
});

for (const height of [551, 844]) {
  test(`Story is readable and keyboard playable at 390x${height}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height });
    const opened = issued(page);
    await page.goto("/games/story-choice"); await opened;
    const choices = card(page).getByRole("group").getByRole("button");
    await expect(choices).toHaveCount(3);
    for (const button of await choices.all()) {
      expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      expect(await button.evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
    }
    expect(await card(page).getByRole("article").locator("p").evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(18);
    await page.screenshot({ path: testInfo.outputPath("story-mobile.png"), fullPage: true });
    await card(page).getByRole("button", { name: choice("arrival", "details"), exact: true }).focus();
    await page.keyboard.press("Enter");
    await expect(card(page).getByText("✓ Effective decision", { exact: true })).toBeVisible();
    const next = continued(page); await card(page).getByRole("button", { name: "Continue the story →" }).click(); await next;
    await expect(card(page).getByText("Decision 2", { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: testInfo.outputPath("story-next-mobile.png"), fullPage: true });
  });
}
