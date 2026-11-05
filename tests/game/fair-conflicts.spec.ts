import { expect, test } from "@playwright/test";
import { archiveFairConflict, archivedFairCopies, type FairConflict } from "../../lib/game/fair-conflicts";
import { fairPrefix, queuedFair } from "../../lib/game/fair-progress";

test("resolving a conflicting memory preserves the exact queue bytes and never creates another clear", () => {
  const data = new Map<string, string>();
  const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  let refuseArchive = false;
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
    get length() { return data.size; }, key: (i: number) => [...data.keys()][i] ?? null,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { if (refuseArchive && key.includes(".resolved.")) throw new Error("quota"); data.set(key, value); },
    removeItem: () => { throw new Error("resolution must not delete any queued data"); },
  } });
  try {
    const queued = { runId: "12345678-1234-4123-8123-123456789012", gameId: "tea-time", stars: 1, at: "2026-11-05T00:00:00Z" };
    const queuedRaw = JSON.stringify(queued, null, 2), prefix = fairPrefix("owner-a"), key = `${prefix}run.${queued.runId}`;
    const conflict: FairConflict = { queued, queuedRaw, saved: { ...queued, stars: 3 } };
    data.set(key, queuedRaw);
    data.set(`${fairPrefix("owner-b")}run.${queued.runId}`, queuedRaw);
    expect(queuedFair("owner-a")).toHaveLength(1);

    refuseArchive = true;
    expect(() => archiveFairConflict(prefix, conflict)).toThrow("quota");
    expect(data.get(key)).toBe(queuedRaw);
    expect(queuedFair("owner-a")).toHaveLength(1);
    refuseArchive = false;
    archiveFairConflict(prefix, conflict);
    const firstArchive = data.get(`${prefix}resolved.${queued.runId}`);
    archiveFairConflict(prefix, conflict);
    expect(data.get(`${prefix}resolved.${queued.runId}`)).toBe(firstArchive);
    expect(data.get(key)).toBe(queuedRaw);
    expect(queuedFair("owner-a")).toEqual([]);
    expect(queuedFair("owner-b")).toHaveLength(1);
    expect(archivedFairCopies(prefix)[0]).toMatchObject({ queuedRaw, queued, saved: { stars: 3 } });

    // A concurrent/new payload is not covered by the earlier acknowledgement.
    data.set(key, JSON.stringify({ ...queued, stars: 2 }));
    expect(queuedFair("owner-a")).toHaveLength(1);
    expect(() => archiveFairConflict(prefix, conflict)).toThrow("changed in another tab");
    expect(data.get(`${prefix}resolved.${queued.runId}`)).toBe(firstArchive);
  } finally {
    if (original) Object.defineProperty(globalThis, "localStorage", original);
    else Reflect.deleteProperty(globalThis, "localStorage");
  }
});
