import { festivalById, festivalGames } from "./festival";

export type FairRecord = { best: number; stars: number; visits: number; lastPlayedAt?: string };
export type FairSave = { version: 1; games: Record<string, FairRecord> };
export type FairCompletion = { runId: string; gameId: string; stars: number };
export type FairRun = { runId: string; gameId: string; owner: string };
export const emptyFair = (): FairSave => ({ version: 1, games: {} });
export const FAIR_EVENT = "fair-progress";
const root = "loccao.fair.v2.";
export const fairPrefix = (owner: string) => `${root}${owner}.`;
export function restoreFair(value: unknown): FairSave {
  const raw = value as Partial<FairSave> | null, save = emptyFair();
  if (raw?.version !== 1 || !raw.games) return save;
  for (const game of festivalGames) {
    const record = raw.games[game.id];
    if (!record || !Number.isInteger(record.stars) || record.stars < 1 || record.stars > 3 || !Number.isInteger(record.visits) || record.visits < 1) continue;
    save.games[game.id] = { best: game.rounds * 100 + record.stars * 25, stars: record.stars, visits: Math.min(1000000, record.visits), ...(typeof record.lastPlayedAt === "string" && Number.isFinite(Date.parse(record.lastPlayedAt)) ? { lastPlayedAt: record.lastPlayedAt } : {}) };
  }
  return save;
}
export function applyFair(save: FairSave, completion: FairCompletion, at: string): FairSave {
  const game = festivalById(completion.gameId);
  if (!game || !Number.isInteger(completion.stars) || completion.stars < 1 || completion.stars > 3) throw new Error("This result is not a completed fair game.");
  const previous = save.games[game.id], stars = Math.max(previous?.stars || 0, completion.stars);
  return { version: 1, games: { ...save.games, [game.id]: { best: game.rounds * 100 + stars * 25, stars, visits: (previous?.visits || 0) + 1, lastPlayedAt: at } } };
}
/** Responses from different tabs can arrive out of order. Confirmed records only grow. */
export function mergeFair(a: FairSave, b: FairSave): FairSave {
  const result = restoreFair(a);
  for (const [id, next] of Object.entries(restoreFair(b).games)) {
    const old = result.games[id];
    if (!old) { result.games[id] = next; continue; }
    result.games[id] = { best: Math.max(old.best, next.best), stars: Math.max(old.stars, next.stars), visits: Math.max(old.visits, next.visits), lastPlayedAt: (old.lastPlayedAt || "") > (next.lastPlayedAt || "") ? old.lastPlayedAt : next.lastPlayedAt };
  }
  return result;
}
export function parseStored(key: string): unknown {
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { throw new Error("A saved scrapbook could not be read. It has been kept on this device for recovery."); }
}
// One key per run prevents two tabs overwriting each other's offline queue.
export function queuedFair(owner: string): (FairCompletion & { at: string })[] {
  const prefix = `${fairPrefix(owner)}run.`, entries: (FairCompletion & { at: string })[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith(prefix)) continue;
    const value = parseStored(key) as FairCompletion & { at: string } | null;
    if (!value || key !== prefix + value.runId || !festivalById(value.gameId) || !Number.isInteger(value.stars) || value.stars < 1 || value.stars > 3 || typeof value.at !== "string") throw new Error("A queued memory needs recovery. No saved results have been removed.");
    entries.push(value);
  }
  return entries.sort((a, b) => a.at.localeCompare(b.at) || a.runId.localeCompare(b.runId));
}
export function queueFair(run: FairRun, stars: number) {
  const value = { runId: run.runId, gameId: run.gameId, stars, at: new Date().toISOString() };
  applyFair(emptyFair(), value, value.at);
  const key = `${fairPrefix(run.owner)}run.${run.runId}`, old = parseStored(key) as FairCompletion | null;
  if (old && (old.gameId !== value.gameId || old.stars !== value.stars)) throw new Error("This run already has a different saved result.");
  if (!old) localStorage.setItem(key, JSON.stringify(value));
}
export function guestFair(): FairSave {
  // Preserve the original device scrapbook as the baseline; new runs are a journal.
  let save = restoreFair(parseStored("loccao.friendship-fair.v1"));
  for (const entry of queuedFair("guest")) save = applyFair(save, entry, entry.at);
  return save;
}
