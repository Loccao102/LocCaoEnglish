import { test, expect, type Page } from "@playwright/test";
import type { LearningAttempt } from "../../lib/learning-attempt";
import graph from "../../backend/internal/learning/word_graph_catalog.json";

const issued = (page: Page) => page.waitForResponse(r => r.url().endsWith("/v1/learning/attempts") && r.request().method() === "POST");
const answerFor = (a: LearningAttempt) => graph.nodes.find(n => n.id === graph.edges.find(e => e.id === a.itemKey)!.to)!.label;

test("Word Graph exploration never scores and practice does not render the study answers", async ({ page }, testInfo) => {
  const writes: string[] = [];
  page.on("request", r => { if (r.method() === "POST" && /\/v1\/(learning\/)?attempts/.test(r.url())) writes.push(r.url()); });
  await page.goto("/word-graph");
  const study = page.getByRole("region", { name: "Word graph exploration" });
  await expect(study.getByRole("group", { name: "Travel word map" }).getByRole("button")).toHaveCount(9);
  await study.getByRole("button", { name: "Explore airport", exact: true }).click();
  const details = study.getByRole("complementary", { name: "Word details" });
  await expect(details.getByText("A place where aircraft take off and land.", { exact: true })).toBeVisible();
  await details.getByRole("button", { name: /airport contains.*gate/ }).click();
  await expect(details.getByRole("heading", { name: "gate", exact: true })).toBeVisible();
  expect(writes).toEqual([]);
  const studyHTML = await page.content();
  for (const edge of graph.edges) expect(studyHTML).not.toContain(edge.feedback);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: testInfo.outputPath("graph-explore-desktop.png"), fullPage: true });
  const opened = issued(page);
  await study.getByRole("link", { name: "Practise connections →" }).click();
  const a: LearningAttempt = await (await opened).json();
  await expect(page).toHaveURL(/\/word-graph\/practice$/);
  await expect(page.getByRole("region", { name: "Word graph exploration" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Connections", exact: true })).toHaveCount(0);
  await expect(page.getByRole("complementary", { name: "Word details" })).toHaveCount(0);
  expect(Object.keys(a.prompt).sort()).toEqual(["options", "question", "relation", "word"]);
  expect(a).not.toHaveProperty("result");
  const html = await page.content();
  for (const edge of graph.edges) expect(html).not.toContain(edge.feedback);
  await page.screenshot({ path: testInfo.outputPath("graph-practice-desktop.png"), fullPage: true });
  expect(writes).toHaveLength(1);
});

test("Word Graph restores a pending choice, preserves wrong feedback and completes a varied set", async ({ page }) => {
  let opened = issued(page);
  await page.goto("/word-graph/practice");
  let a: LearningAttempt = await (await opened).json();
  const card = page.getByRole("region", { name: "Word graph practice" });
  const seen = new Set<string>();
  for (let n = 0; n < 3; n++) {
    expect(seen.has(a.itemKey)).toBe(false); seen.add(a.itemKey);
    const correct = answerFor(a), choice = n === 0 ? a.prompt.options.find(o => o !== correct)! : correct;
    let failedPayload: unknown;
    if (n === 0) await page.route("**/v1/learning/attempts/*/submit", async route => { failedPayload = route.request().postDataJSON(); await route.abort("failed"); }, { times: 1 });
    await card.getByRole("button", { name: choice, exact: true }).click();
    if (n === 0) {
      await expect(page.getByRole("button", { name: "Retry same answer" })).toBeVisible();
      await page.reload();
      await expect(card.getByRole("group").locator("button:enabled")).toHaveCount(0);
      const retried = page.waitForRequest(r => r.url().endsWith(`/${a.attemptId}/submit`));
      await page.getByRole("button", { name: "Retry same answer" }).click();
      expect((await retried).postDataJSON()).toEqual(failedPayload);
    }
    await expect(card.getByText(n === 0 ? "Review this connection" : "✓ Connection found", { exact: true })).toBeVisible();
    await expect(card.getByText(graph.edges.find(e => e.id === a.itemKey)!.feedback, { exact: true })).toBeVisible();
    if (n === 0) {
      await page.reload();
      await expect(card.getByText(`Your choice: ${choice}`, { exact: true })).toBeVisible();
      await expect(card.getByText("Round 1/3", { exact: true })).toBeVisible();
    }
    if (n === 2) await expect(card.getByText("Set complete. Ready for another three?")).toBeVisible();
    opened = issued(page);
    await card.getByRole("button", { name: n === 2 ? "Play another set" : "Next connection →" }).click();
    a = await (await opened).json();
  }
  await expect(card.getByText("Round 1/3", { exact: true })).toBeVisible();
});

for (const height of [551, 844]) {
  test(`Word Graph study and practice are readable on 390x${height}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height });
    await page.goto("/word-graph");
    const nodes = page.getByRole("group", { name: "Travel word map" }).getByRole("button");
    const boxes = [];
    for (const node of await nodes.all()) {
      const box = (await node.boundingBox())!; boxes.push(box);
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(await node.locator("strong").evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
    }
    for (let i = 0; i < boxes.length; i++) for (const b of boxes.slice(i + 1)) {
      const a = boxes[i]; expect(a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y).toBe(false);
    }
    await page.getByRole("button", { name: "Explore flight", exact: true }).click();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: testInfo.outputPath("graph-explore-mobile.png"), fullPage: true });
    const opened = issued(page);
    await page.getByRole("link", { name: "Practise connections →" }).click();
    const a: LearningAttempt = await (await opened).json();
    const card = page.getByRole("region", { name: "Word graph practice" });
    await expect(card.getByRole("group").getByRole("button")).toHaveCount(4);
    for (const choice of await card.getByRole("group").getByRole("button").all()) {
      expect((await choice.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      expect(await choice.evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
    }
    const choice = card.getByRole("button", { name: answerFor(a), exact: true });
    await choice.focus(); await page.keyboard.press("Enter");
    await expect(card.getByText("✓ Connection found", { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: testInfo.outputPath("graph-practice-mobile.png"), fullPage: true });
  });
}
