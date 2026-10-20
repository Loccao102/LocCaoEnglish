import {randomUUID} from "node:crypto";
import {setTimeout as delay} from "node:timers/promises";
import {expect, test, type APIRequestContext, type Page} from "@playwright/test";
import type {WritingAttempt} from "../../lib/writing";

const API = process.env.E2E_API_URL || "http://localhost:8080";
const base = "/v1/ielts/writing/attempts";
const essay = "Public transport helps workers reach their jobs. Reliable buses connect schools and hospitals with residential areas. Governments should improve these services because shared transport can reduce congestion. Roads still need maintenance, but new road construction should not displace investment in affordable and frequent public transport.";
const editor = (page: Page) => page.getByRole("textbox", {name: /^Your (submitted essay|essay|local draft)$/});
async function separateRateWindow() {test.setTimeout(90_000); await delay(60_100);}
test.beforeAll(separateRateWindow); test.afterAll(separateRateWindow);

async function account(request: APIRequestContext) {
  const res = await request.post(`${API}/v1/auth/register`, {data: {email: `writing-${randomUUID()}@example.test`, password: "SunlitTest123!", displayName: "Writing Learner"}});
  expect(res.ok(), await res.text()).toBe(true);
  const a = await res.json(); return {...a, headers: {Authorization: `Bearer ${a.token}`}};
}
async function signIn(page: Page, token: string) {
  await page.goto("/ielts/writing");
  await page.evaluate(token => {localStorage.setItem("loccao_token", token); window.dispatchEvent(new Event("loccao-auth-change"));}, token);
  await expect(page.getByRole("button", {name: "Start writing", exact: true})).toBeVisible();
}
async function start(page: Page) {
  const response = page.waitForResponse(r => r.url().endsWith(base) && r.request().method() === "POST");
  await page.getByRole("button", {name: "Start writing", exact: true}).click();
  const a = await (await response).json() as WritingAttempt;
  await expect(editor(page)).toBeEditable(); return a;
}
async function save(page: Page, text = essay) {
  await editor(page).fill(text);
  await page.getByRole("button", {name: "Save draft", exact: true}).click();
  await expect(page.getByText("Draft saved to your account.", {exact: true})).toBeVisible();
  await expect(page.getByRole("button", {name: "Submit for feedback", exact: true})).toBeEnabled();
}

test("Writing saves real drafts, freezes failed submissions and creates separate revisions", async ({page, request}) => {
  const owner = await account(request); await signIn(page, owner.token); const a = await start(page);
  await editor(page).fill(essay); await page.reload(); await expect(editor(page)).toHaveValue(essay);
  await page.getByRole("button", {name: "Save draft", exact: true}).click();
  await expect(page.getByRole("button", {name: "Submit for feedback"})).toBeEnabled();
  await page.getByRole("button", {name: "Submit for feedback"}).click();
  await expect(page.getByRole("button", {name: "Retry feedback"})).toBeVisible();
  await expect(editor(page)).not.toBeEditable(); await expect(editor(page)).toHaveValue(essay);
  await expect(page.getByRole("region", {name: "Saved Writing feedback"})).toHaveCount(0);
  await page.reload(); await expect(page.getByRole("button", {name: "Retry feedback"})).toBeVisible();
  const res = await request.get(`${API}${base}/${a.id}`, {headers: owner.headers}); const failed = await res.json();
  expect(failed).toMatchObject({status: "failed", essay, generation: 1}); expect(failed.feedback).toBeUndefined();
  await page.getByRole("button", {name: "Create revision"}).click(); await expect(editor(page)).toBeEditable();
  await expect(page.getByText("TASK 2 · REVISION 2")).toBeVisible(); await expect(editor(page)).toHaveValue(essay);
  await save(page, essay + " For example, a frequent bus route can make commuting more predictable.");
  const list = await (await request.get(`${API}${base}`, {headers: owner.headers})).json();
  expect(list.items).toHaveLength(2); expect(list.items.find((x: WritingAttempt) => x.id === a.id).essay).toBe(essay);
  expect((await (await request.get(`${API}/v1/ielts/history`, {headers: owner.headers})).json()).items).toHaveLength(0);
  await page.goto(`/ielts/writing?attempt=${a.id}`); await expect(editor(page)).toHaveValue(essay); await expect(editor(page)).not.toBeEditable();
});

test("Writing recovers a lost start response without creating a duplicate draft", async ({page, request}) => {
  const owner = await account(request); await signIn(page, owner.token);
  await page.route(`**${base}`, async route => {if (route.request().method() === "POST") {await route.fetch(); await route.abort();} else await route.continue();});
  await page.getByRole("button", {name: "Start writing", exact: true}).click(); await expect(page.getByRole("button", {name: "Retry saved request"})).toBeVisible();
  await page.reload(); await expect(editor(page)).toBeEditable();
  expect((await (await request.get(`${API}${base}`, {headers: owner.headers})).json()).items).toHaveLength(1);
});

test("Writing retries an unconfirmed draft unchanged after reload", async ({page, request}) => {
  const owner = await account(request); await signIn(page, owner.token); const a = await start(page);
  let lost = true; const bodies: unknown[] = [];
  await page.route(`**${base}/${a.id}/draft`, async route => {
    bodies.push(route.request().postDataJSON());
    if (lost) {lost = false; await route.abort();} else await route.continue();
  });
  await editor(page).fill(essay); await page.getByRole("button", {name: "Save draft", exact: true}).click();
  await expect(page.getByRole("button", {name: "Retry saved request"})).toBeVisible();
  await page.reload(); await expect(editor(page)).toHaveValue(essay); await expect(editor(page)).not.toBeEditable();
  await page.getByRole("button", {name: "Retry saved request"}).click();
  await expect(page.getByText("Draft saved to your account.", {exact: true})).toBeVisible();
  expect(bodies).toHaveLength(2); expect(bodies[1]).toEqual(bodies[0]);
});

test("Writing permits correcting a draft after a definite validation rejection", async ({page, request}) => {
  const owner = await account(request); await signIn(page, owner.token); const a = await start(page);
  await page.route(`**${base}/${a.id}/draft`, route => route.fulfill({status: 400, json: {error: "Invalid Writing request"}}), {times: 1});
  await editor(page).fill(essay); await page.getByRole("button", {name: "Save draft", exact: true}).click();
  await expect(page.getByText("Invalid Writing request", {exact: true})).toBeVisible();
  await expect(editor(page)).toBeEditable(); await expect(editor(page)).toHaveValue(essay);
  await expect(page.getByRole("button", {name: "Retry saved request"})).toHaveCount(0);
  await save(page, essay + " This corrected sentence develops the position further.");
});

test("Writing recovers a committed draft and submission when responses are lost", async ({page, request}) => {
  const owner = await account(request); await signIn(page, owner.token); const a = await start(page);
  await page.route(`**${base}/${a.id}/draft`, async route => {await route.fetch(); await route.abort();}, {times: 1});
  await editor(page).fill(essay); await page.getByRole("button", {name: "Save draft", exact: true}).click();
  await expect(page.getByRole("button", {name: "Retry saved request"})).toBeVisible();
  await page.reload(); await expect(editor(page)).toBeEditable();
  await expect(page.getByText("Draft saved to your account.", {exact: true})).toBeVisible();
  await page.route(`**${base}/${a.id}/submit`, async route => {await route.fetch(); await route.abort();}, {times: 1});
  await page.getByRole("button", {name: "Submit for feedback"}).click();
  await expect(page.getByRole("button", {name: "Retry saved request"})).toBeVisible();
  await page.reload(); await expect(page.getByRole("button", {name: "Retry feedback"})).toBeVisible();
  const saved = await (await request.get(`${API}${base}/${a.id}`, {headers: owner.headers})).json();
  expect(saved.generation).toBe(1); expect(saved.essay).toBe(essay);
});

test("Writing keeps a pending submission frozen before commit and retries the same payload", async ({page, request}) => {
  const owner = await account(request); await signIn(page, owner.token); const a = await start(page); await save(page);
  const bodies: unknown[] = []; let lost = true;
  await page.route(`**${base}/${a.id}/submit`, async route => {bodies.push(route.request().postDataJSON()); if (lost) {lost = false; await route.abort();} else await route.continue();});
  await page.getByRole("button", {name: "Submit for feedback"}).click();
  await expect(page.getByRole("button", {name: "Retry saved request"})).toBeVisible();
  await page.reload(); await expect(editor(page)).not.toBeEditable();
  await page.getByRole("button", {name: "Retry saved request"}).click();
  await expect(page.getByRole("button", {name: "Retry feedback"})).toBeVisible();
  expect(bodies).toHaveLength(2); expect(bodies[0]).toEqual(bodies[1]);
});

test("Writing does not overwrite another tab's draft", async ({page, request}) => {
  const owner = await account(request); await signIn(page, owner.token); const a = await start(page);
  await editor(page).fill(essay);
  const remote = essay + " Another tab added this sentence.";
  const response = await request.put(`${API}${base}/${a.id}/draft`, {headers: owner.headers, data: {version: 0, essay: remote, rulesVersion: a.rulesVersion}}); expect(response.ok()).toBe(true);
  await page.getByRole("button", {name: "Save draft", exact: true}).click();
  await expect(page.getByRole("button", {name: "Check saved status"})).toBeVisible();
  await page.getByRole("button", {name: "Check saved status"}).click();
  await expect(page.getByText(/This draft changed in another tab/)).toBeVisible(); await expect(editor(page)).toHaveValue(essay);
  await page.getByRole("button", {name: "Use account version"}).click(); await expect(editor(page)).toHaveValue(remote); await expect(editor(page)).toBeEditable();
});

test("Writing ignores a late save after account change and restores the original owner's draft", async ({page, request}) => {
  const owner = await account(request), other = await account(request); await signIn(page, owner.token); const a = await start(page);
  let release!: () => void; const gate = new Promise<void>(resolve => {release = resolve;});
  let arrived!: () => void; const started = new Promise<void>(resolve => {arrived = resolve;});
  await page.route(`**${base}/${a.id}/draft`, async route => {const response = await route.fetch(); arrived(); await gate; await route.fulfill({response});}, {times: 1});
  await editor(page).fill(essay); await page.getByRole("button", {name: "Save draft", exact: true}).click(); await started;
  await page.evaluate(token => {localStorage.setItem("loccao_token", token); window.dispatchEvent(new Event("loccao-auth-change"));}, other.token);
  await expect(page.getByRole("button", {name: "Start writing", exact: true})).toBeVisible(); release();
  await start(page); await expect(editor(page)).toHaveValue("");
  await page.evaluate(token => {localStorage.setItem("loccao_token", token); window.dispatchEvent(new Event("loccao-auth-change"));}, owner.token);
  await expect(editor(page)).toHaveValue(essay); await expect(editor(page)).toBeEditable();
});

test("Writing keeps local edits when another tab submits the saved draft", async ({page, request}) => {
  const owner = await account(request); await signIn(page, owner.token); const a = await start(page); await save(page);
  const local = essay + " My local revision still needs to be saved.";
  await editor(page).fill(local);
  const res = await request.post(`${API}${base}/${a.id}/submit`, {headers: owner.headers, data: {version: 1, essay, rulesVersion: a.rulesVersion, generation: 0}});
  expect(res.ok()).toBe(true); expect((await res.json()).status).toBe("failed");
  await page.reload(); await expect(editor(page)).toHaveValue(local);
  await expect(page.getByText(/This draft changed in another tab/)).toBeVisible();
  await page.getByRole("button", {name: "Use account version"}).click();
  await expect(editor(page)).toHaveValue(essay); await expect(editor(page)).not.toBeEditable();
});

test("Writing preserves corrupt recovery until explicit account restore", async ({page, request}) => {
  const owner = await account(request); await signIn(page, owner.token); await start(page); await save(page);
  const key = await page.evaluate(() => Object.keys(localStorage).find(k => k.startsWith("loccao.writing.v1:"))!);
  await page.evaluate(key => localStorage.setItem(key, "{broken"), key); await page.reload();
  await expect(page.getByRole("button", {name: "Discard unreadable browser copy and load account"})).toBeVisible();
  expect(await page.evaluate(key => localStorage.getItem(key), key)).toBe("{broken");
  await page.getByRole("button", {name: "Discard unreadable browser copy and load account"}).click();
  await expect(editor(page)).toHaveValue(essay); await expect(editor(page)).toBeEditable();
});

test("Writing remains usable with an explicit warning when recovery storage is blocked", async ({page, request}) => {
  const owner = await account(request);
  await page.addInitScript(() => {const original = Storage.prototype.setItem; Storage.prototype.setItem = function(k, v) {if (k.startsWith("loccao.writing.v1:")) throw Error("blocked"); return original.call(this, k, v);};});
  await signIn(page, owner.token); await start(page); await save(page);
  await expect(page.getByText(/This browser cannot keep a recovery copy/)).toBeVisible();
  await page.reload(); await expect(editor(page)).toHaveValue(essay);
});

for (const height of [551, 844]) test(`Writing draft and feedback remain readable at 390x${height}`, async ({page, request}) => {
  await page.setViewportSize({width: 390, height}); const owner = await account(request); await signIn(page, owner.token); const a = await start(page);
  await editor(page).focus(); await page.keyboard.insertText(essay); await page.getByRole("button", {name: "Save draft", exact: true}).click(); await expect(page.getByRole("button", {name: "Submit for feedback"})).toBeEnabled();
  const dimensions = await editor(page).evaluate(el => ({font: parseFloat(getComputedStyle(el).fontSize), width: el.getBoundingClientRect().width}));
  expect(dimensions.font).toBeGreaterThanOrEqual(18); expect(dimensions.width).toBeGreaterThan(250);
  if (process.env.E2E_CAPTURE_WRITING) {await editor(page).scrollIntoViewIfNeeded(); await page.screenshot({path: `.cache/writing-draft-${height}.png`});}
  // Provider success is validated through real Go HTTP/store tests. This fixture
  // checks only rendering of a saved response, never claims a live provider run.
  const fixture: WritingAttempt = {...a, version: 1, essay, status: "completed", completedAt: new Date().toISOString(), feedback: {overall: 0, provider: "configured-llm", model: "ui-fixture", evaluatorVersion: "writing-feedback.v1", rulesVersion: a.rulesVersion, disclaimer: "AI practice feedback, not an official IELTS score.", strengths: ["The topic is clear."], improvements: ["Support your position with a concrete example."], criteria: Object.fromEntries(["taskResponse", "coherenceCohesion", "lexicalResource", "grammarRangeAccuracy"].map(key => [key, {band: 0, evidence: "Public transport helps workers reach their jobs.", comment: "Explain how this supports your argument."}]))}};
  await page.route(`**${base}/${a.id}`, route => route.fulfill({json: fixture})); await page.reload();
  const feedback = page.getByRole("region", {name: "Saved Writing feedback"}); await expect(feedback).toBeVisible(); await expect(feedback.getByRole("heading", {name: "0.0 estimated band"})).toBeVisible();
  await feedback.scrollIntoViewIfNeeded(); await expect(feedback.getByText("Support your position with a concrete example.")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  if (process.env.E2E_CAPTURE_WRITING) {await feedback.getByRole("heading", {name: "0.0 estimated band"}).scrollIntoViewIfNeeded(); await page.screenshot({path: `.cache/writing-feedback-${height}.png`});}
});
