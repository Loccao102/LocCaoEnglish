import { test, expect } from "@playwright/test";
import { festivalById, festivalGames } from "../../lib/game/festival";
import { FestivalSession } from "../../lib/game/festival-session";
import { applyFair, emptyFair, guestFair, queueFair, restoreFair, mergeFair } from "../../lib/game/fair-progress";
import { friendships } from "../../lib/game/journey";
import { newAdventure, completeQuest } from "../../lib/game/progress";
import { quests } from "../../lib/game/catalog";

function advance(session: FestivalSession, seconds = 1.3) { for (let time = 0; time < seconds; time += .05) session.tick(.05); }
function complete(session: FestivalSession) {
  switch (session.game.kind) {
    case "bubble": [0, 1, 2, 3, 0].forEach(answer => { session.choose(answer); advance(session); }); break;
    case "garden": [0, 1, 2].forEach(seed => { session.choose(seed); session.choose(3); advance(session); }); break;
    case "parcel": [0, 1, 2].forEach(address => { session.choose(3); session.choose(address); advance(session); }); break;
    case "echo": for (let length = 2; length <= 6; length++) { advance(session, 5); [0, 2, 1, 3, 0, 1].slice(0, length).forEach(note => session.choose(note)); advance(session); } break;
    case "tea": [[0, 1, 2], [0, 3, 2], [0, 1, 3]].forEach(recipe => { recipe.forEach(id => session.choose(id)); session.submit(); advance(session); }); break;
    case "colour": [[0, 1], [2, 1], [0, 2], [3, 0]].forEach(pair => { pair.forEach(id => session.choose(id)); session.submit(); advance(session); }); break;
    case "hop": for (let ring = 0; ring < 6; ring++) { session.touchRing(ring, .8); advance(session); } break;
    case "bridge": for (const rotations of [[[3,3],[4,3],[5,3]],[[6,3],[3,3],[0,3],[1,3],[2,3]],[[0,3],[1,3],[4,3],[3,2],[6,3],[7,3],[8,3]]]) { for (const [tile, turns] of rotations) for (let i = 0; i < turns; i++) session.choose(tile); session.submit(); advance(session, 3); } break;
  }
}
for (const game of festivalGames) test(`${game.name}: full game completes, gates duplicate actions, and restarts`, () => {
  const session = new FestivalSession(game, () => {});
  session.start(); complete(session);
  expect(session.state.phase).toBe("win"); expect(session.state.round).toBe(game.rounds);
  expect(session.state.score).toBe(game.rounds * 100 + 75);
  session.choose(0); session.submit(); session.touchRing(0, 1); session.hazard(); advance(session, 2);
  expect(session.state.hearts).toBe(3); expect(session.state.score).toBe(game.rounds * 100 + 75);
  session.start(); expect(session.state.round).toBe(0); expect(session.state.score).toBe(0); expect(session.state.hearts).toBe(3);
});
test("wrong answers lose hearts once per cooldown; failed games cannot save a win", () => {
  const session = new FestivalSession(festivalById("bubble-meadow")!, () => {}); session.start();
  for (let i = 0; i < 3; i++) { session.choose(1); session.choose(2); advance(session); }
  expect(session.state.phase).toBe("lose"); expect(session.state.hearts).toBe(0); expect(session.state.score).toBe(0);
  session.choose(0); advance(session); expect(session.state.phase).toBe("lose");
  expect(() => applyFair(emptyFair(), { runId: "x", gameId: session.game.id, stars: 0 }, "today")).toThrow();
});
test("echo replay is free, wrong notes replay the melody, and inputs during listening are ignored", () => {
  const session = new FestivalSession(festivalById("echo-pond")!, () => {}); session.start();
  session.choose(3); expect(session.state.hearts).toBe(3); advance(session, 2);
  session.choose(1); expect(session.state.hearts).toBe(2); expect(session.state.listening).toBe(true);
  advance(session, 3); session.replay(); advance(session, 2); session.choose(0); session.choose(2); advance(session);
  expect(session.state.round).toBe(1); expect(session.state.hearts).toBe(2);
});
test("hop requires the next ring and actual airborne height; restart clears hazard immunity", () => {
  const session = new FestivalSession(festivalById("cloud-hop")!, () => {}); session.start();
  session.touchRing(1, 1); session.touchRing(0, 0); expect(session.state.score).toBe(0);
  expect(session.hazard()).toBe(true); expect(session.hazard()).toBe(false);
  session.start(); expect(session.hazard()).toBe(true);
});
test("invalid object inputs are ignored without corrupting a session", () => {
  for (const game of festivalGames) {
    const session = new FestivalSession(game, () => {}); session.start(); advance(session, 5);
    for (const id of [-1, .5, NaN, 999]) session.choose(id);
    expect(session.state.hearts).toBe(3); expect(session.state.score).toBe(0);
  }
});
test("guest migration, repeated run IDs and distinct account queues preserve every memory", () => {
  const entries = new Map<string, string>();
  const previous = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { get length() { return entries.size; }, key: (i: number) => [...entries.keys()][i], getItem: (key: string) => entries.get(key) || null, setItem: (key: string, value: string) => entries.set(key, value) } });
  try {
    entries.set("loccao.friendship-fair.v1", JSON.stringify({ version: 1, games: { "tea-time": { best: 325, stars: 1, visits: 2 } } }));
    const run = { runId: "first", gameId: "tea-time", owner: "guest" };
    queueFair(run, 3); queueFair(run, 3); queueFair({ ...run, runId: "second" }, 2); queueFair({ ...run, owner: "account-a" }, 3);
    const save = guestFair(); expect(save.games["tea-time"]).toMatchObject({ best: 375, stars: 3, visits: 4 });
    expect(() => queueFair(run, 1)).toThrow();
    expect(restoreFair({ version: 1, games: { "tea-time": { stars: 9, visits: 1 } } }).games).toEqual({});
  } finally { if (previous) Object.defineProperty(globalThis, "localStorage", previous); else Reflect.deleteProperty(globalThis, "localStorage"); }
});
test("all 24 friends have reachable milestones and the full story preserves one-time rewards", () => {
  let adventure = newAdventure(), fair = emptyFair();
  expect(friendships(adventure, fair)).toHaveLength(24);
  for (const quest of quests) adventure = completeQuest(adventure, quest, quest.questions.map(question => question.answer)).save;
  for (const game of festivalGames) fair = applyFair(fair, { runId: game.id, gameId: game.id, stars: 3 }, new Date().toISOString());
  expect(friendships(adventure, fair).every(friend => friend.hearts === 3)).toBe(true);
  expect(adventure.xp).toBe(1050); expect(adventure.coins).toBe(280);
  const replay = completeQuest(adventure, quests[0], quests[0].questions.map(question => question.answer));
  expect(replay.save.xp).toBe(1050); expect(replay.verdict.firstClear).toBe(false);
});

test("out-of-order account responses cannot reduce confirmed progress",()=>{
  const first=applyFair(emptyFair(),{runId:"1",gameId:"tea-time",stars:1},"2026-09-13T00:00:00Z");
  const latest=applyFair(first,{runId:"2",gameId:"tea-time",stars:3},"2026-09-14T00:00:00Z");
  expect(mergeFair(latest,first)).toEqual(latest);
});
