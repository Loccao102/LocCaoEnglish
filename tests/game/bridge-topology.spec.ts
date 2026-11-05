import { test, expect } from "@playwright/test";
import { bridgePath } from "../../lib/game/bridge-path";
import { bridgeTopologyPuzzle } from "../../lib/game/bridge-topology";
import { seedNumber, shuffled } from "../../lib/game/challenge";
import { festivalById } from "../../lib/game/festival";
import { FestivalSession } from "../../lib/game/festival-session";

const bridge = festivalById("bridge-builder")!;
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

function legacyCheckpoint(round = 1) {
  const runId = "00000000-0000-4000-8000-000000000001";
  const seed = seedNumber(runId);
  const puzzle = legacyPuzzle(seed, round);
  return {
    version: 1 as const,
    gameId: "bridge-builder",
    courseId: "",
    state: {
      phase: "play" as const, round, hearts: 3, score: round * 100, prompt: `Connect entrance ${puzzle.entry * 3 + 1} to exit ${puzzle.exit * 3 + 3}. Rotate tiles, then send the boat.`, feedback: "", selection: [], carrying: null, lit: -1, listening: false,
      emotion: "curious" as const, revision: 0, elapsed: 12, feathers: [], challenge: { version: 1 as const, level: "adventure" as const, seed, remaining: 90, moves: 0, assists: 0, step: 0, hint: false },
    },
    rotations: legacyRotations(seed, round), wait: 0, nextRound: false, echoClock: 0, echoStep: -1, echoAnswer: 0, lastHazard: 0,
  };
}

test("advanced bridge topology is deterministic, structurally varied and solvable", () => {
  for (const level of ["adventure", "expert"] as const) {
    const fingerprints = new Set<string>();
    const bankRows = new Set<string>();
    let hasNineTileRoute = false;
    for (let seed = 0; seed < 60; seed++) {
      const rounds = new Set<string>();
      for (let round = 0; round < 3; round++) {
        const first = bridgeTopologyPuzzle(seed, round, level);
        const again = bridgeTopologyPuzzle(seed, round, level);
        expect(again).toEqual(first);
        expect(first.topologyVersion).toBe(2);
        expect(first.turns).toEqual(Array(9).fill(0));
        expect(new Set(first.solution).size).toBe(first.solution.length);
        expect(first.solution.length).toBeGreaterThanOrEqual(level === "adventure" ? 5 : 7);
        hasNineTileRoute ||= first.solution.length === 9;
        expect(bridgePath(first.ports, first.turns, first.entry, first.exit)).toEqual(first.solution);
        const fingerprint = JSON.stringify({ entry: first.entry, exit: first.exit, ports: first.ports });
        fingerprints.add(fingerprint);
        rounds.add(fingerprint);
        bankRows.add(`${first.entry}:${first.exit}`);
      }
      expect(rounds.size).toBe(3);
    }
    expect(fingerprints.size).toBeGreaterThan(8);
    expect(bankRows.size).toBeGreaterThan(3);
    if (level === "expert") expect(hasNineTileRoute).toBe(true);
  }
});

test("bridge v2 budget follows the generated route and checkpoints preserve the marker", () => {
  for (const level of ["adventure", "expert"] as const) {
    const session = new FestivalSession(bridge, () => {});
    session.start(undefined, { level, runId: `bridge-topology:${level}` });
    expect(session.bridgeTopologyVersion).toBe(2);
    expect(session.state.challenge?.bridgeTopologyVersion).toBe(2);
    expect(bridgePath(session.puzzle.ports, session.rotations, session.puzzle.entry, session.puzzle.exit)).toEqual([]);
    for (const tile of session.canonicalBridgeRoute) while (session.rotations[tile] !== 0) session.choose(tile);
    expect(session.state.challenge!.moves).toBeLessThanOrEqual(session.turnBudget);
    session.submit();
    expect(session.state.emotion).toBe("joy");
    const snapshot = JSON.parse(JSON.stringify(session.snapshot()));
    const restored = new FestivalSession(bridge, () => {});
    expect(restored.restore(snapshot)).toBe(true);
    expect(restored.state.challenge?.bridgeTopologyVersion).toBe(2);
    expect(restored.rotations).toEqual(session.rotations);
    expect(restored.bridgePath).toEqual(session.bridgePath);
  }
});

test("winning v2 checkpoints retain the third topology instead of selecting a fourth layout", () => {
  for (const level of ["adventure", "expert"] as const) {
    const session = new FestivalSession(bridge, () => {});
    session.start(undefined, { level, runId: `win-topology-${level}` });
    let finalPuzzle: unknown, finalRotations: number[] = [];
    for (let round = 0; round < 3; round++) {
      if (round === 2) { finalPuzzle = session.puzzle; finalRotations = session.initialRotations; }
      for (const tile of session.canonicalBridgeRoute) {
        const turns = (4 - session.rotations[tile]) % 4;
        for (let turn = 0; turn < turns; turn++) session.choose(tile);
      }
      session.submit();
      expect(session.state.emotion).toBe("joy");
      for (let step = 0; step < 60; step++) session.tick(0.05);
    }
    expect(session.state.phase).toBe("win");
    expect(session.puzzle).toEqual(finalPuzzle);
    expect(session.initialRotations).toEqual(finalRotations);
    const restored = new FestivalSession(bridge, () => {});
    expect(restored.restore(session.snapshot())).toBe(true);
    expect(restored.puzzle).toEqual(finalPuzzle);
  }
});

test("legacy bridge checkpoints remain on the original generator and unsupported markers do not mutate restore", () => {
  const raw = legacyCheckpoint();
  expect("bridgeTopologyVersion" in raw.state.challenge).toBe(false);
  const legacy = new FestivalSession(bridge, () => {});
  expect(legacy.restore(raw)).toBe(true);
  expect(legacy.bridgeTopologyVersion).toBe(1);
  expect(legacy.rotations).toEqual(raw.rotations);
  expect(legacy.puzzle).toEqual(legacyPuzzle(raw.state.challenge.seed, raw.state.round));
  expect(legacy.canonicalBridgeRoute).toEqual(legacyRoutes[legacy.puzzleIndex]);
  expect(legacy.turnBudget).toBe(legacy.canonicalBridgeRoute.reduce((sum, id) => sum + (4 - legacy.rotations[id]) % 4, 0) + 5);

  const unsupported = JSON.parse(JSON.stringify(raw));
  unsupported.state.challenge.bridgeTopologyVersion = 99;
  const untouched = new FestivalSession(bridge, () => {});
  const before = JSON.parse(JSON.stringify(untouched.state));
  expect(untouched.restore(unsupported)).toBe(false);
  expect(untouched.state).toEqual(before);

  const otherGame = new FestivalSession(festivalById("bubble-meadow")!, () => {});
  otherGame.start(undefined, { level: "expert", runId: "wrong-game-marker" });
  const nonBridge = JSON.parse(JSON.stringify(otherGame.snapshot()));
  nonBridge.state.challenge.bridgeTopologyVersion = 2;
  const nonBridgeProbe = new FestivalSession(otherGame.game, () => {});
  const nonBridgeBefore = JSON.parse(JSON.stringify(nonBridgeProbe.state));
  expect(nonBridgeProbe.restore(nonBridge)).toBe(false);
  expect(nonBridgeProbe.state).toEqual(nonBridgeBefore);
});
