import { randomUUID } from "node:crypto";
import { expect, test, type Locator, type Page } from "@playwright/test";
import type { Course, CourseProgress } from "../../lib/platform";

const API = process.env.E2E_API_URL || "http://localhost:8080";
test.setTimeout(60_000);
const slug = "english-b1-foundations", first = "course-render-A", second = "course-render-B";
const panel = (page: Page) => page.getByRole("region", { name: "Personal course progress", exact: true });
const course: Course = { id: "course-render", slug, title: "English B1 Foundations", description: "Practise useful communication.", level: "B1-B2", status: "published", lessons: [
  { slug: "airport-check-in-sprint", title: "Airport Check-in Sprint", skill: "Vocabulary", level: "B1", position: 0, estimatedMins: 10 },
] };
const progress = (enrolled = false, completedLessons = 0): CourseProgress => ({ courseId: course.id, courseSlug: slug, enrolled, completedLessons, totalLessons: 3, percent: Math.floor(completedLessons / 3 * 100), averageScore: 1 });
async function expectReadableAction(action: Locator) {
  await expect(action).toBeEnabled();
  const contrast = await action.evaluate(el => {
    const style = getComputedStyle(el);
    const luminance = (color: string) => {
      const parts = color.match(/[\d.]+/g)?.map(Number);
      if (!parts || parts.length < 3 || (parts.length > 3 && parts[3] !== 1)) throw new Error("Expected opaque button colours");
      const linear = parts.slice(0, 3).map(value => value / 255).map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
      return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
    };
    const foreground = luminance(style.color), background = luminance(style.backgroundColor);
    return (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
  });
  expect(contrast, "Course recovery action text must remain readable on its button").toBeGreaterThanOrEqual(4.5);
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
  await page.addInitScript(value => localStorage.setItem("loccao_token", value), token);
  await page.goto(`/courses/${slug}`);
}
async function fixtures(page: Page) {
  const reads: string[] = [], writes: string[] = [], enrolled = new Set<string>([first]);
  await page.route("**/v1/**", async route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    const token = (request.headers().authorization || "").replace(/^Bearer /, "");
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204 });
    if (path === `/v1/courses/${slug}`) return route.fulfill({ json: course });
    if (path.endsWith(`/${slug}/progress`)) {
      reads.push(token);
      return route.fulfill({ json: progress(enrolled.has(token), token === first ? 2 : 0) });
    }
    if (path.endsWith(`/${slug}/enroll`)) {
      writes.push(token); enrolled.add(token);
      return route.fulfill({ json: progress(true, token === first ? 2 : 0) });
    }
    return route.fulfill({ status: 404, json: { error: "Unrelated render fixture" } });
  });
  return { reads, writes, enrolled };
}

test("guests browse course lessons without demo progress or enrollment writes", async ({ page }) => {
  const seen = await fixtures(page); await open(page, "");
  await expect(page.getByRole("heading", { name: course.title })).toBeVisible();
  await expect(page.getByRole("link", { name: "Sign in for course progress" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Course lessons" })).toContainText("Airport Check-in Sprint");
  await expect(page.getByRole("button", { name: "Enroll in course" })).toHaveCount(0);
  await expect(panel(page)).not.toContainText(/reported complete|%/);
  expect(seen.reads).toEqual([]); expect(seen.writes).toEqual([]);
});

test("course progress hides the old account and rejects late errors after logout", async ({ page }) => {
  const seen = await fixtures(page); await open(page, first);
  await expect(panel(page)).toContainText("2/3");
  await expect(panel(page)).toContainText("You are enrolled");
  let held = second, fail = false;
  let captured = deferred(), release = deferred(), finished = deferred();
  await page.route("**/v1/courses/*/progress", async route => {
    if (route.request().headers().authorization !== `Bearer ${held}`) return route.fallback();
    const gate = { captured, release, finished }, error = fail;
    gate.captured.resolve(); await gate.release.promise;
    await route.fulfill(error ? { status: 503, json: { error: "Old failed read" } } : { json: progress(false) });
    gate.finished.resolve();
  });
  try {
    await identity(page, second); await captured.promise;
    await expect(panel(page)).toContainText("Loading your course progress");
    await expect(panel(page)).not.toContainText("2/3");
    release.resolve(); await finished.promise;
    await expect(panel(page)).toContainText("0/3");
    await expect(page.getByRole("button", { name: "Enroll in course" })).toBeVisible();
    held = first; fail = true; captured = deferred(); release = deferred(); finished = deferred();
    await identity(page, first); await captured.promise;
    await identity(page, "");
    release.resolve(); await finished.promise;
    await expect(page.getByRole("link", { name: "Sign in for course progress" })).toBeVisible();
    await expect(panel(page)).not.toContainText(/2\/3|Old failed read|unavailable/);
    expect(seen.writes).toEqual([]);
  } finally { release.resolve(); }
});

test("lost enrollment response is confirmed by a read without an extra write", async ({ page }) => {
  const seen = await fixtures(page); await open(page, second);
  await expect(page.getByRole("button", { name: "Enroll in course" })).toBeVisible();
  await page.route("**/v1/courses/*/enroll", async route => {
    seen.writes.push((route.request().headers().authorization || "").replace(/^Bearer /, ""));
    seen.enrolled.add(second); await route.abort("failed");
  }, { times: 1 });
  await page.getByRole("button", { name: "Enroll in course" }).click();
  await expect(panel(page)).toContainText("Enrollment could not be confirmed");
  await expect(panel(page)).not.toContainText("You have not enrolled");
  await page.getByRole("button", { name: "Refresh course progress" }).click();
  await expect(panel(page)).toContainText("You are enrolled");
  expect(seen.writes).toEqual([second]);
  await expect(page.getByRole("button", { name: /Retry enrollment|Enroll in course/ })).toHaveCount(0);
});

test("late enrollment stays with its captured account while another account enrolls", async ({ page }) => {
  const seen = await fixtures(page); seen.enrolled.delete(first);
  await open(page, first);
  const captured = deferred(), release = deferred(), finished = deferred();
  await page.route("**/v1/courses/*/enroll", async route => {
    if (route.request().headers().authorization !== `Bearer ${first}`) return route.fallback();
    seen.writes.push(first); captured.resolve(); await release.promise;
    await route.fulfill({ json: progress(true, 2) }); finished.resolve();
  });
  try {
    await page.getByRole("button", { name: "Enroll in course" }).click(); await captured.promise;
    await identity(page, second);
    await expect(panel(page)).toContainText("0/3");
    await page.getByRole("button", { name: "Enroll in course" }).click();
    await expect(panel(page)).toContainText("You are enrolled");
    release.resolve(); await finished.promise;
    await expect(panel(page)).toContainText("0/3");
    await expect(panel(page)).not.toContainText("2/3");
    expect(seen.writes).toEqual([first, second]);
  } finally { release.resolve(); }
});

test("uncommitted enrollment retries keep the owner and expired writes offer sign-in", async ({ page }) => {
  const seen = await fixtures(page); await open(page, second);
  await page.route("**/v1/courses/*/enroll", route => route.abort("failed"), { times: 1 });
  await page.getByRole("button", { name: "Enroll in course" }).click();
  await expect(page.getByRole("button", { name: "Retry enrollment" })).toBeVisible();
  await page.getByRole("button", { name: "Retry enrollment" }).click();
  await expect(panel(page)).toContainText("You are enrolled");
  expect(seen.writes).toEqual([second]);
  seen.enrolled.delete(first); await identity(page, first);
  await page.route("**/v1/courses/*/enroll", route => route.fulfill({ status: 401, json: { error: "Expired session" } }), { times: 1 });
  await page.getByRole("button", { name: "Enroll in course" }).click();
  await expect(page.getByRole("link", { name: "Sign in again" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Enroll in course|Retry enrollment/ })).toHaveCount(0);
});

test("course catalog survives unavailable progress and phone recovery is readable", async ({ page }) => {
  await fixtures(page);
  let mode: "offline" | "expired" | "ready" = "offline";
  await page.route("**/v1/courses/*/progress", async route => {
    if (mode === "offline") return route.abort("failed");
    return route.fulfill(mode === "expired" ? { status: 401, json: { error: "Session expired" } } : { json: progress(false) });
  });
  await open(page, first);
  await expect(page.getByRole("region", { name: "Course lessons" })).toContainText("Airport Check-in Sprint");
  const retry = page.getByRole("button", { name: "Retry course progress" });
  await expect(retry).toBeVisible();
  for (const height of [551, 844]) {
    await page.setViewportSize({ width: 390, height });
    await retry.scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect((await retry.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await expectReadableAction(retry);
    expect(Number.parseFloat(await panel(page).locator("p").first().evaluate(el => getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
    await page.screenshot({ path: `.cache/course-owner-unavailable-${height}.png`, fullPage: true });
  }
  mode = "expired"; await retry.click();
  await expect(page.getByRole("link", { name: "Sign in again" })).toBeVisible();
  mode = "ready"; await identity(page, second);
  await expect(page.getByRole("button", { name: "Enroll in course" })).toBeVisible();
  for (const height of [551, 844]) {
    await page.setViewportSize({ width: 390, height });
    await expectReadableAction(page.getByRole("button", { name: "Refresh course progress" }));
    await page.screenshot({ path: `.cache/course-owner-ready-${height}.png`, fullPage: true });
  }
});

test("real account enrollment is isolated, survives reload and retries without XP", async ({ page, request }) => {
  async function register() {
    const response = await request.post(`${API}/v1/auth/register`, { data: { email: `course-${randomUUID()}@example.test`, password: "SunlitTest123!", displayName: "Course learner" } });
    expect(response.ok(), await response.text()).toBe(true);
    const data = await response.json();
    return { ...data, headers: { Authorization: `Bearer ${data.token}` } };
  }
  const a = await register(), b = await register();
  const path = `${API}/v1/courses/${slug}`;
  expect((await request.post(`${path}/enroll`, { data: {} })).status()).toBe(401);
  await open(page, a.token);
  await page.getByRole("button", { name: "Enroll in course" }).click();
  await expect(panel(page)).toContainText("You are enrolled");
  await page.reload(); await expect(panel(page)).toContainText("You are enrolled");
  const retry = await request.post(`${path}/enroll`, { headers: a.headers, data: {} });
  expect(retry.ok(), await retry.text()).toBe(true); expect((await retry.json()).enrolled).toBe(true);
  expect((await (await request.get(`${API}/v1/me`, { headers: a.headers })).json()).user.xp).toBe(0);
  await identity(page, b.token);
  await expect(panel(page)).toContainText("You have not enrolled");
  await expect(page.getByRole("button", { name: "Enroll in course" })).toBeVisible();
  expect((await (await request.get(`${path}/progress`, { headers: b.headers })).json()).enrolled).toBe(false);
});
