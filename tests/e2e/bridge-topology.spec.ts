import { test, expect, type Locator, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { bridgePath } from "../../lib/game/bridge-path";
import { bridgeTopologyPuzzle } from "../../lib/game/bridge-topology";
import { seedNumber, shuffled } from "../../lib/game/challenge";

const legacyPuzzles = [
  { entry: 1, exit: 1, ports: [[0, 1], [0, 2], [1, 2], [1, 3], [1, 3], [1, 3], [0, 1], [0, 2], [0, 3]], turns: [1, 1, 2, 1, 1, 1, 2, 0, 2] },
  { entry: 2, exit: 0, ports: [[1, 2], [1, 3], [1, 3], [0, 2], [0, 1], [0, 2], [0, 3], [0, 2], [0, 1]], turns: [1, 1, 1, 1, 2, 1, 1, 1, 2] },
  { entry: 0, exit: 2, ports: [[1, 3], [2, 3], [0, 1], [1, 2], [0, 3], [0, 2], [0, 1], [1, 3], [1, 3]], turns: [1, 1, 2, 2, 1, 1, 1, 1, 1] },
];
const legacyRoutes = [[3, 4, 5], [6, 3, 0, 1, 2], [0, 1, 4, 3, 6, 7, 8]];

function legacyPuzzle(seed: number, round: number) {
  return legacyPuzzles[shuffled([0, 1, 2], seed)[Math.min(round, 2)]];
}

function legacyRotations(seed: number, round: number) {
  const puzzle = legacyPuzzle(seed, round);
  const rotations = puzzle.turns.map((_, id) => shuffled([0, 1, 2, 3], seed + round * 47 + id * 19)[0]);
  while (bridgePath(puzzle.ports, rotations, puzzle.entry, puzzle.exit).length) rotations[puzzle.entry * 3] = (rotations[puzzle.entry * 3] + 1) % 4;
  return rotations;
}

function legacySavedRun() {
  const runId = "00000000-0000-4000-8000-000000000001";
  const seed = seedNumber(runId);
  const round = 0;
  const puzzle = legacyPuzzle(seed, round);
  return {
    version: 1 as const,
    run: { runId, gameId: "bridge-builder", owner: "guest", difficulty: "adventure" as const },
    session: {
      version: 1 as const, gameId: "bridge-builder", courseId: "",
      state: {
        phase: "play" as const, round, hearts: 3, score: 0,
        prompt: `Connect entrance ${puzzle.entry * 3 + 1} to exit ${puzzle.exit * 3 + 3}. Rotate tiles, then send the boat.`, feedback: "", selection: [], carrying: null, lit: -1, listening: false,
        emotion: "curious" as const, revision: 0, elapsed: 12, feathers: [],
        challenge: { version: 1 as const, level: "adventure" as const, seed, remaining: 90, moves: 0, assists: 0, step: 0, hint: false },
      },
      rotations: legacyRotations(seed, round), wait: 0, nextRound: false, echoClock: 0, echoStep: -1, echoAnswer: 0, lastHazard: 0,
    },
    position: { x: 0, z: 3.5 }, savedAt: Date.now(),
  };
}

async function click(page: Page, control: Locator) {
  await expect(control).toBeVisible({ timeout: 15000 });
  await expect(control).toBeEnabled();
  await control.evaluate(element => element.scrollIntoView({ block: "center", behavior: "instant" }));
  const box = (await control.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

async function checkpoint(page: Page) {
  return page.evaluate(() => {
    const key = Object.keys(localStorage).find(item => item.startsWith("loccao.fair.checkpoint.v1.guest.bridge-builder."));
    return key ? JSON.parse(localStorage.getItem(key)!) : null;
  });
}

async function solveRound(page: Page, level: "adventure" | "expert", round: number) {
  const saved = await roundCheckpoint(page, round);
  expect(saved?.session?.state?.challenge?.bridgeTopologyVersion).toBe(2);
  const challenge = saved.session.state.challenge;
  const puzzle = bridgeTopologyPuzzle(challenge.seed, saved.session.state.round, level);
  const choices = page.getByRole("group", { name: "Playfield choices" });
  for (const tile of puzzle.solution) {
    const turns = (4 - saved.session.rotations[tile]) % 4;
    for (let turn = 0; turn < turns; turn++) await click(page, choices.getByRole("button", { name: `Tile ${tile + 1} ↻` }));
  }
  await click(page, page.getByRole("button", { name: "Send boat →" }));
  await page.clock.runFor(3200);
}

async function roundCheckpoint(page: Page, round: number) {
  await expect(page.locator(".fair-objective")).toContainText(`ROUND ${round + 1} / 3`);
  // Recovery writes run once per second. Frozen fake time can stop after the
  // visible transition but just before the next periodic checkpoint tick.
  if ((await checkpoint(page))?.session?.state?.round !== round) await page.clock.runFor(1100);
  await expect.poll(async () => (await checkpoint(page))?.session?.state?.round).toBe(round);
  return checkpoint(page);
}

async function playMode(page: Page, mode: "Adventure" | "Challenge", height: 551 | 844) {
  const level = mode === "Adventure" ? "adventure" : "expert";
  await page.setViewportSize({ width: 390, height });
  await page.clock.resume();
  await page.goto("/festival/bridge-builder");
  await page.getByRole("radio", { name: new RegExp(mode) }).check();
  await click(page, page.getByRole("button", { name: "Let’s play →" }));
  await page.clock.pauseAt(new Date(await page.evaluate(() => Date.now()) + 10000));
  await expect(page.locator(".fair-challenge-status")).toContainText(mode);
  // A reload can install the label layer before WebGL presents its first
  // frame. Advance rendering and let the compositor paint before evidence.
  await page.clock.runFor(320);
  await page.waitForTimeout(80);
  await page.screenshot({ path: `.cache/bridge-topology-${mode.toLowerCase()}-${height}.png` });
  for (let round = 0; round < 3; round++) {
    await expect(page.locator(".fair-objective")).toContainText(`ROUND ${round + 1} / 3`);
    await solveRound(page, level, round);
  }
  await expect(page.getByRole("heading", { name: "A memory made together" })).toBeVisible();
  await expect(page.getByLabel("3 stars", { exact: true })).toBeVisible();
}

for (const mode of ["Adventure", "Challenge"] as const) {
  test(`${mode} Bridge Builder uses generated topology for all three rounds`, async ({ page }) => {
    test.setTimeout(150000);
    await page.clock.install();
    await page.addInitScript(() => {
      window.requestAnimationFrame = callback => window.setTimeout(() => callback(performance.now()), 160);
      window.cancelAnimationFrame = handle => window.clearTimeout(handle);
    });
    await playMode(page, mode, 551);
    await page.reload();
    await playMode(page, mode, 844);
  });
}

test("a genuine v1 bridge checkpoint resumes and solves the original puzzle through the recovery UI", async ({ page }) => {
  test.setTimeout(120000);
  const saved = legacySavedRun();
  const key = "loccao.fair.checkpoint.v1.guest.bridge-builder.classic";
  await page.clock.install();
  await page.addInitScript(value => {
    localStorage.setItem("loccao.fair.checkpoint.v1.guest.bridge-builder.classic", JSON.stringify(value));
    window.requestAnimationFrame = callback => window.setTimeout(() => callback(performance.now()), 160);
    window.cancelAnimationFrame = handle => window.clearTimeout(handle);
  }, saved);
  await page.goto("/festival/bridge-builder");
  await expect(page.getByRole("button", { name: "Continue saved game →" })).toBeVisible();
  await click(page, page.getByRole("button", { name: "Continue saved game →" }));
  await page.clock.pauseAt(new Date(await page.evaluate(() => Date.now()) + 10000));
  await expect(page.locator(".fair-challenge-status")).toContainText("Adventure");
  await expect(page.locator(".fair-objective > strong")).toContainText("Connect entrance");
  await expect(page.locator(".fair-objective > strong")).toContainText("Rotate tiles, then send the boat.");
  expect(await page.evaluate(checkpointKey => {
    const value = JSON.parse(localStorage.getItem(checkpointKey)!);
    return value.session.state.challenge.bridgeTopologyVersion;
  }, key)).toBeUndefined();

  for (let round = 0; round < 3; round++) {
    await expect(page.locator(".fair-objective")).toContainText(`ROUND ${round + 1} / 3`);
    const current = await roundCheckpoint(page, round);
    expect(current.session.state.challenge.bridgeTopologyVersion).toBeUndefined();
    const challenge = current.session.state.challenge;
    const puzzle = legacyPuzzle(challenge.seed, current.session.state.round);
    expect(current.session.state.prompt).toBe(`Connect entrance ${puzzle.entry * 3 + 1} to exit ${puzzle.exit * 3 + 3}. Rotate tiles, then send the boat.`);
    expect(current.session.rotations).toEqual(legacyRotations(challenge.seed, current.session.state.round));
    const index = shuffled([0, 1, 2], challenge.seed)[Math.min(current.session.state.round, 2)];
    const route = legacyRoutes[index];
    expect(bridgePath(puzzle.ports, Array(9).fill(0), puzzle.entry, puzzle.exit)).toEqual(route);
    const choices = page.getByRole("group", { name: "Playfield choices" });
    for (const tile of route) {
      const turns = (4 - current.session.rotations[tile]) % 4;
      for (let turn = 0; turn < turns; turn++) await click(page, choices.getByRole("button", { name: `Tile ${tile + 1} ↻` }));
    }
    await click(page, page.getByRole("button", { name: "Send boat →" }));
    await page.clock.runFor(3200);
    if (round < 2) expect(await page.evaluate(checkpointKey => JSON.parse(localStorage.getItem(checkpointKey)!).session.state.challenge.bridgeTopologyVersion, key)).toBeUndefined();
  }
  await expect(page.getByRole("heading", { name: "A memory made together" })).toBeVisible();
  await expect(page.getByLabel("3 stars", { exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(checkpointKey => localStorage.getItem(checkpointKey), key)).toBeNull();
});

test("an unsupported bridge checkpoint is kept and downloadable without an automatic reset", async ({ page }) => {
  const key = "loccao.fair.checkpoint.v1.guest.bridge-builder.classic";
  const unsupported = JSON.parse(JSON.stringify(legacySavedRun())) as { session: { state: { challenge: Record<string, unknown> } } };
  unsupported.session.state.challenge.bridgeTopologyVersion = 99;
  const raw = JSON.stringify(unsupported);
  await page.clock.install();
  await page.addInitScript(value => localStorage.setItem("loccao.fair.checkpoint.v1.guest.bridge-builder.classic", value), raw);
  await page.goto("/festival/bridge-builder");
  await expect(page.locator(".fair-dialog").getByRole("alert")).toHaveText("This saved game needs a newer version. It is kept here. Download a copy before starting a new run, which replaces this checkpoint.");
  await expect(page.getByRole("button", { name: "Continue saved game →" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Download saved game copy" })).toBeVisible();
  const downloadPending = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download saved game copy" }).click();
  const download = await downloadPending;
  const downloadPath = await download.path();
  expect(downloadPath).not.toBeNull();
  expect(await readFile(downloadPath!, "utf8")).toBe(raw);
  expect(await page.evaluate(checkpointKey => localStorage.getItem(checkpointKey), key)).toBe(raw);
});
