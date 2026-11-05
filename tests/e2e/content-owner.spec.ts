import { expect, test, type Page } from "@playwright/test";
test.setTimeout(60_000);

const lesson = { id: "lesson-a", slug: "teacher-draft", title: "Teacher A draft", description: "Private draft", level: "B1", skill: "Vocabulary", topic: "CMS", status: "draft", estimatedMins: 10, exercises: [{ id: "exercise-a", kind: "choice", prompt: "Prompt", answer: "Answer", options: ["Answer"], explanation: "", position: 0, xp: 10 }] };

async function openStudio(page: Page, token: string, role: "teacher" | "admin" | "learner" = "teacher") {
  await page.addInitScript(value => localStorage.setItem("loccao_token", value), token);
  await page.route("**/v1/me", route => {
    const current = route.request().headers().authorization?.replace(/^Bearer /, "");
    return route.fulfill({ json: { user: { id: current, email: "render@example.test", displayName: current }, role: current === token ? role : "learner" } });
  });
  await page.route("**/v1/admin/lessons", route => route.fulfill(route.request().headers().authorization === `Bearer ${token}` ? { json: { items: [lesson] } } : { status: 403, json: { error: "Teacher access required" } }));
  await page.goto("/admin/content");
}

test("guest sees sign-in boundary", async ({ page }) => {
  const reads: string[] = []; page.on("request", request => { if (request.url().includes("/v1/admin/lessons")) reads.push(request.url()); });
  await page.goto("/admin/content");
  await expect(page.getByRole("alert", { name: "Content Studio access", exact: true })).toContainText("Sign in with a teacher or admin account");
  expect(reads).toEqual([]);
});

test("learner cannot open teacher content", async ({ page }) => {
  const reads: string[] = []; page.on("request", request => { if (request.url().includes("/v1/admin/lessons")) reads.push(request.url()); });
  await openStudio(page, "learner-b", "learner");
  await expect(page.getByRole("alert", { name: "Content Studio access", exact: true })).toContainText("Teacher/admin role required");
  await expect(page.getByText("Teacher A draft")).toHaveCount(0);
  expect(reads).toEqual([]);
});

test("late teacher response cannot repopulate after account switch", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("loccao_token", "teacher-a"));
  let release!: () => void;
  let listStarted!: () => void;
  const delayed = new Promise<void>(resolve => { release = resolve; });
  const started = new Promise<void>(resolve => { listStarted = resolve; });
  await page.route("**/v1/me", route => {
    const current = route.request().headers().authorization?.replace("Bearer ", "");
    const currentRole = current === "teacher-a" ? "teacher" : "learner";
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ user: { id: current }, role: currentRole }) });
  });
  await page.route("**/v1/admin/lessons", async route => { listStarted(); await delayed; await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: [lesson] }) }); });
  const navigation = page.goto("/admin/content");
  await started;
  await page.evaluate(() => { localStorage.setItem("loccao_token", "learner-b"); window.dispatchEvent(new StorageEvent("storage", { key: "loccao_token" })); });
  release();
  await navigation;
  await expect(page.getByRole("alert", { name: "Content Studio access", exact: true })).toContainText("Teacher/admin role required");
  await expect(page.getByText("Teacher A draft")).toHaveCount(0);
});

test("loaded teacher content is cleared for learner and logout", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("loccao_token", "teacher-a"));
  await page.route("**/v1/me", route => {
    const token = route.request().headers().authorization?.replace("Bearer ", "");
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ user: { id: token }, role: token === "teacher-a" ? "teacher" : "learner" }) });
  });
  await page.route("**/v1/admin/lessons", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: [lesson] }) }));
  await page.goto("/admin/content");
  await expect(page.getByText("Teacher A draft")).toBeVisible();
  await page.evaluate(() => { localStorage.setItem("loccao_token", "learner-b"); window.dispatchEvent(new StorageEvent("storage", { key: "loccao_token" })); });
  await expect(page.getByRole("alert", { name: "Content Studio access", exact: true })).toContainText("Teacher/admin role required");
  await expect(page.getByText("Teacher A draft")).toHaveCount(0);
  await page.evaluate(() => { localStorage.removeItem("loccao_token"); window.dispatchEvent(new StorageEvent("storage", { key: "loccao_token" })); });
  await expect(page.getByRole("alert", { name: "Content Studio access", exact: true })).toContainText("Sign in with a teacher or admin account");
  await expect(page.getByText("Teacher A draft")).toHaveCount(0);
});

test("save sends the captured owner token", async ({ page }) => {
  await openStudio(page, "teacher-a");
  await expect(page.getByText("Teacher A draft")).toBeVisible();
  await page.getByRole("button", { name: /Teacher A draft/ }).click();
  let seen = "";
  let release!: () => void;
  const delayedSave = new Promise<void>(resolve => { release = resolve; });
  await page.unroute("**/v1/admin/lessons");
  await page.route("**/v1/admin/lessons", route => {
    seen = route.request().headers().authorization;
    if (route.request().method() === "DELETE") return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "offline" }) });
    if (route.request().method() === "GET") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: [lesson] }) });
    return delayedSave.then(() => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ...lesson, title: "Saved title" }) }));
  });
  await page.getByLabel("Title").fill("Saved title");
  await page.getByRole("button", { name: "Save lesson" }).click();
  await expect.poll(() => seen).toBe("Bearer teacher-a");
  await page.evaluate(() => { localStorage.setItem("loccao_token", "learner-b"); window.dispatchEvent(new StorageEvent("storage", { key: "loccao_token" })); });
  release();
  await expect(page.getByRole("alert", { name: "Content Studio access", exact: true })).toContainText("Teacher/admin role required");
  await expect(page.getByText("Saved title")).toHaveCount(0);
});

test("delete failure keeps the selected lesson and reports retry", async ({ page }) => {
  await openStudio(page, "teacher-a");
  await page.getByRole("button", { name: /Teacher A draft/ }).click();
  await page.route("**/v1/admin/lessons/*", route => {
    if (route.request().method() === "DELETE") return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "offline" }) });
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: [lesson] }) });
  });
  page.on("dialog", dialog => void dialog.accept());
  await page.getByRole("button", { name: "Delete" }).click();
  await expect(page.locator(".studio-actions").getByRole("status")).toContainText("Deletion could not be confirmed");
  await expect(page.getByLabel("Title")).toHaveValue("Teacher A draft");
});

test("unauthorized list failure offers an explicit retry", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("loccao_token", "teacher-a"));
  let attempts = 0;
  await page.route("**/v1/me", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ user: { id: "teacher-a" }, role: "teacher" }) }));
  await page.route("**/v1/admin/lessons", route => {
    attempts++;
    return route.fulfill(attempts === 1 ? { status: 401, contentType: "application/json", body: JSON.stringify({ error: "sign in required" }) } : { status: 200, contentType: "application/json", body: JSON.stringify({ items: [lesson] }) });
  });
  await page.goto("/admin/content");
  await expect(page.getByRole("alert", { name: "Content Studio access", exact: true })).toContainText("Teacher/admin role required");
  await page.getByRole("button", { name: "Retry Content Studio" }).click();
  await expect(page.getByText("Teacher A draft")).toBeVisible();
});

test("an unconfirmed save keeps edits through list refresh and hides them on access expiry", async ({ page }) => {
  await openStudio(page, "teacher-a");
  await page.getByRole("button", { name: /Teacher A draft/ }).click();
  await page.getByLabel("Title", { exact: true }).fill("My pending edit");
  let expired = false;
  await page.route("**/v1/admin/lessons", route => {
    if (route.request().method() === "POST") return route.fulfill({ status: expired ? 401 : 503, json: { error: "Unavailable fixture" } });
    return route.fulfill({ json: { items: [lesson] } });
  });
  await page.getByRole("button", { name: "Save lesson", exact: true }).click();
  await expect(page.locator(".studio-actions").getByRole("status")).toContainText("Saving could not be confirmed");
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue("My pending edit");
  await page.getByRole("button", { name: "Refresh lesson list" }).click();
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue("My pending edit");
  expired = true; await page.getByRole("button", { name: "Save lesson", exact: true }).click();
  await expect(page.getByRole("alert", { name: "Content Studio access", exact: true })).toContainText("Teacher/admin role required");
  await expect(page.getByLabel("Title", { exact: true })).toHaveCount(0);
});

test("empty catalogs and exercises without options remain editable", async ({ page }) => {
  await openStudio(page, "teacher-a");
  await expect(page.getByText("Teacher A draft", { exact: true })).toBeVisible();
  let empty = true;
  await page.route("**/v1/admin/lessons", route => route.fulfill({ json: { items: empty ? null : [{ ...lesson, exercises: [{ ...lesson.exercises[0], kind: "writing", options: null }] }] } }));
  await page.getByRole("button", { name: "Refresh lesson list" }).click();
  await expect(page.getByText("Teacher A draft", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Save lesson", exact: true })).toBeEnabled();
  empty = false; await page.getByRole("button", { name: "Refresh lesson list" }).click();
  await page.getByRole("button", { name: /Teacher A draft/ }).click();
  await expect(page.getByLabel("Options (one per line)")).toHaveValue("");
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue("Teacher A draft");
});

test("content studio remains readable on narrow screens", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 551 });
  await openStudio(page, "teacher-a");
  await expect(page.getByText("Teacher A draft")).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await expect(page.getByLabel("Title")).toHaveCSS("font-size", "16px");
  await expect.poll(() => page.locator(".studio-layout").evaluate(root => [...root.querySelectorAll("button, input, select, textarea")].every(el => { const box = el.getBoundingClientRect(); return box.width >= 44 && box.height >= 44; }))).toBe(true);
  await page.screenshot({ path: ".cache/content-owner-390.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: ".cache/content-owner-390x844.png", fullPage: true });
  await expect(page.getByText("Teacher A draft")).toBeVisible();
});
