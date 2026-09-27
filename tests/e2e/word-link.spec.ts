import { randomUUID } from "node:crypto";
import { test, expect, type Page, type APIRequestContext } from "@playwright/test";
import type { WordLinkAttempt } from "../../lib/learning/word-link";

const API = process.env.E2E_API_URL || "http://localhost:8080";
const base = `${API}/v1/learning/word-link/attempts`;
async function account(request: APIRequestContext) {
  const response = await request.post(`${API}/v1/auth/register`, { data: {
    email: `learning-${randomUUID()}@example.test`, password: "SunlitTest123!", displayName: "Word Explorer",
  } });
  expect(response.ok(), await response.text()).toBe(true);
  return response.json() as Promise<{ token: string; user: { id: string } }>;
}
async function signIn(page: Page, token: string) {
  await page.goto("/account");
  await page.evaluate(value => { localStorage.setItem("loccao_token", value); window.dispatchEvent(new Event("loccao-auth-change")); }, token);
}

test("guest completes five server-issued rounds and reload preserves feedback", async ({ page }) => {
  await page.goto("/games/word-link");
  const answers = ["substantial", "increase dramatically", "abundant", "beneficial", "distribute for a purpose"];
  for (const [index, answer] of answers.entries()) {
    await page.getByRole("button", { name: answer, exact: false }).click();
    await expect(page.getByText("Connection found ✓", { exact: true })).toBeVisible();
    await expect(page.getByText("Guest practice · no account XP.", { exact: true })).toBeVisible();
    if (index === 0) {
      await page.reload();
      await expect(page.getByText("Connection found ✓", { exact: true })).toBeVisible();
    }
    await page.getByRole("button", { name: index === 4 ? "Play again" : "Next link →", exact: true }).click();
  }
  await expect(page.getByText("Round 1/5", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "substantial" })).toBeEnabled();
});

test("lost submission response restores committed account result without double XP", async ({ page, request }) => {
  const user = await account(request), headers = { Authorization: `Bearer ${user.token}` };
  await signIn(page, user.token);
  await page.goto("/games/word-link");
  let submittedId = "", payload: object = {};
  await page.route("**/v1/learning/word-link/attempts/*/submit", async route => {
    payload = route.request().postDataJSON();
    submittedId = route.request().url().split("/").at(-2)!;
    const response = await route.fetch();
    expect(response.ok(), await response.text()).toBe(true);
    await route.abort("failed"); // The API committed; only delivery is lost.
  }, { times: 1 });
  await page.getByRole("button", { name: "substantial" }).click();
  await expect(page.getByRole("button", { name: "Retry same answer" })).toBeVisible();
  await page.reload();
  await expect(page.getByText(/\+30 XP · Progress saved/)).toBeVisible();
  const again = await request.post(`${base}/${submittedId}/submit`, { headers, data: payload });
  expect(again.ok()).toBe(true);
  expect((await again.json()).xpDelta).toBe(30);
  expect((await (await request.get(`${API}/v1/me`, { headers })).json()).user.xp).toBe(30);
  await page.evaluate(() => { localStorage.removeItem("loccao_token"); window.dispatchEvent(new Event("loccao-auth-change")); });
  await expect(page.getByText("Guest practice", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "substantial" })).toBeEnabled();
  await expect(page.getByText(/\+30 XP · Progress saved/)).toHaveCount(0);
});

test("actual wrong answer is retained; daily replay and owner tampering cannot award XP", async ({ page, request }) => {
  const user = await account(request), headers = { Authorization: `Bearer ${user.token}` };
  await signIn(page, user.token);
  await page.goto("/games/word-link");
  await page.getByRole("button", { name: "minor", exact: false }).click();
  await expect(page.getByText("Not quite — substantial", { exact: true })).toBeVisible();
  await expect(page.getByText(/Added to your review queue/)).toBeVisible();
  const reviews = await (await request.get(`${API}/v1/review`, { headers })).json();
  expect(reviews.items.some((item: { answer: string }) => item.answer === "substantial")).toBe(true);
  const ref = await page.evaluate(owner => JSON.parse(localStorage.getItem(`loccao.learning.word-link.v1.${owner}.default`)! ), user.user.id);
  const saved: WordLinkAttempt = await (await request.get(`${base}/${ref.attemptId}`, { headers })).json();
  expect(saved.result?.actualAnswer).toBe("minor");
  expect(saved.result?.correct).toBe(false);
  expect((await request.get(`${base}/${ref.attemptId}`)).status()).toBe(404);
  const other = await account(request);
  expect((await request.get(`${base}/${ref.attemptId}`, { headers: { Authorization: `Bearer ${other.token}` } })).status()).toBe(404);
  const created = await request.post(base, { headers, data: { requestId: randomUUID(), pack: "default", round: 0 } });
  const repeat: WordLinkAttempt = await created.json();
  expect(repeat.result).toBeUndefined();
  expect(repeat).not.toHaveProperty("answer");
  expect(repeat).not.toHaveProperty("note");
  const data = { choiceId: repeat.choices.find(choice => choice.label === "substantial")!.id, contentVersion: repeat.contentVersion, rulesVersion: repeat.rulesVersion };
  expect((await request.post(`${base}/${repeat.id}/submit`, { headers, data: { ...data, score: 100 } })).status()).toBe(400);
  const result = await (await request.post(`${base}/${repeat.id}/submit`, { headers, data })).json();
  expect(result).toMatchObject({ correct: true, xpDelta: 0, progressionApplied: false });
  expect((await (await request.get(`${API}/v1/me`, { headers })).json()).user.xp).toBe(10);
  expect((await request.post(`${API}/v1/attempts`, { headers, data: { skill: "Vocabulary", activity: "word-link", itemKey: "fake", prompt: "fake", answer: "fake", accuracy: 1 } })).status()).toBe(409);
});
