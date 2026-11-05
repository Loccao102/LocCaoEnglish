import type { FairCompletion, FairSave } from "./fair-progress";

export type QueuedFairCopy = FairCompletion & { at: string };
export type FairConflict = { queued: QueuedFairCopy; queuedRaw: string; saved: FairCompletion };
export type FairConflictArchive = FairConflict & { version: 1; method: "fair-conflict-archive.v1"; archivedAt: string };
export type FairReceipt = { method: "fair-keepsake.v1"; playerId: string; completion: FairCompletion; save: FairSave };

export function sameFairCompletion(a: FairCompletion, b: FairCompletion) {
  return a.runId === b.runId && a.gameId === b.gameId && a.stars === b.stars &&
    (a.difficulty || "") === (b.difficulty || "") && (a.courseId || "") === (b.courseId || "") &&
    (a.elapsedMs || 0) === (b.elapsedMs || 0) && (a.feathers || 0) === (b.feathers || 0);
}

function archiveKey(prefix: string, runId: string) { return `${prefix}resolved.${runId}`; }

export function queuedFairRaw(prefix: string, queued: QueuedFairCopy) {
  const raw = localStorage.getItem(`${prefix}run.${queued.runId}`);
  const value = raw ? JSON.parse(raw) as QueuedFairCopy : null;
  if (!raw || !value || !sameFairCompletion(value, queued) || value.at !== queued.at) {
    throw new Error("This queued copy changed in another tab. Retry sync to check it again.");
  }
  return raw;
}

function readArchive(raw: string): FairConflictArchive {
  const value = JSON.parse(raw) as FairConflictArchive;
  if (value?.version !== 1 || value.method !== "fair-conflict-archive.v1" ||
    typeof value.queuedRaw !== "string" || typeof value.archivedAt !== "string" ||
    !value.queued?.runId || !value.saved?.runId || value.queued.runId !== value.saved.runId) {
    throw new Error("A kept local copy needs recovery. It has not been removed.");
  }
  const queued = JSON.parse(value.queuedRaw) as QueuedFairCopy;
  if (!sameFairCompletion(queued, value.queued) || queued.at !== value.queued.at) {
    throw new Error("A kept local copy could not be verified. It has not been removed.");
  }
  return value;
}

/** Resolution never deletes/overwrites a queued payload, even across tabs. */
export function isArchivedFairCopy(prefix: string, runId: string, queuedRaw: string) {
  const raw = localStorage.getItem(archiveKey(prefix, runId));
  return raw ? readArchive(raw).queuedRaw === queuedRaw : false;
}

export function archivedFairCopies(prefix: string): FairConflictArchive[] {
  const copies: FairConflictArchive[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith(`${prefix}resolved.`)) continue;
    const raw = localStorage.getItem(key);
    if (!raw) continue;
    const copy = readArchive(raw);
    if (key !== archiveKey(prefix, copy.queued.runId)) throw new Error("A kept local copy needs recovery. No data was removed.");
    copies.push(copy);
  }
  return copies.sort((a, b) => a.archivedAt.localeCompare(b.archivedAt));
}

export function archiveFairConflict(prefix: string, conflict: FairConflict) {
  const runKey = `${prefix}run.${conflict.queued.runId}`;
  if (localStorage.getItem(runKey) !== conflict.queuedRaw) {
    throw new Error("This queued copy changed in another tab. Retry sync to check it again.");
  }
  const key = archiveKey(prefix, conflict.queued.runId), existing = localStorage.getItem(key);
  if (existing) {
    const copy = readArchive(existing);
    if (copy.queuedRaw !== conflict.queuedRaw || !sameFairCompletion(copy.saved, conflict.saved)) {
      throw new Error("Another local copy is already kept for this run. No queued data was changed.");
    }
    return;
  }
  const copy: FairConflictArchive = { version: 1, method: "fair-conflict-archive.v1", ...conflict, archivedAt: new Date().toISOString() };
  localStorage.setItem(key, JSON.stringify(copy));
  // The original run key remains intact. Only this exact byte-for-byte copy is
  // excluded from future uploads; a changed/new payload becomes pending again.
}
