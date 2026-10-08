import { randomUUID } from "node:crypto";
import { test, expect, type APIRequestContext, type Page } from "@playwright/test";
import type { LearningAttempt } from "../../lib/learning-attempt";
import words from "../../backend/internal/learning/catalog.json";
import grammar from "../../backend/internal/learning/grammar_catalog.json";
import collocations from "../../backend/internal/learning/collocation_catalog.json";
import sentences from "../../backend/internal/learning/sentence_catalog.json";
import graph from "../../backend/internal/learning/word_graph_catalog.json";
import readings from "../../backend/internal/learning/reading_catalog.json";
import story from "../../backend/internal/learning/story_catalog.json";

const API = process.env.E2E_API_URL || "http://localhost:8080", base = `${API}/v1/learning/attempts`;
async function account(request: APIRequestContext) {
  const response = await request.post(`${API}/v1/auth/register`, { data: { email: `recovery-${randomUUID()}@example.test`, password: "SunlitTest123!", displayName: "Learning Explorer" } });
  expect(response.ok(), await response.text()).toBe(true);
  return response.json() as Promise<{ token: string; user: { id: string } }>;
}
async function signIn(page: Page, token: string) {
  await page.goto("/account");
  await page.evaluate(value => { localStorage.setItem("loccao_token", value); window.dispatchEvent(new Event("loccao-auth-change")); }, token);
}
const issued = (page: Page) => page.waitForResponse(response => response.url().endsWith("/v1/learning/attempts") && response.request().method() === "POST");
const answerFor = (attempt: LearningAttempt) => attempt.activity === "sentence-builder"
  ? sentences.items.find(item => item.id === attempt.itemKey)!.chunks.join(" ")
  : attempt.activity === "word-graph" ? graph.nodes.find(n => n.id === graph.edges.find(e => e.id === attempt.itemKey)!.to)!.label
  : attempt.activity === "story-choice" ? story.nodes.find(n => n.id === story.start)!.choices!.find(c => c.good)!.label
  : [...words.items, ...grammar.items, ...collocations.items, ...readings.items].find(item => item.id === attempt.itemKey)!.correctAnswer;

test("guest finishes Word Link and restores the exact round and feedback", async ({ page }) => {
  let response = issued(page);
  await page.goto("/games/word-link?pack=travel-airport");
  let attempt: LearningAttempt = await (await response).json();
  for (let i = 0; i < 5; i++) {
    await expect(page.getByText(`Round ${i + 1}/5`, { exact: true })).toBeVisible();
    await page.getByRole("button", { name: answerFor(attempt), exact: false }).click();
    await expect(page.getByText("Connection verified ✓", { exact: true })).toBeVisible();
    await expect(page.getByText(/Guest practice · no account XP/)).toBeVisible();
    if (i === 1) {
      await page.reload();
      await expect(page.getByText("Round 2/5", { exact: true })).toBeVisible();
      await expect(page.getByText("Connection verified ✓", { exact: true })).toBeVisible();
    }
    response = issued(page);
    await page.getByRole("button", { name: i === 4 ? "Play another set" : "Next verified link →", exact: true }).click();
    attempt = await (await response).json();
  }
  await expect(page.getByText("Round 1/5", { exact: true })).toBeVisible();
});

for (const activity of ["word-link", "grammar-repair", "collocation-factory", "sentence-builder", "word-graph", "reading-race", "story-choice"] as const) {
  test(`${activity} restores a lost committed result and keeps account progress isolated`, async ({ page, request }) => {
    const user = await account(request), headers = { Authorization: `Bearer ${user.token}` };
    await signIn(page, user.token);
    const opened = issued(page);
    await page.goto(activity === "word-graph" ? "/word-graph/practice" : activity === "reading-race" ? "/reading" : `/games/${activity}`);
    const attempt: LearningAttempt = await (await opened).json();
    let payload: object = {};
    await page.route("**/v1/learning/attempts/*/submit", async route => {
      payload = route.request().postDataJSON();
      const response = await route.fetch(); expect(response.ok(), await response.text()).toBe(true);
      await route.abort("failed"); // Real API commit succeeded; only its response is lost.
    }, { times: 1 });
    if (activity === "sentence-builder") {
      const available = [...attempt.prompt.chunks!];
      for (const text of sentences.items.find(item => item.id === attempt.itemKey)!.chunks) {
        const index = available.findIndex(c => c.text === text), chunk = available.splice(index, 1)[0];
        await page.locator(`[data-chunk-id="${chunk.id}"]`).click();
      }
      await page.getByRole("button", { name: "Check sentence" }).click();
    } else await page.getByRole("button", { name: answerFor(attempt), exact: activity === "grammar-repair" }).click();
    await expect(page.getByRole("button", { name: "Retry same answer" })).toBeVisible();
    await page.reload();
    await expect(page.getByText("+20 XP · Progress saved.", { exact: true })).toBeVisible();
    const repeated = await request.post(`${base}/${attempt.attemptId}/submit`, { headers, data: payload });
    expect(repeated.ok()).toBe(true); expect((await repeated.json()).xpDelta).toBe(20);
    expect((await (await request.get(`${API}/v1/me`, { headers })).json()).user.xp).toBe(20);
    const restored: LearningAttempt = await (await request.get(`${base}/${attempt.attemptId}`, { headers })).json();
    expect(restored.prompt).toEqual(attempt.prompt);
    expect(restored.result?.actualAnswer).toBe(answerFor(attempt));
    await page.evaluate(() => { localStorage.removeItem("loccao_token"); window.dispatchEvent(new Event("loccao-auth-change")); });
    await expect(page.getByText("Guest practice", { exact: true })).toBeVisible();
    await expect(page.getByText("+20 XP · Progress saved.", { exact: true })).toHaveCount(0);
    expect((await request.get(`${base}/${attempt.attemptId}`)).status()).toBe(404);
  });
}

test("wrong answer review, daily practice cap and tampered payloads use real API", async ({ request }) => {
  const user = await account(request), headers = { Authorization: `Bearer ${user.token}` };
  const input = { requestId: randomUUID(), activity: "word-link", cefrLevel: "B1", pack: "travel-airport" };
  const created = await request.post(base, { headers, data: input });
  expect(created.ok(), await created.text()).toBe(true);
  const a: LearningAttempt = await created.json();
  expect(a).not.toHaveProperty("correctAnswer"); expect(a).not.toHaveProperty("result");
  expect((await request.post(base, { headers, data: { ...input, pack: "cefr-core" } })).status()).toBe(409);
  const wrong = a.prompt.options.find(option => option !== answerFor(a))!;
  const payload = { answer: wrong, contentVersion: a.contentVersion, rulesVersion: a.rulesVersion };
  expect((await request.post(`${base}/${a.attemptId}/submit`, { headers, data: { ...payload, score: 100 } })).status()).toBe(400);
  expect((await request.post(`${base}/${a.attemptId}/submit`, { headers, data: { ...payload, contentVersion: "fake" } })).status()).toBe(400);
  const verdict = await (await request.post(`${base}/${a.attemptId}/submit`, { headers, data: payload })).json();
  expect(verdict).toMatchObject({ correct: false, actualAnswer: wrong, xpDelta: 0, reviewAdded: true });
  const reviews = await (await request.get(`${API}/v1/review`, { headers })).json();
  expect(reviews.items.some((item: { answer: string }) => item.answer === answerFor(a))).toBe(true);
  const replay: LearningAttempt = await (await request.post(base, { headers, data: { ...input, requestId: randomUUID() } })).json();
  const result = await (await request.post(`${base}/${replay.attemptId}/submit`, { headers, data: { ...payload, answer: answerFor(replay) } })).json();
  expect(result).toMatchObject({ correct: true, xpDelta: 0, progressionApplied: false });
  for (const activity of ["word-link", "grammar-repair", "collocation-factory", " COLLOCATION-FACTORY ", "sentence-builder", " SENTENCE-BUILDER ", "word-graph", " WORD-GRAPH ", "reading-race", " READING-RACE ", "story-choice", " STORY-CHOICE "]) expect((await request.post(`${API}/v1/attempts`, { headers, data: { skill: "Vocabulary", activity, itemKey: "fake", accuracy: 1 } })).status()).toBe(409);
});
