import { expect, test, type Page } from "@playwright/test";

const lesson = { id: "lesson-a", slug: "teacher-draft", title: "Teacher A draft", description: "Private draft", level: "B1", skill: "Vocabulary", topic: "CMS", status: "draft", estimatedMins: 10, exercises: [{ id: "exercise-a", kind: "choice", prompt: "Prompt", answer: "Answer", options: ["Answer"], explanation: "", position: 0, xp: 10 }] };

async function openStudio(page: Page, token: string, role: "teacher" | "admin" | "learner" = "teacher") {
  await page.addInitScript(value => localStorage.setItem("loccao_token", value), token);
  await page.route("**/v1/me", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ user: { id: token, email: `${token}@example.test`, displayName: token }, role }) }));
  await page.route("**/v1/admin/lessons", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: [lesson] }) }));
  await page.goto("/admin/content");
}

test("guest sees sign-in boundary", async ({ page }) => {
  await page.goto("/admin/content");
  await expect(page.getByRole("alert")).toContainText("Sign in with a teacher or admin account");
});

test("learner cannot open teacher content", async ({ page }) => {
  await openStudio(page, "learner-b", "learner");
  await expect(page.getByRole("alert")).toContainText("Teacher/admin role required");
  await expect(page.getByText("Teacher A draft")).toHaveCount(0);
});

test("late teacher response cannot repopulate after account switch", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("loccao_token", "teacher-a"));
  let release!: () => void;
  const delayed = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/v1/me", route => {
    const current = route.request().headers().authorization?.replace("Bearer ", "");
    const currentRole = current === "teacher-a" ? "teacher" : "learner";
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ user: { id: current }, role: currentRole }) });
  });
  await page.route("**/v1/admin/lessons", async route => { await delayed; await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: [lesson] }) }); });
  await page.goto("/admin/content");
  await page.evaluate(() => { localStorage.setItem("loccao_token", "learner-b"); window.dispatchEvent(new StorageEvent("storage", { key: "loccao_token" })); });
  release();
  await expect(page.getByRole("alert")).toContainText("Sign in with a teacher or admin account");
  await expect(page.getByText("Teacher A draft")).toHaveCount(0);
});

test("save sends the captured owner token", async ({ page }) => {
  await openStudio(page, "teacher-a");
  await expect(page.getByText("Teacher A draft")).toBeVisible();
  let seen = "";
  await page.unroute("**/v1/admin/lessons");
  await page.route("**/v1/admin/lessons", route => {
    seen = route.request().headers().authorization;
    if (route.request().method() === "DELETE") return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "offline" }) });
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(lesson) });
  });
  await page.getByLabel("Title").fill("Saved title");
  await page.getByRole("button", { name: "Save lesson" }).click();
  await expect.poll(() => seen).toBe("Bearer teacher-a");
  page.on("dialog", dialog => void dialog.accept());
  await page.getByRole("button", { name: "Delete" }).click();
  await expect(page.getByRole("status")).toContainText("could not be deleted");
});

test("list failure offers an explicit retry", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("loccao_token", "teacher-a"));
  let attempts = 0;
  await page.route("**/v1/me", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ user: { id: "teacher-a" }, role: "teacher" }) }));
  await page.route("**/v1/admin/lessons", route => {
    attempts++;
    return route.fulfill(attempts === 1 ? { status: 503, contentType: "application/json", body: JSON.stringify({ error: "offline" }) } : { status: 200, contentType: "application/json", body: JSON.stringify({ items: [lesson] }) });
  });
  await page.goto("/admin/content");
  await expect(page.getByRole("alert")).toContainText("Content Studio is unavailable");
  await page.getByRole("button", { name: "Retry Content Studio" }).click();
  await expect(page.getByText("Teacher A draft")).toBeVisible();
});

test("content studio remains readable on narrow screens", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 551 });
  await openStudio(page, "teacher-a");
  await page.screenshot({ path: ".cache/content-owner-390.png", fullPage: true });
  await page.setViewportSize({ width: 844, height: 551 });
  await page.screenshot({ path: ".cache/content-owner-844.png", fullPage: true });
  await expect(page.getByText("Teacher A draft")).toBeVisible();
});
