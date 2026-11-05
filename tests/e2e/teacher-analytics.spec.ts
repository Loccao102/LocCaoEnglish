import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import type { TeacherAnalytics } from "../../lib/platform";
import type { LearningAttempt } from "../../lib/learning-attempt";
import words from "../../backend/internal/learning/catalog.json";

const API = process.env.E2E_API_URL || "http://localhost:8080";
const teacherA = "teacher-render-A", teacherB = "teacher-render-B";
const report = (page: Page) => page.getByRole("region", { name: "Teacher practice report", exact: true });

function fixture(rounds = 6): TeacherAnalytics {
  // Deliberately incompatible legacy scores prove they are not presented as
  // checked results. These fixtures are only rendered, never submitted as work.
  return { method: "teacher-practice.v1", learners: 3, active7d: 99, attempts7d: 999, averageAccuracy: 1, completedLessons: 99,
    skills: [{ skill: "Writing", averageConfidence: 1, learners: 99 }],
    lessons: [{ slug: "example-lesson", title: "Example reported lesson", started: 2, completed: 1, averageScore: 1 }],
    practice: { windowDays: 7, attempts7d: rounds, correct7d: rounds ? rounds - 1 : 0, active7d: rounds ? 2 : 0, skills: rounds ? [
      { skill: "Vocabulary", attempts: rounds - 1, correct: rounds - 2, learners: 2, evidenceKind: "guided-practice" },
      { skill: "Speaking", attempts: 1, correct: 1, learners: 1, evidenceKind: "transcript-match" },
    ] : [] },
  };
}
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}
async function identity(page: Page, token: string) {
  await page.evaluate(value => {
    if (value) localStorage.setItem("loccao_token", value); else localStorage.removeItem("loccao_token");
    window.dispatchEvent(new Event("loccao-auth-change"));
  }, token);
}
async function open(page: Page, token: string) {
  await page.addInitScript(value => {
    if (value) localStorage.setItem("loccao_token", value); else localStorage.removeItem("loccao_token");
  }, token);
  await page.goto("/admin/analytics");
}
async function fixtures(page: Page) {
  const reads: string[] = [], writes: string[] = [];
  await page.route("**/v1/**", async route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    const token = (request.headers().authorization || "").replace(/^Bearer /, "");
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204 });
    if (request.method() !== "GET") { writes.push(path); return route.fulfill({ status: 405, json: { error: "Read-only fixture" } }); }
    if (path === "/v1/me") return route.fulfill({ json: { user: { id: token, email: "render@example.test", displayName: "Render teacher", xp: 0, streak: 0 }, role: token.startsWith("teacher") ? "teacher" : "learner" } });
    if (path === "/v1/admin/analytics") { reads.push(token); return route.fulfill({ json: fixture(token === teacherA ? 6 : 3) }); }
    return route.fulfill({ status: 404, json: { error: "Unrelated fixture route" } });
  });
  return { reads, writes };
}

test("analytics keeps guests and learner accounts outside the teacher report", async ({ page }) => {
  const seen = await fixtures(page);
  await open(page, "");
  await expect(page.getByRole("link", { name: "Sign in for analytics" })).toBeVisible();
  expect(seen.reads).toEqual([]);
  await identity(page, "learner-render");
  await expect(report(page)).toContainText("Teacher or admin access is required");
  expect(seen.reads).toEqual([]);
  await expect(report(page).getByRole("definition")).toHaveCount(0);
  expect(seen.writes).toEqual([]);
});

test("teacher report suppresses the previous account and late responses on switch or logout", async ({ page }) => {
  const seen = await fixtures(page);
  await open(page, teacherA);
  await expect(report(page).getByText("4 correct · 5 checked", { exact: true })).toBeVisible();
  const captured = deferred(), release = deferred(), finished = deferred();
  await page.route("**/v1/admin/analytics", async route => {
    if (route.request().headers().authorization !== `Bearer ${teacherB}`) return route.fallback();
    captured.resolve(); await release.promise;
    await route.fulfill({ json: fixture(42) }); finished.resolve();
  });
  try {
    await identity(page, teacherB); await captured.promise;
    await expect(report(page)).toContainText("Loading checked practice report");
    await expect(report(page)).not.toContainText("4 correct · 5 checked");
    await identity(page, "");
    await expect(page.getByRole("link", { name: "Sign in for analytics" })).toBeVisible();
    release.resolve(); await finished.promise;
    await expect(report(page)).not.toContainText("41 correct");
    await expect(page.getByRole("link", { name: "Sign in for analytics" })).toBeVisible();
    expect(seen.writes).toEqual([]);
  } finally { release.resolve(); }
});

test("teacher report retries unavailable and older reports without inventing zero scores", async ({ page }) => {
  await fixtures(page);
  let mode: "offline" | "old" | "ready" = "offline";
  await page.route("**/v1/admin/analytics", async route => {
    if (mode === "offline") return route.abort("failed");
    const data = fixture(0);
    if (mode === "old") { delete data.method; delete data.practice; }
    return route.fulfill({ json: data });
  });
  await open(page, teacherA);
  await expect(page.getByRole("button", { name: "Retry analytics" })).toBeVisible();
  await expect(report(page).locator("dd")).toHaveCount(0);
  mode = "old"; await page.getByRole("button", { name: "Retry analytics" }).click();
  await expect(page.getByRole("button", { name: "Retry analytics" })).toBeVisible();
  await expect(report(page).locator("dd")).toHaveCount(0);
  mode = "ready"; await page.getByRole("button", { name: "Retry analytics" }).click();
  await expect(report(page)).toContainText("No checked practice in this period");
  await expect(report(page).locator("dd").nth(2)).toHaveText("0");
  await expect(report(page)).not.toContainText(/Average confidence|Avg accuracy|100%/);
});

test("only the newest teacher refresh displays data and expiry hides the report", async ({ page }) => {
  await fixtures(page); await open(page, teacherA);
  await expect(page.getByRole("button", { name: "Refresh analytics" })).toBeVisible();
  let reads = 0, expired = false;
  const captured = deferred(), release = deferred(), finished = deferred();
  await page.route("**/v1/admin/analytics", async route => {
    if (expired) return route.fulfill({ status: 401, json: { error: "Expired session" } });
    if (++reads === 1) {
      captured.resolve(); await release.promise;
      await route.fulfill({ json: fixture(99) }); finished.resolve(); return;
    }
    return route.fulfill({ json: fixture(3) });
  });
  try {
    // A refresh hides the old aggregate while the request is unresolved.
    await page.getByRole("button", { name: "Refresh analytics" }).click(); await captured.promise;
    await expect(report(page)).toContainText("Loading checked practice report");
    await identity(page, teacherB);
    await expect(report(page).getByText("1 correct · 2 checked", { exact: true })).toBeVisible();
    release.resolve(); await finished.promise;
    await expect(report(page)).not.toContainText("97 correct");
    expired = true; await page.getByRole("button", { name: "Refresh analytics" }).click();
    await expect(page.getByRole("link", { name: "Sign in again" })).toBeVisible();
    await expect(report(page).locator("dd")).toHaveCount(0);
  } finally { release.resolve(); }
});

test("teacher report distinguishes transcript practice and remains readable on phones", async ({ page }) => {
  const seen = await fixtures(page); await open(page, teacherA);
  await expect(report(page).getByRole("article", { name: "Speaking checked practice" })).toContainText("Transcript matching · does not assess pronunciation");
  await expect(report(page)).not.toContainText(/Average confidence|Avg accuracy|100%|999/);
  await expect(page.getByRole("region", { name: "Reported lesson activity" })).toContainText("learner reports");
  for (const height of [551, 844]) {
    await page.setViewportSize({ width: 390, height });
    await page.getByRole("button", { name: "Refresh analytics" }).scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const button = await page.getByRole("button", { name: "Refresh analytics" }).boundingBox();
    expect(button!.height).toBeGreaterThanOrEqual(44);
    const count = report(page).getByText("4 correct · 5 checked", { exact: true });
    expect(Number.parseFloat(await count.evaluate(el => getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
    await page.screenshot({ path: `.cache/teacher-practice-${height}.png`, fullPage: true });
  }
  expect(seen.writes).toEqual([]);
});

test("a real teacher reads completed practice and exact retry adds no checked round", async ({ page, request }) => {
  const teacherEmail = process.env.E2E_TEACHER_EMAIL || "e2e-analytics-teacher@example.test";
  const teacher = await request.post(`${API}/v1/auth/login`, { data: { email: teacherEmail, password: "SunlitTest123!" } });
  expect(teacher.ok(), await teacher.text()).toBe(true);
  const { token } = await teacher.json(), headers = { Authorization: `Bearer ${token}` };
  const me = await request.get(`${API}/v1/me`, { headers });
  expect((await me.json()).role, "CI must grant the dedicated teacher by account ID before E2E").toBe("teacher");
  const learner = await request.post(`${API}/v1/auth/register`, { data: { email: `analytics-learner-${randomUUID()}@example.test`, password: "SunlitTest123!", displayName: "CI practice learner" } });
  expect(learner.ok(), await learner.text()).toBe(true);
  const student = await learner.json(), studentHeaders = { Authorization: `Bearer ${student.token}` };
  expect((await request.get(`${API}/v1/admin/analytics`, { headers: studentHeaders })).status()).toBe(403);
  expect((await request.get(`${API}/v1/admin/analytics`)).status()).toBe(401);
  const before = await (await request.get(`${API}/v1/admin/analytics`, { headers })).json() as TeacherAnalytics;
  expect(before.method).toBe("teacher-practice.v1");
  const started = await request.post(`${API}/v1/learning/attempts`, { headers: studentHeaders, data: { requestId: randomUUID(), activity: "word-link", cefrLevel: "A1", pack: "cefr-core" } });
  expect(started.ok(), await started.text()).toBe(true);
  const attempt: LearningAttempt = await started.json();
  const answer = words.items.find(item => item.id === attempt.itemKey)!.correctAnswer;
  const payload = { answer, contentVersion: attempt.contentVersion, rulesVersion: attempt.rulesVersion };
  for (let i = 0; i < 2; i++) {
    const submitted = await request.post(`${API}/v1/learning/attempts/${attempt.attemptId}/submit`, { headers: studentHeaders, data: payload });
    expect(submitted.ok(), await submitted.text()).toBe(true); expect((await submitted.json()).correct).toBe(true);
  }
  const after = await (await request.get(`${API}/v1/admin/analytics`, { headers })).json() as TeacherAnalytics;
  expect(after.practice!.attempts7d).toBe(before.practice!.attempts7d + 1);
  expect(after.practice!.correct7d).toBe(before.practice!.correct7d + 1);
  expect(after.practice!.active7d).toBe(before.practice!.active7d + 1);
  await open(page, token);
  await expect(report(page).locator("dd").nth(2)).toHaveText(String(after.practice!.attempts7d));
  await page.reload();
  await expect(report(page).locator("dd").nth(2)).toHaveText(String(after.practice!.attempts7d));
});
